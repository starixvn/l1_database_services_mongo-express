#!/usr/bin/env node

import clc from "cli-color";
import { program } from "commander";
import csrf from "csurf";
import express from "express";
import fs from "node:fs";
import https from "node:https";
import configDefault from "./config.default.js";
import middleware from "./lib/middleware.js";
import { deepmerge } from "./lib/utils.js";
import mongodb from "mongodb";
import http from "http";

const pkg = JSON.parse(fs.readFileSync("./package.json"));

const app = express();

let defaultPort = 80;
let server = app;
let sslOptions;

const loadConfig = async () => {
    const configExist = fs.existsSync("./app-configs.js");
    if (configExist === true) {
        try {
            // eslint-disable-next-line import/no-unresolved
            const { default: configCustom } = await import("./app-configs.js");
            return deepmerge(configDefault, configCustom);
        } catch (error) {
            console.error(clc.red("Unable to load app-configs.js!"));
            console.error(clc.red("Error is:"));
            console.log(clc.red(error));
            process.exit(1);
        }
    } else {
        console.log("No custom config.js found, loading config.default.js");
        return configDefault;
    }
};

async function bootstrap(config) {
    try {
        const resolvedMiddleware = await middleware(config);
        app.use("/", resolvedMiddleware);
        app.use("/", csrf());

        if (config.site.sslEnabled) {
            defaultPort = 443;
            sslOptions = {
                key: fs.readFileSync(config.site.sslKey),
                cert: fs.readFileSync(config.site.sslCert),
            };
            server = https.createServer(sslOptions, app);
        }

        const addressString =
            (config.site.sslEnabled ? "https://" : "http://") + (config.site.host || "0.0.0.0") + ":" + (config.site.port || defaultPort);

        server
            .listen(config.site.port, config.site.host, function () {
                if (config.options.console) {
                    console.log("Mongo Express server listening", "at " + addressString);

                    if (!config.site.host || config.site.host === "0.0.0.0") {
                        console.error(clc.red("Server is open to allow connections from anyone (0.0.0.0)"));
                    }

                    if (config.useBasicAuth !== true) {
                        console.warn(
                            clc.red("Basic authentication is disabled. It is recommended to set the useBasicAuth to true in the config.js.")
                        );
                    } else if (config.basicAuth.username === "admin" && config.basicAuth.password === "pass") {
                        console.error(
                            clc.red('basicAuth credentials are "admin:pass", it is recommended you change this in your config.js!')
                        );
                    }
                }
            })
            .on("error", function (e) {
                if (e.code === "EADDRINUSE") {
                    console.log();
                    console.error(clc.red("Address " + addressString + " already in use! You need to pick a different host and/or port."));
                    console.log("Maybe mongo-express is already running?");
                }

                console.log();
                console.log(
                    "If you are still having trouble, try Googling for the key parts of the following error object before posting an issue"
                );
                console.log(JSON.stringify(e));
                return process.exit(1);
            });
    } catch (e) {
        console.log(e);
    }
}

const config = await loadConfig();

if (config.options.console === true) {
    console.log(`Welcome to mongo-express ${pkg.version}`);
    console.log("------------------------");
    console.log("\n");
}

program
    .version(pkg.version)
    .option("-U, --url <url>", "connection string url")
    .option("-a, --admin", "enable authentication as admin")
    .option("-p, --port <port>", "listen on specified port")
    .parse(process.argv);

const options = program.opts();

if (options.url) {
    config.mongodb.connectionString = options.url;
    if (options.admin) {
        config.mongodb.admin = true;
    }
}

config.site.port = options.port || config.site.port;

if (!config.site.baseUrl) {
    console.error('Please specify a baseUrl in your config. Using "/" for now.');
    config.site.baseUrl = "/";
}

await bootstrap(config);
/* const { connectionString, connectionOptions } = config.mongodb;

try {
    app.get("/status", (req, res) => {
        res.send({ status: "ok" });
    });
    app.set("port", config.site.port);

    const httpServer = http.createServer(app);
    httpServer.listen(app.get("port"), config.site.host, async () => {
        console.log(`Express server started and running on port ${app.get("port")}!`);
    });

    console.log(`Start connecting to ${connectionString}`);
    const client = await mongodb.MongoClient.connect(connectionString, connectionOptions);
    console.log(`Finish connecting to ${connectionString}`);
} catch (error) {
    console.error(
        `Could not connect to database using connectionString: ${connectionString.replace(/(mongo.*?:\/\/.*?:).*?@/, "$1****@")}"`
    );
    console.log(error);
}
 */
