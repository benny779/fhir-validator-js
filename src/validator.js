/**
 * © Copyright Outburn Ltd. 2025 All Rights Reserved
 *   Project name: FUME / FHIR Validator
 */

import { getJavaExecutable } from './utils.js'; 
import { log, logError } from './logger.js';
import axios from 'axios';
import { spawn } from 'child_process';
import http from 'http'; // ✅ Use Node's built-in HTTP client
import net from 'net'; // ✅ Use Node's built-in net module to check if a port is in use
import { jarPath } from './paths.js';

async function _isPortInUse(port) {
  async function tryListen(host) {
    return new Promise((resolve) => {
      const server = net.createServer();
  
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          resolve(true); // Port is in use
        } else {
          resolve(false); // May be EPERM, EACCES, etc.
        }
      });
  
      server.once('listening', () => {
        server.close(() => resolve(false)); // Port is free
      });
  
      server.listen({
        port,
        host,
        exclusive: true, // ✅ This makes the binding strict
      });
    });
  }
  
  // const [ipv4, ipv6] = await Promise.all([
  //   tryListen('0.0.0.0'),
  //   tryListen('::'),
  // ]);
  
  // return ipv4 || ipv6;
  const ipv4 = await tryListen('0.0.0.0');
  return ipv4; // Only check IPv4 for now
}


async function getRandomAvailablePort() {
  /*
    ✅ Safe window: 55200–60999
    Length: 5,800 ports
    No major known uses by default system services, SDKs, remote desktop tools, or malware
    Leaves space above and below for edge cases like TeamViewer (55000–55010), gRPC (50051), and VNC (59000+)
    */
  const MIN_PORT = 55200;
  const MAX_PORT = 60999;
  const tried = new Set();
  
  while (tried.size < (MAX_PORT - MIN_PORT + 1)) {
    const port = Math.floor(Math.random() * (MAX_PORT - MIN_PORT + 1)) + MIN_PORT;
    if (tried.has(port)) continue;
    tried.add(port);
  
    if (!(await _isPortInUse(port))) {
      return port;
    }
  }
  
  throw new Error('No available ports found in the dynamic/private range.');
};

function igsToArgArray(igs) {
  return igs.map((ig, i) => `--validator.ig[${String(i)}]=${ig}`);
}

class FHIRValidator {
  constructor(cliContext = {}) {
    this.javaExecutable = getJavaExecutable();
    this.cliContext = cliContext;
    if (this.cliContext?.txServer && ['n/a', '', 'null', 'none', 'na'].includes(this.cliContext.txServer)) this.cliContext.txServer = null;
    this.cliContext.igs = this.cliContext?.igs || [];
    this.cliContext.sv = this.cliContext?.sv || '4.0.1';
    this.cliContext.threadsMin = this.cliContext?.threadsMin || 6;
    this.cliContext.threadsMax = this.cliContext?.threadsMax || this.cliContext.threadsMin * 3;
    this.pid = null;
  }

