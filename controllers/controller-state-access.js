(function attachTimeTrackerControllerStateAccess(root, factory) {
    const api = factory(root);

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        const existing = (root.TimeTrackerControllerStateAccess && typeof root.TimeTrackerControllerStateAccess === 'object')
            ? root.TimeTrackerControllerStateAccess
            : {};
        root.TimeTrackerControllerStateAccess = Object.assign(existing, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildTimeTrackerControllerStateAccess(root) {
    function ensureOverlayStore(storeName) {
        if (!this[storeName] || typeof this[storeName] !== 'object') {
            this[storeName] = { planned: null, actual: null };
        }
        return this[storeName];
    }

    function getSelectionSet(type) {
        return type === 'planned' ? this.selectedPlannedFields : this.selectedActualFields;
    }

    function getSelectionOverlay(type) {
        const store = ensureOverlayStore.call(this, 'selectionOverlay');
        return store[type] || null;
    }

    function setSelectionOverlay(type, overlay) {
        const store = ensureOverlayStore.call(this, 'selectionOverlay');
        store[type] = overlay || null;
        return store[type];
    }

    function getHoverSelectionOverlay(type) {
        const store = ensureOverlayStore.call(this, 'hoverSelectionOverlay');
        return store[type] || null;
    }

    function setHoverSelectionOverlay(type, overlay) {
        const store = ensureOverlayStore.call(this, 'hoverSelectionOverlay');
        store[type] = overlay || null;
        return store[type];
    }

    function getScheduleAnchor() {
        return this.scheduleButton || this.scheduleHoverButton || null;
    }

    function getInlinePlanTarget() {
        return this.inlinePlanTarget || null;
    }

    function setInlinePlanTarget(target) {
        this.inlinePlanTarget = target && typeof target === 'object' ? target : null;
        return this.inlinePlanTarget;
    }

    function clearInlinePlanTarget() {
        this.inlinePlanTarget = null;
        this.inlinePlanAnchor = null;
        return null;
    }

    function getInlinePlanAnchor() {
        const target = getInlinePlanTarget.call(this);
        return target && target.anchor ? target.anchor : null;
    }

    function setInlinePlanAnchor(anchor) {
        const target = getInlinePlanTarget.call(this);
        if (!target) return null;
        target.anchor = anchor || null;
        this.inlinePlanAnchor = target.anchor;
        return target.anchor;
    }

    function resolveInlinePlanAnchor(anchor, fallbackIndex = null) {
        if (anchor && anchor.isConnected) return anchor;
        const target = getInlinePlanTarget.call(this);
        if (target && target.mode === 'plan-segment-replace') {
            return resolvePlanSegmentInlinePlanAnchor.call(this, target, fallbackIndex);
        }
        const index = Number.isInteger(fallbackIndex)
            ? fallbackIndex
            : (target && Number.isInteger(target.startIndex) ? target.startIndex : null);
        if (!Number.isInteger(index)) return null;
        if (typeof document === 'undefined' || !document.querySelector) return null;
        return document.querySelector(`[data-index="${index}"] .planned-input`)
            || document.querySelector(`[data-index="${index}"]`);
    }

    function resolvePlanSegmentInlinePlanAnchor(target = null, fallbackIndex = null) {
        const planTarget = target || getInlinePlanTarget.call(this);
        if (!planTarget || planTarget.mode !== 'plan-segment-replace') return null;
        if (typeof this.resolvePlanSegmentInlinePlanAnchor === 'function') {
            const resolved = this.resolvePlanSegmentInlinePlanAnchor(planTarget, fallbackIndex);
            if (resolved && resolved.isConnected !== false) return resolved;
        }
        const baseIndex = Number.isInteger(planTarget.baseIndex)
            ? planTarget.baseIndex
            : (Number.isInteger(planTarget.startIndex) ? planTarget.startIndex : fallbackIndex);
        const segmentIndex = Number.isInteger(Number(planTarget.segmentIndex)) ? Number(planTarget.segmentIndex) : null;
        if (!Number.isInteger(baseIndex) || !Number.isInteger(segmentIndex)) return null;
        if (typeof document === 'undefined' || !document.querySelector) return null;
        const row = document.querySelector(`.time-entry[data-index="${baseIndex}"], [data-index="${baseIndex}"]`);
        const candidates = row && typeof row.querySelectorAll === 'function'
            ? Array.from(row.querySelectorAll(`.split-grid-segment[data-segment-kind="real-plan"][data-segment-index="${segmentIndex}"]`))
            : [];
        const expectedId = String(planTarget.segmentId || '');
        const segmentEl = expectedId
            ? candidates.find((candidate) => String((candidate.dataset && candidate.dataset.segmentId) || '') === expectedId)
            : candidates[0];
        if (!segmentEl || segmentEl.isConnected === false) return null;
        return (segmentEl.querySelector && (
            segmentEl.querySelector('.plan-segment-label-text')
            || segmentEl.querySelector('.plan-segment-graphic-label')
        )) || segmentEl;
    }

    function validateInlinePlanAnchor(anchor = null, fallbackIndex = null) {
        const resolved = resolveInlinePlanAnchor.call(this, anchor || getInlinePlanAnchor.call(this), fallbackIndex);
        if (!resolved || resolved.isConnected === false) return null;
        setInlinePlanAnchor.call(this, resolved);
        return resolved;
    }

    function isSameInlinePlanTarget(left, right, anchor = null) {
        if (!left || !right) return false;
        const leftStart = Number.isInteger(left.startIndex) ? left.startIndex : null;
        const rightStart = Number.isInteger(right.startIndex) ? right.startIndex : null;
        const leftEnd = Number.isInteger(left.endIndex) ? left.endIndex : leftStart;
        const rightEnd = Number.isInteger(right.endIndex) ? right.endIndex : rightStart;
        if (!Number.isInteger(leftStart) || !Number.isInteger(rightStart)) return false;
        if (leftStart !== rightStart || leftEnd !== rightEnd) return false;
        if (String(left.mode || '') !== String(right.mode || '')) return false;
        if (String(left.mergeKey || '') !== String(right.mergeKey || '')) return false;
        if (String(left.mode || '') === 'plan-segment-replace') {
            if (Number(left.segmentIndex) !== Number(right.segmentIndex)) return false;
            if (String(left.segmentId || '') !== String(right.segmentId || '')) return false;
        }
        if (!anchor) return true;
        return (right.anchor || null) === anchor;
    }

    return Object.freeze({
        getSelectionSet,
        getSelectionOverlay,
        setSelectionOverlay,
        getHoverSelectionOverlay,
        setHoverSelectionOverlay,
        getScheduleAnchor,
        getInlinePlanTarget,
        setInlinePlanTarget,
        clearInlinePlanTarget,
        getInlinePlanAnchor,
        setInlinePlanAnchor,
        resolveInlinePlanAnchor,
        resolvePlanSegmentInlinePlanAnchor,
        validateInlinePlanAnchor,
        isSameInlinePlanTarget
    });
});
