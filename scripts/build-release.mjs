import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const steps = [
  { label: 'Clean build outputs', script: 'clean' },
  { label: 'Types, lint and unit tests', script: 'check' },
  { label: 'Extension and webview build + integration tests', script: 'test:integration' },
  { label: 'Package VSIX', script: 'package' },
];

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

for (const [index, step] of steps.entries()) {
  console.log(`\n▶ [${index + 1}/${steps.length}] ${step.label}`);
  const result = spawnSync(npm, ['run', step.script], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error) {
    fail(`${step.label} failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(`${step.label} failed with exit code ${result.status ?? 'unknown'}.`);
  }
}

const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
const vsix = resolve(`ikanban-${packageJson.version}.vsix`);

if (!existsSync(vsix)) {
  fail(`Expected release artifact was not created: ${vsix}`);
}

const size = statSync(vsix).size;
const hash = createHash('sha256').update(readFileSync(vsix)).digest('hex');

console.log('\n✔ Release artifact ready');
console.log(`  Version: ${packageJson.version}`);
console.log(`  File:    ${vsix}`);
console.log(`  Size:    ${(size / (1024 * 1024)).toFixed(2)} MB`);
console.log(`  SHA256:  ${hash}`);
