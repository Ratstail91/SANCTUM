// .env Variables
require("dotenv").config({path: "../.env"});

//socket.io setup
let server = require("http").createServer();
let io = require("socket.io")(server);
let ioAuth = require("socketio-auth");

ioAuth(io, {
	authenticate: function(socket, data, callback) {
		return callback(null, data.SERVER_PASS_KEY === process.env.SERVER_PASS_KEY);
	},
	postAuthenticate: function(socket, data) {
		console.log("Authenticated: " + data.username);
		socket.client.username = data.username;
	}
});

//mysql
let mysql = require("mysql");

let dbConnection = mysql.createConnection({
	host: process.env.DATABASE_HOST,
	user: process.env.DATABASE_USER,
	password: process.env.DATABASE_PASSWORD
});

dbConnection.connect((err) => {
	if (err) throw err;
	console.log("Connected to the database");
	dbConnection.query("USE sanctum;");
});

//shared code
let calcRandom = require('../Shared/calc_random');

//TODO: isolate these responses to specific bots
io.on("connection", async (socket) => {
	console.log("made socket connection");

	socket.on("disconnect", async () => {
		console.log(socket.client.username + " disconnected");
	});

	socket.on("serverPing", handleServerPing);
	socket.on("updateStamina", handleUpdateStamina);
	socket.on("conversion", handleConversion);
	socket.on("checkin", handleCheckin);
	socket.on("wallet", handleWallet);
	socket.on("transfer", handleTransfer);
	socket.on("userStats", handleUserStats);
	socket.on("addXP", handleAddXP);
	socket.on("levelUp", handleLevelUp);
	socket.on("reviveAll", handleReviveAll);
	socket.on("revive", handleRevive);
	socket.on("heal", handleHeal);
	socket.on("upgrade", handleUpgrade);
});

//listen
server.listen(process.env.SERVER_PORT);
console.log("listening on port " + process.env.SERVER_PORT);

//respond to a ping with a pong
async function handleServerPing({ data }, fn) {
	return fn("SERVER PONG!");
}

//update the playerbase's stamina on command
async function handleUpdateStamina({ userID, data }) {
	let query = "UPDATE users SET stamina = stamina + 1 WHERE stamina < maxStamina;";
	dbConnection.query(query, (err, result) => {
		if (err) throw err;
//		console.log("updated stamina for all users");
	});
};

//handle initial faction join and faction conversions
async function handleConversion({ data }, fn) {
	//data[0] = user ID
	//data[1] = factionRole

	//possible arguments to fn: ["joined", "alreadyJoined", "conversionLocked", "newUser"]

	//find the last time this user converted
	let query = "SELECT faction FROM users WHERE userID = ? LIMIT 1;";

	return dbConnection.query(query, [data[0]], (err, result) => {
		if (err) throw err;

		//check if this is a new user
		if (result.length === 0) {
			let query = "INSERT INTO users (userID, faction, factionChanged) VALUES (?, ?, NOW());";
			return dbConnection.query(query, [data[0], data[1]], (err, result) => {
				if (err) throw err;
				dbLog(data[0], "new user", "joined faction " + data[1]);
				return fn("newUser");
			});
		}

		//check if already joined this faction
		if (result[0].faction == data[1]) { //faction == factionRole
			return fn("alreadyJoined");
		}

		//check if enough time has passed to join a new faction
		let query = "SELECT TIME_TO_SEC(TIMEDIFF(NOW(), factionChanged)) FROM users WHERE userID = ? LIMIT 1;";
		return dbConnection.query(query, [data[0]], (err, result) => {
			if (err) throw err;
			if(result[0]['TIME_TO_SEC(TIMEDIFF(NOW(), factionChanged))'] < 60 * 60 * 24 * 7) { //7 days
				return fn("conversionLocked"); //too soon
			} else {
				//update the database with the join
				query = "UPDATE users SET faction = ?, factionChanged = NOW() WHERE userID = ?;";
				return dbConnection.query(query, [data[1], data[0]], (err, result) => {
					if (err) throw err;
					dbLog(data[0], "joined", "joined faction " + data[1]);
					return fn("joined");
				});
			}
		})
	});
}

