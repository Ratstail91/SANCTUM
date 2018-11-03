//initialize the exports
exports = module.exports = {};

//CloneArray
//arg - an array to be copied
exports.CloneArray = function(arg) {
	// https://blog.andrewray.me/how-to-clone-a-nested-array-in-javascript/
	let copy;

	if(Array.isArray(arg)) {
		copy = arg.slice(0);
		for(let i = 0; i < copy.length; i++) {
			copy[i] = arrayClone(copy[i]);
		}
		return copy;
	} else if(typeof(arg) === "object") {
		throw "Cannot clone array containing an object!";
	} else {
		return arg;
	}
}

//GenerateDialogFunction
//dialogJson - the json object containing the bot's dialog
//key - Json key
//data (optional) - a number of arguments that are substituted into the resulting string
exports.GenerateDialogFunction = function(dialogJson) {
	return function(key, ...data) {
		let result;

		if (Array.isArray(dialogJson[key])) {
			result = dialogJson[key][Math.floor(Math.random() * dialogJson[key].length)];
		} else {
			result = dialogJson[key];
		}

		if (typeof(result) === "undefined") {
			return dialogJson["noResult"];
		}

		let counter = 0;
		data.map((dat) => {
			counter++;
			result = result.replace(/\{([1-9][0-9]*)\}/g, a => a === "{" + counter + "}" ? dat : a);
		});

		return result;
	}
}

//GetFooterCommands - Gets footer commands for botspam channel commands
//commandArray - the array of possible commands to use
//excludeCommand (optional) - the command to filter out
exports.GetFooterCommands = function(commandArray, excludeCommand = null) {
	let filteredCommandList = commandArray.filter(command => command !== excludeCommand);

	let returnText = "";
	filteredCommandList.forEach(command => {
		if (returnText.length !== 0) { //if this isn't the first command, prepend the separator to this command
			returnText += " | ";
		}
		returnText += command;
	});

	return returnText;
}

//FormatMSS
//s - seconds
exports.FormatMSS = function(s){
	//https://stackoverflow.com/questions/3733227/javascript-seconds-to-minutes-and-seconds
	return (s - (s %= 60)) / 60 + (9 < s ? ':' : ':0') + s;
}

//IsAdmin
//client - discord.js client
//user - discord.js user OR username
exports.IsAdmin = function(client, user) {
	//handle user strings
	if (typeof(user) === "string") {
		user = client.users.find(item => item.username === user || item.id === user);
	}

	let guild = client.guilds.get(process.env.SANCTUM_ID);

	return guild.members.get(user.id).roles.find(role => role.name === process.env.ADMIN_ROLE) != null;
}

//SplitArray
//arr - 1 dimensional array to split into chunks
//chunkSize - the size of the chunks in the resulting array
exports.SplitArray = function(arr, chunkSize) {
	// http://www.frontcoded.com/splitting-javascript-array-into-chunks.html
	let groups = [];
	for (let i = 0; i < arr.length; i += chunkSize) {
		groups.push(arr.slice(i, i + chunkSize));
	}
	return groups;
}
