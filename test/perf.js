import { createValidatorInstance } from '../src/index.js';
import os from 'os';

const NUM_RESOURCES = 500;
const BATCH_SIZES = [10, 20, 25, 40, 70, 100, 500];

// Generate random FHIR resource
function generateRandomResource(index) {
  return {
    resourceType: 'Patient',
    id: `patient-${index}`,
    name: [{ given: [`Test-${index}`], family: `User-${Math.floor(Math.random() * 10000)}` }],
    birthDate: `${Math.floor(Math.random() * 100) + 1920}-01-01`
  };
}

// Smarter thread config generator: ensure delta ≈ half CPU count
function generateThreadConfigs() {
  const numCPUs = os.cpus().length;
  const delta = Math.round(numCPUs / 2);
  const configs = [];

  for (let min = Math.ceil(numCPUs / 2); min <= numCPUs * 2; min++) {
    const max = min + delta;
    if (max <= numCPUs * 4) {
      configs.push({ threadsMin: min, threadsMax: max });
    }
  }

  return configs;
}

// Time measurement wrapper
async function measureTime(label, fn) {
  console.time(label);
  const start = Date.now();
  await fn();
  const duration = Date.now() - start;
  console.timeEnd(label);
  return duration;
}

// Run tests for one thread configuration
async function runTests(threadsMin, threadsMax) {
  console.log(`\n🚀 Initializing validator (Threads: ${threadsMin}..${threadsMax})`);
  const validator = await createValidatorInstance({
    sv: '4.0.1',
    igs: ['il.core.fhir.r4#0.16.2'],
    txServer: null,
    threadsMin,
    threadsMax
  });

  const results = [];

  for (const batchSize of BATCH_SIZES) {
    const resources = Array.from({ length: NUM_RESOURCES }, (_, i) => generateRandomResource(i));
    let totalProcessed = 0;

    const durationMs = await measureTime(
      `Test [Threads: ${threadsMin}..${threadsMax}, Batch: ${batchSize}]`,
      async () => {
        await Promise.all([
          (async () => {
            while (totalProcessed < NUM_RESOURCES) {
              const batch = resources.slice(totalProcessed, totalProcessed + batchSize);
              await validator.validate(batch, ['http://fhir.health.gov.il/StructureDefinition/il-core-patient']);
              totalProcessed += batch.length;
            }
          })()
        ]);
      }
    );

    const throughput = (NUM_RESOURCES / (durationMs / 1000)).toFixed(2);
    results.push({ batchSize, durationMs, throughput: Number(throughput) });
  }

  validator.shutdown();
  return { threadsMin, threadsMax, results };
}

// Analyze how many times larger batch sizes outperformed smaller ones
function analyzeRelativePerformance(runs) {
  function countRelativityScore(results) {
    const sorted = [...results].sort((a, b) => a.batchSize - b.batchSize);
    let score = 0;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].throughput > sorted[i - 1].throughput) score++;
    }
    return score;
  }

  return runs.map(run => {
    const sorted = [...run.results].sort((a, b) => a.batchSize - b.batchSize);
    const score = countRelativityScore(sorted);
    const avg = sorted.reduce((sum, r) => sum + r.throughput, 0) / sorted.length;
    const best = sorted.reduce((max, r) => r.throughput > max.throughput ? r : max);
    return {
      ...run,
      relativityScore: score,
      averageThroughput: avg.toFixed(2),
      bestBatchSize: best.batchSize
    };
  }).sort((a, b) => b.relativityScore - a.relativityScore);
}

// Final orchestrator
async function main() {
  const configs = generateThreadConfigs();
  const allRuns = [];

  for (const config of configs) {
    const result = await runTests(config.threadsMin, config.threadsMax);
    allRuns.push(result);
  }

  const scored = analyzeRelativePerformance(allRuns);
  const best = scored[0];

  // Full ranked report
  console.log('\n📊 Relative Performance Summary (Sorted by Score):\n');
  console.log('Threads       | Score | Avg TPS | Best Batch');
  console.log('--------------|-------|---------|------------');
  for (const run of scored) {
    const label = `${run.threadsMin}..${run.threadsMax}`.padEnd(13);
    const score = `${run.relativityScore}/${BATCH_SIZES.length - 1}`.padEnd(7);
    const avg = `${run.averageThroughput}`.padEnd(9);
    const bestBatch = `${run.bestBatchSize}`;
    console.log(`${label} | ${score} | ${avg} | ${bestBatch}`);
  }

  // Winner
  console.log('\n🏆 Best Configuration Based on Relative Performance:');
  console.log(`➡️ Threads: ${best.threadsMin}..${best.threadsMax}, Score: ${best.relativityScore}/${BATCH_SIZES.length - 1}`);

  best.results
    .sort((a, b) => a.batchSize - b.batchSize)
    .forEach(({ batchSize, throughput }) =>
      console.log(`Batch ${batchSize} → ${throughput.toFixed(2)} req/sec`)
    );
}

main().catch(console.error);
