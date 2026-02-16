(function attachTimeTrackerCore(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        const existing = (root.TimeTrackerCore && typeof root.TimeTrackerCore === 'object')
            ? root.TimeTrackerCore
            : {};
        root.TimeTrackerCore = Object.assign(existing, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildTimeTrackerCore() {
    const TIME_SLOT_LABELS = Object.freeze(
        Array.from({ length: 20 }, (_, index) => String(index + 4)).concat(['00', '1', '2', '3'])
    );

    function createEmptySlot(timeLabel) {
        return {
            time: String(timeLabel),
            planned: '',
            actual: '',
            planActivities: [],
            planTitle: '',
            planTitleBandOn: false,
            timer: { running: false, elapsed: 0, startTime: null, method: 'manual' },
            activityLog: {
                title: '',
                details: '',
                subActivities: [],
                titleBandOn: false,
                actualGridUnits: [],
                actualExtraGridUnits: [],
                actualOverride: false,
            },
        };
    }

    function createEmptyTimeSlots() {
        return TIME_SLOT_LABELS.map((label) => createEmptySlot(label));
    }

    function formatSlotTimeLabel(rawHour) {
        const hour = parseInt(String(rawHour), 10);
        if (!Number.isFinite(hour)) return String(rawHour || '');
        return String(hour).padStart(2, '0');
    }

    function applyDurationNormalization(normalizeDurationStep, seconds) {
        if (!Number.isFinite(seconds)) return null;
        if (typeof normalizeDurationStep === 'function') {
            try {
                return normalizeDurationStep(seconds);
            } catch (_) {
                return Math.max(0, Math.floor(seconds));
            }
        }
        return Math.max(0, Math.floor(seconds));
    }

    function parseDurationFromText(text, normalizeDurationStep) {
        if (!text || typeof text !== 'string') return null;
        const t = text.trim();

        try {
            const all = Array.from(t.matchAll(/(\d{1,2}):(\d{2})(?::(\d{2}))?/g));
            if (all.length) {
                const m = all[all.length - 1];
                const h = parseInt(m[1] || '0', 10);
                const mm = parseInt(m[2] || '0', 10);
                const ss = parseInt(m[3] || '0', 10) || 0;
                if (mm < 60 && ss < 60) {
                    return applyDurationNormalization(normalizeDurationStep, h * 3600 + mm * 60 + ss);
                }
            }
        } catch (_) {}

        let H = null;
        let M = null;
        let S = null;

        try {
            for (const m of t.matchAll(/(\d+)\s*(시간|h|hr|hrs)/gi)) {
                H = parseInt(m[1], 10);
            }
            for (const m of t.matchAll(/(\d+)\s*(분|m|min|mins)/gi)) {
                M = parseInt(m[1], 10);
            }
            for (const m of t.matchAll(/(\d+)\s*(초|s|sec|secs)/gi)) {
                S = parseInt(m[1], 10);
            }
        } catch (_) {}

        if (H != null || M != null || S != null) {
            const hh = H || 0;
            const mm = M || 0;
            const ss = S || 0;
            return applyDurationNormalization(normalizeDurationStep, hh * 3600 + mm * 60 + ss);
        }

        const onlyMin = Array.from(t.matchAll(/(\d+)\s*(분|m|min)/gi)).pop();
        if (onlyMin) {
            return applyDurationNormalization(normalizeDurationStep, parseInt(onlyMin[1], 10) * 60);
        }

        const onlySec = Array.from(t.matchAll(/(\d+)\s*(초|s|sec)/gi)).pop();
        if (onlySec) {
            return applyDurationNormalization(normalizeDurationStep, parseInt(onlySec[1], 10));
        }

        return null;
    }

    return Object.freeze({
        TIME_SLOT_LABELS,
        createEmptyTimeSlots,
        formatSlotTimeLabel,
        parseDurationFromText,
    });
});
