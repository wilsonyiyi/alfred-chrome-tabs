# Chrome Tabs Bridge

## Release package

1. Extract `Chrome-Tabs-Bridge.zip`.
2. Run `install-native-host.command` from the extracted directory.
3. Open `chrome://extensions` in Google Chrome.
4. Enable Developer mode.
5. Choose **Load unpacked** and select the extracted `extension` directory.

The installer copies the Native Host runtime into your Application Support directory, so the extracted download can be moved or removed after installation.

## Development checkout

Run `npm run bridge:install` from the project root, then load the local `extension` directory from `chrome://extensions`.

The stable unpacked extension ID is `pnijllofmjhihmehpghppmepkofeimma`.
