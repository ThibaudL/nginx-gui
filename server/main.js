#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const open = require('open');
const DeployDb = require('./DeployDB');
const LOGGER = require('./utils/logger');
const { NginxService } = require('./services/NginxService');
const { NginxSetupService } = require('./services/NginxSetupService');
const NginxPaths = require('./services/NginxPaths');

const app = express();
const port = 9004;
const server = http.createServer(app);

app.use(express.json());
app.use('/', express.static(path.join(__dirname, '../public')));
app.use('/vue', express.static(path.join(__dirname, '../public')));

fs.mkdirSync(NginxPaths.logsDir, { recursive: true });

DeployDb.init()
    .then(async () => {
        LOGGER.info('db initialized');

        // Migrate old per-server access_log directives (moved to http block in generated config)
        DeployDb.migrateConf((server, col) => {
            if (server.conf && /access_log.*json\.log/.test(server.conf)) {
                server.conf = server.conf.replace(/[ \t]*access_log[^\n]*\n?/g, '');
                col.update(server);
            }
        });

        const setupService = new NginxSetupService(app, DeployDb);
        const discovery = await setupService.discoverBinary();

        const autoStartSetting = !!DeployDb.getSettings().autoStartOnStartup;
        const nginxService = new NginxService(app, DeployDb, {
            binaryPath: discovery ? discovery.path : null,
            autoStart: (process.argv[2] === '--start-nginx' || autoStartSetting) && !!discovery,
        });

        setupService.onBinaryReady = (p) => nginxService.setBinaryPath(p);

        LOGGER.info('Service started on port : ' + port);
        const url = 'http://localhost:' + port + '/';
        LOGGER.info(url);
        open(url);
    })
    .catch((err) => LOGGER.error('Failed to initialize db: ' + err));

server.listen(port, () => console.log('server listening on', server.address().port));
