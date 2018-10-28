exports = module.exports = {};

let dataRequest = require("../Shared/data_request");
let discord = require('discord.js');
let shared = require("../Shared/shared");

//ProcessGameplayCommands
//client - discord.js client
//message - discord.js message
//dialog - the dialog function
exports.ProcessGameplayCommands = function(client, message, dialog) {
	// "This is the best way to define args. Trust me."
	// - Some tutorial dude on the internet
	let args = message.content.slice(process.env.PREFIX.length).trim().split(/ +/g);
	let command = args.shift().toLowerCase();

	switch (command) {
		case "checkin":
			exports.ProcessCheckinCommand(client, message.member, message.channel, dialog);
			return true;

		case "give":
			exports.ProcessGiveCommand(client, message, args, dialog);
			return true;

		case "stats":
			exports.ProcessStatsCommand(client, message.member, message.channel, dialog);
			return true;
	}

	//didn't process it
	return false;
}

//ProcessFactionChangeAttempt
//client - discord.js client
//message - discord.js message
//factionRole - the new faction's role
//dialog - the dialog function
//factionShorthand - the shorthand name of the new faction (TEMPORARY)
exports.ProcessFactionChangeAttempt = function(client, message, factionRole, dialog, factionShorthand) {
	//tailor this for each faction leader?
	let handleResponse = async function(response) {
		switch (response) {
			case "alreadyJoined":
				shared.SendPublicMessage(client, message.channel, dialog("alreadyJoined" + factionShorthand, message.author.id));
				break;
			case "conversionLocked":
				shared.SendPublicMessage(client, message.channel, dialog("conversionLocked", message.author.id));
				break;
			case "newUser":
				shared.SendPublicMessage(client, message.author, shared.GetFactionChannel(factionRole), dialog("newUserPublicMessage", shared.GetFactionName(factionRole), shared.GetFactionChannel(factionRole)));
				shared.SendPrivateMessage(client, message.author, dialog("newUserPrivateMessage", dialog("newUserPrivateMessageRemark" + factionShorthand)));
				break;
			case "joined":
				shared.SendPublicMessage(client, message.author, message.channel, dialog("join" + factionShorthand));
				break;
			default:
				//DEBUGGING
				console.log("processFactionChangeAttempt failed:" + result);
		}
	}

	shared.ChangeFaction(client, factionRole, message.channel, message.member, handleResponse);
}

//ProcessStatsCommand
//client - discord.js client
//member - discord.js member
//channel - discord.js channel
//dialog - dialog function
exports.ProcessCheckinCommand = function(client, member, channel, dialog) {
	let handleResponse = function(checkinResponse, checkinAmount) {
		if (checkinResponse === "available") {
			shared.SendPublicMessage(client, member.user, channel, dialog("checkin", checkinAmount));
			exports.HandleLevelUp(client, member, channel, dialog);
		} else {
			shared.SendPublicMessage(client, channel, dialog("checkinLocked", member.user.id, checkinResponse));
		}
	}

	dataRequest.OnServerData("checkin", handleResponse, member.user.id); //ID of the person who checked in TODO: username too
}

//ProcessStatsCommand
//client - discord.js client
//message - discord.js message
//args - arguments to the give command
//dialog - dialog function
exports.ProcessGiveCommand = function(client, message, args, dialog) {
	let amount = Math.floor(parseFloat(args[0]));

	if (isNaN(amount)) {
		shared.SendPublicMessage(client, message.channel, dialog("giveFailed", message.author.id));
		return;
	}

	//not enough
	if (amount <= 0) {
		shared.SendPublicMessage(client, message.channel, dialog("giveNotAboveZero", message.author.id));
		return;
	}

	//didn't mention anyone
	if (message.mentions.members.size == 0) {
		shared.SendPublicMessage(client, message.channel, dialog("giveInvalidUser", message.author.id));
		return;
	}

	let targetMember = message.mentions.members.first();

	//can't give to yourself
	if (targetMember.id === message.author.id) {
		shared.SendPublicMessage(client, message.channel, dialog("giveInvalidUserSelf", message.author.id));
		return;
	}

	let handleResponse = function(accountBalance) {
		//not enough money in account
		if (accountBalance < amount) {
			shared.SendPublicMessage(client, message.channel, dialog("giveNotEnoughInAccount", message.author.id));
			return;
		}

		//try to send the money
		let handleResponse = function(response) {
			if (response !== "success") {
				shared.SendPublicMessage(client, message.channel, dialog("giveFailed", message.author.id));
			} else {
				//print the success message
				shared.SendPublicMessage(client, message.author, message.channel, dialog("giveSuccessful", targetMember.id, amount));
			}
		}

		dataRequest.OnServerData("transfer", handleResponse, message.author.id, targetMember.id, amount);
	}

	dataRequest.OnServerData("wallet", handleResponse, message.author.id);
}

