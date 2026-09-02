import os from 'node:os';
import path from 'node:path';

function runtimeHomeDirectory() {
  return process.env.ALFRED_CHROME_TABS_HOME || os.homedir();
}

export function bridgeDirectory(homeDirectory = runtimeHomeDirectory()) {
  return path.join(
    homeDirectory,
    'Library',
    'Caches',
    'com.wilsonyiyi.alfred-chrome-tabs',
  );
}

export function bridgeSocketPath(homeDirectory = runtimeHomeDirectory()) {
  return path.join(bridgeDirectory(homeDirectory), 'bridge.sock');
}

export function nativeHostDirectory(homeDirectory = runtimeHomeDirectory()) {
  return path.join(
    homeDirectory,
    'Library',
    'Application Support',
    'alfred-chrome-tabs',
  );
}

export function nativeHostManifestPath(homeDirectory = runtimeHomeDirectory()) {
  return path.join(
    homeDirectory,
    'Library',
    'Application Support',
    'Google',
    'Chrome',
    'NativeMessagingHosts',
    'com.wilsonyiyi.alfred_chrome_tabs.json',
  );
}
