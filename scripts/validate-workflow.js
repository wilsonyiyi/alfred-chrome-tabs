#!/usr/bin/env node

import fs from 'node:fs';
import plist from 'plist';

import {
  EXTENSION_ID,
  EXTENSION_ORIGIN,
  NATIVE_HOST_NAME,
} from '../src/bridge/constants.js';
import {DEVELOPMENT_BUNDLE_ID} from '../src/release-package.js';

const SCRIPT_FILTER_UID = '1B3C0780-4C03-47CF-8C08-A47D95EA26B6';
const FOCUS_ACTION_UID = '21862161-A26D-43B3-89E9-C55E61C68E4F';
const GROUP_FILTER_UID = '5CF0B408-6BB4-4B0C-99A1-0B283EFF1CFB';
const GROUP_ACTION_UID = '1028D1F9-AD5E-4B7E-984A-9F2978D8F101';
const HISTORY_FILTER_UID = 'C6A5EC49-0E70-4005-B9FE-BE4BE3151A2D';
const HISTORY_ACTION_UID = '60D78AE9-CEB9-4339-A65D-9E5826AEDA94';
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const extensionManifest = JSON.parse(fs.readFileSync('extension/manifest.json', 'utf8'));
const serviceWorker = fs.readFileSync('extension/service-worker.js', 'utf8');
const nativeBridge = fs.readFileSync('extension/native-bridge.js', 'utf8');
const historyBridge = fs.readFileSync('extension/history.js', 'utf8');
const popupHtml = fs.readFileSync('extension/popup.html', 'utf8');
const nativeHostInstaller = fs.readFileSync('scripts/install-native-host.js', 'utf8');
const workflow = plist.parse(fs.readFileSync('info.plist', 'utf8'));
const scriptFilter = workflow.objects?.find(object => object.uid === SCRIPT_FILTER_UID);
const focusAction = workflow.objects?.find(object => object.uid === FOCUS_ACTION_UID);
const focusConnection = workflow.connections?.[SCRIPT_FILTER_UID]?.some(connection => (
  connection.destinationuid === FOCUS_ACTION_UID
));
const groupFilter = workflow.objects?.find(object => object.uid === GROUP_FILTER_UID);
const groupAction = workflow.objects?.find(object => object.uid === GROUP_ACTION_UID);
const historyFilter = workflow.objects?.find(object => object.uid === HISTORY_FILTER_UID);
const historyAction = workflow.objects?.find(object => object.uid === HISTORY_ACTION_UID);
const connectsToGroupAction = uid => workflow.connections?.[uid]?.some(connection => (
  connection.destinationuid === GROUP_ACTION_UID
));
const connectsToHistoryAction = workflow.connections?.[HISTORY_FILTER_UID]?.some(connection => (
  connection.destinationuid === HISTORY_ACTION_UID
));

if (
  workflow.bundleid !== DEVELOPMENT_BUNDLE_ID
  || workflow.name !== 'Chrome Tabs'
  || workflow.description !== packageJson.description
  || workflow.version !== packageJson.version
) {
  throw new Error('Development workflow metadata does not match package.json');
}

if (
  scriptFilter?.type !== 'alfred.workflow.input.scriptfilter'
  || scriptFilter.config.keyword !== 'c1'
  || scriptFilter.config.alfredfiltersresults !== true
  || scriptFilter.config.script !== './node_modules/.bin/run-node index.js "$1"'
) {
  throw new Error('The c1 Script Filter is missing or incorrectly configured');
}

if (
  focusAction?.type !== 'alfred.workflow.action.script'
  || focusAction.config.script !== './node_modules/.bin/run-node src/focus-tab.js "$1"'
  || !focusConnection
) {
  throw new Error('The Chrome tab focus action is missing or disconnected');
}

if (
  groupFilter?.config.keyword !== 'c2'
  || groupFilter.config.alfredfiltersresults !== false
  || groupFilter.config.script !== './node_modules/.bin/run-node src/list-groups.js "$1"'
  || !connectsToGroupAction(GROUP_FILTER_UID)
) {
  throw new Error('The c2 Tab Groups filter is missing or disconnected');
}

if (
  groupAction?.config.script !== './node_modules/.bin/run-node src/group-action.js "$1"'
  || workflow.objects?.some(object => ['tg', 'tgnew'].includes(object.config?.keyword))
) {
  throw new Error('The unified c2 actions or retired tg keywords are incorrectly configured');
}

if (
  historyFilter?.config.keyword !== 'c3'
  || historyFilter.config.alfredfiltersresults !== false
  || historyFilter.config.script !== './node_modules/.bin/run-node src/list-history.js "$1"'
  || historyAction?.config.script !== './node_modules/.bin/run-node src/history-action.js "$1"'
  || !connectsToHistoryAction
) {
  throw new Error('The c3 Chrome History filter is missing or disconnected');
}

if (
  extensionManifest.manifest_version !== 3
  || extensionManifest.version !== packageJson.version
  || extensionManifest.background?.service_worker !== 'service-worker.js'
  || extensionManifest.action?.default_popup !== 'popup.html'
  || Number(extensionManifest.minimum_chrome_version) < 120
  || !extensionManifest.permissions?.includes('alarms')
  || !extensionManifest.permissions?.includes('nativeMessaging')
  || !extensionManifest.permissions?.includes('tabGroups')
  || !extensionManifest.permissions?.includes('tabs')
  || !extensionManifest.optional_permissions?.includes('history')
) {
  throw new Error('The Chrome extension manifest is missing required Tab Groups bridge settings');
}

if (
  !popupHtml.includes('role="status"')
  || !popupHtml.includes('aria-live="polite"')
  || !popupHtml.includes('id="version"')
  || !popupHtml.includes('id="history-permission"')
  || !popupHtml.includes('href="https://github.com/wilsonyiyi/alfred-chrome-tabs#chrome-tabs"')
  || !popupHtml.includes('>Documentation</a>')
  || popupHtml.includes('Manifest V3')
  || !popupHtml.includes('src="icons/icon-48.png"')
  || extensionManifest.icons?.['128'] !== 'icons/icon-128.png'
  || extensionManifest.action?.default_icon?.['32'] !== 'icons/icon-32.png'
) {
  throw new Error('The Chrome extension popup is missing its icon, accessible status, or version output');
}

if (
  !serviceWorker.includes(`const NATIVE_HOST_NAME = '${NATIVE_HOST_NAME}'`)
  || !serviceWorker.includes('createHistoryHandlers(chrome)')
  || !historyBridge.includes('chromeApi.history.search')
  || !historyBridge.includes('HISTORY_PERMISSION_REQUIRED')
  || !nativeBridge.includes('chromeApi.alarms.onAlarm.addListener(handleAlarm)')
  || !nativeBridge.includes('port.onDisconnect.addListener')
  || !nativeHostInstaller.includes('allowed_origins: [EXTENSION_ORIGIN]')
  || EXTENSION_ORIGIN !== `chrome-extension://${EXTENSION_ID}/`
) {
  throw new Error('The Chrome extension and native host identities are inconsistent');
}

console.log('Workflow, extension, and native bridge structure are valid.');
