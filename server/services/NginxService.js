const fs = require('fs');
const path = require('path');
const LOGGER = require('../utils/logger');
const childProcess = require('child_process');
const fkill = require('fkill');
const NginxPaths = require('./NginxPaths');
const {rotateNginxLog} = require('./NginxLogRotation');
const {pidFilePath} = require("./NginxPaths");
const NginxConfGenerator = require('./NginxConfGenerator');

function readNginxPid() {
    try {
        const pid = parseInt(fs.readFileSync(NginxPaths.pidFilePath, 'utf8').trim(), 10);
        return isNaN(pid) ? null : pid;
    } catch {
        return null;
    }
}

function isProcessRunning(pid) {
    try {
        //0 doesn't actually kill the process
        process.kill(pid, 0);
        return true;
    } catch (e){
        return false;
    }
}

class NginxService {

    constructor(app, db, {binaryPath = null, autoStart = false} = {}) {
        this.db = db;
        this.binaryPath = binaryPath;
        this.nginx = null;
        this.rotationTimer = setInterval(() => rotateNginxLog(this.nginx, this.binaryPath), 60 * 60 * 1000);
        LOGGER.info(`NginxPaths : `,NginxPaths)

        this.sseClients = new Set();
        try {
            this.logFileOffset = fs.existsSync(NginxPaths.accessLogPath)
                ? fs.statSync(NginxPaths.accessLogPath).size
                : 0;
        } catch { this.logFileOffset = 0; }
        this.logPollTimer = setInterval(() => this._pollAccessLog(), 1000);

        app.route('/api/nginx/logs/access/stream').get(this.streamAccessLog.bind(this));
        app.route('/api/nginx/logs/access/path').get((req, res) => res.json({ path: NginxPaths.accessLogPath }));
        app.route('/api/nginx/logs/access').get(this.getAccessLog.bind(this));
        app.route('/api/nginx/conf').get(this.getConfFile.bind(this));
        app.route('/api/nginx/servers')
            .get(this.getServers.bind(this))
            .post(this.postServers.bind(this));
        app.route('/api/nginx/servers/:id/conf').get(this.getServerConf.bind(this));
        app.route('/api/nginx/servers/:id')
            .get(this.getServer.bind(this))
            .post(this.postServer.bind(this))
            .delete(this.deleteServer.bind(this));
        app.route('/api/nginx/http')
            .get(this.getHttpConf.bind(this))
            .post(this.postHttpConf.bind(this));
        app.route('/api/nginx/validate').post(this.validateConf.bind(this));
        app.route('/api/nginx/run').post(this.runNginx.bind(this));
        app.route('/api/nginx/running').get(this.isRunning.bind(this));
        app.route('/api/nginx/kill').post(this.killNginx.bind(this));
        app.route('/api/nginx/settings')
            .get(this.getSettings.bind(this))
            .post(this.postSettings.bind(this));

        if (autoStart) {
            this.runNginx();
        }
    }

    setBinaryPath(binaryPath) {
        this.binaryPath = binaryPath;
    }

    getAccessLog(req, res) {
        try {
            const logPath = NginxPaths.accessLogPath;
            const content = fs.existsSync(logPath) ? fs.readFileSync(logPath).toString() : '';
            const logs = content.split(/\r?\n/).filter(Boolean).reverse().slice(0, 1000);
            res.send(logs);
        } catch (e) {
            LOGGER.error('Error reading access log', e);
            res.send([]);
        }
    }

