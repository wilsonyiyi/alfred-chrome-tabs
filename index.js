import alfy from 'alfy';

import {listChromeTabs} from './src/chrome.js';
import {buildTabItems} from './src/items.js';

try {
  const {running, tabs} = await listChromeTabs();

  if (!running) {
    alfy.output([{
      title: 'Google Chrome is not running',
      subtitle: 'Open Chrome, then run Chrome Tabs again.',
      valid: false,
    }]);
  } else if (tabs.length === 0) {
    alfy.output([{
      title: 'No Chrome tabs found',
      valid: false,
    }]);
  } else {
    alfy.output(buildTabItems(tabs));
  }
} catch (error) {
  alfy.output([{
    title: 'Could not read Chrome tabs',
    subtitle: error instanceof Error ? error.message : String(error),
    valid: false,
  }]);
}
