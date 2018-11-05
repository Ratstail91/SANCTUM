// .env Variables
require('dotenv').config({path: '../.env'});

// Node Modules
let discord = require('discord.js');
let client = new discord.Client();

// Bot Modules
let npcSettings = require('./npcSettings');
let shared = require("../Shared/shared");

//dialog system
let dialog = shared.GenerateDialogFunction(require("./dialog.json"));

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

		//TODO: avoid help command collisions

		case "upgrade":
			if (!args[0]) {
				printUpgrades(message.author, message.channel);
			} else {
				processUpgradeCommand(message.author, message.channel, args);
			}
			return true;

		default:
			shared.SendPublicMessage(client, message.author, message.channel, dialog(command));
			return true;
	}

	return false;
}

function printUpgrades(user, channel) {
	let handleResponse = function(stats) {
		//create the embed
		let embed = new discord.RichEmbed()
			.setAuthor(client.user.username, client.user.avatarURL)
			.setColor(client.guilds.get(process.env.SANCTUM_ID).roles.find(role => role.name === "NPC").color) //NOTE: probably a better way to do this
			.setTitle("Nanotech Upgrades")
			.setDescription(dialog("upgradeText"))
			.setFooter(`${user.username}, you have ${stats.upgradePoints} cannisters. Use !upgrade [OPTION] to upgrade.`); //TODO: move this to dialog?

		shared.SendPublicMessage(client, user, channel, dialog("upgradeHeading"));
		channel.send({ embed });
	}
  
	shared.OnServerData("userStats", handleResponse, user.id);
}

function processUpgradeCommand(user, channel, args) {
 	//parse the stat to upgrade
	let statToUpgrade;
	switch(String(args[0]).toLowerCase()) {
		case "str":
		case "strength":
			statToUpgrade = "strength";
			break;
		case "spd":
		case "speed":
			statToUpgrade = "speed";
			break;
		case "stam":
		case "stamina":
			statToUpgrade = "stamina";
			break;
		case "hp":
		case "health":
			statToUpgrade = "health";
			break;
	}

	if (typeof(statToUpgrade) === "undefined") {
		shared.SendPublicMessage(client, user, channel, dialog("upgradeParseError"));
		return;
	}

	let handleResponse = function(response, suffix) {
		shared.SendPublicMessage(client, user, channel, dialog(response, statToUpgrade, suffix));
	}

	shared.OnServerData("upgrade", handleResponse, user.id, statToUpgrade);
}
