import assert from 'node:assert/strict';
import test from 'node:test';

import {buildUnifiedSearchItems, parseSearchQuery} from '../src/search-items.js';

const groups = [{
  id: 42,
  title: 'Research',
  color: 'blue',
  collapsed: false,
  windowId: 7,
  tabCount: 2,
  tabs: [{title: 'Chrome API'}, {title: 'Alfred docs'}],
}];

const tabs = [{
  id: 11,
  title: 'GitHub',
  url: 'https://github.com/wilsonyiyi/alfred-chrome-tabs',
  active: true,
  windowId: 1,
  index: 0,
  groupId: 42,
  groupTitle: 'Research',
}, {
  id: 12,
  title: 'Example docs',
  url: 'https://example.com/docs/',
  active: false,
  windowId: 1,
  index: 1,
}];

const history = [{
  id: '1',
  title: 'Example docs',
  url: 'https://example.com/docs/',
  lastVisitTime: 1_800_000_000_000 - 2 * 60 * 60 * 1000,
  visitCount: 4,
}, {
  id: '2',
  title: 'Old issue',
  url: 'https://github.com/wilsonyiyi/alfred-chrome-tabs/issues/1',
  lastVisitTime: 1_800_000_000_000 - 5 * 60 * 60 * 1000,
  visitCount: 1,
}];

const savedGroups = [{
  id: 'uuid-1',
  title: 'Archived reading',
  color: 'grey',
  savedAt: 1,
  tabs: [{title: 'Spec', url: 'https://spec.test/tabgroups'}],
}];

test('parseSearchQuery reads type prefixes and keeps unmatched text as the query', () => {
  assert.deepEqual(parseSearchQuery('github'), {scope: 'all', query: 'github'});
  assert.deepEqual(parseSearchQuery('t: github'), {scope: 'tabs', query: 'github'});
  assert.deepEqual(parseSearchQuery('tabs:docs'), {scope: 'tabs', query: 'docs'});
  assert.deepEqual(parseSearchQuery('g:work'), {scope: 'groups', query: 'work'});
  assert.deepEqual(parseSearchQuery('group: Research'), {scope: 'groups', query: 'Research'});
  assert.deepEqual(parseSearchQuery('h:'), {scope: 'history', query: ''});
  assert.deepEqual(parseSearchQuery('history: docs'), {scope: 'history', query: 'docs'});
});

test('buildUnifiedSearchItems orders tabs, groups, then history and labels each type', () => {
  const items = buildUnifiedSearchItems({
    tabs,
    groups,
    history,
    historyStatus: 'ok',
    scope: 'all',
    query: '',
    now: 1_800_000_000_000,
  });

  assert.equal(items[0].title, 'GitHub');
  assert.equal(
    items[0].subtitle,
    'Tab · Active · github.com/wilsonyiyi/alfred-chrome-tabs · Window 1 · Research',
  );
  assert.deepEqual(JSON.parse(items[0].arg), {method: 'focusTab', params: {tabId: 11}});
  assert.equal(items[1].title, 'Example docs');
  assert.equal(items[2].title, '🔵 Research');
  assert.match(items[2].subtitle, /^Group · /u);
  assert.equal(JSON.parse(items[2].arg).method, 'focusGroup');
  assert.equal(items[3].title, 'Old issue');
  assert.match(items[3].subtitle, /^History · /u);
});

test('buildUnifiedSearchItems hides history URLs that are already open in combined results', () => {
  const items = buildUnifiedSearchItems({
    tabs,
    groups,
    history,
    historyStatus: 'ok',
    scope: 'all',
    query: 'docs',
    now: 1_800_000_000_000,
  });

  assert.deepEqual(items.map(item => item.title), ['Example docs', '🔵 Research']);
  assert.equal(items.some(item => item.subtitle.startsWith('History ·')), false);
});

test('history-only results keep pages that are already open', () => {
  const items = buildUnifiedSearchItems({
    tabs,
    groups,
    history,
    historyStatus: 'ok',
    scope: 'history',
    query: 'docs',
    now: 1_800_000_000_000,
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Example docs');
  assert.match(items[0].subtitle, /^History · /u);
});

test('type prefixes keep only the selected result type', () => {
  const items = buildUnifiedSearchItems({
    tabs,
    groups,
    history,
    historyStatus: 'ok',
    scope: 'groups',
    query: 'research',
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].title, '🔵 Research');
  assert.equal(JSON.parse(items[0].mods.cmd.arg).method, 'closeGroup');
});

test('JXA fallback tabs focus by window and tab index', () => {
  const [item] = buildUnifiedSearchItems({
    tabs: [{
      windowIndex: 0,
      tabIndex: 2,
      title: 'Local tab',
      url: 'https://example.com',
    }],
    scope: 'tabs',
    query: '',
  });

  assert.equal(item.subtitle, 'Tab · example.com · Window 1');
  assert.deepEqual(JSON.parse(item.arg), {
    method: 'focusTabByIndex',
    params: {windowIndex: 0, tabIndex: 2},
  });
});

test('permission-required history still returns tabs and groups', () => {
  const items = buildUnifiedSearchItems({
    tabs,
    groups,
    history: [],
    historyStatus: 'permission-required',
    scope: 'all',
    query: 'github',
  });

  assert.equal(items[0].title, 'GitHub');
  assert.equal(items.at(-1).title, 'Enable Chrome History Search');
  assert.equal(items.at(-1).valid, false);
});

test('saved groups follow live groups and stay inside the group scope', () => {
  const items = buildUnifiedSearchItems({
    tabs,
    groups,
    savedGroups,
    history,
    historyStatus: 'ok',
    scope: 'groups',
    query: '',
  });

  assert.deepEqual(items.map(item => item.title), ['🔵 Research', '⚪ Archived reading']);
  assert.equal(items[1].subtitle, 'Group · 1 tabs · Saved · Return reopens this group');
  assert.deepEqual(JSON.parse(items[1].arg), {
    method: 'openSavedGroup',
    params: {savedGroupId: 'uuid-1'},
  });
});

test('saved groups are searchable by their remembered tab URLs', () => {
  const items = buildUnifiedSearchItems({
    tabs: [],
    groups: [],
    savedGroups,
    scope: 'all',
    query: 'spec.test',
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].title, '⚪ Archived reading');
});

test('empty combined query does not show history', () => {
  const items = buildUnifiedSearchItems({
    tabs,
    groups,
    history,
    historyStatus: 'skipped',
    scope: 'all',
    query: '',
  });

  assert.equal(items.some(item => item.subtitle?.startsWith('History ·')), false);
  assert.equal(items.at(-1).title, '🔵 Research');
});
