(function attachTimeEntryRenderController(root, factory) {
    const api = factory(root);

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        const existing = (root.TimeEntryRenderController && typeof root.TimeEntryRenderController === 'object')
            ? root.TimeEntryRenderController
            : {};
        root.TimeEntryRenderController = Object.assign(existing, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildTimeEntryRenderController(root) {

function buildTimeEntryRowModel(slot, index) {
        const renderer = (typeof globalThis !== 'undefined' && globalThis.TimeEntryRenderer)
            ? globalThis.TimeEntryRenderer
            : null;
        if (renderer && typeof renderer.buildRowRenderModel === 'function') {
            return renderer.buildRowRenderModel({
                slot,
                index,
                currentDate: this.currentDate,
                findMergeKey: (type, rowIndex) => this.findMergeKey(type, rowIndex),
                createMergedField: (mergeKey, type, rowIndex, value) => this.createMergedField(mergeKey, type, rowIndex, value),
                createTimerField: (rowIndex, rowSlot) => this.createTimerField(rowIndex, rowSlot),
                wrapWithSplitVisualization: (type, rowIndex, content) => this.wrapWithSplitVisualization(type, rowIndex, content),
                createTimerControls: (rowIndex, rowSlot) => this.createTimerControls(rowIndex, rowSlot),
                createMergedTimeField: (mergeKey, rowIndex, rowSlot) => this.createMergedTimeField(mergeKey, rowIndex, rowSlot),
                formatSlotTimeLabel: (rawHour) => this.formatSlotTimeLabel(rawHour),
                escapeAttribute: (value) => this.escapeAttribute(value),
                getRoutineForPlannedIndex: (rowIndex, date) => this.getRoutineForPlannedIndex(rowIndex, date),
            });
        }

        const plannedMergeKey = this.findMergeKey('planned', index);
        const actualMergeKey = this.findMergeKey('actual', index);

        let plannedContent = plannedMergeKey
            ? this.createMergedField(plannedMergeKey, 'planned', index, slot.planned)
            : `<input type="text" class="input-field planned-input"
                        data-index="${index}"
                        data-type="planned"
                        value="${this.escapeAttribute(slot.planned)}"
                        placeholder="계획을 입력하려면 클릭 또는 Enter" readonly tabindex="0" aria-label="계획 활동 입력" title="클릭해서 계획 선택/입력" style="cursor: pointer;">`;
        plannedContent = this.wrapWithSplitVisualization('planned', index, plannedContent);

        let actualContent = actualMergeKey
            ? this.createMergedField(actualMergeKey, 'actual', index, slot.actual)
            : this.createActualSlotField(index, slot);
        actualContent = this.wrapWithSplitVisualization('actual', index, actualContent);

        const timeMergeKey = this.findMergeKey('time', index);
        const timerControls = this.createTimerControls(index, slot);
        let timeContent;
        if (timeMergeKey) {
            timeContent = this.createMergedTimeField(timeMergeKey, index, slot);
        } else {
            timeContent = `<div class="time-slot-container">
                    <div class="time-label">${this.formatSlotTimeLabel(slot.time)}</div>
                    ${timerControls}
                </div>`;
        }

        const parseMergeRange = (mergeKey) => {
            if (!mergeKey || typeof mergeKey !== 'string') return null;
            const parts = mergeKey.split('-');
            if (parts.length !== 3) return null;
            const start = parseInt(parts[1], 10);
            const end = parseInt(parts[2], 10);
            if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
            return { start, end };
        };

        const plannedRange = parseMergeRange(plannedMergeKey);
        const actualRange = parseMergeRange(actualMergeKey);

        return {
            plannedMergeKey,
            actualMergeKey,
            routineMatch: this.getRoutineForPlannedIndex(index, this.currentDate),
            hasPlannedMergeContinuation: Boolean(plannedRange && index >= plannedRange.start && index < plannedRange.end),
            hasActualMergeContinuation: Boolean(actualRange && index >= actualRange.start && index < actualRange.end),
            innerHtml: `
                ${plannedContent}
                ${timeContent}
                ${actualContent}
            `,
        };
    }

function renderTimeEntries(preserveInlineDropdown = false) {
        if (!preserveInlineDropdown) {
            this.closeInlinePlanDropdown();
        }
        this.lastRenderedCurrentTimeIndex = this.getCurrentTimeIndex();
        const container = document.getElementById('timeEntries');
        container.innerHTML = '';

        this.timeSlots.forEach((slot, index) => {
            const entryDiv = document.createElement('div');
            entryDiv.className = 'time-entry';

            const rowModel = this.buildTimeEntryRowModel(slot, index);
            entryDiv.innerHTML = rowModel.innerHtml;
            entryDiv.dataset.index = index;
            const routineMatch = rowModel.routineMatch;
            if (routineMatch) {
                entryDiv.classList.add('routine-planned');
                entryDiv.dataset.routineId = routineMatch.id;
            }

            if (rowModel.hasPlannedMergeContinuation) {
                entryDiv.classList.add('has-planned-merge');
            }

            if (rowModel.hasActualMergeContinuation) {
                entryDiv.classList.add('has-actual-merge');
            }

            const timeUiState = this.getMobileTimeUiState(index, slot);
            if (timeUiState.hostIndex === index) {
                entryDiv.classList.add(`time-ui-${timeUiState.mode}`);
                if (timeUiState.showControls) {
                    entryDiv.classList.add('time-ui-visible');
                }
                if (timeUiState.isCurrent) {
                    entryDiv.classList.add('current-time-slot');
                }
                if (timeUiState.status === 'running') {
                    entryDiv.classList.add('running-timer-slot');
                } else if (timeUiState.status === 'paused') {
                    entryDiv.classList.add('paused-timer-slot');
                } else if (timeUiState.status === 'completed') {
                    entryDiv.classList.add('completed-timer-slot');
                }
            }

            const plannedField = entryDiv.querySelector('.planned-input');
            const actualField = entryDiv.querySelector('.actual-input');

            if (plannedField || actualField) {
                this.attachFieldSelectionListeners(entryDiv, index);
                this.attachCellClickListeners(entryDiv, index);
            }

            // 타이머 이벤트 리스너 추가
            this.attachTimerListeners(entryDiv, index);
            this.attachActivityLogListener(entryDiv, index);

            this.attachRowWideClickTargets(entryDiv, index);
            container.appendChild(entryDiv);
        });

        // 병합된 시간열 컨텐츠를 병합 블록의 세로 중앙으로 정렬
        this.centerMergedTimeContent(container);
        // 병합된 실제/계획 입력의 시각적 높이를 병합 범위에 맞게 설정
        this.resizeMergedActualContent(container);
        this.resizeMergedPlannedContent(container);
    }

function wrapWithSplitVisualization(type, index, content) {
        const splitMarkup = this.buildSplitVisualization(type, index);
        if (!splitMarkup) return content;
        const typeClass = type === 'planned' ? 'split-type-planned' : 'split-type-actual';
        return `<div class="split-cell-wrapper ${typeClass} split-has-data" data-split-type="${type}" data-index="${index}">
                    ${content}
                    ${splitMarkup}
                </div>`;
    }

function buildSplitVisualization(type, index) {
        const context = this.computeSplitSegments(type, index);
        if (!context) return '';
        const { gridSegments, titleSegments, showTitleBand } = context;
        const isActual = type === 'actual';
        const toggleable = isActual ? (context.toggleable !== undefined ? context.toggleable : true) : false;
        const showLabels = !isActual || Boolean(context.showLabels);
        const useConnections = !isActual || !toggleable;
        const hasGrid = Array.isArray(gridSegments) && gridSegments.length > 0;
        if (!hasGrid && !showTitleBand) return '';

        const classes = ['split-visualization', showTitleBand ? 'has-title' : 'no-title'];
        classes.push(type === 'planned' ? 'split-visualization-planned' : 'split-visualization-actual');
        if (type === 'planned' && showTitleBand && Array.isArray(titleSegments) && titleSegments.length === 1) {
            classes.push('split-visualization-single-title');
        }
        if (isActual) {
            classes.push(toggleable ? 'split-toggleable' : 'split-readonly');
        }

        const titleHtml = showTitleBand
            ? `<div class="split-title-band">${(titleSegments || []).map((segment) => {
                const safeLabel = segment.label ? this.escapeHtml(segment.label) : '&nbsp;';
                const color = this.getSplitColor(type, segment.label, segment.isExtra, segment.reservedIndices, 'title');
                const emptyClass = segment.label ? '' : ' split-empty';
                return `<div class="split-title-segment${emptyClass}" style="grid-column: span ${segment.span}; --split-segment-color: ${color};">${safeLabel}</div>`;
            }).join('')}</div>`
            : '';

        const gridHtml = hasGrid
            ? `<div class="split-grid">${gridSegments.map((segment, idx) => {
                const color = this.getSplitColor(type, segment.label, segment.isExtra, segment.reservedIndices, 'grid');
                const emptyClass = segment.label ? '' : ' split-empty';
                const activeClass = (isActual && toggleable) ? (segment.active ? ' is-on' : ' is-off') : '';
                const lockedClass = (isActual && toggleable && segment.locked) ? ' is-locked' : '';
                const failedClass = (isActual && toggleable && segment.failed) ? ' is-failed' : '';
                const connTopClass = (useConnections && segment.connectTop) ? ' connect-top' : '';
                const connBotClass = (useConnections && segment.connectBottom) ? ' connect-bottom' : '';
                const canRenderLabel = Boolean(segment.label)
                    && !segment.suppressHoverLabel
                    && (showLabels || Boolean(segment.alwaysVisibleLabel));
                const safeLabel = canRenderLabel ? this.escapeHtml(segment.label) : '';
                const labelClass = segment.alwaysVisibleLabel ? ' split-grid-label-persistent' : '';
                const labelHtml = safeLabel
                    ? `<span class="split-grid-label${labelClass}" title="${safeLabel}">${safeLabel}</span>`
                    : '';
                const failedIconHtml = failedClass
                    ? '<span class="split-grid-failed-mark" aria-hidden="true">X</span>'
                    : '';
                const runningClass = (isActual && segment.runningOutline) ? ' is-running-outline' : '';
                const runningTopClass = (isActual && segment.runningEdgeTop) ? ' running-edge-top' : '';
                const runningRightClass = (isActual && segment.runningEdgeRight) ? ' running-edge-right' : '';
                const runningBottomClass = (isActual && segment.runningEdgeBottom) ? ' running-edge-bottom' : '';
                const runningLeftClass = (isActual && segment.runningEdgeLeft) ? ' running-edge-left' : '';
                const unitAttr = (isActual && toggleable && Number.isFinite(segment.unitIndex))
                    ? ` data-unit-index="${segment.unitIndex}"`
                    : '';
                const extraSafe = (isActual && segment.extraLabel) ? this.escapeHtml(segment.extraLabel) : '';
                const extraAttr = extraSafe ? ` data-extra-label="${extraSafe}"` : '';
                return `<div class="split-grid-segment${emptyClass}${activeClass}${lockedClass}${failedClass}${runningClass}${runningTopClass}${runningRightClass}${runningBottomClass}${runningLeftClass}${connTopClass}${connBotClass}"${unitAttr}${extraAttr} style="grid-column: span ${segment.span}; --split-segment-color: ${color};">${labelHtml}${failedIconHtml}</div>`;
            }).join('')}</div>`
            : '';

        return `<div class="${classes.join(' ')}" aria-hidden="true">
                    ${titleHtml}
                    ${gridHtml}
                </div>`;
    }
    return Object.freeze({
        buildTimeEntryRowModel,
        renderTimeEntries,
        wrapWithSplitVisualization,
        buildSplitVisualization
    });
});
