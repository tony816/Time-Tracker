const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const scriptPath = path.join(__dirname, '..', 'script.js');
const source = fs.readFileSync(scriptPath, 'utf8');

function extractMethodSource(signature) {
  const start = source.indexOf(signature);
  assert.ok(start >= 0, `method signature not found: ${signature}`);

  const openBrace = source.indexOf('{', start);
  assert.ok(openBrace >= 0, `method body open brace not found: ${signature}`);

  let i = openBrace + 1;
  let depth = 1;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;
  let escaped = false;

  while (i < source.length && depth > 0) {
    const ch = source[i];
    const next = source[i + 1];

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      i += 1;
      continue;
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i += 2;
        continue;
      }
      i += 1;
      continue;
    }

    if (inSingle) {
      if (!escaped && ch === "'") inSingle = false;
      escaped = !escaped && ch === '\\';
      i += 1;
      continue;
    }

    if (inDouble) {
      if (!escaped && ch === '"') inDouble = false;
      escaped = !escaped && ch === '\\';
      i += 1;
      continue;
    }

    if (inTemplate) {
      if (!escaped && ch === '`') inTemplate = false;
      escaped = !escaped && ch === '\\';
      i += 1;
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i += 2;
      continue;
    }

    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i += 2;
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      escaped = false;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inDouble = true;
      escaped = false;
      i += 1;
      continue;
    }

    if (ch === '`') {
      inTemplate = true;
      escaped = false;
      i += 1;
      continue;
    }

    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    i += 1;
  }

  assert.equal(depth, 0, `method body parsing failed: ${signature}`);
  return source.slice(start, i);
}

function buildMethod(signature, args) {
  const methodSource = extractMethodSource(signature);
  return new Function(`return (function ${args} ${methodSource.slice(methodSource.indexOf('{'))});`)();
}

const normalizeMergeKey = buildMethod('normalizeMergeKey(rawMergeKey, expectedType = null)', '(rawMergeKey, expectedType = null)');
const escapeHtml = buildMethod('escapeHtml(text)', '(text)');
const escapeAttribute = buildMethod('escapeAttribute(text)', '(text)');
const createTimerField = buildMethod('createTimerField(index, slot)', '(index, slot)');
const updateRunningTimers = buildMethod('updateRunningTimers()', '()');
const transitionToDate = buildMethod('transitionToDate(nextDate)', '(nextDate)');

test('normalizeMergeKey accepts valid keys and rejects malformed values', () => {
  const ctx = { timeSlots: new Array(48).fill({}) };

  assert.equal(normalizeMergeKey.call(ctx, 'planned-0-0'), 'planned-0-0');
  assert.equal(normalizeMergeKey.call(ctx, ' actual-3-9 '), 'actual-3-9');
  assert.equal(normalizeMergeKey.call(ctx, 'time-10-12', 'time'), 'time-10-12');

  assert.equal(normalizeMergeKey.call(ctx, 'time-10-12', 'actual'), null);
  assert.equal(normalizeMergeKey.call(ctx, 'time--1-2'), null);
  assert.equal(normalizeMergeKey.call(ctx, 'time-3-2'), null);
  assert.equal(normalizeMergeKey.call(ctx, 'time-1-999'), null);
  assert.equal(normalizeMergeKey.call(ctx, 'time-1-2<script>'), null);
  assert.equal(normalizeMergeKey.call(ctx, 'actual-1.5-2'), null);
});

test('escapeHtml and createTimerField prevent script injection payload from being rendered raw', () => {
  const payload = `\"><img src=x onerror=alert('xss')><script>alert(1)</script>`;
  const ctx = { escapeHtml };
  ctx.escapeAttribute = function(text) { return escapeAttribute.call(ctx, text); };
  ctx.createTimerField = function(index, slot) { return createTimerField.call(ctx, index, slot); };

  const escaped = escapeHtml.call(ctx, payload);
  assert.ok(!escaped.includes('<script>'));
  assert.ok(!escaped.includes('<img'));
  assert.match(escaped, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);

  const html = ctx.createTimerField(0, { actual: payload });
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img'));
  assert.match(html, /&lt;img src=x onerror=alert\(&#39;xss&#39;\)&gt;/);
});

test('updateRunningTimers transitions to today when midnight rollover detected with running timer', () => {
  const calls = [];
  const ctx = {
    lastKnownTodayDate: '2026-02-13',
    currentDate: '2026-02-12',
    timeSlots: [{ timer: { running: true, elapsed: 0, startTime: 0 } }],
    getTodayLocalDateString() { return '2026-02-14'; },
    transitionToDate(date) { calls.push(['transition', date]); },
  };

  updateRunningTimers.call(ctx);

  assert.equal(ctx.lastKnownTodayDate, '2026-02-14');
  assert.deepEqual(calls, [['transition', '2026-02-14']]);
});

test('updateRunningTimers stops interval when nothing is running', () => {
  const calls = [];
  global.document = { querySelector: () => null };

  const ctx = {
    lastKnownTodayDate: '2026-02-14',
    currentDate: '2026-02-14',
    timeSlots: [{ timer: { running: false } }, { timer: { running: false } }],
    getTodayLocalDateString() { return '2026-02-14'; },
    stopTimerInterval() { calls.push('stop'); },
  };

  try {
    updateRunningTimers.call(ctx);
  } finally {
    delete global.document;
  }

  assert.deepEqual(calls, ['stop']);
});

test('transitionToDate commits timers and persists previous-date snapshot before switching date', async () => {
  const calls = [];
  const ctx = {
    currentDate: '2026-02-13',
    timeSlots: [{ id: 1 }],
    mergedFields: new Map([['planned-0-0', 'deep-work']]),
    commitRunningTimers(options) {
      calls.push(['commit', options]);
      return true;
    },
    persistSnapshotForDate(date, slots, mergedObj) {
      calls.push(['persist', date, slots, mergedObj]);
      return Promise.resolve();
    },
    setCurrentDate() {
      calls.push(['setCurrentDate']);
    },
    loadData() {
      calls.push(['loadData']);
    },
    resubscribeSupabaseRealtime() {
      calls.push(['resubscribe']);
    },
  };

  transitionToDate.call(ctx, '2026-02-14');

  assert.equal(ctx.currentDate, '2026-02-14');
  assert.equal(calls[0][0], 'commit');
  assert.equal(calls[1][0], 'persist');
  assert.deepEqual(calls[1][1], '2026-02-13');
  assert.deepEqual(calls[2], ['setCurrentDate']);
  assert.deepEqual(calls[3], ['loadData']);
  assert.deepEqual(calls[4], ['resubscribe']);

  const commitOptions = calls[0][1];
  assert.equal(commitOptions.render, false);
  assert.equal(commitOptions.calculate, false);
  assert.equal(commitOptions.autoSave, false);
});

test('transitionToDate skips snapshot persistence when commit has no changes', () => {
  const calls = [];
  const ctx = {
    currentDate: '2026-02-13',
    timeSlots: [{ id: 1 }],
    mergedFields: new Map(),
    commitRunningTimers() {
      calls.push('commit');
      return false;
    },
    persistSnapshotForDate() {
      calls.push('persist');
      return Promise.resolve();
    },
    setCurrentDate() {
      calls.push('setCurrentDate');
    },
    loadData() {
      calls.push('loadData');
    },
  };

  transitionToDate.call(ctx, '2026-02-14');

  assert.equal(ctx.currentDate, '2026-02-14');
  assert.deepEqual(calls, ['commit', 'setCurrentDate', 'loadData']);
});
