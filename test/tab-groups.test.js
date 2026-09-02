import assert from 'node:assert/strict';
import test from 'node:test';

import {createTabGroupHandlers} from '../extension/tab-groups.js';

function createChromeApi({groups = [], tabs = []} = {}) {
  const calls = [];
  const api = {
    calls,
    tabGroups: {
      TAB_GROUP_ID_NONE: -1,
      query: async query => {
        calls.push(['tabGroups.query', query]);
        return groups;
      },
      get: async groupId => groups.find(group => group.id === groupId),
      update: async (groupId, changes) => {
        calls.push(['tabGroups.update', groupId, changes]);
        return {...groups.find(group => group.id === groupId), ...changes};
      },
      move: async (groupId, moveProperties) => ({id: groupId, ...moveProperties}),
    },
    tabs: {
      query: async query => {
        calls.push(['tabs.query', query]);
        if (Number.isInteger(query.groupId)) {
          return tabs.filter(tab => tab.groupId === query.groupId);
        }
        if (query.active) {
          return tabs.filter(tab => tab.active);
        }
        return tabs;
      },
      group: async options => {
        calls.push(['tabs.group', options]);
        return options.groupId ?? 91;
      },
      move: async (tabId, moveProperties) => ({id: tabId, ...moveProperties}),
      remove: async tabIds => calls.push(['tabs.remove', tabIds]),
      ungroup: async tabIds => calls.push(['tabs.ungroup', tabIds]),
      update: async (tabId, changes) => ({id: tabId, ...changes}),
    },
    windows: {
      update: async (windowId, changes) => ({id: windowId, ...changes}),
    },
  };
  return api;
}

test('listGroups joins tabs to groups and sorts them by window and index', async () => {
  const chromeApi = createChromeApi({
    groups: [
      {id: 2, windowId: 3, title: 'Later', color: 'grey', collapsed: false},
      {id: 1, windowId: 1, title: 'First', color: 'blue', collapsed: true},
    ],
    tabs: [
      {id: 20, groupId: 2, index: 5, title: 'B', url: 'https://b.test'},
      {id: 11, groupId: 1, index: 4, title: 'A2', url: 'https://a2.test'},
      {id: 10, groupId: 1, index: 2, title: 'A1', url: 'https://a1.test', active: true},
      {id: 99, groupId: -1, index: 1, title: 'Ungrouped'},
    ],
  });

  const groups = await createTabGroupHandlers(chromeApi).listGroups();

  assert.deepEqual(groups.map(group => group.id), [1, 2]);
  assert.equal(groups[0].index, 2);
  assert.equal(groups[0].tabCount, 2);
  assert.deepEqual(groups[0].tabs.map(tab => tab.id), [10, 11]);
});

test('createGroup groups the active tab and applies title and color', async () => {
  const chromeApi = createChromeApi({
    groups: [{id: 91, windowId: 1}],
    tabs: [{id: 7, windowId: 1, active: true, groupId: -1}],
  });

  const group = await createTabGroupHandlers(chromeApi).createGroup({
    title: ' Work ',
    color: 'green',
  });

  assert.deepEqual(chromeApi.calls.slice(-2), [
    ['tabs.group', {tabIds: 7}],
    ['tabGroups.update', 91, {title: 'Work', color: 'green'}],
  ]);
  assert.equal(group.title, 'Work');
});

test('setGroupCollapsed toggles the current collapsed state', async () => {
  const chromeApi = createChromeApi({
    groups: [{id: 8, windowId: 1, collapsed: false}],
  });

  await createTabGroupHandlers(chromeApi).setGroupCollapsed({
    groupId: 8,
    collapsed: 'toggle',
  });

  assert.deepEqual(chromeApi.calls.at(-1), [
    'tabGroups.update',
    8,
    {collapsed: true},
  ]);
});
