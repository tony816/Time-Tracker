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
    function getAnchorMinWidthFromElement(el) {
        const rect = el && typeof el.getBoundingClientRect === 'function'
            ? el.getBoundingClientRect()
            : null;
        return rect && Number.isFinite(rect.width) && rect.width > 0
            ? Math.floor(rect.width)
            : 0;
    }

    function getPlannedContextForIndex(ctx, index) {
        if (ctx && typeof ctx.resolvePlannedSlotContext === 'function') {
            return ctx.resolvePlannedSlotContext(index);
        }
        const range = ctx && typeof ctx.getPlannedRangeInfo === 'function'
            ? ctx.getPlannedRangeInfo(index)
            : { startIndex: index, endIndex: index, mergeKey: null };
        const start = Number.isInteger(range.startIndex) ? range.startIndex : index;
        const end = Number.isInteger(range.endIndex) ? range.endIndex : start;
        const slotCount = Math.max(1, end - start + 1);
        return {
            clickedIndex: index,
            baseIndex: start,
            rangeStart: start,
            rangeEnd: end,
            mergeKey: range.mergeKey || null,
            isMerged: Boolean(range.mergeKey && slotCount > 1),
            slotCount,
            blockMinutes: slotCount * 60,
        };
    }

    function getMergedPlannedBlockAnchor(ctx, context, fallbackEl) {
        if (!context || !context.isMerged || typeof document === 'undefined') return fallbackEl;
        return document.querySelector(`[data-index="${context.rangeStart}"] .planned-merged-main-container`)
            || document.querySelector(`[data-index="${context.rangeStart}"] .split-cell-wrapper.split-type-planned`)
            || document.querySelector(`[data-index="${context.rangeStart}"] .planned-input`)
            || fallbackEl;
    }

    function scheduleAfterAnimationFrame(callback) {
        const rootWindow = typeof window !== 'undefined' ? window : root;
        if (rootWindow && typeof rootWindow.requestAnimationFrame === 'function') {
            rootWindow.requestAnimationFrame(() => {
                rootWindow.requestAnimationFrame(callback);
            });
            return;
        }
        callback();
    }

    function isMobileInlinePlanSheetContext(ctx) {
        return Boolean(
            ctx
            && ctx.inlinePlanDropdown
            && ctx.inlinePlanDropdown.classList
            && ctx.inlinePlanDropdown.classList.contains('inline-plan-dropdown-sheet')
            && typeof ctx.isInlinePlanMobileInputContext === 'function'
            && ctx.isInlinePlanMobileInputContext()
        );
    }

    function syncOpenInlinePlanSheetTarget(ctx, targetEl) {
        if (!isMobileInlinePlanSheetContext(ctx)) return;
        if (typeof ctx.scheduleInlinePlanSheetTargetViewportCorrection === 'function') {
            ctx.scheduleInlinePlanSheetTargetViewportCorrection(targetEl);
            return;
        }
        if (typeof ctx.scheduleInlinePlanViewportSync === 'function') {
            ctx.scheduleInlinePlanViewportSync();
        }
    }

    function resetPlannedSelectionDragState(ctx) {
        if (!ctx) return;
        ctx.isSelectingPlanned = false;
        ctx.currentColumnType = null;
        ctx.dragStartIndex = -1;
        ctx.dragBaseEndIndex = -1;
    }

    function openPlannedFieldDropdownWithViewportPreparation(ctx, index, plannedField, endIndex = null, options = {}) {
        if (!ctx || !plannedField || typeof ctx.openInlinePlanDropdown !== 'function') return;
        const context = getPlannedContextForIndex(ctx, index);
        const range = typeof ctx.getPlannedRangeInfo === 'function'
            ? ctx.getPlannedRangeInfo(context.baseIndex)
            : { startIndex: context.rangeStart, endIndex: context.rangeEnd };
        if (Number.isInteger(endIndex)) {
            range.startIndex = Math.min(range.startIndex, endIndex);
            range.endIndex = Math.max(range.endIndex, endIndex);
        }
        const effectiveRangeStart = Number.isInteger(range.startIndex) ? range.startIndex : context.rangeStart;
        const effectiveRangeEnd = Number.isInteger(range.endIndex) ? range.endIndex : effectiveRangeStart;
        const effectiveSlotCount = Math.max(1, effectiveRangeEnd - effectiveRangeStart + 1);
        const effectiveIsMerged = Boolean(context.isMerged || (range.mergeKey && effectiveSlotCount > 1));
        const effectiveContext = context.isMerged
            ? context
            : {
                ...context,
                baseIndex: effectiveRangeStart,
                rangeStart: effectiveRangeStart,
                rangeEnd: effectiveRangeEnd,
                isMerged: effectiveIsMerged,
                slotCount: effectiveSlotCount,
                blockMinutes: effectiveSlotCount * 60,
            };
        const rawAnchor = plannedField.closest && plannedField.closest('.split-cell-wrapper.split-type-planned')
            ? plannedField.closest('.split-cell-wrapper.split-type-planned')
            : plannedField;
        const anchor = getMergedPlannedBlockAnchor(ctx, effectiveContext, rawAnchor);
        const sheetTargetEl = effectiveContext.isMerged ? (rawAnchor || plannedField) : plannedField;
        const viewportTargetEl = effectiveContext.isMerged ? sheetTargetEl : (anchor || plannedField);
        const open = () => {
            ctx.openInlinePlanDropdown(range.startIndex, anchor, range.endIndex, {
                anchorMinWidth: getAnchorMinWidthFromElement(anchor || plannedField),
                sheetTargetEl,
                baseIndex: effectiveContext.baseIndex,
                rangeStart: effectiveContext.rangeStart,
                rangeEnd: effectiveContext.rangeEnd,
                mergeKey: effectiveContext.mergeKey,
                blockMinutes: effectiveContext.blockMinutes,
                ...options,
            });
            syncOpenInlinePlanSheetTarget(ctx, sheetTargetEl);
        };
        const delayed = typeof ctx.preparePlannedSlotReplacementViewport === 'function'
            ? ctx.preparePlannedSlotReplacementViewport(viewportTargetEl || sheetTargetEl || plannedField)
            : false;
        if (delayed) {
            scheduleAfterAnimationFrame(open);
            return;
        }
        open();
    }

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
                        if (isMobileInlinePlanSheetContext(this)) {
                            const sheetTargetEl = plannedInput.closest && plannedInput.closest('.split-cell-wrapper.split-type-planned')
                                ? plannedInput.closest('.split-cell-wrapper.split-type-planned')
                                : plannedInput;
                            syncOpenInlinePlanSheetTarget(this, sheetTargetEl);
                            return;
                        }
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
                                    if (isMobileInlinePlanSheetContext(this)) {
                                        const sheetTargetEl = plannedCell.closest && plannedCell.closest('.split-cell-wrapper.split-type-planned')
                                            ? plannedCell.closest('.split-cell-wrapper.split-type-planned')
                                            : plannedCell;
                                        syncOpenInlinePlanSheetTarget(this, sheetTargetEl);
                                        return;
                                    }
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
        const timeMerged = target.closest && target.closest('.time-slot-container.merged-time-main, .time-slot-container.merged-time-secondary');
        if (timeMerged && (target.closest('.timer-controls-container') || target.closest('.timer-btn'))) {
            return;
        }
    }

    function attachPlannedFieldSelectionListeners(entryDiv, index, plannedField) {
        if (!plannedField) return;

        plannedField.addEventListener('mousedown', (e) => {
            const mouseRange = this.getPlannedRangeInfo(index);
            const sameInlineTarget = this.inlinePlanDropdown && this.isSameInlinePlanTarget(mouseRange);
            if (sameInlineTarget && isMobileInlinePlanSheetContext(this)) {
                this.suppressInlinePlanClickOnce = index;
                if (e.preventDefault) e.preventDefault();
                if (e.stopPropagation) e.stopPropagation();
                syncOpenInlinePlanSheetTarget(this, plannedField);
                return;
            }
            if (sameInlineTarget) {
                this.suppressInlinePlanClickOnce = index;
                this.clearSelection('planned');
            }
            this.closeInlinePlanDropdown();
        });

        plannedField.addEventListener('mouseenter', (e) => {
            if (!this.isSelectingPlanned) {
                this.showScheduleButtonOnHover(index);
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
        void entryDiv;
        void index;
    }

    function attachTimeSlotMergeEntryListeners(entryDiv, index) {
        const timeSlot = entryDiv && entryDiv.querySelector
            ? entryDiv.querySelector('.time-slot-container')
            : null;
        if (!timeSlot) return;
        const doc = (timeSlot.ownerDocument || (typeof document !== 'undefined' ? document : null));

        const isNonMergeTimeSlotControl = (target) => {
            if (!target || !target.closest) return false;
            return [
                '.timer-controls-container',
                '.timer-btn',
                '.time-slot-control',
                '[data-time-slot-control]',
                '[data-time-slot-merge-ignore="true"]',
                'button',
                'input',
                'select',
                'textarea',
                'a',
                '[role="button"]',
            ].some((selector) => Boolean(target.closest(selector)));
        };

        const getRange = () => {
            const mergeKey = this.findMergeKey ? this.findMergeKey('planned', index) : null;
            const bounds = mergeKey && this.getMergeRangeBounds
                ? this.getMergeRangeBounds(mergeKey, index)
                : null;
            const start = bounds ? bounds.start : index;
            const end = bounds ? bounds.end : index;
            return { start, end, mergeKey };
        };
        const resetTimeSlotMergeSelectionState = () => {
            resetPlannedSelectionDragState(this);
            this.pendingMergedMouseSelection = null;
            if (entryDiv && entryDiv.classList) {
                entryDiv.classList.remove('merge-hover');
            }
        };
        const updateTimeSlotMergeHoverState = (isHovering) => {
            if (!entryDiv || !entryDiv.classList) return;
            if (this.isSelectingPlanned) {
                entryDiv.classList.remove('merge-hover');
                return;
            }
            entryDiv.classList.toggle('merge-hover', Boolean(isHovering));
        };
        const updateTimeSlotMergeSelection = (event) => {
            if (this.currentColumnType !== 'planned' || !this.isSelectingPlanned) return;
            const point = event && event.touches ? event.touches[0] : event;
            if (!point) return;
            const hoverIndex = this.getIndexAtClientPosition('planned', point.clientX, point.clientY);
            if (!Number.isInteger(hoverIndex)) return;
            const baseStart = Number.isInteger(this.dragStartIndex) ? this.dragStartIndex : hoverIndex;
            const baseEnd = Number.isInteger(this.dragBaseEndIndex) && this.dragBaseEndIndex >= 0
                ? this.dragBaseEndIndex
                : baseStart;
            if (hoverIndex >= Math.min(baseStart, baseEnd) && hoverIndex <= Math.max(baseStart, baseEnd)) return;
            this.clearSelection('planned');
            this.selectFieldRange('planned', Math.min(baseStart, hoverIndex), Math.max(baseEnd, hoverIndex));
        };
        const beginTimeSlotMergeSelection = (event) => {
            if (event && isNonMergeTimeSlotControl(event.target)) {
                return false;
            }
            const range = getRange();
            this.closeInlinePlanDropdown();
            this.currentColumnType = 'planned';
            this.dragStartIndex = range.start;
            this.dragBaseEndIndex = range.end;
            this.isSelectingPlanned = true;
            if (range.mergeKey && typeof this.selectMergedRange === 'function') {
                this.clearAllSelections();
                this.selectMergedRange('planned', range.mergeKey, { append: false });
            } else {
                if (!event || (!event.ctrlKey && !event.metaKey)) {
                    this.clearSelection('planned');
                }
                this.selectFieldRange('planned', range.start, range.end);
            }
            return true;
        };
        const handleDocumentMouseMove = (event) => {
            if (typeof event.buttons === 'number' && event.buttons === 0) {
                handleDocumentMouseUp();
                return;
            }
            updateTimeSlotMergeSelection(event);
        };
        const handleDocumentMouseUp = () => {
            resetTimeSlotMergeSelectionState();
            if (doc && typeof doc.removeEventListener === 'function') {
                doc.removeEventListener('mousemove', handleDocumentMouseMove);
                doc.removeEventListener('mouseup', handleDocumentMouseUp);
            }
        };

        timeSlot.addEventListener('mouseenter', () => {
            updateTimeSlotMergeHoverState(true);
        });

        timeSlot.addEventListener('mouseleave', (event) => {
            const relatedTarget = event && event.relatedTarget ? event.relatedTarget : null;
            if (relatedTarget && relatedTarget.closest && relatedTarget.closest('.time-slot-container') === timeSlot) {
                return;
            }
            updateTimeSlotMergeHoverState(false);
        });

        timeSlot.addEventListener('focusin', () => {
            updateTimeSlotMergeHoverState(true);
        });

        timeSlot.addEventListener('focusout', (event) => {
            const relatedTarget = event && event.relatedTarget ? event.relatedTarget : null;
            if (relatedTarget && relatedTarget.closest && relatedTarget.closest('.time-slot-container') === timeSlot) {
                return;
            }
            updateTimeSlotMergeHoverState(false);
        });

        timeSlot.addEventListener('mousedown', (e) => {
            if (e.button !== undefined && e.button !== 0) return;
            if (!beginTimeSlotMergeSelection(e)) return;
            if (doc && typeof doc.addEventListener === 'function') {
                doc.addEventListener('mousemove', handleDocumentMouseMove);
                doc.addEventListener('mouseup', handleDocumentMouseUp);
            }
            e.preventDefault();
            e.stopPropagation();
        });

        let touchLongPressTimer = null;
        let touchLongPressActive = false;
        const clearTouchLongPress = () => {
            if (touchLongPressTimer) {
                clearTimeout(touchLongPressTimer);
                touchLongPressTimer = null;
            }
        };

        timeSlot.addEventListener('touchstart', (e) => {
            if (!e.touches || e.touches.length !== 1) return;
            if (isNonMergeTimeSlotControl(e.target)) {
                return;
            }
            touchLongPressActive = false;
            clearTouchLongPress();
            touchLongPressTimer = setTimeout(() => {
                touchLongPressActive = beginTimeSlotMergeSelection(e);
            }, 340);
        }, { passive: true });

        timeSlot.addEventListener('touchmove', (e) => {
            if (!touchLongPressActive) return;
            const t = e.touches && e.touches[0];
            if (!t) return;
            e.preventDefault();
            updateTimeSlotMergeSelection(e);
        }, { passive: false });

        timeSlot.addEventListener('touchend', (e) => {
            clearTouchLongPress();
            if (touchLongPressActive) {
                e.preventDefault();
                e.stopPropagation();
            }
            resetTimeSlotMergeSelectionState();
            touchLongPressActive = false;
        }, { passive: false });

        timeSlot.addEventListener('touchcancel', () => {
            clearTouchLongPress();
            touchLongPressActive = false;
            resetTimeSlotMergeSelectionState();
        }, { passive: true });
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
                if (isMobileInlinePlanSheetContext(this)) {
                    syncOpenInlinePlanSheetTarget(this, plannedField);
                    return;
                }
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
                    if (isMobileInlinePlanSheetContext(this)) {
                        syncOpenInlinePlanSheetTarget(this, plannedField);
                        return;
                    }
                    this.clearSelection('planned');
                    this.closeInlinePlanDropdown();
                    return;
                }

                openPlannedFieldDropdownWithViewportPreparation(this, range.startIndex, plannedField, range.endIndex);
            });
        }
    }

    return {
        getAnchorMinWidthFromElement,
        resetPlannedSelectionDragState,
        openPlannedFieldDropdownWithViewportPreparation,
        handleMergedClickCapture,
        attachPlannedFieldSelectionListeners,
        attachTimeSlotMergeEntryListeners,
        attachRowWideClickTargets,
        attachCellClickListeners,
    };
});