//handle checkin, and add 1 XP
async function handleCheckin({ data }, fn) { //TODO: You already checked in with me today, you should check in again after X hours
	//handle checkins (grant crystal bonus)

	//arguments to fn: ["available", time since last checkin], randomAmount

	let randomAmount = calcRandom.Random(4, 9);

	let query = "SELECT TIME_TO_SEC(TIMEDIFF(NOW(), lastCheckin)) FROM users WHERE userID = ? LIMIT 1;";
	return dbConnection.query(query, [data[0]], (err, result) => {
		if (err) throw err;

		if (result[0]["TIME_TO_SEC(TIMEDIFF(NOW(), lastCheckin))"] == null || result[0]["TIME_TO_SEC(TIMEDIFF(NOW(), lastCheckin))"] > 60 * 60 * 22) { //22 hours
			let query = "UPDATE users SET lastCheckin = NOW(), wallet = wallet + ? WHERE userID = ? LIMIT 1;";
			return dbConnection.query(query, [randomAmount, data[0]], (err, result) => {
				if (err) throw err;
				dbLog(data[0], "checkin", "gained " + randomAmount + " to wallet");
				addExperience(data[0], 1); //Add 1 XP on every checkin
				return fn("available", randomAmount);
			});
		} else {
			return fn(calculateTimeAgo(result[0]["TIME_TO_SEC(TIMEDIFF(NOW(), lastCheckin))"]));
		}
	});
}

//handle account requests
async function handleWallet({ data }, fn) {
	//data[0] = ID of the person to check

	let query = "SELECT wallet FROM users WHERE userID = ? LIMIT 1;";
	dbConnection.query(query, [data[0]], (err, result) => {
		if (err) throw err;
		dbLog(data[0], "wallet query", "result: " + result[0].wallet);
		return fn(result[0].wallet);
	});
}

//handle transfering wallet balance between accounts
async function handleTransfer({ data }, fn) {
	console.log("received a transfer request...");
	//data[0] = ID of the source account
	//data[1] = ID of the destination account
	//data[2] = amount to send

	//parameters to fn: ["success", "failure"]

	//check there's enough in the sender's wallet
	let query = "SELECT wallet - ? FROM users WHERE userID = ? LIMIT 1;";
	return dbConnection.query(query, [data[2], data[0]], (err, result) => {
		if (err) throw err;

		//too little in there
		if (result[0]["wallet - ?"] < 0) {
			return fn("failure");
		}

		//check the recipient is real
		let query = "SELECT * FROM users WHERE userID = ? LIMIT 1;";
		return dbConnection.query(query, [data[1]], (err, result) => {
			if (err) throw err;

			if (result.length == 0) {
				return fn("failure");
			}

			//subtract from the sender
			let query = "UPDATE users SET wallet = wallet - ? WHERE userID = ? LIMIT 1;";
			return dbConnection.query(query, [data[2], data[0]], (err, result) => {
				if (err) throw err;

				//add to the recipient
				let query = "UPDATE users SET wallet = wallet + ? WHERE userID= ? LIMIT 1;";
				return dbConnection.query(query, [data[2], data[1]], (err, result) => {
					if (err) throw err;

					//finally
					dbLog(data[0], "wallet transfer", data[2] + " to " + data[1]);
					return fn("success");
				});
			});
		});
	});
}

//handle the user stats
async function handleUserStats({ data }, fn) {
	console.log("received a userStats request...");
	//data[0] = user ID

	//parameters to fn: stat structure

	let query = "SELECT level, experience, maxHealth, health, maxStamina, stamina, strength, speed, upgradePoints, wallet FROM users WHERE userID = ? LIMIT 1;";
	return dbConnection.query(query, [data[0]], (err, result) => {
		if (err) throw err;

		let stats = {
			level: result[0].level,
			experience: result[0].experience,
			levelProgress: calculateLevelProgress(result[0].experience),
			maxHealth: result[0].maxHealth,
			health: result[0].health,
			maxStamina: result[0].maxStamina,
			stamina: result[0].stamina,
			strength: result[0].strength,
			speed: result[0].speed,
			upgradePoints: result[0].upgradePoints,
			wallet: result[0].wallet
		};

		return fn(stats);
	});
}

