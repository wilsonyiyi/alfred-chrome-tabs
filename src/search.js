import alfy from 'alfy';

import {requestBridge} from './bridge/client.js';
import {listChromeTabs} from './chrome.js';
import {buildUnifiedSearchItems, parseSearchQuery} from './search-items.js';

function bridgeHint() {
  return {
    title: 'Tab groups and history need the Chrome Tabs Bridge',
    subtitle: 'Load the extension and run npm run bridge:install.',
    valid: false,
  };
}

async function fallbackTabItems(scope, query, error) {
  if (scope === 'groups' || scope === 'history') {
    return [{
      title: scope === 'groups'
        ? 'Chrome Tab Groups bridge is unavailable'
        : 'Chrome History bridge is unavailable',
      subtitle: error instanceof Error ? error.message : String(error),
      valid: false,
    }];
  }

  try {
    const {running, tabs} = await listChromeTabs();
    if (!running) {
      return [{
        title: 'Google Chrome is not running',
        subtitle: 'Open Chrome, then run Chrome Tabs again.',
        valid: false,
      }];
    }

    return [...buildUnifiedSearchItems({tabs, groups: [], history: [], scope, query}), bridgeHint()];
  } catch (fallbackError) {
    return [{
      title: 'Could not search Chrome tabs',
      subtitle: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
      valid: false,
    }];
  }
}

const {scope, query} = parseSearchQuery(alfy.input);
const includeHistory = scope === 'history' || (scope === 'all' && Boolean(query));

try {
  const result = await requestBridge('searchAll', {
    text: query,
    includeHistory,
    maxResults: 50,
  });
  alfy.output(buildUnifiedSearchItems({
    ...result,
    scope,
    query,
  }));
} catch (error) {
  alfy.output(await fallbackTabItems(scope, query, error));
}
