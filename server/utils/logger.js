const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const logStream = fs.createWriteStream(path.join(logsDir, 'logs.log'), { flags: 'a' });

const COLORS = {
    error: '\x1b[31m',
    warn:  '\x1b[33m',
    info:  '\x1b[32m',
    debug: '\x1b[36m',
};
const RESET = '\x1b[0m';

function log(level, ...args) {
    const message = args.map(a => (a && typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    logStream.write(JSON.stringify({ level, message, timestamp: new Date().toISOString() }) + '\n');
    const color = COLORS[level] || '';
    console.log(`${color}${level}${RESET}: ${message}`);
}

module.exports = {
    error: (...args) => log('error', ...args),
    warn:  (...args) => log('warn',  ...args),
    info:  (...args) => log('info',  ...args),
    debug: (...args) => log('debug', ...args),
};
