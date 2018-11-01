require('dotenv').config({path: '../.env'});

module.exports = {
	activity: "for new patients.",
	type: "WATCHING",
	token: process.env.MORI_TOKEN,
}