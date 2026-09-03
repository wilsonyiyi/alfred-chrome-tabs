import alfy from 'alfy';

import {requestBridge} from './bridge/client.js';
import {buildGroupCommandItems} from './group-items.js';

function isUnknownMethod(error) {
  return error?.code === 'UNKNOWN_METHOD'
    || /unknown method/iu.test(String(error?.message ?? ''));
}

function savedGroupsUnavailableItem(error) {
  if (isUnknownMethod(error)) {
    return {
      title: 'Reload Chrome Tabs Bridge to enable saved groups',
      subtitle: 'Open chrome://extensions → Reload “Chrome Tabs Bridge”, then save again with ⌘⌥↩.',
      valid: false,
    };
  }

  return {
    title: 'Could not load saved tab groups',
    subtitle: error instanceof Error ? error.message : String(error),
    valid: false,
  };
}

try {
  const groups = await requestBridge('listGroups');
  let savedGroups = [];
  let savedGroupsWarning;

  try {
    savedGroups = await requestBridge('listSavedGroups');
  } catch (error) {
    savedGroupsWarning = savedGroupsUnavailableItem(error);
  }

  const items = buildGroupCommandItems(groups, alfy.input, {savedGroups});
  alfy.output(savedGroupsWarning ? [savedGroupsWarning, ...items] : items);
} catch (error) {
  alfy.output([{
    title: 'Chrome Tab Groups bridge is unavailable',
    subtitle: error.message,
    valid: false,
  }]);
}
