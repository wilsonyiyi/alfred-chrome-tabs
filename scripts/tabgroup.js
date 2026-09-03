#!/usr/bin/env node

import {requestBridge} from '../src/bridge/client.js';

function integer(value, name) {
  const number = Number(value);
  if (!Number.isInteger(number)) {
    throw new TypeError(`${name} must be an integer`);
  }
  return number;
}

function usage() {
  return `Usage: npm run tabgroup -- <command>

Commands:
  status
  list
  focus <group-id>
  create <title>
  rename <group-id> <title>
  color <group-id> <grey|blue|red|yellow|green|pink|purple|cyan|orange>
  collapse <group-id> [true|false|toggle]
  add-current <group-id>
  remove-current
  move <group-id> <window-id> [index]
  ungroup <group-id>
  close <group-id>
  save <group-id>
  saved
  reopen <saved-group-id>
  forget <saved-group-id>`;
}

const [command, ...arguments_] = process.argv.slice(2);
let method;
let params = {};

switch (command) {
  case 'status': method = 'ping'; break;
  case 'list': method = 'listGroups'; break;
  case 'focus':
    method = 'focusGroup';
    params = {groupId: integer(arguments_[0], 'group-id')};
    break;
  case 'create':
    method = 'createGroup';
    params = {title: arguments_.join(' ')};
    break;
  case 'rename':
    method = 'renameGroup';
    params = {groupId: integer(arguments_[0], 'group-id'), title: arguments_.slice(1).join(' ')};
    break;
  case 'color':
    method = 'setGroupColor';
    params = {groupId: integer(arguments_[0], 'group-id'), color: arguments_[1]};
    break;
  case 'collapse':
    method = 'setGroupCollapsed';
    params = {
      groupId: integer(arguments_[0], 'group-id'),
      collapsed: arguments_[1] === undefined || arguments_[1] === 'toggle'
        ? 'toggle'
        : arguments_[1] === 'true',
    };
    break;
  case 'add-current':
    method = 'addCurrentTab';
    params = {groupId: integer(arguments_[0], 'group-id')};
    break;
  case 'remove-current': method = 'removeCurrentTab'; break;
  case 'move':
    method = 'moveGroup';
    params = {
      groupId: integer(arguments_[0], 'group-id'),
      windowId: integer(arguments_[1], 'window-id'),
      index: arguments_[2] === undefined ? -1 : integer(arguments_[2], 'index'),
    };
    break;
  case 'ungroup':
    method = 'ungroupGroup';
    params = {groupId: integer(arguments_[0], 'group-id')};
    break;
  case 'close':
    method = 'closeGroup';
    params = {groupId: integer(arguments_[0], 'group-id')};
    break;
  case 'save':
    method = 'saveGroup';
    params = {groupId: integer(arguments_[0], 'group-id')};
    break;
  case 'saved': method = 'listSavedGroups'; break;
  case 'reopen':
    method = 'openSavedGroup';
    params = {savedGroupId: arguments_[0]};
    break;
  case 'forget':
    method = 'deleteSavedGroup';
    params = {savedGroupId: arguments_[0]};
    break;
  default:
    console.error(usage());
    process.exit(1);
}

try {
  const result = await requestBridge(method, params);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
