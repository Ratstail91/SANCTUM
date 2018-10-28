exports = module.exports = {};

let dataRequest = require('./data_request');

//AddXP
//client - discord.js client
//user - discord.js user OR username
//amount - amount of XP to add
exports.AddXP = function(client, user, amount) {
	//handle user strings
	if (typeof(user) === "string") {
		user = client.users.find(item => item.username === user || item.id === user);
	}

	dataRequest.SendServerData("addXP", user.id, amount);
}

//LevelUp
//client - discord.js client
//member - member to get the level up
//fn - function to pass the result to
exports.LevelUp = function(client, member, fn) {
	//handle member strings
	if (typeof(member) === "string") {
		//get the member
		let user = client.users.find(item => item.username === member || item.id === member);
		let guild = client.guilds.get(process.env.SANCTUM_ID);
		member = guild.members.get(user.id);
	}

	//if the bot tries to level someone without the correct role, return
	if (client.user.username == process.env.GROUP_A_LEADER_NAME && !member.roles.has(process.env.GROUP_A_ROLE)) return;
	if (client.user.username == process.env.GROUP_B_LEADER_NAME && !member.roles.has(process.env.GROUP_B_ROLE)) return;
	if (client.user.username == process.env.GROUP_C_LEADER_NAME && !member.roles.has(process.env.GROUP_C_ROLE)) return;

	let handleResponse = function(response, level, statPoints) {
		let rankUp = exports.RankUp(client, member, level);
		fn(rankUp === "rankUp" ? rankUp : response, level, statPoints);
	}

	dataRequest.OnServerData("levelUp", handleResponse, member.user.id);
}

//GetLevelUp
//client - discord.js client
//member - member to get the upgrade
//level - level of the member
exports.RankUp = async function(client, member, level) {
	//get the guild
	let guild = client.guilds.get(process.env.SANCTUM_ID);

	//handle member strings
	if (typeof(member) === "string") {
		//get the member
		let user = client.users.find(item => item.username === member || item.id === member);
		member = guild.members.get(user.id);
	}

	//Snapping the level variable
	if (level < process.env.RANK_2_THRESHOLD) {
		level = process.env.RANK_1_THRESHOLD;
	} else
	if (level < process.env.RANK_3_THRESHOLD) {
		level = process.env.RANK_2_THRESHOLD;
	} else {
		level = process.env.RANK_3_THRESHOLD;
	}

	//Get the new rank
	let levelRole = guild.roles.find(role => role.name === `LVL ${level}+`); //I don't like constant strings

	//set the new level
	if (!levelRole) {
		throw "levelRole not found";
	}

	if (member.roles.has(levelRole.id)) { //member has this role already
		return "";
	}

	//the ranks as roles
	let ranks = [
		guild.roles.find(role => role.name === process.env.RANK_1),
		guild.roles.find(role => role.name === process.env.RANK_2),
		guild.roles.find(role => role.name === process.env.RANK_3)
	]

	//remove all existing roles
	for(let i = 0; i < ranks.length; i++) {
		member.removeRole(ranks[i].id);
	}

	//this will enable the new rooms
	member.addRole(levelRole);

	//return the result
	return "rankUp";
}