//DEBUGGING?
async function handleAddXP({ userID, data }) {
	console.log("received an addXP request...");
	//data[0] = amount

	addExperience(userID, data[0]);
}

//handle levelling up
async function handleLevelUp({ data }, fn) {
	//NOTE: levelling up is handled manually because of reasons
	console.log("received a levelUp request...");
	//data[0] = user ID

	//parameters to fn: ["none", "levelUp"], level, upgradePoints

	//get the current level and total amount of experience
	let query = "SELECT level, experience, upgradePoints FROM users WHERE userID = ? LIMIT 1;";
	return dbConnection.query(query, [data[0]], (err, result) => {
		if (err) throw err;

		//calculate the correct level, and compare it with the result
		let newLevel = Math.floor(calculateLevel(result[0].experience));

		//if no levelling, return
		if (newLevel == result[0].level) {
			return fn("none", result[0].level, result[0].upgradePoints);
		}

		//handle the level cap
		if (newLevel >= process.env.RANK_3_THRESHOLD) {
			//update the level, add lootbox
			//TODO: add lootbox item
			let query = "UPDATE users SET level = ? WHERE userID = ? LIMIT 1;";
			return dbConnection.query(query, [newLevel, data[0]], (err, result) => {
				if (err) throw err;

				//finally, pass the level and upgrade points to the client
				let query = "SELECT level, upgradePoints FROM users WHERE userID = ? LIMIT 1;";
				return dbConnection.query(query, [data[0]], (err, result) => {
					if (err) throw err;
					dbLog(data[0], "level max", "level: " + result[0].level + ", upgrade points: " + result[0].upgradePoints + ", lootboxes: ???");
					return fn("levelUp", result[0].level, result[0].upgradePoints);
				});
			});
		}

		//update the level and the upgrade points
		let query = `UPDATE users SET level = ${newLevel}, upgradePoints = upgradePoints + ${newLevel - result[0].level} WHERE userID='${data[0]}' LIMIT 1;`;
		return dbConnection.query(query, (err, result) => {
			if (err) throw err;

			//finally, pass the level and upgrade points to the client
			let query = `SELECT level, upgradePoints FROM users WHERE userID='${data[0]}' LIMIT 1;`;
			return dbConnection.query(query, (err, result) => {
				if (err) throw err;
				dbLog(data[0], "level up", "level: " + result[0].level + ", upgrade points: " + result[0].upgradePoints);
				return fn("levelUp", result[0].level, result[0].upgradePoints);
			});
		});
	});
}

//handle the daily revives
async function handleReviveAll({ data }, fn) {
	console.log("received a reviveAll request...");

	//parameters to fn: none

	let query = "UPDATE users SET health = maxHealth;";
	return dbConnection.query(query, (err, result) => {
		if (err) throw err;

		return fn();
	});
}

//handle reviving a specific player
async function handleRevive({ data }, fn) {
	console.log("received a revive request...");
	//data[0] = user ID
	//data[1] = cost
	//data[2] = amount (potentially percentage)

	//WARNING: copy/paste
	let query = "SELECT health, maxHealth, wallet FROM users WHERE userID = ? LIMIT 1;";
	return dbConnection.query(query, [data[0]], (err, result) => {
		if (err) throw err;

		//not knocked out
		if (result[0].health != 0) {
			return fn("healNotKnockedOut");
		}

		return innerHeal(data, fn, result, "revive");
	});
}

//handle healing a specific player
async function handleHeal({ data }, fn) {
	console.log("received a heal request...");
	//data[0] = user ID
	//data[1] = cost
	//data[2] = amount (potentially percentage)

	let query = "SELECT health, maxHealth, wallet FROM users WHERE userID = ? LIMIT 1;";
	return dbConnection.query(query, [data[0]], (err, result) => {
		if (err) throw err;

		//not knocked out
		if (result[0].health == 0) {
			return fn("healKnockedOut");
		}

		return innerHeal(data, fn, result, "heal");
	});
}

