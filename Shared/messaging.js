//initialize the exports
exports = module.exports = {};

//SendPublicMessage
//client - discord.js client
//user (optional) - discord.js user OR username
//channel - discord.js channel OR channel name
//message - message to send
//typingDelay (optional) - delay in milliseconds for the message, while typing is shown
exports.SendPublicMessage = function(client, user, channel, message, typingDelay = 0) {
	//Handle optional second argument (so much for default arugments in node)
	//WARNING: this may be funky as fuck due to typingDelay; if so, delete this
	if (message === undefined) {
		message = channel;
		channel = user;
		user = null;
	}

	//handle user strings
	if (typeof(user) === "string") {
		user = client.users.find(item => item.username === user || item.id === user);
		if (!user) {
			throw "Can't find that user";
		}
	}

	//handle channel strings
	if (typeof(channel) === "string") {
		channel = client.channels.find(item => item.name === channel || item.id === channel);
		if (!channel) {
			throw "Can't find that channel";
		}
	}

	//Utility trick: @user
	if (user !== null) {
		message = "<@" + user.id + "> " + message;
	}

	//Sends message
	if (typingDelay !== 0) {
		channel.startTyping();
		setTimeout(() => {
			channel.send(message)
				.catch(console.error);
			channel.stopTyping(true);
		}, typingDelay);
	} else {
		channel.send(message)
			.catch(console.error);
	}
}

//SendPrivateMessage
//client - discord.js client
//user - discord.js user OR username
//message - message to send
exports.SendPrivateMessage = function(client, user, message) {
	//handle user strings
	if (typeof(user) === "string") {
		user = client.users.find(item => item.username === user || item.id === user);
	}

	user.send(message)
		.catch(console.error);
}
