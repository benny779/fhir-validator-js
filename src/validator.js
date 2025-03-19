/**
 * © Copyright Outburn Ltd. 2025 All Rights Reserved
 *   Project name: FUME / FHIR Validator
 */

const { getJavaExecutable } = require('./utils/jdk-utils');
const { log, logError } = require('./utils/logger');
const axios = require('axios');
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto'); // For generating random UUID's
const http = require('http'); // ✅ Use Node's built-in HTTP client

const BIN_DIR = path.join(__dirname, '../bin');
const JAR_PATH = path.join(BIN_DIR, 'validator.jar');

class FHIRValidator {
    constructor(cliContext) {
        this.javaExecutable = getJavaExecutable();
        if (cliContext) {
            this.cliContext = cliContext;
            if (this.cliContext?.txServer && ['n/a', '', 'null', 'none', 'na'].includes(this.cliContext.txServer)) this.cliContext.txServer = null;
            this.cliContext.igs = this.cliContext?.igs || [];
            this.cliContext.sv = this.cliContext?.sv || '4.0.1';
        }

        this.sessionId = null;
        this.keepAliveInterval = null;
        this.pid = null;
    }

    /**
     * Checks if the Validator Server is available by making a direct HTTP request.
     * @returns {Promise<boolean>} - Resolves to true if the server is responsive, otherwise false.
     */
    async isValidatorServerUp() {
        const url = "http://localhost:3500/validator/version";
        const maxRetries = 10;
        let attempts = 0;
    
        while (attempts < maxRetries) {
            attempts++;
    
            try {
                await new Promise((resolve, reject) => {
                    const req = http.get(url, (res) => {
                        if (res.statusCode === 200) {
                            res.resume(); // Consume response data
                            resolve(true);
                        } else {
                            reject(new Error(`Unexpected status code: ${res.statusCode}`));
                        }
                    });
    
                    req.on('error', () => reject(new Error("Server not reachable")));
                    req.setTimeout(2000, () => {
                        req.destroy();
                        reject(new Error("Healthcheck timeout"));
                    });
                });
    
                return true; // ✅ Server is up
            } catch (error) {
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retrying
            }
        }
    
        return false; // ❌ Server is not responding after retries
    }
    

