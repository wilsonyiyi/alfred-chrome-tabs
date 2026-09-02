import assert from 'node:assert/strict';
import test from 'node:test';

import {buildTabItems} from '../src/items.js';

test('buildTabItems creates Alfred filter items without filtering the Chrome result', () => {
  const items = buildTabItems([{
    windowIndex: 1,
    tabIndex: 2,
    title: 'Example documentation',
    url: 'https://example.com/docs/',
  }]);

  assert.deepEqual(items, [{
    uid: '1:2',
    title: 'Example documentation',
    subtitle: 'example.com/docs',
    match: 'Example documentation example.com/docs',
    arg: '{"windowIndex":1,"tabIndex":2}',
    autocomplete: 'Example documentation',
  }]);
});

test('buildTabItems supplies a fallback title for untitled tabs', () => {
  const [item] = buildTabItems([{
    windowIndex: 0,
    tabIndex: 0,
    title: '',
    url: 'chrome://newtab/',
  }]);

  assert.equal(item.title, 'Untitled tab');
  assert.equal(item.subtitle, 'chrome://newtab');
});

test('buildTabItems removes invisible formatting characters from Chrome titles', () => {
  const [item] = buildTabItems([{
    windowIndex: 0,
    tabIndex: 1,
    title: '\u200B\u2062\uFEFFProject docs',
    url: 'https://example.com',
  }]);

  assert.equal(item.title, 'Project docs');
  assert.equal(item.match, 'Project docs example.com');
});
