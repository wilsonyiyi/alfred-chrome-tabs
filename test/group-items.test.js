import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildGroupCommandItems,
  buildGroupItems,
  buildSavedGroupItems,
} from '../src/group-items.js';

const groups = [{
  id: 42,
  title: 'Research',
  color: 'blue',
  collapsed: false,
  windowId: 7,
  tabCount: 2,
  tabs: [{title: 'Chrome API'}, {title: 'Alfred docs'}],
}];

test('buildGroupItems exposes focus and modifier actions for every group', () => {
  const [item] = buildGroupItems(groups);

  assert.equal(item.title, '🔵 Research');
  assert.equal(item.subtitle, '2 tabs · Expanded · Window 7');
  assert.equal(item.match, 'Research blue Chrome API Alfred docs');
  assert.deepEqual(JSON.parse(item.arg), {
    method: 'focusGroup',
    params: {groupId: 42},
  });
  assert.equal(JSON.parse(item.mods.alt.arg).method, 'setGroupCollapsed');
  assert.equal(JSON.parse(item.mods.shift.arg).method, 'addCurrentTab');
  assert.equal(JSON.parse(item.mods.ctrl.arg).method, 'ungroupGroup');
  assert.equal(JSON.parse(item.mods.cmd.arg).method, 'closeGroup');
  assert.deepEqual(JSON.parse(item.mods['cmd+alt'].arg), {
    method: 'saveGroup',
    params: {groupId: 42},
  });
});

test('buildSavedGroupItems reopens by saved id and offers a delete modifier', () => {
  const [item] = buildSavedGroupItems([{
    id: 'uuid-1',
    title: 'Research',
    color: 'purple',
    savedAt: 1,
    tabs: [
      {title: 'Chrome API', url: 'https://chrome.test/api'},
      {title: 'Alfred docs', url: 'https://alfred.test/docs'},
    ],
  }]);

  assert.equal(item.title, '🟣 Research');
  assert.equal(item.subtitle, '2 tabs · Saved · Return reopens this group');
  assert.match(item.match, /saved/u);
  assert.match(item.match, /chrome\.test\/api/u);
  assert.deepEqual(JSON.parse(item.arg), {
    method: 'openSavedGroup',
    params: {savedGroupId: 'uuid-1'},
  });
  assert.deepEqual(JSON.parse(item.mods.cmd.arg), {
    method: 'deleteSavedGroup',
    params: {savedGroupId: 'uuid-1'},
  });
});

test('c2 lists saved groups after live groups and before the management commands', () => {
  const items = buildGroupCommandItems(groups, '', {
    savedGroups: [{id: 'uuid-1', title: 'Archived', color: 'grey', savedAt: 1, tabs: []}],
  });

  assert.equal(items[0].title, '🔵 Research');
  assert.equal(items[1].title, '⚪ Archived');
  assert.equal(items[2].autocomplete, 'new ');
  assert.equal(items[3].autocomplete, 'color ');
});

test('c2 color only offers live groups so it never emits an undefined group id', () => {
  const items = buildGroupCommandItems(groups, 'color Archived', {
    savedGroups: [{id: 'uuid-1', title: 'Archived', color: 'grey', savedAt: 1, tabs: []}],
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].valid, false);
  assert.equal(items[0].title, 'No matching Chrome tab groups');
});

test('c2 root always exposes matching groups before create and recolor actions', () => {
  const items = buildGroupCommandItems(groups, '');

  assert.equal(items[0].title, '🔵 Research');
  assert.equal(items[1].autocomplete, 'new ');
  assert.equal(items[2].autocomplete, 'color ');
  assert.equal(items.every(item => item.uid === undefined), true);
});

test('c2 new creates the current tab group with the selected color', () => {
  const colors = buildGroupCommandItems(groups, 'new ');
  assert.equal(colors.length, 9);
  assert.equal(colors.find(item => item.title === '🟢 Green').autocomplete, 'new green ');

  const [create] = buildGroupCommandItems(groups, 'new green Project docs');
  assert.deepEqual(JSON.parse(create.arg), {
    method: 'createGroup',
    params: {title: 'Project docs', color: 'green'},
  });
});

test('c2 new keeps grey as the shortcut default when no color is supplied', () => {
  const [create] = buildGroupCommandItems(groups, 'new Project docs');

  assert.deepEqual(JSON.parse(create.arg), {
    method: 'createGroup',
    params: {title: 'Project docs', color: 'grey'},
  });
});

test('c2 color selects a group and emits a setGroupColor action', () => {
  const [group] = buildGroupCommandItems(groups, 'color Research');
  assert.equal(group.autocomplete, 'color @42 ');
  assert.equal(group.valid, false);

  const colors = buildGroupCommandItems(groups, 'color @42 ');
  const purple = colors.find(item => item.title === '🟣 Purple');
  assert.deepEqual(JSON.parse(purple.arg), {
    method: 'setGroupColor',
    params: {groupId: 42, color: 'purple'},
  });
});
