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
    const BLOCKED_START_SELECTOR = [
        '.plan-segment-resize-handle',
        '.plan-segment-timer-button',
        '.plan-segment-timer-time',
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

    function clearReorderPreviewLayer(grid) {
        if (!grid || typeof grid.querySelectorAll !== 'function') return;
        grid.querySelectorAll('.plan-segment-reorder-preview-layer').forEach((layer) => {
            if (layer.parentNode) layer.parentNode.removeChild(layer);
        });
        if (grid.classList) grid.classList.remove('is-previewing-plan-reorder');
    }

    function removePlanSegmentReorderPreview() {
        if (typeof document !== 'undefined' && document.querySelectorAll) {
            document.querySelectorAll('.plan-segment-reorder-insert-marker').forEach((marker) => {
                if (marker.parentNode) marker.parentNode.removeChild(marker);
            });
        }
        if (typeof document !== 'undefined' && document.querySelectorAll) {
            document.querySelectorAll('.plan-segment-reorder-preview-layer').forEach((layer) => {
                if (layer.parentNode) layer.parentNode.removeChild(layer);
            });
            document.querySelectorAll('.is-plan-segment-reorder-dragging, .is-plan-segment-reorder-origin, .is-plan-segment-reorder-active, .is-plan-segment-reorder-cancel, .is-previewing-plan-reorder')
                .forEach((el) => {
                    if (el.classList) {
                        el.classList.remove(
                            'is-plan-segment-reorder-dragging',
                            'is-plan-segment-reorder-origin',
                            'is-plan-segment-reorder-active',
                            'is-plan-segment-reorder-cancel',
                            'is-previewing-plan-reorder'
                        );
                    }
                });
        }
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

    function clearPlannedSegmentReorderState() {
        const state = this.plannedSegmentReorderState;
        if (state && state.timer) clearTimeout(state.timer);
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
        return { targetSegment, targetId, placement };
    }

    function updateReorderPreview(ctx, state, dropTarget) {
        if (!state || !dropTarget) return false;
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
        if (state.timer) {
            clearTimeout(state.timer);
            state.timer = null;
        }
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
            state.segmentEl.classList.add('is-plan-segment-reorder-dragging', 'is-plan-segment-reorder-origin');
        }
        if (state.grid && state.grid.classList) {
            state.grid.classList.add('is-plan-segment-reorder-active');
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
                    pointerId: isPointerEvent ? event.pointerId : null,
                    targetId: null,
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
                };

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
                    const dropTarget = getActiveDropTarget(state, movePoint);
                    if (!dropTarget) {
                        state.targetId = null;
                        state.previewKey = '';
                        state.previewResult = null;
                        clearReorderPreviewLayer(state.grid);
                        if (state.grid.classList) state.grid.classList.add('is-plan-segment-reorder-cancel');
                        if (state.grid.querySelectorAll) {
                            state.grid.querySelectorAll('.plan-segment-reorder-insert-marker').forEach((marker) => {
                                if (marker.parentNode) marker.parentNode.removeChild(marker);
                            });
                        }
                        return;
                    }
                    state.targetId = dropTarget.targetId;
                    state.placement = dropTarget.placement;
                    if (state.grid.classList) state.grid.classList.remove('is-plan-segment-reorder-cancel');
                    updateInsertionMarker(state.grid, dropTarget.targetSegment, dropTarget.placement);
                    updateReorderPreview(this, state, dropTarget);
                };

                state.onUp = (upEvent) => {
                    const wasActive = state.active;
                    const targetId = state.targetId;
                    const placement = state.placement;
                    if (wasActive) {
                        if (upEvent.preventDefault) upEvent.preventDefault();
                        if (upEvent.stopPropagation) upEvent.stopPropagation();
                    }
                    clearPlannedSegmentReorderState.call(this);
                    if (wasActive && targetId) {
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
            segmentEl.addEventListener('touchstart', start, { capture: true, passive: true });
        });
    }

    return {
        applyPlanSegmentReorder,
        attachPlannedSegmentReorderListeners,
        clearPlannedSegmentReorderState,
        removePlanSegmentReorderPreview,
        remapPlanSegmentTimers,
        LONG_PRESS_MS,
    };
});