//ProcessStatsCommand
//client - discord.js client
//member - discord.js member
//channel - discord.js channel
//dialog - dialog function
exports.ProcessStatsCommand = function(client, member, channel, dialog) {
	exports.HandleLevelUp(client, member, channel, dialog);
	exports.GetStats(member.user, (stats) => {
		exports.PrintStats(client, member, channel, stats);
	});
}

//GetStats
//user - discord.js user OR username
//fn - function to pass the stats to
exports.GetStats = function(user, fn) {
	//handle user strings
	if (typeof(user) === "string") {
		user = client.users.find(item => item.username === user || item.id === user);
	}

	dataRequest.OnServerData("userStats", fn, user.id);
}

//PrintStats
//client - discord.js client
//member - discord.js member OR username OR id
//channel - discord.js channel OR channel name OR id
//stats - stats generated by GetStats
exports.PrintStats = function(client, member, channel, stats) {
	//handle member strings
	if (typeof(member) === "string") { //TODO: fold these into their own functions EVERYWHERE.
		//get the member
		let user = client.users.find(item => item.username === member || item.id === member);
		member = guild.members.get(user.id);
	}

	//handle channel strings
	if (typeof(channel) === "string") {
		channel = client.channels.find(item => item.name === channel || item.id === channel);
	}

	// Forms stats into a string
	let levelText = `:level: **${stats.level}**`; //NOTE: I don't like backticks
	let levelProgress = `(${stats.levelProgress}%)`;
	let crystalText = `:crystals: **${stats.wallet}**`;
	let cannisterText = `:cannister: **${stats.upgradePoints}**`;
	let userStats = "```" + `STR: ${stats.strength} | SPD: ${stats.speed} | STAM: ${stats.stamina}/${stats.maxStamina} | HP: ${stats.health}/${stats.maxHealth}` + "```";

	// Says level is maxed out if it is LVL 30+
	if (stats.level >= process.env.RANK_3_THRESHOLD) {
		levelProgress = "(MAX)";
	}

	// Creates embed & sends it
	const embed = new discord.RichEmbed()
		.setAuthor(`${member.user.username}`, member.user.avatarURL)
		.setColor(member.displayColor)
		.setDescription(`${levelText} ${levelProgress} | ${crystalText} | ${cannisterText}`)
		.addField("Stats", userStats)
		.setFooter("Commands: !help | !lore | !checkin | !give");

	channel.send({ embed });
}

//HandleLevelUp
//client - discord.js client
//member - discord.js member
//channel - discord.js channel
//dialog - dialog function
exports.HandleLevelUp = function(client, member, channel, dialog) {
	//handle member strings
	if (typeof(member) === "string") { //TODO: fold these into their own functions EVERYWHERE.
		//get the member
		let user = client.users.find(item => item.username === member || item.id === member);
		member = guild.members.get(user.id);
	}

	//handle channel strings
	if (typeof(channel) === "string") {
		channel = client.channels.find(item => item.name === channel || item.id === channel);
	}

	// Sees if the user is supposed to level up
	let handleResponse = function(response, level, upgradePoints) {
		//handle levelling up
		if (response === "levelUp" || response === "RankUp") {
			if (level >= process.env.RANK_3_THRESHOLD) {
				shared.SendPublicMessage(client, member.user, channel, dialog("levelUpCap", dialog("levelUpCapRemark"), level));
			} else {
				shared.SendPublicMessage(client, member.user, channel, dialog("LevelUp", dialog("levelUpRemark"), level, upgradePoints));
			}
		}
	}

	shared.LevelUp(client, member, handleResponse);
}