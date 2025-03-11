const { getJavaExecutable } = require('./utils/jdk-utils');
const { log, logError } = require('./utils/logger');
const axios = require('axios');
const path = require('path');
const { spawn } = require('child_process');
const net = require('net'); // ✅ Required for checking port usage
const crypto = require('crypto'); // For generating random UUID's

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

    async validate(resource, profiles = []) {
        // Ensure session is initialized
        if (!this.sessionId) {
            throw new Error("Session not initialized. Call initializeSession() first.");
        }

        // Ensure resource is NOT an array
        if (Array.isArray(resource)) {
            if (resource.length === 1) {
                resource = resource[0];
            } else {
                throw new Error("Invalid input: 'resource' should be a single FHIR resource, not an array.");
            }
        }

        let _resource = null;

        // if resource is a string, try to convert to JSON
        if (typeof resource === 'string') {
            try {
                _resource = JSON.parse(resource);
            } catch (error) {
                throw new Error("Invalid input: 'resource' cannot be parsed as a valid JSON object.");
            }
        }
        
        // Clone resource
        _resource = _resource ?? structuredClone(resource);;
        
        // Ensure resource is an object
        if (!_resource?.constructor || _resource?.constructor !== ({}).constructor || _resource === null || _resource === undefined) {
            throw new Error("Invalid input: 'resource' should be a valid JSON object.");
        }

        // Ensure profiles is an array or string
        if (!Array.isArray(profiles) && !typeof profiles === 'string') {
            throw new Error("Invalid input: 'profiles' should be an array of profile URLs.");
        }

        // Enforce profiles to be an array
        if (typeof profiles === 'string') {
            profiles = [profiles];
        }
        
        // Add profiles to resource
        if (profiles.length > 0) {
            if (!_resource?.meta) {
                _resource.meta = {};
            }
            _resource.meta.profile = profiles;
        }

        // Convert resource to JSON string
        const fileContent = JSON.stringify(_resource);
        
        const fileName = crypto.randomUUID() + ".json";
        const response = await axios.post('http://localhost:3500/validate', {
            cliContext: this.cliContext,
            filesToValidate: [{
                fileName,
                fileContent,
                "fileType": "json"
              }],
            sessionId: this.sessionId
        });

        // If the response contains a different sessionId, update it.
        // This can happen if the machine was asleep for a long time and the session expired.
        if (response.data.sessionId && response.data.sessionId !== this.sessionId) {
            console.warn(`⚠ Session mismatch detected! Updating sessionId to ${response.data.sessionId}`);
            this.sessionId = response.data.sessionId;
        }

        const outcomes = response.data.outcomes[0];
        delete outcomes.fileInfo;
        return outcomes;
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