    /**
     * Starts the Validator Server if it's not already running.
     */
    async startValidator() {
        const isRunning = await this.isValidatorServerUp();
    
        if (!isRunning) {
            log("🚀 Starting FHIR Validator Server...");
            log("ℹ️ All logs from the validator process will be reported here.");
            this.process = spawn(this.javaExecutable, [
                '-Xms4G',
                '-Xmx16G',
                // '-XX:+UseZGC',
                // '-Xshare:on',
                // '-XX:+AlwaysPreTouch',
                // '-XX:MaxGCPauseMillis=200',
                // '-XX:ParallelGCThreads=4',
                // '-XX:+TieredCompilation',
                // '-XX:+UseStringDeduplication',
                // `-Dvalidator.maxThreads=${Math.floor(require('os').cpus().length * 0.75)}`,
                // '-Dhttp.keepAlive.timeout=300',
                "-Dfile.encoding=UTF-8",
                "-jar",
                JAR_PATH,
                "-startServer"
            ], {
                detached: true,
                stdio: ['ignore', 'pipe', 'pipe'], // Capture stdout & stderr
                env: { 
                    ...process.env, 
                    ENVIRONMENT: "prod",
                    LOAD_PRESETS: "false"
                }
            });
    
            let serverReady = false;
    
            // Capture standard output from JAR
            this.process.stdout.on("data", data => {
                const message = data.toString().trim();
                log(`[FHIR Validator] ${message}`);
    
                // Check for readiness signal
                if (
                    message.includes("Responding at") || 
                    message.includes("Started ServerConnector")
                ) {
                    serverReady = true;
                }
            });
    
            // Capture error output from JAR
            this.process.stderr.on("data", data => {
                logError(`[FHIR Validator ERROR] ${data.toString().trim()}`);
            });
    
            // Handle process exit
            this.process.on("exit", (code, signal) => {
                logError(`⚠️ FHIR Validator process exited with code ${code}, signal ${signal}`);
            });
    
            // Wait until we detect server readiness or determine another process has taken over
            await new Promise(resolve => {
                const checkInterval = setInterval(async () => {
                    if (serverReady) {
                        // ✅ Our process successfully started
                        console.log(this.process.toString());
                        this.pid = this.process.pid; // ✅ Store process ID of the spawned validator
                        clearInterval(checkInterval);
                        resolve();
                    } else if (await this.isValidatorServerUp() && !serverReady) {
                        // ⚠️ Another process took the port, and we never got "serverReady"
                        log("⚠️ Another process successfully bound to the port before ours was ready. Switching to 'already running' mode and terminating this process.");
                        this.process.kill();
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 300);
            });

            this.process.unref(); // Prevent the process from keeping the event loop alive
    
            if (serverReady) {
                log(`✅ FHIR Validator Server is ready. (PID: ${this.pid})`);
            } else {
                log("✅ FHIR Validator Server is already running.");
            }
        } else {
            log("✅ FHIR Validator Server is already running.");
        }
    }
         

    async initializeSession() {
        log("🔍 Initializing FHIR validation session...");
    
        try {
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
        } catch (error) {
            logError(`❌ Failed to initialize session: ${error.message}`);
            logError(error.toString());
            throw new Error("Failed to initialize FHIR validation session.");
        }
    }
    

    async validate(resource, profiles = []) {
        // Ensure session is initialized
        if (!this.sessionId) {
            throw new Error("Session not initialized. You need to pass a valid CLI context object when creating a new validator instance.");
        }

        // Enforce resource to be an array
        if (!Array.isArray(resource)) {
            resource = [resource];
        }

        // Enforce profiles to be an array
        if (!Array.isArray(profiles)) {
            profiles = [profiles];
        }
        const batchId = crypto.randomUUID();
        const cliContext = this.cliContext;
        
        // Add profiles to cliContext
        if (profiles.length > 0) {
            cliContext.profiles = profiles;
        }

        // Function to convert a resource to a validation API request's filesToValidate format
        const resourceEntry = (instance, index) => {
            const fileName = `${batchId}_${index.toString()}.json`;
            return { fileName, fileContent: JSON.stringify(instance), "fileType": "json" }
        };
        
        try {
            const response = await axios.post('http://localhost:3500/validate', {
                cliContext,
                filesToValidate: resource.map(resourceEntry),
                sessionId: this.sessionId
            });
    
            if (response.data.sessionId && response.data.sessionId !== this.sessionId) {
                log(`⚠ Session mismatch detected! Updating sessionId to ${response.data.sessionId}`);
                this.sessionId = response.data.sessionId;
            }
    
            const outcomes = response.data.outcomes.map((outcome, index) => {
                // check if the outcome entry matches the resource entry at the same index
                if (outcome.fileInfo.fileName !== `${batchId}_${index.toString()}.json`) {
                    log(`⚠️ Mismatch detected between resource and outcome at index ${index}.`);
                    log(`Resource: ${JSON.stringify(resource[index])}`);
                    log(`Outcome: ${JSON.stringify(outcome)}`);
                } else {
                    // Remove fileInfo from outcome
                    delete outcome.fileInfo;
                }
                return outcome;
            });

            if (outcomes.length === 1) return outcomes[0]
            return outcomes;
        } catch (error) {
            logError(`❌ Validation failed: ${error.message}`);
            throw new Error("FHIR validation request failed.");
        }
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
    
        if (this.process) {
            log("ℹ️ Detaching from FHIR Validator process. It will continue running in the background.");
    
            // Ensure listeners are fully removed
            this.process.stdout.removeAllListeners();
            this.process.stderr.removeAllListeners();
            this.process.on("exit", () => {}); // Prevent lingering events
    
            // Close the streams manually in case they are holding the event loop open
            if (this.process.stdout) this.process.stdout.destroy();
            if (this.process.stderr) this.process.stderr.destroy();
    
            // Set pid
            this.pid = this.process.pid;

            // Force garbage collection of the process reference
            this.process = null;
        } else {
            log("ℹ️ No validator process was managed by this instance.");
        }
    
        // Force an immediate garbage collection cycle (helps in some cases)
        if (global.gc) {
            global.gc();
        }
    }
    
    
}

module.exports = FHIRValidator;
