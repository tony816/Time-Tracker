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

    function attachActualModalEventHandlers() {
        const { list, addBtn } = this.getActualModalElements();

        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this.addActualActivityRow();
            });
        }

        if (!list) return;

        list.addEventListener('click', (event) => {
            this.handleActualModalListClick(event);
        });

        list.addEventListener('change', (event) => {
            this.handleActualModalListChange(event);
        });

        list.addEventListener('focusin', (event) => {
            this.handleActualModalListFocusIn(event);
        });
    }

    function handleActualModalListClick(event) {
        const { list } = this.getActualModalElements();
        if (!list) return;

        const timeBtn = event.target.closest('.actual-time-btn');
        if (timeBtn) {
            if (timeBtn.disabled) return;
            const direction = timeBtn.dataset.direction === 'up' ? 1 : -1;
            const idx = parseInt(timeBtn.dataset.index, 10);
            const kind = timeBtn.dataset.kind;
            const row = timeBtn.closest('.sub-activity-row');
            const locked = row && row.classList.contains('actual-row-locked');
            if (locked) return;
            if (Number.isFinite(idx)) {
                this.setActualActiveRow(idx);
                if (kind === 'grid') {
                    this.adjustActualGridDuration(idx, direction);
                } else {
                    this.adjustActualActivityDuration(idx, direction);
                }
            }
            return;
        }

        const moveBtn = event.target.closest('.actual-move-btn');
        if (moveBtn) {
            const row = moveBtn.closest('.sub-activity-row');
            if (!row || row.classList.contains('actual-row-locked')) return;
            const idx = parseInt(row.dataset.index, 10);
            const direction = moveBtn.dataset.direction === 'up' ? -1 : 1;
            if (Number.isFinite(idx)) {
                this.moveActualActivityRow(idx, direction);
            }
            return;
        }

        const removeBtn = event.target.closest('.actual-remove-btn');
        if (removeBtn) {
            const row = removeBtn.closest('.sub-activity-row');
            if (!row || row.classList.contains('actual-row-locked')) return;
            const idx = parseInt(row.dataset.index, 10);
            if (Number.isFinite(idx)) {
                this.removeActualActivityRow(idx);
            }
            return;
        }

        const labelBtn = event.target.closest('.actual-activity-label');
        if (labelBtn) {
            const row = labelBtn.closest('.sub-activity-row');
            if (!row || row.classList.contains('actual-row-locked')) return;
            const idx = parseInt(row.dataset.index, 10);
            if (Number.isFinite(idx)) {
                this.setActualActiveRow(idx);
                this.openActualActivityMenu(idx, labelBtn);
            }
            return;
        }

        const row = event.target.closest('.sub-activity-row');
        if (row && list.contains(row)) {
            if (row.classList.contains('actual-row-locked')) return;
            const idx = parseInt(row.dataset.index, 10);
            if (Number.isFinite(idx)) {
                this.setActualActiveRow(idx);
            }
        }
    }

    function handleActualModalListChange(event) {
        const target = event.target;
        if (!target || !target.classList) return;

        if (target.classList.contains('actual-assign-input')) {
            const row = target.closest('.sub-activity-row');
            if (!row || row.classList.contains('actual-row-locked')) return;
            if (target.readOnly) {
                this.updateActualSpinnerDisplays();
                return;
            }
            const idx = parseInt(target.dataset.index, 10);
            if (!Number.isFinite(idx)) return;
            const parsed = this.parseActualDurationInput(target.value);
            if (parsed == null) {
                this.updateActualSpinnerDisplays();
                return;
            }
            this.setActualActiveRow(idx);
            this.applyActualDurationChange(idx, parsed);
            return;
        }

        if (target.classList.contains('actual-grid-input')) {
            const row = target.closest('.sub-activity-row');
            if (!row || row.classList.contains('actual-row-locked')) return;
            if (target.readOnly) {
                this.updateActualSpinnerDisplays();
                return;
            }
            const idx = parseInt(target.dataset.index, 10);
            if (!Number.isFinite(idx)) return;
            const parsed = this.parseActualDurationInput(target.value);
            if (parsed == null) {
                this.updateActualSpinnerDisplays();
                return;
            }
            this.setActualActiveRow(idx);
            this.applyActualGridDurationChange(idx, parsed);
        }
    }

    function handleActualModalListFocusIn(event) {
        const { list } = this.getActualModalElements();
        if (!list) return;
        const row = event.target.closest('.sub-activity-row');
        if (!row || !list.contains(row)) return;
        const idx = parseInt(row.dataset.index, 10);
        if (Number.isFinite(idx)) {
            this.setActualActiveRow(idx);
        }
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

    function openActualActivityMenu(index, anchorEl) {
        if (!this.isValidActualRow(index) || !anchorEl || !anchorEl.isConnected) return;
        if (this.actualActivityMenu
            && this.actualActivityMenuContext
            && this.actualActivityMenuContext.index === index
            && this.actualActivityMenuContext.anchorEl === anchorEl) {
            this.closeActualActivityMenu();
            return;
        }
        this.closeActualActivityMenu();

        const currentRaw = this.modalActualActivities[index] && this.modalActualActivities[index].label;
        const normalize = (value) => this.normalizeActivityText
            ? this.normalizeActivityText(value || '')
            : String(value || '').trim();
        const normalizedCurrent = normalize(currentRaw);
        const grouped = this.buildPlannedActivityOptions(normalizedCurrent ? [normalizedCurrent] : []);

        const menu = document.createElement('div');
        menu.className = 'plan-activity-menu actual-activity-menu';
        menu.setAttribute('role', 'menu');

        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'plan-activity-menu-item plan-activity-menu-clear';
        clearBtn.dataset.label = '';
        clearBtn.textContent = '비우기';
        menu.appendChild(clearBtn);

        const divider = document.createElement('div');
        divider.className = 'plan-activity-menu-divider';
        menu.appendChild(divider);

        const buildSection = (title, items) => {
            const section = document.createElement('div');
            section.className = 'plan-activity-menu-section';
            const heading = document.createElement('div');
            heading.className = 'plan-activity-menu-title';
            heading.textContent = title;
            section.appendChild(heading);
            if (!items || items.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'plan-activity-menu-empty';
                empty.textContent = '목록 없음';
                section.appendChild(empty);
                return section;
            }
            items.forEach((item) => {
                const label = normalize(item && item.label);
                if (!label) return;
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'plan-activity-menu-item';
                btn.dataset.label = label;
                btn.textContent = label;
                if (normalizedCurrent && label === normalizedCurrent) {
                    btn.classList.add('active');
                }
                section.appendChild(btn);
            });
            return section;
        };

        menu.appendChild(buildSection('직접 추가', grouped.local || []));
        if (this.isNotionUIVisible()) menu.appendChild(buildSection('노션', grouped.notion || []));

        document.body.appendChild(menu);
        this.actualActivityMenu = menu;
        this.actualActivityMenuContext = { index, anchorEl };
        anchorEl.setAttribute('aria-expanded', 'true');

        menu.addEventListener('click', (event) => {
            const btn = event.target.closest('.plan-activity-menu-item');
            if (!btn || !menu.contains(btn)) {
                this.closeActualActivityMenu();
                return;
            }
            if (btn.disabled) return;
            event.preventDefault();
            event.stopPropagation();
            const label = btn.dataset.label != null ? btn.dataset.label : '';
            this.applyActualActivityLabelSelection(index, label);
            this.closeActualActivityMenu();
        });

        this.positionActualActivityMenu(anchorEl);

        this.actualActivityMenuOutsideHandler = (event) => {
            if (!this.actualActivityMenu) return;
            const target = event.target;
            if (this.actualActivityMenu.contains(target)) return;
            if (anchorEl && (target === anchorEl || (anchorEl.contains && anchorEl.contains(target)))) return;
            this.closeActualActivityMenu();
        };
        document.addEventListener('mousedown', this.actualActivityMenuOutsideHandler, true);

        this.actualActivityMenuEscHandler = (event) => {
            if (event.key === 'Escape') {
                this.closeActualActivityMenu();
            }
        };
        document.addEventListener('keydown', this.actualActivityMenuEscHandler);
    }

    function positionActualActivityMenu(anchorEl) {
        if (!this.actualActivityMenu) return;
        if (!anchorEl || !anchorEl.isConnected) return;
        const rect = anchorEl.getBoundingClientRect();
        if (!rect || (!rect.width && !rect.height)) return;

        const menu = this.actualActivityMenu;
        const scrollX = window.scrollX || document.documentElement.scrollLeft || 0;
        const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
        const viewportWidth = document.documentElement.clientWidth || window.innerWidth || 0;
        const viewportHeight = document.documentElement.clientHeight || window.innerHeight || 0;

        menu.style.visibility = 'hidden';
        menu.style.left = '0px';
        menu.style.top = '0px';

        const menuWidth = menu.offsetWidth || 240;
        const menuHeight = menu.offsetHeight || 220;

        let left = rect.left + scrollX;
        let top = rect.bottom + scrollY + 6;

        const maxLeft = scrollX + viewportWidth - menuWidth - 12;
        if (left > maxLeft) {
            left = Math.max(scrollX + 12, maxLeft);
        }

        const maxTop = scrollY + viewportHeight - menuHeight - 12;
        if (top > maxTop) {
            top = rect.top + scrollY - menuHeight - 6;
        }
        if (top < scrollY + 12) {
            top = scrollY + 12;
        }

        menu.style.left = `${Math.round(left)}px`;
        menu.style.top = `${Math.round(top)}px`;
        menu.style.visibility = 'visible';
    }

    function closeActualActivityMenu() {
        if (this.actualActivityMenuOutsideHandler) {
            document.removeEventListener('mousedown', this.actualActivityMenuOutsideHandler, true);
            this.actualActivityMenuOutsideHandler = null;
        }
        if (this.actualActivityMenuEscHandler) {
            document.removeEventListener('keydown', this.actualActivityMenuEscHandler);
            this.actualActivityMenuEscHandler = null;
        }
        if (this.actualActivityMenuContext && this.actualActivityMenuContext.anchorEl) {
            try { this.actualActivityMenuContext.anchorEl.setAttribute('aria-expanded', 'false'); } catch (_) {}
        }
        if (this.actualActivityMenu && this.actualActivityMenu.parentNode) {
            this.actualActivityMenu.parentNode.removeChild(this.actualActivityMenu);
        }
        this.actualActivityMenu = null;
        this.actualActivityMenuContext = null;
    }

function attachActivityModalEventListeners() {
    const modal = document.getElementById('activityLogModal');
    const closeBtn = document.getElementById('closeActivityModal');
    const saveBtn = document.getElementById('saveActivityLog');
    const cancelBtn = document.getElementById('cancelActivityLog');
     closeBtn.addEventListener('click', () => {
        this.closeActivityLogModal();
    });
     saveBtn.addEventListener('click', () => {
        this.saveActivityLogFromModal();
    });
     cancelBtn.addEventListener('click', () => {
        this.closeActivityLogModal();
    });
     modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            this.closeActivityLogModal();
        }
    });
     document.addEventListener('keydown', (e) => {
        if (modal.style.display !== 'flex') return;
        if (e.key === 'Escape') {
            this.closeActivityLogModal();
            return;
        }
        if (e.key === 'Tab') {
            const focusable = modal.querySelectorAll('button, input, textarea, select, [tabindex]:not([tabindex="-1"])');
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    });
     this.attachActualModalEventHandlers();
 }

