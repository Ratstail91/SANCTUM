//initialize the exports
exports = module.exports = {};

require("dotenv").config({path: "../.env"});

//socket tools
let io = require("socket.io-client")(`${process.env.SERVER_ADDRESS}:${process.env.SERVER_PORT}`);

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
