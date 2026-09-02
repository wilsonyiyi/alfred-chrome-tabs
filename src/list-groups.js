import alfy from 'alfy';

import {requestBridge} from './bridge/client.js';
import {buildGroupCommandItems} from './group-items.js';

try {
  const groups = await requestBridge('listGroups');
  alfy.output(buildGroupCommandItems(groups, alfy.input));
} catch (error) {
  alfy.output([{
    title: 'Chrome Tab Groups bridge is unavailable',
    subtitle: error.message,
    valid: false,
  }]);
}
