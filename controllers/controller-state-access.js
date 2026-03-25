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

    function getInlinePlanAnchor() {
        const target = getInlinePlanTarget.call(this);
        return target && target.anchor ? target.anchor : null;
    }

    function setInlinePlanAnchor(anchor) {
        const target = getInlinePlanTarget.call(this);
        if (!target) return null;
        target.anchor = anchor || null;
        return target.anchor;
    }

    return Object.freeze({
        getSelectionSet,
        getSelectionOverlay,
        setSelectionOverlay,
        getHoverSelectionOverlay,
        setHoverSelectionOverlay,
        getScheduleAnchor,
        getInlinePlanTarget,
        getInlinePlanAnchor,
        setInlinePlanAnchor
    });
});
