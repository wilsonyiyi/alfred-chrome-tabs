import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import {promisify} from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);

test('native host installer copies a self-contained runtime', async t => {
  const temporaryHome = await fs.mkdtemp('/tmp/alfred-ct-installer-');
  t.after(() => fs.rm(temporaryHome, {recursive: true, force: true}));

  await execFileAsync(process.execPath, ['scripts/install-native-host.js'], {
    env: {...process.env, ALFRED_CHROME_TABS_HOME: temporaryHome},
  });

  const supportDirectory = path.join(
    temporaryHome,
    'Library',
    'Application Support',
    'alfred-chrome-tabs',
  );
  const manifest = JSON.parse(await fs.readFile(path.join(
    temporaryHome,
    'Library',
    'Application Support',
    'Google',
    'Chrome',
    'NativeMessagingHosts',
    'com.wilsonyiyi.alfred_chrome_tabs.json',
  ), 'utf8'));
  const runtimePackage = JSON.parse(await fs.readFile(
    path.join(supportDirectory, 'runtime', 'package.json'),
    'utf8',
  ));
  const wrapper = await fs.readFile(path.join(supportDirectory, 'native-host.sh'), 'utf8');

  assert.equal(runtimePackage.type, 'module');
  assert.match(wrapper, /runtime\/native-host\.js/u);
  assert.equal(manifest.path, path.join(supportDirectory, 'native-host.sh'));
});
