import alfy from 'alfy';

import {requestBridge} from './bridge/client.js';
import {buildHistoryItems} from './history-items.js';

try {
  const historyItems = await requestBridge('searchHistory', {
    text: alfy.input,
    maxResults: 50,
  });
  const items = buildHistoryItems(historyItems);

  alfy.output(items.length > 0 ? items : [{
    title: 'No matching Chrome history found',
    subtitle: 'Try a different title or URL.',
    valid: false,
  }]);
} catch (error) {
  const permissionRequired = error.code === 'HISTORY_PERMISSION_REQUIRED';
  alfy.output([{
    title: permissionRequired ? 'Enable Chrome History Search' : 'Chrome History bridge is unavailable',
    subtitle: permissionRequired
      ? 'Open the Chrome Tabs extension popup and click Enable.'
      : error.message,
    valid: false,
  }]);
}
