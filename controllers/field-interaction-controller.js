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

    function closeSameInlinePlanTarget(ctx) {
        if (!ctx) return;
        if (typeof ctx.clearSelection === 'function') {
            ctx.clearSelection('planned');
        }
        if (typeof ctx.closeInlinePlanDropdown === 'function') {
            ctx.closeInlinePlanDropdown();
        }
    }

    function isPlannedRangeSelected(ctx, start, end) {
        const selectedSet = ctx && ctx.selectedPlannedFields;
        if (!selectedSet || !Number.isInteger(start) || !Number.isInteger(end)) return false;
        const safeStart = Math.min(start, end);
        const safeEnd = Math.max(start, end);
        if (selectedSet.size !== safeEnd - safeStart + 1) return false;
        for (let i = safeStart; i <= safeEnd; i += 1) {
            if (!selectedSet.has(i)) return false;
        }
        return true;
    }

    function isPlainPrimaryPointerEvent(event) {
        if (!event) return true;
        return !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
    }

    function resolvePlannedInputFromEvent(event) {
        const target = event && event.target;
        if (target && target.matches && target.matches('.planned-input')) {
            return target;
        }
        if (target && target.closest) {
            const plannedInput = target.closest('.planned-input');
            if (plannedInput) return plannedInput;
        }
        const doc = target && target.ownerDocument
            ? target.ownerDocument
            : (typeof document !== 'undefined' ? document : null);
        const activeEl = doc && doc.activeElement;
        return activeEl && activeEl.matches && activeEl.matches('.planned-input')
            ? activeEl
            : null;
    }

    function suppressPlannedInputFocusRing(plannedInput) {
        if (!plannedInput) return;
        if (plannedInput.classList && typeof plannedInput.classList.add === 'function') {
            plannedInput.classList.add('planned-input-suppress-focus-ring');
        }
        const blur = () => {
            if (typeof plannedInput.blur === 'function') {
                plannedInput.blur();
            }
        };
        blur();
        const rootWindow = typeof window !== 'undefined' ? window : root;
        if (rootWindow && typeof rootWindow.setTimeout === 'function') {
            rootWindow.setTimeout(() => {
                blur();
                if (plannedInput.classList && typeof plannedInput.classList.remove === 'function') {
                    plannedInput.classList.remove('planned-input-suppress-focus-ring');
                }
            }, 80);
        } else if (plannedInput.classList && typeof plannedInput.classList.remove === 'function') {
            plannedInput.classList.remove('planned-input-suppress-focus-ring');
        }
        if (rootWindow && typeof rootWindow.requestAnimationFrame === 'function') {
            rootWindow.requestAnimationFrame(blur);
        }
    }

    function clearSelectedPlannedRangeFromEvent(ctx, event, suppressClickIndex = null) {
        if (!ctx) return;
        if (typeof ctx.clearSelection === 'function') {
            ctx.clearSelection('planned');
        }
        resetPlannedSelectionDragState(ctx);
        if (Number.isInteger(suppressClickIndex)) {
            ctx.suppressInlinePlanClickOnce = suppressClickIndex;
        }
        suppressPlannedInputFocusRing(resolvePlannedInputFromEvent(event));
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
        if (event && typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
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
        if (this && typeof this.isPlannedSlotMoveMode === 'function' && this.isPlannedSlotMoveMode()) {
            if (target && target.closest && target.closest('.planned-input, .time-entry, .time-slot-container, .split-cell-wrapper.split-type-planned')) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
        }
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
                        closeSameInlinePlanTarget(this);
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
                                    closeSameInlinePlanTarget(this);
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
            if (this.isPlannedSlotMoveMode && this.isPlannedSlotMoveMode()) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            const mouseRange = this.getPlannedRangeInfo(index);
            const sameInlineTarget = this.inlinePlanDropdown && this.isSameInlinePlanTarget(mouseRange);
            const rangeStart = Number.isInteger(mouseRange && mouseRange.startIndex) ? mouseRange.startIndex : index;
            const rangeEnd = Number.isInteger(mouseRange && mouseRange.endIndex) ? mouseRange.endIndex : rangeStart;
            if (isPlainPrimaryPointerEvent(e) && isPlannedRangeSelected(this, rangeStart, rangeEnd)) {
                if (sameInlineTarget && typeof this.closeInlinePlanDropdown === 'function') {
                    this.closeInlinePlanDropdown();
                }
                clearSelectedPlannedRangeFromEvent(this, e, index);
                return;
            }
            if (sameInlineTarget && isMobileInlinePlanSheetContext(this)) {
                this.suppressInlinePlanClickOnce = index;
                if (e.preventDefault) e.preventDefault();
                if (e.stopPropagation) e.stopPropagation();
                closeSameInlinePlanTarget(this);
                return;
            }
            if (sameInlineTarget) {
                this.suppressInlinePlanClickOnce = index;
                this.clearSelection('planned');
            }
            this.closeInlinePlanDropdown();
        });

        plannedField.addEventListener('mouseenter', (e) => {
            if (this.isPlannedSlotMoveMode && this.isPlannedSlotMoveMode()) return;
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
            if (this.isPlannedSlotMoveMode && this.isPlannedSlotMoveMode()) {
                return false;
            }
            if (event && isNonMergeTimeSlotControl(event.target)) {
                return false;
            }
            const range = getRange();
            this.closeInlinePlanDropdown();
            if (isPlainPrimaryPointerEvent(event) && isPlannedRangeSelected(this, range.start, range.end)) {
                clearSelectedPlannedRangeFromEvent(this, event);
                return 'cleared';
            }
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
            const result = beginTimeSlotMergeSelection(e);
            if (!result) return;
            if (result === 'cleared') return;
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
            if (this.isPlannedSlotMoveMode && this.isPlannedSlotMoveMode()) return;
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
                if (this.isPlannedSlotMoveMode && this.isPlannedSlotMoveMode()) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                const range = this.getPlannedRangeInfo(index);
                const rangeStart = Number.isInteger(range && range.startIndex) ? range.startIndex : index;
                const rangeEnd = Number.isInteger(range && range.endIndex) ? range.endIndex : rangeStart;
                const sameInlineTarget = this.inlinePlanDropdown && this.isSameInlinePlanTarget(range);
                if (isPlainPrimaryPointerEvent(e) && isPlannedRangeSelected(this, rangeStart, rangeEnd)) {
                    if (sameInlineTarget && typeof this.closeInlinePlanDropdown === 'function') {
                        this.closeInlinePlanDropdown();
                    }
                    clearSelectedPlannedRangeFromEvent(this, e, index);
                    return;
                }
                if (!sameInlineTarget) return;

                e.preventDefault();
                e.stopPropagation();
                this.suppressInlinePlanClickOnce = index;
                closeSameInlinePlanTarget(this);
            });
            plannedField.addEventListener('click', (e) => {
                if (this.isPlannedSlotMoveMode && this.isPlannedSlotMoveMode()) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                if (this.suppressInlinePlanClickOnce === index) {
                    this.suppressInlinePlanClickOnce = null;
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                e.preventDefault();
                e.stopPropagation();

                const range = this.getPlannedRangeInfo(index);
                const rangeStart = Number.isInteger(range && range.startIndex) ? range.startIndex : index;
                const rangeEnd = Number.isInteger(range && range.endIndex) ? range.endIndex : rangeStart;
                if (isPlainPrimaryPointerEvent(e) && isPlannedRangeSelected(this, rangeStart, rangeEnd)) {
                    if (this.inlinePlanDropdown && this.isSameInlinePlanTarget(range) && typeof this.closeInlinePlanDropdown === 'function') {
                        this.closeInlinePlanDropdown();
                    }
                    clearSelectedPlannedRangeFromEvent(this, e);
                    return;
                }
                if (this.inlinePlanDropdown && this.isSameInlinePlanTarget(range)) {
                    closeSameInlinePlanTarget(this);
                    return;
                }

                openPlannedFieldDropdownWithViewportPreparation(this, range.startIndex, plannedField, range.endIndex);
            });
        }
    }

    return {
        getAnchorMinWidthFromElement,
        resetPlannedSelectionDragState,
        closeSameInlinePlanTarget,
        openPlannedFieldDropdownWithViewportPreparation,
        handleMergedClickCapture,
        attachPlannedFieldSelectionListeners,
        attachTimeSlotMergeEntryListeners,
        attachRowWideClickTargets,
        attachCellClickListeners,
    };
});
