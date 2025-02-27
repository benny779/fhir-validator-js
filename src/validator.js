const { getJavaExecutable } = require('./utils/jdk-utils');
const { log, logError } = require('./utils/logger');
const axios = require('axios');
const path = require('path');
const { spawn } = require('child_process');
const net = require('net'); // ✅ Required for checking port usage

const BIN_DIR = path.join(__dirname, '../bin');
const JAR_PATH = path.join(BIN_DIR, 'validator.jar');

class FHIRValidator {
    constructor({ cliContext = {} }) {
        this.javaExecutable = getJavaExecutable();
        this.cliContext = cliContext;
        this.sessionId = null;
        this.keepAliveInterval = null;
    }

    /**
     * Checks if the specified port is in use.
     * @param {number} port - The port number to check.
     * @returns {Promise<boolean>} - Returns true if port is in use, false otherwise.
     */
    async _isPortInUse(port) {
        return new Promise((resolve) => {
            const server = net.createServer();

            server.once('error', (err) => {
                if (err.code === 'EADDRINUSE') {
                    resolve(true); // ✅ Port is in use
                } else {
                    resolve(false);
                }
            });

            server.once('listening', () => {
                server.close();
                resolve(false); // ✅ Port is free
            });

            server.listen(port);
        });
    }

    /**
     * Starts the Validator Server if it's not already running.
     */
    async startValidator() {
        const isRunning = await this._isPortInUse(3500);

        if (!isRunning) {
            log("🚀 Starting FHIR Validator Server...");
            this.process = spawn(this.javaExecutable, [
                "-Xms4G", "-Xmx100G", "-Dfile.encoding=UTF-8",
                "-jar", JAR_PATH, "-startServer"
            ], {
                detached: true,
                stdio: 'ignore',
                env: { ...process.env, ENVIRONMENT: "prod" }
            });

            this.process.unref();
            await new Promise(resolve => setTimeout(resolve, 5000));
        } else {
            log("✅ FHIR Validator Server is already running.");
        }
    }

    async initializeSession() {
        log("🔍 Initializing FHIR validation session...");
        const response = await axios.post('http://localhost:3500/validate', {
            cliContext: this.cliContext,
            filesToValidate: [{
                "fileName": "initializeSession.json",
                "fileContent": "{\"resourceType\": \"Basic\"}",
                "fileType": "json"
              }]
        });

        this.sessionId = response.data.sessionId;
        log(`✅ Session initialized: ${this.sessionId}`);

        this.startKeepAlive();
    }

    async validate(resource) {
        if (!this.sessionId) {
            throw new Error("Session not initialized. Call initializeSession() first.");
        }

        const response = await axios.post('http://localhost:3500/validate', {
            cliContext: this.cliContext,
            filesToValidate: [{
                "fileName": "resource.json",
                "fileContent": JSON.stringify(resource),
                "fileType": "json"
              }],
            sessionId: this.sessionId
        });

        return response.data;
    }

    startKeepAlive() {
        if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);

        this.keepAliveInterval = setInterval(async () => {
            try {
                await axios.post('http://localhost:3500/validate', {
                    cliContext: this.cliContext,
                    filesToValidate: [{
                        "fileName": "keepalive.json",
                        "fileContent": "{\"resourceType\": \"Basic\"}",
                        "fileType": "json"
                      }],
                    sessionId: this.sessionId
                });
                log(`🔄 Keep-alive ping sent for session: ${this.sessionId}`);
            } catch (error) {
                logError("⚠️ Keep-alive ping failed.");
            }
        }, 55 * 60 * 1000);
    }

    /**
     * Stops keep-alive process and allows clean application exit.
     */
    shutdown() {
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = null;
            log("🛑 Keep-alive interval cleared.");
        }
    }
}

module.exports = FHIRValidator;
