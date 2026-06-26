const test = require('node:test');
const assert = require('node:assert/strict');

const access = require('../controllers/controller-state-access');

test('controller-state-access exports and global attach are available', () => {
    assert.equal(globalThis.TimeTrackerControllerStateAccess.getSelectionSet, access.getSelectionSet);
    assert.equal(globalThis.TimeTrackerControllerStateAccess.getInlinePlanAnchor, access.getInlinePlanAnchor);
});

test('selection state helpers read and write overlay stores safely', () => {
    const ctx = {
        selectedPlannedFields: new Set([1, 2]),
        selectedActualFields: new Set([3]),
        selectionOverlay: { planned: null, actual: null },
        hoverSelectionOverlay: { planned: null, actual: null }
    };

    assert.deepEqual(Array.from(access.getSelectionSet.call(ctx, 'planned')), [1, 2]);
    assert.deepEqual(Array.from(access.getSelectionSet.call(ctx, 'actual')), [3]);

    const plannedOverlay = { id: 'planned' };
    const hoverOverlay = { id: 'hover' };
    access.setSelectionOverlay.call(ctx, 'planned', plannedOverlay);
    access.setHoverSelectionOverlay.call(ctx, 'planned', hoverOverlay);

    assert.equal(access.getSelectionOverlay.call(ctx, 'planned'), plannedOverlay);
    assert.equal(access.getHoverSelectionOverlay.call(ctx, 'planned'), hoverOverlay);
});

test('inline plan anchor helpers expose and update the current inline target', () => {
    const ctx = {
        inlinePlanTarget: {
            startIndex: 3,
            endIndex: 4,
            anchor: { id: 'before' }
        },
        scheduleHoverButton: { id: 'hover' },
        scheduleButton: { id: 'fixed' }
    };

    assert.equal(access.getInlinePlanTarget.call(ctx), ctx.inlinePlanTarget);
    assert.equal(access.getInlinePlanAnchor.call(ctx), ctx.inlinePlanTarget.anchor);
    assert.equal(access.getScheduleAnchor.call(ctx), ctx.scheduleButton);

    const nextAnchor = { id: 'after' };
    access.setInlinePlanAnchor.call(ctx, nextAnchor);
    assert.equal(ctx.inlinePlanTarget.anchor, nextAnchor);
});

test('inline plan target helpers set, clear, and revalidate rerendered anchors', () => {
    const originalDocument = globalThis.document;
    const resolvedAnchor = { id: 'resolved', isConnected: true };
    const ctx = {};

    globalThis.document = {
        querySelector(selector) {
            return selector === '[data-index="2"] .planned-input' ? resolvedAnchor : null;
        },
    };

    try {
        const target = access.setInlinePlanTarget.call(ctx, {
            startIndex: 2,
            endIndex: 2,
            anchor: { id: 'stale', isConnected: false },
        });

        assert.equal(ctx.inlinePlanTarget, target);
        assert.equal(access.resolveInlinePlanAnchor.call(ctx, target.anchor, 2), resolvedAnchor);
        assert.equal(access.validateInlinePlanAnchor.call(ctx, target.anchor, 2), resolvedAnchor);
        assert.equal(ctx.inlinePlanTarget.anchor, resolvedAnchor);
        assert.equal(ctx.inlinePlanAnchor, resolvedAnchor);

        access.clearInlinePlanTarget.call(ctx);
        assert.equal(ctx.inlinePlanTarget, null);
        assert.equal(ctx.inlinePlanAnchor, null);
    } finally {
        globalThis.document = originalDocument;
    }
});

test('same inline plan target helper rejects different segment replacement targets', () => {
    const current = {
        startIndex: 1,
        endIndex: 1,
        mode: 'plan-segment-replace',
        segmentIndex: 0,
        segmentId: 'a',
    };

    assert.equal(access.isSameInlinePlanTarget.call({}, { ...current }, current), true);
    assert.equal(access.isSameInlinePlanTarget.call({}, { ...current, segmentId: 'b' }, current), false);
});
