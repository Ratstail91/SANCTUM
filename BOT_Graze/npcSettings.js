require('dotenv').config({path: '../.env'});

module.exports = {
	activity: "for upgrade requests.",
	type: "WATCHING",
	token: process.env.GRAZE_TOKEN,
}
