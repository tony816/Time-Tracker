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
            status.textContent = '이동할 슬롯의 핸들을 끌어 빈 위치에 놓으세요.';
            if (timesheet) {
                const header = timesheet.querySelector('.header-row');
                timesheet.insertBefore(status, header ? header.nextSibling : timesheet.firstChild);
            }
        }
        this.plannedSlotMoveStatus = status;
        setPlannedSlotMoveModeUi.call(this);
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
        if (this.plannedSlotMoveModeButton) {
            this.plannedSlotMoveModeButton.textContent = enabled ? '이동 완료' : '슬롯 이동';
            this.plannedSlotMoveModeButton.setAttribute('aria-pressed', enabled ? 'true' : 'false');
        }
        if (this.plannedSlotMoveStatus) {
            this.plannedSlotMoveStatus.hidden = !enabled;
        }
    }

    function setPlannedSlotMoveMode(enabled) {
        const next = Boolean(enabled);
        if (next === Boolean(this.plannedSlotMoveMode)) {
            setPlannedSlotMoveModeUi.call(this);
            return this.plannedSlotMoveMode;
        }
        if (next) {
            if (typeof this.closeInlinePlanDropdown === 'function') this.closeInlinePlanDropdown();
            if (typeof this.clearAllSelections === 'function') this.clearAllSelections();
            if (typeof this.hideHoverScheduleButton === 'function') this.hideHoverScheduleButton();
            if (typeof this.cancelPlanSegmentResize === 'function') this.cancelPlanSegmentResize();
        } else {
            clearPlannedSlotMoveDragState.call(this);
        }
        this.plannedSlotMoveMode = next;
        setPlannedSlotMoveModeUi.call(this);
        if (typeof this.renderTimeEntries === 'function') this.renderTimeEntries(next ? false : true);
        return this.plannedSlotMoveMode;
    }

    function togglePlannedSlotMoveMode() {
        return setPlannedSlotMoveMode.call(this, !this.plannedSlotMoveMode);
    }

    function isPlannedSlotMoveMode() {
        return Boolean(this && this.plannedSlotMoveMode);
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
        document.querySelectorAll('.planned-slot-moving, .planned-slot-move-drop-valid, .planned-slot-move-drop-invalid')
            .forEach((el) => {
                el.classList.remove('planned-slot-moving', 'planned-slot-move-drop-valid', 'planned-slot-move-drop-invalid');
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
        const realPlanSegments = Array.from(entryDiv.querySelectorAll('.split-grid-segment[data-segment-kind="real-plan"]'));
        if (realPlanSegments.length > 0) return realPlanSegments;
        const mergedMain = entryDiv.querySelector('.planned-merged-main-container');
        if (mergedMain) return [mergedMain];
        const plannedWrapper = entryDiv.querySelector('.split-cell-wrapper.split-type-planned.split-has-data');
        return plannedWrapper ? [plannedWrapper] : [];
    }

    function isEventOnMoveBorder(target, event) {
        if (!target || typeof target.getBoundingClientRect !== 'function' || !event) return true;
        const rect = target.getBoundingClientRect();
        if (!rect || !Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0) {
            return true;
        }
        const edgeSize = Math.min(14, Math.max(8, Math.min(rect.width, rect.height) * 0.28));
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        return x <= edgeSize
            || x >= rect.width - edgeSize
            || y <= edgeSize
            || y >= rect.height - edgeSize;
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

        target.addEventListener('pointerdown', (event) => {
            if (!ctx.plannedSlotMoveMode || event.button !== undefined && event.button !== 0) return;
            if (!isEventOnMoveBorder(target, event)) return;
            const sourceContext = getPlannedSlotMoveContext.call(ctx, index);
            if (!sourceContext.movable) return;
            ctx.plannedSlotMoveDrag = {
                pointerId: event.pointerId,
                sourceContext,
                startX: event.clientX,
                startY: event.clientY,
                dragging: false,
                valid: false,
                targetStart: null,
            };
            try { target.setPointerCapture(event.pointerId); } catch (_) {}
            if (target.classList) target.classList.add('is-planned-slot-move-drag-origin');
            if (event.preventDefault) event.preventDefault();
            event.stopPropagation();
        });

        target.addEventListener('pointermove', (event) => {
            const drag = ctx.plannedSlotMoveDrag;
            if (!drag || drag.pointerId !== event.pointerId) return;
            const dx = event.clientX - drag.startX;
            const dy = event.clientY - drag.startY;
            if (!drag.dragging && Math.hypot(dx, dy) < 4) return;
            drag.dragging = true;
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
            if (shouldMove && drag.dragging && drag.valid && drag.targetStart !== drag.sourceContext.rangeStart) {
                movePlannedSlotBlock.call(ctx, drag.sourceContext.rangeStart, drag.targetStart);
            }
            clearPlannedSlotMoveDragState.call(ctx);
            if (target.classList) target.classList.remove('is-planned-slot-move-drag-origin');
            try { target.releasePointerCapture(event.pointerId); } catch (_) {}
            event.stopPropagation();
        };

        target.addEventListener('pointerup', (event) => finish(event, true));
        target.addEventListener('pointercancel', (event) => finish(event, false));
    }

    function clearPlannedSlotMoveDragState() {
        clearMoveClasses();
        this.plannedSlotMoveDrag = null;
        this.plannedSlotMoveHoverStart = null;
    }

    function attachPlannedSlotMoveListeners(entryDiv, index) {
        if (!entryDiv || !entryDiv.querySelector || !this.plannedSlotMoveMode) return;
        const context = getPlannedSlotMoveContext.call(this, index);
        if (!context.movable || context.baseIndex !== index) return;
        const moveTargets = getPlannedSlotMoveTargets(entryDiv);
        if (moveTargets.length === 0) return;
        moveTargets.forEach((target) => attachPlannedSlotMoveTargetListeners(this, target, index));
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
        setPlannedSlotMoveMode,
        togglePlannedSlotMoveMode,
        isPlannedSlotMoveMode,
        attachPlannedSlotMoveListeners,
        movePlannedSlotBlock,
        getPlannedSlotMoveContext,
        canDropPlannedSlotBlock,
        clearPlannedSlotMoveDragState,
    };
});
