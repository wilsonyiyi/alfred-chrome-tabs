import assert from 'node:assert/strict';
import test from 'node:test';

import {encodeNativeMessage, NativeMessageDecoder} from '../src/bridge/native-protocol.js';

test('NativeMessageDecoder waits for a complete native messaging frame', () => {
  const decoder = new NativeMessageDecoder();
  const frame = encodeNativeMessage({id: 'request-1', method: 'listGroups'});

  assert.deepEqual(decoder.push(frame.subarray(0, 3)), []);
  assert.deepEqual(decoder.push(frame.subarray(3, 8)), []);
  assert.deepEqual(decoder.push(frame.subarray(8)), [{
    id: 'request-1',
    method: 'listGroups',
  }]);
});

test('NativeMessageDecoder returns every complete frame from one chunk', () => {
  const decoder = new NativeMessageDecoder();
  const chunk = Buffer.concat([
    encodeNativeMessage({id: 1}),
    encodeNativeMessage({id: 2}),
  ]);

  assert.deepEqual(decoder.push(chunk), [{id: 1}, {id: 2}]);
});
