import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

test('CI releases versioned workflow and extension assets from main', async () => {
  const [workflow, releaseConfig] = await Promise.all([
    fs.readFile('.github/workflows/ci.yml', 'utf8'),
    fs.readFile('release.config.mjs', 'utf8'),
  ]);

  assert.match(workflow, /pull_request:/u);
  assert.match(workflow, /github\.event_name == 'push'/u);
  assert.match(workflow, /needs: verify/u);
  assert.match(workflow, /fetch-depth: 0/u);
  assert.match(workflow, /contents: write/u);
  assert.match(workflow, /npm run release/u);
  assert.doesNotMatch(workflow, /NPM_TOKEN/u);

  assert.match(releaseConfig, /@semantic-release\/commit-analyzer/u);
  assert.match(releaseConfig, /node scripts\/bump-version\.js \$\{nextRelease\.version\}/u);
  assert.match(releaseConfig, /npm run package:release/u);
  assert.match(releaseConfig, /Chrome-Tabs\.alfredworkflow/u);
  assert.match(releaseConfig, /Chrome-Tabs-Bridge\.zip/u);
  assert.match(releaseConfig, /extension\/manifest\.json/u);
  assert.match(releaseConfig, /@semantic-release\/git/u);

  await assert.rejects(fs.access('.github/workflows/release.yml'));
});
