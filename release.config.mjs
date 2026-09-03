export default {
  branches: ['main'],
  tagFormat: 'v${version}',
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    [
      '@semantic-release/exec',
      {
        prepareCmd: 'node scripts/bump-version.js ${nextRelease.version} && npm run package:release',
      },
    ],
    [
      '@semantic-release/github',
      {
        assets: [
          {
            label: 'Install Chrome Tabs for Alfred',
            path: '.release/artifacts/Chrome-Tabs.alfredworkflow',
          },
          {
            label: 'Download Chrome Tabs Bridge',
            path: '.release/artifacts/Chrome-Tabs-Bridge.zip',
          },
        ],
        failComment: false,
        successComment: false,
      },
    ],
    [
      '@semantic-release/git',
      {
        assets: [
          'package.json',
          'package-lock.json',
          'info.plist',
          'extension/manifest.json',
        ],
        message: 'chore(release): ${nextRelease.version} [skip ci]',
      },
    ],
  ],
};
