import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createNativeBridgeController,
  RECONNECT_ALARM_NAME,
  WATCHDOG_ALARM_NAME,
} from '../extension/native-bridge.js';

class FakeEvent {
  listeners = [];

  addListener(listener) {
    this.listeners.push(listener);
  }

  emit(...args) {
    for (const listener of this.listeners) {
      listener(...args);
    }
  }
}

function createPort() {
  return {
    disconnected: false,
    messages: [],
    onDisconnect: new FakeEvent(),
    onMessage: new FakeEvent(),
    disconnect() {
      this.disconnected = true;
      this.onDisconnect.emit();
    },
    postMessage(message) {
      this.messages.push(message);
    },
  };
}

function createChromeApi() {
  const alarms = new Map();
  const ports = [];
  const runtimeMessages = [];
  const api = {
    alarms: {
      onAlarm: new FakeEvent(),
      async clear(name) {
        return alarms.delete(name);
      },
      async create(name, options) {
        alarms.set(name, {name, ...options});
      },
      async get(name) {
        return alarms.get(name);
      },
    },
    runtime: {
      lastError: undefined,
      onMessage: new FakeEvent(),
      connectNative() {
        const port = createPort();
        ports.push(port);
        return port;
      },
      sendMessage(message, callback) {
        runtimeMessages.push(message);
        callback?.();
      },
    },
  };

  return {alarms, api, ports, runtimeMessages};
}

test('native bridge reconnects immediately once, then uses an Alarm watchdog', async () => {
  const {alarms, api, ports} = createChromeApi();
  const controller = createNativeBridgeController({
    chromeApi: api,
    handlers: {},
    nativeHostName: 'com.example.host',
    now: () => 1000,
  });

  controller.start();
  await Promise.resolve();

  assert.equal(ports.length, 1);
  assert.deepEqual(ports[0].messages, [{type: 'ready'}]);
  assert.equal(alarms.get(WATCHDOG_ALARM_NAME).periodInMinutes, 0.5);

  ports[0].onMessage.emit({type: 'hostReady'});
  assert.equal(controller.getState().status, 'connected');

  api.runtime.lastError = {message: 'Native host exited'};
  ports[0].onDisconnect.emit();
  assert.equal(ports.length, 2);
  assert.equal(controller.getState().status, 'reconnecting');

  ports[1].onDisconnect.emit();
  assert.equal(ports.length, 2);
  assert.equal(alarms.get(RECONNECT_ALARM_NAME).when, 4000);

  api.alarms.onAlarm.emit({name: RECONNECT_ALARM_NAME});
  assert.equal(ports.length, 3);
});

test('reading popup status ensures a missing native connection is started', () => {
  const {api, ports} = createChromeApi();
  const controller = createNativeBridgeController({
    chromeApi: api,
    handlers: {},
    nativeHostName: 'com.example.host',
  });
  controller.start();

  ports[0].disconnect();
  ports[1].disconnect();
  let response;
  api.runtime.onMessage.emit({type: 'getBridgeStatus'}, {}, value => {
    response = value;
  });

  assert.equal(ports.length, 3);
  assert.equal(response.state.status, 'reconnecting');
});
