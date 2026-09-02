import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEVELOPMENT_BUNDLE_ID,
  PRODUCTION_BUNDLE_ID,
  createProductionPlist,
} from '../src/release-package.js';

test('createProductionPlist changes release metadata without mutating the source plist', () => {
  const source = `
<key>bundleid</key><string>${DEVELOPMENT_BUNDLE_ID}</string>
<key>description</key><string>Development description</string>
<key>version</key><string>0.1.0</string>`;

  const release = createProductionPlist(source, {
    description: 'Release description',
    version: '1.2.3',
  });

  assert.match(release, new RegExp(PRODUCTION_BUNDLE_ID.replaceAll('.', '\\.'), 'u'));
  assert.match(release, /<string>Release description<\/string>/u);
  assert.match(release, /<string>1\.2\.3<\/string>/u);
  assert.match(source, new RegExp(DEVELOPMENT_BUNDLE_ID.replaceAll('.', '\\.'), 'u'));
});