//avoid copy/paste in the healing functions
function innerHeal(data, fn, result, logType = "unknown") {
	//not enough money
	if (result[0].wallet < data[1]) {
		return fn("healNotEnoughInWallet");
	}

	if (result[0].health == result[0].maxHealth) {
		return fn("healFullHealth");
	}

	//parse out the amount that needs regening
	let regenAmount = data[2];

	if (regenAmount[regenAmount.length-1] == "%") {
		regenAmount = regenAmount.slice(0, -1);
		regenAmount = Math.floor(parseFloat(regenAmount) / 100 * result[0].maxHealth);
	} else {
		regenAmount = Math.floor(parseFloat(regenAmount));
	}

	//actually do the regen
	let newHealth = Math.min(result[0].health + regenAmount, result[0].maxHealth); //I tried making this an SQL function, didn't work
	let query = "UPDATE users SET health = ?, wallet = wallet - ? WHERE userID = ? LIMIT 1;";
	return dbConnection.query(query, [newHealth, data[1], data[0]], (err, result) => {
		if (err) throw err;

		//logging touch
		let query = "SELECT health, maxHealth FROM users WHERE userID = ? LIMIT 1;";
		dbConnection.query(query, [data[0]], (err, result) => {
			dbLog(data[0], "health " + logType, "healed " + regenAmount + " - " + result[0].health + "/" + result[0].maxHealth);
		});

		return fn("healSuccess");
	});
}

async function handleUpgrade({ data }, fn) {
	console.log("received an upgrade request...");
	//data[0] = user ID
	//data[1] = statToUpgrade

	//fn parameters: ["upgradeSuccess", "upgradeFailure", "upgradeNotEnoughPoints"], suffix

	//check the upgrade points
	let query = "SELECT upgradePoints FROM users WHERE userID = ? LIMIT 1;";
	return dbConnection.query(query, [data[0]], (err, result) => {
		if (err) throw err;

		if (result[0].upgradePoints == 0) {
			return fn("upgradeNotEnoughPoints");
		}

		//determine the upgrade query
		let query = "UPDATE users SET ";
		switch(data[1]) {
			case "strength":
				query += "strength = strength + 1, ";
				break;
			case "speed":
				query += "speed = speed + 1, ";
				break;
			case "stamina":
				query += "maxStamina = maxStamina + 1, stamina = stamina + 1, ";
				break;
			case "health":
				query += "maxHealth = maxHealth + 10, health = health + 10, ";
				break;
		}
		query += "upgradePoints = upgradePoints - 1 WHERE userID = ? LIMIT 1;";

		return dbConnection.query(query, data[0], (err, result) => {
			if (err) throw err;
			dbLog(data[0], "upgrade", "upgrade " + data[1]);//TODO: better log
			return fn("upgradeSuccess", data[1] === "health" ? "10 points" : "1 point");
		});
	});
}

//utility functions
function calculateLevel(experience) {
	const levelBase = 1.2;
	return levelBase * Math.sqrt(experience);
}

function calculateLevelProgress(experience) {
	let level = calculateLevel(experience);

	let base = Math.floor(level);
	let decimal = level - base;

	return Math.floor(decimal * 100); //percentage
}

function addExperience(userID, amount) {
	//Add an amount of XP to a user account
	let query = "UPDATE users SET experience = experience + ? WHERE userID = ? LIMIT 1;";
	return dbConnection.query(query, [amount, userID], (err, result) => {
		if (err) throw err;
		dbLog(userID, "xp up", "amount added: " + amount);
	});
}

function dbLog(id, type, data) {
	let query = "INSERT INTO log (discordID, type, data) VALUES (?, ?, ?)";
	return dbConnection.query(query, [id, type, data], (err, result) => {
		if (err) throw err;
	});
}

function calculateTimeAgo(seconds) {
	if (seconds < 60) {
		return "just now";
	}

	if (seconds < 60 * 60) {
		return "just this hour";
	}

	if (seconds < 60 * 60 * 24) {
		return "today";
	}

	return "recently";
}
