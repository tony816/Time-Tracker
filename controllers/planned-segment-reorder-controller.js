(function attachTimeTrackerPlannedSegmentReorderController(root, factory) {
    const api = factory(root);

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        const existing = (root.TimeTrackerPlannedSegmentReorderController && typeof root.TimeTrackerPlannedSegmentReorderController === 'object')
            ? root.TimeTrackerPlannedSegmentReorderController
            : {};
        root.TimeTrackerPlannedSegmentReorderController = Object.assign(existing, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildTimeTrackerPlannedSegmentReorderController(root) {
    const LONG_PRESS_MS = 220;
    const MOVE_THRESHOLD_PX = 8;
    const CLICK_SUPPRESS_MS = 700;
    const BROWSER_GESTURE_SUPPRESSION_EVENTS = [
        'selectstart',
        'contextmenu',
        'dragstart',
    ];
    const BLOCKED_START_SELECTOR = [
        '.plan-segment-resize-handle',
        '.plan-segment-timer-button',
        '.plan-segment-title-edit-input',
        '.inline-plan-dropdown',
        '.activity-chip-board',
        '.inline-plan-subsection',
        '.inline-plan-child-popover-layer',
        'button',
        'input',
        'select',
        'textarea',
        '[contenteditable="true"]',
    ].join(', ');

    function getPointFromEvent(event) {
        if (!event) return null;
        if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
            return { clientX: event.clientX, clientY: event.clientY };
        }
        const touch = (event.changedTouches && event.changedTouches[0])
            || (event.touches && event.touches[0]);
        if (touch && Number.isFinite(touch.clientX) && Number.isFinite(touch.clientY)) {
            return { clientX: touch.clientX, clientY: touch.clientY };
        }
        return null;
    }

    function pointInRect(point, rect) {
        if (!point || !rect) return false;
        return point.clientX >= rect.left
            && point.clientX <= rect.right
            && point.clientY >= rect.top
            && point.clientY <= rect.bottom;
    }

    function cloneValue(value) {
        if (value == null) return value;
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (_) {
            if (Array.isArray(value)) return value.map((item) => ({ ...(item || {}) }));
            if (typeof value === 'object') return { ...value };
            return value;
        }
    }

    function getPlanSegmentCore() {
        return root && root.TimeTrackerPlanSegmentCore
            ? root.TimeTrackerPlanSegmentCore
            : (typeof globalThis !== 'undefined' ? globalThis.TimeTrackerPlanSegmentCore : null);
    }

    function getReorderItemId(segmentEl) {
        if (!segmentEl || !segmentEl.dataset) return '';
        if (segmentEl.dataset.reorderItemId) return String(segmentEl.dataset.reorderItemId);
        if (segmentEl.dataset.segmentKind === 'virtual-rest') {
            const restIndex = parseInt(segmentEl.dataset.restIndex || segmentEl.dataset.gapIndex || '', 10);
            return `rest-${Number.isInteger(restIndex) ? restIndex : 0}`;
        }
        const segmentIndex = parseInt(segmentEl.dataset.segmentIndex || '', 10);
        return Number.isInteger(segmentIndex) ? `real-${segmentIndex}` : '';
    }

    function getRealIndexFromReorderId(value) {
        const match = String(value || '').match(/^real-(\d+)$/);
        if (!match) return null;
        const index = parseInt(match[1], 10);
        return Number.isInteger(index) ? index : null;
    }

    function getResolvedPlannedContext(ctx, index) {
        const fallbackIndex = Number.isInteger(Number(index)) ? Number(index) : 0;
        const context = typeof ctx.resolvePlannedSlotContext === 'function'
            ? ctx.resolvePlannedSlotContext(fallbackIndex)
            : null;
        if (context) return context;
        return {
            baseIndex: fallbackIndex,
            rangeStart: fallbackIndex,
            rangeEnd: fallbackIndex,
            slotCount: 1,
            blockMinutes: 60,
            mergeKey: null,
            isMerged: false,
        };
    }

    function getPlanActivities(ctx, slot) {
        const normalize = ctx.normalizePlanActivitiesPreservingSegments
            || ctx.normalizePlanActivitiesArray;
        return normalize
            ? normalize.call(ctx, slot && slot.planActivities).map((item) => ({ ...item }))
            : (Array.isArray(slot && slot.planActivities) ? slot.planActivities.map((item) => ({ ...item })) : []);
    }

    function getBlockRelativePlanActivities(ctx, planActivities, context) {
        if (typeof ctx.normalizePlanActivitiesForBlockRelative === 'function') {
            return ctx.normalizePlanActivitiesForBlockRelative(planActivities, {
                context,
                baseIndex: context.baseIndex,
                blockMinutes: context.blockMinutes,
            });
        }
        return planActivities.map((item) => ({ ...item }));
    }

    function isBlockedReorderStart(ctx, event, segmentEl) {
        const target = event && event.target;
        if (!target || !segmentEl) return true;
        if (ctx && typeof ctx.isPlannedSlotMoveMode === 'function' && ctx.isPlannedSlotMoveMode()) return true;
        if (ctx && ctx.plannedSlotMoveMode === true) return true;
        if (segmentEl.classList && (
            segmentEl.classList.contains('is-resizing-plan-segment')
        )) {
            return true;
        }
        const grid = segmentEl.closest && segmentEl.closest('.split-grid');
        if (grid && grid.classList && (
            grid.classList.contains('is-previewing-plan-resize')
            || grid.classList.contains('is-delete-pending-plan-resize')
        )) {
            return true;
        }
        if (target.closest && target.closest(BLOCKED_START_SELECTOR)) return true;

        const isCoarse = typeof ctx.isCoarsePlanSegmentPointerContext === 'function'
            ? ctx.isCoarsePlanSegmentPointerContext()
            : false;
        if (!isCoarse) return false;

        const point = getPointFromEvent(event);
        const rect = segmentEl.getBoundingClientRect ? segmentEl.getBoundingClientRect() : null;
        if (!point || !rect || !Number.isFinite(rect.width) || rect.width <= 0) return false;
        const baseWidth = Math.min(36, Math.max(24, rect.width * 0.28));
        const edgeZoneWidth = Math.max(8, Math.min(baseWidth, rect.width * 0.4));
        return point.clientX <= rect.left + edgeZoneWidth
            || point.clientX >= rect.right - edgeZoneWidth;
    }

    function getTimerPrefix(context) {
        return `planned-${context.rangeStart}-${context.rangeEnd}`;
    }

    function getSegmentDurationMinutes(segment) {
        if (!segment || typeof segment !== 'object') return 0;
        const start = Number(segment.startMinute);
        const end = Number(segment.endMinute);
        if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
            return Math.max(0, Math.floor(end - start));
        }
        const duration = Number(segment.durationMinutes);
        if (Number.isFinite(duration) && duration > 0) return Math.max(0, Math.floor(duration));
        const seconds = Number(segment.seconds);
        return Number.isFinite(seconds) && seconds > 0 ? Math.max(0, Math.floor(seconds / 60)) : 0;
    }

    function isVirtualRestSegment(el) {
        return Boolean(el
            && el.dataset
            && el.dataset.segmentKind === 'virtual-rest'
            && el.classList
            && el.classList.contains('split-grid-segment-virtual-rest'));
    }

    function getRestTargetDurationMinutes(restEl) {
        if (!restEl || !restEl.dataset) return 0;
        const candidates = [
            restEl.dataset.gapDurationMinutes,
            restEl.dataset.durationMinutes,
            restEl.dataset.segmentDurationMinutes,
        ];
        for (const value of candidates) {
            const parsed = Number(value);
            if (Number.isFinite(parsed) && parsed >= 1) return Math.floor(parsed);
        }
        return 0;
    }

    function getRestTargetStartMinute(restEl) {
        if (!restEl || !restEl.dataset) return null;
        const candidates = [
            restEl.dataset.gapStartMinute,
            restEl.dataset.startMinute,
            restEl.dataset.segmentStartMinute,
        ];
        for (const value of candidates) {
            const parsed = Number(value);
            if (Number.isFinite(parsed)) return Math.floor(parsed);
        }
        return null;
    }

    function getInsertIndexForRestTarget(ctx, targetContext, restStartMinute) {
        const targetSlot = ctx.timeSlots && ctx.timeSlots[targetContext.baseIndex];
        const targetItems = getBlockRelativePlanActivities(ctx, getPlanActivities(ctx, targetSlot), targetContext);
        if (!Number.isFinite(Number(restStartMinute))) return targetItems.length;
        const restStart = Number(restStartMinute);
        const index = targetItems.findIndex((item) => {
            const start = Number(item && item.startMinute);
            if (Number.isFinite(start)) return start >= restStart;
            const end = Number(item && item.endMinute);
            return Number.isFinite(end) && end > restStart;
        });
        return index >= 0 ? index : targetItems.length;
    }

    function resizeMovingSegmentForRest(moving, restDuration) {
        const durationMinutes = Math.max(0, Math.floor(Number(restDuration) || 0));
        if (!moving || durationMinutes < 1) return null;
        const next = { ...moving };
        delete next.kind;
        delete next.virtual;
        next.startMinute = 0;
        next.endMinute = durationMinutes;
        next.durationMinutes = durationMinutes;
        next.seconds = durationMinutes * 60;
        return next;
    }

    function relayoutPlanSegmentsByOrder(segments, capacityMinutes) {
        const capacity = Math.max(0, Math.floor(Number(capacityMinutes) || 0));
        let cursor = 0;
        return (Array.isArray(segments) ? segments : [])
            .filter((item) => item && typeof item === 'object' && item.kind !== 'virtual-rest' && item.virtual !== true)
            .map((item) => {
                const durationMinutes = getSegmentDurationMinutes(item);
                if (durationMinutes <= 0 || cursor + durationMinutes > capacity) return null;
                const next = { ...item };
                delete next.kind;
                delete next.virtual;
                next.startMinute = cursor;
                next.endMinute = cursor + durationMinutes;
                next.durationMinutes = durationMinutes;
                next.seconds = durationMinutes * 60;
                cursor = next.endMinute;
                return next;
            })
            .filter(Boolean);
    }

    function remapPlanSegmentTimers(timers, context, indexMap) {
        const sourceTimers = timers && typeof timers === 'object' && !Array.isArray(timers)
            ? timers
            : {};
        const prefix = getTimerPrefix(context);
        const nextTimers = {};
        Object.entries(sourceTimers).forEach(([key, value]) => {
            const textKey = String(key);
            const match = textKey.match(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-seg(\\d+)$`));
            if (match) {
                const oldIndex = parseInt(match[1], 10);
                if (Object.prototype.hasOwnProperty.call(indexMap, oldIndex)) {
                    nextTimers[`${prefix}-seg${indexMap[oldIndex]}`] = cloneValue(value);
                    return;
                }
            }
            nextTimers[textKey] = cloneValue(value);
        });
        return nextTimers;
    }

    function remapPlanSegmentTimersForList(timers, context, indexMap) {
        return remapPlanSegmentTimers(timers, context, indexMap || {});
    }

    function buildSequentialIndexMap(oldItems, nextItems) {
        const used = new Set();
        const map = {};
        nextItems.forEach((nextItem, nextIndex) => {
            const oldIndex = oldItems.findIndex((oldItem, candidateIndex) => {
                if (used.has(candidateIndex)) return false;
                return oldItem === nextItem || JSON.stringify(oldItem) === JSON.stringify(nextItem);
            });
            if (oldIndex >= 0) {
                used.add(oldIndex);
                map[oldIndex] = nextIndex;
            }
        });
        return map;
    }

    function refreshPlanMergeSnapshotSignature(ctx, slot, context) {
        if (!slot || !slot.planMergeSnapshot || !context || !context.isMerged) return;
        const core = getPlanSegmentCore();
        if (!core || typeof core.attachPlanMergePostState !== 'function') return;
        const refreshed = core.attachPlanMergePostState(slot.planMergeSnapshot, slot);
        if (refreshed) {
            slot.planMergeSnapshot = refreshed;
        }
    }

    function getReorderResult(ctx, baseIndex, sourceId, targetId, placement = 'before') {
        const core = getPlanSegmentCore();
        if (!core || typeof core.reorderMixedPlanSegmentLayout !== 'function') return null;
        const context = getResolvedPlannedContext(ctx, baseIndex);
        const effectiveBaseIndex = context.baseIndex;
        const slot = ctx.timeSlots && ctx.timeSlots[effectiveBaseIndex];
        if (!slot) return null;

        const current = getPlanActivities(ctx, slot);
        const currentRelative = getBlockRelativePlanActivities(ctx, current, context);
        const result = core.reorderMixedPlanSegmentLayout(currentRelative, sourceId, targetId, placement, {
            startMinute: 0,
            endMinute: context.blockMinutes || 60,
        });
        return { context, effectiveBaseIndex, slot, result };
    }

    function applyPlanSegmentReorder(baseIndex, sourceIndex, targetIndex, placement = 'before') {
        const sourceId = typeof sourceIndex === 'number' || /^\d+$/.test(String(sourceIndex || ''))
            ? `real-${sourceIndex}`
            : String(sourceIndex || '');
        const targetId = typeof targetIndex === 'number' || /^\d+$/.test(String(targetIndex || ''))
            ? `real-${targetIndex}`
            : String(targetIndex || '');
        const payload = getReorderResult(this, baseIndex, sourceId, targetId, placement);
        if (!payload) return false;
        const { context, effectiveBaseIndex, slot, result } = payload;
        if (!result || !result.changed || !Array.isArray(result.segments)) return false;

        slot.planActivities = result.segments.map((item) => {
            const copy = { ...item };
            delete copy.kind;
            delete copy.virtual;
            return copy;
        });
        slot.planSegmentTimers = remapPlanSegmentTimers(slot.planSegmentTimers, context, result.indexMap || {});
        slot.planned = typeof this.formatActivitiesSummary === 'function'
            ? this.formatActivitiesSummary(slot.planActivities)
            : (slot.planned || '');
        refreshPlanMergeSnapshotSignature(this, slot, context);

        const sourceRealIndex = getRealIndexFromReorderId(sourceId);
        const newIndex = sourceRealIndex != null
            && result.indexMap
            && Object.prototype.hasOwnProperty.call(result.indexMap, sourceRealIndex)
            ? result.indexMap[sourceRealIndex]
            : null;
        if (Number.isInteger(newIndex)) {
            this.selectedPlanSegment = { baseIndex: effectiveBaseIndex, segmentIndex: newIndex };
        }
        if (typeof this.renderTimeEntries === 'function') this.renderTimeEntries(true);
        if (typeof this.repositionOpenInlinePlanDropdown === 'function') this.repositionOpenInlinePlanDropdown();
        if (typeof this.calculateTotals === 'function') this.calculateTotals();
        if (typeof this.autoSave === 'function') this.autoSave();
        return true;
    }

    function applyPlanSegmentCrossSlotMove(sourceBaseIndex, sourceIndex, targetBaseIndex, insertIndex = 0, options = {}) {
        const sourceContext = getResolvedPlannedContext(this, sourceBaseIndex);
        const targetContext = getResolvedPlannedContext(this, targetBaseIndex);
        const sourceSlot = this.timeSlots && this.timeSlots[sourceContext.baseIndex];
        const targetSlot = this.timeSlots && this.timeSlots[targetContext.baseIndex];
        const parsedSourceIndex = parseInt(sourceIndex, 10);
        const parsedInsertIndex = parseInt(insertIndex, 10);
        if (!sourceSlot || !targetSlot || !Number.isInteger(parsedSourceIndex)) return false;
        if (sourceContext.baseIndex === targetContext.baseIndex) return false;

        const sourceItems = getBlockRelativePlanActivities(this, getPlanActivities(this, sourceSlot), sourceContext);
        const targetItems = getBlockRelativePlanActivities(this, getPlanActivities(this, targetSlot), targetContext);
        const moving = sourceItems[parsedSourceIndex];
        if (!moving || moving.kind === 'virtual-rest' || moving.virtual === true) return false;
        const movingDuration = getSegmentDurationMinutes(moving);
        if (movingDuration <= 0) return false;
        const restDuration = options && Number.isFinite(Number(options.restDurationMinutes))
            ? Math.floor(Number(options.restDurationMinutes))
            : null;
        const movingForTarget = restDuration != null
            ? resizeMovingSegmentForRest(moving, restDuration)
            : { ...moving };
        if (!movingForTarget) return false;
        const targetMovingDuration = getSegmentDurationMinutes(movingForTarget);
        if (targetMovingDuration <= 0) return false;
        const targetUsed = targetItems.reduce((sum, item) => sum + getSegmentDurationMinutes(item), 0);
        if (targetUsed + targetMovingDuration > Math.max(0, Number(targetContext.blockMinutes) || 60)) return false;

        const sourceNextOrder = sourceItems.filter((_, index) => index !== parsedSourceIndex);
        const boundedInsert = Math.max(0, Math.min(
            Number.isInteger(parsedInsertIndex) ? parsedInsertIndex : targetItems.length,
            targetItems.length
        ));
        const targetNextOrder = targetItems.slice();
        targetNextOrder.splice(boundedInsert, 0, movingForTarget);

        const sourceNext = relayoutPlanSegmentsByOrder(sourceNextOrder, sourceContext.blockMinutes || 60);
        const targetNext = relayoutPlanSegmentsByOrder(targetNextOrder, targetContext.blockMinutes || 60);
        if (sourceNext.length !== sourceNextOrder.length || targetNext.length !== targetNextOrder.length) return false;

        const sourceIndexMap = {};
        sourceItems.forEach((_, oldIndex) => {
            if (oldIndex < parsedSourceIndex) sourceIndexMap[oldIndex] = oldIndex;
            if (oldIndex > parsedSourceIndex) sourceIndexMap[oldIndex] = oldIndex - 1;
        });
        const movingTimer = sourceSlot.planSegmentTimers && sourceSlot.planSegmentTimers[`${getTimerPrefix(sourceContext)}-seg${parsedSourceIndex}`]
            ? cloneValue(sourceSlot.planSegmentTimers[`${getTimerPrefix(sourceContext)}-seg${parsedSourceIndex}`])
            : null;
        const movingTimerKey = `${getTimerPrefix(sourceContext)}-seg${parsedSourceIndex}`;
        const targetIndexMap = buildSequentialIndexMap(targetItems, targetNextOrder);

        sourceSlot.planActivities = sourceNext;
        sourceSlot.planSegmentTimers = remapPlanSegmentTimersForList(sourceSlot.planSegmentTimers, sourceContext, sourceIndexMap);
        if (sourceSlot.planSegmentTimers && Object.prototype.hasOwnProperty.call(sourceSlot.planSegmentTimers, movingTimerKey)) {
            delete sourceSlot.planSegmentTimers[movingTimerKey];
        }
        targetSlot.planActivities = targetNext;
        targetSlot.planSegmentTimers = remapPlanSegmentTimersForList(targetSlot.planSegmentTimers, targetContext, targetIndexMap);
        if (movingTimer) {
            targetSlot.planSegmentTimers = targetSlot.planSegmentTimers || {};
            targetSlot.planSegmentTimers[`${getTimerPrefix(targetContext)}-seg${boundedInsert}`] = movingTimer;
        }
        sourceSlot.planned = typeof this.formatActivitiesSummary === 'function'
            ? this.formatActivitiesSummary(sourceSlot.planActivities)
            : (sourceSlot.planned || '');
        targetSlot.planned = typeof this.formatActivitiesSummary === 'function'
            ? this.formatActivitiesSummary(targetSlot.planActivities)
            : (targetSlot.planned || '');
        refreshPlanMergeSnapshotSignature(this, sourceSlot, sourceContext);
        refreshPlanMergeSnapshotSignature(this, targetSlot, targetContext);
        this.selectedPlanSegment = { baseIndex: targetContext.baseIndex, segmentIndex: boundedInsert };
        if (typeof this.renderTimeEntries === 'function') this.renderTimeEntries(true);
        if (typeof this.repositionOpenInlinePlanDropdown === 'function') this.repositionOpenInlinePlanDropdown();
        if (typeof this.calculateTotals === 'function') this.calculateTotals();
        if (typeof this.autoSave === 'function') this.autoSave();
        return true;
    }

    function clearReorderPreviewLayer(grid) {
        if (!grid || typeof grid.querySelectorAll !== 'function') return;
        grid.querySelectorAll('.plan-segment-reorder-preview-layer').forEach((layer) => {
            if (layer.parentNode) layer.parentNode.removeChild(layer);
        });
        grid.querySelectorAll('.plan-segment-reorder-insert-marker').forEach((marker) => {
            if (marker.parentNode) marker.parentNode.removeChild(marker);
        });
        if (grid.classList) {
            grid.classList.remove(
                'is-previewing-plan-reorder',
                'is-plan-segment-reorder-drop-target',
                'is-plan-segment-reorder-empty-target',
                'is-plan-segment-reorder-invalid-target'
            );
        }
    }

    function clearReorderDropTargetHighlights() {
        if (typeof document === 'undefined' || !document.querySelectorAll) return;
        document.querySelectorAll('.is-plan-segment-reorder-drop-target, .is-plan-segment-reorder-empty-target, .is-plan-segment-reorder-invalid-target')
            .forEach((el) => {
                if (!el || !el.classList) return;
                el.classList.remove(
                    'is-plan-segment-reorder-drop-target',
                    'is-plan-segment-reorder-empty-target',
                    'is-plan-segment-reorder-invalid-target'
                );
            });
    }

    function removeReorderDropTargetOverlay() {
        if (typeof document === 'undefined' || !document.querySelectorAll) return;
        document.querySelectorAll('.plan-segment-reorder-drop-target-overlay').forEach((overlay) => {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        });
    }

    function clearReorderDropTargetVisuals() {
        clearReorderDropTargetHighlights();
        removeReorderDropTargetOverlay();
    }

    function ensureReorderDropTargetOverlay() {
        if (typeof document === 'undefined' || !document.createElement || !document.body) return null;
        let overlay = document.querySelector
            ? document.querySelector('.plan-segment-reorder-drop-target-overlay')
            : (document.querySelectorAll ? document.querySelectorAll('.plan-segment-reorder-drop-target-overlay')[0] : null);
        if (overlay) return overlay;
        overlay = document.createElement('div');
        overlay.className = 'plan-segment-reorder-drop-target-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        document.body.appendChild(overlay);
        return overlay;
    }

    function updateReorderDropTargetOverlay(host, options = {}) {
        const rect = host && host.getBoundingClientRect ? host.getBoundingClientRect() : null;
        const overlay = rect ? ensureReorderDropTargetOverlay() : null;
        if (!overlay) return;
        overlay.className = 'plan-segment-reorder-drop-target-overlay';
        if (options.valid === false) overlay.classList.add('is-plan-segment-reorder-overlay-invalid');
        else overlay.classList.add('is-plan-segment-reorder-overlay-valid');
        if (options.empty) overlay.classList.add('is-plan-segment-reorder-overlay-empty');
        overlay.style.left = `${Math.round(rect.left)}px`;
        overlay.style.top = `${Math.round(rect.top)}px`;
        overlay.style.width = `${Math.max(0, Math.round(rect.width))}px`;
        overlay.style.height = `${Math.max(0, Math.round(rect.height))}px`;
        overlay.dataset.targetEmpty = options.empty ? 'true' : 'false';
        overlay.dataset.targetValid = options.valid === false ? 'false' : 'true';
    }

    function markReorderDropTarget(host, options = {}) {
        if (!host || !host.classList) return;
        host.classList.add('is-plan-segment-reorder-drop-target');
        if (options.empty) host.classList.add('is-plan-segment-reorder-empty-target');
        else host.classList.remove('is-plan-segment-reorder-empty-target');
        if (options.valid === false) host.classList.add('is-plan-segment-reorder-invalid-target');
        else host.classList.remove('is-plan-segment-reorder-invalid-target');
    }

    function removePlanSegmentReorderPreview() {
        if (typeof document !== 'undefined' && document.querySelectorAll) {
            document.querySelectorAll('.plan-segment-reorder-insert-marker').forEach((marker) => {
                if (marker.parentNode) marker.parentNode.removeChild(marker);
            });
            clearReorderDropTargetVisuals();
        }
        if (typeof document !== 'undefined' && document.querySelectorAll) {
            document.querySelectorAll('.plan-segment-reorder-preview-layer').forEach((layer) => {
                if (layer.parentNode) layer.parentNode.removeChild(layer);
            });
            document.querySelectorAll('.plan-segment-reorder-drag-ghost').forEach((ghost) => {
                if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
            });
            document.querySelectorAll('.is-plan-segment-reorder-armed, .is-plan-segment-reorder-suppressing-selection, .is-plan-segment-reorder-dragging, .is-plan-segment-reorder-origin, .is-plan-segment-reorder-active, .is-plan-segment-reorder-cancel, .is-previewing-plan-reorder, .is-plan-segment-reorder-drop-target, .is-plan-segment-reorder-empty-target, .is-plan-segment-reorder-invalid-target')
                .forEach((el) => {
                    if (el.classList) {
                        el.classList.remove(
                            'is-plan-segment-reorder-armed',
                            'is-plan-segment-reorder-suppressing-selection',
                            'is-plan-segment-reorder-dragging',
                            'is-plan-segment-reorder-origin',
                            'is-plan-segment-reorder-active',
                            'is-plan-segment-reorder-cancel',
                            'is-previewing-plan-reorder',
                            'is-plan-segment-reorder-drop-target',
                            'is-plan-segment-reorder-empty-target',
                            'is-plan-segment-reorder-invalid-target'
                        );
                    }
                });
            if (document.body && document.body.classList) {
                document.body.classList.remove('is-plan-segment-reorder-ghost-active');
            }
        }
    }

    function preventNativeBrowserGesture(event) {
        if (!event) return;
        if (event.cancelable === false) return;
        if (typeof event.preventDefault === 'function') event.preventDefault();
        if (typeof event.stopPropagation === 'function') event.stopPropagation();
    }

    function clearNativeSelection() {
        const doc = typeof document !== 'undefined' ? document : null;
        const selection = doc && typeof doc.getSelection === 'function'
            ? doc.getSelection()
            : (root && typeof root.getSelection === 'function' ? root.getSelection() : null);
        if (selection && typeof selection.removeAllRanges === 'function') {
            try {
                selection.removeAllRanges();
            } catch (_) {}
        }
    }

    function setReorderSuppressionClasses(state, enabled) {
        if (!state) return;
        [
            state.segmentEl,
            state.grid,
        ].forEach((el) => {
            if (!el || !el.classList) return;
            if (enabled) {
                el.classList.add('is-plan-segment-reorder-armed');
            } else {
                el.classList.remove(
                    'is-plan-segment-reorder-armed',
                    'is-plan-segment-reorder-suppressing-selection'
                );
            }
        });
    }

    function addReorderBrowserGestureSuppression(state) {
        if (!state || state.onSuppressBrowserGesture) return;
        const targets = [];
        [state.segmentEl, state.grid].forEach((target) => {
            if (!target || typeof target.addEventListener !== 'function' || targets.includes(target)) return;
            targets.push(target);
        });
        state.suppressionTargets = targets;
        state.onSuppressBrowserGesture = (event) => {
            if (!state.armed && !state.active) return;
            preventNativeBrowserGesture(event);
            clearNativeSelection();
        };
        targets.forEach((target) => {
            BROWSER_GESTURE_SUPPRESSION_EVENTS.forEach((type) => {
                target.addEventListener(type, state.onSuppressBrowserGesture, true);
            });
        });
    }

    function removeReorderBrowserGestureSuppression(state) {
        if (!state || !state.onSuppressBrowserGesture || !Array.isArray(state.suppressionTargets)) return;
        state.suppressionTargets.forEach((target) => {
            if (!target || typeof target.removeEventListener !== 'function') return;
            BROWSER_GESTURE_SUPPRESSION_EVENTS.forEach((type) => {
                target.removeEventListener(type, state.onSuppressBrowserGesture, true);
            });
        });
        state.onSuppressBrowserGesture = null;
        state.suppressionTargets = [];
    }

    function captureReorderPointer(state) {
        if (!state || state.pointerId == null || !state.segmentEl || typeof state.segmentEl.setPointerCapture !== 'function') return;
        try {
            state.segmentEl.setPointerCapture(state.pointerId);
            state.didSetPointerCapture = true;
        } catch (_) {}
    }

    function releaseReorderPointer(state) {
        if (!state || !state.didSetPointerCapture || state.pointerId == null || !state.segmentEl || typeof state.segmentEl.releasePointerCapture !== 'function') return;
        try {
            state.segmentEl.releasePointerCapture(state.pointerId);
        } catch (_) {}
        state.didSetPointerCapture = false;
    }

    function buildPreviewChunks(layout = []) {
        const chunks = [];
        layout.forEach((item) => {
            const startUnit = Math.max(0, Math.floor((Number(item.startMinute) || 0) / 10));
            const endUnit = Math.max(startUnit, Math.floor((Number(item.endMinute) || 0) / 10));
            let cursor = startUnit;
            let chunkIndex = 0;
            while (cursor < endUnit) {
                const rowRemaining = 6 - (cursor % 6 || 0);
                const span = Math.max(1, Math.min(endUnit - cursor, rowRemaining));
                chunks.push({ item, span, chunkIndex });
                cursor += span;
                chunkIndex += 1;
            }
        });
        return chunks;
    }

    function setStyleProperty(el, name, value) {
        if (!el || !el.style || value == null || value === '') return;
        if (typeof el.style.setProperty === 'function') {
            el.style.setProperty(name, String(value));
        } else {
            el.style[name] = String(value);
        }
    }

    function getPreviewSourceSegment(payload, item) {
        const slot = payload && payload.slot;
        const planActivities = Array.isArray(slot && slot.planActivities) ? slot.planActivities : [];
        const sourceIndex = Number.isInteger(Number(item && item.previousRealIndex))
            ? Number(item.previousRealIndex)
            : (Number.isInteger(Number(item && item.realIndex)) ? Number(item.realIndex) : null);
        if (sourceIndex == null || !planActivities[sourceIndex]) return null;
        return planActivities[sourceIndex];
    }

    function appendReorderPreviewSegment(ctx, layer, chunk, payload) {
        const item = chunk && chunk.item ? chunk.item : {};
        const span = Number.isFinite(Number(chunk && chunk.span)) ? Math.max(1, Math.floor(Number(chunk.span))) : 1;
        const isRest = item.type === 'virtual-rest' || item.kind === 'virtual-rest' || item.virtual === true;
        const segmentEl = document.createElement('div');

        segmentEl.dataset.previewReorderId = String(item.reorderId || '');
        setStyleProperty(segmentEl, 'grid-column', `span ${span}`);

        if (isRest) {
            const label = document.createElement('span');
            segmentEl.className = 'split-grid-segment split-grid-segment-virtual-rest plan-segment-reorder-preview-rest';
            segmentEl.dataset.segmentKind = 'virtual-rest';
            segmentEl.dataset.reorderItemType = 'virtual-rest';
            label.className = 'split-grid-label';
            label.textContent = Number(chunk.chunkIndex) === 0 ? '휴식' : '';
            segmentEl.appendChild(label);
            layer.appendChild(segmentEl);
            return;
        }

        const source = getPreviewSourceSegment(payload, item) || {};
        const segmentLabel = String(source.activityText || source.label || item.label || '');
        const titleLabel = String(source.titleText || item.titleLabel || '');
        const durationMinutes = Number.isFinite(Number(item.durationMinutes))
            ? Math.max(0, Math.floor(Number(item.durationMinutes)))
            : span * 10;
        const isContinuation = Number(chunk.chunkIndex) > 0;
        const graphic = document.createElement('div');
        const main = document.createElement('div');
        const graphicLabel = document.createElement('span');
        const labelText = document.createElement('span');
        const timerRow = document.createElement('span');
        const duration = document.createElement('span');

        segmentEl.className = 'split-grid-segment has-plan-segment-timer plan-segment-reorder-preview-real';
        segmentEl.dataset.segmentKind = 'real-plan';
        segmentEl.dataset.reorderItemType = 'real';
        if (Number.isInteger(Number(item.realIndex))) {
            segmentEl.dataset.segmentIndex = String(item.realIndex);
        }
        const color = typeof ctx.getSplitColor === 'function'
            ? ctx.getSplitColor('planned', segmentLabel, source.isExtra, source.reservedIndices, 'grid')
            : '';
        setStyleProperty(segmentEl, '--split-segment-color', color);

        graphic.className = isContinuation
            ? 'plan-segment-graphic is-plan-segment-continuation'
            : 'plan-segment-graphic';
        main.className = titleLabel && !isContinuation
            ? 'plan-segment-graphic-main has-segment-title'
            : 'plan-segment-graphic-main';
        if (titleLabel && !isContinuation) {
            const title = document.createElement('span');
            title.className = 'plan-segment-graphic-title';
            title.title = titleLabel;
            title.textContent = titleLabel;
            main.appendChild(title);
        }
        graphicLabel.className = 'plan-segment-graphic-label';
        graphicLabel.title = segmentLabel;
        labelText.className = 'plan-segment-label-text';
        labelText.textContent = segmentLabel;
        graphicLabel.appendChild(labelText);
        timerRow.className = 'plan-segment-timer-row';
        duration.className = 'plan-segment-timer-time tone-under';
        duration.textContent = `${durationMinutes}m`;
        timerRow.appendChild(duration);
        main.appendChild(graphicLabel);
        main.appendChild(timerRow);
        graphic.appendChild(main);
        segmentEl.appendChild(graphic);
        layer.appendChild(segmentEl);
    }

    function renderReorderPreview(ctx, grid, layout, payload = null) {
        if (!grid || !Array.isArray(layout) || layout.length <= 0 || typeof document === 'undefined') return;
        let layer = grid.querySelector && grid.querySelector('.plan-segment-reorder-preview-layer');
        if (!layer) {
            layer = document.createElement('div');
            layer.className = 'plan-segment-reorder-preview-layer';
            layer.setAttribute('aria-hidden', 'true');
            grid.appendChild(layer);
        }
        layer.innerHTML = '';
        buildPreviewChunks(layout).forEach((chunk) => appendReorderPreviewSegment(ctx, layer, chunk, payload));
        if (grid.classList) grid.classList.add('is-previewing-plan-reorder');
    }

    function removeListenerSensitiveAttributes(el) {
        if (!el) return;
        if (typeof el.removeAttribute === 'function') {
            el.removeAttribute('id');
            el.removeAttribute('aria-describedby');
            el.removeAttribute('aria-controls');
        } else if (el.attributes) {
            delete el.attributes.id;
            delete el.attributes['aria-describedby'];
            delete el.attributes['aria-controls'];
        }
        if (el.dataset) {
            Object.keys(el.dataset)
                .filter((key) => /listener|suppress/i.test(key))
                .forEach((key) => {
                    delete el.dataset[key];
                });
        }
    }

    function sanitizeReorderDragGhostNode(el) {
        if (!el) return;
        removeListenerSensitiveAttributes(el);
        if (el.classList) {
            el.classList.remove(
                'is-plan-segment-reorder-armed',
                'is-plan-segment-reorder-suppressing-selection',
                'is-plan-segment-reorder-dragging',
                'is-plan-segment-reorder-origin',
                'is-selected-plan-segment'
            );
            el.classList.add('plan-segment-reorder-drag-ghost');
        }
        if (typeof el.querySelectorAll === 'function') {
            el.querySelectorAll('*').forEach((child) => removeListenerSensitiveAttributes(child));
        }
        if (el.setAttribute) {
            el.setAttribute('aria-hidden', 'true');
        }
    }

    function createFallbackReorderDragGhost(state) {
        if (!state || !state.segmentEl || typeof document === 'undefined' || !document.createElement) return null;
        const source = state.segmentEl;
        const ghost = document.createElement('div');
        ghost.className = source.className || 'split-grid-segment';
        if (source.dataset) {
            Object.keys(source.dataset).forEach((key) => {
                if (/listener|suppress/i.test(key)) return;
                ghost.dataset[key] = source.dataset[key];
            });
        }
        if (source.style && ghost.style) {
            Object.keys(source.style)
                .filter((key) => key !== 'setProperty')
                .forEach((key) => {
                    ghost.style[key] = source.style[key];
                });
        }
        if (source.innerHTML != null) {
            ghost.innerHTML = source.innerHTML;
        }
        return ghost;
    }

    function getDragGhostHost() {
        if (typeof document === 'undefined') return null;
        return document.body || document.documentElement || null;
    }

    function updateReorderDragGhost(state, point) {
        if (!state || !state.dragGhostEl || !point) return;
        const left = point.clientX - (Number(state.dragGhostOffsetX) || 0);
        const top = point.clientY - (Number(state.dragGhostOffsetY) || 0);
        if (state.dragGhostEl.style) {
            state.dragGhostEl.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
        }
        state.dragGhostX = left;
        state.dragGhostY = top;
    }

    function createReorderDragGhost(ctx, state) {
        if (!state || state.dragGhostEl || !state.segmentEl || typeof document === 'undefined') return null;
        const host = getDragGhostHost();
        if (!host || typeof host.appendChild !== 'function') return null;
        const rect = state.segmentEl.getBoundingClientRect ? state.segmentEl.getBoundingClientRect() : null;
        const width = rect && Number.isFinite(rect.width) ? rect.width : 0;
        const height = rect && Number.isFinite(rect.height) ? rect.height : 0;
        const ghost = typeof state.segmentEl.cloneNode === 'function'
            ? state.segmentEl.cloneNode(true)
            : createFallbackReorderDragGhost(state);
        if (!ghost) return null;
        sanitizeReorderDragGhostNode(ghost);
        if (ghost.style) {
            ghost.style.position = 'fixed';
            ghost.style.left = '0px';
            ghost.style.top = '0px';
            if (width > 0) ghost.style.width = `${Math.round(width)}px`;
            if (height > 0) ghost.style.height = `${Math.round(height)}px`;
            ghost.style.gridColumn = '';
            ghost.style.pointerEvents = 'none';
        }
        state.dragGhostOffsetX = rect && Number.isFinite(rect.left) ? state.startX - rect.left : width / 2;
        state.dragGhostOffsetY = rect && Number.isFinite(rect.top) ? state.startY - rect.top : height / 2;
        host.appendChild(ghost);
        state.dragGhostEl = ghost;
        if (document.body && document.body.classList) {
            document.body.classList.add('is-plan-segment-reorder-ghost-active');
        }
        updateReorderDragGhost(state, { clientX: state.startX, clientY: state.startY });
        return ghost;
    }

    function removeReorderDragGhost(state) {
        if (!state) return;
        const ghost = state.dragGhostEl;
        if (ghost && ghost.parentNode) {
            ghost.parentNode.removeChild(ghost);
        }
        state.dragGhostEl = null;
        if (typeof document !== 'undefined' && document.body && document.body.classList) {
            document.body.classList.remove('is-plan-segment-reorder-ghost-active');
        }
    }

    function ensureInsertionMarker(grid) {
        if (!grid || typeof document === 'undefined' || !document.createElement) return null;
        let marker = grid.querySelector && grid.querySelector('.plan-segment-reorder-insert-marker');
        if (marker) return marker;
        marker = document.createElement('div');
        marker.className = 'plan-segment-reorder-insert-marker';
        marker.setAttribute('aria-hidden', 'true');
        grid.appendChild(marker);
        return marker;
    }

    function getSegmentAtPoint(grid, point) {
        if (!grid || !point || typeof grid.querySelectorAll !== 'function') return null;
        const segments = Array.from(grid.querySelectorAll('.split-grid-segment[data-segment-kind="real-plan"], .split-grid-segment-virtual-rest[data-segment-kind="virtual-rest"]'));
        return segments.find((segment) => {
            const rect = segment && segment.getBoundingClientRect ? segment.getBoundingClientRect() : null;
            return rect && pointInRect(point, rect);
        }) || null;
    }

    function updateInsertionMarker(grid, targetSegment, placement) {
        const marker = ensureInsertionMarker(grid);
        if (!marker || !targetSegment) return;
        const gridRect = grid.getBoundingClientRect ? grid.getBoundingClientRect() : null;
        const targetRect = targetSegment.getBoundingClientRect ? targetSegment.getBoundingClientRect() : null;
        if (!gridRect || !targetRect) return;
        const left = placement === 'after'
            ? targetRect.right - gridRect.left
            : targetRect.left - gridRect.left;
        marker.style.left = `${Math.round(left)}px`;
        marker.style.top = `${Math.round(targetRect.top - gridRect.top)}px`;
        marker.style.height = `${Math.max(12, Math.round(targetRect.height))}px`;
        marker.dataset.targetSegmentIndex = targetSegment.dataset ? String(targetSegment.dataset.segmentIndex || '') : '';
        marker.dataset.targetReorderId = getReorderItemId(targetSegment);
        marker.dataset.placement = placement;
    }

    function updateEmptyTargetMarker(targetHost, invalid = false) {
        markReorderDropTarget(targetHost, { valid: !invalid, empty: true, crossSlot: true });
    }

    function clearPlannedSegmentReorderState() {
        const state = this.plannedSegmentReorderState;
        if (state && state.timer) clearTimeout(state.timer);
        removeReorderDragGhost(state);
        removeReorderBrowserGestureSuppression(state);
        releaseReorderPointer(state);
        setReorderSuppressionClasses(state, false);
        if (state && state.moveType && typeof document !== 'undefined') {
            document.removeEventListener(state.moveType, state.onMove, state.listenerOptions);
            document.removeEventListener(state.upType, state.onUp, state.listenerOptions);
            if (state.cancelType) document.removeEventListener(state.cancelType, state.onCancel, state.listenerOptions);
            document.removeEventListener('keydown', state.onKeyDown, true);
        }
        this.plannedSegmentReorderState = null;
        removePlanSegmentReorderPreview();
    }

    function getActiveDropTarget(state, point) {
        const grid = state && state.grid;
        const gridRect = grid && grid.getBoundingClientRect ? grid.getBoundingClientRect() : null;
        if (!grid || !gridRect || !pointInRect(point, gridRect)) return null;
        const targetSegment = getSegmentAtPoint(grid, point);
        if (!targetSegment || targetSegment === state.segmentEl) return null;
        const targetId = getReorderItemId(targetSegment);
        if (!targetId || targetId === state.sourceId) return null;
        const rect = targetSegment.getBoundingClientRect ? targetSegment.getBoundingClientRect() : null;
        if (!rect) return null;
        const placement = point.clientX >= rect.left + (rect.width / 2) ? 'after' : 'before';
        return { targetGrid: grid, targetBaseIndex: state.context.baseIndex, targetSegment, targetId, placement, insertIndex: null };
    }

    function getDropHostBaseIndex(host, fallbackIndex, ctx = null) {
        if (!host) return fallbackIndex;
        const candidates = [host];
        if (host.closest) {
            candidates.push(
                host.closest('.time-entry'),
                host.closest('.split-cell-wrapper'),
                host.closest('.planned-input'),
                host.closest('.planned-merged-main-container')
            );
        }
        for (const el of candidates) {
            const raw = el && el.dataset && (el.dataset.index || el.dataset.baseIndex || el.dataset.plannedBaseIndex);
            const parsed = parseInt(raw, 10);
            if (Number.isInteger(parsed)) {
                const context = ctx ? getResolvedPlannedContext(ctx, parsed) : null;
                return context && Number.isInteger(context.baseIndex) ? context.baseIndex : parsed;
            }
        }
        return fallbackIndex;
    }

    function getGridBaseIndex(grid, fallbackIndex, ctx = null) {
        return getDropHostBaseIndex(grid, fallbackIndex, ctx);
    }

    function isPlannedDropHost(el) {
        if (!el || !el.classList || !el.classList.contains) return false;
        if (el.classList.contains('split-cell-wrapper') && el.classList.contains('split-type-planned')) return true;
        if (el.classList.contains('planned-input')) return true;
        if (el.classList.contains('planned-merged-main-container')) return true;
        if (el.classList.contains('time-entry')) return true;
        return false;
    }

    function resolveVisiblePlannedDropHost(host, point) {
        if (!host) return null;
        const matchesPoint = (el) => {
            const rect = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
            return rect && (!point || pointInRect(point, rect));
        };
        if (host.closest) {
            const merged = host.closest('.planned-merged-main-container');
            if (merged) return merged;
            const wrapper = host.closest('.split-cell-wrapper.split-type-planned');
            if (wrapper) return wrapper;
            const input = host.closest('.planned-input');
            if (input) return input;
        }
        if (host.querySelectorAll) {
            const plannedChildren = Array.from(host.querySelectorAll('.planned-merged-main-container, .split-cell-wrapper.split-type-planned, .planned-input'));
            const childAtPoint = plannedChildren.find(matchesPoint);
            if (childAtPoint) return childAtPoint;
            if (plannedChildren.length) return plannedChildren[0];
        }
        return host;
    }

    function getPlannedDropHostAtPoint(point) {
        if (!point || typeof document === 'undefined' || !document.querySelectorAll) return null;
        const grids = Array.from(document.querySelectorAll('.split-visualization-planned .split-grid, .split-grid'));
        const targetGrid = grids.find((grid) => {
            const rect = grid && grid.getBoundingClientRect ? grid.getBoundingClientRect() : null;
            return rect && pointInRect(point, rect);
        }) || null;
        if (targetGrid) {
            const plannedHost = targetGrid.closest && (
                targetGrid.closest('.planned-merged-main-container')
                || targetGrid.closest('.split-cell-wrapper.split-type-planned')
                || targetGrid.closest('.planned-input')
                || targetGrid.closest('.time-entry')
            );
            return { targetHost: resolveVisiblePlannedDropHost(plannedHost || targetGrid, point), targetGrid, emptyPlannedTarget: false };
        }

        const hosts = Array.from(document.querySelectorAll('.split-cell-wrapper.split-type-planned, .planned-input, .planned-merged-main-container, .time-entry'));
        const targetHost = hosts.find((host) => {
            if (!isPlannedDropHost(host)) return false;
            const rect = host && host.getBoundingClientRect ? host.getBoundingClientRect() : null;
            return rect && pointInRect(point, rect);
        }) || null;
        if (!targetHost) return null;
        const visibleHost = resolveVisiblePlannedDropHost(targetHost, point);
        const nestedGrid = visibleHost && visibleHost.querySelector && visibleHost.querySelector('.split-grid');
        return {
            targetHost: visibleHost || targetHost,
            targetGrid: nestedGrid || null,
            emptyPlannedTarget: !nestedGrid,
        };
    }

    function getPlannedGridAtPoint(point) {
        const dropHost = getPlannedDropHostAtPoint(point);
        return dropHost ? dropHost.targetGrid : null;
    }

    function getRealSegmentCount(ctx, context) {
        const slot = ctx.timeSlots && ctx.timeSlots[context.baseIndex];
        return getBlockRelativePlanActivities(ctx, getPlanActivities(ctx, slot), context).length;
    }

    function canCrossSlotFit(ctx, state, targetBaseIndex, targetSegment = null) {
        const sourceIndex = getRealIndexFromReorderId(state.sourceId);
        if (sourceIndex == null) return false;
        const sourceSlot = ctx.timeSlots && ctx.timeSlots[state.context.baseIndex];
        const targetContext = getResolvedPlannedContext(ctx, targetBaseIndex);
        const targetSlot = ctx.timeSlots && ctx.timeSlots[targetContext.baseIndex];
        if (!sourceSlot || !targetSlot || targetContext.baseIndex === state.context.baseIndex) return false;
        const sourceItems = getBlockRelativePlanActivities(ctx, getPlanActivities(ctx, sourceSlot), state.context);
        const targetItems = getBlockRelativePlanActivities(ctx, getPlanActivities(ctx, targetSlot), targetContext);
        const moving = sourceItems[sourceIndex];
        const movingDuration = getSegmentDurationMinutes(moving);
        if (isVirtualRestSegment(targetSegment)) {
            return movingDuration > 0 && getRestTargetDurationMinutes(targetSegment) >= 1;
        }
        const targetUsed = targetItems.reduce((sum, item) => sum + getSegmentDurationMinutes(item), 0);
        return movingDuration > 0 && targetUsed + movingDuration <= Math.max(0, Number(targetContext.blockMinutes) || 60);
    }

    function getAnyActiveDropTarget(ctx, state, point) {
        const dropHost = getPlannedDropHostAtPoint(point);
        if (!dropHost || !dropHost.targetHost) return null;
        const targetGrid = dropHost.targetGrid;
        const targetHost = dropHost.targetHost;
        const targetBaseIndex = getDropHostBaseIndex(targetGrid || targetHost, state.context.baseIndex, ctx);
        if (targetBaseIndex === state.context.baseIndex) return getActiveDropTarget(state, point);

        const targetSegment = getSegmentAtPoint(targetGrid, point);
        const valid = canCrossSlotFit(ctx, state, targetBaseIndex, targetSegment);
        if (!targetGrid || !targetSegment) {
            return {
                targetGrid,
                targetHost,
                targetBaseIndex,
                targetSegment: null,
                targetId: '',
                placement: 'empty',
                insertIndex: 0,
                valid,
                crossSlot: true,
            };
        }
        if (isVirtualRestSegment(targetSegment)) {
            const targetContext = getResolvedPlannedContext(ctx, targetBaseIndex);
            const restStartMinute = getRestTargetStartMinute(targetSegment);
            const restDurationMinutes = getRestTargetDurationMinutes(targetSegment);
            return {
                targetGrid,
                targetHost: targetSegment,
                targetBaseIndex,
                targetSegment,
                targetId: getReorderItemId(targetSegment),
                placement: 'rest',
                insertIndex: getInsertIndexForRestTarget(ctx, targetContext, restStartMinute),
                valid,
                crossSlot: true,
                restStartMinute,
                restDurationMinutes,
            };
        }
        const targetId = getReorderItemId(targetSegment);
        const rect = targetSegment.getBoundingClientRect ? targetSegment.getBoundingClientRect() : null;
        const placement = rect && point.clientX >= rect.left + (rect.width / 2) ? 'after' : 'before';
        const targetRealIndex = getRealIndexFromReorderId(targetId);
        const insertIndex = targetRealIndex == null
            ? getRealSegmentCount(ctx, getResolvedPlannedContext(ctx, targetBaseIndex))
            : targetRealIndex + (placement === 'after' ? 1 : 0);
        return {
            targetGrid,
            targetHost,
            targetBaseIndex,
            targetSegment,
            targetId,
            placement,
            insertIndex,
            valid,
            crossSlot: true,
        };
    }

    function updateReorderPreview(ctx, state, dropTarget) {
        if (!state || !dropTarget) return false;
        if (dropTarget.crossSlot) {
            const previewKey = `cross:${dropTarget.targetBaseIndex}:${dropTarget.insertIndex}:${dropTarget.valid}:${dropTarget.restDurationMinutes || ''}`;
            const nextTargetHost = dropTarget.targetHost || dropTarget.targetGrid;
            clearReorderDropTargetVisuals();
            if (state.previewKey === previewKey && state.targetHost === nextTargetHost) {
                updateReorderDropTargetOverlay(nextTargetHost, { valid: dropTarget.valid, empty: !dropTarget.targetSegment, crossSlot: true });
                markReorderDropTarget(nextTargetHost, { valid: dropTarget.valid, empty: !dropTarget.targetSegment, crossSlot: true });
                return Boolean(dropTarget.valid);
            }
            clearReorderPreviewLayer(state.grid);
            if (state.targetGrid && state.targetGrid !== state.grid) clearReorderPreviewLayer(state.targetGrid);
            if (state.targetHost && state.targetHost !== state.grid && state.targetHost !== state.targetGrid) clearReorderPreviewLayer(state.targetHost);
            state.previewKey = previewKey;
            state.targetGrid = dropTarget.targetGrid;
            state.targetHost = nextTargetHost;
            const targetHost = nextTargetHost;
            if (!dropTarget.valid) {
                markReorderDropTarget(targetHost, { valid: false, empty: !dropTarget.targetSegment, crossSlot: true });
                updateReorderDropTargetOverlay(targetHost, { valid: false, empty: !dropTarget.targetSegment, crossSlot: true });
                if (!dropTarget.targetSegment) updateEmptyTargetMarker(targetHost, true);
                return false;
            }
            markReorderDropTarget(targetHost, { valid: true, empty: !dropTarget.targetSegment, crossSlot: true });
            updateReorderDropTargetOverlay(targetHost, { valid: true, empty: !dropTarget.targetSegment, crossSlot: true });
            if (dropTarget.targetSegment) {
                updateInsertionMarker(dropTarget.targetGrid, dropTarget.targetSegment, dropTarget.placement);
            } else {
                updateEmptyTargetMarker(targetHost);
            }
            return true;
        }
        const previewKey = `${dropTarget.targetId}:${dropTarget.placement}`;
        if (state.previewKey === previewKey && state.previewResult) return true;
        const payload = getReorderResult(ctx, state.context.baseIndex, state.sourceId, dropTarget.targetId, dropTarget.placement);
        const result = payload && payload.result;
        if (!result || !result.changed || !Array.isArray(result.layout)) {
            state.previewKey = '';
            state.previewResult = null;
            clearReorderPreviewLayer(state.grid);
            return false;
        }
        state.previewKey = previewKey;
        state.previewResult = result;
        renderReorderPreview(ctx, state.grid, result.layout, payload);
        return true;
    }

    function activateReorderDrag(ctx, state) {
        if (!state || state.active) return;
        state.active = true;
        state.armed = true;
        if (state.timer) {
            clearTimeout(state.timer);
            state.timer = null;
        }
        preventNativeBrowserGesture(state.startEvent);
        clearNativeSelection();
        captureReorderPointer(state);
        createReorderDragGhost(ctx, state);
        ctx.planSegmentReorderClickSuppressUntil = Date.now() + CLICK_SUPPRESS_MS;
        if (state.segmentEl && state.segmentEl.dataset) {
            state.segmentEl.dataset.planReorderClickSuppressUntil = String(ctx.planSegmentReorderClickSuppressUntil);
        }
        if (typeof ctx.closePlanSegmentMobileTextEditor === 'function') {
            ctx.closePlanSegmentMobileTextEditor({ restoreFocus: false });
        }
        if (typeof ctx.closeInlinePlanDropdown === 'function') {
            ctx.closeInlinePlanDropdown();
        }
        if (typeof ctx.cleanupPlanSegmentResizeState === 'function') {
            ctx.cleanupPlanSegmentResizeState(state.grid);
        }
        if (state.segmentEl && state.segmentEl.classList) {
            state.segmentEl.classList.add(
                'is-plan-segment-reorder-dragging',
                'is-plan-segment-reorder-origin',
                'is-plan-segment-reorder-suppressing-selection'
            );
        }
        if (state.grid && state.grid.classList) {
            state.grid.classList.add(
                'is-plan-segment-reorder-active',
                'is-plan-segment-reorder-suppressing-selection'
            );
        }
    }

    function attachPlannedSegmentReorderListeners(entryDiv, index) {
        if (!entryDiv || typeof entryDiv.querySelectorAll !== 'function') return;
        const segments = entryDiv.querySelectorAll('.split-grid-segment[data-segment-kind="real-plan"], .split-grid-segment-virtual-rest[data-segment-kind="virtual-rest"]');
        segments.forEach((segmentEl) => {
            if (!segmentEl || segmentEl.dataset.planSegmentReorderListenerAttached === 'true') return;
            segmentEl.dataset.planSegmentReorderListenerAttached = 'true';

            segmentEl.addEventListener('click', (event) => {
                const datasetSuppressUntil = Number(segmentEl.dataset ? segmentEl.dataset.planReorderClickSuppressUntil : NaN);
                const stateSuppressUntil = Number(this.planSegmentReorderClickSuppressUntil);
                const suppressUntil = Math.max(
                    Number.isFinite(datasetSuppressUntil) ? datasetSuppressUntil : 0,
                    Number.isFinite(stateSuppressUntil) ? stateSuppressUntil : 0
                );
                if (Number.isFinite(suppressUntil) && Date.now() < suppressUntil) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            }, true);

            const start = (event) => {
                const isPointerEvent = event && event.type === 'pointerdown';
                const isTouchEvent = event && event.type === 'touchstart';
                if (!isTouchEvent && event && event.button != null && event.button !== 0) return;
                if (isBlockedReorderStart(this, event, segmentEl)) return;
                const point = getPointFromEvent(event);
                if (!point) return;
                const sourceId = getReorderItemId(segmentEl);
                if (!sourceId) return;
                const grid = segmentEl.closest && segmentEl.closest('.split-grid');
                if (!grid) return;
                clearPlannedSegmentReorderState.call(this);

                const moveType = isTouchEvent ? 'touchmove' : 'pointermove';
                const upType = isTouchEvent ? 'touchend' : 'pointerup';
                const cancelType = isTouchEvent ? 'touchcancel' : 'pointercancel';
                const listenerOptions = isTouchEvent ? { capture: true, passive: false } : true;
                const state = {
                    armed: true,
                    active: false,
                    cancelled: false,
                    timer: null,
                    index,
                    context: getResolvedPlannedContext(this, index),
                    sourceId,
                    segmentEl,
                    grid,
                    startX: point.clientX,
                    startY: point.clientY,
                    startEvent: event,
                    pointerId: isPointerEvent ? event.pointerId : null,
                    didSetPointerCapture: false,
                    targetId: null,
                    targetBaseIndex: null,
                    targetInsertIndex: null,
                    targetRestDuration: null,
                    targetGrid: null,
                    targetHost: null,
                    targetValid: false,
                    crossSlot: false,
                    placement: 'before',
                    previewKey: '',
                    previewResult: null,
                    moveType,
                    upType,
                    cancelType,
                    listenerOptions,
                    onMove: null,
                    onUp: null,
                    onCancel: null,
                    onKeyDown: null,
                    onSuppressBrowserGesture: null,
                    suppressionTargets: [],
                };
                setReorderSuppressionClasses(state, true);
                addReorderBrowserGestureSuppression(state);

                state.onMove = (moveEvent) => {
                    const movePoint = getPointFromEvent(moveEvent);
                    if (!movePoint) return;
                    if (!state.active) {
                        const moved = Math.hypot(movePoint.clientX - state.startX, movePoint.clientY - state.startY);
                        if (moved > MOVE_THRESHOLD_PX) {
                            clearPlannedSegmentReorderState.call(this);
                        }
                        return;
                    }
                    if (moveEvent.preventDefault) moveEvent.preventDefault();
                    if (moveEvent.stopPropagation) moveEvent.stopPropagation();
                    updateReorderDragGhost(state, movePoint);
                    const dropTarget = getAnyActiveDropTarget(this, state, movePoint);
                    if (!dropTarget) {
                        state.targetId = null;
                        state.targetBaseIndex = null;
                        state.targetInsertIndex = null;
                        state.targetRestDuration = null;
                        state.targetValid = false;
                        state.crossSlot = false;
                        state.previewKey = '';
                        state.previewResult = null;
                        clearReorderPreviewLayer(state.grid);
                        if (state.targetGrid && state.targetGrid !== state.grid) clearReorderPreviewLayer(state.targetGrid);
                        if (state.targetHost && state.targetHost !== state.grid && state.targetHost !== state.targetGrid) clearReorderPreviewLayer(state.targetHost);
                        clearReorderDropTargetVisuals();
                        state.targetGrid = null;
                        state.targetHost = null;
                        if (state.grid.classList) state.grid.classList.add('is-plan-segment-reorder-cancel');
                        if (typeof document !== 'undefined' && document.querySelectorAll) {
                            document.querySelectorAll('.plan-segment-reorder-insert-marker').forEach((marker) => {
                                if (marker.parentNode) marker.parentNode.removeChild(marker);
                            });
                        }
                        return;
                    }
                    state.targetId = dropTarget.targetId;
                    state.targetBaseIndex = dropTarget.targetBaseIndex;
                    state.targetInsertIndex = dropTarget.insertIndex;
                    state.targetRestDuration = dropTarget.restDurationMinutes;
                    state.targetValid = dropTarget.crossSlot ? Boolean(dropTarget.valid) : true;
                    state.crossSlot = Boolean(dropTarget.crossSlot);
                    state.targetGrid = dropTarget.targetGrid || state.grid;
                    state.targetHost = dropTarget.targetHost || dropTarget.targetGrid || state.grid;
                    state.placement = dropTarget.placement;
                    if (state.grid.classList) {
                        if (dropTarget.crossSlot && !dropTarget.valid) {
                            state.grid.classList.add('is-plan-segment-reorder-cancel');
                        } else {
                            state.grid.classList.remove('is-plan-segment-reorder-cancel');
                        }
                    }
                    if (!dropTarget.crossSlot && dropTarget.targetSegment) {
                        updateInsertionMarker(state.grid, dropTarget.targetSegment, dropTarget.placement);
                    }
                    updateReorderPreview(this, state, dropTarget);
                };

                state.onUp = (upEvent) => {
                    const wasActive = state.active;
                    const targetId = state.targetId;
                    const placement = state.placement;
                    const crossSlot = state.crossSlot;
                    const targetBaseIndex = state.targetBaseIndex;
                    const targetInsertIndex = state.targetInsertIndex;
                    const targetRestDuration = state.targetRestDuration;
                    const targetValid = state.targetValid;
                    if (wasActive) {
                        if (upEvent.preventDefault) upEvent.preventDefault();
                        if (upEvent.stopPropagation) upEvent.stopPropagation();
                    }
                    clearPlannedSegmentReorderState.call(this);
                    if (wasActive && crossSlot && targetValid && Number.isInteger(targetBaseIndex)) {
                        const sourceRealIndex = getRealIndexFromReorderId(state.sourceId);
                        applyPlanSegmentCrossSlotMove.call(this, state.context.baseIndex, sourceRealIndex, targetBaseIndex, targetInsertIndex, {
                            restDurationMinutes: targetRestDuration,
                        });
                    } else if (wasActive && targetId) {
                        applyPlanSegmentReorder.call(this, state.context.baseIndex, state.sourceId, targetId, placement);
                    }
                };

                state.onCancel = () => {
                    clearPlannedSegmentReorderState.call(this);
                };

                state.onKeyDown = (keyEvent) => {
                    if (keyEvent && keyEvent.key !== 'Escape') return;
                    clearPlannedSegmentReorderState.call(this);
                };

                state.timer = setTimeout(() => {
                    if (this.plannedSegmentReorderState !== state) return;
                    activateReorderDrag(this, state);
                }, LONG_PRESS_MS);
                this.plannedSegmentReorderState = state;

                document.addEventListener(moveType, state.onMove, listenerOptions);
                document.addEventListener(upType, state.onUp, listenerOptions);
                document.addEventListener(cancelType, state.onCancel, listenerOptions);
                document.addEventListener('keydown', state.onKeyDown, true);
            };

            segmentEl.addEventListener('pointerdown', start, true);
            segmentEl.addEventListener('touchstart', start, { capture: true, passive: false });
        });
    }

    return {
        applyPlanSegmentReorder,
        applyPlanSegmentCrossSlotMove,
        attachPlannedSegmentReorderListeners,
        clearPlannedSegmentReorderState,
        getAnyActiveDropTarget,
        getDropHostBaseIndex,
        getPlannedDropHostAtPoint,
        removePlanSegmentReorderPreview,
        remapPlanSegmentTimers,
        updateReorderPreview,
        LONG_PRESS_MS,
    };
});
