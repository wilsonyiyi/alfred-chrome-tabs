import assert from 'node:assert/strict';
import test from 'node:test';

import {createHistoryHandlers} from '../extension/history.js';

function createChromeApi({historyGranted = true, historyItems = [], tabs = []} = {}) {
  const calls = [];
  return {
    calls,
    history: {
      async search(query) {
        calls.push(['history.search', query]);
        return historyItems;
      },
    },
    permissions: {
      async contains(permission) {
        calls.push(['permissions.contains', permission]);
        return historyGranted;
      },
    },
    tabs: {
      async create(properties) {
        calls.push(['tabs.create', properties]);
        return {id: 99, ...properties};
      },
      async query(query) {
        calls.push(['tabs.query', query]);
        return tabs;
      },
      async update(tabId, properties) {
        calls.push(['tabs.update', tabId, properties]);
        return {id: tabId, ...properties};
      },
    },
    windows: {
      async update(windowId, properties) {
        calls.push(['windows.update', windowId, properties]);
        return {id: windowId, ...properties};
      },
    },
  };
}

test('searchHistory requires the optional history permission', async () => {
  const chromeApi = createChromeApi({historyGranted: false});
  const handlers = createHistoryHandlers(chromeApi);

  await assert.rejects(
    handlers.searchHistory({text: 'docs'}),
    error => error.code === 'HISTORY_PERMISSION_REQUIRED',
  );
  assert.equal(chromeApi.calls.some(([method]) => method === 'history.search'), false);
});

test('searchHistory searches one year with a bounded result count', async () => {
  const now = 1_800_000_000_000;
  const chromeApi = createChromeApi({
    historyItems: [{id: '1', title: 'Docs', url: 'https://example.com', visitCount: 3}],
  });
  const handlers = createHistoryHandlers(chromeApi, {now: () => now});

  const results = await handlers.searchHistory({text: ' docs ', maxResults: 999});

  assert.deepEqual(chromeApi.calls.at(-1), ['history.search', {
    text: 'docs',
    startTime: now - 365 * 24 * 60 * 60 * 1000,
    maxResults: 100,
  }]);
  assert.deepEqual(results, [{
    id: '1',
    title: 'Docs',
    url: 'https://example.com',
    lastVisitTime: 0,
    typedCount: 0,
    visitCount: 3,
  }]);
});

test('openHistoryItem focuses an existing tab before creating a duplicate', async () => {
  const chromeApi = createChromeApi({
    tabs: [{id: 7, windowId: 3, url: 'https://example.com'}],
  });
  const result = await createHistoryHandlers(chromeApi).openHistoryItem({
    url: 'https://example.com',
  });

  assert.deepEqual(result, {tabId: 7, reused: true});
  assert.deepEqual(chromeApi.calls.slice(-2), [
    ['windows.update', 3, {focused: true}],
    ['tabs.update', 7, {active: true}],
  ]);
  assert.equal(chromeApi.calls.some(([method]) => method === 'tabs.create'), false);
});

test('openHistoryItem can always create a new tab', async () => {
  const chromeApi = createChromeApi({
    tabs: [{id: 7, windowId: 3, url: 'https://example.com'}],
  });
  const result = await createHistoryHandlers(chromeApi).openHistoryItem({
    url: 'https://example.com',
    forceNew: true,
  });

  assert.deepEqual(result, {tabId: 99, reused: false});
  assert.deepEqual(chromeApi.calls.at(-1), ['tabs.create', {url: 'https://example.com'}]);
});
