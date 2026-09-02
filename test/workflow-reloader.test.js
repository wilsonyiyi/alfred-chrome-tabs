import assert from 'node:assert/strict';
import test from 'node:test';

import {createReloadScript} from '../src/workflow-reloader.js';

test('createReloadScript safely quotes the workflow bundle ID', () => {
  const script = createReloadScript('bundle";dangerous()//');

  assert.match(script, /reloadWorkflow\("bundle\\";dangerous\(\)\/\/"\)/u);
});
