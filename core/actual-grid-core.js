(function attachTimeTrackerActualGridCore(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        const existing = (root.TimeTrackerActualGridCore && typeof root.TimeTrackerActualGridCore === 'object')
            ? root.TimeTrackerActualGridCore
            : {};
        root.TimeTrackerActualGridCore = Object.assign(existing, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildTimeTrackerActualGridCore() {
    function resolveStepSeconds(rawStepSeconds) {
        const parsed = Number(rawStepSeconds);
        if (!Number.isFinite(parsed) || parsed <= 0) return 600;
        return Math.max(1, Math.floor(parsed));
    }

    function getExtraActivityUnitCount(item, stepSeconds = 600) {
        if (!item) return 0;
        const step = resolveStepSeconds(stepSeconds);
        const assignedSeconds = Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
        const recordedSeconds = Number.isFinite(item.recordedSeconds)
            ? Math.max(0, Math.floor(item.recordedSeconds))
            : assignedSeconds;
        let assignedUnits = assignedSeconds > 0 ? Math.floor(assignedSeconds / step) : 0;
        let recordedUnits = recordedSeconds > 0 ? Math.floor(recordedSeconds / step) : 0;
        if (assignedSeconds > 0 && assignedUnits === 0) assignedUnits = 1;
        if (recordedSeconds > 0 && recordedUnits === 0) recordedUnits = 1;
        return Math.max(assignedUnits, recordedUnits);
    }

    function getActualGridBlockRange(planUnits, unitIndex, _unitsPerRow = 6) {
        if (!Array.isArray(planUnits) || !Number.isFinite(unitIndex)) return null;
        if (unitIndex < 0 || unitIndex >= planUnits.length) return null;
        const label = planUnits[unitIndex];
        if (!label) return null;

        let start = unitIndex;
        while (start > 0 && planUnits[start - 1] === label) {
            start -= 1;
        }
        let end = unitIndex;
        while (end < planUnits.length - 1 && planUnits[end + 1] === label) {
            end += 1;
        }
        return { start, end, label };
    }

    function buildActualUnitsFromActivities(planUnits, activities, options = {}) {
        if (!Array.isArray(planUnits) || !Array.isArray(activities)) return [];
        const normalizeLabel = typeof options.normalizeLabel === 'function'
            ? options.normalizeLabel
            : (value) => String(value || '').trim();
        const step = resolveStepSeconds(options.stepSeconds);
        const counts = new Map();

        activities.forEach((item) => {
            if (!item || !item.label) return;
            const label = normalizeLabel(item.label || '');
            if (!label) return;
            const seconds = Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
            const units = Math.floor(seconds / step);
            if (units > 0) {
                counts.set(label, (counts.get(label) || 0) + units);
            }
        });

        return planUnits.map((label) => {
            if (!label) return false;
            const remaining = counts.get(label) || 0;
            if (remaining > 0) {
                counts.set(label, remaining - 1);
                return true;
            }
            return false;
        });
    }

    function buildActualActivitiesFromGrid(planUnits, actualUnits, options = {}) {
        if (!Array.isArray(planUnits) || !Array.isArray(actualUnits)) return [];
        const step = resolveStepSeconds(options.stepSeconds);
        const counts = new Map();

        for (let i = 0; i < planUnits.length; i++) {
            if (!actualUnits[i]) continue;
            const label = planUnits[i];
            if (!label) continue;
            counts.set(label, (counts.get(label) || 0) + 1);
        }

        const activities = [];
        const seen = new Set();
        planUnits.forEach((label) => {
            if (!label || seen.has(label)) return;
            const units = counts.get(label);
            if (units) {
                activities.push({ label, seconds: units * step, source: 'grid' });
            }
            seen.add(label);
        });
        return activities;
    }

    function insertLockedRowsAfterRelatedActivities(baseRows = [], lockedRows = [], planUnits = null) {
        const isLocked = (item) => {
            if (typeof this.isLockedActivityRow === 'function') {
                return this.isLockedActivityRow(item);
            }
            return Boolean(item && item.source === 'locked');
        };
        const normalize = (value) => this.normalizeActivityText
            ? this.normalizeActivityText(value || '')
            : String(value || '').trim();
        const safeBase = Array.isArray(baseRows)
            ? baseRows
                .filter((item) => item && typeof item === 'object')
                .map((item) => ({ ...item }))
            : [];
        const safeLockedSource = Array.isArray(lockedRows)
            ? lockedRows.filter((item) => item && typeof item === 'object')
            : [];
        if (safeLockedSource.length === 0) return safeBase;

        const sortedLocked = (typeof this.sortActivitiesByOrder === 'function')
            ? this.sortActivitiesByOrder(safeLockedSource)
            : safeLockedSource;
        const resolveAnchorLabel = (lockedRow) => {
            if (!lockedRow || !Array.isArray(planUnits) || planUnits.length === 0) return '';
            const readPlanLabel = (rawUnit) => {
                const unit = Number.isFinite(rawUnit) ? Math.floor(rawUnit) : null;
                if (unit == null || unit < 0 || unit >= planUnits.length) return '';
                return normalize(planUnits[unit] || '');
            };
            if (Array.isArray(lockedRow.lockUnits)) {
                for (let i = 0; i < lockedRow.lockUnits.length; i++) {
                    const label = readPlanLabel(Number(lockedRow.lockUnits[i]));
                    if (label) return label;
                }
            }
            const lockStart = Number.isFinite(lockedRow.lockStart) ? Math.floor(lockedRow.lockStart) : null;
            const lockEnd = Number.isFinite(lockedRow.lockEnd) ? Math.floor(lockedRow.lockEnd) : null;
            if (lockStart == null && lockEnd == null) return '';
            const from = Math.max(0, Math.min(
                (lockStart != null ? lockStart : lockEnd),
                (lockEnd != null ? lockEnd : lockStart)
            ));
            const to = Math.min(planUnits.length - 1, Math.max(
                (lockStart != null ? lockStart : lockEnd),
                (lockEnd != null ? lockEnd : lockStart)
            ));
            for (let unit = from; unit <= to; unit++) {
                const label = normalize(planUnits[unit] || '');
                if (label) return label;
            }
            return '';
        };

        const result = safeBase.slice();
        sortedLocked.forEach((lockedRow) => {
            const nextLockedRow = { ...lockedRow };
            const anchorLabel = resolveAnchorLabel(nextLockedRow);
            let anchorIndex = -1;

            if (anchorLabel) {
                for (let i = result.length - 1; i >= 0; i--) {
                    const row = result[i];
                    if (!row || isLocked(row)) continue;
                    const rowLabel = normalize(row.label || '');
                    if (rowLabel === anchorLabel) {
                        anchorIndex = i;
                        break;
                    }
                }
            }

            if (anchorIndex < 0 && result.length > 0) {
                for (let i = result.length - 1; i >= 0; i--) {
                    if (!isLocked(result[i])) {
                        anchorIndex = i;
                        break;
                    }
                }
            }

            let insertIndex = Math.max(0, anchorIndex + 1);
            while (insertIndex < result.length && isLocked(result[insertIndex])) {
                insertIndex += 1;
            }
            result.splice(insertIndex, 0, nextLockedRow);
        });
        return result;
    }

    function getActualGridLockedUnitsForBase(baseIndex, planUnits = null, activities = null) {
        const units = Array.isArray(planUnits) ? planUnits.slice() : [];
        if (units.length === 0) return [];
        const slot = this.timeSlots[baseIndex];
        const normalize = (value) => this.normalizeActivityText
            ? this.normalizeActivityText(value || '')
            : String(value || '').trim();
        const normalizeActivities = (raw) => {
            if (typeof this.normalizeActivitiesArray === 'function') {
                return this.normalizeActivitiesArray(raw);
            }
            return Array.isArray(raw) ? raw.map((item) => ({ ...item })) : [];
        };
        const isManualLocked = (item) => {
            if (typeof this.isManualLockedActivityRow === 'function') {
                return this.isManualLockedActivityRow(item);
            }
            return item && item.source === 'locked' && item.isAutoLocked === false;
        };

        const sourceActivities = Array.isArray(activities)
            ? activities
            : normalizeActivities(slot && slot.activityLog && slot.activityLog.subActivities);
        if (!Array.isArray(sourceActivities) || sourceActivities.length === 0) {
            return new Array(units.length).fill(false);
        }
        const lockData = this.extractLockedRowsFromActivities(sourceActivities, units.length);
        const manualMask = Array.isArray(lockData.manualMask) ? lockData.manualMask : new Array(units.length).fill(false);
        const manualCount = Array.isArray(lockData.manualMask)
            ? lockData.manualMask.reduce((sum, value) => sum + (value ? 1 : 0), 0)
            : 0;

        const nonManualActivities = (Array.isArray(sourceActivities) ? sourceActivities : []).filter(
            (item) => !isManualLocked(item)
        );
        const step = this.getActualDurationStepSeconds();
        let assignedUnitsTotal = 0;
        (Array.isArray(nonManualActivities) ? nonManualActivities : []).forEach((item) => {
            if (!item) return;
            if (item.source === 'locked') return;
            const label = normalize(item.label || '');
            if (!label) return;
            const seconds = Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
            const unitsCount = seconds > 0 ? Math.floor(seconds / step) : 0;
            assignedUnitsTotal += unitsCount;
        });
        const lockedUnits = manualMask.slice(0);
        const allowedUnitsTotal = Math.max(0, Math.min(units.length, assignedUnitsTotal));
        const totalLockedCount = Math.max(0, units.length - allowedUnitsTotal);
        const autoLockedCount = Math.max(0, totalLockedCount - manualCount);
        if (autoLockedCount <= 0) {
            return lockedUnits;
        }

        let displayOrder = this.getActualGridDisplayOrderIndices
            ? this.getActualGridDisplayOrderIndices(units, nonManualActivities, new Set())
            : units.map((_, idx) => idx);
        if (!Array.isArray(displayOrder) || displayOrder.length !== units.length) {
            displayOrder = units.map((_, idx) => idx);
        }
        const selectableOrder = displayOrder.filter((unitIndex) => {
            return Number.isInteger(unitIndex) && unitIndex >= 0 && unitIndex < units.length && !manualMask[unitIndex];
        });

        const hasLockedRow = nonManualActivities.some((item) => item && item.source === 'locked');
        const autoSelectOrder = selectableOrder.slice();
        if (autoSelectOrder.length === 0) {
            return lockedUnits;
        }

        if (!hasLockedRow) {
            const count = Math.min(autoLockedCount, autoSelectOrder.length);
            for (let i = 0; i < count; i++) {
                const visualPos = autoSelectOrder.length - 1 - i;
                const unitIndex = autoSelectOrder[visualPos];
                if (!Number.isFinite(unitIndex) || unitIndex < 0 || unitIndex >= units.length) continue;
                lockedUnits[unitIndex] = true;
            }
            return lockedUnits;
        }

        const planLabelSet = new Set();
        units.forEach((label) => {
            const normalizedLabel = normalize(label || '');
            if (normalizedLabel) planLabelSet.add(normalizedLabel);
        });
        displayOrder = this.getActualGridDisplayOrderIndices
            ? this.getActualGridDisplayOrderIndices(units, nonManualActivities, planLabelSet)
            : units.map((_, idx) => idx);
        if (!Array.isArray(displayOrder) || displayOrder.length !== units.length) {
            displayOrder = units.map((_, idx) => idx);
        }

        const lockedRowIndex = nonManualActivities.findIndex((item) => item && item.source === 'locked');
        if (lockedRowIndex < 0) {
            for (let i = autoSelectOrder.length - 1;
                i >= 0 && (autoSelectOrder.length - 1 - i) < autoLockedCount;
                i--) {
                const unitIndex = autoSelectOrder[i];
                if (!Number.isFinite(unitIndex) || unitIndex < 0 || unitIndex >= units.length) continue;
                lockedUnits[unitIndex] = true;
            }
            return lockedUnits;
        }

        const labelsBeforeLocked = new Set();
        for (let i = 0; i < lockedRowIndex; i++) {
            const item = sourceActivities[i];
            if (!item || item.source === 'locked') continue;
            const label = normalize(item.label || '');
            if (!label || !planLabelSet.has(label)) continue;
            labelsBeforeLocked.add(label);
        }

        let startAt = 0;
        if (labelsBeforeLocked.size > 0) {
            startAt = displayOrder.reduce((sum, unitIndex) => {
                const label = normalize(units[unitIndex] || '');
                if (label && labelsBeforeLocked.has(label)) return sum + 1;
                return sum;
            }, 0);
        }
        if (startAt >= units.length) {
            startAt = Math.max(0, autoSelectOrder.length - autoLockedCount);
        }

        let selectCount = 0;
        for (let offset = 0; offset < autoLockedCount; offset++) {
            const visualPos = startAt + offset;
            if (visualPos < 0 || visualPos >= autoSelectOrder.length) break;
            const unitIndex = autoSelectOrder[visualPos];
            if (!Number.isFinite(unitIndex) || unitIndex < 0 || unitIndex >= units.length) continue;
            lockedUnits[unitIndex] = true;
            selectCount += 1;
        }

        if (selectCount < autoLockedCount && lockedUnits.length > 0) {
            const fallbackCount = autoLockedCount - selectCount;
            for (let i = autoSelectOrder.length - 1; i >= 0 && (autoSelectOrder.length - 1 - i) < fallbackCount; i--) {
                const unitIndex = autoSelectOrder[i];
                if (!Number.isFinite(unitIndex) || unitIndex < 0 || unitIndex >= units.length) continue;
                lockedUnits[unitIndex] = true;
            }
        }

        return lockedUnits;
    }

    function getActualGridManualLockedUnitsForBase(baseIndex, planUnits = null, activities = null) {
        const units = Array.isArray(planUnits) ? planUnits.slice() : [];
        if (units.length === 0) return [];
        const slot = this.timeSlots[baseIndex];
        const normalizeActivities = (raw) => {
            if (typeof this.normalizeActivitiesArray === 'function') {
                return this.normalizeActivitiesArray(raw);
            }
            return Array.isArray(raw) ? raw.map((item) => ({ ...item })) : [];
        };
        const sourceActivities = Array.isArray(activities)
            ? activities
            : normalizeActivities(slot && slot.activityLog && slot.activityLog.subActivities);
        if (!Array.isArray(sourceActivities) || sourceActivities.length === 0) {
            return new Array(units.length).fill(false);
        }
        const lockData = this.extractLockedRowsFromActivities(sourceActivities, units.length);
        return Array.isArray(lockData.manualMask)
            ? lockData.manualMask.map((value) => Boolean(value))
            : new Array(units.length).fill(false);
    }

    function buildExtraSlotAllocation(planUnits, actualUnits, extraActivities, orderIndices = null, lockedUnits = null) {
        const slotsByIndex = Array.isArray(planUnits) ? new Array(planUnits.length).fill('') : [];
        const slotsByLabel = new Map();
        if (!Array.isArray(planUnits) || planUnits.length === 0) {
            return { slotsByIndex, slotsByLabel };
        }
        const available = [];
        const safeActualUnits = Array.isArray(actualUnits) ? actualUnits : [];
        const safeLockedUnits = Array.isArray(lockedUnits) ? lockedUnits : [];
        const useOrder = Array.isArray(orderIndices) && orderIndices.length === planUnits.length
            ? orderIndices
            : null;
        if (useOrder) {
            useOrder.forEach((idx) => {
                if (!Number.isFinite(idx) || idx < 0 || idx >= planUnits.length) return;
                if (safeLockedUnits[idx]) return;
                if (!safeActualUnits[idx]) available.push(idx);
            });
        } else {
            for (let i = 0; i < planUnits.length; i++) {
                if (safeLockedUnits[i]) continue;
                if (!safeActualUnits[i]) available.push(i);
            }
        }
        if (available.length === 0) return { slotsByIndex, slotsByLabel };

        const orderedActivities = Array.isArray(arguments[5]) ? arguments[5] : null;
        const planLabelSet = arguments[6] instanceof Set ? arguments[6] : null;
        const normalize = (value) => this.normalizeActivityText
            ? this.normalizeActivityText(value || '')
            : String(value || '').trim();
        const assignExtraUnit = (label, unitIndex) => {
            slotsByIndex[unitIndex] = label;
            if (!slotsByLabel.has(label)) slotsByLabel.set(label, []);
            slotsByLabel.get(label).push(unitIndex);
        };

        let usedOrderAwareAllocation = false;
        if (orderedActivities && planLabelSet) {
            const remainingUnitsByLabel = new Map();
            (Array.isArray(extraActivities) ? extraActivities : []).forEach((item) => {
                if (!item) return;
                const label = normalize(item.label || '');
                if (!label) return;
                const units = this.getExtraActivityUnitCount(item);
                if (units <= 0) return;
                remainingUnitsByLabel.set(label, (remainingUnitsByLabel.get(label) || 0) + units);
            });

            if (remainingUnitsByLabel.size > 0) {
                let headCursor = 0;
                let tailCursor = available.length - 1;
                const hasPlanAfterIndex = (startIndex) => {
                    for (let i = startIndex + 1; i < orderedActivities.length; i++) {
                        const next = orderedActivities[i];
                        if (!next) continue;
                        const nextLabel = normalize(next.label || '');
                        if (nextLabel && planLabelSet.has(nextLabel)) return true;
                    }
                    return false;
                };

                orderedActivities.forEach((item, idx) => {
                    if (!item) return;
                    const label = normalize(item.label || '');
                    if (!label) return;
                    if (planLabelSet.has(label)) return;

                    let remainingForLabel = remainingUnitsByLabel.get(label) || 0;
                    if (remainingForLabel <= 0) return;

                    let units = this.getExtraActivityUnitCount(item);
                    if (units <= 0) return;

                    const placeFromHead = hasPlanAfterIndex(idx);
                    while (units > 0 && remainingForLabel > 0 && headCursor <= tailCursor) {
                        const unitIndex = placeFromHead
                            ? available[headCursor++]
                            : available[tailCursor--];
                        assignExtraUnit(label, unitIndex);
                        units -= 1;
                        remainingForLabel -= 1;
                        usedOrderAwareAllocation = true;
                    }
                    remainingUnitsByLabel.set(label, remainingForLabel);
                });

                if (headCursor <= tailCursor) {
                    let cursor = tailCursor;
                    (Array.isArray(extraActivities) ? extraActivities : []).forEach((item) => {
                        if (!item) return;
                        const label = normalize(item.label || '');
                        if (!label) return;
                        let units = remainingUnitsByLabel.get(label) || 0;
                        while (units > 0 && cursor >= headCursor) {
                            const unitIndex = available[cursor];
                            cursor -= 1;
                            units -= 1;
                            assignExtraUnit(label, unitIndex);
                            usedOrderAwareAllocation = true;
                        }
                        remainingUnitsByLabel.set(label, units);
                    });
                }
            }
        }

        if (usedOrderAwareAllocation) {
            return { slotsByIndex, slotsByLabel };
        }

        let cursor = available.length - 1;
        (Array.isArray(extraActivities) ? extraActivities : []).forEach((item) => {
            if (!item) return;
            const label = normalize(item.label || '');
            if (!label) return;
            let units = this.getExtraActivityUnitCount(item);
            while (units > 0 && cursor >= 0) {
                const unitIndex = available[cursor];
                cursor -= 1;
                units -= 1;
                assignExtraUnit(label, unitIndex);
            }
        });

        return { slotsByIndex, slotsByLabel };
    }

    function mergeActualActivitiesWithGrid(baseIndex, planUnits, gridActivities, existingActivities = null, planLabel = '') {
        const isLockedRow = (item) => {
            if (typeof this.isLockedActivityRow === 'function') {
                return this.isLockedActivityRow(item);
            }
            return Boolean(item && item.source === 'locked');
        };
        const labelSet = new Set();
        if (Array.isArray(planUnits)) {
            planUnits.forEach((label) => {
                const normalized = this.normalizeActivityText
                    ? this.normalizeActivityText(label || '')
                    : String(label || '').trim();
                if (normalized) labelSet.add(normalized);
            });
        }

        const step = this.getActualDurationStepSeconds();
        const planAssignedMap = new Map();
        (Array.isArray(planUnits) ? planUnits : []).forEach((label) => {
            const normalized = this.normalizeActivityText
                ? this.normalizeActivityText(label || '')
                : String(label || '').trim();
            if (!normalized) return;
            planAssignedMap.set(normalized, (planAssignedMap.get(normalized) || 0) + step);
        });

        const gridSecondsMap = new Map();
        (Array.isArray(gridActivities) ? gridActivities : []).forEach((item) => {
            if (!item || !item.label) return;
            const normalized = this.normalizeActivityText
                ? this.normalizeActivityText(item.label || '')
                : String(item.label || '').trim();
            if (!normalized) return;
            const seconds = Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
            gridSecondsMap.set(normalized, seconds);
        });

        const slot = this.timeSlots[baseIndex];
        const baseList = Array.isArray(existingActivities)
            ? existingActivities
            : this.normalizeActualActivitiesList(slot && slot.activityLog && slot.activityLog.subActivities);

        const merged = [];
        const seenGrid = new Set();

        if (baseList.length > 0) {
            baseList.forEach((item) => {
                if (!item) return;
                const label = this.normalizeActivityText
                    ? this.normalizeActivityText(item.label || '')
                    : String(item.label || '').trim();
                const seconds = Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
                const recordedSeconds = Number.isFinite(item.recordedSeconds)
                    ? Math.max(0, Math.floor(item.recordedSeconds))
                    : null;
                const normalizedOrder = Number.isFinite(item.order) ? Math.max(0, Math.floor(item.order)) : null;
                if (!label && seconds <= 0 && !isLockedRow(item)) return;
                if (isLockedRow(item)) {
                    const lockedEntry = { label, seconds, source: 'locked' };
                    if (recordedSeconds != null) {
                        lockedEntry.recordedSeconds = recordedSeconds;
                    }
                    if (normalizedOrder != null) {
                        lockedEntry.order = normalizedOrder;
                    }
                    if (item.isAutoLocked === false) {
                        lockedEntry.isAutoLocked = false;
                    } else if (item.isAutoLocked === true) {
                        lockedEntry.isAutoLocked = true;
                    }
                    if (Array.isArray(item.lockUnits)) {
                        lockedEntry.lockUnits = item.lockUnits
                            .filter((value) => Number.isFinite(value))
                            .map((value) => Math.floor(value));
                    }
                    const lockStart = Number.isFinite(item.lockStart) ? Math.floor(item.lockStart) : null;
                    const lockEnd = Number.isFinite(item.lockEnd) ? Math.floor(item.lockEnd) : null;
                    if (lockStart != null) lockedEntry.lockStart = lockStart;
                    if (lockEnd != null) lockedEntry.lockEnd = lockEnd;
                    merged.push(lockedEntry);
                    return;
                }
                if (label && labelSet.has(label)) {
                    const assignedSeconds = Number.isFinite(seconds)
                        ? seconds
                        : (planAssignedMap.get(label) || 0);
                    const entry = { label, seconds: assignedSeconds, source: 'grid' };
                    if (normalizedOrder != null) {
                        entry.order = normalizedOrder;
                    }
                    merged.push(entry);
                    seenGrid.add(label);
                } else {
                    const source = (item.source && item.source !== 'grid') ? item.source : 'extra';
                    const entry = { label, seconds, source };
                    if (recordedSeconds != null) entry.recordedSeconds = recordedSeconds;
                    if (normalizedOrder != null) entry.order = normalizedOrder;
                    merged.push(entry);
                }
            });
        }

        const orderedLabels = this.getPlanLabelOrderForActual(baseIndex, planUnits, planLabel);
        orderedLabels.forEach((label) => {
            if (seenGrid.has(label)) return;
            const assignedSeconds = planAssignedMap.get(label) || 0;
            const fallbackGridSeconds = gridSecondsMap.get(label) || 0;
            merged.push({
                label,
                seconds: assignedSeconds > 0 ? assignedSeconds : fallbackGridSeconds,
                source: 'grid'
            });
            seenGrid.add(label);
        });

        return merged;
    }

    return Object.freeze({
        getExtraActivityUnitCount,
        getActualGridBlockRange,
        buildActualUnitsFromActivities,
        buildActualActivitiesFromGrid,
        insertLockedRowsAfterRelatedActivities,
        getActualGridLockedUnitsForBase,
        getActualGridManualLockedUnitsForBase,
        buildExtraSlotAllocation,
        mergeActualActivitiesWithGrid,
    });
});
