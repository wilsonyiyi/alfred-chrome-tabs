# Chrome Tabs Bridge

## Release package

1. Extract `Chrome-Tabs-Bridge.zip`.
2. Move the extracted directory to a stable location.
3. Run `install-native-host.command` from that directory.
4. Open `chrome://extensions` in Google Chrome.
5. Enable Developer mode.
6. Choose **Load unpacked** and select its `extension` directory.

The installer copies the Native Host runtime into your Application Support directory. Keep the unpacked `extension` directory in place because Chrome loads the extension from that location.

The open Native Messaging port keeps the extension service worker active. If the Native Host exits, the extension retries immediately and a 30-second Chrome Alarm watchdog keeps retrying even if the service worker has gone dormant.

## Development checkout

Run `npm run bridge:install` from the project root, then load the local `extension` directory from `chrome://extensions`.

The stable unpacked extension ID is `pnijllofmjhihmehpghppmepkofeimma`.
