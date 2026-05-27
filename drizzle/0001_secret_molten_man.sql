CREATE TABLE `action_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planId` varchar(64) NOT NULL,
	`runId` varchar(64) NOT NULL,
	`title` varchar(256) NOT NULL,
	`priority` int NOT NULL,
	`action` text NOT NULL,
	`shelter` varchar(256),
	`route` varchar(512),
	`population` int DEFAULT 0,
	`rationale` text,
	`outputType` varchar(32) DEFAULT 'deterministic',
	`correctionApplied` tinyint DEFAULT 0,
	`llmExplanation` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `action_plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `action_plans_planId_unique` UNIQUE(`planId`)
);
--> statement-breakpoint
CREATE TABLE `agent_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`messageId` varchar(64) NOT NULL,
	`runId` varchar(64) NOT NULL,
	`fromAgent` varchar(64) NOT NULL,
	`toAgent` varchar(64) NOT NULL,
	`eventType` varchar(32) NOT NULL,
	`content` text NOT NULL,
	`payload` text,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_messages_id` PRIMARY KEY(`id`),
	CONSTRAINT `agent_messages_messageId_unique` UNIQUE(`messageId`)
);
--> statement-breakpoint
CREATE TABLE `agent_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` varchar(64) NOT NULL,
	`mode` enum('live','simulation') NOT NULL DEFAULT 'live',
	`threatLevel` varchar(32) NOT NULL,
	`totalAtRisk` int NOT NULL DEFAULT 0,
	`selfCorrectionApplied` tinyint NOT NULL DEFAULT 0,
	`correctionDetails` text,
	`completedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `agent_runs_runId_unique` UNIQUE(`runId`)
);
--> statement-breakpoint
CREATE TABLE `shelter_status` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` varchar(64) NOT NULL,
	`shelterId` varchar(32) NOT NULL,
	`name` varchar(128) NOT NULL,
	`capacity` int NOT NULL,
	`currentOccupancy` int DEFAULT 0,
	`status` varchar(32) DEFAULT 'open',
	`source` varchar(64) DEFAULT 'estimated',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shelter_status_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vulnerability_zones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` varchar(64) NOT NULL,
	`zoneId` varchar(32) NOT NULL,
	`name` varchar(128) NOT NULL,
	`floodZone` varchar(8) NOT NULL,
	`riskScore` int NOT NULL,
	`population` int NOT NULL,
	`status` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vulnerability_zones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `weather_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`station` varchar(16) NOT NULL DEFAULT 'KTPA',
	`temperatureC` float,
	`windSpeedMs` float,
	`windDirection` varchar(8),
	`pressurePa` float,
	`description` varchar(256),
	`threatLevel` varchar(32),
	`alertCount` int DEFAULT 0,
	`stormCount` int DEFAULT 0,
	`observedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `weather_snapshots_id` PRIMARY KEY(`id`)
);
