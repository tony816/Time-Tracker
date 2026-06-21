(function attachTimeTrackerPlannedSlotMoveController(root, factory) {
    const api = factory(root);

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        const existing = (root.TimeTrackerPlannedSlotMoveController && typeof root.TimeTrackerPlannedSlotMoveController === 'object')
            ? root.TimeTrackerPlannedSlotMoveController
            : {};
        root.TimeTrackerPlannedSlotMoveController = Object.assign(existing, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildTimeTrackerPlannedSlotMoveController(root) {
    const PLANNED_FIELDS = [
        'planned',
        'planActivities',
        'planTitle',
        'planTitleBandOn',
        'planSegmentTimers',
        'planMergeSnapshot',
    ];

    function cloneValue(value) {
        if (value == null) return value;
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (_) {
            if (Array.isArray(value)) return value.slice();
            if (typeof value === 'object') return { ...value };
            return value;
        }
    }

    function parseMergeKey(key) {
        if (!key || typeof key !== 'string') return null;
        const parts = key.split('-');
        if (parts.length !== 3) return null;
        const start = parseInt(parts[1], 10);
        const end = parseInt(parts[2], 10);
        if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
        return { type: parts[0], start: Math.min(start, end), end: Math.max(start, end) };
    }

    function isPlannedContentPresent(slot) {
        if (!slot) return false;
        if (String(slot.planned || '').trim()) return true;
        if (String(slot.planTitle || '').trim()) return true;
        if (Array.isArray(slot.planActivities) && slot.planActivities.length > 0) return true;
        if (slot.planSegmentTimers && typeof slot.planSegmentTimers === 'object' && Object.keys(slot.planSegmentTimers).length > 0) return true;
        if (slot.planMergeSnapshot && typeof slot.planMergeSnapshot === 'object') return true;
        return false;
    }

    function hasBlockingTimer(slot) {
        if (!slot) return false;
        if (slot.timer && slot.timer.running === true) return true;
        const timers = slot.planSegmentTimers && typeof slot.planSegmentTimers === 'object' ? slot.planSegmentTimers : {};
        return Object.values(timers).some((timer) => {
            const status = String(timer && timer.status || '').toLowerCase();
            return Boolean(timer && (timer.running === true || status === 'running' || status === 'active' || status === 'paused'));
        });
    }

    function remapPlanTimerKeys(timers, sourceStart, sourceEnd, targetStart, targetEnd) {
        const cloned = cloneValue(timers) || {};
        if (!cloned || typeof cloned !== 'object') return {};
        const sourcePrefix = `planned-${sourceStart}-${sourceEnd}`;
        const targetPrefix = `planned-${targetStart}-${targetEnd}`;
        return Object.entries(cloned).reduce((acc, [key, value]) => {
            const nextKey = String(key).startsWith(sourcePrefix)
                ? String(key).replace(sourcePrefix, targetPrefix)
                : key;
            acc[nextKey] = value;
            return acc;
        }, {});
    }

    function remapPlanMergeSnapshot(snapshot, sourceStart, sourceEnd, targetStart, targetEnd) {
        const cloned = cloneValue(snapshot);
        if (!cloned || typeof cloned !== 'object') return cloned;
        const sourceKey = `planned-${sourceStart}-${sourceEnd}`;
        const targetKey = `planned-${targetStart}-${targetEnd}`;
        if (cloned.mergeKey === sourceKey) cloned.mergeKey = targetKey;
        if (Number.isInteger(cloned.startIndex)) cloned.startIndex = targetStart;
        if (Number.isInteger(cloned.endIndex)) cloned.endIndex = targetEnd;
        if (Number.isInteger(cloned.rangeStart)) cloned.rangeStart = targetStart;
        if (Number.isInteger(cloned.rangeEnd)) cloned.rangeEnd = targetEnd;
        return cloned;
    }

    function initPlannedSlotMoveModeControls() {
        this.plannedSlotMoveModeButton = document.getElementById('plannedSlotMoveModeBtn');
        if (this.plannedSlotMoveModeButton && !this.plannedSlotMoveModeButton.dataset.moveModeBound) {
            this.plannedSlotMoveModeButton.dataset.moveModeBound = 'true';
            this.plannedSlotMoveModeButton.addEventListener('click', () => this.togglePlannedSlotMoveMode());
        }
        let status = document.querySelector('.planned-slot-move-status');
        if (!status) {
            const timesheet = document.querySelector('.timesheet');
            status = document.createElement('div');
            status.className = 'planned-slot-move-status';
            status.setAttribute('role', 'status');
            status.hidden = true;
            status.textContent = '\uC2AC\uB86F\uC744 \uC7A1\uC544 \uC774\uB3D9';
            if (timesheet) {
                const header = timesheet.querySelector('.header-row');
                timesheet.insertBefore(status, header ? header.nextSibling : timesheet.firstChild);
            }
        }
        this.plannedSlotMoveStatus = status;
        setPlannedSlotMoveModeUi.call(this);
    }

    function initPlannedSlotClearModeControls() {
        this.plannedSlotClearModeButton = document.getElementById('plannedSlotClearModeBtn');
        if (this.plannedSlotClearModeButton && !this.plannedSlotClearModeButton.dataset.clearModeBound) {
            this.plannedSlotClearModeButton.style.pointerEvents = 'auto';
            this.plannedSlotClearModeButton.dataset.clearModeBound = 'true';
            this.plannedSlotClearModeButton.addEventListener('click', () => this.togglePlannedSlotClearMode());
        }
        setPlannedSlotClearModeUi.call(this);
    }

    function setPlannedSlotMoveModeUi() {
        const enabled = Boolean(this.plannedSlotMoveMode);
        const roots = [
            document.documentElement,
            document.body,
            document.querySelector('.timesheet'),
            document.getElementById('timeEntries'),
        ].filter(Boolean);
        roots.forEach((el) => el.classList.toggle('planned-slot-move-mode', enabled));
        const pulse = enabled && Boolean(this.plannedSlotMovePulseActive);
        roots.forEach((el) => el.classList.toggle('planned-slot-move-pulse', pulse));
        if (this.plannedSlotMoveModeButton) {
            this.plannedSlotMoveModeButton.textContent = enabled ? '이동 완료' : '슬롯 이동';
            this.plannedSlotMoveModeButton.setAttribute('aria-pressed', enabled ? 'true' : 'false');
        }
        if (this.plannedSlotMoveStatus) {
            this.plannedSlotMoveStatus.hidden = !enabled;
        }
    }

    function setPlannedSlotClearModeUi() {
        const enabled = Boolean(this.plannedSlotClearMode);
        const roots = [
            document.documentElement,
            document.body,
            document.querySelector('.timesheet'),
            document.getElementById('timeEntries'),
        ].filter(Boolean);
        roots.forEach((el) => el.classList.toggle('planned-slot-clear-mode', enabled));
        if (this.plannedSlotClearModeButton) {
            this.plannedSlotClearModeButton.textContent = enabled ? '삭제 완료' : '슬롯 삭제';
            this.plannedSlotClearModeButton.setAttribute('aria-pressed', enabled ? 'true' : 'false');
        }
    }

    function setPlannedSlotMoveMode(enabled) {
        const next = Boolean(enabled);
        if (next === Boolean(this.plannedSlotMoveMode)) {
            setPlannedSlotMoveModeUi.call(this);
            return this.plannedSlotMoveMode;
        }
        if (next) {
            if (this.plannedSlotClearMode) {
                setPlannedSlotClearMode.call(this, false);
            }
            if (typeof this.closeInlinePlanDropdown === 'function') this.closeInlinePlanDropdown();
            if (typeof this.clearAllSelections === 'function') this.clearAllSelections();
            if (typeof this.hideHoverScheduleButton === 'function') this.hideHoverScheduleButton();
            if (typeof this.cancelPlanSegmentResize === 'function') this.cancelPlanSegmentResize();
            this.plannedSlotMovePulseActive = !this.plannedSlotMovePulseShown;
            this.plannedSlotMovePulseShown = true;
        } else {
            clearPlannedSlotMoveDragState.call(this);
            this.plannedSlotMovePulseActive = false;
        }
        this.plannedSlotMoveMode = next;
        setPlannedSlotMoveModeUi.call(this);
        if (typeof this.renderTimeEntries === 'function') this.renderTimeEntries(next ? false : true);
        if (next && this.plannedSlotMovePulseActive && typeof setTimeout === 'function') {
            setTimeout(() => {
                this.plannedSlotMovePulseActive = false;
                setPlannedSlotMoveModeUi.call(this);
            }, 1100);
        }
        return this.plannedSlotMoveMode;
    }

    function setPlannedSlotClearMode(enabled) {
        const next = Boolean(enabled);
        if (next === Boolean(this.plannedSlotClearMode)) {
            setPlannedSlotClearModeUi.call(this);
            return this.plannedSlotClearMode;
        }
        if (next) {
            if (this.plannedSlotMoveMode) {
                setPlannedSlotMoveMode.call(this, false);
            }
            if (typeof this.closeInlinePlanDropdown === 'function') this.closeInlinePlanDropdown();
            if (typeof this.clearAllSelections === 'function') this.clearAllSelections();
            if (typeof this.hideHoverScheduleButton === 'function') this.hideHoverScheduleButton();
            if (typeof this.cancelPlanSegmentResize === 'function') this.cancelPlanSegmentResize();
        }
        this.plannedSlotClearMode = next;
        setPlannedSlotClearModeUi.call(this);
        if (typeof this.renderTimeEntries === 'function') this.renderTimeEntries(next ? false : true);
        return this.plannedSlotClearMode;
    }

    function togglePlannedSlotMoveMode() {
        return setPlannedSlotMoveMode.call(this, !this.plannedSlotMoveMode);
    }

    function togglePlannedSlotClearMode() {
        return setPlannedSlotClearMode.call(this, !this.plannedSlotClearMode);
    }

    function isPlannedSlotMoveMode() {
        return Boolean(this && this.plannedSlotMoveMode);
    }

    function isPlannedSlotClearMode() {
        return Boolean(this && this.plannedSlotClearMode);
    }

    function getPlannedSlotClearContext(index) {
        const context = typeof this.resolvePlannedSlotContext === 'function'
            ? this.resolvePlannedSlotContext(index)
            : { baseIndex: index, rangeStart: index, rangeEnd: index, slotCount: 1, mergeKey: null };
        const rangeStart = Number.isInteger(context.rangeStart) ? context.rangeStart : context.baseIndex;
        const rangeEnd = Number.isInteger(context.rangeEnd) ? context.rangeEnd : rangeStart;
        const baseIndex = Number.isInteger(context.baseIndex) ? context.baseIndex : rangeStart;
        const blockLength = Math.max(1, rangeEnd - rangeStart + 1);
        const hasContent = Array.from({ length: blockLength }, (_, offset) => this.timeSlots[rangeStart + offset])
            .some((slot) => isPlannedContentPresent(slot));
        const mergedValue = context.mergeKey && this.mergedFields && typeof this.mergedFields.get === 'function'
            ? this.mergedFields.get(context.mergeKey)
            : '';
        return {
            ...context,
            baseIndex,
            rangeStart,
            rangeEnd,
            blockLength,
            clearable: Boolean(hasContent || String(mergedValue || '').trim()),
        };
    }

    function shouldRenderPlannedSlotClearButton(index) {
        if (!this || !this.plannedSlotClearMode) return false;
        if (this.plannedSlotMoveMode === true || (typeof this.isPlannedSlotMoveMode === 'function' && this.isPlannedSlotMoveMode())) return false;
        const context = getPlannedSlotClearContext.call(this, index);
        return Boolean(context.clearable && context.baseIndex === index);
    }

    function clearPlannedSlotContents(index) {
        const context = getPlannedSlotClearContext.call(this, index);
        if (!context.clearable) return false;
        const { rangeStart, rangeEnd, mergeKey } = context;
        for (let slotIndex = rangeStart; slotIndex <= rangeEnd; slotIndex += 1) {
            clearPlannedFields(this.timeSlots[slotIndex]);
        }
        if (mergeKey && this.mergedFields && typeof this.mergedFields.delete === 'function') {
            this.mergedFields.delete(mergeKey);
        }
        if (typeof this.renderTimeEntries === 'function') this.renderTimeEntries(true);
        if (typeof this.calculateTotals === 'function') this.calculateTotals();
        if (typeof this.autoSave === 'function') this.autoSave();
        if (typeof this.showNotification === 'function') this.showNotification('예정 슬롯을 지웠습니다.');
        return true;
    }

    function createPlannedSlotClearButtonHtml(index) {
        if (!shouldRenderPlannedSlotClearButton.call(this, index)) return '';
        return `<button type="button"
                        class="planned-slot-clear-btn"
                        data-index="${index}"
                        data-time-slot-merge-ignore="true"
                        aria-label="슬롯 삭제"
                        title="슬롯 삭제">
                    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="planned-slot-clear-icon">
                        <path d="M9 3.5h6l1 1.5H20v2h-1l-1 12.5A2 2 0 0 1 15 21H9a2 2 0 0 1-2-1.5L6 7H5v-2h4l0-1.5Zm1.6 5.5v8h1.8v-8h-1.8Zm3.8 0v8h1.8v-8h-1.8ZM8.1 7l.8 11.2c.04.52.47.93 1 .93h4.2c.53 0 .96-.41 1-.93L15.9 7H8.1Z"></path>
                    </svg>
                </button>`;
    }

    function getPlannedSlotMoveContext(index) {
        const context = typeof this.resolvePlannedSlotContext === 'function'
            ? this.resolvePlannedSlotContext(index)
            : { baseIndex: index, rangeStart: index, rangeEnd: index, slotCount: 1, mergeKey: null };
        const rangeStart = Number.isInteger(context.rangeStart) ? context.rangeStart : context.baseIndex;
        const rangeEnd = Number.isInteger(context.rangeEnd) ? context.rangeEnd : rangeStart;
        const blockLength = Math.max(1, rangeEnd - rangeStart + 1);
        const hasContent = Array.from({ length: blockLength }, (_, offset) => this.timeSlots[rangeStart + offset])
            .some((slot) => isPlannedContentPresent(slot));
        const mergedValue = context.mergeKey && this.mergedFields && typeof this.mergedFields.get === 'function'
            ? this.mergedFields.get(context.mergeKey)
            : '';
        const movable = Boolean(hasContent || String(mergedValue || '').trim());
        return {
            ...context,
            baseIndex: rangeStart,
            rangeStart,
            rangeEnd,
            blockLength,
            movable,
        };
    }

    function canDropPlannedSlotBlock(sourceContext, targetStartIndex) {
        if (!sourceContext || !sourceContext.movable) return false;
        const targetStart = Number.isInteger(targetStartIndex) ? targetStartIndex : parseInt(targetStartIndex, 10);
        const blockLength = sourceContext.blockLength;
        const targetEnd = targetStart + blockLength - 1;
        if (!Number.isInteger(targetStart) || targetStart < 0 || targetEnd >= this.timeSlots.length) return false;
        for (let index = targetStart; index <= targetEnd; index += 1) {
            if (index >= sourceContext.rangeStart && index <= sourceContext.rangeEnd) continue;
            const slot = this.timeSlots[index];
            if (isPlannedContentPresent(slot)) return false;
            if (typeof this.findMergeKey === 'function' && this.findMergeKey('planned', index)) return false;
        }
        return true;
    }

    function clearMoveClasses() {
        if (typeof document === 'undefined') return;
        document.querySelectorAll('.planned-slot-moving, .planned-slot-move-drop-valid, .planned-slot-move-drop-invalid, .is-planned-slot-move-drag-origin')
            .forEach((el) => {
                el.classList.remove('planned-slot-moving', 'planned-slot-move-drop-valid', 'planned-slot-move-drop-invalid', 'is-planned-slot-move-drag-origin');
            });
    }

    function markRows(start, end, className) {
        if (typeof document === 'undefined') return;
        for (let index = start; index <= end; index += 1) {
            const row = document.querySelector(`.time-entry[data-index="${index}"]`);
            if (row) row.classList.add(className);
        }
    }

    function getPlannedSlotMoveTargets(entryDiv) {
        if (!entryDiv || !entryDiv.querySelectorAll) return [];
        const mergedMain = entryDiv.querySelector('.planned-merged-main-container');
        if (mergedMain) return [mergedMain];
        const plannedWrapper = entryDiv.querySelector('.split-cell-wrapper.split-type-planned.split-has-data');
        return plannedWrapper ? [plannedWrapper] : [];
    }

    function getDragGhostHost() {
        if (typeof document === 'undefined') return null;
        return document.body || document.documentElement || null;
    }

    function getPlannedSlotMoveRootFromEventTarget(eventTarget, fallbackTarget) {
        if (eventTarget && eventTarget.closest) {
            const rootEl = eventTarget.closest('.planned-slot-move-target');
            if (rootEl) return rootEl;
        }
        return fallbackTarget || null;
    }

    function preventNativePlannedSlotMoveGesture(event) {
        if (!event) return;
        if (event.preventDefault) event.preventDefault();
        if (event.stopPropagation) event.stopPropagation();
    }

    function sanitizeMoveDragPreview(node) {
        if (!node) return;
        if (node.removeAttribute) {
            node.removeAttribute('id');
            node.removeAttribute('aria-describedby');
            node.removeAttribute('aria-controls');
        }
        if (node.classList) {
            node.classList.remove('planned-slot-move-target', 'is-planned-slot-move-drag-origin');
            node.classList.add('planned-slot-move-preview');
            node.classList.add('planned-slot-move-drag-preview');
        }
        if (node.dataset) {
            Object.keys(node.dataset)
                .filter((key) => /listener/i.test(key))
                .forEach((key) => { delete node.dataset[key]; });
        }
        if (node.querySelectorAll) {
            node.querySelectorAll('*').forEach((child) => {
                if (child.removeAttribute) {
                    child.removeAttribute('id');
                    child.removeAttribute('aria-describedby');
                    child.removeAttribute('aria-controls');
                }
                if (child.dataset) {
                    Object.keys(child.dataset)
                        .filter((key) => /listener/i.test(key))
                        .forEach((key) => { delete child.dataset[key]; });
                }
            });
        }
        if (node.setAttribute) node.setAttribute('aria-hidden', 'true');
    }

    function updatePlannedSlotMovePreview(drag, clientX, clientY) {
        if (!drag || !drag.previewEl || !drag.previewEl.style) return;
        const left = clientX - (Number(drag.previewOffsetX) || 0);
        const top = clientY - (Number(drag.previewOffsetY) || 0);
        drag.previewEl.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
    }

    function createPlannedSlotMovePreview(drag, sourceEl) {
        if (!drag || drag.previewEl || !sourceEl || typeof document === 'undefined') return null;
        const host = getDragGhostHost();
        if (!host || !host.appendChild) return null;
        const rect = sourceEl.getBoundingClientRect ? sourceEl.getBoundingClientRect() : null;
        const preview = sourceEl.cloneNode ? sourceEl.cloneNode(true) : document.createElement('div');
        if (!preview) return null;
        sanitizeMoveDragPreview(preview);
        if (preview.style) {
            preview.style.position = 'fixed';
            preview.style.left = '0px';
            preview.style.top = '0px';
            if (rect && Number.isFinite(rect.width)) preview.style.width = `${Math.round(rect.width)}px`;
            if (rect && Number.isFinite(rect.height)) {
                preview.style.height = `${Math.round(rect.height)}px`;
                preview.style.minHeight = `${Math.round(rect.height)}px`;
            }
            preview.style.pointerEvents = 'none';
        }
        drag.previewOffsetX = rect && Number.isFinite(rect.left) ? drag.startX - rect.left : 0;
        drag.previewOffsetY = rect && Number.isFinite(rect.top) ? drag.startY - rect.top : 0;
        host.appendChild(preview);
        drag.previewEl = preview;
        if (document.body && document.body.classList) document.body.classList.add('is-planned-slot-move-preview-active');
        updatePlannedSlotMovePreview(drag, drag.startX, drag.startY);
        return preview;
    }

    function removePlannedSlotMovePreview(drag) {
        if (!drag) return;
        const preview = drag.previewEl;
        if (preview && preview.parentNode) preview.parentNode.removeChild(preview);
        drag.previewEl = null;
        if (typeof document !== 'undefined' && document.body && document.body.classList) {
            document.body.classList.remove('is-planned-slot-move-preview-active');
        }
    }

    function attachPlannedSlotMoveTargetListeners(ctx, target, index) {
        if (!target || !target.addEventListener) return;
        if (target.classList) target.classList.add('planned-slot-move-target');
        if (target.dataset) {
            target.dataset.plannedSlotMoveTarget = 'true';
            target.dataset.timeSlotMergeIgnore = 'true';
        }
        if (target.setAttribute) {
            target.setAttribute('aria-label', '계획 슬롯 이동');
        }

        if (target.setAttribute) target.setAttribute('draggable', 'false');
        ['selectstart', 'contextmenu', 'dragstart'].forEach((type) => {
            target.addEventListener(type, (event) => {
                if (!ctx.plannedSlotMoveMode) return;
                preventNativePlannedSlotMoveGesture(event);
            }, true);
        });

        target.addEventListener('pointerdown', (event) => {
            if (!ctx.plannedSlotMoveMode || event.button !== undefined && event.button !== 0) return;
            const sourceContext = getPlannedSlotMoveContext.call(ctx, index);
            if (!sourceContext.movable) return;
            const sourceEl = getPlannedSlotMoveRootFromEventTarget(event.target, target);
            ctx.plannedSlotMoveDrag = {
                pointerId: event.pointerId,
                sourceContext,
                startX: event.clientX,
                startY: event.clientY,
                dragging: false,
                valid: false,
                targetStart: null,
                sourceEl,
                previewEl: null,
                documentMoveListener: null,
                documentUpListener: null,
                documentCancelListener: null,
            };
            if (typeof document !== 'undefined' && document.addEventListener) {
                ctx.plannedSlotMoveDrag.documentMoveListener = (moveEvent) => {
                    const drag = ctx.plannedSlotMoveDrag;
                    if (!drag || drag.pointerId !== moveEvent.pointerId) return;
                    const dx = moveEvent.clientX - drag.startX;
                    const dy = moveEvent.clientY - drag.startY;
                    if (!drag.dragging && Math.hypot(dx, dy) < 4) return;
                    drag.dragging = true;
                    createPlannedSlotMovePreview(drag, drag.sourceEl || target);
                    updatePlannedSlotMovePreview(drag, moveEvent.clientX, moveEvent.clientY);
                    if (moveEvent.preventDefault) moveEvent.preventDefault();
                    clearMoveClasses();
                    markRows(drag.sourceContext.rangeStart, drag.sourceContext.rangeEnd, 'planned-slot-moving');
                    let targetIndex = typeof ctx.getIndexAtClientPosition === 'function'
                        ? ctx.getIndexAtClientPosition('planned', moveEvent.clientX, moveEvent.clientY)
                        : null;
                    if (!Number.isInteger(targetIndex)) return;
                    targetIndex = Math.max(0, Math.min(targetIndex, ctx.timeSlots.length - drag.sourceContext.blockLength));
                    drag.targetStart = targetIndex;
                    drag.valid = canDropPlannedSlotBlock.call(ctx, drag.sourceContext, targetIndex);
                    ctx.plannedSlotMoveHoverStart = targetIndex;
                    markRows(targetIndex, targetIndex + drag.sourceContext.blockLength - 1, drag.valid ? 'planned-slot-move-drop-valid' : 'planned-slot-move-drop-invalid');
                };
                ctx.plannedSlotMoveDrag.documentUpListener = (upEvent) => {
                    if (upEvent && upEvent.target !== target) finish(upEvent, true);
                };
                ctx.plannedSlotMoveDrag.documentCancelListener = (cancelEvent) => {
                    if (cancelEvent && cancelEvent.target !== target) finish(cancelEvent, false);
                };
                document.addEventListener('pointermove', ctx.plannedSlotMoveDrag.documentMoveListener, true);
                document.addEventListener('pointerup', ctx.plannedSlotMoveDrag.documentUpListener, true);
                document.addEventListener('pointercancel', ctx.plannedSlotMoveDrag.documentCancelListener, true);
            }
            try { target.setPointerCapture(event.pointerId); } catch (_) {}
            if (target.classList) target.classList.add('is-planned-slot-move-drag-origin');
            if (event.preventDefault) event.preventDefault();
            event.stopPropagation();
        }, true);

        target.addEventListener('pointermove', (event) => {
            const drag = ctx.plannedSlotMoveDrag;
            if (!drag || drag.pointerId !== event.pointerId) return;
            const dx = event.clientX - drag.startX;
            const dy = event.clientY - drag.startY;
            if (!drag.dragging && Math.hypot(dx, dy) < 4) return;
            drag.dragging = true;
            createPlannedSlotMovePreview(drag, drag.sourceEl || target);
            updatePlannedSlotMovePreview(drag, event.clientX, event.clientY);
            event.preventDefault();
            clearMoveClasses();
            markRows(drag.sourceContext.rangeStart, drag.sourceContext.rangeEnd, 'planned-slot-moving');
            let targetIndex = typeof ctx.getIndexAtClientPosition === 'function'
                ? ctx.getIndexAtClientPosition('planned', event.clientX, event.clientY)
                : null;
            if (!Number.isInteger(targetIndex)) return;
            targetIndex = Math.max(0, Math.min(targetIndex, ctx.timeSlots.length - drag.sourceContext.blockLength));
            drag.targetStart = targetIndex;
            drag.valid = canDropPlannedSlotBlock.call(ctx, drag.sourceContext, targetIndex);
            ctx.plannedSlotMoveHoverStart = targetIndex;
            markRows(targetIndex, targetIndex + drag.sourceContext.blockLength - 1, drag.valid ? 'planned-slot-move-drop-valid' : 'planned-slot-move-drop-invalid');
        });

        const finish = (event, shouldMove) => {
            const drag = ctx.plannedSlotMoveDrag;
            if (!drag || drag.pointerId !== event.pointerId) return;
            if (drag.documentMoveListener && typeof document !== 'undefined') {
                document.removeEventListener('pointermove', drag.documentMoveListener, true);
                document.removeEventListener('pointerup', drag.documentUpListener, true);
                document.removeEventListener('pointercancel', drag.documentCancelListener, true);
                drag.documentMoveListener = null;
                drag.documentUpListener = null;
                drag.documentCancelListener = null;
            }
            if (shouldMove && drag.dragging && drag.valid && drag.targetStart !== drag.sourceContext.rangeStart) {
                movePlannedSlotBlock.call(ctx, drag.sourceContext.rangeStart, drag.targetStart);
            }
            removePlannedSlotMovePreview(drag);
            clearPlannedSlotMoveDragState.call(ctx);
            if (target.classList) target.classList.remove('is-planned-slot-move-drag-origin');
            try { target.releasePointerCapture(event.pointerId); } catch (_) {}
            event.stopPropagation();
        };

        target.addEventListener('pointerup', (event) => finish(event, true));
        target.addEventListener('pointercancel', (event) => finish(event, false));
    }

    function clearPlannedSlotMoveDragState() {
        const drag = this.plannedSlotMoveDrag;
        if (drag && drag.documentMoveListener && typeof document !== 'undefined') {
            document.removeEventListener('pointermove', drag.documentMoveListener, true);
            document.removeEventListener('pointerup', drag.documentUpListener, true);
            document.removeEventListener('pointercancel', drag.documentCancelListener, true);
        }
        removePlannedSlotMovePreview(drag);
        clearMoveClasses();
        this.plannedSlotMoveDrag = null;
        this.plannedSlotMoveHoverStart = null;
    }

    function attachPlannedSlotMoveListeners(entryDiv, index) {
        if (!entryDiv || !entryDiv.querySelector || !this.plannedSlotMoveMode || this.plannedSlotClearMode) return;
        const context = getPlannedSlotMoveContext.call(this, index);
        if (!context.movable || context.baseIndex !== index) return;
        const moveTargets = getPlannedSlotMoveTargets(entryDiv);
        if (moveTargets.length === 0) return;
        moveTargets.forEach((target) => attachPlannedSlotMoveTargetListeners(this, target, index));
    }

    function attachPlannedSlotClearListeners(entryDiv, index) {
        if (!entryDiv || !entryDiv.querySelectorAll || !this.plannedSlotClearMode) return;
        const button = entryDiv.querySelector('.planned-slot-clear-btn');
        if (!button || button.dataset.clearListenerAttached === 'true') return;
        if (!shouldRenderPlannedSlotClearButton.call(this, index)) return;
        button.dataset.clearListenerAttached = 'true';
        if (button.dataset && button.dataset.timeSlotMergeIgnore == null) {
            button.dataset.timeSlotMergeIgnore = 'true';
        }
        const resolveClearIndex = () => {
            const host = button.closest && button.closest('[data-planned-slot-clear-target="true"]');
            const rawIndex = (button.dataset && button.dataset.index != null)
                ? button.dataset.index
                : (host && host.dataset ? host.dataset.index : index);
            const parsedIndex = parseInt(rawIndex, 10);
            return Number.isInteger(parsedIndex) ? parsedIndex : index;
        };
        const stopClearControlEvent = (event) => {
            if (!event) return;
            if (event.stopImmediatePropagation) event.stopImmediatePropagation();
            else if (event.stopPropagation) event.stopPropagation();
        };
        ['pointerdown', 'mousedown', 'touchstart'].forEach((type) => {
            button.addEventListener(type, stopClearControlEvent, true);
        });
        button.addEventListener('click', (event) => {
            if (event && event.preventDefault) event.preventDefault();
            stopClearControlEvent(event);
            clearPlannedSlotContents.call(this, resolveClearIndex());
        }, true);
    }

    function snapshotSlot(slot, sourceStart, sourceEnd, targetStart, targetEnd) {
        return {
            planned: slot.planned || '',
            planActivities: cloneValue(slot.planActivities) || [],
            planTitle: slot.planTitle || '',
            planTitleBandOn: Boolean(slot.planTitleBandOn),
            planSegmentTimers: remapPlanTimerKeys(slot.planSegmentTimers, sourceStart, sourceEnd, targetStart, targetEnd),
            planMergeSnapshot: remapPlanMergeSnapshot(slot.planMergeSnapshot, sourceStart, sourceEnd, targetStart, targetEnd),
        };
    }

    function clearPlannedFields(slot) {
        if (!slot) return;
        slot.planned = '';
        slot.planActivities = [];
        slot.planTitle = '';
        slot.planTitleBandOn = false;
        slot.planSegmentTimers = {};
        delete slot.planMergeSnapshot;
    }

    function movePlannedSlotBlock(sourceIndex, targetStartIndex) {
        const sourceContext = getPlannedSlotMoveContext.call(this, sourceIndex);
        if (!sourceContext.movable) return false;
        const targetStart = Number.isInteger(targetStartIndex) ? targetStartIndex : parseInt(targetStartIndex, 10);
        const targetEnd = targetStart + sourceContext.blockLength - 1;
        if (!canDropPlannedSlotBlock.call(this, sourceContext, targetStart)) return false;
        const sourceSlots = [];
        for (let index = sourceContext.rangeStart; index <= sourceContext.rangeEnd; index += 1) {
            if (hasBlockingTimer(this.timeSlots[index])) {
                if (typeof this.showNotification === 'function') this.showNotification('실행 중인 타이머가 있어 이동할 수 없습니다.');
                return false;
            }
            sourceSlots.push(this.timeSlots[index]);
        }
        const snapshots = sourceSlots.map((slot) => snapshotSlot(slot, sourceContext.rangeStart, sourceContext.rangeEnd, targetStart, targetEnd));
        const sourcePlannedValue = sourceContext.mergeKey && this.mergedFields ? this.mergedFields.get(sourceContext.mergeKey) : '';
        const sourceTimeKey = `time-${sourceContext.rangeStart}-${sourceContext.rangeEnd}`;
        const sourceActualKey = `actual-${sourceContext.rangeStart}-${sourceContext.rangeEnd}`;
        const sourceActualValue = this.mergedFields && this.mergedFields.has(sourceActualKey) ? this.mergedFields.get(sourceActualKey) : '';

        if (this.mergedFields && typeof this.mergedFields.delete === 'function') {
            ['planned', 'time', 'actual'].forEach((type) => {
                this.mergedFields.delete(`${type}-${sourceContext.rangeStart}-${sourceContext.rangeEnd}`);
            });
        }

        for (let index = sourceContext.rangeStart; index <= sourceContext.rangeEnd; index += 1) {
            clearPlannedFields(this.timeSlots[index]);
        }
        for (let index = targetStart; index <= targetEnd; index += 1) {
            clearPlannedFields(this.timeSlots[index]);
        }
        snapshots.forEach((snapshot, offset) => {
            const targetSlot = this.timeSlots[targetStart + offset];
            PLANNED_FIELDS.forEach((field) => {
                if (field === 'planMergeSnapshot' && snapshot[field] == null) {
                    delete targetSlot[field];
                    return;
                }
                targetSlot[field] = cloneValue(snapshot[field]);
            });
        });

        if (sourceContext.mergeKey && this.mergedFields && typeof this.mergedFields.set === 'function') {
            this.mergedFields.set(`planned-${targetStart}-${targetEnd}`, sourcePlannedValue || snapshots[0].planned || '');
            const startTime = this.timeSlots[targetStart] ? this.timeSlots[targetStart].time : '';
            const endTime = this.timeSlots[targetEnd] ? this.timeSlots[targetEnd].time : '';
            this.mergedFields.set(`time-${targetStart}-${targetEnd}`, `${startTime}-${endTime}`);
            this.mergedFields.set(`actual-${targetStart}-${targetEnd}`, sourceActualValue || '');
        }

        if (typeof this.renderTimeEntries === 'function') this.renderTimeEntries(true);
        if (typeof this.calculateTotals === 'function') this.calculateTotals();
        if (typeof this.autoSave === 'function') this.autoSave();
        if (typeof this.showNotification === 'function') this.showNotification('계획 슬롯을 이동했습니다.');
        return true;
    }

    return {
        initPlannedSlotMoveModeControls,
        initPlannedSlotClearModeControls,
        setPlannedSlotMoveMode,
        setPlannedSlotClearMode,
        togglePlannedSlotMoveMode,
        togglePlannedSlotClearMode,
        isPlannedSlotMoveMode,
        isPlannedSlotClearMode,
        attachPlannedSlotMoveListeners,
        attachPlannedSlotClearListeners,
        movePlannedSlotBlock,
        clearPlannedSlotContents,
        getPlannedSlotMoveContext,
        getPlannedSlotClearContext,
        canDropPlannedSlotBlock,
        shouldRenderPlannedSlotClearButton,
        createPlannedSlotClearButtonHtml,
        clearPlannedSlotMoveDragState,
    };
});
