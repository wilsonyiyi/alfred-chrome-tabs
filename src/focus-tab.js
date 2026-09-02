import {focusChromeTab} from './chrome.js';

const selection = JSON.parse(process.argv[2] ?? '{}');
await focusChromeTab(selection);
