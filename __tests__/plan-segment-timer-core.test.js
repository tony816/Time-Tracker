const test = require('node:test');
const assert = require('node:assert/strict');

const core = require('../core/plan-segment-timer-core');

test('plan-segment-timer-core exports and global attach are available', () => {
    assert.equal(typeof core.normalizeSegmentTimer, 'function');
    assert.equal(typeof core.formatSegmentTimerText, 'function');
    assert.equal(typeof core.getSegmentTimerIcon, 'function');
    assert.equal(typeof core.getSegmentTimeTone, 'function');
    assert.equal(typeof core.buildPlanSegmentViewModel, 'function');
    assert.ok(globalThis.TimeTrackerPlanSegmentTimerCore);
});

test('plan segment timer icons describe the next action', () => {
    assert.equal(core.getSegmentTimerIcon({ status: 'idle' }), '▶');
    assert.equal(core.getSegmentTimerIcon({ status: 'running' }), '❚❚');
    assert.equal(core.getSegmentTimerIcon({ status: 'paused' }), '▶');
});

test('plan segment timer text uses live seconds while running and minutes otherwise', () => {
    const now = 10_000;
    assert.equal(core.formatSegmentTimerText({ status: 'idle', elapsedSeconds: 0 }, 2400, now), '40m');
    assert.equal(core.formatSegmentTimerText({ status: 'running', elapsedSeconds: 720, startedAt: now - 34_000 }, 2400, now), '12:34 / 40m');
    assert.equal(core.formatSegmentTimerText({ status: 'paused', elapsedSeconds: 720 }, 2400, now), '12m / 40m');
});

test('plan segment minute display floors partial minutes', () => {
    assert.equal(core.formatSegmentTimerText({ status: 'paused', elapsedSeconds: 59 }, 2400), '0m / 40m');
    assert.equal(core.formatSegmentTimerText({ status: 'paused', elapsedSeconds: 60 }, 2400), '1m / 40m');
    assert.equal(core.formatSegmentTimerText({ status: 'paused', elapsedSeconds: 119 }, 2400), '1m / 40m');
    assert.equal(core.formatSegmentTimerText({ status: 'paused', elapsedSeconds: 120 }, 2400), '2m / 40m');
    assert.equal(core.formatSegmentTimerText({ status: 'paused', elapsedSeconds: 179 }, 2400), '2m / 40m');
});

test('plan segment time tone compares display minutes without storing overrun state', () => {
    assert.equal(core.getSegmentTimeTone({ elapsedSeconds: 40 * 60 - 1, plannedSeconds: 40 * 60 }), 'under');
    assert.equal(core.getSegmentTimeTone({ elapsedSeconds: 40 * 60, plannedSeconds: 40 * 60 }), 'match');
    assert.equal(core.getSegmentTimeTone({ elapsedSeconds: 41 * 60 - 1, plannedSeconds: 40 * 60 }), 'match');
    assert.equal(core.getSegmentTimeTone({ elapsedSeconds: 41 * 60, plannedSeconds: 40 * 60 }), 'over');
});

test('plan segment view model exposes the phase 1 segment shape only', () => {
    const model = core.buildPlanSegmentViewModel({
        id: 'planned-8-9',
        title: '집중 작업',
        plannedSeconds: 2400,
        completedUnits: 2,
        overrun: true,
        timer: {
            status: 'paused',
            elapsedSeconds: 720,
            startedAt: 1000,
            lastPausedAt: 2000,
            enabled: false,
        },
    }, 3000);

    assert.deepEqual(Object.keys(model).sort(), ['display', 'id', 'plannedSeconds', 'timer', 'title']);
    assert.equal(model.id, 'planned-8-9');
    assert.equal(model.title, '집중 작업');
    assert.equal(model.plannedSeconds, 2400);
    assert.deepEqual(model.timer, {
        status: 'paused',
        elapsedSeconds: 720,
        startedAt: 1000,
        lastPausedAt: 2000,
    });
    assert.equal(model.display.icon, '▶');
    assert.equal(model.display.action, 'resume');
    assert.equal(model.display.timeText, '12m / 40m');
    assert.equal(model.display.tone, 'under');
    assert.equal(Object.hasOwn(model.timer, 'enabled'), false);
    assert.equal(Object.hasOwn(model, 'completedUnits'), false);
    assert.equal(Object.hasOwn(model, 'overrun'), false);
});
