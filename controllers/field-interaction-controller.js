(function attachTimeTrackerFieldInteractionController(root, factory) {
    const api = factory(root);

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        const existing = (root.TimeTrackerFieldInteractionController && typeof root.TimeTrackerFieldInteractionController === 'object')
            ? root.TimeTrackerFieldInteractionController
            : {};
        root.TimeTrackerFieldInteractionController = Object.assign(existing, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildTimeTrackerFieldInteractionController(root) {
    function handleMergedClickCapture(e) {
        const target = e.target;
        if (e.type === 'click') {
            const plannedInput = target.closest && target.closest('.planned-input');
            if (plannedInput) {
                const plannedIndex = parseInt(plannedInput.dataset.index, 10);
                if (Number.isInteger(plannedIndex)) {
                    if (this.suppressInlinePlanClickOnce === plannedIndex) {
                        this.suppressInlinePlanClickOnce = null;
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }
                    const plannedRange = this.getPlannedRangeInfo(plannedIndex);
                    if (this.inlinePlanDropdown && this.isSameInlinePlanTarget(plannedRange)) {
                        e.preventDefault();
                        e.stopPropagation();
                        this.clearSelection('planned');
                        this.closeInlinePlanDropdown();
                        return;
                    }
                }
            }
            if (this.inlinePlanDropdown && this.inlinePlanTarget) {
                const currentRow = target.closest && target.closest('.time-entry[data-index]');
                if (currentRow) {
                    const currentIndex = parseInt(currentRow.getAttribute('data-index'), 10);
                    if (Number.isInteger(currentIndex) && Number.isFinite(e.clientX) && Number.isFinite(e.clientY)) {
                        const targetStart = Number.isInteger(this.inlinePlanTarget.startIndex)
                            ? this.inlinePlanTarget.startIndex
                            : currentIndex;
                        const targetEnd = Number.isInteger(this.inlinePlanTarget.endIndex)
                            ? this.inlinePlanTarget.endIndex
                            : targetStart;
                        const safeStart = Math.min(targetStart, targetEnd);
                        const safeEnd = Math.max(targetStart, targetEnd);
                        if (currentIndex >= safeStart && currentIndex <= safeEnd) {
                            const plannedCell = currentRow.querySelector('.planned-input');
                            if (plannedCell) {
                                const plannedRect = plannedCell.getBoundingClientRect();
                                const rowRect = currentRow.getBoundingClientRect();
                                const inPlannedColumn = e.clientX >= plannedRect.left
                                    && e.clientX <= plannedRect.right
                                    && e.clientY >= rowRect.top
                                    && e.clientY <= rowRect.bottom;
                                if (inPlannedColumn) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    this.clearSelection('planned');
                                    this.closeInlinePlanDropdown();
                                    return;
                                }
                            }
                        }
                    }
                }
            }
        }
        if (target.closest && target.closest('.activity-log-btn')) return;
        if (target.closest && target.closest('.split-visualization-actual')) return;

        const timeMerged = target.closest && target.closest('.time-slot-container.merged-time-main, .time-slot-container.merged-time-secondary');
        if (timeMerged) {
            if (target.closest('.timer-controls-container') || target.closest('.timer-btn')) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        const plannedEl = target.closest && target.closest('.planned-input[data-merge-key]');
        if (plannedEl) {
            const mergeKey = plannedEl.getAttribute('data-merge-key');
            if (!mergeKey) return;
            e.preventDefault();
            e.stopPropagation();
            if (e.type === 'mousedown') {
                this.queueMergedPlannedMouseSelection(
                    mergeKey,
                    parseInt(plannedEl.dataset.index, 10),
                    e.clientX,
                    e.clientY
                );
                return;
            }
            if (e.type === 'click') {
                if (this.suppressMergedClickOnce) {
                    this.suppressMergedClickOnce = false;
                    return;
                }
                this.pendingMergedMouseSelection = null;
                const range = this.activateMergedPlannedSelection(mergeKey, parseInt(plannedEl.dataset.index, 10));
                if (!range) return;
                const safeStart = range.start;
                const safeEnd = range.end;
                const anchor = document.querySelector(`[data-index="${safeStart}"] .planned-input`) || plannedEl;
                this.openInlinePlanDropdown(safeStart, anchor, safeEnd);
            }
            return;
        }

        const row = target.closest && target.closest('.time-entry');
        if (row && typeof e.clientX === 'number') {
            const rowRect = row.getBoundingClientRect();
            const index = parseInt(row.getAttribute('data-index'), 10);
            const x = e.clientX;
            const y = e.clientY;

            const prEl = row.querySelector('.planned-input');
            if (prEl) {
                const pr = prEl.getBoundingClientRect();
                const inPlanned = (x >= pr.left && x <= pr.right && y >= rowRect.top && y <= rowRect.bottom);
                if (inPlanned) {
                    const mk = this.findMergeKey('planned', index);
                    if (mk) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.type === 'mousedown') {
                            this.queueMergedPlannedMouseSelection(mk, index, e.clientX, e.clientY);
                            return;
                        }
                        if (e.type === 'click') {
                            if (this.suppressMergedClickOnce) {
                                this.suppressMergedClickOnce = false;
                                return;
                            }
                            this.pendingMergedMouseSelection = null;
                            const range = this.activateMergedPlannedSelection(mk, index);
                            if (!range) return;
                            const anchor = document.querySelector(`[data-index="${range.start}"] .planned-input`) || prEl;
                            this.openInlinePlanDropdown(range.start, anchor, range.end);
                        }
                        return;
                    }
                }
            }

            const arEl = row.querySelector('.actual-input');
            if (arEl) {
                const ar = arEl.getBoundingClientRect();
                const inActual = (x >= ar.left && x <= ar.right && y >= rowRect.top && y <= rowRect.bottom);
                if (inActual) {
                    const mk = this.findMergeKey('actual', index);
                    if (mk) {
                        const [, startStr] = mk.split('-');
                        const startIdx = parseInt(startStr, 10);
                        const mainContainer = target.closest && target.closest('.actual-field-container.merged-actual-main');

                        if (mainContainer && index === startIdx && !this.isSelectingPlanned && !this.isSelectingActual) {
                            return;
                        }

                        e.preventDefault();
                        e.stopPropagation();
                        if (e.type === 'click') {
                            if (this.isMergeRangeSelected('actual', mk)) this.clearSelection('actual');
                            else {
                                this.clearAllSelections();
                                this.selectMergedRange('actual', mk);
                            }
                        }
                        return;
                    }
                }
            }
        }
    }

    function attachPlannedFieldSelectionListeners(entryDiv, index, plannedField) {
        if (!plannedField) return;

        plannedField.addEventListener('click', (e) => {
            const mergeKey = this.findMergeKey('planned', index);
            if (!mergeKey) return;

            e.preventDefault();
            e.stopPropagation();
            const range = this.activateMergedPlannedSelection(mergeKey, index);
            if (!range) return;
            const mergeStart = range.start;
            const mergeEnd = range.end;
            const anchor = plannedField.closest('.split-cell-wrapper.split-type-planned') || plannedField;
            this.openInlinePlanDropdown(mergeStart, anchor, mergeEnd);
        });

        let plannedMouseMoved = false;
        let plannedMouseBaseRange = null;

        plannedField.addEventListener('mousedown', (e) => {
            const mouseRange = this.getPlannedRangeInfo(index);
            const sameInlineTarget = this.inlinePlanDropdown && this.isSameInlinePlanTarget(mouseRange);
            if (sameInlineTarget) {
                this.suppressInlinePlanClickOnce = index;
                this.clearSelection('planned');
            }
            this.closeInlinePlanDropdown();
            if (e.target === plannedField && !plannedField.matches(':focus')) {
                e.preventDefault();
                plannedMouseMoved = false;

                const mergeKeyAtStart = this.findMergeKey('planned', index);
                let rangeStart = index;
                let rangeEnd = index;
                if (mergeKeyAtStart) {
                    const [, sStr, eStr] = String(mergeKeyAtStart).split('-');
                    const parsedStart = parseInt(sStr, 10);
                    const parsedEnd = parseInt(eStr, 10);
                    if (Number.isFinite(parsedStart) && Number.isFinite(parsedEnd)) {
                        rangeStart = parsedStart;
                        rangeEnd = parsedEnd;
                    }
                }

                this.currentColumnType = 'planned';
                this.dragStartIndex = rangeStart;
                this.dragBaseEndIndex = rangeEnd;
                this.isSelectingPlanned = true;

                if (!e.ctrlKey && !e.metaKey) {
                    this.clearSelection('planned');
                }
                this.selectFieldRange('planned', rangeStart, rangeEnd);
                plannedMouseBaseRange = { start: rangeStart, end: rangeEnd };
            }
        });

        plannedField.addEventListener('mousemove', (e) => {
            if (e.target === plannedField && this.currentColumnType === 'planned' && this.isSelectingPlanned) {
                plannedMouseMoved = true;
                if (!e.ctrlKey && !e.metaKey) {
                    this.clearSelection('planned');
                }
                const base = plannedMouseBaseRange || { start: this.dragStartIndex, end: this.dragStartIndex };
                const nextStart = Math.min(base.start, index);
                const nextEnd = Math.max(base.end, index);
                this.selectFieldRange('planned', nextStart, nextEnd);
            }
        });

        plannedField.addEventListener('mouseup', (e) => {
            if (e.target === plannedField && !plannedField.matches(':focus') && this.currentColumnType === 'planned') {
                e.preventDefault();
                e.stopPropagation();

                const base = plannedMouseBaseRange || { start: index, end: index };
                const nextStart = Math.min(base.start, index);
                const nextEnd = Math.max(base.end, index);
                const suppressReopen = this.suppressInlinePlanClickOnce === index;

                if (!plannedMouseMoved) {
                    if (suppressReopen) {
                        this.clearSelection('planned');
                    } else {
                        if (this.selectedPlannedFields.has(index) && this.selectedPlannedFields.size === 1) {
                            this.clearSelection('planned');
                        } else {
                            this.clearAllSelections();
                            this.selectFieldRange('planned', nextStart, nextEnd);
                        }
                        if (!e.ctrlKey && !e.metaKey) {
                            const anchor = plannedField.closest('.split-cell-wrapper.split-type-planned') || plannedField;
                            this.openInlinePlanDropdown(base.start, anchor);
                        }
                    }
                } else {
                    if (!e.ctrlKey && !e.metaKey) {
                        this.clearSelection('planned');
                    }
                    this.selectFieldRange('planned', nextStart, nextEnd);
                }
                this.isSelectingPlanned = false;
                this.currentColumnType = null;
                this.dragBaseEndIndex = -1;
                plannedMouseBaseRange = null;
            }
        });

        let plannedTouchLongPressTimer = null;
        let plannedTouchLongPressActive = false;
        let plannedTouchBaseRange = null;
        const clearPlannedTouchLongPress = () => {
            if (plannedTouchLongPressTimer) {
                clearTimeout(plannedTouchLongPressTimer);
                plannedTouchLongPressTimer = null;
            }
        };

        plannedField.addEventListener('touchstart', (e) => {
            if (!e.touches || e.touches.length !== 1) return;
            plannedTouchLongPressActive = false;
            plannedTouchBaseRange = null;
            plannedMouseMoved = false;
            clearPlannedTouchLongPress();

            const mergeKeyAtStart = this.findMergeKey('planned', index);
            let rangeStart = index;
            let rangeEnd = index;
            if (mergeKeyAtStart) {
                const [, sStr, eStr] = String(mergeKeyAtStart).split('-');
                const parsedStart = parseInt(sStr, 10);
                const parsedEnd = parseInt(eStr, 10);
                if (Number.isFinite(parsedStart) && Number.isFinite(parsedEnd)) {
                    rangeStart = parsedStart;
                    rangeEnd = parsedEnd;
                }
            }

            plannedTouchLongPressTimer = setTimeout(() => {
                plannedTouchLongPressActive = true;
                plannedTouchBaseRange = { start: rangeStart, end: rangeEnd };
                this.closeInlinePlanDropdown();
                this.dragStartIndex = rangeStart;
                this.dragBaseEndIndex = rangeEnd;
                this.currentColumnType = 'planned';
                this.isSelectingPlanned = true;
                this.clearAllSelections();
                this.selectFieldRange('planned', rangeStart, rangeEnd);
                try {
                    plannedField.blur();
                } catch (_) {
                    // no-op
                }
            }, 280);
        }, { passive: true });

        plannedField.addEventListener('touchmove', (e) => {
            if (!plannedTouchLongPressActive) return;
            const t = e.touches && e.touches[0];
            if (!t) return;
            e.preventDefault();
            const hoverIndex = this.getIndexAtClientPosition('planned', t.clientX, t.clientY);
            if (!Number.isInteger(hoverIndex)) return;
            if (this.currentColumnType !== 'planned') return;
            plannedMouseMoved = true;

            const base = plannedTouchBaseRange || { start: this.dragStartIndex, end: this.dragStartIndex };
            const nextStart = Math.min(base.start, hoverIndex);
            const nextEnd = Math.max(base.end, hoverIndex);
            this.clearSelection('planned');
            this.selectFieldRange('planned', nextStart, nextEnd);
        }, { passive: false });

        plannedField.addEventListener('touchend', (e) => {
            clearPlannedTouchLongPress();
            if (plannedTouchLongPressActive) {
                e.preventDefault();
                e.stopPropagation();
                this.isSelectingPlanned = false;
                this.currentColumnType = null;
                this.dragStartIndex = -1;
                this.dragBaseEndIndex = -1;
            }
            plannedTouchLongPressActive = false;
            plannedTouchBaseRange = null;
        }, { passive: false });

        plannedField.addEventListener('touchcancel', () => {
            clearPlannedTouchLongPress();
            plannedTouchLongPressActive = false;
            plannedTouchBaseRange = null;
            this.isSelectingPlanned = false;
            this.currentColumnType = null;
            this.dragStartIndex = -1;
            this.dragBaseEndIndex = -1;
        }, { passive: true });

        plannedField.addEventListener('mouseenter', (e) => {
            if (!this.isSelectingPlanned) {
                this.showScheduleButtonOnHover(index);
            }
            if (this.isSelectingPlanned && this.currentColumnType === 'planned') {
                plannedMouseMoved = true;
                if (!e.ctrlKey && !e.metaKey) {
                    this.clearSelection('planned');
                }
                const base = plannedMouseBaseRange || { start: this.dragStartIndex, end: this.dragStartIndex };
                const nextStart = Math.min(base.start, index);
                const nextEnd = Math.max(base.end, index);
                this.selectFieldRange('planned', nextStart, nextEnd);
            }
        });

        plannedField.addEventListener('mouseleave', (e) => {
            const toEl = e.relatedTarget;
            if (toEl && toEl.closest && (toEl.closest('.schedule-button') || toEl.closest('.undo-button'))) return;
            const mk = this.findMergeKey('planned', index);
            if (mk && toEl && toEl.closest) {
                if (
                    toEl.closest(`.planned-merged-main-container[data-merge-key="${mk}"]`) ||
                    toEl.closest('.planned-merged-overlay') ||
                    toEl.closest(`.input-field.planned-input[data-merge-key="${mk}"]`)
                ) {
                    return;
                }
            }
            this.hideHoverScheduleButton();
        });

        const mk2 = this.findMergeKey('planned', index);
        if (mk2) {
            const mergedMain = entryDiv.querySelector(`.planned-merged-main-container[data-merge-key="${mk2}"]`);
            if (mergedMain) {
                const updateHover = (ev) => {
                    if (this.isSelectingPlanned) return;
                    const hoverIdx = this.getIndexAtClientPosition('planned', ev.clientX, ev.clientY);
                    if (hoverIdx != null) this.showScheduleButtonOnHover(hoverIdx);
                };
                mergedMain.addEventListener('mouseenter', updateHover);
                mergedMain.addEventListener('mousemove', updateHover);
                mergedMain.addEventListener('mouseleave', (ev) => {
                    const toEl2 = ev.relatedTarget;
                    if (toEl2 && toEl2.closest && (
                        toEl2.closest('.schedule-button') ||
                        toEl2.closest('.undo-button') ||
                        toEl2.closest(`.planned-merged-main-container[data-merge-key="${mk2}"]`)
                    )) return;
                    this.hideHoverScheduleButton();
                });
            }
        }
    }

    function attachRowWideClickTargets(entryDiv, index) {
        entryDiv.addEventListener('click', (e) => {
            const plannedField = entryDiv.querySelector('.planned-input');
            const actualField = entryDiv.querySelector('.actual-input');
            if (!plannedField && !actualField) return;

            const rowRect = entryDiv.getBoundingClientRect();
            const x = e.clientX;
            const y = e.clientY;

            if (plannedField) {
                const pr = plannedField.getBoundingClientRect();
                const inPlannedCol = (x >= pr.left && x <= pr.right && y >= rowRect.top && y <= rowRect.bottom);
                if (inPlannedCol) {
                    const mk = this.findMergeKey('planned', index);
                    if (mk) {
                        e.preventDefault();
                        e.stopPropagation();
                        const range = this.activateMergedPlannedSelection(mk, index);
                        if (!range) return;
                        const anchor = entryDiv.querySelector('.planned-input') || document.querySelector(`[data-index="${range.start}"] .planned-input`);
                        if (anchor) this.openInlinePlanDropdown(range.start, anchor, range.end);
                        return;
                    }
                }
            }
        });
    }

    function attachCellClickListeners(entryDiv, index) {
        const plannedField = entryDiv.querySelector('.planned-input');
        if (plannedField && !plannedField.dataset.mergeKey) {
            plannedField.addEventListener('mousedown', (e) => {
                const range = this.getPlannedRangeInfo(index);
                if (!this.inlinePlanDropdown || !this.isSameInlinePlanTarget(range)) return;

                e.preventDefault();
                e.stopPropagation();
                this.suppressInlinePlanClickOnce = index;
                this.clearSelection('planned');
                this.closeInlinePlanDropdown();
            });
            plannedField.addEventListener('click', (e) => {
                if (this.suppressInlinePlanClickOnce === index) {
                    this.suppressInlinePlanClickOnce = null;
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                e.preventDefault();
                e.stopPropagation();

                const range = this.getPlannedRangeInfo(index);
                if (this.inlinePlanDropdown && this.isSameInlinePlanTarget(range)) {
                    this.clearSelection('planned');
                    this.closeInlinePlanDropdown();
                    return;
                }

                const anchor = plannedField.closest('.split-cell-wrapper.split-type-planned') || plannedField;
                this.openInlinePlanDropdown(range.startIndex, anchor, range.endIndex);
            });
        }
    }

    return {
        handleMergedClickCapture,
        attachPlannedFieldSelectionListeners,
        attachRowWideClickTargets,
        attachCellClickListeners,
    };
});
