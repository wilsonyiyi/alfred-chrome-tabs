import assert from 'node:assert/strict';
import test from 'node:test';

import {bridgeStatusView, historyPermissionView} from '../extension/popup-state.js';

test('bridgeStatusView maps connected state to a non-retryable success view', () => {
  const view = bridgeStatusView({status: 'connected'});
  assert.equal(view.label, 'Connected');
  assert.equal(view.tone, 'success');
  assert.equal(view.detail, 'Native messaging host is ready.');
  assert.equal(view.canRetry, false);
});

test('bridgeStatusView preserves native host errors for retryable states', () => {
  const view = bridgeStatusView({status: 'reconnecting', detail: 'Specified native messaging host not found.'});
  assert.equal(view.label, 'Reconnecting…');
  assert.equal(view.tone, 'warning');
  assert.equal(view.detail, 'Specified native messaging host not found.');
  assert.equal(view.canRetry, true);
});

test('historyPermissionView exposes an enabled state without another action', () => {
  const view = historyPermissionView('granted');
  assert.equal(view.label, 'Enabled');
  assert.equal(view.tone, 'success');
  assert.equal(view.disabled, true);
});

test('historyPermissionView lets the user enable a denied optional permission', () => {
  const view = historyPermissionView('denied');
  assert.equal(view.label, 'Enable');
  assert.equal(view.disabled, false);
});
