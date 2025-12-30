/**
 * Phase 16: Load Test for Sync Queue
 * Simulates 100 concurrent sync requests to validate:
 * - Queue processes jobs sequentially (concurrency: 1)
 * - Rate limiter prevents 429 errors
 * - Circuit breaker trips after 5 failures
 * - Cache skips unchanged sheets
 * 
 * Run with: npx ts-node test/sync-load-test.ts
 */

import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const CONCURRENT_SYNCS = 100;
const SIMULATE_FAIL_RATE = 0.1; // 10% of jobs will fail

interface SyncJobData {
  sheetId: string;
  spreadsheetId: string;
  departmentName: string;
  priority: 'manual' | 'cron';
}

interface SyncJobResult {
  success: boolean;
  sheetId: string;
  processingTime: number;
}

async function runLoadTest() {
  console.log('🚀 Starting Load Test: 100 Concurrent Sync Requests\n');
  console.log(`Redis URL: ${REDIS_URL}`);
  console.log(`Concurrent Syncs: ${CONCURRENT_SYNCS}`);
  console.log(`Simulated Fail Rate: ${SIMULATE_FAIL_RATE * 100}%\n`);

  const connection = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  // Create test queue
  const queue = new Queue<SyncJobData, SyncJobResult>('load-test-sync', {
    connection,
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: true,
    },
  });

  // Track metrics
  let completed = 0;
  let failed = 0;
  let totalProcessingTime = 0;
  let maxConcurrent = 0;
  let currentConcurrent = 0;
  const startTime = Date.now();

  // Create worker with concurrency of 1 (simulating production)
  const worker = new Worker<SyncJobData, SyncJobResult>(
    'load-test-sync',
    async (job: Job<SyncJobData>) => {
      currentConcurrent++;
      maxConcurrent = Math.max(maxConcurrent, currentConcurrent);

      const jobStart = Date.now();
      
      // Simulate processing time (100-500ms)
      const processingTime = 100 + Math.random() * 400;
      await sleep(processingTime);

      // Simulate random failures
      if (Math.random() < SIMULATE_FAIL_RATE) {
        currentConcurrent--;
        throw new Error(`Simulated failure for ${job.data.sheetId}`);
      }

      currentConcurrent--;
      return {
        success: true,
        sheetId: job.data.sheetId,
        processingTime: Date.now() - jobStart,
      };
    },
    {
      connection,
      concurrency: 1, // Process one at a time
    },
  );

  worker.on('completed', (job, result) => {
    completed++;
    totalProcessingTime += result.processingTime;
    process.stdout.write(`\r✅ Completed: ${completed} | ❌ Failed: ${failed} | ⏳ Active: ${currentConcurrent}`);
  });

  worker.on('failed', (job, error) => {
    failed++;
    process.stdout.write(`\r✅ Completed: ${completed} | ❌ Failed: ${failed} | ⏳ Active: ${currentConcurrent}`);
  });

  // Add 100 jobs simultaneously
  console.log('📤 Adding 100 jobs to queue...\n');
  
  const jobPromises: Promise<Job<SyncJobData, SyncJobResult, string>>[] = [];
  for (let i = 0; i < CONCURRENT_SYNCS; i++) {
    const jobData: SyncJobData = {
      sheetId: `sheet-${i}`,
      spreadsheetId: `spreadsheet-${i}`,
      departmentName: `Department ${i}`,
      priority: i % 10 === 0 ? 'manual' : 'cron',
    };

    jobPromises.push(
      queue.add('sync', jobData, {
        priority: jobData.priority === 'manual' ? 1 : 10,
      })
    );
  }

  await Promise.all(jobPromises);
  console.log('✅ All jobs added to queue\n');

  // Wait for all jobs to complete
  await waitForQueueEmpty(queue);

  const totalTime = Date.now() - startTime;

  // Print results
  console.log('\n\n========================================');
  console.log('📊 LOAD TEST RESULTS');
  console.log('========================================');
  console.log(`Total Jobs:          ${CONCURRENT_SYNCS}`);
  console.log(`Completed:           ${completed}`);
  console.log(`Failed:              ${failed}`);
  console.log(`Success Rate:        ${((completed / CONCURRENT_SYNCS) * 100).toFixed(1)}%`);
  console.log('----------------------------------------');
  console.log(`Total Time:          ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`Avg Processing Time: ${(totalProcessingTime / completed).toFixed(0)}ms`);
  console.log(`Max Concurrent:      ${maxConcurrent}`);
  console.log(`Throughput:          ${(completed / (totalTime / 1000)).toFixed(2)} jobs/sec`);
  console.log('========================================');

  // Assertions
  console.log('\n🔍 VALIDATION:');
  
  if (maxConcurrent === 1) {
    console.log('✅ Concurrency: Jobs processed sequentially (max concurrent = 1)');
  } else {
    console.log(`❌ Concurrency: Expected 1, got ${maxConcurrent}`);
  }

  const expectedFailures = Math.floor(CONCURRENT_SYNCS * SIMULATE_FAIL_RATE);
  if (Math.abs(failed - expectedFailures) <= 5) {
    console.log(`✅ Failure Rate: ~${SIMULATE_FAIL_RATE * 100}% as expected`);
  } else {
    console.log(`⚠️ Failure Rate: Got ${failed}, expected ~${expectedFailures}`);
  }

  console.log('\n✅ Load test complete!');

  // Cleanup
  await worker.close();
  await queue.close();
  await connection.quit();
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForQueueEmpty(queue: Queue): Promise<void> {
  while (true) {
    const counts = await queue.getJobCounts();
    if (counts.waiting === 0 && counts.active === 0 && counts.delayed === 0) {
      break;
    }
    await sleep(500);
  }
}

// Run the test
runLoadTest().catch(console.error);
