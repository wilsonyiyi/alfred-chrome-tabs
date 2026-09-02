import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

const execFileAsync = promisify(execFile);
const listTabsScript = fileURLToPath(new URL('../scripts/list-tabs.js', import.meta.url));
const focusTabScript = fileURLToPath(new URL('../scripts/focus-tab.js', import.meta.url));

async function runJxa(scriptPath, arguments_ = []) {
  const {stdout} = await execFileAsync(
    '/usr/bin/osascript',
    ['-l', 'JavaScript', scriptPath, ...arguments_.map(String)],
    {maxBuffer: 10 * 1024 * 1024},
  );

  return stdout.trim();
}

export async function listChromeTabs() {
  const output = await runJxa(listTabsScript);
  return JSON.parse(output);
}

export async function focusChromeTab({windowIndex, tabIndex}) {
  if (!Number.isInteger(windowIndex) || windowIndex < 0) {
    throw new TypeError('windowIndex must be a non-negative integer');
  }

  if (!Number.isInteger(tabIndex) || tabIndex < 0) {
    throw new TypeError('tabIndex must be a non-negative integer');
  }

  await runJxa(focusTabScript, [windowIndex, tabIndex]);
}
