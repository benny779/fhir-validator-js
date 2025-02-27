const fs = require('fs-extra');
const path = require('path');

const LOGS_DIR = path.join(__dirname, '../../logs');
const LOG_FILE = path.join(LOGS_DIR, 'install.log');
const ERROR_LOG_FILE = path.join(LOGS_DIR, 'error.log');

function ensureDirectoriesExist() {
    fs.ensureDirSync(LOGS_DIR);
}

function log(message) {
    ensureDirectoriesExist();
    console.log(message);
    const timestamp = new Date().toISOString().replace("T", " ").split(".")[0];
    fs.appendFileSync(LOG_FILE, `[${timestamp}] [INFO] ${message}\n`);
}

function logError(message) {
    ensureDirectoriesExist();
    console.error(`❌ ERROR: ${message}`);
    const timestamp = new Date().toISOString().replace("T", " ").split(".")[0];
    fs.appendFileSync(ERROR_LOG_FILE, `[${timestamp}] [ERROR] ${message}\n`);
}

module.exports = { log, logError };
