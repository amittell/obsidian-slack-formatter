#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');
const readmePath = path.join(projectRoot, 'README.md');
const manifestPath = path.join(projectRoot, 'manifest.json');

function ensureFileExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found at ${filePath}`);
  }
}

function validateReadme() {
  ensureFileExists(readmePath, 'README');
  const contents = fs.readFileSync(readmePath, 'utf8');
  const requiredHeadings = ['## Why this plugin?', '## Features', '## Usage'];
  const missingHeadings = requiredHeadings.filter(heading => !contents.includes(heading));

  if (missingHeadings.length > 0) {
    return missingHeadings.map(heading => `Missing README section: ${heading}`);
  }

  if (!/```markdown[\s\S]+```/m.test(contents)) {
    return ['README is missing the sample formatted output code block'];
  }

  return [];
}

function validateManifest() {
  ensureFileExists(manifestPath, 'manifest');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const issues = [];

  if (!manifest.name || typeof manifest.name !== 'string') {
    issues.push('manifest.json is missing a plugin name');
  }

  if (!manifest.version || typeof manifest.version !== 'string') {
    issues.push('manifest.json is missing a version');
  }

  if (!manifest.minAppVersion || typeof manifest.minAppVersion !== 'string') {
    issues.push('manifest.json is missing minAppVersion');
  }

  return issues;
}

function main() {
  try {
    const issues = [...validateReadme(), ...validateManifest()];

    if (issues.length > 0) {
      console.error('Documentation check failed:');
      for (const issue of issues) {
        console.error(` - ${issue}`);
      }
      process.exit(1);
    }

    console.log('Documentation check passed: README structure and manifest metadata look good.');
  } catch (error) {
    console.error(`Documentation check failed: ${error.message}`);
    process.exit(1);
  }
}

main();
