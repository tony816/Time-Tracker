(function attachTimeTrackerActualActivityListRenderer(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        const existing = (root.TimeTrackerActualActivityListRenderer && typeof root.TimeTrackerActualActivityListRenderer === 'object')
            ? root.TimeTrackerActualActivityListRenderer
            : {};
        root.TimeTrackerActualActivityListRenderer = Object.assign(existing, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildTimeTrackerActualActivityListRenderer() {
    const DEFAULT_STRINGS = Object.freeze({
        emptyLabel: '세부 활동',
        emptyState: '세부 활동을 추가해보세요',
        labelAria: '세부 활동',
        moveUp: '위',
        moveDown: '아래',
        remove: '삭제',
    });

    function resolveNormalizeActivityText(fn) {
        if (typeof fn === 'function') return fn;
        return (value) => String(value || '').trim();
    }

    function resolveStrings(strings) {
        return Object.assign({}, DEFAULT_STRINGS, strings || {});
    }

    function getSafeSeconds(value) {
        return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    }

    function buildActualActivityRowState(options = {}) {
        const item = (options.item && typeof options.item === 'object') ? options.item : {};
        const normalizeActivityText = resolveNormalizeActivityText(options.normalizeActivityText);
        const strings = resolveStrings(options.strings);
        const gridSecondsMap = (options.gridSecondsMap instanceof Map) ? options.gridSecondsMap : new Map();
        const planLabelSet = (options.planLabelSet instanceof Set) ? options.planLabelSet : new Set();
        const index = Number.isFinite(options.index) ? Math.max(0, Math.floor(options.index)) : 0;
        const totalCount = Number.isFinite(options.totalCount) ? Math.max(0, Math.floor(options.totalCount)) : 0;
        const activeIndex = Number.isFinite(options.activeIndex) ? Math.floor(options.activeIndex) : -1;

        const normalizedLabel = normalizeActivityText(item.label || '');
        const safeSeconds = getSafeSeconds(item.seconds);
        const recordedSeconds = Number.isFinite(item.recordedSeconds)
            ? Math.max(0, Math.floor(item.recordedSeconds))
            : safeSeconds;
        const isLockedRow = item.source === 'locked';
        const isPlanLabel = Boolean(normalizedLabel)
            && (planLabelSet.has(normalizedLabel) || item.source === 'grid');
        const isExtraLabel = Boolean(normalizedLabel) && !isPlanLabel;
        const gridSeconds = isPlanLabel
            ? (gridSecondsMap.get(normalizedLabel) || 0)
            : recordedSeconds;
        const gridDisabled = isLockedRow
            || !options.hasPlanUnits
            || !normalizedLabel
            || (!isPlanLabel && !isExtraLabel);

        const classNames = ['sub-activity-row', 'actual-row'];
        if (index === activeIndex) classNames.push('active');
        if (isLockedRow) classNames.push('actual-row-locked');
        if (isExtraLabel) classNames.push('actual-row-extra');

        return {
            index,
            classNames,
            normalizedLabel,
            labelText: normalizedLabel || strings.emptyLabel,
            labelAria: strings.labelAria,
            isLabelEmpty: !normalizedLabel,
            isLockedRow,
            isExtraLabel,
            safeSeconds,
            gridSeconds,
            gridDisabled,
            assignDisabled: isLockedRow,
            moveUpDisabled: isLockedRow || index === 0,
            moveDownDisabled: isLockedRow || index >= (totalCount - 1),
            removeDisabled: isLockedRow || totalCount <= 1,
            moveUpText: strings.moveUp,
            moveDownText: strings.moveDown,
            removeText: strings.remove,
        };
    }

    function buildActualActivityRowStates(items, options = {}) {
        const list = Array.isArray(items) ? items : [];
        return list.map((item, index) => buildActualActivityRowState(Object.assign({}, options, {
            item,
            index,
            totalCount: list.length,
        })));
    }

    function createActualActivityRowElement(options = {}) {
        const documentRef = options.document;
        const rowState = (options.rowState && typeof options.rowState === 'object') ? options.rowState : null;
        const createActualTimeControl = options.createActualTimeControl;

        if (!documentRef || typeof documentRef.createElement !== 'function' || !rowState) return null;

        const row = documentRef.createElement('div');
        row.className = rowState.classNames.join(' ');
        row.dataset.index = String(rowState.index);

        const labelButton = documentRef.createElement('button');
        labelButton.type = 'button';
        labelButton.className = 'actual-activity-label';
        labelButton.setAttribute('aria-label', rowState.labelAria);
        labelButton.setAttribute('aria-haspopup', 'menu');
        labelButton.setAttribute('aria-expanded', 'false');
        labelButton.textContent = rowState.labelText;
        if (rowState.isLabelEmpty) labelButton.classList.add('empty');

        const gridControl = (typeof createActualTimeControl === 'function')
            ? createActualTimeControl({
                kind: 'grid',
                index: rowState.index,
                seconds: rowState.gridSeconds,
                label: rowState.normalizedLabel,
                disabled: rowState.gridDisabled,
            })
            : null;
        if (gridControl && rowState.isExtraLabel && gridControl.classList && typeof gridControl.classList.add === 'function') {
            gridControl.classList.add('actual-time-extra');
        }

        const assignControl = (typeof createActualTimeControl === 'function')
            ? createActualTimeControl({
                kind: 'assign',
                index: rowState.index,
                seconds: rowState.safeSeconds,
                label: rowState.normalizedLabel,
                disabled: rowState.assignDisabled,
            })
            : null;

        const actions = documentRef.createElement('div');
        actions.className = 'actual-row-actions';

        const upBtn = documentRef.createElement('button');
        upBtn.type = 'button';
        upBtn.className = 'sub-activity-action-btn sub-activity-action-compact actual-move-btn';
        upBtn.dataset.direction = 'up';
        upBtn.textContent = rowState.moveUpText;
        upBtn.disabled = rowState.moveUpDisabled;

        const downBtn = documentRef.createElement('button');
        downBtn.type = 'button';
        downBtn.className = 'sub-activity-action-btn sub-activity-action-compact actual-move-btn';
        downBtn.dataset.direction = 'down';
        downBtn.textContent = rowState.moveDownText;
        downBtn.disabled = rowState.moveDownDisabled;

        const removeBtn = documentRef.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'actual-remove-btn';
        removeBtn.textContent = rowState.removeText;
        removeBtn.disabled = rowState.removeDisabled;

        actions.appendChild(upBtn);
        actions.appendChild(downBtn);
        actions.appendChild(removeBtn);

        row.appendChild(labelButton);
        if (gridControl) row.appendChild(gridControl);
        if (assignControl) row.appendChild(assignControl);
        row.appendChild(actions);

        return row;
    }

    function createActualActivitiesEmptyState(options = {}) {
        const documentRef = options.document;
        const strings = resolveStrings(options.strings);
        if (!documentRef || typeof documentRef.createElement !== 'function') return null;

        const empty = documentRef.createElement('div');
        empty.className = 'sub-activities-empty';
        empty.textContent = strings.emptyState;
        return empty;
    }

    return Object.freeze({
        buildActualActivityRowState,
        buildActualActivityRowStates,
        createActualActivityRowElement,
        createActualActivitiesEmptyState,
    });
});
