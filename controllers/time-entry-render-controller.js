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
                wrapWithSplitVisualization: (type, rowIndex, content) => this.wrapWithSplitVisualization(type, rowIndex, content),
                createTimerControls: (rowIndex, rowSlot) => this.createTimerControls(rowIndex, rowSlot),
                createMergedTimeField: (mergeKey, rowIndex, rowSlot) => this.createMergedTimeField(mergeKey, rowIndex, rowSlot),
                formatSlotTimeLabel: (rawHour) => this.formatSlotTimeLabel(rawHour),
                escapeAttribute: (value) => this.escapeAttribute(value),
                getRoutineForPlannedIndex: (rowIndex, date) => this.getRoutineForPlannedIndex(rowIndex, date),
                isMobileTimeColumn: () => this.isMobileTimeExpansionEnabled && this.isMobileTimeExpansionEnabled(),
            });
        }

        const plannedMergeKey = this.findMergeKey('planned', index);
        let plannedContent = plannedMergeKey
            ? this.createMergedField(plannedMergeKey, 'planned', index, slot.planned)
            : `<input type="text" class="input-field planned-input"
                        data-index="${index}"
                        data-type="planned"
                        value="${this.escapeAttribute(slot.planned)}"
                        placeholder="계획을 입력하려면 클릭 또는 Enter" readonly tabindex="0" aria-label="계획 활동 입력" title="클릭해서 계획 선택/입력" style="cursor: pointer;">`;
        plannedContent = this.wrapWithSplitVisualization('planned', index, plannedContent);

        const timeMergeKey = this.findMergeKey('time', index);
        const isMobileTimeColumn = this.isMobileTimeExpansionEnabled && this.isMobileTimeExpansionEnabled();
        const timerControls = isMobileTimeColumn ? '' : this.createTimerControls(index, slot);
        let timeContent;
        if (timeMergeKey) {
            timeContent = this.createMergedTimeField(timeMergeKey, index, slot);
        } else {
            const mergeHintLabel = '드래그해 병합 범위 선택';
            timeContent = `<div class="time-slot-container merge-capable"
                    title="${mergeHintLabel}"
                    aria-label="${mergeHintLabel}">
                    <span class="time-slot-merge-affordance" aria-hidden="true"></span>
                    <div class="time-label time-slot-label">${this.formatSlotTimeLabel(slot.time)}</div>
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

        return {
            plannedMergeKey,
            actualMergeKey: null,
            routineMatch: this.getRoutineForPlannedIndex(index, this.currentDate),
            hasPlannedMergeContinuation: Boolean(plannedRange && index >= plannedRange.start && index < plannedRange.end),
            hasActualMergeContinuation: false,
            innerHtml: `
                ${timeContent}
                ${plannedContent}
            `,
        };
    }

function renderTimeEntries(preserveInlineDropdown = false) {
        if (!preserveInlineDropdown) {
            this.closeInlinePlanDropdown();
        }
        if (typeof this.validateSelectedPlanSegment === 'function') {
            this.validateSelectedPlanSegment();
        }
        this.lastRenderedCurrentTimeIndex = this.getCurrentTimeIndex();
        const isMobileTimeColumn = this.isMobileTimeExpansionEnabled && this.isMobileTimeExpansionEnabled();
        const container = document.getElementById('timeEntries');
        container.innerHTML = '';

        this.timeSlots.forEach((slot, index) => {
            const entryDiv = document.createElement('div');
            entryDiv.className = 'time-entry merge-capable';

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

            if (!isMobileTimeColumn) {
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
            }

            const plannedField = entryDiv.querySelector('.planned-input');

            if (plannedField) {
                this.attachFieldSelectionListeners(entryDiv, index);
                this.attachCellClickListeners(entryDiv, index);
            }
            if (typeof this.attachTimeSlotMergeEntryListeners === 'function') {
                this.attachTimeSlotMergeEntryListeners(entryDiv, index);
            }
            if (typeof this.attachVirtualRestGapListeners === 'function') {
                this.attachVirtualRestGapListeners(entryDiv, index);
            }
            if (typeof this.attachPlannedSlotMoveListeners === 'function') {
                this.attachPlannedSlotMoveListeners(entryDiv, index);
            }
            if (typeof this.attachPlanSegmentResizeListeners === 'function') {
                this.attachPlanSegmentResizeListeners(entryDiv, index);
            }
            if (typeof this.attachPlannedSegmentReorderListeners === 'function') {
                this.attachPlannedSegmentReorderListeners(entryDiv, index);
            }
            if (typeof this.attachPlanSegmentTitleEditListeners === 'function') {
                this.attachPlanSegmentTitleEditListeners(entryDiv, index);
            }
            if (typeof this.attachPlanSegmentSelectionListeners === 'function') {
                this.attachPlanSegmentSelectionListeners(entryDiv, index);
            }

            // 타이머 이벤트 리스너 추가
            this.attachTimerListeners(entryDiv, index);
            this.attachRowWideClickTargets(entryDiv, index);
            container.appendChild(entryDiv);
        });

        if (typeof this.syncTimeSlotMergeSelectionState === 'function') {
            this.syncTimeSlotMergeSelectionState('planned');
        }

        // 병합된 시간열 컨텐츠를 병합 블록의 세로 중앙으로 정렬
        this.centerMergedTimeContent(container);
        // 병합된 계획 입력의 시각적 높이를 병합 범위에 맞게 설정
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
        const renderTitleBand = showTitleBand && !(type === 'planned' && this.actualRecordingDisabled);
        const toggleable = isActual ? (context.toggleable !== undefined ? context.toggleable : true) : false;
        const showLabels = !isActual || Boolean(context.showLabels);
        const useConnections = !isActual || !toggleable;
        const hasGrid = Array.isArray(gridSegments) && gridSegments.length > 0;
        if (!hasGrid && !showTitleBand) return '';

        const classes = ['split-visualization', renderTitleBand ? 'has-title' : 'no-title'];
        classes.push(type === 'planned' ? 'split-visualization-planned' : 'split-visualization-actual');
        if (type === 'planned' && renderTitleBand && Array.isArray(titleSegments) && titleSegments.length === 1) {
            classes.push('split-visualization-single-title');
        }
        if (isActual) {
            classes.push(toggleable ? 'split-toggleable' : 'split-readonly');
        }

        const titleHtml = renderTitleBand
            ? `<div class="split-title-band">${(titleSegments || []).map((segment) => {
                const safeLabel = segment.label ? this.escapeHtml(segment.label) : '&nbsp;';
                const color = this.getSplitColor(type, segment.label, segment.isExtra, segment.reservedIndices, 'title');
                const emptyClass = segment.label ? '' : ' split-empty';
                return `<div class="split-title-segment${emptyClass}" style="grid-column: span ${segment.span}; --split-segment-color: ${color};">${safeLabel}</div>`;
            }).join('')}</div>`
            : '';

        const gridHtml = hasGrid
            ? `<div class="split-grid">${(() => {
                const labeledSegmentCount = gridSegments.reduce((count, segment) => count + (segment && segment.label ? 1 : 0), 0);
                const restKeyByRange = new Map();
                let virtualRestCount = 0;
                const getSegmentStartMinute = (item) => Number(item && item.startMinute) || 0;
                const getSegmentEndMinute = (item) => {
                    const explicitEnd = Number(item && item.endMinute);
                    if (Number.isFinite(explicitEnd)) return explicitEnd;
                    return getSegmentStartMinute(item) + (Number(item && item.durationMinutes) || 0);
                };
                return gridSegments.map((segment, idx) => {
                const color = this.getSplitColor(type, segment.label, segment.isExtra, segment.reservedIndices, 'grid');
                const emptyClass = segment.label ? '' : ' split-empty';
                const activeClass = (isActual && toggleable) ? (segment.active ? ' is-on' : ' is-off') : '';
                const lockedClass = (isActual && toggleable && segment.locked) ? ' is-locked' : '';
                const failedClass = (isActual && toggleable && segment.failed) ? ' is-failed' : '';
                const connTopClass = (useConnections && segment.connectTop) ? ' connect-top' : '';
                const connBotClass = (useConnections && segment.connectBottom) ? ' connect-bottom' : '';
                const isVirtualRest = Boolean(segment.virtual || segment.kind === 'virtual-rest');
                const virtualRestKey = isVirtualRest
                    ? `${Number(segment.startMinute) || 0}-${Number(segment.durationMinutes) || 0}`
                    : '';
                let virtualRestIndex = null;
                if (isVirtualRest) {
                    if (!restKeyByRange.has(virtualRestKey)) {
                        restKeyByRange.set(virtualRestKey, virtualRestCount);
                        virtualRestCount += 1;
                    }
                    virtualRestIndex = restKeyByRange.get(virtualRestKey);
                }
                const virtualRestClass = isVirtualRest ? ' split-grid-segment-virtual-rest' : '';
                const canRenderLabel = Boolean(segment.label)
                    && !segment.suppressHoverLabel
                    && (showLabels || Boolean(segment.alwaysVisibleLabel));
                const safeLabel = canRenderLabel ? this.escapeHtml(segment.label) : '';
                const safeTitleLabel = (!isActual && segment.titleLabel)
                    ? this.escapeHtml(segment.titleLabel)
                    : '';
                const labelClass = segment.alwaysVisibleLabel ? ' split-grid-label-persistent' : '';
                let labelHtml = safeLabel
                    ? `<span class="split-grid-label${labelClass}" title="${safeLabel}">${safeLabel}</span>`
                    : '';
                const planOnlyTimerClass = (!isActual && this.actualRecordingDisabled && segment.label && !isVirtualRest) ? ' has-plan-segment-timer' : '';
                let planSegmentId = '';
                let planSegmentIndex = Number.isFinite(segment.segmentIndex) ? Math.floor(segment.segmentIndex) : null;
                let isRunningPlanSegment = false;
                if (!isActual && this.actualRecordingDisabled && segment.label && !isVirtualRest) {
                    const baseIndex = this.getPlanSegmentBaseIndex ? this.getPlanSegmentBaseIndex(index) : index;
                    const visualSegmentIndex = planSegmentIndex != null ? planSegmentIndex : (labeledSegmentCount > 1 ? idx : null);
                    const timerSegmentIndex = Number.isFinite(segment.timerSegmentIndex)
                        ? Math.floor(segment.timerSegmentIndex)
                        : visualSegmentIndex;
                    const segmentId = this.getPlanSegmentId
                        ? this.getPlanSegmentId(baseIndex, timerSegmentIndex != null ? timerSegmentIndex : null)
                        : `planned-${baseIndex}-${timerSegmentIndex != null ? timerSegmentIndex : baseIndex}`;
                    planSegmentId = segmentId;
                    planSegmentIndex = visualSegmentIndex;
                    const timerSegmentContext = {
                        segmentIndex: timerSegmentIndex,
                        visualSegmentIndex,
                        startMinute: Number(segment.startMinute),
                        durationMinutes: Number(segment.durationMinutes),
                        endMinute: Number(segment.endMinute),
                        seconds: Number(segment.seconds),
                    };
                    const model = this.buildPlanSegmentViewModel
                        ? this.buildPlanSegmentViewModel(baseIndex, segmentId, timerSegmentContext)
                        : {
                            id: segmentId,
                            display: {
                                icon: this.getPlanSegmentTimerIcon ? this.getPlanSegmentTimerIcon(baseIndex, segmentId) : '▶',
                                timeText: this.getPlanSegmentTimerText ? this.getPlanSegmentTimerText(baseIndex, segmentId, timerSegmentContext) : '',
                                tone: this.getPlanSegmentTimeTone ? this.getPlanSegmentTimeTone(baseIndex, segmentId, timerSegmentContext) : 'under',
                            },
                        };
                    isRunningPlanSegment = Boolean(
                        (model && model.timer && (model.timer.running === true || model.timer.status === 'running'))
                        || (this.isPlanSegmentRunning && this.isPlanSegmentRunning(baseIndex, segmentId))
                    );
                    const escapedSegmentId = this.escapeAttribute(model.id);
                    const icon = model.display.icon;
                    const timerText = this.escapeHtml(model.display.timeText);
                    const tone = model.display.tone;
                    const isContinuationSegment = Boolean(segment.connectTop);
                    const buttonHtml = isContinuationSegment
                        ? ''
                        : `<button type="button"
                                   class="plan-segment-timer-button"
                                   data-index="${baseIndex}"
                                   data-segment-id="${escapedSegmentId}"
                                   aria-label="계획 세그먼트 타이머">${icon}</button>`;
                    const graphicMainClass = safeTitleLabel
                        ? 'plan-segment-graphic-main has-segment-title'
                        : 'plan-segment-graphic-main';
                    const graphicClass = isContinuationSegment
                        ? 'plan-segment-graphic is-plan-segment-continuation'
                        : 'plan-segment-graphic';
                    const timerTimeHtml = `<span class="plan-segment-timer-row">
                                               ${buttonHtml}
                                               <span class="plan-segment-timer-time tone-${tone}"
                                                     data-index="${baseIndex}"
                                                     data-segment-id="${escapedSegmentId}">${timerText}</span>
                                           </span>`;
                    labelHtml = `<div class="${graphicClass}"
                                      data-index="${baseIndex}"
                                      data-segment-id="${escapedSegmentId}">
                                    <div class="${graphicMainClass}">
                                        ${safeTitleLabel ? `<span class="plan-segment-graphic-title" title="${safeTitleLabel}" data-segment-title-edit-trigger="true">${safeTitleLabel}</span>` : ''}
                                        <span class="plan-segment-graphic-label" title="${safeLabel}">
                                            <span class="plan-segment-label-text" role="button" tabindex="0" data-title-edit-trigger="true" data-activity-edit-trigger="true">${safeLabel}</span>
                                        </span>
                                        ${timerTimeHtml}
                                    </div>
                                </div>`;
                }
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
                const virtualRestAttr = isVirtualRest
                    ? ` data-segment-kind="virtual-rest" data-reorder-item-type="virtual-rest" data-reorder-item-id="rest-${Number.isFinite(virtualRestIndex) ? virtualRestIndex : 0}" data-gap-start-minute="${Number(segment.startMinute) || 0}" data-gap-duration-minutes="${Number(segment.durationMinutes) || 0}" title="${this.escapeAttribute ? this.escapeAttribute(`빈 시간 ${Number(segment.durationMinutes) || 0}분`) : ''}"`
                    : '';
                const realPlanAttr = (!isActual && this.actualRecordingDisabled && segment.label && !isVirtualRest)
                    ? ` data-segment-kind="real-plan" data-reorder-item-type="real" data-reorder-item-id="real-${Number.isFinite(planSegmentIndex) ? planSegmentIndex : ''}" data-segment-id="${this.escapeAttribute ? this.escapeAttribute(planSegmentId) : planSegmentId}" data-segment-index="${Number.isFinite(planSegmentIndex) ? planSegmentIndex : ''}" data-segment-start-minute="${Number(segment.startMinute) || 0}" data-segment-duration-minutes="${Number(segment.durationMinutes) || 0}" data-segment-end-minute="${Number(segment.endMinute) || 0}"`
                    : '';
                const resizeDisabledClass = isRunningPlanSegment ? ' is-plan-segment-resize-disabled' : '';
                const resizeTitle = isRunningPlanSegment ? ' title="실행 중인 세그먼트는 조정할 수 없음"' : '';
                const selectedPlanSegment = this.selectedPlanSegment || null;
                const baseIndexForSelection = this.getPlanSegmentBaseIndex ? this.getPlanSegmentBaseIndex(index) : index;
                const selectedClass = (!isActual
                    && !isVirtualRest
                    && selectedPlanSegment
                    && Number(selectedPlanSegment.baseIndex) === Number(baseIndexForSelection)
                    && Number(selectedPlanSegment.segmentIndex) === Number(planSegmentIndex))
                    ? ' is-selected-plan-segment'
                    : '';
                const previousSegment = idx > 0 ? gridSegments[idx - 1] : null;
                const nextSegment = idx + 1 < gridSegments.length ? gridSegments[idx + 1] : null;
                const startMinute = getSegmentStartMinute(segment);
                const endMinute = getSegmentEndMinute(segment);
                const previousTouches = previousSegment && getSegmentEndMinute(previousSegment) === startMinute;
                const nextTouches = nextSegment && getSegmentStartMinute(nextSegment) === endMinute;
                const continuesAfterThisChunk = !isVirtualRest && Boolean(segment.connectBottom);
                const canResizeSegment = !isActual && this.actualRecordingDisabled && segment.label && (isVirtualRest || !isRunningPlanSegment);
                const canRenderRightHandle = canResizeSegment && !continuesAfterThisChunk && (!isVirtualRest || nextTouches);
                const sharedBoundaryOwnerClass = canRenderRightHandle && nextTouches ? ' has-shared-plan-boundary-handle' : '';
                const handleLine = '<span class="plan-segment-boundary-resize-handle-line" aria-hidden="true"></span>';
                const resizeHandles = canResizeSegment
                    ? `${canRenderRightHandle ? `<span class="plan-segment-resize-handle plan-segment-boundary-resize-handle plan-segment-resize-handle-right plan-segment-boundary-resize-handle-right${nextTouches ? ' plan-segment-boundary-resize-handle-shared' : ''}" data-resize-edge="right" aria-hidden="true">${handleLine}</span>` : ''}`
                    : '';
                const segmentLayer = gridSegments.length - idx + 2;
                return `<div class="split-grid-segment${emptyClass}${activeClass}${lockedClass}${failedClass}${runningClass}${runningTopClass}${runningRightClass}${runningBottomClass}${runningLeftClass}${connTopClass}${connBotClass}${virtualRestClass}${planOnlyTimerClass}${resizeDisabledClass}${selectedClass}${sharedBoundaryOwnerClass}"${unitAttr}${extraAttr}${virtualRestAttr}${realPlanAttr}${resizeTitle} style="grid-column: span ${segment.span}; --split-segment-color: ${color}; --split-segment-layer: ${segmentLayer};">${resizeHandles}${labelHtml}${failedIconHtml}</div>`;
                }).join('');
            })()}</div>`
            : '';

        return `<div class="${classes.join(' ')}">
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
