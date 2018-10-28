// .env Variables
require("dotenv").config({path: "../.env"});

//server tools
let express = require("express");
let socket = require("socket.io");

//express setup
let app = express();
let server = app.listen(process.env.SERVER_PORT, () => {
	console.log("Listening to requests on port " + process.env.SERVER_PORT);
});

//shared code
let calcRandom = require('../Shared/calc_random');

//socket.io setup
let io = socket(server);

//TODO: isolate these responses to specific bots
io.on("connection", async (socket) => {
	console.log("made socket connection");

	//update the playerbase's stamina on command
	socket.on("updateStamina", async ({ userID, data }) => {
		console.log("updating stamina for all users...");
		//TODO: update the stamina
	});

	//handle checkin
	socket.on("checkin", async ({ data }, fn) => {
		console.log("received a checkin request...");
		//TODO: handle checkins (grant crystal bonus)
		//TODO: handle XP (grant 1 XP)

		if (fn) {
			fn("available", calcRandom.Random(4, 9)); //TODO: ["available", time since last checkin], randomAmount
		}
	});

	//handle account requests
	socket.on("account", async ({ data }, fn) => {
		console.log("received an account request...");
		//data[0] = ID of the person to check

		if (fn) {
			fn(0); //TODO: accountBalance
		}
	});

	//handle transfering data between accounts
	socket.on("transfer", async	({ data }, fn) => {
		console.log("received a transfer request...");
		//data[0] = ID of the source account
		//data[1] = ID of the destination account
		//data[2] = amount to send

		if (fn) {
			fn("failure"); //TODO: ["success", "failure"]
		}
	});

	//handle the user stats
	socket.on("userStats", async ({ data }, fn) => {
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
	});

	//DEBUGGING?
	socket.on("addXP", async ({ userID, data }) => {
		console.log("received an addXP request...");
		//data[0] = amount

		//TODO: add an amount of XP to a user account
	});

	//handle levelling up
	socket.on("levelUp", async ({ data }, fn) => {
		console.log("received a levelUp request...");
		//data[0] = user ID

		if (fn) {
			fn("none", 0, 0); //["none", "levelUp"], level, statPoints
		}
	});

	socket.on("conversion", async ({ data }, fn) => {
		console.log("received a conversion request...");
		//data[0] = user ID

		if (fn) {
			fn("newUser"); //["joined", "conversionLocked", "newUser"]
		}
	});
});