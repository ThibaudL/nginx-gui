#!/usr/bin/env node
const express = require('express'),
    app = express(),
    port = 9003;
const DeployDb = require('./DeployDB');
const bodyParser = require('body-parser');
const LOGGER = require('./utils/logger');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
const server = http.createServer(app);
const NginxService = require('./services/NginxService').NginxService;

app.use(bodyParser.json()); // for parsing application/json
app.use('/', express.static(path.join(__dirname, '../public')));

let wsServer = new WebSocket.Server({server});
DeployDb.init().then(() => {
    LOGGER.info("db initialized");

    new NginxService(app,DeployDb,wsServer);

LOGGER.info("Service started on port : " + port);
LOGGER.info("http://localhost:" + port);
});
server.listen(port, () => console.log('server listening on',server.address().port));
