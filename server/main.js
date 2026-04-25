#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const open = require('open');
const DeployDb = require('./DeployDB');
const LOGGER = require('./utils/logger');
const { NginxService } = require('./services/NginxService');

const app = express();
const port = 9004;
const server = http.createServer(app);

app.use(express.json());
app.use('/', express.static(path.join(__dirname, '../public')));
app.use('/vue', express.static(path.join(__dirname, '../public')));

const tempPath = path.join(__dirname, '../temp');
if (!fs.existsSync(tempPath)) {
    LOGGER.debug('Creating temp folder : ' + tempPath);
    fs.mkdirSync(tempPath);
}

const nginxLogsPath = path.join(__dirname, '../logs');
if (!fs.existsSync(nginxLogsPath)) {
    LOGGER.debug('Creating logs folder : ' + nginxLogsPath);
    fs.mkdirSync(nginxLogsPath);
}

DeployDb.init()
    .then(() => {
        LOGGER.info('db initialized');
        new NginxService(app, DeployDb, process.argv[2] === '--start-nginx');
        LOGGER.info('Service started on port : ' + port);
        const url = 'http://localhost:' + port + '/';
        LOGGER.info(url);
        open(url);
    })
    .catch((err) => LOGGER.error('Failed to initialize db: ' + err));

server.listen(port, () => console.log('server listening on', server.address().port));
