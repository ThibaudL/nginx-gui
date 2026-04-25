const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const childProcess = require('child_process');
const NginxPaths = require('./NginxPaths');
const LOGGER = require('../utils/logger');

// Cache fetched version list for 1 hour to avoid hammering nginx.org
let versionsCache = null;
let versionsCacheTime = 0;
const VERSIONS_CACHE_TTL = 60 * 60 * 1000;

async function fetchNginxVersions() {
    if (versionsCache && Date.now() - versionsCacheTime < VERSIONS_CACHE_TTL) {
        return versionsCache;
    }
    const html = await fetchText('https://nginx.org/download/');
    const matches = [...html.matchAll(/href="nginx-(\d+\.\d+\.\d+)\.zip"/g)];
    const versions = matches.map(m => {
        const version = m[1];
        const minor = parseInt(version.split('.')[1], 10);
        const stable = minor % 2 === 0; // nginx: even minor = stable, odd = mainline
        return { version, stable, url: `https://nginx.org/download/nginx-${version}.zip` };
    });
    versions.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
    versionsCache = versions;
    versionsCacheTime = Date.now();
    return versions;
}

class NginxSetupService {
    constructor(app, db) {
        this.db = db;
        this.binaryPath = null;
        this.onBinaryReady = null;

        app.route('/api/nginx/setup').get(this.handleSetup.bind(this));
        app.route('/api/nginx/versions').get(this.handleVersions.bind(this));
        app.route('/api/nginx/download').post(this.handleDownload.bind(this));
    }

    async discoverBinary() {
        // 1. DB stored setting (user-configured or post-download)
        const settings = this.db.getSettings();
        if (settings.nginxBinaryPath && fs.existsSync(settings.nginxBinaryPath)) {
            this.binaryPath = settings.nginxBinaryPath;
            return { path: this.binaryPath, source: 'db' };
        }
        // 2. Previously downloaded to ~/.nginx-gui/nginx/
        const downloadedPath = path.join(NginxPaths.nginxDir, NginxPaths.binaryName);
        if (fs.existsSync(downloadedPath)) {
            this.binaryPath = downloadedPath;
            return { path: this.binaryPath, source: 'downloaded' };
        }
        // 3. System PATH
        try {
            const cmd = NginxPaths.isWindows ? 'where nginx' : 'which nginx';
            const result = childProcess.execSync(cmd, { encoding: 'utf8', timeout: 3000 })
                .trim().split('\n')[0].trim();
            if (result && fs.existsSync(result)) {
                this.binaryPath = result;
                return { path: this.binaryPath, source: 'system' };
            }
        } catch (_) {}
        return null;
    }

    getNginxVersion() {
        if (!this.binaryPath) return null;
        try {
            // nginx -v writes to stderr
            childProcess.execSync(`"${this.binaryPath}" -v`, {
                encoding: 'utf8', timeout: 3000, stdio: ['pipe', 'pipe', 'pipe']
            });
            return null;
        } catch (e) {
            return e.stderr ? e.stderr.trim() : null;
        }
    }

    async handleSetup(req, res) {
        const discovery = await this.discoverBinary();
        res.json({
            found: !!discovery,
            binaryPath: discovery ? discovery.path : null,
            source: discovery ? discovery.source : null,
            version: discovery ? this.getNginxVersion() : null,
            platform: process.platform,
        });
    }

    async handleVersions(req, res) {
        if (!NginxPaths.isWindows) return res.json([]);
        try {
            res.json(await fetchNginxVersions());
        } catch (e) {
            LOGGER.error('Failed to fetch nginx versions: ' + e.message);
            res.status(502).json({ error: 'Could not reach nginx.org: ' + e.message });
        }
    }

    async handleDownload(req, res) {
        if (!NginxPaths.isWindows) {
            return res.status(400).json({ error: 'Download only supported on Windows.' });
        }
        let versions;
        try {
            versions = await fetchNginxVersions();
        } catch (e) {
            return res.status(502).json({ error: 'Could not fetch version list: ' + e.message });
        }
        const versionInfo = versions.find(v => v.version === req.body.version);
        if (!versionInfo) return res.status(400).json({ error: 'Unknown version' });
        try {
            const binaryPath = await this.downloadNginx(versionInfo);
            this.db.saveSetting('nginxBinaryPath', binaryPath);
            if (this.onBinaryReady) this.onBinaryReady(binaryPath);
            res.json({ binaryPath });
        } catch (e) {
            LOGGER.error('Download failed: ' + e.message);
            res.status(500).json({ error: e.message });
        }
    }

    async downloadNginx(versionInfo) {
        const AdmZip = require('adm-zip');
        const os = require('os');
        const tmpZip = path.join(os.tmpdir(), `nginx-${versionInfo.version}.zip`);
        LOGGER.info(`Downloading nginx ${versionInfo.version}...`);
        await streamDownload(versionInfo.url, tmpZip);
        LOGGER.info('Extracting...');
        new AdmZip(tmpZip).extractAllTo(NginxPaths.nginxGuiHome, true);
        const extractedDir = path.join(NginxPaths.nginxGuiHome, `nginx-${versionInfo.version}`);
        if (fs.existsSync(NginxPaths.nginxDir)) fs.rmSync(NginxPaths.nginxDir, { recursive: true });
        fs.renameSync(extractedDir, NginxPaths.nginxDir);
        try { fs.unlinkSync(tmpZip); } catch (_) {}
        const binaryPath = path.join(NginxPaths.nginxDir, NginxPaths.binaryName);
        LOGGER.info(`nginx installed at ${binaryPath}`);
        return binaryPath;
    }
}

function fetchText(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        protocol.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetchText(res.headers.location).then(resolve).catch(reject);
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
            res.on('error', reject);
        }).on('error', reject);
    });
}

function streamDownload(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const protocol = url.startsWith('https') ? https : http;
        protocol.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                file.close(() => streamDownload(res.headers.location, dest).then(resolve).catch(reject));
                return;
            }
            res.pipe(file);
            file.on('finish', () => file.close(resolve));
            file.on('error', reject);
        }).on('error', (err) => { fs.unlink(dest, () => {}); reject(err); });
    });
}

module.exports = { NginxSetupService };
