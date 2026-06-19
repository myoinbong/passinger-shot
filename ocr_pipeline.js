const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { createWorker, createScheduler } = require('tesseract.js');

// Parse CLI Arguments
const args = process.argv.slice(2);
let interval = 2.0;
let numWorkers = 4;
let maxDuration = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--interval' || args[i] === '-i') {
    interval = parseFloat(args[++i]);
  } else if (args[i] === '--workers' || args[i] === '-w') {
    numWorkers = parseInt(args[++i], 10);
  } else if (args[i] === '--max-duration' || args[i] === '-d') {
    maxDuration = parseFloat(args[++i]);
  }
}

const VIDEO_PATH = 'GMT20260618-070456_Recording_640x360.mp4';
const CSV_OUTPUT = 'sensor_data.csv';

async function main() {
  console.log(`Starting Video Sensor OCR Pipeline...`);
  console.log(`Video: ${VIDEO_PATH}`);
  console.log(`Interval: ${interval}s`);
  console.log(`Parallel Workers: ${numWorkers}`);
  if (maxDuration !== null) {
    console.log(`Max Duration: ${maxDuration}s`);
  }
  console.log(`Output: ${CSV_OUTPUT}`);

  // Create/Clear CSV file and write header
  fs.writeFileSync(CSV_OUTPUT, 'Timestamp (s),Time Format (HH:MM:SS),Value\n');

  // Initialize Tesseract Scheduler and Workers
  console.log('Initializing Tesseract OCR worker pool...');
  const scheduler = createScheduler();
  const workers = [];

  for (let i = 0; i < numWorkers; i++) {
    console.log(`  Starting worker ${i + 1}/${numWorkers}...`);
    const worker = await createWorker('eng');
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789.',
      tessedit_pageseg_mode: '7', // single text line
    });
    scheduler.addWorker(worker);
    workers.push(worker);
  }
  console.log('Worker pool ready.');

  // Spawn python frame extractor
  const pyArgs = [
    'stream_frames.py',
    '--video', VIDEO_PATH,
    '--interval', String(interval)
  ];
  if (maxDuration !== null) {
    pyArgs.push('--max-duration', String(maxDuration));
  }
  
  console.log(`Spawning Python frame extractor: python3 ${pyArgs.join(' ')}`);
  const pythonProc = spawn('.venv/bin/python3', pyArgs);

  // Buffer to accumulate stdout data
  let buffer = Buffer.alloc(0);
  const activeJobs = [];

  // Parse stream state
  let state = 0;
  let currentTimestamp = 0;
  let currentLength = 0;

  pythonProc.stdout.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    processBuffer();
  });

  pythonProc.stderr.on('data', (data) => {
    process.stderr.write(`[Python] ${data.toString()}`);
  });

  function processBuffer() {
    let processed = true;
    while (processed) {
      processed = false;

      if (state === 0) {
        const marker = Buffer.from("FRAME_START\n");
        const idx = buffer.indexOf(marker);
        if (idx !== -1) {
          buffer = buffer.subarray(idx + marker.length);
          state = 1;
          processed = true;
        }
      } else if (state === 1) {
        const idx = buffer.indexOf('\n');
        if (idx !== -1) {
          const line = buffer.subarray(0, idx).toString('ascii').trim();
          currentTimestamp = parseFloat(line);
          buffer = buffer.subarray(idx + 1);
          state = 2;
          processed = true;
        }
      } else if (state === 2) {
        const idx = buffer.indexOf('\n');
        if (idx !== -1) {
          const line = buffer.subarray(0, idx).toString('ascii').trim();
          currentLength = parseInt(line, 10);
          buffer = buffer.subarray(idx + 1);
          state = 3;
          processed = true;
        }
      } else if (state === 3) {
        if (buffer.length >= currentLength) {
          const pngData = buffer.subarray(0, currentLength);
          buffer = buffer.subarray(currentLength);
          handleFrame(currentTimestamp, pngData);
          state = 0;
          processed = true;
        }
      }
    }
  }

  function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return [
      String(hrs).padStart(2, '0'),
      String(mins).padStart(2, '0'),
      String(secs).padStart(2, '0')
    ].join(':');
  }

  function handleFrame(timestamp, pngBuffer) {
    const jobPromise = scheduler.addJob('recognize', pngBuffer)
      .then((result) => {
        const text = result.data.text.trim();
        let cleaned = text;
        if (cleaned.endsWith('.')) {
          cleaned = cleaned.slice(0, -1);
        }
        
        const timeStr = formatTime(timestamp);
        console.log(`[${timeStr}] OCR Result: "${cleaned}" (raw: "${text}")`);
        fs.appendFileSync(CSV_OUTPUT, `${timestamp.toFixed(3)},${timeStr},${cleaned}\n`);
      })
      .catch((err) => {
        console.error(`Error processing frame at ${timestamp}s:`, err);
      });
      
    activeJobs.push(jobPromise);
  }

  // Wait for python to finish and all OCR jobs to complete
  await new Promise((resolve) => {
    pythonProc.on('close', resolve);
  });

  console.log("Python extractor finished. Waiting for remaining OCR jobs to complete...");
  await Promise.all(activeJobs);

  console.log("Terminating Tesseract worker pool...");
  await scheduler.terminate();
  console.log("OCR Pipeline completed successfully.");
  console.log(`Results saved to ${CSV_OUTPUT}`);
}

main().catch(err => {
  console.error("Pipeline failure:", err);
});
