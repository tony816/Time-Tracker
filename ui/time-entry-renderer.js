(function attachTimeEntryRenderer(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        const existing = (root.TimeEntryRenderer && typeof root.TimeEntryRenderer === 'object')
            ? root.TimeEntryRenderer
            : {};
        root.TimeEntryRenderer = Object.assign(existing, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildTimeEntryRenderer() {
    function parseMergeRange(mergeKey) {
        if (!mergeKey || typeof mergeKey !== 'string') return null;
        const parts = mergeKey.split('-');
        if (parts.length !== 3) return null;
        const start = parseInt(parts[1], 10);
        const end = parseInt(parts[2], 10);
        if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
        return { start, end };
    }

    function buildPlannedInputMarkup(index, plannedValue, escapeAttribute) {
        const escapedValue = (typeof escapeAttribute === 'function')
            ? escapeAttribute(plannedValue)
            : String(plannedValue || '');

        return `<input type="text" class="input-field planned-input" 
                        data-index="${index}" 
                        data-type="planned" 
                        value="${escapedValue}"
                        placeholder="\uacc4\ud68d\uc744 \uc785\ub825\ud558\ub824\uba74 \ud074\ub9ad \ub610\ub294 Enter" readonly tabindex="0" aria-label="\uacc4\ud68d \ud65c\ub3d9 \uc785\ub825" title="\ud074\ub9ad\ud574\uc11c \uacc4\ud68d \uc120\ud0dd/\uc785\ub825" style="cursor: pointer;">`;
    }

    function buildTimeSlotContainerMarkup(formattedLabel, timerControls) {
        const mergeHintLabel = '\ub4dc\ub798\uadf8\ud574 \ubcd1\ud569 \ubc94\uc704 \uc120\ud0dd';
        return `<div class="time-slot-container merge-capable"
                    title="${mergeHintLabel}"
                    aria-label="${mergeHintLabel}">
                    <span class="time-slot-merge-affordance" aria-hidden="true"></span>
                    <div class="time-label time-slot-label">${formattedLabel}</div>
                    ${timerControls}
                </div>`;
    }

    function buildRowRenderModel(options = {}) {
        const slot = (options && options.slot && typeof options.slot === 'object') ? options.slot : {};
        const index = Number(options.index);
        const currentDate = options.currentDate || null;
        const findMergeKey = options.findMergeKey;
        const createMergedField = options.createMergedField;
        const wrapWithSplitVisualization = options.wrapWithSplitVisualization;
        const createTimerControls = options.createTimerControls;
        const createMergedTimeField = options.createMergedTimeField;
        const formatSlotTimeLabel = options.formatSlotTimeLabel;
        const escapeAttribute = options.escapeAttribute;
        const getRoutineForPlannedIndex = options.getRoutineForPlannedIndex;
        const isMobileTimeColumn = typeof options.isMobileTimeColumn === 'function'
            ? options.isMobileTimeColumn()
            : Boolean(options.isMobileTimeColumn);

        const plannedMergeKey = (typeof findMergeKey === 'function') ? findMergeKey('planned', index) : null;

        let plannedContent;
        if (plannedMergeKey && typeof createMergedField === 'function') {
            plannedContent = createMergedField(plannedMergeKey, 'planned', index, slot.planned);
        } else {
            plannedContent = buildPlannedInputMarkup(index, slot.planned, escapeAttribute);
        }
        if (typeof wrapWithSplitVisualization === 'function') {
            plannedContent = wrapWithSplitVisualization('planned', index, plannedContent);
        }

        const timeMergeKey = (typeof findMergeKey === 'function') ? findMergeKey('time', index) : null;
        const timerControls = (!isMobileTimeColumn && typeof createTimerControls === 'function')
            ? createTimerControls(index, slot)
            : '';

        let timeContent;
        if (timeMergeKey && typeof createMergedTimeField === 'function') {
            timeContent = createMergedTimeField(timeMergeKey, index, slot);
        } else {
            const rawLabel = slot && Object.prototype.hasOwnProperty.call(slot, 'time') ? slot.time : '';
            const formattedLabel = (typeof formatSlotTimeLabel === 'function')
                ? formatSlotTimeLabel(rawLabel)
                : String(rawLabel || '');
            timeContent = buildTimeSlotContainerMarkup(formattedLabel, timerControls);
        }

        const plannedRange = parseMergeRange(plannedMergeKey);
        const routineMatch = (typeof getRoutineForPlannedIndex === 'function')
            ? getRoutineForPlannedIndex(index, currentDate)
            : null;

        return {
            plannedMergeKey,
            actualMergeKey: null,
            routineMatch,
            hasPlannedMergeContinuation: Boolean(plannedRange && index >= plannedRange.start && index < plannedRange.end),
            hasActualMergeContinuation: false,
            innerHtml: `
                ${timeContent}
                ${plannedContent}
            `,
        };
    }

    return Object.freeze({
        parseMergeRange,
        buildRowRenderModel,
    });
});
