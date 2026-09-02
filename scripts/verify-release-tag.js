#!/usr/bin/env node

import fs from 'node:fs';

const tag = process.argv[2];
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const expectedTag = `v${packageJson.version}`;

if (tag !== expectedTag) {
  throw new Error(`Release tag ${tag || '<missing>'} does not match package version ${expectedTag}`);
}

console.log(`Release tag ${tag} matches package version ${packageJson.version}.`);
