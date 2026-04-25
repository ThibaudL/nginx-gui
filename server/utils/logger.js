const winston = require('winston');
const path = require('path');
const fs = require('fs');

const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const logger = winston.createLogger({
    level: 'debug',
    exitOnError: false,
    transports: [
        new winston.transports.File({
            filename: path.join(logsDir, 'logs.log'),
            handleExceptions: true,
            maxsize: 5242880,
            maxFiles: 5,
            format: winston.format.json()
        }),
        new winston.transports.Console({
            handleExceptions: true,
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

module.exports = logger;
