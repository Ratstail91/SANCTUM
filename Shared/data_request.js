//initialize the exports
exports = module.exports = {};

//global, because why not?
let socketClient = require("socket.io-client");
let io;
let initialized = false;

//ConnectToServer
//username - the bot's username
//address - the server's web address
//port - the server's port
//pass - the server's passcode
exports.ConnectToServer = function(username, address, port, pass) { //NOTE: this doesn't need to be in a function, I just want to display the username server-side
	//prevent double-initialization
	if (initialized) return;

	//socket tools
	io = socketClient(`${address}:${port}`);
	io.on("connect", () => io.emit("authentication", {SERVER_PASS_KEY: pass, username: username}) );
	io.on("authenticated", () => console.log("Authenticated with server: " + `${address}:${port}`));
	io.on("disconnect", () => console.log("disconnected from server: " + `${address}:${port}`));
//	io.on("error", (err) => { throw err; } );

	initialized = true;
}

//SendServerData
//dataType - the type of data being sent
//userID (optional) - the id of the user to be bundled with the data
//...data (optional) - any data you wish to send
exports.SendServerData = function(dataType, userID = "", ...data){
	io.emit(dataType, { userID: userID, data: data });
}

//OnServerData
//dataType - the type of data being sent and received
//fn (optional) - the aknowledgement function that is called on the other end (takes the result as an argument)
//...data (optional) - any data you wish to send
exports.OnServerData = function(dataType, fn, ...data) {
	io.emit(dataType, { data: data }, fn);
}
