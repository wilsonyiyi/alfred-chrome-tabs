export const RECONNECT_ALARM_NAME = 'native-host-reconnect';
export const WATCHDOG_ALARM_NAME = 'native-host-watchdog';

export function createNativeBridgeController({
  chromeApi,
  handlers,
  nativeHostName,
  reconnectDelayMs = 3000,
  watchdogPeriodMinutes = 0.5,
  now = Date.now,
}) {
  let nativePort;
  let reconnectAttempt = 0;
  let bridgeState = {
    status: 'connecting',
    detail: 'Connecting to the native messaging host…',
    updatedAt: now(),
  };

  function setBridgeState(status, detail) {
    bridgeState = {status, detail, updatedAt: now()};
    chromeApi.runtime.sendMessage({type: 'bridgeStatusChanged', state: bridgeState}, () => {
      void chromeApi.runtime.lastError;
    });
  }

  function createReconnectAlarm() {
    void chromeApi.alarms.create(RECONNECT_ALARM_NAME, {
      when: now() + reconnectDelayMs,
    });
  }

  async function ensureWatchdogAlarm() {
    const alarm = await chromeApi.alarms.get(WATCHDOG_ALARM_NAME);
    if (!alarm) {
      await chromeApi.alarms.create(WATCHDOG_ALARM_NAME, {
        periodInMinutes: watchdogPeriodMinutes,
      });
    }
  }

  function scheduleReconnect(detail) {
    setBridgeState('reconnecting', detail || 'Waiting for the native messaging host…');
    createReconnectAlarm();
  }

  function connectNativeHost() {
    if (nativePort) {
      return;
    }

    setBridgeState(
      reconnectAttempt === 0 ? 'connecting' : 'reconnecting',
      reconnectAttempt === 0 ? 'Connecting to the native messaging host…' : 'Retrying the native messaging host…',
    );

    let port;
    try {
      port = chromeApi.runtime.connectNative(nativeHostName);
    } catch (error) {
      reconnectAttempt += 1;
      scheduleReconnect(error.message || 'Unable to start the native messaging host.');
      return;
    }
    nativePort = port;

    port.onMessage.addListener(async request => {
      if (request.type === 'hostReady') {
        reconnectAttempt = 0;
        void chromeApi.alarms.clear(RECONNECT_ALARM_NAME);
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
      reconnectAttempt += 1;
      const detail = chromeApi.runtime.lastError?.message || 'Native messaging host disconnected.';
      setBridgeState('reconnecting', detail);

      // Chrome recommends reconnecting directly from onDisconnect so the
      // service worker remains alive. If that immediate retry also fails, use
      // an Alarm event as a durable wake-up instead of a service-worker timer.
      if (reconnectAttempt === 1) {
        connectNativeHost();
      } else {
        createReconnectAlarm();
      }
    });

    try {
      port.postMessage({type: 'ready'});
    } catch (error) {
      nativePort = undefined;
      reconnectAttempt += 1;
      scheduleReconnect(error.message || 'Unable to contact the native messaging host.');
    }
  }

  function reconnectNativeHost() {
    void chromeApi.alarms.clear(RECONNECT_ALARM_NAME);
    reconnectAttempt += 1;
    const previousPort = nativePort;
    nativePort = undefined;
    previousPort?.disconnect();
    connectNativeHost();
  }

  function handleRuntimeMessage(message, _sender, sendResponse) {
    if (message.type === 'getBridgeStatus') {
      connectNativeHost();
      sendResponse({state: bridgeState});
      return;
    }
    if (message.type === 'reconnectNativeHost') {
      reconnectNativeHost();
      sendResponse({state: bridgeState});
    }
  }

  function handleAlarm(alarm) {
    if (alarm.name === RECONNECT_ALARM_NAME || alarm.name === WATCHDOG_ALARM_NAME) {
      connectNativeHost();
    }
  }

  function start() {
    chromeApi.runtime.onMessage.addListener(handleRuntimeMessage);
    chromeApi.alarms.onAlarm.addListener(handleAlarm);
    void ensureWatchdogAlarm();
    connectNativeHost();
  }

  return {
    getState: () => bridgeState,
    start,
  };
}