function saveActivityLogFromModal() {
    const modal = document.getElementById('activityLogModal');
    const index = parseInt(modal.dataset.index, 10);
    const baseIndexRaw = parseInt(modal.dataset.baseIndex, 10);
    const baseIndex = Number.isFinite(baseIndexRaw) ? baseIndexRaw : index;
     if (Number.isFinite(baseIndex) && baseIndex >= 0) {
        const range = this.getSplitRange('actual', baseIndex);
        const start = range.start;
        const end = range.end;
        const details = document.getElementById('activityDetails').value.trim();
         if (!this.modalActualDirty) {
            for (let i = start; i <= end; i++) {
                const slot = this.timeSlots[i];
                if (!slot) continue;
                if (!slot.activityLog || typeof slot.activityLog !== 'object') {
                    slot.activityLog = { title: '', details: '', subActivities: [], titleBandOn: false, actualGridUnits: [], actualExtraGridUnits: [], actualFailedGridUnits: [], actualOverride: false };
                }
                slot.activityLog.details = (i === start) ? details : '';
            }
        } else {
            this.normalizeActualActivitiesToStep();
            this.clampActualGridToAssigned();
            const activities = this.finalizeActualActivitiesForSave();
            const split = this.splitActualActivitiesByPlan(baseIndex, activities);
            const mergedActivities = activities.map(item => ({ ...item }));
            const summary = mergedActivities.length > 0 ? this.formatActivitiesSummary(mergedActivities) : '';
            const actualUnits = split.hasLabels
                ? this.getModalActualGridUnitsForSave(split.units.length)
                : [];
            const actualMergeKey = this.findMergeKey('actual', start);
            if (actualMergeKey) {
                this.mergedFields.set(actualMergeKey, summary);
            }
               for (let i = start; i <= end; i++) {
                  const slot = this.timeSlots[i];
                  if (!slot) continue;
                  if (!slot.activityLog || typeof slot.activityLog !== 'object') {
                      slot.activityLog = { title: '', details: '', subActivities: [], titleBandOn: false, actualGridUnits: [], actualExtraGridUnits: [], actualFailedGridUnits: [], actualOverride: false };
                  }
                  slot.actual = (i === start) ? summary : '';
                  slot.activityLog.details = (i === start) ? details : '';
                  if (i === start) {
                      slot.activityLog.subActivities = mergedActivities.map(item => ({ ...item }));
                      if (split.hasLabels) {
                          slot.activityLog.actualGridUnits = actualUnits.slice();
                          slot.activityLog.actualExtraGridUnits = [];
                          slot.activityLog.actualFailedGridUnits = [];
                          slot.activityLog.actualOverride = (split.extraActivities && split.extraActivities.length > 0);
                      } else {
                          slot.activityLog.actualGridUnits = [];
                          slot.activityLog.actualExtraGridUnits = [];
                          slot.activityLog.actualFailedGridUnits = [];
                          slot.activityLog.actualOverride = mergedActivities.length > 0;
                      }
                  } else {
                    slot.activityLog.subActivities = [];
                    slot.activityLog.actualGridUnits = [];
                    slot.activityLog.actualExtraGridUnits = [];
                    slot.activityLog.actualFailedGridUnits = [];
                    slot.activityLog.actualOverride = false;
                }
            }
        }
         this.renderTimeEntries();
        this.calculateTotals();
        this.autoSave();
    }
     this.closeActivityLogModal({ force: true });
}

