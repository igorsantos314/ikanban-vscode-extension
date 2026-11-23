#!/usr/bin/env node
// Pre-flight check for the metadata that the VS Code Marketplace reads from a
// VSIX. It catches the problems that make an upload fail with a generic
// "Your extension has suspicious content" rejection: missing or SVG icons,
// dead repository/support links, insecure image URLs in the README and
// reserved fields that do not match the publisher.
//
// Usage: node scripts/check-marketplace.mjs [--offline]

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const offline = process.argv.includes('--offline');
const errors = [];
const warnings = [];

function error(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));

for (const field of ['name', 'displayName', 'description', 'version', 'publisher', 'license']) {
  if (!pkg[field]) error(`package.json is missing "${field}".`);
}

if (!pkg.engines?.vscode) error('package.json is missing "engines.vscode".');

if (pkg.repository?.url) {
  const url = pkg.repository.url;
  if (!url.startsWith('https://')) error(`repository.url must be https: ${url}`);
} else {
  warn('package.json has no repository.url; the listing will have no Source/Support links.');
}

if (pkg.bugs?.url && !pkg.bugs.url.startsWith('https://')) {
  error(`bugs.url must be https: ${pkg.bugs.url}`);
}

if (Array.isArray(pkg.keywords) && pkg.keywords.length > 10) {
  warn(`${pkg.keywords.length} keywords; the Marketplace reads keyword stuffing as spam.`);
}

for (const keyword of pkg.keywords ?? []) {
  if (/\b(copilot|claude|codex|cursor|chatgpt|gemini|openai)\b/i.test(keyword)) {
    warn(`keyword "${keyword}" is another vendor's product name; impersonation checks flag these.`);
  }
}

// An icon is optional for the Marketplace, but a listing without one is a
// common reason for a manual review. When present it must be a PNG of at
// least 128x128: vsce refuses SVG icons.
if (!pkg.icon) {
  warn('package.json has no "icon"; the listing falls back to a placeholder image.');
} else {
  const iconPath = resolve(pkg.icon);
  if (!existsSync(iconPath)) {
    error(`icon does not exist: ${pkg.icon}`);
  } else if (pkg.icon.toLowerCase().endsWith('.svg')) {
    error(`icon must not be an SVG: ${pkg.icon}`);
  } else {
    const header = readFileSync(iconPath).subarray(0, 24);
    const isPng = header.subarray(1, 4).toString() === 'PNG';
    if (!isPng) {
      error(`icon must be a PNG: ${pkg.icon}`);
    } else {
      const width = header.readUInt32BE(16);
      const height = header.readUInt32BE(20);
      if (width < 128 || height < 128) {
        error(`icon must be at least 128x128: ${pkg.icon} is ${width}x${height}`);
      }
    }
  }
}

const readme = resolve('README.md');
if (!existsSync(readme)) {
  error('README.md is missing; the Marketplace listing would be empty.');
} else {
  const text = readFileSync(readme, 'utf8');
  for (const [, url] of text.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)) {
    if (url.startsWith('http://')) error(`README image must use https: ${url}`);
    if (url.startsWith('data:')) error(`README image must not be a data URI: ${url.slice(0, 40)}...`);
    if (url.endsWith('.svg') && !url.startsWith('https://')) {
      error(`README image must not be an SVG unless it is a trusted badge: ${url}`);
    }
  }
}

if (!existsSync(resolve('LICENSE')) && !existsSync(resolve('LICENSE.md'))) {
  warn('no LICENSE file; the listing will have no license.');
}

async function checkLink(label, url) {
  if (!url) return;
  const probe = url.endsWith('.git') ? url.slice(0, -4) : url;
  try {
    const response = await fetch(probe, { method: 'HEAD', redirect: 'follow' });
    if (!response.ok) {
      warn(`${label} does not resolve (${response.status}): ${probe}`);
    }
  } catch (cause) {
    warn(`${label} could not be checked: ${probe} (${cause.message})`);
  }
}

if (!offline) {
  await Promise.all([
    checkLink('repository.url', pkg.repository?.url),
    checkLink('bugs.url', pkg.bugs?.url),
    checkLink('homepage', pkg.homepage),
  ]);
}

for (const message of warnings) console.warn(`⚠ ${message}`);
for (const message of errors) console.error(`✖ ${message}`);

if (errors.length > 0) {
  console.error(`\n${errors.length} metadata error(s) must be fixed before packaging.`);
  process.exit(1);
}

console.log(`✔ Marketplace metadata looks publishable${warnings.length ? ` (${warnings.length} warning(s))` : ''}.`);
