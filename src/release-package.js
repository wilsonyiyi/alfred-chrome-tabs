import fs from 'node:fs/promises';
import path from 'node:path';

export const DEVELOPMENT_BUNDLE_ID = 'com.wilsonyiyi.alfred-chrome-tabs.dev';
export const PRODUCTION_BUNDLE_ID = 'com.wilsonyiyi.alfred-chrome-tabs';

function replacePlistString(source, key, value) {
  const pattern = new RegExp(`(<key>${key}<\\/key>\\s*<string>)[^<]*(<\\/string>)`, 'u');
  if (!pattern.test(source)) {
    throw new Error(`Missing ${key} in info.plist`);
  }

  return source.replace(pattern, `$1${value}$2`);
}

export function createProductionPlist(source, packageJson) {
  let result = replacePlistString(source, 'bundleid', PRODUCTION_BUNDLE_ID);
  result = replacePlistString(result, 'description', packageJson.description);
  return replacePlistString(result, 'version', packageJson.version);
}

const RELEASE_ENTRIES = [
  'LICENSE',
  'README.md',
  'index.js',
  'icon.png',
  'info.plist',
  'install-native-host.command',
  'package-lock.json',
  'package.json',
  'extension',
  'scripts',
  'src',
];

export async function buildReleasePackage({sourceRoot, destinationRoot}) {
  const packageJson = JSON.parse(
    await fs.readFile(path.join(sourceRoot, 'package.json'), 'utf8'),
  );

  await fs.rm(destinationRoot, {force: true, recursive: true});
  await fs.mkdir(destinationRoot, {recursive: true});

  for (const entry of RELEASE_ENTRIES) {
    const source = path.join(sourceRoot, entry);
    const destination = path.join(destinationRoot, entry);
    await fs.mkdir(path.dirname(destination), {recursive: true});
    await fs.cp(source, destination, {recursive: true});
  }

  const plistPath = path.join(destinationRoot, 'info.plist');
  const plist = await fs.readFile(plistPath, 'utf8');
  await fs.writeFile(plistPath, createProductionPlist(plist, packageJson), 'utf8');

  return {destinationRoot, plistPath};
}
