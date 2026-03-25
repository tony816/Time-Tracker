(function attachTimeTrackerSelectionOverlayController(root, factory) {
    const api = factory(root);

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        const existing = (root.TimeTrackerSelectionOverlayController && typeof root.TimeTrackerSelectionOverlayController === 'object')
            ? root.TimeTrackerSelectionOverlayController
            : {};
        root.TimeTrackerSelectionOverlayController = Object.assign(existing, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildTimeTrackerSelectionOverlayController(root) {
    function getControllerStateAccess() {
        return (root && root.TimeTrackerControllerStateAccess && typeof root.TimeTrackerControllerStateAccess === 'object')
            ? root.TimeTrackerControllerStateAccess
            : null;
    }

    function getSelectionSetForType(type) {
        const access = getControllerStateAccess();
        if (access && typeof access.getSelectionSet === 'function') {
            return access.getSelectionSet.call(this, type);
        }
        return type === 'planned' ? this.selectedPlannedFields : this.selectedActualFields;
    }

    function getSelectionOverlayElement(type) {
        const access = getControllerStateAccess();
        if (access && typeof access.getSelectionOverlay === 'function') {
            return access.getSelectionOverlay.call(this, type);
        }
        return this.selectionOverlay ? this.selectionOverlay[type] : null;
    }

    function setSelectionOverlayElement(type, overlay) {
        const access = getControllerStateAccess();
        if (access && typeof access.setSelectionOverlay === 'function') {
            return access.setSelectionOverlay.call(this, type, overlay);
        }
        if (!this.selectionOverlay || typeof this.selectionOverlay !== 'object') {
            this.selectionOverlay = { planned: null, actual: null };
        }
        this.selectionOverlay[type] = overlay || null;
        return this.selectionOverlay[type];
    }

    function getHoverSelectionOverlayElement(type) {
        const access = getControllerStateAccess();
        if (access && typeof access.getHoverSelectionOverlay === 'function') {
            return access.getHoverSelectionOverlay.call(this, type);
        }
        return this.hoverSelectionOverlay ? this.hoverSelectionOverlay[type] : null;
    }

    function setHoverSelectionOverlayElement(type, overlay) {
        const access = getControllerStateAccess();
        if (access && typeof access.setHoverSelectionOverlay === 'function') {
            return access.setHoverSelectionOverlay.call(this, type, overlay);
        }
        if (!this.hoverSelectionOverlay || typeof this.hoverSelectionOverlay !== 'object') {
            this.hoverSelectionOverlay = { planned: null, actual: null };
        }
        this.hoverSelectionOverlay[type] = overlay || null;
        return this.hoverSelectionOverlay[type];
    }

    function getScheduleAnchorElement() {
        const access = getControllerStateAccess();
        if (access && typeof access.getScheduleAnchor === 'function') {
            return access.getScheduleAnchor.call(this);
        }
        return this.scheduleButton || this.scheduleHoverButton || null;
    }

    function selectFieldRange(type, startIndex, endIndex) {
        if (type !== 'planned') return; // 우측 열 멀티 선택 금지
        this.clearSelection(type);

        let start = Math.min(startIndex, endIndex);
        let end = Math.max(startIndex, endIndex);

        if (Number.isInteger(start) && Number.isInteger(end)) {
            const startInfo = this.getPlannedRangeInfo
                ? this.getPlannedRangeInfo(start)
                : { startIndex: start, endIndex: start };
            const endInfo = this.getPlannedRangeInfo
                ? this.getPlannedRangeInfo(end)
                : { startIndex: end, endIndex: end };

            if (startInfo) {
                if (Number.isInteger(startInfo.startIndex)) start = Math.min(start, startInfo.startIndex);
                if (Number.isInteger(startInfo.endIndex)) end = Math.max(end, startInfo.endIndex);
            }
            if (endInfo) {
                if (Number.isInteger(endInfo.startIndex)) start = Math.min(start, endInfo.startIndex);
                if (Number.isInteger(endInfo.endIndex)) end = Math.max(end, endInfo.endIndex);
            }
        }

        const maxIndex = Array.isArray(this.timeSlots) ? this.timeSlots.length - 1 : end;
        if (!Number.isFinite(maxIndex) || maxIndex < 0) return;
        start = Math.max(0, start);
        end = Math.min(maxIndex, end);
        if (start > end) return;

        const selectedSet = getSelectionSetForType.call(this, type);
        for (let i = start; i <= end; i++) {
            selectedSet.add(i);
            // 필드 클래스 하이라이트는 사용하지 않음 (투명 오버레이만)
        }

        this.updateSelectionOverlay(type);

        const plannedSelection = getSelectionSetForType.call(this, 'planned');
        if (plannedSelection.size > 1) {
            this.showMergeButton('planned');
        }
        this.showScheduleButtonForSelection(type);
    }

    function clearSelection(type) {
        const selectedSet = getSelectionSetForType.call(this, type);
        selectedSet.forEach(index => {
            const field = document.querySelector(`[data-index="${index}"] .${type}-input`);
            if (field) {
                field.classList.remove('field-selected');
                const row = field.closest('.time-entry');
                if (row) {
                    row.classList.remove('selected-merged-planned', 'selected-merged-actual');
                }
            }
        });
        selectedSet.clear();

        this.hideMergeButton();
        this.hideUndoButton();
        this.removeSelectionOverlay(type);
        this.hideScheduleButton();
    }

    function clearAllSelections() {
        this.clearSelection('planned');
        this.clearSelection('actual');
    }

    function showMergeButton(type) {
        if (type !== 'planned') return; // 우측 열 병합 버튼 금지
        const selectedSet = type === 'planned' ? this.selectedPlannedFields : this.selectedActualFields;

        if (selectedSet.size > 1) {
            const selectedIndices = Array.from(selectedSet).sort((a, b) => a - b);
            const startIndex = selectedIndices[0];
            const endIndex = selectedIndices[selectedIndices.length - 1];

            const startField = document.querySelector(`[data-index="${startIndex}"] .${type}-input`);
            const endField = document.querySelector(`[data-index="${endIndex}"] .${type}-input`);

            if (startField && endField) {
                const startRect = startField.getBoundingClientRect();
                const endRect = endField.getBoundingClientRect();

                let centerX, centerY;

                const selectedCount = selectedIndices.length;

                if (selectedCount % 2 === 1) {
                    const middleIndex = selectedIndices[Math.floor(selectedCount / 2)];
                    const middleField = document.querySelector(`[data-index="${middleIndex}"] .${type}-input`);
                    const middleRect = middleField.getBoundingClientRect();
                    centerX = middleRect.left + (middleRect.width / 2);
                    centerY = middleRect.top + (middleRect.height / 2);
                } else {
                    const midIndex1 = Math.floor(selectedCount / 2) - 1;
                    const midIndex2 = Math.floor(selectedCount / 2);
                    const field1 = document.querySelector(`[data-index="${selectedIndices[midIndex1]}"] .${type}-input`);
                    const field2 = document.querySelector(`[data-index="${selectedIndices[midIndex2]}"] .${type}-input`);
                    const rect1 = field1.getBoundingClientRect();
                    const rect2 = field2.getBoundingClientRect();

                    centerX = (rect1.left + rect1.width / 2 + rect2.left + rect2.width / 2) / 2;
                    centerY = (rect1.bottom + rect2.top) / 2;
                }

                this.hideMergeButton();

                const scrollX = window.scrollX || document.documentElement.scrollLeft || 0;
                const scrollY = window.scrollY || document.documentElement.scrollTop || 0;

                this.mergeButton = document.createElement('button');
                this.mergeButton.className = 'merge-button';
                this.mergeButton.textContent = '병합';
                // 기본 배치(선택 중앙) 후, 스케줄 버튼이 있으면 우측으로 재배치
                this.mergeButton.style.left = `${centerX + scrollX - 25}px`;
                this.mergeButton.style.top = `${centerY + scrollY - 15}px`;

                this.mergeButton.addEventListener('click', () => {
                    this.mergeSelectedFields(type);
                });

                document.body.appendChild(this.mergeButton);
                // 병합 버튼과 스케줄 버튼은 동시 표기하지 않음
                this.hideScheduleButton();
                this.repositionButtonsNextToSchedule();
            }
        }
    }

    function hideMergeButton() {
        if (this.mergeButton && this.mergeButton.parentNode) {
            this.mergeButton.parentNode.removeChild(this.mergeButton);
            this.mergeButton = null;
        }
    }

    function showUndoButton(type, mergeKey) {
        // 우측(실제) 열은 병합 해제 기능 제거
        if (type !== 'planned') return;
        const [, startStr, endStr] = mergeKey.split('-');
        const start = parseInt(startStr);
        const end = parseInt(endStr);

        const startField = document.querySelector(`[data-index="${start}"] .${type}-input`);
        const endField = document.querySelector(`[data-index="${end}"] .${type}-input`);

        if (startField && endField) {
            const startRect = startField.getBoundingClientRect();
            const endRect = endField.getBoundingClientRect();

            this.hideUndoButton();

            const scrollX = window.scrollX || document.documentElement.scrollLeft || 0;
            const scrollY = window.scrollY || document.documentElement.scrollTop || 0;

            const anchor = getScheduleAnchorElement.call(this);
            let defaultLeft, defaultTop;
            if (anchor) {
                const sbRect = anchor.getBoundingClientRect();
                defaultLeft = window.scrollX + sbRect.left + sbRect.width + 8;
                defaultTop = window.scrollY + sbRect.top;
            } else {
                const centerX = startRect.left + (startRect.width / 2);
                const centerY = startRect.top + ((endRect.bottom - startRect.top) / 2);
                defaultLeft = centerX + scrollX - 17;
                defaultTop = centerY + scrollY - 17;
            }

            this.undoButton = document.createElement('button');
            this.undoButton.className = 'undo-button';
            // 기본 배치: 스케줄 버튼이 있으면 바로 우측, 없으면 중앙
            this.undoButton.style.left = `${Math.round(defaultLeft)}px`;
            this.undoButton.style.top = `${Math.round(defaultTop)}px`;

            this.undoButton.addEventListener('click', () => {
                this.undoMerge(type, mergeKey);
            });

            document.body.appendChild(this.undoButton);
            this.repositionButtonsNextToSchedule();
        }
    }

    function hideUndoButton() {
        if (this.undoButton && this.undoButton.parentNode) {
            this.undoButton.parentNode.removeChild(this.undoButton);
            this.undoButton = null;
        }
    }

    function undoMerge(type, mergeKey) {
        // 우측(실제) 열은 병합 해제 불가
        if (type !== 'planned') {
            this.hideUndoButton();
            this.clearSelection(type);
            return;
        }
        const [, startStr, endStr] = mergeKey.split('-');
        const start = parseInt(startStr);
        const end = parseInt(endStr);
        const slotCount = Math.max(1, (end - start + 1));

        const timeRangeKey = `time-${start}-${end}`;
        const actualMergeKey = `actual-${start}-${end}`;
        const baseSlot = this.timeSlots[start] || {};

        const mergedPlannedText = String(this.mergedFields.get(mergeKey) ?? baseSlot.planned ?? '').trim();
        const mergedActualText = String(this.mergedFields.get(actualMergeKey) ?? baseSlot.actual ?? '').trim();
        const mergedPlanTitle = String(baseSlot.planTitle || '').trim();

        const sourcePlanActivities = this.normalizePlanActivitiesArray(baseSlot.planActivities);
        const sourceActualActivities = this.normalizeActivitiesArray(baseSlot.activityLog && baseSlot.activityLog.subActivities);

        const splitSecondsEvenly = (totalSeconds, count) => {
            const safeTotal = Math.max(0, Math.floor(Number(totalSeconds) || 0));
            const n = Math.max(1, Math.floor(Number(count) || 1));
            const base = Math.floor(safeTotal / n);
            let rem = safeTotal - (base * n);
            const out = new Array(n).fill(base);
            for (let i = 0; i < n && rem > 0; i += 1, rem -= 1) out[i] += 1;
            return out;
        };

        const splitActivitiesBySlots = (items, count, isActual = false) => {
            const normalized = Array.isArray(items) ? items : [];
            const perSlot = Array.from({ length: count }, () => []);
            normalized.forEach((item) => {
                if (!item) return;
                const totalSec = Math.max(0, Math.floor(Number(item.seconds) || 0));
                if (totalSec <= 0) return;
                const secChunks = splitSecondsEvenly(totalSec, count);

                let recChunks = null;
                if (isActual) {
                    const rec = Number.isFinite(item.recordedSeconds)
                        ? Math.max(0, Math.floor(Number(item.recordedSeconds)))
                        : totalSec;
                    recChunks = splitSecondsEvenly(rec, count);
                }

                for (let idx = 0; idx < count; idx++) {
                    const sec = secChunks[idx] || 0;
                    if (sec <= 0) continue;
                    const next = { ...item, seconds: sec };
                    if (isActual) {
                        next.recordedSeconds = recChunks ? (recChunks[idx] || sec) : sec;
                    }
                    perSlot[idx].push(next);
                }
            });
            return perSlot;
        };

        const summarizeLabel = (items, fallbackText) => {
            const arr = Array.isArray(items) ? items : [];
            if (arr.length <= 0) return String(fallbackText || '').trim();
            const labels = arr
                .map((it) => String(it && it.label ? it.label : '').trim())
                .filter(Boolean);
            if (labels.length <= 0) return String(fallbackText || '').trim();
            if (labels.length === 1) return labels[0];
            return `${labels[0]} 외 ${labels.length - 1}`;
        };

        const splitBooleanUnits = (units, count) => {
            const src = Array.isArray(units) ? units.map(v => Boolean(v)) : [];
            const n = Math.max(1, Math.floor(Number(count) || 1));
            const lengths = splitSecondsEvenly(src.length, n);
            const out = [];
            let offset = 0;
            for (let i = 0; i < n; i++) {
                const len = lengths[i] || 0;
                out.push(src.slice(offset, offset + len));
                offset += len;
            }
            return out;
        };

        const planBySlot = splitActivitiesBySlots(sourcePlanActivities, slotCount, false);
        const actualBySlot = splitActivitiesBySlots(sourceActualActivities, slotCount, true);
        const baseLog = (baseSlot && baseSlot.activityLog && typeof baseSlot.activityLog === 'object')
            ? baseSlot.activityLog
            : {};
        const actualUnitsBySlot = splitBooleanUnits(baseLog.actualGridUnits, slotCount);
        const extraUnitsBySlot = splitBooleanUnits(baseLog.actualExtraGridUnits, slotCount);
        const failedUnitsBySlot = splitBooleanUnits(baseLog.actualFailedGridUnits, slotCount);

        // 병합 키 제거
        this.mergedFields.delete(mergeKey);
        this.mergedFields.delete(timeRangeKey);
        this.mergedFields.delete(actualMergeKey);

        for (let i = start; i <= end; i++) {
            const rel = i - start;
            const slot = this.timeSlots[i];
            if (!slot) continue;

            if (!slot.activityLog || typeof slot.activityLog !== 'object') {
                slot.activityLog = { title: '', details: '', subActivities: [], titleBandOn: false, actualGridUnits: [], actualExtraGridUnits: [], actualFailedGridUnits: [], actualOverride: false };
            }

            const slotPlanActivities = Array.isArray(planBySlot[rel]) ? planBySlot[rel] : [];
            const slotActualActivities = Array.isArray(actualBySlot[rel]) ? actualBySlot[rel] : [];

            slot.planActivities = slotPlanActivities.map(item => ({ ...item }));
            slot.activityLog.subActivities = slotActualActivities.map(item => ({ ...item }));

            slot.planned = summarizeLabel(slotPlanActivities, mergedPlannedText);
            slot.actual = summarizeLabel(slotActualActivities, mergedActualText);

            slot.planTitle = slot.planned ? mergedPlanTitle : '';
            slot.planTitleBandOn = Boolean(slot.planTitle && slotPlanActivities.length > 0);
            slot.activityLog.titleBandOn = Boolean(slot.activityLog.titleBandOn && slotActualActivities.length > 0);
            slot.activityLog.actualOverride = false;
            slot.activityLog.actualGridUnits = Array.isArray(actualUnitsBySlot[rel]) ? actualUnitsBySlot[rel].slice() : [];
            slot.activityLog.actualExtraGridUnits = Array.isArray(extraUnitsBySlot[rel]) ? extraUnitsBySlot[rel].slice() : [];
            slot.activityLog.actualFailedGridUnits = Array.isArray(failedUnitsBySlot[rel]) ? failedUnitsBySlot[rel].slice() : [];
        }

        this.renderTimeEntries();
        this.clearAllSelections();
        this.calculateTotals();
        this.autoSave();
    }

    function selectMergedRange(type, mergeKey, opts = {}) {
        if (type !== 'planned') return; // 우측 열 병합 범위 선택 금지
        const [, startStr, endStr] = mergeKey.split('-');
        let start = parseInt(startStr, 10);
        let end = parseInt(endStr, 10);
        if (!Number.isFinite(start) || !Number.isFinite(end)) return;

        const append = Boolean(opts && opts.append);
        const selectedSet = type === 'planned' ? this.selectedPlannedFields : this.selectedActualFields;

        if (append && selectedSet && selectedSet.size > 0) {
            const selectedIndices = Array.from(selectedSet).sort((a, b) => a - b);
            const curStart = selectedIndices[0];
            const curEnd = selectedIndices[selectedIndices.length - 1];
            start = Math.min(start, curStart);
            end = Math.max(end, curEnd);
        }

        this.clearSelection(type);

        for (let i = start; i <= end; i++) {
            selectedSet.add(i);
            // 선택 시각 효과는 공통 오버레이로 대체
        }

        this.updateSelectionOverlay(type);
        this.showScheduleButtonForSelection(type);
        if (type === 'planned' && selectedSet.size > 1) {
            if (append) this.showMergeButton('planned');
            else this.hideMergeButton();
        }

        // Undo 버튼은 "기존 병합 블록 단독 선택"일 때만 노출
        if (!append && type === 'planned') {
            this.showUndoButton(type, mergeKey);
        } else {
            this.hideUndoButton();
        }
    }

    function ensureSelectionOverlay(type) {
        let overlay = getSelectionOverlayElement.call(this, type);
        if (!overlay) {
            const el = document.createElement('div');
            el.className = 'selection-overlay';
            el.dataset.type = type;

            // 오버레이 위에서 드래그 시작을 허용하여 단일 선택 상태에서도 드래그 확장 가능
            let overlayDrag = { active: false, moved: false, startIndex: -1 };

            const onOverlayMouseDown = (e) => {
                if (e.button !== 0) return; // 좌클릭만 처리
                // 오버레이 내부 버튼(스케줄/되돌리기/병합) 클릭은 통과
                if (e.target.closest('.schedule-button') || e.target.closest('.undo-button') || e.target.closest('.merge-button')) {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                const idx = this.getIndexAtClientPosition(type, e.clientX, e.clientY);
                if (idx == null || isNaN(idx)) return;
                overlayDrag = { active: true, moved: false, startIndex: idx };
                this.currentColumnType = type;
                if (type === 'planned') this.isSelectingPlanned = true; else this.isSelectingActual = true;

                // 드래그가 오버레이 밖으로 나가도 추적되도록 문서 레벨로 이동/업 핸들러 바인딩
                this._overlayMouseMove = (ev) => {
                    if (!overlayDrag.active) return;
                    const curIdx = this.getIndexAtClientPosition(type, ev.clientX, ev.clientY);
                    if (curIdx == null || isNaN(curIdx)) return;
                    if (curIdx !== overlayDrag.startIndex) overlayDrag.moved = true;
                    // 드래그 확장: 기존 선택을 드래그 범위로 갱신
                    this.selectFieldRange(type, overlayDrag.startIndex, curIdx);
                };
                this._overlayMouseUp = (ev) => {
                    if (!overlayDrag.active) return;
                    ev.preventDefault();
                    ev.stopPropagation();
                    // 드래그 없이 클릭만 했다면 기존 동작(선택 해제) 유지
                    if (!overlayDrag.moved) {
                        if (type === 'planned' && this.inlinePlanDropdown && Number.isInteger(overlayDrag.startIndex)) {
                            const clickedRange = this.getPlannedRangeInfo(overlayDrag.startIndex);
                            if (this.isSameInlinePlanTarget(clickedRange)) {
                                this.closeInlinePlanDropdown();
                            }
                        }
                        this.clearSelection(type);
                    }
                    overlayDrag = { active: false, moved: false, startIndex: -1 };
                    if (type === 'planned') this.isSelectingPlanned = false; else this.isSelectingActual = false;
                    this.currentColumnType = null;
                    document.removeEventListener('mousemove', this._overlayMouseMove, true);
                    document.removeEventListener('mouseup', this._overlayMouseUp, true);
                    this._overlayMouseMove = null;
                    this._overlayMouseUp = null;
                };
                document.addEventListener('mousemove', this._overlayMouseMove, true);
                document.addEventListener('mouseup', this._overlayMouseUp, true);
            };

            el.addEventListener('mousedown', onOverlayMouseDown, true);
            // 클릭만의 경우(드래그 없음)는 mouseup 핸들러에서 clearSelection 처리

            document.body.appendChild(el);
            overlay = setSelectionOverlayElement.call(this, type, el);
        }
        return overlay;
    }

    function getIndexAtClientPosition(type, clientX, clientY) {
        const selector = type === 'planned' ? '.planned-input' : '.actual-input';
        const elements = document.elementsFromPoint(clientX, clientY) || [];
        for (const el of elements) {
            if (el.matches && el.matches(selector)) {
                const idx = el.getAttribute('data-index');
                if (idx !== null) return parseInt(idx, 10);
            }
            const row = el.closest && el.closest('.time-entry[data-index]');
            if (row) {
                const rowIdx = row.getAttribute('data-index');
                if (rowIdx !== null) return parseInt(rowIdx, 10);
            }
        }
        return null;
    }

    function removeSelectionOverlay(type) {
        const el = getSelectionOverlayElement.call(this, type);
        if (el && el.parentNode) el.parentNode.removeChild(el);
        setSelectionOverlayElement.call(this, type, null);
    }

    function updateSelectionOverlay(type) {
        const selectedSet = getSelectionSetForType.call(this, type);
        if (!selectedSet || selectedSet.size < 1) {
            this.removeSelectionOverlay(type);
            return;
        }
        this.removeHoverSelectionOverlay(type);
        if (type === 'planned') this.hoveredMergeKey = null;

        const idx = Array.from(selectedSet).sort((a,b)=>a-b);
        const startIndex = idx[0];
        const endIndex   = idx[idx.length - 1];

        const startField = document.querySelector(`[data-index="${startIndex}"] .${type}-input`);
        const endField   = document.querySelector(`[data-index="${endIndex}"] .${type}-input`);
        if (!startField || !endField) {
            this.removeSelectionOverlay(type);
            return;
        }

        // 좌/우 컬럼별 선택 기준 요소(rect)를 계산
        const startRect = this.getSelectionCellRect(type, startIndex);
        if (!startRect) {
            this.removeSelectionOverlay(type);
            return;
        }
        // 하단 기준 계산
        let endBottom;
        if (type === 'actual') {
            // 우측은 "활동 기록" 입력창의 하단까지로 한정
            const endRect = this.getSelectionCellRect(type, endIndex) || endField.getBoundingClientRect();
            endBottom = endRect.bottom;
        } else {
            // 좌측은 행 경계 하단까지
            const endRow = endField.closest('.time-entry');
            const endRowRect = endRow ? endRow.getBoundingClientRect() : endField.getBoundingClientRect();
            endBottom = endRowRect.bottom;
        }

        const overlay   = this.ensureSelectionOverlay(type);
        if (type === 'planned') {
            overlay.dataset.fill = selectedSet.size > 1 ? 'solid' : 'outline';
        } else {
            delete overlay.dataset.fill;
        }
        const left      = startRect.left + window.scrollX;
        const top       = startRect.top  + window.scrollY;
        const width     = startRect.width;
        const height    = Math.max(0, (endBottom - startRect.top));

        overlay.style.left   = `${left}px`;
        overlay.style.top    = `${top}px`;
        overlay.style.width  = `${width}px`;
        overlay.style.height = `${height}px`;
    }

    function getSelectionCellRect(type, index) {
        if (type === 'actual') {
            const mergeKey = this.findMergeKey('actual', index);
            if (mergeKey) {
                const [ , startStr ] = mergeKey.split('-');
                const start = parseInt(startStr, 10);
                const input = document.querySelector(`[data-index="${start}"] .actual-field-container.merged-actual-main .timer-result-input`);
                if (input) return input.getBoundingClientRect();
            }
            const input = document.querySelector(`[data-index="${index}"] .timer-result-input`);
            if (input) return input.getBoundingClientRect();
            // 폴백: 필드 자체
            const field = document.querySelector(`[data-index="${index}"] .actual-input`);
            return field ? field.getBoundingClientRect() : null;
        } else {
            const field = document.querySelector(`[data-index="${index}"] .${type}-input`);
            return field ? field.getBoundingClientRect() : null;
        }
    }

    function ensureHoverSelectionOverlay(type) {
        let overlay = getHoverSelectionOverlayElement.call(this, type);
        if (!overlay) {
            const el = document.createElement('div');
            el.className = 'selection-overlay hover-selection-overlay';
            el.dataset.type = type;
            document.body.appendChild(el);
            overlay = setHoverSelectionOverlayElement.call(this, type, el);
        }
        return overlay;
    }

    function removeHoverSelectionOverlay(type) {
        const el = getHoverSelectionOverlayElement.call(this, type);
        if (el && el.parentNode) el.parentNode.removeChild(el);
        setHoverSelectionOverlayElement.call(this, type, null);
    }

    function updateHoverSelectionOverlay(type, startIndex, endIndex) {
        const startField = document.querySelector(`[data-index="${startIndex}"] .${type}-input`);
        const endField = document.querySelector(`[data-index="${endIndex}"] .${type}-input`);
        if (!startField || !endField) {
            this.removeHoverSelectionOverlay(type);
            return;
        }

        const startRect = this.getSelectionCellRect(type, startIndex);
        if (!startRect) {
            this.removeHoverSelectionOverlay(type);
            return;
        }

        let endBottom;
        if (type === 'actual') {
            const endRect = this.getSelectionCellRect(type, endIndex) || endField.getBoundingClientRect();
            endBottom = endRect.bottom;
        } else {
            const endRow = endField.closest('.time-entry');
            const endRowRect = endRow ? endRow.getBoundingClientRect() : endField.getBoundingClientRect();
            endBottom = endRowRect.bottom;
        }

        const overlay = this.ensureHoverSelectionOverlay(type);
        overlay.style.left = `${startRect.left + window.scrollX}px`;
        overlay.style.top = `${startRect.top + window.scrollY}px`;
        overlay.style.width = `${startRect.width}px`;
        overlay.style.height = `${Math.max(0, (endBottom - startRect.top))}px`;
    }

    function isMergeRangeSelected(type, mergeKey) {
        const [, startStr, endStr] = mergeKey.split('-');
        const start = parseInt(startStr, 10);
        const end   = parseInt(endStr, 10);
        const set   = getSelectionSetForType.call(this, type);

        if (set.size !== (end - start + 1)) return false;
        for (let i = start; i <= end; i++) {
            if (!set.has(i)) return false;
        }
        return true;
    }

    function hideScheduleButton() {
        if (this.scheduleButton) {
            if (this.scheduleButton.parentNode) {
                this.scheduleButton.parentNode.removeChild(this.scheduleButton);
            }
            this.scheduleButton = null;
        }
    }

    function showScheduleButtonForSelection(type) {
        this.hideScheduleButton();
        return;

        // 스케줄 입력 버튼은 계획(planned) 컬럼에서만 표시
        if (type !== 'planned') return;

        const overlay = getSelectionOverlayElement.call(this, type);
        if (!overlay) return;

        const selectedSet = getSelectionSetForType.call(this, type);
        if (selectedSet.size === 0) return;

        // 병합 버튼과 동시 표시는 하지 않음: 멀티 선택(병합 후보)에서는 스케줄 버튼 숨김
        // 단, 이미 병합된 범위를 선택한 경우(Undo 가능)는 예외로 스케줄 버튼 표시
        if (selectedSet.size > 1) {
            const indices = Array.from(selectedSet).sort((a,b)=>a-b);
            const firstIndex = indices[0];
            const mk = this.findMergeKey('planned', firstIndex);
            const isMergedSelection = mk ? this.isMergeRangeSelected('planned', mk) : false;
            if (!isMergedSelection) {
                // 멀티 선택이지만 병합 범위가 아닌 경우 → 병합 버튼만 필요
                return;
            }
        }

        const rect = overlay.getBoundingClientRect();

        this.scheduleButton = document.createElement('button');
        this.scheduleButton.className = 'schedule-button';
        this.scheduleButton.textContent = '📅';
        this.scheduleButton.title = '스케줄 입력';
        this.scheduleButton.setAttribute('aria-label', '스케줄 입력');
        // 위치는 CSS로 오버레이 정중앙에 표시 (hover 시 노출)

            this.scheduleButton.addEventListener('click', (e) => {
                e.stopPropagation();
                const selectedIndices = Array.from(selectedSet).sort((a, b) => a - b);
                const firstIndex = selectedIndices[0];
                const lastIndex = selectedIndices[selectedIndices.length - 1];
                const anchor = document.querySelector(`[data-index="${firstIndex}"] .planned-input`) || document.querySelector(`[data-index="${firstIndex}"]`);
                this.openInlinePlanDropdown(firstIndex, anchor, lastIndex);
            });

        // 스케줄 버튼은 오버레이 내부에 배치
        overlay.appendChild(this.scheduleButton);
        // 되돌리기 버튼(병합된 범위 선택 시)이 있으면 스케줄 버튼 우측으로 정렬
        this.repositionButtonsNextToSchedule();

        // 클릭 시 현재 선택 범위에 대해 모달 오픈
        this.scheduleButton.onclick = (e) => {
            e.stopPropagation();
            const selectedIndices = Array.from(selectedSet).sort((a, b) => a - b);
            const firstIndex = selectedIndices[0];
            const lastIndex = selectedIndices[selectedIndices.length - 1];
            this.openScheduleModal(type, firstIndex, lastIndex);
        };
    }

    function showScheduleButtonOnHover(index) {
        this.hideHoverScheduleButton();
        return;
        // 멀티 선택 중(병합 후보)에는 스케줄 버튼을 표시하지 않음
        if (this.selectedPlannedFields && this.selectedPlannedFields.size > 1) {
            const indices = Array.from(this.selectedPlannedFields).sort((a,b)=>a-b);
            const firstIndex = indices[0];
            const mk = this.findMergeKey('planned', firstIndex);
            const isMergedSelection = mk ? this.isMergeRangeSelected('planned', mk) : false;
            if (!isMergedSelection) return; // 병합 후보(아직 병합 아님)일 때만 차단
        }
        // 선택 중인 셀 자체에는 오버레이 내부 버튼이 있으므로 중복 표시하지 않음
        const plannedSelection = getSelectionSetForType.call(this, 'planned');
        if (plannedSelection && plannedSelection.size > 0) {
            this.hideHoverScheduleButton();
            return;
        }

        const field = document.querySelector(`[data-index="${index}"] .planned-input`);
        if (!field) {
            this.removeHoverSelectionOverlay('planned');
            return;
        }
        const rect = field.getBoundingClientRect();
        const scrollX = window.scrollX || document.documentElement.scrollLeft || 0;
        const scrollY = window.scrollY || document.documentElement.scrollTop || 0;

        // 생성/표시
        this.hideHoverScheduleButton();
        const btn = document.createElement('button');
        btn.className = 'schedule-button';
        btn.textContent = '📅';
        btn.title = '스케줄 입력';
        btn.setAttribute('aria-label', '스케줄 입력');
        // 셀 정중앙에 배치
        const btnW = 28, btnH = 28;
        const centerX = rect.left + scrollX + (rect.width / 2);
        const centerY = rect.top  + scrollY + (rect.height / 2);
        btn.style.left = `${Math.round(centerX - (btnW/2))}px`;
        btn.style.top  = `${Math.round(centerY - (btnH/2))}px`;

        btn.onclick = (e) => {
            e.stopPropagation();
            const mk = this.findMergeKey('planned', index);
            if (mk) {
                const [, s, eIdx] = mk.split('-');
                const anchor = document.querySelector(`[data-index="${s}"] .planned-input`) || document.querySelector(`[data-index="${s}"]`);
                this.openInlinePlanDropdown(parseInt(s,10), anchor, parseInt(eIdx,10));
            } else {
                const anchor = document.querySelector(`[data-index="${index}"] .planned-input`) || document.querySelector(`[data-index="${index}"]`);
                this.openInlinePlanDropdown(index, anchor, index);
            }
        };

        // 호버 유지: 버튼 위로 올리면 유지, 버튼에서 벗어나면 숨김
        let hideTimer = null;
        const requestHide = () => {
            hideTimer = setTimeout(() => {
                // 되돌리기 버튼 위에 있을 땐 숨기지 않음
                if (this.undoButton && this.undoButton.matches(':hover')) return;
                this.hideHoverScheduleButton();
            }, 150);
        };
        btn.addEventListener('mouseleave', requestHide);
        btn.addEventListener('mouseenter', () => { if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; } });

        document.body.appendChild(btn);
        this.scheduleHoverButton = btn;

        const mergeKey = this.findMergeKey('planned', index);
        const mkParts = mergeKey ? mergeKey.split('-') : null;
        const startIndex = mkParts ? parseInt(mkParts[1], 10) : index;
        const endIndex = mkParts ? parseInt(mkParts[2], 10) : index;
        this.updateHoverSelectionOverlay('planned', startIndex, endIndex);
        if (mergeKey) {
            this.hoveredMergeKey = mergeKey;
            this.showUndoButton('planned', mergeKey);
        } else {
            this.hoveredMergeKey = null;
            this.hideUndoButton();
        }

        this.repositionButtonsNextToSchedule();
    }

    function hideHoverScheduleButton() {
        // 되돌리기 버튼에 커서가 있으면 유지
        if (this.undoButton && this.undoButton.matches(':hover')) return;
        if (this.scheduleHoverButton && this.scheduleHoverButton.parentNode) {
            this.scheduleHoverButton.parentNode.removeChild(this.scheduleHoverButton);
            this.scheduleHoverButton = null;
        }
        this.removeHoverSelectionOverlay('planned');
        const plannedSelection = getSelectionSetForType.call(this, 'planned');
        if (this.hoveredMergeKey && (!plannedSelection || plannedSelection.size === 0)) {
            this.hideUndoButton();
        }
        this.hoveredMergeKey = null;
    }

    function repositionButtonsNextToSchedule() {
        const anchor = getScheduleAnchorElement.call(this);
        if (!anchor) return;
        const spacing = 8;
        const sbRect = anchor.getBoundingClientRect();
        const baseLeft = window.scrollX + sbRect.left + sbRect.width + spacing;
        const baseTop  = window.scrollY + sbRect.top;

        if (this.mergeButton) {
            this.mergeButton.style.left = `${Math.round(baseLeft)}px`;
            this.mergeButton.style.top  = `${Math.round(baseTop)}px`;
        }
        if (this.undoButton) {
            this.undoButton.style.left = `${Math.round(baseLeft)}px`;
            this.undoButton.style.top  = `${Math.round(baseTop)}px`;
        }
    }

    return Object.freeze({
        selectFieldRange,
        clearSelection,
        clearAllSelections,
        showMergeButton,
        hideMergeButton,
        showUndoButton,
        hideUndoButton,
        undoMerge,
        selectMergedRange,
        ensureSelectionOverlay,
        getIndexAtClientPosition,
        removeSelectionOverlay,
        updateSelectionOverlay,
        getSelectionCellRect,
        ensureHoverSelectionOverlay,
        removeHoverSelectionOverlay,
        updateHoverSelectionOverlay,
        isMergeRangeSelected,
        hideScheduleButton,
        showScheduleButtonForSelection,
        showScheduleButtonOnHover,
        hideHoverScheduleButton,
        repositionButtonsNextToSchedule
    });
});
