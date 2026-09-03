import assert from 'node:assert/strict';
import test from 'node:test';

import {createSavedGroupHandlers} from '../extension/saved-groups.js';

function createChromeApi({groups = [], tabs = [], stored} = {}) {
  const calls = [];
  const data = stored === undefined ? {} : {savedGroups: stored};
  let nextTabId = 500;

  return {
    calls,
    data,
    storage: {
      local: {
        async get(key) {
          calls.push(['storage.get', key]);
          return key in data ? {[key]: data[key]} : {};
        },
        async set(items) {
          calls.push(['storage.set', items]);
          Object.assign(data, items);
        },
      },
    },
    tabGroups: {
      TAB_GROUP_ID_NONE: -1,
      async get(groupId) {
        return groups.find(group => group.id === groupId);
      },
      async update(groupId, changes) {
        calls.push(['tabGroups.update', groupId, changes]);
        return {id: groupId, ...changes};
      },
    },
    tabs: {
      async create(properties) {
        const tab = {id: (nextTabId += 1), windowId: 9, ...properties};
        calls.push(['tabs.create', properties]);
        return tab;
      },
      async get(tabId) {
        return {id: tabId, windowId: 9};
      },
      async group(options) {
        calls.push(['tabs.group', options]);
        return 77;
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

const liveGroups = [{id: 42, windowId: 1, title: 'Research', color: 'blue'}];
const liveTabs = [
  {id: 11, groupId: 42, index: 3, title: 'Alfred docs', url: 'https://alfred.test/docs'},
  {id: 10, groupId: 42, index: 1, title: 'Chrome API', url: 'https://chrome.test/api'},
];

test('listSavedGroups never writes to storage and returns newest first', async () => {
  const chromeApi = createChromeApi({
    stored: [
      {id: 'a', title: 'Older', color: 'grey', savedAt: 10, tabs: []},
      {id: 'b', title: 'Newer', color: 'blue', savedAt: 20, tabs: []},
    ],
  });

  const saved = await createSavedGroupHandlers(chromeApi).listSavedGroups();

  assert.deepEqual(saved.map(group => group.id), ['b', 'a']);
  assert.equal(chromeApi.calls.some(([method]) => method === 'storage.set'), false);
});

test('saveGroup captures the live tabs in tab order with a stable own id', async () => {
  const chromeApi = createChromeApi({groups: liveGroups, tabs: liveTabs});
  const handlers = createSavedGroupHandlers(chromeApi, {
    now: () => 1234,
    createId: () => 'uuid-1',
  });

  const entry = await handlers.saveGroup({groupId: 42});

  assert.deepEqual(entry, {
    id: 'uuid-1',
    title: 'Research',
    color: 'blue',
    savedAt: 1234,
    tabs: [
      {title: 'Chrome API', url: 'https://chrome.test/api'},
      {title: 'Alfred docs', url: 'https://alfred.test/docs'},
    ],
  });
  assert.deepEqual(chromeApi.data.savedGroups, [entry]);
});

test('saveGroup falls back to pendingUrl and drops tabs without any URL', async () => {
  const chromeApi = createChromeApi({
    groups: liveGroups,
    tabs: [
      {id: 10, groupId: 42, index: 0, title: 'Restoring', pendingUrl: 'https://pending.test/'},
      {id: 11, groupId: 42, index: 1, title: 'No URL yet', url: ''},
    ],
  });

  const entry = await createSavedGroupHandlers(chromeApi, {createId: () => 'uuid-2'})
    .saveGroup({groupId: 42});

  assert.deepEqual(entry.tabs, [{title: 'Restoring', url: 'https://pending.test/'}]);
});

test('saving the same title and color again replaces that entry instead of duplicating', async () => {
  const chromeApi = createChromeApi({
    groups: liveGroups,
    tabs: liveTabs,
    stored: [
      {id: 'existing', title: 'Research', color: 'blue', savedAt: 1, tabs: []},
      {id: 'other', title: 'Reading', color: 'red', savedAt: 2, tabs: []},
    ],
  });

  await createSavedGroupHandlers(chromeApi, {
    now: () => 9999,
    createId: () => 'uuid-fresh',
  }).saveGroup({groupId: 42});

  assert.deepEqual(chromeApi.data.savedGroups.map(group => group.id), ['existing', 'other']);
  assert.equal(chromeApi.data.savedGroups[0].savedAt, 9999);
  assert.equal(chromeApi.data.savedGroups[0].tabs.length, 2);
});

test('saveGroup refuses a group with no saveable tabs', async () => {
  const chromeApi = createChromeApi({groups: liveGroups, tabs: []});

  await assert.rejects(
    createSavedGroupHandlers(chromeApi).saveGroup({groupId: 42}),
    /no saveable tabs/u,
  );
  assert.equal(chromeApi.calls.some(([method]) => method === 'storage.set'), false);
});

test('deleteSavedGroup removes only the requested id', async () => {
  const chromeApi = createChromeApi({
    stored: [
      {id: 'a', title: 'Keep', color: 'grey', savedAt: 1, tabs: []},
      {id: 'b', title: 'Drop', color: 'grey', savedAt: 2, tabs: []},
    ],
  });

  const result = await createSavedGroupHandlers(chromeApi).deleteSavedGroup({savedGroupId: 'b'});

  assert.deepEqual(result, {savedGroupId: 'b'});
  assert.deepEqual(chromeApi.data.savedGroups.map(group => group.id), ['a']);
});

test('deleteSavedGroup reports an unknown id', async () => {
  const chromeApi = createChromeApi({stored: []});

  await assert.rejects(
    createSavedGroupHandlers(chromeApi).deleteSavedGroup({savedGroupId: 'missing'}),
    /no longer exists/u,
  );
});

test('openSavedGroup recreates the tabs, applies title and color, then focuses it', async () => {
  const chromeApi = createChromeApi({
    stored: [{
      id: 'uuid-1',
      title: 'Research',
      color: 'purple',
      savedAt: 1,
      tabs: [
        {title: 'Chrome API', url: 'https://chrome.test/api'},
        {title: 'Alfred docs', url: 'https://alfred.test/docs'},
      ],
    }],
  });

  const group = await createSavedGroupHandlers(chromeApi).openSavedGroup({savedGroupId: 'uuid-1'});

  assert.deepEqual(chromeApi.calls.filter(([method]) => method === 'tabs.create'), [
    ['tabs.create', {url: 'https://chrome.test/api', active: false}],
    ['tabs.create', {url: 'https://alfred.test/docs', active: false}],
  ]);
  assert.deepEqual(chromeApi.calls.find(([method]) => method === 'tabs.group'), [
    'tabs.group',
    {tabIds: [501, 502]},
  ]);
  assert.deepEqual(group, {id: 77, title: 'Research', color: 'purple'});
  assert.deepEqual(chromeApi.calls.slice(-2), [
    ['windows.update', 9, {focused: true}],
    ['tabs.update', 501, {active: true}],
  ]);
  assert.equal(chromeApi.data.savedGroups.length, 1);
});

test('openSavedGroup reports a saved group that was already removed', async () => {
  const chromeApi = createChromeApi({stored: []});

  await assert.rejects(
    createSavedGroupHandlers(chromeApi).openSavedGroup({savedGroupId: 'uuid-1'}),
    /no longer exists/u,
  );
});
