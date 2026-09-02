import {createTabGroupHandlers} from './tab-groups.js';
import {createNativeBridgeController} from './native-bridge.js';

const NATIVE_HOST_NAME = 'com.wilsonyiyi.alfred_chrome_tabs';
const handlers = createTabGroupHandlers(chrome);
const bridgeController = createNativeBridgeController({
  chromeApi: chrome,
  handlers,
  nativeHostName: NATIVE_HOST_NAME,
});

bridgeController.start();
