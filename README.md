# Chrome Tabs

Search and manage Google Chrome tabs and tab groups from Alfred.

## Install

- [Download Chrome Tabs for Alfred](https://github.com/wilsonyiyi/alfred-chrome-tabs/releases/latest/download/Chrome-Tabs.alfredworkflow)
- [Download the Chrome Tabs Bridge extension](https://github.com/wilsonyiyi/alfred-chrome-tabs/releases/latest/download/Chrome-Tabs-Bridge.zip)

Install the Alfred workflow first. Then extract the Bridge download, run `install-native-host.command`, and load its `extension` directory as an unpacked extension from `chrome://extensions`.

The first development milestone provides a fast `ct` command that:

- reads every open Chrome tab in one JXA batch;
- lets Alfred filter the in-memory result as you type;
- focuses the selected Chrome window and tab with Return.

Alfy's legacy update-notification process is disabled. Dependency overrides keep its bundled plist parser and process launcher on maintained versions.

Tab group management uses a separate Chrome extension bridge because Chrome's Apple Events interface does not expose the `chrome.tabGroups` API.

Tab Groups are available through the bundled Chrome extension and native bridge:

- `cg`: search and focus groups;
- `⌥↩`: collapse or expand;
- `⇧↩`: add the current tab;
- `⌃↩`: ungroup without closing tabs;
- `⌘↩`: close the whole group;
- `cg new`: choose a color, then create a group from the current tab;
- `cg new <name>`: create a grey group directly;
- `cg new <color> <name>`: create a group with an explicit Chrome color;
- `cg color`: choose an existing group and change its color.

The Chrome toolbar popup shows the extension version and live Native Messaging bridge state. When the host is unavailable, it displays the Chrome error and offers a manual retry.

## Requirements

- macOS
- Alfred 4+ with Powerpack
- Google Chrome
- Node.js 20+

## Development

Install dependencies:

```sh
npm install
```

Install the native host, then load the `extension` directory as an unpacked extension from `chrome://extensions`:

```sh
npm run bridge:install
npm run bridge:doctor
```

All Tab Group bridge commands are also available from the terminal:

```sh
npm run tabgroup -- list
npm run tabgroup -- focus 123
npm run tabgroup -- create Work
npm run tabgroup -- rename 123 Research
npm run tabgroup -- color 123 purple
npm run tabgroup -- collapse 123 toggle
npm run tabgroup -- add-current 123
npm run tabgroup -- remove-current
npm run tabgroup -- move 123 456 -1
npm run tabgroup -- ungroup 123
npm run tabgroup -- close 123
```

The repository source uses the development bundle ID `com.wilsonyiyi.alfred-chrome-tabs.dev`. The installed release keeps `com.wilsonyiyi.alfred-chrome-tabs`.

The source `info.plist` is always the complete development workflow. `npm run build:release` creates a separate production copy under `.release/package` and changes only that copy to the production bundle ID. Validation prevents an empty Alfred canvas or production plist from replacing the development source unnoticed.

Switch the installed Alfred workflow slot to this local source:

```sh
npm run dev
```

Inspect or restore the workflow slot:

```sh
npm run mode
npm run doctor
npm run prod
```

Run the project checks:

```sh
npm run check
```

Build the production package without changing the development plist:

```sh
npm run build:release
```

Build both distributable release assets:

```sh
npm run package:release
```

Pushing a version tag matching `package.json` (for example `v0.1.0`) creates a GitHub Release containing `Chrome-Tabs.alfredworkflow` and `Chrome-Tabs-Bridge.zip`.

## Architecture

```text
Alfred Script Filter
  -> alfy JSON output
  -> one osascript/JXA batch read
  -> Alfred native filtering

Selected result
  -> one osascript/JXA focus action
  -> Google Chrome

Tab Group command
  -> local Unix socket
  -> Chrome Native Messaging host
  -> bundled Manifest V3 extension
  -> chrome.tabGroups / chrome.tabs APIs
```

## License

MIT
