const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const scriptPath = path.join(__dirname, '..', 'script.js');
const source = fs.readFileSync(scriptPath, 'utf8');

test('transitionToDate commits timers before switching currentDate', () => {
  const fnStart = source.indexOf('transitionToDate(nextDate)');
  assert.ok(fnStart >= 0, 'transitionToDate function should exist');

  const slice = source.slice(fnStart, fnStart + 1800);
  const commitIdx = slice.indexOf('this.commitRunningTimers');
  const persistIdx = slice.indexOf('this.persistSnapshotForDate(previousDate');
  const switchIdx = slice.indexOf('this.currentDate = targetDate');

  assert.ok(commitIdx >= 0, 'should commit running timers in transitionToDate');
  assert.ok(switchIdx >= 0, 'should switch currentDate in transitionToDate');
  assert.ok(commitIdx < switchIdx, 'timer commit must happen before currentDate switch');
  assert.ok(persistIdx >= 0 && persistIdx < switchIdx, 'snapshot persistence should happen before currentDate switch');
});