  /**
     * Checks if the Validator Server is available by making a direct HTTP request.
     * @returns {Promise<boolean>} - Resolves to true if the server is responsive, otherwise false.
     */
  async isValidatorServerUp() {
    const url = this.validatorUrl;
    console.log(`🔍 Checking if FHIR Validator Server is up at ${url}`);
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
    
          req.on('error', () => reject(new Error('Server not reachable')));
          req.setTimeout(2000, () => {
            req.destroy();
            reject(new Error('Healthcheck timeout'));
          });
        });
        console.log(`✅ FHIR Validator Server at ${url} is up!`);
        return true; // ✅ Server is up
      } catch (error) {
        console.log(`Attempt ${attempts} failed: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retrying
      }
    }
    console.log(`ℹ️ FHIR Validator Server at ${url} is not responding after ${maxRetries} attempts.`);
    return false; // ❌ Server is not responding after retries
  }
    
  /**
     * Starts the Validator Server process using the provided Java executable and arguments.
     * @returns {Promise<void>} - Resolves when the server is ready.
     */
  async startValidator(maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      this.port = await getRandomAvailablePort();
      this.validatorUrl = `http://localhost:${String(this.port)}`;
      log(`🚀 [Attempt ${attempt}] Starting FHIR Validator Server on port ${this.port}...`);
      log('ℹ️ All logs from the validator process will be reported here.');
  
      const igsArray = igsToArgArray(this.cliContext.igs);
      const args = [
        '-jar', jarPath,
        `--server.port=${this.port}`,
        this.cliContext?.txServer === null ? '--validator.tx-server=' : (this.cliContext?.txServer ? `--txServer=${this.cliContext.txServer}` : ''),
        `--validator.sv=${this.cliContext.sv}`,
        `--server.tomcat.threads.min-spare=${this.cliContext.threadsMin}`,
        `--server.tomcat.threads.max=${this.cliContext.threadsMax}`
      ].concat(igsArray);
  
      console.log(`🔧 javaExecutable: ${this.javaExecutable}`);
      console.log(`🔧 Validator arguments: ${args.join(' ')}`);
      this.process = spawn(this.javaExecutable, args, {
        stdio: ['ignore', 'pipe', 'pipe']
      });
  
      let serverReady = false;
      let exitedEarly = false;
  
      this.process.stdout.on('data', data => {
        const message = data.toString().trim();
        log(`[FHIR Validator] ${message}`);
        if (message.includes(`Tomcat started on port ${this.port}`)) {
          serverReady = true;
        }
      });
  
      this.process.stderr.on('data', data => {
        logError(`[FHIR Validator ERROR] ${data.toString().trim()}`);
      });
  
      this.process.on('exit', (code, signal) => {
        if (!serverReady) exitedEarly = true;
        logError(`⚠️ FHIR Validator process exited with code ${code}, signal ${signal}`);
      });
  
      // Wait for the server to be ready or to fail
      const waitResult = await new Promise(resolve => {
        const interval = setInterval(() => {
          if (serverReady) {
            clearInterval(interval);
            resolve('ready');
          }
          if (exitedEarly) {
            clearInterval(interval);
            resolve('exited');
          }
        }, 300);
      });
  
      if (waitResult === 'ready') {
        this.pid = this.process.pid;
        log(`✅ FHIR Validator Server is ready. (PID: ${this.pid})`);
        return;
      } else {
        logError(`❌ Attempt ${attempt} failed to start FHIR Validator on port ${this.port}.`);
        if (this.process && !this.process.killed) this.process.kill('SIGINT');
        await new Promise(r => setTimeout(r, 1000)); // short pause before retry
      }
    }
  
    throw new Error(`Failed to start FHIR Validator after ${maxRetries} attempts. All candidate ports may be unavailable.`);
  }
  

  async validate(resource, profiles = []) {
    const isArray = Array.isArray(resource);
    if (!isArray) resource = [resource];
    if (!Array.isArray(profiles)) profiles = [profiles];
  
    const validateWithRetry = async (entry, retries = 3) => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const response = await axios.post(this.validatorUrl + '/validate', entry, {
            headers: { 'Content-Type': 'application/fhir+json' },
            params: {
              format: 'outcome',
              profiles: profiles.length ? profiles.join(',') : undefined,
            },
          });
          return response.data;
        } catch (err) {
          if (attempt === retries) {
            logError(`❌ Validator failed after ${retries} attempts: ${err.message}`);
            throw new Error(`Validator failed for a resource after ${retries} attempts.`);
          }
          // wait a bit before retrying (basic backoff)
          await new Promise(r => setTimeout(r, 50 * (attempt ** 2)));
        }
      }
    };
  
    const tasks = resource.map(entry => validateWithRetry(entry));
  
    try {
      const outcomes = await Promise.all(tasks);
      return isArray ? outcomes : outcomes[0];
    } catch (error) {
      throw new Error(`Fatal FHIR Validator error: at least one resource failed validation after retries. Error: ${error.message}`);
    }
  };  

  shutdown() {
    this.process.on('exit', () => {
      log('🛑 FHIR Validator process killed.');
    });
    log('🛑 Killing FHIR Validator process...');   
    this.process?.kill('SIGINT'); // Send SIGINT to the process ;
  }
    
    
}

export default FHIRValidator;
