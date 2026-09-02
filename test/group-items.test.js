import assert from 'node:assert/strict';
import test from 'node:test';

import {buildGroupCommandItems, buildGroupItems} from '../src/group-items.js';

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
});

test('cg root exposes create and recolor actions before matching groups', () => {
  const items = buildGroupCommandItems(groups, '');

  assert.equal(items[0].autocomplete, 'new ');
  assert.equal(items[1].autocomplete, 'color ');
  assert.equal(items[2].title, '🔵 Research');
});

test('cg new creates the current tab group with the selected color', () => {
  const colors = buildGroupCommandItems(groups, 'new ');
  assert.equal(colors.length, 9);
  assert.equal(colors.find(item => item.title === '🟢 Green').autocomplete, 'new green ');

  const [create] = buildGroupCommandItems(groups, 'new green Project docs');
  assert.deepEqual(JSON.parse(create.arg), {
    method: 'createGroup',
    params: {title: 'Project docs', color: 'green'},
  });
});

test('cg new keeps grey as the shortcut default when no color is supplied', () => {
  const [create] = buildGroupCommandItems(groups, 'new Project docs');

  assert.deepEqual(JSON.parse(create.arg), {
    method: 'createGroup',
    params: {title: 'Project docs', color: 'grey'},
  });
});

test('cg color selects a group and emits a setGroupColor action', () => {
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
