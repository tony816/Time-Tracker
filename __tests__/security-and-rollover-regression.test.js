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
  const snippet = scriptSource.slice(start, start + 2000);
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
  assert.match(serverSource, /'\/core\/actual-grid-core\.js':\s*'core\/actual-grid-core\.js'/);
  assert.match(serverSource, /'\/core\/date-core\.js':\s*'core\/date-core\.js'/);
  assert.match(serverSource, /'\/core\/duration-core\.js':\s*'core\/duration-core\.js'/);
  assert.match(serverSource, /'\/core\/text-core\.js':\s*'core\/text-core\.js'/);
  assert.match(serverSource, /'\/core\/time-core\.js':\s*'core\/time-core\.js'/);
  assert.match(serverSource, /'\/infra\/storage-adapter\.js':\s*'infra\/storage-adapter\.js'/);
  assert.match(serverSource, /'\/controllers\/timer-controller\.js':\s*'controllers\/timer-controller\.js'/);
  assert.match(serverSource, /'\/ui\/time-entry-renderer\.js':\s*'ui\/time-entry-renderer\.js'/);
});

test('script date helpers prefer TimeTrackerDateCore when available', () => {
  const start = scriptSource.indexOf('getLocalDateParts(date)');
  assert.ok(start >= 0, 'getLocalDateParts() should exist');
  const snippet = scriptSource.slice(start, start + 5200);
  assert.match(snippet, /globalThis\.TimeTrackerDateCore/);
  assert.match(snippet, /dateCore\.parseLocalDateParts/);
  assert.match(snippet, /dateCore\.getDateValue/);
  assert.match(snippet, /dateCore\.compareDateStrings/);
  assert.match(snippet, /dateCore\.formatDateFromMsLocal/);
  assert.match(snippet, /dateCore\.getTodayLocalDateString/);
  assert.match(snippet, /dateCore\.getLocalSlotStartMs/);
  assert.match(snippet, /dateCore\.getDayOfWeek/);
});

test('script actual-grid helpers prefer TimeTrackerActualGridCore when available', () => {
  const start = scriptSource.indexOf('getExtraActivityUnitCount(item)');
  assert.ok(start >= 0, 'getExtraActivityUnitCount() should exist');
  const snippet = scriptSource.slice(start, start + 18000);
  assert.match(snippet, /globalThis\.TimeTrackerActualGridCore/);
  assert.match(snippet, /actualGridCore\.getExtraActivityUnitCount/);
  assert.match(snippet, /actualGridCore\.getActualGridBlockRange/);
  assert.match(snippet, /actualGridCore\.buildActualUnitsFromActivities/);
  assert.match(snippet, /actualGridCore\.buildActualActivitiesFromGrid/);
});

test('script text helpers prefer TimeTrackerTextCore when available', () => {
  const start = scriptSource.indexOf('escapeHtml(text)');
  assert.ok(start >= 0, 'escapeHtml() should exist');
  const snippet = scriptSource.slice(start, start + 2600);
  assert.match(snippet, /globalThis\.TimeTrackerTextCore/);
  assert.match(snippet, /textCore\.escapeHtml/);
  assert.match(snippet, /textCore\.escapeAttribute/);
  assert.match(snippet, /textCore\.normalizeMergeKey/);
});

test('script normalizeActivityText prefers TimeTrackerTextCore when available', () => {
  const start = scriptSource.indexOf('normalizeActivityText(text) {');
  assert.ok(start >= 0, 'normalizeActivityText() should exist');
  const snippet = scriptSource.slice(start, start + 1200);
  assert.match(snippet, /globalThis\.TimeTrackerTextCore/);
  assert.match(snippet, /textCore\.normalizeActivityText/);
});

test('script duration helpers prefer TimeTrackerDurationCore when available', () => {
  const start = scriptSource.indexOf('formatTime(seconds)');
  assert.ok(start >= 0, 'formatTime() should exist');
  const snippet = scriptSource.slice(start, start + 3800);
  assert.match(snippet, /globalThis\.TimeTrackerDurationCore/);
  assert.match(snippet, /durationCore\.formatTime/);
  assert.match(snippet, /durationCore\.formatDurationSummary/);
  assert.match(snippet, /durationCore\.normalizeDurationStep/);
  assert.match(snippet, /durationCore\.normalizeActualDurationStep/);
});
