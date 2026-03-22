const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const scriptPath = path.join(__dirname, '..', 'script.js');
const source = fs.readFileSync(scriptPath, 'utf8');

function extractMethodSource(signature) {
  const escapedSignature = signature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const declPattern = new RegExp(`(^|\\n)\\s*${escapedSignature}\\s*\\{`, 'm');
  const match = declPattern.exec(source);
  assert.ok(match, `method signature not found: ${signature}`);

  const start = match.index + match[0].lastIndexOf(signature);
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
      if (!escaped && ch === '`') {
        inTemplate = false;
        i += 1;
        continue;
      }
      escaped = !escaped && ch === '\\';
      // 템플릿 문자열 내부의 ${ ... } 표현식에 포함된 중괄호는
      // 메서드 본문 파싱 깊이에 반영해야 함수 경계를 정확히 찾을 수 있다.
      if (ch === '{') depth += 1;
      if (ch === '}') depth -= 1;
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
const normalizeTimerStatus = buildMethod('normalizeTimerStatus(rawStatus, slot = null)', '(rawStatus, slot = null)');
const getTimerRawElapsed = buildMethod('getTimerRawElapsed(slot)', '(slot)');
const getTimeUiHostIndex = buildMethod('getTimeUiHostIndex(index)', '(index)');
const getMobileTimeUiState = buildMethod('getMobileTimeUiState(index, slotOverride = null)', '(index, slotOverride = null)');
const createTimerControls = buildMethod('createTimerControls(index, slot)', '(index, slot)');

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

test('normalizeTimerStatus prefers explicit valid status and falls back safely', () => {
  assert.equal(normalizeTimerStatus.call({}, 'paused', null), 'paused');
  assert.equal(normalizeTimerStatus.call({}, 'weird', { timer: { running: true } }), 'running');
  assert.equal(normalizeTimerStatus.call({}, '', { timer: { running: false } }), 'idle');
});

test('getTimerRawElapsed prefers persisted raw value and falls back to paused/running elapsed', () => {
  const ctx = {
    normalizeTimerStatus(rawStatus, slot) {
      return normalizeTimerStatus.call(this, rawStatus, slot);
    },
  };

  assert.equal(getTimerRawElapsed.call(ctx, { timer: { rawElapsed: 1394, elapsed: 1200, status: 'completed' } }), 1394);
  assert.equal(getTimerRawElapsed.call(ctx, { timer: { rawElapsed: 0, elapsed: 722, status: 'paused' } }), 722);
  assert.equal(getTimerRawElapsed.call(ctx, { timer: { rawElapsed: 0, elapsed: 500, status: 'idle' } }), 0);
});

test('getMobileTimeUiState prioritizes running/paused/completed over plain labels', () => {
  const ctx = {
    timeSlots: [
      { timer: { status: 'idle', rawElapsed: 0 } },
      { timer: { status: 'paused', rawElapsed: 754 } },
      { timer: { status: 'completed', rawElapsed: 1394 } },
      { timer: { status: 'running', rawElapsed: 0, running: true } },
    ],
    getCurrentTimeIndex() { return 0; },
    getTimeUiHostIndex(index) { return getTimeUiHostIndex.call(this, index); },
    findMergeKey() { return null; },
    normalizeTimerStatus(rawStatus, slot) { return normalizeTimerStatus.call(this, rawStatus, slot); },
    getTimerRawElapsed(slot) { return getTimerRawElapsed.call(this, slot); },
  };

  assert.deepEqual(getMobileTimeUiState.call(ctx, 0), {
    hostIndex: 0,
    mode: 'current',
    status: 'idle',
    rawElapsed: 0,
    isCurrent: true,
    showControls: true,
  });
  assert.equal(getMobileTimeUiState.call(ctx, 1).mode, 'paused');
  assert.equal(getMobileTimeUiState.call(ctx, 2).mode, 'label');
  assert.equal(getMobileTimeUiState.call(ctx, 3).mode, 'running');
});

test('createTimerControls keeps accessible labels and renders mobile icon spans', () => {
  const ctx = {
    getTimerEligibility() {
      return {
        canStartWithoutDate: true,
        disabledByDate: false,
        hasPlannedActivity: true,
        isCurrentTimeInRange: true,
      };
    },
    normalizeTimerStatus(rawStatus, slot) {
      return normalizeTimerStatus.call(this, rawStatus, slot);
    },
    getTimerRawElapsed(slot) {
      return getTimerRawElapsed.call(this, slot);
    },
    isMobileTimeExpansionEnabled() {
      return true;
    },
    formatTime(seconds) {
      const total = Math.max(0, Number(seconds) || 0);
      const hours = Math.floor(total / 3600).toString().padStart(2, '0');
      const minutes = Math.floor((total % 3600) / 60).toString().padStart(2, '0');
      const secs = Math.floor(total % 60).toString().padStart(2, '0');
      return `${hours}:${minutes}:${secs}`;
    },
  };

  const html = createTimerControls.call(ctx, 4, {
    timer: { running: true, elapsed: 6, rawElapsed: 6, status: 'running' },
  });

  assert.match(html, /class="timer-btn-mobile-icon"[^>]*>⏸<\/span>/);
  assert.match(html, /class="timer-btn-mobile-icon"[^>]*>■<\/span>/);
  assert.match(html, /class="timer-btn-label">일시정지<\/span>/);
  assert.match(html, /aria-label="타이머 일시정지"/);
  assert.match(html, /aria-label="타이머 정지"/);
});
