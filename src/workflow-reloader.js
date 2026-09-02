import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const execFileAsync = promisify(execFile);
const ALFRED_APPLICATION_ID = 'com.runningwithcrayons.Alfred';

export function createReloadScript(bundleId) {
  const normalizedBundleId = String(bundleId ?? '').trim();
  if (!normalizedBundleId) {
    throw new TypeError('A workflow bundle ID is required');
  }

  return `Application(${JSON.stringify(ALFRED_APPLICATION_ID)}).reloadWorkflow(${JSON.stringify(normalizedBundleId)});`;
}

export async function reloadWorkflow(bundleId, execute = execFileAsync) {
  await execute('/usr/bin/osascript', [
    '-l',
    'JavaScript',
    '-e',
    createReloadScript(bundleId),
  ]);
}
