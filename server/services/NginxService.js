const fs = require('fs');
const path = require('path');
const LOGGER = require('../utils/logger');
const childProcess = require('child_process');
const fkill = require('fkill');
const NginxPaths = require('./NginxPaths');
const {rotateNginxLog} = require('./NginxLogRotation');

class NginxService {

    constructor(app, db, {binaryPath = null, autoStart = false} = {}) {
        this.db = db;
        this.binaryPath = binaryPath;
        this.nginx = null;
        this.rotationTimer = setInterval(() => rotateNginxLog(this.nginx, this.binaryPath), 60 * 60 * 1000);
        LOGGER.info(`NginxPaths : `,NginxPaths)

        app.route('/api/nginx/logs/access').get(this.getAccessLog.bind(this));
        app.route('/api/nginx/conf').get(this.getConfFile.bind(this));
        app.route('/api/nginx/servers')
            .get(this.getServers.bind(this))
            .post(this.postServers.bind(this));
        app.route('/api/nginx/servers/:id')
            .get(this.getServer.bind(this))
            .post(this.postServer.bind(this))
            .delete(this.deleteServer.bind(this));
        app.route('/api/nginx/http')
            .get(this.getHttpConf.bind(this))
            .post(this.postHttpConf.bind(this));
        app.route('/api/nginx/run').post(this.runNginx.bind(this));
        app.route('/api/nginx/running').get(this.isRunning.bind(this));
        app.route('/api/nginx/kill').post(this.killNginx.bind(this));

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

    postServers(req, res) {
        (req.body || []).forEach((server) => {
            this.db.save(this.db.getNginx(), server);
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

    getConfFile(req, res) {
        const httpConf = this.db.getNginxHttpConf().data && this.db.getNginxHttpConf().data.length > 0
            ? this.db.getNginxHttpConf().data
            : [{additionnalHttpConf: ''}];
        const serversToStart = this.db.getNginx().data.filter((server) => server.enable);
        res.send(this.generateConfFile(httpConf[0], serversToStart));
    }

    runNginx(req, res) {
        if (this.nginx) {
            LOGGER.error('Nginx is already running');
            if (res) res.send({date: new Date(), log: 'Nginx is already running', status: 'error'});
            return;
        }

        const confFile = NginxPaths.confFilePath;
        fs.mkdirSync(path.dirname(confFile), {recursive: true});
        const httpConf = this.db.getNginxHttpConf().data && this.db.getNginxHttpConf().data.length > 0
            ? this.db.getNginxHttpConf().data
            : [{additionnalHttpConf: ''}];
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
            fs.writeFileSync(confFile, this.generateConfFile(httpConf[0], serversToStart));
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

        this.nginx = childProcess.spawn(
            this.binaryPath,
            ['-c', confFile],
            {cwd: NginxPaths.nginxCwd}
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
    log_format json_logs '{"remote_addr":"$remote_addr" , "remote_user" : "$remote_user", "time_local" : "$time_local", '
                       '"proxy_host":"$proxy_host", "request": "$request", "status": "$status", "body_bytes_sent": "$body_bytes_sent", '
                       ' "http_referrer" : "$http_referer", "http_user_agent" : "$http_user_agent"}';
    access_log ${nginxPath(NginxPaths.accessLogPath)} json_logs;
    error_log  ${nginxPath(NginxPaths.errorLogPath)};

${httpConf.additionnalHttpConf || '# No additionnal http configuration'}

${serversToStart.map((server) => server.conf).join('\n')}
}`;
    }

    killNginx(req, res) {
        try {
            if (this.nginx) {
                this.nginx.on('close', (d) => {
                    LOGGER.debug('closed', 'with result =>', (d || '').toString());
                    this.nginx = null;
                    res.send({date: new Date(), log: 'Killed nginx', status: 'success'});
                });
                if (NginxPaths.isWindows) {
                    fkill(this.nginx.pid, {tree: true, force: true});
                } else {
                    this.nginx.kill('SIGQUIT');
                }
            } else {
                res.sendStatus(204);
            }
        } catch (e) {
            res.send({date: new Date(), log: "Nginx isn't running", status: 'error'});
        }
    }

    isRunning(req, res) {
        res.json(this.nginx !== null);
    }
}

module.exports = {NginxService};
