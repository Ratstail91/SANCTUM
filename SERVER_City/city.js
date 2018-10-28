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

	socket.on("updateStamina", handleUpdateStamina);
	socket.on("conversion", handleConversion);
	socket.on("checkin", handleCheckin);
	socket.on("account", handleAccount);
	socket.on("transfer", handleTransfer);
	socket.on("userStats", handleUserStats);
	socket.on("addXP", handleAddXP);
	socket.on("levelUp", handleLevelUp);
});

//listen
server.listen(process.env.SERVER_PORT);
console.log("listening on port " + process.env.SERVER_PORT);

//update the playerbase's stamina on command
async function handleUpdateStamina({ userID, data }) {
	let query = "UPDATE users SET stamina = stamina + 1 WHERE stamina < maxStamina;";
	dbConnection.query(query, (err, result) => {
		if (err) throw err;
		console.log("updated stamina for all users");
	});
};

//handle initial faction join and faction conversions
async function handleConversion({ data }, fn) {
	//data[0] = user ID
	//data[1] = factionRole

	//possible arguments to fn: ["joined", "alreadyJoined", "conversionLocked", "newUser"]

	//find the last time this user converted
	let query = `SELECT faction FROM users WHERE userID='${data[0]}' LIMIT 1;`;

	return dbConnection.query(query, (err, result) => {
		if (err) throw err;

		//check if this is a new user
		if (result.length === 0) {
			let query = `INSERT INTO users (userID, faction, factionChanged) VALUES (${data[0]}, ${data[1]}, NOW());`;
			return dbConnection.query(query, (err, result) => {
				if (err) throw err;
				console.log("new user");
				return fn("newUser");
			});
		}

		//check if already joined this faction
		if (result[0].faction == data[1]) { //faction == factionRole
			console.log("alreadyJoined");
			return fn("alreadyJoined");
		}

		//check if enough time has passed to join a new faction
		let query = `SELECT TIME_TO_SEC(TIMEDIFF(NOW(), factionChanged)) FROM users WHERE userID='${data[0]}' LIMIT 1;`;

		return dbConnection.query(query, (err, result) => {
			if (err) throw err;
			console.log(result[0]['TIME_TO_SEC(TIMEDIFF(NOW(), factionChanged))']);
			if(result[0]['TIME_TO_SEC(TIMEDIFF(NOW(), factionChanged))'] < 60 * 60 * 24 * 7) { //7 days
				console.log("conversionLocked");
				return fn("conversionLocked"); //too soon
			} else {
				//update the database with the join
				query = `UPDATE users SET faction = ${data[1]}, factionChanged = NOW() WHERE userID='${data[0]}';`;
				return dbConnection.query(query, (err, result) => {
					if (err) throw err;
					console.log("joined"); //TODO: convert these to database logs
					return fn("joined");
				});
			}
		})
	});
}

//handle checkin, and add 1 XP
async function handleCheckin({ data }, fn) {
	//handle checkins (grant crystal bonus)
	//TODO: handle XP (grant 1 XP)

	//arguments to fn: ["available", time since last checkin], randomAmount

	let randomAmount = calcRandom.Random(4, 9);

	let query = `SELECT TIME_TO_SEC(TIMEDIFF(NOW(), lastCheckin)) FROM users WHERE userID='${data[0]}' LIMIT 1;`;

	return dbConnection.query(query, (err, result) => {
		if (err) throw err;
		console.log(result);

		if (result[0]['TIME_TO_SEC(TIMEDIFF(NOW(), lastCheckin))'] == null || result[0]['TIME_TO_SEC(TIMEDIFF(NOW(), lastCheckin))'] > 60 * 60 * 22) { //22 hours
			let query = `UPDATE users SET lastCheckin = NOW(), wallet = wallet + ${randomAmount} WHERE userID='${data[0]}' LIMIT 1;`;
			return dbConnection.query(query, (err, result) => {
				if (err) throw err;
				return fn("available", randomAmount);
			});
		} else {
			return fn(result[0]['TIME_TO_SEC(TIMEDIFF(NOW(), lastCheckin))']); //TODO: Time ago function
		}
	});
}

//handle account requests
async function handleAccount({ data }, fn) {
	//data[0] = ID of the person to check

	let query = `SELECT wallet FROM users WHERE userID='${data[0]}' LIMIT 1;`;
	dbConnection.query(query, (err, result) => {
		if (err) throw err;
		fn(result[0].wallet);
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
	let query = `SELECT wallet - ${data[2]} FROM users WHERE userID='${data[0]}' LIMIT 1;`;
	return dbConnection.query(query, (err, result) => {
		if (err) throw err;

		//too little in there
		if (result[0][`wallet - ${data[2]}`] < 0) {
			return fn("failure");
		}

		//check the recipient is real
		let query = `SELECT * FROM users WHERE userID='${data[0]}' LIMIT 1;`;
		return dbConnection.query(query, (err, result) => {
			if (err) throw err;

			if (result.length == 0) {
				return fn("failure");
			}

			//subtract from the sender
			let query = `UPDATE users SET wallet = wallet - ${data[2]} WHERE userID='${data[0]}' LIMIT 1;`;
			return dbConnection.query(query, (err, result) => {
				if (err) throw err;

				//add to the recipient
				let query = `UPDATE users SET wallet = wallet + ${data[2]} WHERE userID='${data[1]}' LIMIT 1;`;
				return dbConnection.query(query, (err, result) => {
					if (err) throw err;

					//TODO: log here
					//finally
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

	//NOTE: build a temporary structure to pass back
	let stats = {
		strength: 0,
		speed: 0,
		stamina: 0,
		health: 0,
		maxStamina: 0,
		maxHealth: 0,
		wallet: 0,
		experience: 0,
		level: 0,
		levelPercent: 0,
		statPoints: 0
	};

	if (fn) {
		fn(stats);
	}
}

//DEBUGGING?
async function handleAddXP({ userID, data }) {
	console.log("received an addXP request...");
	//data[0] = amount

	//TODO: add an amount of XP to a user account
}

//handle levelling up
async function handleLevelUp({ data }, fn) {
	console.log("received a levelUp request...");
	//data[0] = user ID

	if (fn) {
		fn("none", 0, 0); //["none", "levelUp"], level, statPoints
	}
}
