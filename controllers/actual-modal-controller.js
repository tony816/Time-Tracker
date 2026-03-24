(function attachTimeTrackerActualModalController(root, factory) {
    const api = factory(root);

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        const existing = (root.TimeTrackerActualModalController && typeof root.TimeTrackerActualModalController === 'object')
            ? root.TimeTrackerActualModalController
            : {};
        root.TimeTrackerActualModalController = Object.assign(existing, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildTimeTrackerActualModalController(root) {
    function getActualActivityRenderer() {
        if (root && root.TimeTrackerActualActivityListRenderer && typeof root.TimeTrackerActualActivityListRenderer === 'object') {
            return root.TimeTrackerActualActivityListRenderer;
        }
        return null;
    }

    function isValidActualRow(index) {
        return Number.isInteger(index)
            && index >= 0
            && index < (this.modalActualActivities ? this.modalActualActivities.length : 0);
    }

    function updateActualRowActiveStyles() {
        const { list } = this.getActualModalElements();
        if (!list) return;
        const activeIndex = this.isValidActualRow(this.modalActualActiveRow) ? this.modalActualActiveRow : -1;
        list.querySelectorAll('.sub-activity-row').forEach((rowEl) => {
            const idx = parseInt(rowEl.dataset.index, 10);
            rowEl.classList.toggle('active', idx === activeIndex);
        });
    }

    function setActualActiveRow(index, options = {}) {
        const validIndex = this.isValidActualRow(index) ? index : -1;
        this.modalActualActiveRow = validIndex;
        this.updateActualRowActiveStyles();
        if (options.focusLabel && this.isValidActualRow(validIndex)) {
            this.focusActualRowLabel(validIndex);
        }
    }

    function focusActualRowLabel(index) {
        if (!this.isValidActualRow(index)) return;
        try {
            const { list } = this.getActualModalElements();
            if (!list) return;
            const row = list.querySelector(`.sub-activity-row[data-index="${index}"]`);
            if (!row) return;
            const input = row.querySelector('.actual-activity-label');
            if (input) input.focus();
        } catch (e) {}
    }

    function renderActualActivitiesList() {
        const { list } = this.getActualModalElements();
        if (!list) return;
        this.closeActualActivityMenu();

        if (!this.isValidActualRow(this.modalActualActiveRow)) {
            this.modalActualActiveRow = (this.modalActualActivities && this.modalActualActivities.length > 0) ? 0 : -1;
        }

        list.innerHTML = '';
        const actualActivityRenderer = getActualActivityRenderer();
        if (!actualActivityRenderer
            || typeof actualActivityRenderer.buildActualActivityRowStates !== 'function'
            || typeof actualActivityRenderer.createActualActivityRowElement !== 'function'
            || typeof actualActivityRenderer.createActualActivitiesEmptyState !== 'function') {
            return;
        }

        const gridSecondsMap = this.getActualGridSecondsMap();
        const planLabelSet = (this.modalActualPlanLabelSet instanceof Set) ? this.modalActualPlanLabelSet : new Set();
        const rowStates = actualActivityRenderer.buildActualActivityRowStates(this.modalActualActivities || [], {
            activeIndex: this.modalActualActiveRow,
            hasPlanUnits: this.modalActualHasPlanUnits,
            gridSecondsMap,
            planLabelSet,
            normalizeActivityText: this.normalizeActivityText
                ? (value) => this.normalizeActivityText(value)
                : undefined,
        });
        rowStates.forEach((rowState) => {
            const row = actualActivityRenderer.createActualActivityRowElement({
                document,
                rowState,
                createActualTimeControl: (options) => this.createActualTimeControl(options),
            });
            if (row) list.appendChild(row);
        });

        if ((this.modalActualActivities || []).length === 0) {
            const empty = actualActivityRenderer.createActualActivitiesEmptyState({ document });
            if (empty) list.appendChild(empty);
        }

        this.updateActualActivitiesSummary();
        this.updateActualRowActiveStyles();
    }

    function addActualActivityRow(defaults = {}) {
        if (!Array.isArray(this.modalActualActivities)) {
            this.modalActualActivities = [];
        }
        const label = typeof defaults.label === 'string' ? defaults.label : '';
        const source = typeof defaults.source === 'string' ? defaults.source : 'extra';
        const seededRecorded = Number.isFinite(defaults.recordedSeconds) ? Math.max(0, Math.floor(defaults.recordedSeconds)) : null;
        const newIndex = this.modalActualActivities.push({ label, seconds: 0, recordedSeconds: seededRecorded, source }) - 1;
        this.modalActualActiveRow = newIndex;
        this.modalActualDirty = true;
        const total = Math.max(0, Number(this.modalActualTotalSeconds) || 0);
        if (total > 0 && this.modalActualActivities[newIndex]) {
            const usedByOthers = this.modalActualActivities.reduce((sum, item, idx) => {
                if (!item || idx === newIndex) return sum;
                const seconds = Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
                return sum + this.normalizeActualDurationStep(seconds);
            }, 0);
            const remaining = Math.max(0, total - usedByOthers);
            this.modalActualActivities[newIndex].seconds = this.normalizeActualDurationStep(remaining);
        }
        this.modalActualActivities.forEach((item, idx) => {
            if (!item || typeof item !== 'object') return;
            item.order = idx;
        });
        this.normalizeActualActivitiesToStep();
        this.clampActualGridToAssigned();
        this.renderActualActivitiesList();
        if (defaults.focusLabel !== false) {
            this.focusActualRowLabel(newIndex);
        }
    }

    function removeActualActivityRow(index) {
        if (!this.isValidActualRow(index)) return;
        this.modalActualActivities.splice(index, 1);
        if (this.modalActualActivities.length > 0) {
            const targetIndex = Math.min(index, this.modalActualActivities.length - 1);
            this.modalActualActiveRow = targetIndex;
        } else {
            this.modalActualActiveRow = -1;
        }
        this.modalActualActivities.forEach((item, idx) => {
            if (!item || typeof item !== 'object') return;
            item.order = idx;
        });
        this.modalActualDirty = true;
        this.normalizeActualActivitiesToStep();
        this.clampActualGridToAssigned();
        this.renderActualActivitiesList();
    }

    function moveActualActivityRow(index, direction) {
        if (!this.isValidActualRow(index)) return;
        const items = this.modalActualActivities || [];
        const target = direction < 0 ? index - 1 : index + 1;
        if (target < 0 || target >= items.length) return;
        const temp = items[index];
        items[index] = items[target];
        items[target] = temp;
        items.forEach((item, idx) => {
            if (!item || typeof item !== 'object') return;
            item.order = idx;
        });
        this.modalActualActiveRow = target;
        this.modalActualDirty = true;
        this.renderActualActivitiesList();
        this.focusActualRowLabel(target);
    }

    function applyActualActivityLabelSelection(index, label) {
        if (!this.isValidActualRow(index)) return false;
        const normalized = this.normalizeActivityText
            ? this.normalizeActivityText(label || '')
            : String(label || '').trim();
        const item = this.modalActualActivities[index];
        if (!item) return false;
        item.label = normalized;
        const isGridLabel = this.modalActualHasPlanUnits
            && (this.modalActualPlanLabelSet instanceof Set)
            && this.modalActualPlanLabelSet.has(normalized);
        if (normalized) {
            item.source = isGridLabel ? 'grid' : 'extra';
            if (isGridLabel) {
                item.recordedSeconds = null;
            } else if (!Number.isFinite(item.recordedSeconds)) {
                item.recordedSeconds = null;
            }
        } else {
            item.source = 'extra';
            item.recordedSeconds = null;
        }
        this.modalActualActiveRow = index;
        this.modalActualDirty = true;
        this.clampActualGridToAssigned();
        this.renderActualActivitiesList();
        return true;
    }

    function getActualBalanceOrder(index, length) {
        const order = [];
        for (let i = index + 1; i < length; i++) order.push(i);
        for (let i = 0; i < index; i++) order.push(i);
        return order;
    }

    function applyActualDurationChange(index, targetSeconds, options = {}) {
        if (!this.isValidActualRow(index)) return;
        const items = this.modalActualActivities || [];
        const total = Math.max(0, Number(this.modalActualTotalSeconds) || 0);
        const wasDirty = this.modalActualDirty;
        const beforeSeconds = items.map(item => this.normalizeActualDurationStep(Number.isFinite(item && item.seconds) ? item.seconds : 0));
        let nextSeconds = this.normalizeActualDurationStep(Number.isFinite(targetSeconds) ? targetSeconds : 0);

        if (total > 0) {
            const otherSum = items.reduce((sum, item, idx) => {
                if (idx === index) return sum;
                const seconds = Number.isFinite(item && item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
                return sum + this.normalizeActualDurationStep(seconds);
            }, 0);
            const maxAllowed = Math.max(0, total - otherSum);
            nextSeconds = Math.min(nextSeconds, maxAllowed);
        }
        items[index].seconds = nextSeconds;
        this.clampActualGridToAssigned();
        this.updateActualSpinnerDisplays();
        this.updateActualActivitiesSummary();
        const afterSeconds = items.map(item => this.normalizeActualDurationStep(Number.isFinite(item && item.seconds) ? item.seconds : 0));
        const changed = beforeSeconds.some((value, idx) => value !== afterSeconds[idx]);
        if (!changed) {
            if (!wasDirty) this.modalActualDirty = false;
            return;
        }
        this.modalActualDirty = true;
        if (options.updatePlan) {
            const label = this.normalizeActivityText
                ? this.normalizeActivityText(items[index].label || '')
                : String(items[index].label || '').trim();
            const isPlanLabel = label
                && ((this.modalActualPlanLabelSet instanceof Set && this.modalActualPlanLabelSet.has(label))
                    || items[index].source === 'grid');
            if (isPlanLabel) {
                const baseIndex = Number.isFinite(this.modalActualBaseIndex) ? this.modalActualBaseIndex : null;
                const finalSeconds = Number.isFinite(items[index].seconds)
                    ? Math.max(0, Math.floor(items[index].seconds))
                    : 0;
                if (Number.isFinite(baseIndex)) {
                    this.updatePlanActivitiesAssignment(baseIndex, label, finalSeconds);
                }
            }
        }
    }

    function balanceActualAssignmentsToTotal(changedIndex = null) {
        if (!this.modalActualHasPlanUnits) return;
        const items = this.modalActualActivities || [];
        const total = Math.max(0, Number(this.modalActualTotalSeconds) || 0);
        if (items.length === 0 || total <= 0) return;

        items.forEach((item) => {
            if (!item) return;
            item.seconds = this.normalizeActualDurationStep(Number.isFinite(item.seconds) ? item.seconds : 0);
        });

        let sum = this.getActualActivitiesSeconds(items);
        let delta = sum - total;
        if (delta === 0) return;

        const normalize = (value) => this.normalizeActivityText
            ? this.normalizeActivityText(value || '')
            : String(value || '').trim();
        const isPlanItem = (item) => {
            if (!item) return false;
            const label = normalize(item.label || '');
            if (!label) return false;
            if (item.source === 'grid') return true;
            return (this.modalActualPlanLabelSet instanceof Set) && this.modalActualPlanLabelSet.has(label);
        };

        const order = [];
        const changedIsPlan = Number.isFinite(changedIndex) && items[changedIndex]
            ? isPlanItem(items[changedIndex])
            : false;

        const pushIndex = (idx) => {
            if (!Number.isFinite(idx)) return;
            if (idx < 0 || idx >= items.length) return;
            if (order.includes(idx)) return;
            order.push(idx);
        };

        if (delta > 0) {
            const reducePlanFirst = !changedIsPlan;
            items.forEach((item, idx) => {
                if (idx === changedIndex) return;
                if (reducePlanFirst && isPlanItem(item)) pushIndex(idx);
                if (!reducePlanFirst && !isPlanItem(item)) pushIndex(idx);
            });
            items.forEach((item, idx) => {
                if (idx === changedIndex) return;
                if (reducePlanFirst && !isPlanItem(item)) pushIndex(idx);
                if (!reducePlanFirst && isPlanItem(item)) pushIndex(idx);
            });
            pushIndex(changedIndex);

            for (let i = 0; i < order.length && delta > 0; i++) {
                const idx = order[i];
                const current = Number.isFinite(items[idx].seconds) ? Math.max(0, Math.floor(items[idx].seconds)) : 0;
                if (current <= 0) continue;
                const reduce = Math.min(current, delta);
                items[idx].seconds = current - reduce;
                delta -= reduce;
            }
        } else {
            const addAmount = Math.abs(delta);
            const addPlanFirst = !changedIsPlan;
            let targetIndex = null;

            items.forEach((item, idx) => {
                if (idx === changedIndex) return;
                if (targetIndex != null) return;
                if (addPlanFirst && isPlanItem(item)) targetIndex = idx;
                if (!addPlanFirst && !isPlanItem(item)) targetIndex = idx;
            });
            if (targetIndex == null) {
                items.forEach((item, idx) => {
                    if (idx === changedIndex) return;
                    if (targetIndex == null) targetIndex = idx;
                });
            }
            if (targetIndex == null && Number.isFinite(changedIndex)) {
                targetIndex = changedIndex;
            }
            if (Number.isFinite(targetIndex)) {
                const current = Number.isFinite(items[targetIndex].seconds)
                    ? Math.max(0, Math.floor(items[targetIndex].seconds))
                    : 0;
                items[targetIndex].seconds = current + addAmount;
            }
        }
    }

    function applyActualGridDurationChange(index, targetSeconds) {
        if (!this.isValidActualRow(index) || !this.modalActualHasPlanUnits) return;
        const item = this.modalActualActivities[index];
        const label = this.normalizeActivityText
            ? this.normalizeActivityText(item && item.label || '')
            : String(item && item.label || '').trim();
        if (!label) return;
        const isPlanLabel = (this.modalActualPlanLabelSet instanceof Set && this.modalActualPlanLabelSet.has(label))
            || (item && item.source === 'grid');
        if (!isPlanLabel) {
            const assigned = Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
            let nextRecorded = this.normalizeActualDurationStep(Number.isFinite(targetSeconds) ? targetSeconds : 0);
            if (assigned > 0) nextRecorded = Math.min(nextRecorded, assigned);
            item.recordedSeconds = nextRecorded;
            this.modalActualDirty = true;
            this.updateActualSpinnerDisplays();
            this.updateActualActivitiesSummary();
            return;
        }

        const step = this.getActualDurationStepSeconds();
        const normalized = this.normalizeActualDurationStep(Number.isFinite(targetSeconds) ? targetSeconds : 0);
        const targetUnits = Math.max(0, Math.round(normalized / step));

        const counts = this.getActualGridUnitCounts();
        if (targetUnits > 0) {
            counts.set(label, targetUnits);
        } else {
            counts.delete(label);
        }

        const activities = [];
        counts.forEach((count, key) => {
            if (count > 0) {
                activities.push({ label: key, seconds: count * step });
            }
        });

        const nextUnits = this.buildActualUnitsFromActivities(this.modalActualPlanUnits, activities);
        this.modalActualGridUnits = Array.isArray(nextUnits) ? nextUnits.slice() : [];
        this.modalActualDirty = true;
        this.clampActualGridToAssigned();
        this.updateActualSpinnerDisplays();
        this.updateActualActivitiesSummary();
    }

    function adjustActualActivityDuration(index, direction, options = {}) {
        if (!this.isValidActualRow(index)) return;
        const step = this.getActualDurationStepSeconds();
        const current = Number.isFinite(this.modalActualActivities[index].seconds)
            ? Math.max(0, Math.floor(this.modalActualActivities[index].seconds))
            : 0;
        const total = Math.max(0, Number(this.modalActualTotalSeconds) || 0);
        let maxAllowed = total;
        if (this.modalActualHasPlanUnits && total > 0) {
            const items = this.modalActualActivities || [];
            const otherSum = items.reduce((sum, item, idx) => {
                if (idx === index) return sum;
                const seconds = Number.isFinite(item && item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
                return sum + this.normalizeActualDurationStep(seconds);
            }, 0);
            maxAllowed = Math.max(0, total - otherSum);
        }
        let nextSeconds = current + (direction * step);
        if (nextSeconds < 0) nextSeconds = 0;
        if (Number.isFinite(maxAllowed)) nextSeconds = Math.min(nextSeconds, maxAllowed);
        this.applyActualDurationChange(index, nextSeconds, options);
    }

    function adjustActualGridDuration(index, direction) {
        if (!this.isValidActualRow(index) || !this.modalActualHasPlanUnits) return;
        const item = this.modalActualActivities[index];
        const label = this.normalizeActivityText
            ? this.normalizeActivityText(item && item.label || '')
            : String(item && item.label || '').trim();
        if (!label) return;
        const step = this.getActualDurationStepSeconds();
        const isPlanLabel = (this.modalActualPlanLabelSet instanceof Set && this.modalActualPlanLabelSet.has(label))
            || (item && item.source === 'grid');
        if (!isPlanLabel) {
            const assigned = Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
            const currentRecorded = Number.isFinite(item.recordedSeconds)
                ? Math.max(0, Math.floor(item.recordedSeconds))
                : assigned;
            let nextRecorded = currentRecorded + (direction * step);
            nextRecorded = Math.max(0, nextRecorded);
            if (assigned > 0) nextRecorded = Math.min(nextRecorded, assigned);
            item.recordedSeconds = this.normalizeActualDurationStep(nextRecorded);
            this.modalActualDirty = true;
            this.updateActualSpinnerDisplays();
            this.updateActualActivitiesSummary();
            return;
        }
        const current = this.getActualGridSecondsForLabel(label);
        const assigned = Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
        let nextSeconds = current + (direction * step);
        nextSeconds = Math.max(0, nextSeconds);
        if (assigned > 0) nextSeconds = Math.min(nextSeconds, assigned);
        this.applyActualGridDurationChange(index, nextSeconds);
    }

    function updateActualSpinnerDisplays() {
        const { list } = this.getActualModalElements();
        if (!list) return;
        const gridSecondsMap = this.getActualGridSecondsMap();
        const planLabelSet = (this.modalActualPlanLabelSet instanceof Set) ? this.modalActualPlanLabelSet : new Set();
        (this.modalActualActivities || []).forEach((item, idx) => {
            const assignInput = list.querySelector(`.actual-assign-input[data-index="${idx}"]`);
            if (assignInput) {
                const safeSeconds = Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
                assignInput.value = this.formatSecondsForInput(safeSeconds);
            }
            const normalizedLabel = this.normalizeActivityText
                ? this.normalizeActivityText(item && item.label || '')
                : String(item && item.label || '').trim();
            const isPlanLabel = Boolean(normalizedLabel)
                && (planLabelSet.has(normalizedLabel) || item.source === 'grid');
            const recordedSeconds = Number.isFinite(item.recordedSeconds)
                ? Math.max(0, Math.floor(item.recordedSeconds))
                : (Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0);
            const gridSeconds = normalizedLabel
                ? (isPlanLabel ? (gridSecondsMap.get(normalizedLabel) || 0) : recordedSeconds)
                : 0;
            const gridInput = list.querySelector(`.actual-grid-input[data-index="${idx}"]`);
            if (gridInput) {
                gridInput.value = this.formatSecondsForInput(gridSeconds);
            }
        });
    }

    function finalizeActualActivitiesForSave() {
        let activities = this.normalizeActualActivitiesList(this.modalActualActivities).map(item => ({ ...item }));
        activities = activities.map((item, idx) => ({ ...item, order: idx }));
        return activities;
    }

    return Object.freeze({
        isValidActualRow,
        updateActualRowActiveStyles,
        setActualActiveRow,
        focusActualRowLabel,
        renderActualActivitiesList,
        addActualActivityRow,
        removeActualActivityRow,
        moveActualActivityRow,
        applyActualActivityLabelSelection,
        getActualBalanceOrder,
        applyActualDurationChange,
        balanceActualAssignmentsToTotal,
        applyActualGridDurationChange,
        adjustActualActivityDuration,
        adjustActualGridDuration,
        updateActualSpinnerDisplays,
        finalizeActualActivitiesForSave,
    });
});