function closeActivityLogModal(options = {}) {
    const modal = document.getElementById('activityLogModal');
    if (!options.force && this.modalActualDirty) {
        const discard = confirm('저장하지 않은 실제 활동 변경사항이 있습니다. 닫을까요?');
        if (!discard) return;
    }
    modal.style.display = 'none';
     document.getElementById('activityDetails').value = '';
     this.closeActualActivityMenu();
    this.modalActualActivities = [];
    this.modalActualTotalSeconds = 0;
    this.modalActualActiveRow = -1;
    this.modalActualBaseIndex = null;
    this.modalActualDirty = false;
    this.modalActualHasPlanUnits = false;
    this.modalActualPlanUnits = [];
    this.modalActualGridUnits = [];
    this.modalActualPlanLabelSet = new Set();
    const { list, totalEl, usedEl, noticeEl } = this.getActualModalElements();
    if (list) list.innerHTML = '';
    if (totalEl) totalEl.textContent = '0시간';
    if (usedEl) usedEl.textContent = '0시간';
    if (noticeEl) noticeEl.textContent = '';
     delete modal.dataset.index;
    delete modal.dataset.baseIndex;
    if (this.lastFocusedElementBeforeModal && typeof this.lastFocusedElementBeforeModal.focus === 'function') {
        try { this.lastFocusedElementBeforeModal.focus(); } catch (_) {}
    }
}

