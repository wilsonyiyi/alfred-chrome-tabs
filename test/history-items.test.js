import assert from 'node:assert/strict';
import test from 'node:test';

import {buildHistoryItems, relativeVisitTime} from '../src/history-items.js';

test('buildHistoryItems creates smart-open and force-new Alfred actions', () => {
  const now = 1_800_000_000_000;
  const [item] = buildHistoryItems([{
    id: '1',
    title: 'Example docs',
    url: 'https://example.com/docs/',
    lastVisitTime: now - 2 * 60 * 60 * 1000,
    visitCount: 4,
  }], {now});

  assert.equal(item.title, 'Example docs');
  assert.equal(item.subtitle, 'example.com/docs · 2h ago · 4 visits');
  assert.deepEqual(JSON.parse(item.arg), {
    method: 'openHistoryItem',
    params: {url: 'https://example.com/docs/'},
  });
  assert.deepEqual(JSON.parse(item.mods.cmd.arg), {
    method: 'openHistoryItem',
    params: {url: 'https://example.com/docs/', forceNew: true},
  });
});

test('buildHistoryItems removes invisible title characters and skips empty URLs', () => {
  const items = buildHistoryItems([
    {title: '\u200BProject docs', url: 'https://example.com', lastVisitTime: 1000},
    {title: 'Missing URL', url: ''},
  ], {now: 1000});

  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Project docs');
});

test('relativeVisitTime uses compact stable units', () => {
  const now = 1_800_000_000_000;
  assert.equal(relativeVisitTime(undefined, now), 'Unknown time');
  assert.equal(relativeVisitTime(now - 30_000, now), 'Just now');
  assert.equal(relativeVisitTime(now - 5 * 60_000, now), '5m ago');
  assert.equal(relativeVisitTime(now - 3 * 24 * 60 * 60_000, now), '3d ago');
});
