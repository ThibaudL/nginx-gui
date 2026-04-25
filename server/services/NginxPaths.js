const os = require('os');
const path = require('path');

const isWindows = process.platform === 'win32';
const nginxGuiHome = path.join(os.homedir(), '.nginx-gui');
const nginxDir = path.join(nginxGuiHome, 'nginx');

module.exports = {
    isWindows,
    nginxGuiHome,
    logsDir:       path.join(nginxGuiHome, 'logs'),
    accessLogPath: path.join(nginxGuiHome, 'logs', 'access.log'),
    errorLogPath:  path.join(nginxGuiHome, 'logs', 'nginx-error.log'),
    nginxDir,
    binaryName:    isWindows ? 'nginx.exe' : 'nginx',
    confFilePath:  isWindows
        ? path.join(nginxDir, 'conf', 'nginx.conf')
        : path.join(nginxGuiHome, 'nginx.conf'),
    nginxCwd:      isWindows ? nginxDir : undefined,
};
