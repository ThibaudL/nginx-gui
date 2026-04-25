const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const NginxPaths = require('./NginxPaths');
const LOGGER = require('../utils/logger');

const MAX_SIZE  = 10 * 1024 * 1024; // 10 MB
const MAX_FILES = 7;

function rotateNginxLog(nginxProcess, binaryPath) {
    const logPath = NginxPaths.accessLogPath;
    if (!fs.existsSync(logPath)) return;

    const stat    = fs.statSync(logPath);
    const fileDay = stat.mtime.toISOString().slice(0, 10);
    const today   = new Date().toISOString().slice(0, 10);
    if (fileDay >= today && stat.size < MAX_SIZE) return;

    const rotatedPath = path.join(NginxPaths.logsDir, `access.${fileDay}.log`);
    try {
        fs.renameSync(logPath, rotatedPath);
        LOGGER.info(`Rotated nginx access log → ${rotatedPath}`);

        if (nginxProcess && nginxProcess.pid) {
            if (NginxPaths.isWindows && binaryPath) {
                // Windows nginx has no SIGUSR1; -s reopen signals the master to reopen log files
                childProcess.spawn(binaryPath, ['-c', NginxPaths.confFilePath, '-s', 'reopen'], {
                    cwd: NginxPaths.nginxCwd
                });
            } else if (!NginxPaths.isWindows) {
                process.kill(nginxProcess.pid, 'SIGUSR1');
            }
        }

        pruneOldLogs();
    } catch (e) {
        LOGGER.error('Log rotation error: ' + e.message);
    }
}

function pruneOldLogs() {
    fs.readdirSync(NginxPaths.logsDir)
        .filter(f => /^access\.\d{4}-\d{2}-\d{2}\.log$/.test(f))
        .sort().reverse()
        .slice(MAX_FILES)
        .forEach(f => { try { fs.unlinkSync(path.join(NginxPaths.logsDir, f)); } catch (_) {} });
}

module.exports = { rotateNginxLog };