    streamAccessLog(req, res) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();
        res.write(':ok\n\n');
        this.sseClients.add(res);
        req.on('close', () => this.sseClients.delete(res));
    }

    _pollAccessLog() {
        if (this.sseClients.size === 0) return;
        const logPath = NginxPaths.accessLogPath;
        if (!fs.existsSync(logPath)) return;
        try {
            const stat = fs.statSync(logPath);
            if (stat.size < this.logFileOffset) this.logFileOffset = 0; // log rotated
            if (stat.size === this.logFileOffset) return;
            const fd = fs.openSync(logPath, 'r');
            const buf = Buffer.alloc(stat.size - this.logFileOffset);
            fs.readSync(fd, buf, 0, buf.length, this.logFileOffset);
            fs.closeSync(fd);
            this.logFileOffset = stat.size;
            buf.toString().split(/\r?\n/).filter(Boolean).forEach(line => {
                const payload = `data: ${line}\n\n`;
                this.sseClients.forEach(r => r.write(payload));
            });
        } catch (e) {
            LOGGER.error('SSE poll error', e);
        }
    }

    postServers(req, res) {
        (req.body || []).forEach((server) => {
            const { conf, ...data } = server;
            this.db.save(this.db.getNginx(), data);
        });
        res.send(this.db.getNginx().data);
    }

    postServer(req, res) {
        if (Number.parseInt(req.params.id, 10) === req.body.$loki) {
            this.db.save(this.db.getNginx(), req.body);
            res.sendStatus(200);
        } else {
            res.sendStatus(400);
        }
    }

    getHttpConf(req, res) {
        res.send(this.db.getNginxHttpConf().data);
    }

    postHttpConf(req, res) {
        this.db.save(this.db.getNginxHttpConf(), req.body);
        res.sendStatus(200);
    }

    deleteServer(req, res) {
        const serverToRemove = this.db.getNginx().data.find(
            (server) => server.$loki === Number.parseInt(req.params.id, 10)
        );
        this.db.remove(this.db.getNginx(), serverToRemove);
        res.send(this.db.getNginx().data);
    }

    getServers(req, res) {
        res.send(this.db.getNginx().data);
    }

    getServer(req, res) {
        res.send(
            this.db.getNginx().data.find(
                (server) => server.$loki === Number.parseInt(req.params.id, 10)
            )
        );
    }

    getServerConf(req, res) {
        const server = this.db.getNginx().data.find(
            (s) => s.$loki === Number.parseInt(req.params.id, 10)
        );
        if (!server) return res.sendStatus(404);
        res.send(NginxConfGenerator.generateServer(server));
    }

    getConfFile(req, res) {
        const confContent = this.getConfContent();
        res.send(confContent);
    }

    getConfContent() {
        const httpConf = this.db.getNginxHttpConf().data && this.db.getNginxHttpConf().data.length > 0
            ? this.db.getNginxHttpConf().data
            : [{additionnalHttpConf: ''}];
        const serversToStart = this.db.getNginx().data.filter((server) => server.enable);
        const confContent = this.generateConfFile(httpConf[0], serversToStart);
        return confContent;
    }

    runNginx(req, res) {
        const existingPid = readNginxPid();
        if (isProcessRunning(existingPid)) {
            LOGGER.info('Nginx is already running');
            if (res) res.send({date: new Date(), log: 'Nginx is already running', status: 'error'});
            return;
        }

        const confFile = NginxPaths.confFilePath;
        fs.mkdirSync(path.dirname(confFile), {recursive: true});
        const confContent = this.getConfContent();
        
        const serversToStart = this.db.getNginx().data.filter((server) => server.enable);

        if (serversToStart.length === 0) {
            if (res) res.send({
                date: new Date(),
                log: 'No enabled servers — please enable at least one server first.',
                status: 'error'
            });
            return;
        }

        try {
            fs.writeFileSync(confFile, confContent);
        } catch (e) {
            if (res) res.send({date: new Date(), log: 'Error writing config: ' + e, status: 'error'});
            return;
        }

        if (!this.binaryPath) {
            if (res) res.send({
                date: new Date(),
                log: 'Nginx binary not configured. Use the setup panel to download or locate nginx.',
                status: 'error'
            });
            return;
        }

        const validation = childProcess.spawnSync(
            this.binaryPath,
            ['-t', '-c', confFile],
            {cwd: NginxPaths.nginxCwd}
        );
        if (validation.status !== 0) {
            const errOutput = (validation.stderr || validation.stdout || '').toString().trim();
            LOGGER.error('nginx -t failed', errOutput);
            if (res) res.send({date: new Date(), log: 'Config validation failed: ' + errOutput, status: 'error'});
            return;
        }

        this.nginx = childProcess.spawn(
            this.binaryPath,
            ['-c', confFile],
            {cwd: NginxPaths.nginxCwd, detached: true}
        );

        LOGGER.debug('Running nginx with PID:', this.nginx.pid);

        let responded = false;
        const respond = (data) => {
            if (!responded && res) {
                responded = true;
                res.send(data);
            }
        };

        this.nginx.stdout.on('data', (d) => LOGGER.debug('stdout', d.toString()));
        this.nginx.stderr.on('data', (d) => {
            LOGGER.debug('stderr', d.toString());
            this.nginx = null;
            respond({date: new Date(), log: 'Error starting server: ' + d.toString(), status: 'error'});
        });
        this.nginx.on('error', (err) => {
            LOGGER.error('nginx spawn error', err.message);
            this.nginx = null;
            respond({date: new Date(), log: 'Error starting nginx: ' + err.message, status: 'error'});
        });

        setTimeout(() => {
            respond({
                date: new Date(),
                log: 'Started servers: ' + serversToStart.map((s) => s.displayName).join(', '),
                status: 'success'
            });
        }, 2000);
    }

    generateConfFile(httpConf, serversToStart) {
        // nginx config parser on Windows interprets \n, \t etc. as escape sequences,
        // so backslash paths must be converted to forward slashes
        const nginxPath = (p) => p.replace(/\\/g, '/');
        return `
events {
    worker_connections  1024;
}


http {
    ${NginxPaths.isWindows ? 'include       mime.types;' : ''}
    default_type  application/octet-stream;

    sendfile        on;

    keepalive_timeout  65;

    map $http_x_correlation_id $correlation_id {
        default $http_x_correlation_id;
        ""      $request_id;
    }

    log_format json_logs '{"remote_addr":"$remote_addr", "correlation_id":"$correlation_id", "remote_user":"$remote_user", "time_local":"$time_local", '
                       '"server_name":"$sent_http_x_server_name", "proxy_host":"$proxy_host", "request":"$request", "status":"$status", "body_bytes_sent":"$body_bytes_sent", '
                       '"http_referrer":"$http_referer", "http_user_agent":"$http_user_agent"}';
    access_log ${nginxPath(NginxPaths.accessLogPath)} json_logs;
    error_log  ${nginxPath(NginxPaths.errorLogPath)};

    ${httpConf.additionnalHttpConf || '# No additionnal http configuration'}

${serversToStart.map((server) => NginxConfGenerator.generateServer(server)).join('\n')}
}`;
    }

    validateConf(req, res) {
        if (!this.binaryPath) {
            return res.json({valid: false, error: 'Nginx binary not configured.'});
        }
        const confFile = NginxPaths.confFilePath;
        fs.mkdirSync(path.dirname(confFile), {recursive: true});
        const confContent = this.getConfContent();
        try {
            fs.writeFileSync(confFile, confContent);
        } catch (e) {
            return res.json({valid: false, error: 'Error writing config: ' + e.message});
        }
        const result = childProcess.spawnSync(
            this.binaryPath,
            ['-t', '-c', confFile],
            {cwd: NginxPaths.nginxCwd}
        );
        const output = (result.stderr || result.stdout || '').toString().trim();
        if (result.status === 0) {
            res.json({valid: true, output});
        } else {
            res.json({valid: false, error: output});
        }
    }

    killNginx(req, res) {
        const pid = readNginxPid();
        try {
            fkill(pid, {tree: true, force: true})
                .then(() => {
                    res.send({date: new Date(), log: 'Killed nginx', status: 'success'});
                });
        } catch (e) {
            LOGGER.error(`error killing nginx : ${pid}`, e)
            res.send({date: new Date(), log: "Nginx isn't running", status: 'error'});
        }
    }

    isRunning(req, res) {
        res.json(isProcessRunning(readNginxPid()));
    }

    getSettings(req, res) {
        const settings = this.db.getSettings();
        res.json({ autoStartOnStartup: !!settings.autoStartOnStartup });
    }

    postSettings(req, res) {
        const { autoStartOnStartup } = req.body;
        if (typeof autoStartOnStartup === 'boolean') {
            this.db.saveSetting('autoStartOnStartup', autoStartOnStartup);
        }
        res.sendStatus(200);
    }
}

module.exports = {NginxService};
