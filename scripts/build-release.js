#!/usr/bin/env node

import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {buildReleasePackage} from '../src/release-package.js';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destinationRoot = path.join(sourceRoot, '.release', 'package');

await buildReleasePackage({sourceRoot, destinationRoot});
console.log(`Release package created at ${destinationRoot}`);
