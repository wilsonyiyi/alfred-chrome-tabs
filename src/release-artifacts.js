import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';

import {ZipArchive} from 'archiver';

export const ALFRED_WORKFLOW_ASSET = 'Chrome-Tabs.alfredworkflow';
export const CHROME_EXTENSION_ASSET = 'Chrome-Tabs-Bridge.zip';

export async function createZipArchive(sourceDirectory, destinationPath) {
  await fsPromises.mkdir(path.dirname(destinationPath), {recursive: true});

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(destinationPath);
    const archive = new ZipArchive({zlib: {level: 9}});

    output.once('close', () => resolve({bytes: archive.pointer(), destinationPath}));
    output.once('error', reject);
    archive.once('error', reject);
    archive.on('warning', error => {
      if (error.code !== 'ENOENT') {
        reject(error);
      }
    });

    archive.pipe(output);
    archive.directory(sourceDirectory, false);
    void archive.finalize();
  });
}
