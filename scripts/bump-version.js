#!/usr/bin/env node

import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {bumpReleaseVersion} from '../src/release-version.js';

const release = process.argv[2];
if (!release) {
  throw new Error('Usage: npm run version:bump -- <patch|minor|major|X.Y.Z>');
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const result = await bumpReleaseVersion({release, root});
console.log(result.changed
  ? `Version updated from ${result.previousVersion} to ${result.version}.`
  : `Version is already ${result.version}.`);
