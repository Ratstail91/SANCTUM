CREATE DATABASE IF NOT EXISTS sanctum;

USE sanctum;

CREATE TABLE IF NOT EXISTS log (
	id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
	discordID bigint,
	time TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
	type varchar(32),
	data varchar(255)
);

CREATE TABLE IF NOT EXISTS users (
	id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
	userID bigint NOT NULL,
	timeJoined TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

	faction bigint,
	factionChanged DATETIME NULL,

	level int NOT NULL DEFAULT 1,
	experience int NOT NULL DEFAULT 0,

	maxHealth int NOT NULL DEFAULT 100,
	health int NOT NULL DEFAULT 100,
	maxStamina int NOT NULL DEFAULT 5,
	stamina int NOT NULL DEFAULT 5,

	strength int NOT NULL DEFAULT 5,
	speed int NOT NULL DEFAULT 5,

	wallet int NOT NULL DEFAULT 0,
	upgradePoints int NOT NULL DEFAULT 0
);