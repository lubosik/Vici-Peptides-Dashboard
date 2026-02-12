#!/usr/bin/env node
/**
 * Start Next.js dev server in a detached process so it keeps running
 * after the terminal/shell closes. Run: node scripts/run-dev.js
 * Then open http://localhost:3000
 */
const { spawn } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const nextBin = path.join(projectRoot, 'node_modules', '.bin', 'next');

const child = spawn(
  process.execPath,
  [nextBin, 'dev', '--port', '3000', '--hostname', '0.0.0.0'],
  {
    cwd: projectRoot,
    stdio: 'inherit',
    detached: true, // survive after this script exits
    env: { ...process.env, FORCE_COLOR: '1' },
  }
);

child.on('error', (err) => {
  console.error('Failed to start Next.js:', err.message);
  process.exit(1);
});

child.unref();
console.log('Dev server starting in background. Open http://localhost:3000');
console.log('To stop: kill the "next dev" process (e.g. pkill -f "next dev")');
process.exit(0);
