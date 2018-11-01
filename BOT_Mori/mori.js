// .env Variables
require('dotenv').config({path: '../.env'});

// Node Modules
let discord = require('discord.js');
let client = new discord.Client();
let cron = require('node-cron');

// Bot Modules
let npcSettings = require('./npcSettings');
let shared = require("../Shared/shared");

//dialog system
let dialog = shared.GenerateDialogFunction(require("./dialog.json"));

//dialog decorator
dialog = function(baseDialog) {
	return function(key, ...data) {
		let result = baseDialog(key, ...data);
		if (result === "") {
			return baseDialog("noResult");
		}
		return result;
	}
}(dialog);

//global settings
let itemCount = 3;

//handle errors
client.on('error', console.error);

// The ready event is vital, it means that your bot will only start reacting to information from discord _after_ ready is emitted
client.on('ready', async () => {
	// Generates invite link
	try {
		let link = await client.generateInvite(["ADMINISTRATOR"]);
		console.log("Invite Link: " + link);
	} catch(e) {
		console.log(e.stack);
	}

	// You can set status to 'online', 'invisible', 'away', or 'dnd' (do not disturb)
	client.user.setStatus('online');

	// Sets your "Playing"
	if (npcSettings.activity) {
		client.user.setActivity(npcSettings.activity, { type: npcSettings.type })
			//DEBUGGING
			.then(presence => console.log("Activity set to " + (presence.game ? presence.game.name : 'none')) )
			.catch(console.error);
	}

	console.log("Logged in as: " + client.user.username + " - " + client.user.id);

	//connect to the server
	shared.ConnectToServer(client.user.username, process.env.SERVER_ADDRESS, process.env.SERVER_PORT, process.env.SERVER_PASS_KEY);

	//revive each day
	cron.schedule("0 7 * * *", () => {
		console.log("Trying to revive...");
		shared.OnServerData("reviveAll", () => { //TODO: server-side reviveAll command
			console.log("Revive successful");
			shared.SendPublicMessage(client, process.env.TAVERN_CHANNEL_ID, dialog("reviveAll"));
		});
		resetInventory(itemCount);
	});

	//initialize the healing options
	resetInventory(itemCount);
});

// Create an event listener for messages
client.on('message', async message => {
	// Ignores ALL bot messages
	if (message.author.bot) {
		return;
	}

	//skip the statis channel
	if (message.channel.id === process.env.STASIS_CHANNEL_ID) {
		return;
	}

	//skip the gate channel
	if (message.channel.id === process.env.GATE_CHANNEL_ID) {
		return;
	}

	// Has to be (prefix)command
	if (message.content.indexOf(process.env.PREFIX) !== 0) {
		return;
	}

	//handle basic commands
	if (processBasicCommands(client, message)) {
		return;
	}
});

//Log our bot in
client.login(npcSettings.token);

function processBasicCommands(client, message) {
	// "This is the best way to define args. Trust me."
	// - Some tutorial dude on the internet
	let args = message.content.slice(process.env.PREFIX.length).trim().split(/ +/g);
	let command = args.shift().toLowerCase();

	switch (command) {
		case "ping":
			if (shared.IsAdmin(client, message.author)) {
				shared.SendPublicMessage(client, message.author, message.channel, "PONG!");
			}
			return true;

		case "heal": //TODO: wrap this in a function
			//TODO: write this
			return true;

		default:
			shared.SendPublicMessage(client, message.author, message.channel, dialog(command));
			return true;
	}

	return false;
}

//only certain items will be available each day
function resetInventory(itemCount) {
	//TODO
}
