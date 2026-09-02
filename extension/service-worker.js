import {createTabGroupHandlers} from './tab-groups.js';

const NATIVE_HOST_NAME = 'com.wilsonyiyi.alfred_chrome_tabs';
const handlers = createTabGroupHandlers(chrome);
const RECONNECT_DELAY_MS = 3000;
let nativePort;
let reconnectTimer;
let reconnectAttempt = 0;
let bridgeState = {
  status: 'connecting',
  detail: 'Connecting to the native messaging host…',
  updatedAt: Date.now(),
};

function setBridgeState(status, detail) {
  bridgeState = {status, detail, updatedAt: Date.now()};
  chrome.runtime.sendMessage({type: 'bridgeStatusChanged', state: bridgeState}, () => {
    void chrome.runtime.lastError;
  });
}

function scheduleReconnect(detail) {
  reconnectAttempt += 1;
  setBridgeState('reconnecting', detail || 'Waiting for the native messaging host…');
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connectNativeHost, RECONNECT_DELAY_MS);
}

function connectNativeHost() {
  clearTimeout(reconnectTimer);
  setBridgeState(
    reconnectAttempt === 0 ? 'connecting' : 'reconnecting',
    reconnectAttempt === 0 ? 'Connecting to the native messaging host…' : 'Retrying the native messaging host…',
  );

  const port = chrome.runtime.connectNative(NATIVE_HOST_NAME);
  nativePort = port;

  port.onMessage.addListener(async request => {
    if (request.type === 'hostReady') {
      reconnectAttempt = 0;
      setBridgeState('connected', 'Native messaging host is ready.');
      return;
    }

    const handler = handlers[request.method];
    if (!handler) {
      port.postMessage({id: request.id, error: {code: 'UNKNOWN_METHOD', message: `Unknown method: ${request.method}`}});
      return;
    }

    try {
      const result = await handler(request.params ?? {});
      port.postMessage({id: request.id, result});
    } catch (error) {
      port.postMessage({
        id: request.id,
        error: {code: error.code ?? 'CHROME_API_ERROR', message: error.message ?? String(error)},
      });
    }
  });

  port.onDisconnect.addListener(() => {
    if (nativePort !== port) {
      return;
    }
    nativePort = undefined;
    scheduleReconnect(chrome.runtime.lastError?.message || 'Native messaging host disconnected.');
  });

  port.postMessage({type: 'ready'});
}

function reconnectNativeHost() {
  clearTimeout(reconnectTimer);
  reconnectAttempt += 1;
  const previousPort = nativePort;
  nativePort = undefined;
  previousPort?.disconnect();
  connectNativeHost();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'getBridgeStatus') {
    sendResponse({state: bridgeState});
    return;
  }
  if (message.type === 'reconnectNativeHost') {
    reconnectNativeHost();
    sendResponse({state: bridgeState});
  }
});

connectNativeHost();
