import {requestBridge} from './bridge/client.js';
import {focusChromeTab} from './chrome.js';

const action = JSON.parse(process.argv[2] ?? '{}');
if (typeof action.method !== 'string') {
  throw new TypeError('A Chrome Tabs action is required');
}

if (action.method === 'focusTabByIndex') {
  await focusChromeTab(action.params ?? {});
} else {
  await requestBridge(action.method, action.params ?? {});
}
