const createValidatorInstance = require('../src/index');
const { performance } = require('perf_hooks');
const os = require('os');
const fs = require('fs');
const { execSync } = require('child_process');

// Configuration
const NUM_RESOURCES = 1536;
const NUM_VALIDATORS = os.cpus().length;
const BATCH_SIZES = [1, 4, 16, 64, 256];
const PARALLEL_REQUESTS = [1, 2, 4, 8];
const MEMORY_SAMPLING_INTERVAL = 500; // Milliseconds

// Function to generate a randomized FHIR resource
function generateRandomResource(index) {
    return {
        resourceType: "Patient",
        id: `patient-${index}`,
        name: [{
            given: [`Test-${index}`],
            family: `User-${Math.floor(Math.random() * 10000)}`
        }],
        birthDate: `${Math.floor(Math.random() * 100) + 1920}-01-01`
    };
}

// Pre-instantiate validators
const validators = [];
let validatorPID = null;
const timings = {};
const memoryUsage = [];

async function initializeValidators() {
    console.log("Initializing validation server...");
    const startServer = performance.now();
    const instance = await createValidatorInstance();
    const endServer = performance.now();
    console.log(`Validation server running. Initialization Time: ${(endServer - startServer).toFixed(2)}ms`);

    if (instance.pid) {
        validatorPID = instance.pid;
    }

    console.log("Initializing validator sessions...");
    for (let i = 0; i < NUM_VALIDATORS; i++) {
        const startSession = performance.now();
        const validator = await createValidatorInstance({
            sv: "4.0.1",
            igs: ["il.core.fhir.r4#0.16.2"],
            txServer: null
        });
        if (validator.pid && !validatorPID) {
            validatorPID = validator.pid;
        }
        validators[i] = validator;

        console.log(`Warming up validator session ${i}...`);
        await callValidate(validator, [generateRandomResource(i + 10000)]);
        const endSession = performance.now();
        console.log(`Validator session ${i} initialized in ${(endSession - startSession).toFixed(2)}ms`);
    }
    if (!validatorPID) {
        throw new Error("No validator instance contains a PID. Cannot track external memory usage.");
    }
    console.log("All validator sessions initialized.");
}

async function callValidate(validator, resources) {
    return await validator.validate(resources, ['http://fhir.health.gov.il/StructureDefinition/il-core-patient']);
}

async function measureTime(label, fn) {
    console.log(`Starting ${label}...`);
    const start = performance.now();
    await fn();
    const end = performance.now();
    timings[label] = (end - start).toFixed(2) + "ms";
    console.log(`${label}: ${timings[label]}`);
}

async function monitorMemoryUsage() {
    if (!validatorPID) return;
    console.log("Starting memory tracking...");
    while (true) {
        try {
            const memUsage = process.platform === 'win32' 
                ? execSync(`tasklist /FI "PID eq ${validatorPID}" /FO CSV /NH`).toString().split(',')[4].replace(/"/g, '').trim()
                : execSync(`ps -o rss= -p ${validatorPID}`).toString().trim();
            memoryUsage.push({ timestamp: Date.now(), memory: parseInt(memUsage, 10) });
        } catch (error) {
            console.warn("Error reading memory usage: ", error);
            break;
        }
        await new Promise(resolve => setTimeout(resolve, MEMORY_SAMPLING_INTERVAL));
    }
}

async function runTests() {
    await initializeValidators();
    console.log(`Running performance tests with ${NUM_RESOURCES} resources on ${NUM_VALIDATORS} CPU cores...`);

    const memoryTracking = monitorMemoryUsage();
    
    for (const batchSize of BATCH_SIZES) {
        for (const parallelRequests of PARALLEL_REQUESTS) {
            for (let numInstances = 1; numInstances <= NUM_VALIDATORS; numInstances++) {
                const chunkSize = Math.ceil(NUM_RESOURCES / numInstances);
                const resources = Array.from({ length: NUM_RESOURCES }, (_, i) => generateRandomResource(i));
                
                await measureTime(`Test [Instances: ${numInstances}, Batch: ${batchSize}, Parallel: ${parallelRequests}]`, async () => {
                    await Promise.all(
                        Array.from({ length: numInstances }, (_, i) =>
                            Promise.all(
                                Array.from({ length: parallelRequests }, () =>
                                    callValidate(validators[i], resources.slice(0, batchSize))
                                )
                            )
                        )
                    );
                });
            }
        }
    }
    
    console.log("Performance tests completed.");
    console.log("Summary of Execution Times:");
    Object.entries(timings).forEach(([key, value]) => console.log(`${key}: ${value}`));

    // Stop memory tracking and save results
    fs.writeFileSync('memory_usage.json', JSON.stringify(memoryUsage, null, 2));
    console.log("Memory tracking data saved to memory_usage.json");

    // Shutdown all validator instances
    validators.forEach(validator => validator.shutdown());
}

runTests().catch(console.error);