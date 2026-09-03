import assert from 'node:assert/strict';
import test from 'node:test';

import {createSearchHandlers} from '../extension/search.js';

function createChromeApi({
  groups = [],
  tabs = [],
  historyGranted = true,
  historyItems = [],
} = {}) {
  const calls = [];
  return {
    calls,
    tabGroups: {
      TAB_GROUP_ID_NONE: -1,
      query: async query => {
        calls.push(['tabGroups.query', query]);
        return groups;
      },
      get: async groupId => groups.find(group => group.id === groupId),
    },
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
      async get(tabId) {
        calls.push(['tabs.get', tabId]);
        return tabs.find(tab => tab.id === tabId);
      },
      async query(query) {
        calls.push(['tabs.query', query]);
        if (Number.isInteger(query.groupId)) {
          return tabs.filter(tab => tab.groupId === query.groupId);
        }
        return tabs;
      },
      async update(tabId, changes) {
        calls.push(['tabs.update', tabId, changes]);
        return {id: tabId, ...changes};
      },
    },
    windows: {
      async update(windowId, changes) {
        calls.push(['windows.update', windowId, changes]);
        return {id: windowId, ...changes};
      },
    },
  };
}

const sampleTabs = [
  {id: 11, windowId: 1, index: 0, title: 'GitHub', url: 'https://github.com', active: true, groupId: 42},
  {id: 12, windowId: 1, index: 1, title: 'Docs', url: 'https://example.com/docs', groupId: -1},
];
const sampleGroups = [
  {id: 42, windowId: 1, title: 'Research', color: 'blue', collapsed: false},
];

test('searchAll returns tabs and groups without history when includeHistory is false', async () => {
  const chromeApi = createChromeApi({groups: sampleGroups, tabs: sampleTabs});
  const result = await createSearchHandlers(chromeApi).searchAll({text: 'docs'});

  assert.equal(result.historyStatus, 'skipped');
  assert.deepEqual(result.history, []);
  assert.equal(result.tabs[0].id, 11);
  assert.equal(result.tabs[0].groupTitle, 'Research');
  assert.equal(result.tabs[1].groupId, undefined);
  assert.equal(result.groups[0].id, 42);
  assert.equal(chromeApi.calls.some(([method]) => method === 'history.search'), false);
});

test('searchAll searches history when includeHistory is true', async () => {
  const now = 1_800_000_000_000;
  const chromeApi = createChromeApi({
    groups: sampleGroups,
    tabs: sampleTabs,
    historyItems: [{id: '1', title: 'Docs', url: 'https://example.com/docs', visitCount: 2}],
  });

  const result = await createSearchHandlers(chromeApi, {now: () => now}).searchAll({
    text: ' docs ',
    includeHistory: true,
    maxResults: 50,
  });

  assert.equal(result.historyStatus, 'ok');
  assert.equal(result.history[0].url, 'https://example.com/docs');
  assert.deepEqual(chromeApi.calls.find(([method]) => method === 'history.search')?.at(1), {
    text: 'docs',
    startTime: now - 365 * 24 * 60 * 60 * 1000,
    maxResults: 50,
  });
});

test('searchAll keeps tabs when history permission is missing', async () => {
  const chromeApi = createChromeApi({
    groups: sampleGroups,
    tabs: sampleTabs,
    historyGranted: false,
  });
  const result = await createSearchHandlers(chromeApi).searchAll({
    text: 'docs',
    includeHistory: true,
  });

  assert.equal(result.historyStatus, 'permission-required');
  assert.deepEqual(result.history, []);
  assert.equal(result.tabs.length, 2);
  assert.equal(chromeApi.calls.some(([method]) => method === 'history.search'), false);
});

test('focusTab focuses the window and activates the tab', async () => {
  const chromeApi = createChromeApi({tabs: sampleTabs});
  const tab = await createSearchHandlers(chromeApi).focusTab({tabId: 12});

  assert.equal(tab.id, 12);
  assert.deepEqual(chromeApi.calls.slice(-2), [
    ['windows.update', 1, {focused: true}],
    ['tabs.update', 12, {active: true}],
  ]);
});

test('focusTab requires an integer tabId', async () => {
  await assert.rejects(
    createSearchHandlers(createChromeApi()).focusTab({tabId: '12'}),
    {name: 'TypeError'},
  );
});
