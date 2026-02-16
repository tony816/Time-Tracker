const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const scriptPath = path.join(__dirname, '..', 'script.js');
const serverPath = path.join(__dirname, '..', 'server.js');
const scriptSource = fs.readFileSync(scriptPath, 'utf8');
const serverSource = fs.readFileSync(serverPath, 'utf8');

test('server dotenv bootstrap is guarded for MODULE_NOT_FOUND', () => {
  assert.match(serverSource, /require\('dotenv'\)\.config\(\)/);
  assert.match(serverSource, /MODULE_NOT_FOUND/);
});

test('script has merge-key normalization guard', () => {
  const start = scriptSource.indexOf('normalizeMergeKey(rawMergeKey');
  assert.ok(start >= 0, 'normalizeMergeKey() should exist');
  const snippet = scriptSource.slice(start, start + 700);
  assert.match(snippet, /\^\(planned\|actual\|time\)-\(\\d\+\)-\(\\d\+\)\$/);
  assert.match(snippet, /end >= this\.timeSlots\.length/);
});

test('updateRunningTimers handles date rollover by transitioning to today', () => {
  const start = scriptSource.indexOf('updateRunningTimers()');
  assert.ok(start >= 0, 'updateRunningTimers() should exist');
  const snippet = scriptSource.slice(start, start + 1200);
  assert.match(snippet, /this\.lastKnownTodayDate !== today/);
  assert.match(snippet, /this\.transitionToDate\(today\)/);
});

test('server serves split bootstrap/core/infra/css static files', () => {
  assert.match(serverSource, /'\/styles\.css':\s*'styles\.css'/);
  assert.match(serverSource, /'\/styles\/foundation\.css':\s*'styles\/foundation\.css'/);
  assert.match(serverSource, /'\/styles\/modal\.css':\s*'styles\/modal\.css'/);
  assert.match(serverSource, /'\/styles\/interactions\.css':\s*'styles\/interactions\.css'/);
  assert.match(serverSource, /'\/styles\/responsive\.css':\s*'styles\/responsive\.css'/);
  assert.match(serverSource, /'\/main\.js':\s*'main\.js'/);
  assert.match(serverSource, /'\/core\/time-core\.js':\s*'core\/time-core\.js'/);
  assert.match(serverSource, /'\/infra\/storage-adapter\.js':\s*'infra\/storage-adapter\.js'/);
  assert.match(serverSource, /'\/controllers\/timer-controller\.js':\s*'controllers\/timer-controller\.js'/);
  assert.match(serverSource, /'\/ui\/time-entry-renderer\.js':\s*'ui\/time-entry-renderer\.js'/);
});
