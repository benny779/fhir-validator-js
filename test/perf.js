const createValidatorInstance = require('../src/index');
const { performance } = require('perf_hooks');

// Configuration
const NUM_VALIDATORS = 4;
const NUM_RESOURCES = 128;
const BATCH_SIZES = [1, 4, 8, 16, 32];
const PARALLEL_REQUESTS = [1, 2, 3];

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
const sessionIds = ['9f304524-87b5-42af-9109-d60db0da87dd', 'c25d8a2e-abfc-4f8c-8246-c41eb263f103', '5a11b6af-7cfe-4187-8477-b3e5ebf61149', '320a7e55-8a63-48f4-9fbb-bc25c8ffc972'];

async function initializeValidators() {
    console.log("Initializing validation server...");
    const startServer = performance.now();
    await createValidatorInstance();
    const endServer = performance.now();
    console.log(`Validation server running. Initialization Time: ${(endServer - startServer).toFixed(2)}ms`);

    console.log("Initializing validator sessions...");
    for (let i = 0; i < NUM_VALIDATORS; i++) {
        const startSession = performance.now();
        const validator = await createValidatorInstance({
            sv: "4.0.1",
            igs: ["il.core.fhir.r4#0.16.2"],
            txServer: null,
            sessionId: sessionIds.length > i ? sessionIds[i] : null
        });

        validators[i] = validator;

        console.log(`Warming up validator session ${i}...`);
        await callValidate(validator, generateRandomResource(i + 10000));
        const endSession = performance.now();
        console.log(`Validator session ${i} initialized in ${(endSession - startSession).toFixed(2)}ms`);
    }
    console.log("All validator sessions initialized.");
}

async function callValidate(validator, resources) {
    return await validator.validate(resources, ['http://fhir.health.gov.il/StructureDefinition/il-core-patient']);
}

async function measureTime(label, fn) {
    console.time(label);
    const startTime = Date.now();

    await fn(); // Run the async function

    const durationMs = Date.now() - startTime;
    console.timeEnd(label);

    return durationMs; // Ensure the duration is returned
}

async function runTests() {
    await initializeValidators();
    console.log(`Running performance tests with ${NUM_RESOURCES} resources on ${NUM_VALIDATORS} CPU cores...`);

    const results = [];

    for (const batchSize of BATCH_SIZES) {
        for (const parallelRequests of PARALLEL_REQUESTS) {
            for (let numInstances = 1; numInstances <= NUM_VALIDATORS; numInstances++) {
                
                const resources = Array.from({ length: NUM_RESOURCES }, (_, i) => generateRandomResource(i));

                let totalProcessed = 0;

                const durationMs = await measureTime(
                    `Test [Instances: ${numInstances}, Batch: ${batchSize}, Parallel: ${parallelRequests}]`,
                    async () => {
                        await Promise.all(
                            Array.from({ length: numInstances }, (_, i) =>
                                Promise.all(
                                    Array.from({ length: parallelRequests }, async () => {
                                        while (totalProcessed < NUM_RESOURCES) {
                                            const batch = resources.slice(totalProcessed, totalProcessed + batchSize);
                                            if (batch.length === 0) break;

                                            await callValidate(validators[i], batch);
                                            totalProcessed += batch.length;
                                        }
                                    })
                                )
                            )
                        );
                    }
                );

                if (durationMs === undefined || isNaN(durationMs)) {
                    console.error("❌ Error: `measureTime` did not return a valid duration!");
                    return;
                }

                const totalRequests = NUM_RESOURCES;
                const throughput = (totalRequests / (durationMs / 1000)).toFixed(2);

                results.push({
                    numInstances,
                    batchSize,
                    parallelRequests,
                    durationMs,
                    throughput
                });

                console.log(
                    `📊 Throughput: ${throughput} requests/sec (Time: ${durationMs}ms, Total Requests: ${totalRequests})`
                );
            }
        }
    }

    console.log("✅ Performance tests completed.");
    console.log("📊 Summary of Execution Times:");

    results
    .sort((a, b) => Number(a.throughput) - Number(b.throughput)) // Sort results by throughput
    .forEach(({ numInstances, batchSize, parallelRequests, durationMs, throughput }) =>
        console.log(
            `Instances: ${numInstances}, Batch: ${batchSize}, Parallel: ${parallelRequests} → ` +
            `Time: ${durationMs}ms, Throughput: ${Number(throughput).toFixed(2)} req/sec`
        )
    );

    validators.forEach(validator => validator.shutdown());
}

runTests().catch(console.error);
