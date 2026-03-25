(function attachTimeTrackerSchedulePreviewController(root, factory) {
    const api = factory(root);

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        const existing = (root.TimeTrackerSchedulePreviewController && typeof root.TimeTrackerSchedulePreviewController === 'object')
            ? root.TimeTrackerSchedulePreviewController
            : {};
        root.TimeTrackerSchedulePreviewController = Object.assign(existing, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildTimeTrackerSchedulePreviewController(root) {
function updateSchedulePreview() {
    const modal = document.getElementById('scheduleModal');
    if (!modal || modal.style.display !== 'flex') return;
    const list = document.getElementById('schedulePreviewList');
    const meta = document.getElementById('schedulePreviewMeta');
    const note = document.getElementById('schedulePreviewNote');
    if (!list || !meta || !note) return;
     const startIndex = parseInt(modal.dataset.startIndex, 10);
    const endIndex = parseInt(modal.dataset.endIndex, 10);
    if (!Number.isFinite(startIndex) || !Number.isFinite(endIndex)) {
        this.resetSchedulePreview();
        return;
    }
     const count = Math.max(1, (endIndex - startIndex + 1));
    const timeField = document.getElementById('scheduleTime');
    const totalLabel = this.formatDurationSummary(count * 3600);
    const timeLabel = timeField ? timeField.value : '';
    meta.textContent = timeLabel ? `${totalLabel} · ${timeLabel}` : totalLabel;
     const preview = this.getSchedulePreviewData();
    const type = modal.dataset.type || 'planned';
    note.textContent = '';
    if (preview) {
        if (preview.hasInvalid) {
            note.textContent = '계획 분해에 잘못된 시간 형식이 있습니다.';
        } else if (preview.hasMismatch) {
            note.textContent = '분해 합계가 총 시간과 일치하지 않습니다.';
        }
    }
     const originalSlots = this.timeSlots;
    const originalMerged = this.mergedFields;
    const previewSlots = (this.timeSlots || []).map((slot) => {
        const timer = slot && typeof slot.timer === 'object'
            ? { ...slot.timer }
            : { running: false, elapsed: 0, startTime: null, method: 'manual' };
        const activityLog = slot && typeof slot.activityLog === 'object'
            ? {
                ...slot.activityLog,
                subActivities: Array.isArray(slot.activityLog.subActivities)
                    ? slot.activityLog.subActivities.map(item => ({ ...item }))
                    : [],
                actualGridUnits: Array.isArray(slot.activityLog.actualGridUnits)
                    ? slot.activityLog.actualGridUnits.slice()
                    : [],
                actualExtraGridUnits: Array.isArray(slot.activityLog.actualExtraGridUnits)
                    ? slot.activityLog.actualExtraGridUnits.slice()
                    : [],
                actualFailedGridUnits: Array.isArray(slot.activityLog.actualFailedGridUnits)
                    ? slot.activityLog.actualFailedGridUnits.slice()
                    : []
            }
            : { title: '', details: '', subActivities: [], titleBandOn: false, actualGridUnits: [], actualExtraGridUnits: [], actualFailedGridUnits: [], actualOverride: false };
        const planActivities = Array.isArray(slot.planActivities)
            ? slot.planActivities.map(item => ({ ...item }))
            : [];
        return {
            ...slot,
            timer,
            activityLog,
            planActivities
        };
    });
    const previewMerged = new Map(this.mergedFields);
     if (type === 'planned' && preview) {
        const planActivities = (preview.planActivities || []).map(item => ({ ...item }));
        const planTitle = preview.planTitle || '';
        const planTitleBandOn = Boolean(preview.planTitleBandOn && planTitle);
        const planText = preview.text || '';
         if (startIndex === endIndex) {
            if (previewSlots[startIndex]) {
                previewSlots[startIndex].planned = planText;
                previewSlots[startIndex].planActivities = planActivities;
                previewSlots[startIndex].planTitle = planTitle;
                previewSlots[startIndex].planTitleBandOn = planTitleBandOn;
            }
        } else {
            const mergeKey = `planned-${startIndex}-${endIndex}`;
            previewMerged.set(mergeKey, planText);
            for (let i = startIndex; i <= endIndex; i++) {
                if (!previewSlots[i]) continue;
                previewSlots[i].planned = i === startIndex ? planText : '';
                previewSlots[i].planActivities = i === startIndex ? planActivities.map(item => ({ ...item })) : [];
                previewSlots[i].planTitle = i === startIndex ? planTitle : '';
                previewSlots[i].planTitleBandOn = i === startIndex ? planTitleBandOn : false;
            }
        }
    }
     list.innerHTML = '';
    try {
        this.timeSlots = previewSlots;
        this.mergedFields = previewMerged;
         const sheet = document.createElement('div');
        sheet.className = 'timesheet schedule-preview-sheet';
         const header = document.createElement('div');
        header.className = 'header-row';
        header.innerHTML = `
            <div class="planned-label">계획된 활동</div>
            <div class="time-label">시간</div>
            <div class="actual-label">실제 활동</div>
        `;
        sheet.appendChild(header);
         const entries = document.createElement('div');
        entries.className = 'time-entries schedule-preview-entries';
         for (let index = startIndex; index <= endIndex; index++) {
            const slot = previewSlots[index];
            if (!slot) continue;
            const entryDiv = document.createElement('div');
            entryDiv.className = 'time-entry';
            entryDiv.dataset.index = String(index);
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
                    <div class="time-label">${slot.time}</div>
                    ${timerControls}
                </div>`;
            }
             entryDiv.innerHTML = `
                ${plannedContent}
                ${timeContent}
                ${actualContent}
            `;
             if (plannedMergeKey) {
                const plannedStart = parseInt(plannedMergeKey.split('-')[1], 10);
                const plannedEnd = parseInt(plannedMergeKey.split('-')[2], 10);
                if (index >= plannedStart && index < plannedEnd) {
                    entryDiv.classList.add('has-planned-merge');
                }
            }
             if (actualMergeKey) {
                const actualStart = parseInt(actualMergeKey.split('-')[1], 10);
                const actualEnd = parseInt(actualMergeKey.split('-')[2], 10);
                if (index >= actualStart && index < actualEnd) {
                    entryDiv.classList.add('has-actual-merge');
                }
            }
             entries.appendChild(entryDiv);
        }
         sheet.appendChild(entries);
        list.appendChild(sheet);
         this.centerMergedTimeContent(entries);
        this.resizeMergedActualContent(entries);
        this.resizeMergedPlannedContent(entries);
    } finally {
        this.timeSlots = originalSlots;
        this.mergedFields = originalMerged;
    }
}

function resetSchedulePreview() {
    const list = document.getElementById('schedulePreviewList');
    const meta = document.getElementById('schedulePreviewMeta');
    const note = document.getElementById('schedulePreviewNote');
    if (list) list.innerHTML = '';
    if (meta) meta.textContent = '';
    if (note) note.textContent = '';
}

function getSchedulePreviewData() {
    const modal = document.getElementById('scheduleModal');
    if (!modal) return null;
    const type = modal.dataset.type || 'planned';
    const activity = (this.modalSelectedActivities || []).join(', ').trim();
    if (type !== 'planned') {
        return {
            text: activity,
            title: '',
            titleBand: false,
            planActivities: [],
            planTitle: '',
            planTitleBandOn: false,
            hasInvalid: false,
            hasMismatch: false
        };
    }
     const rawPlanActivities = Array.isArray(this.modalPlanActivities) ? this.modalPlanActivities : [];
    const sanitizedPlanActivities = rawPlanActivities
        .filter(item => item && !item.invalid && (String(item.label || '').trim() !== ''
            || (Number.isFinite(item.seconds) && item.seconds > 0)))
        .map(item => {
            const label = this.normalizeActivityText
                ? this.normalizeActivityText(item.label || '')
                : String(item.label || '').trim();
            const seconds = Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
            return { label, seconds };
        });
    const planSummary = sanitizedPlanActivities.length > 0 ? this.formatActivitiesSummary(sanitizedPlanActivities) : '';
    const planText = planSummary || activity;
    const planTitleText = this.normalizeActivityText
        ? this.normalizeActivityText(this.modalPlanTitle || '')
        : String(this.modalPlanTitle || '').trim();
    const planTitleBandEnabled = Boolean(this.modalPlanTitleBandOn && planTitleText);
    const planTotalSeconds = Math.max(0, Number(this.modalPlanTotalSeconds) || 0);
    const planUsedSeconds = sanitizedPlanActivities.reduce((sum, item) => sum + item.seconds, 0);
    const hasPlanInvalid = rawPlanActivities.some(item => item && item.invalid);
    const hasPlanMismatch = sanitizedPlanActivities.length > 0 && planTotalSeconds > 0 && planUsedSeconds !== planTotalSeconds;
     return {
        text: planText,
        title: planTitleText,
        titleBand: Boolean(this.modalPlanTitleBandOn && planTitleText),
        planActivities: sanitizedPlanActivities,
        planTitle: planTitleText,
        planTitleBandOn: planTitleBandEnabled,
        hasInvalid: hasPlanInvalid,
        hasMismatch: hasPlanMismatch
    };
}

function showActivityLogButtonOnHover(index) {
    const wrapper = document.querySelector(`.time-entry[data-index="${index}"] .split-cell-wrapper.split-type-actual.split-has-data`);
    if (!wrapper) return;
     const inlineBtn = wrapper.querySelector('.activity-log-btn');
    if (!inlineBtn) return;
     this.hideHoverActivityLogButton();
    inlineBtn.style.opacity = '1';
    inlineBtn.style.pointerEvents = 'auto';
    this.activityHoverButton = inlineBtn;
}

    return Object.freeze({
        showActivityLogButtonOnHover,
        getSchedulePreviewData,
        resetSchedulePreview,
        updateSchedulePreview,
    });
});
