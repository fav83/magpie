import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: 'inherit',
      cwd: join(__dirname, '..'),
      shell: true,
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });
  });
}

async function build() {
  console.log('Starting build with pre-rendering...\n');

  // Step 1: Build the app
  console.log('Step 1: Building the app...');
  await runCommand('npm', ['run', 'build:no-prerender']);

  // Step 2: Pre-render routes
  console.log('\nStep 2: Pre-rendering routes...');
  await runCommand('node', ['scripts/prerender.js']);

  console.log('\nBuild with pre-rendering complete!');
}

build().catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});
