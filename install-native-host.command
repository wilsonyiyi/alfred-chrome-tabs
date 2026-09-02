#!/bin/sh
set -eu

bundle_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

if ! command -v node >/dev/null 2>&1; then
  echo "Chrome Tabs requires Node.js 20 or newer."
  echo "Install Node.js, then run this installer again."
  exit 1
fi

node "$bundle_dir/scripts/install-native-host.js"
echo
echo "Native Host installed. Load the extension folder in chrome://extensions."
