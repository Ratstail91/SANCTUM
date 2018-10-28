//initialize the exports
exports = module.exports = {};

let dataRequest = require("./data_request");
let messaging = require("./messaging");

//CheckFaction
//factionRole - the value to check
exports.CheckFaction = function(factionRole) {
	switch(factionRole) {
		case process.env.GROUP_A_ROLE:
		case process.env.GROUP_B_ROLE:
		case process.env.GROUP_C_ROLE:
			return true;
	}
	return false;
}

//GetFactionName
//factionRole - the discord role ID of the faction
exports.GetFactionName = function(factionRole) {
	//factionRole must be a faction role
	if (!exports.CheckFaction(factionRole)) {
		throw "factionRole is not a faction!";
	}

	switch(factionRole) {
		case process.env.GROUP_A_ROLE:
			return process.env.GROUP_A_NAME;
		case process.env.GROUP_B_ROLE:
			return process.env.GROUP_B_NAME;
		case process.env.GROUP_C_ROLE:
			return process.env.GROUP_C_NAME;
	}
}

//GetFactionChannel
//user - discord.js user
exports.GetFactionChannel = function(factionRole) {
	//factionRole must be a faction role
	if (!exports.CheckFaction(factionRole)) {
		throw "factionRole is not a faction!";
	}

	if (factionRole === process.env.GROUP_A_ROLE) {
		return process.env.GROUP_A_CHANNEL_ID;
	}
	if (factionRole === process.env.GROUP_B_ROLE) {
		return process.env.GROUP_B_CHANNEL_ID;
	}
	if (factionRole === process.env.GROUP_C_ROLE) {
		return process.env.GROUP_C_CHANNEL_ID;
	}
}

//ChangeFaction
//client - discord.js client
//factionRole - a faction role
//channel - discord.js channel OR channel name
//member - discord.js member
exports.ChangeFaction = function(client, factionRole, channel, member, fn) {
	//factionRole must be a faction role
	if (!exports.CheckFaction(factionRole)) {
		throw "factionRole is not a faction!";
	}

	//handle channel strings
	if (typeof(channel) === "string") {
		channel = client.channels.find(item => item.name === channel || item.id === channel);
	}

	//handle member strings
	if (typeof(member) === "string") {
		//get the member
		let user = client.users.find(item => item.username === member || item.id === member);
		let guild = client.guilds.get(process.env.SANCTUM_ID);
		member = guild.members.get(user.id);
	}

	if (member.roles.has(factionRole)) {
		//can't change to this faction
		fn("alreadyJoined");
	}

	let handleResponse = async function(response) {
		if (response === "conversionLocked") { //can't change too fast
			fn(response);
			return;
		}

		//joins the new faction
		await member.removeRole(process.env.GROUP_A_ROLE);
		await member.removeRole(process.env.GROUP_B_ROLE);
		await member.removeRole(process.env.GROUP_C_ROLE);
		await member.addRole(factionRole);

		fn(response);
	};

	dataRequest.OnServerData("conversion", handleResponse, member.user.id);
}
