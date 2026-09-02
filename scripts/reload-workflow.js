#!/usr/bin/env node

import {
  DEVELOPMENT_BUNDLE_ID,
  PRODUCTION_BUNDLE_ID,
} from '../src/release-package.js';
import {reloadWorkflow} from '../src/workflow-reloader.js';

const bundleIds = new Map([
  ['development', [DEVELOPMENT_BUNDLE_ID, PRODUCTION_BUNDLE_ID]],
  ['production', [PRODUCTION_BUNDLE_ID, DEVELOPMENT_BUNDLE_ID]],
]);
const mode = process.argv[2];
const candidates = bundleIds.get(mode);

if (!candidates) {
  throw new Error('Usage: node scripts/reload-workflow.js <development|production>');
}

const [targetBundleId, previousBundleId] = candidates;

try {
  await reloadWorkflow(targetBundleId);
} catch (targetError) {
  try {
    await reloadWorkflow(previousBundleId);
    await reloadWorkflow(targetBundleId);
  } catch (fallbackError) {
    throw new AggregateError(
      [targetError, fallbackError],
      `Could not reload Alfred workflow as ${targetBundleId}`,
    );
  }
}

console.log(`Reloaded Alfred workflow ${targetBundleId}`);
