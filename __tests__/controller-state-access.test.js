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
