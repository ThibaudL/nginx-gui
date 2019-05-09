#!/usr/bin/env node


const fs = require('fs');
const express = require('express'),
    app = express(),
    port = 9004;
const DeployDb = require('./DeployDB');
const bodyParser = require('body-parser');
const LOGGER = require('./utils/logger');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
const server = http.createServer(app);
const NginxService = require('./services/NginxService').NginxService;
const opn = require('opn');

app.use(bodyParser.json()); // for parsing application/json
app.use('/', express.static(path.join(__dirname, '../public')));

//We need the temp folder for nginx
let tempPath = path.join(__dirname, '../temp');
fs.exists(tempPath, (exists) => {
    if (!exists) {
        LOGGER.debug('Creating temp folder : '+tempPath);
        fs.mkdirSync(tempPath);
    }
});


let wsServer = new WebSocket.Server({server});
DeployDb.init().then(() => {
    LOGGER.info("db initialized");

    new NginxService(app, DeployDb, wsServer,process.argv[2] === '--start-nginx');

    LOGGER.info("Service started on port : " + port);
    let url = "http://localhost:" + port+'/vue';
    LOGGER.info(url);
    opn(url)
});
server.listen(port, () => console.log('server listening on', server.address().port));
