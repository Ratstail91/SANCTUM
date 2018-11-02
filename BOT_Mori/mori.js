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
const itemCount = 3;
const treatments = [
	// Name | Crystals | HP | Revive | Description
	["Patch", 		10,	"50",	false,	"Heals 50HP immediately. Must have more than 0HP."],
	["PatchV2",		15,	"50%",	false,	"Heals to 50% HP immediately. Must have more than 0HP."],
	["Regen",		20,	"100",	false,	"Heals 100HP immediately. Must have more than 0HP."],
	["RegenV2",		25,	"100%",	false,	"Heals all HP to maximum immediately. Must have more than 0HP."],
	["Revive",		20,	"25",	true,	"Brings a traveler back from a KO (0HP) to 25HP immediately."],
	["ReviveV2",	25,	"50%",	true,	"Brings a traveler back from a KO (0HP) to 50% HP immediately."],
	["ReviveV3",	30,	"100%",	true,	"Brings a traveler back from a KO (0HP) to 100% HP immediately."]
];
let availableTreatments = [];

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
			shared.SendPublicMessage(client, process.env.TAVERN_CHANNEL_ID, dialog("reviveAll")); //TODO: add a reference to Alexis in the dialog here
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

		case "help":
			printTreatments(message.author, message.channel);
			return true;

		case "heal":
			if (!args[0]) {
				printTreatments(message.author, message.channel);
			} else {
				processHealCommand(message.author, message.channel, args);
			}
			return true;

		default:
			shared.SendPublicMessage(client, message.author, message.channel, dialog(command));
			return true;
	}

	return false;
}

//only certain items will be available each day
function resetInventory(itemCount) {
	console.log("resetting inventory...");

	//generate random numbers to select treatments to use
	let randomNumbers = [];
	do {
		let num = shared.Random(0, treatments.length - 1); //there's probably a more efficient way to do this
		if (!randomNumbers.includes(num)) {
			randomNumbers.push(num);
		}
	} while (randomNumbers.length < itemCount);
	randomNumbers.sort((a, b) => a - b);

	//actually select the randomized treatments
	availableTreatments = [];
	for (let i = 0; i < randomNumbers.length; i++) {
		availableTreatments.push( treatments[randomNumbers[i]] );

		//shuffle the cost a little
		if (shared.Random(0, 1) === 1) {
			availableTreatments[i][1] += Math.floor( parseFloat(availableTreatments[i][1]) / 6);
		} else {
			availableTreatments[i][1] -= Math.floor( parseFloat(availableTreatments[i][1]) / 6);
		}
	}
}

function printTreatments(user, channel) {
	let handleResponse = function(stats) {
		//build the treatment message
		let treatmentMessage = "";
		for (let i = 0; i < availableTreatments.length; i++) {
			treatmentMessage += `${availableTreatments[i][0]} - :crystals: **${availableTreatments[i][1]}**\n` + "```" + availableTreatments[i][4] + "```\n";
		}

		//create the embed
		let embed = new discord.RichEmbed()
			.setAuthor(client.user.username, client.user.avatarURL)
			.setColor(client.guilds.get(process.env.SANCTUM_ID).roles.find(role => role.name === "NPC").color) //NOTE: probably a better way to do this
			.setTitle("Biotech Healing")
			.setDescription(treatmentMessage)
			.setFooter(`${user.username}, you have ${stats.wallet} crystals. Use !heal [OPTION] to buy.`);

		shared.SendPublicMessage(client, user, channel, dialog("healHeading"));
		channel.send({ embed });
	}

	shared.OnServerData("userStats", handleResponse, user.id);
}

function processHealCommand(user, channel, args) {
	//get the selected treatment
	let selectedTreatment = availableTreatments.filter((treatment) => treatment[0].toLowerCase() === args[0].toLowerCase())[0];

	if (!selectedTreatment) {
		shared.SendPublicMessage(client, user, channel, dialog("healFailure"));
	}

	let handleResponse = function(response) {
		shared.SendPublicMessage(client, user, channel, dialog(response, selectedTreatment[0], selectedTreatment[1], selectedTreatment[2]));
	}

	if (selectedTreatment[3]) { //should it be a revive command?
		shared.OnServerData("revive", handleResponse, user.id, selectedTreatment[1], selectedTreatment[2]);
	} else {
		shared.OnServerData("heal", handleResponse, user.id, selectedTreatment[1], selectedTreatment[2]);
	}
}