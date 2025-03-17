const createValidatorInstance = require('../src/index');
const { performance } = require('perf_hooks');

// Configuration
const NUM_RESOURCES = 1536; // Number of resources to generate

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
const timings = {};

async function initializeValidators() {
    console.log("Initializing validation server...");
    const startServer = performance.now();
    await createValidatorInstance();
    const endServer = performance.now();
    console.log(`Validation server running. Initialization Time: ${(endServer - startServer).toFixed(2)}ms`);

    console.log("Initializing validator sessions...");
    for (let i = 0; i < 4; i++) {
        const startSession = performance.now();
        validators[i] = await createValidatorInstance({
            sv: "4.0.1",
            igs: ["il.core.fhir.r4#0.16.2"],
            txServer: null
        });
        // warmup session by running validation on a single resource
        console.log(`Warming up validator session ${i}...`);
        await callValidate(validators[i], generateRandomResource(i+10000));
        const endSession = performance.now();
        console.log(`Validator session ${i} initialized in ${(endSession - startSession).toFixed(2)}ms`);
    }
    console.log("All validator sessions initialized.");
}

// Function to call validate on a validator instance
async function callValidate(validator, resource) {
    return await validator.validate(resource, ['http://fhir.health.gov.il/StructureDefinition/il-core-patient']);    
}

// Function to measure execution time
async function measureTime(label, fn) {
    console.log(`Starting ${label}...`);
    const start = performance.now();
    await fn();
    const end = performance.now();
    timings[label] = (end - start).toFixed(2) + "ms";
    console.log(`${label}: ${timings[label]}`);
}

async function runInSeries(resources, instanceIndex) {
    for (const resource of resources) {
        await callValidate(validators[instanceIndex], resource);
    }
}

async function runAll(resources, instanceIndex) {
    const chunkSize = Math.ceil(resources.length / 4);
    await Promise.all([
        runInSeries(resources.slice(0, chunkSize), instanceIndex),
        runInSeries(resources.slice(chunkSize, chunkSize * 2), instanceIndex),
        runInSeries(resources.slice(chunkSize * 2, chunkSize * 3), instanceIndex),
        runInSeries(resources.slice(chunkSize * 3), instanceIndex)            
    ]);
}

// Approach 1: Use a single validator instance
async function testApproach1(resources) {
    await measureTime("Approach 1 (Single Instance)", async () => {
        await runAll(resources, 0);
    });
}

// Approach 2: Use 2 validator instances
async function testApproach2(resources) {
    const half = Math.ceil(resources.length / 2);
    await measureTime("Approach 2 (Parallel 2 Instances)", async () => {
        await Promise.all([
            runAll(resources.slice(0, half), 0),
            runAll(resources.slice(half), 1)
        ]);
    });
}


// Approach 3: Use 3 validator instances
async function testApproach3(resources) {
    const chunkSize = Math.ceil(resources.length / 3);
    await measureTime("Approach 3 (Parallel 3 Instances)", async () => {
        await Promise.all([
            runAll(resources.slice(0, chunkSize), 0),
            runAll(resources.slice(chunkSize, chunkSize * 2), 1),
            runAll(resources.slice(chunkSize * 2), 2)
        ]);
    });
}

// Approach 4: Use 4 validator instances
async function testApproach4(resources) {
    const chunkSize = Math.ceil(resources.length / 4);
    await measureTime("Approach 4 (Parallel 4 Instances)", async () => {
        await Promise.all([
            runAll(resources.slice(0, chunkSize), 0),
            runAll(resources.slice(chunkSize, chunkSize * 2), 1),
            runAll(resources.slice(chunkSize * 2, chunkSize * 3), 2),
            runAll(resources.slice(chunkSize * 3), 3)            
        ]);
    });
}

// Main function to execute tests
async function runTests() {
    await initializeValidators();
    let resources = [];
    for (let i = 0; i < 4; i++) {
        resources[i] = Array.from({ length: NUM_RESOURCES }, (_, i) => generateRandomResource(i));
    }
    console.log(`Running performance tests with ${NUM_RESOURCES} resources...`);
    await testApproach1(resources[0]);
    await testApproach2(resources[1]);
    await testApproach3(resources[2]);
    await testApproach4(resources[3]);
    
    // Shutdown all validator instances
    validators.forEach(validator => validator.shutdown());
    
    console.log("Performance tests completed.");
    console.log("Summary of Execution Times:");
    Object.entries(timings).forEach(([key, value]) => console.log(`${key}: ${value}`));
}

runTests().catch(console.error);