function openActivityLogModal(index) {
    const modal = document.getElementById('activityLogModal');
    const slot = this.timeSlots[index];
    const actualMergeKey = this.findMergeKey('actual', index);
    let baseIndex = index;
    if (actualMergeKey) {
        const [, startStr] = actualMergeKey.split('-');
        const start = parseInt(startStr, 10);
        if (Number.isFinite(start)) baseIndex = start;
    }
    const baseSlot = this.timeSlots[baseIndex] || slot;
     const range = this.getSplitRange('actual', baseIndex);
    const startSlot = this.timeSlots[range.start] || baseSlot;
    const endSlot = this.timeSlots[range.end] || baseSlot;
    const startLabel = startSlot && startSlot.time ? this.formatSlotTimeLabel(startSlot.time) : '';
    const endLabel = endSlot && endSlot.time ? this.formatSlotTimeLabel(endSlot.time) : '';
    const timeLabel = (range.start === range.end || !endLabel) ? startLabel : `${startLabel} ~ ${endLabel}`;
    document.getElementById('activityTime').value = timeLabel;
    // '활동 제목' 입력은 이제 우측 실제 칸(시간 기록 표시)을 직접 편집하는 컨텍스트로 사용
    // 병합된 실제 칸인 경우 병합 값, 아니면 개별 slot.actual을 채운다
    document.getElementById('activityDetails').value = (baseSlot.activityLog && baseSlot.activityLog.details) || '';
     this.modalActualBaseIndex = baseIndex;
    this.modalActualTotalSeconds = Math.max(0, this.getBlockLength('actual', baseIndex) * 3600);
    const planContext = this.getActualPlanLabelContext(baseIndex);
    this.modalActualHasPlanUnits = planContext.hasLabels;
    this.modalActualPlanUnits = Array.isArray(planContext.units) ? planContext.units.slice() : [];
    this.modalActualPlanLabelSet = planContext.labelSet ? new Set(planContext.labelSet) : new Set();
    if (this.modalActualHasPlanUnits) {
        const existing = this.normalizeActualActivitiesList(baseSlot.activityLog && baseSlot.activityLog.subActivities);
        const actualUnits = this.getActualGridUnitsForBase(
            baseIndex,
            this.modalActualPlanUnits.length,
            this.modalActualPlanUnits
        );
        this.modalActualGridUnits = Array.isArray(actualUnits) ? actualUnits.slice() : [];
        this.modalActualActivities = this.buildActualModalActivities(
            baseIndex,
            this.modalActualPlanUnits,
            this.modalActualGridUnits,
            existing,
            planContext.planLabel
        );
        this.normalizeActualActivitiesToStep();
    } else {
        this.modalActualPlanUnits = [];
        this.modalActualPlanLabelSet = new Set();
        this.modalActualGridUnits = [];
        this.modalActualActivities = this.buildActualActivitiesSeed(baseIndex, this.modalActualTotalSeconds);
        this.normalizeActualActivitiesToTotal();
    }
    this.modalActualActiveRow = this.modalActualActivities.length > 0 ? 0 : -1;
    this.modalActualDirty = false;
    this.renderActualActivitiesList();
     this.lastFocusedElementBeforeModal = document.activeElement;
    modal.style.display = 'flex';
    modal.dataset.index = index;
    modal.dataset.baseIndex = String(baseIndex);
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
     setTimeout(() => {
        document.getElementById('activityDetails').focus();
    }, 100);
}

    return Object.freeze({
        isValidActualRow,
        updateActualRowActiveStyles,
        setActualActiveRow,
        focusActualRowLabel,
        attachActualModalEventHandlers,
        handleActualModalListClick,
        handleActualModalListChange,
        handleActualModalListFocusIn,
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
        openActualActivityMenu,
        positionActualActivityMenu,
        closeActualActivityMenu,
        openActivityLogModal,
        closeActivityLogModal,
        saveActivityLogFromModal,
        attachActivityModalEventListeners,
    });
});
