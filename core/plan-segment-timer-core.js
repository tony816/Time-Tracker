(function attachPlanSegmentTimerCore(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        const existing = (root.TimeTrackerPlanSegmentTimerCore && typeof root.TimeTrackerPlanSegmentTimerCore === 'object')
            ? root.TimeTrackerPlanSegmentTimerCore
            : {};
        root.TimeTrackerPlanSegmentTimerCore = Object.assign(existing, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildPlanSegmentTimerCore() {
    function normalizeSegmentTimer(rawTimer = {}) {
        const timer = rawTimer && typeof rawTimer === 'object' ? rawTimer : {};
        const running = Boolean(timer.running) || String(timer.status || '') === 'running';
        let status = String(timer.status || '').trim();
        if (status !== 'idle' && status !== 'running' && status !== 'paused') {
            status = running ? 'running' : 'idle';
        }
        if (status === 'running' && !running) {
            status = 'running';
        }

        const elapsedSource = Number.isFinite(timer.elapsedSeconds)
            ? timer.elapsedSeconds
            : (Number.isFinite(timer.elapsed) ? timer.elapsed : 0);
        const startedAtSource = Number.isFinite(timer.startedAt)
            ? timer.startedAt
            : (Number.isFinite(timer.startTime) ? timer.startTime : null);

        return {
            status,
            running: status === 'running',
            elapsedSeconds: Math.max(0, Math.floor(elapsedSource || 0)),
            startedAt: startedAtSource == null ? null : Math.floor(startedAtSource),
            lastPausedAt: Number.isFinite(timer.lastPausedAt) ? Math.floor(timer.lastPausedAt) : null,
        };
    }

    function getLiveElapsedSeconds(timer, nowMs = Date.now()) {
        const normalized = normalizeSegmentTimer(timer);
        if (normalized.status !== 'running' || !Number.isFinite(normalized.startedAt)) {
            return normalized.elapsedSeconds;
        }
        return normalized.elapsedSeconds + Math.max(0, Math.floor((nowMs - normalized.startedAt) / 1000));
    }

    function displayMinutes(seconds) {
        if (!Number.isFinite(seconds) || seconds <= 0) return 0;
        return Math.floor(seconds / 60);
    }

    function formatPlannedMinutes(plannedSeconds) {
        const minutes = displayMinutes(plannedSeconds);
        return `${minutes}m`;
    }

    function formatElapsedForSegment(timer, nowMs = Date.now()) {
        const normalized = normalizeSegmentTimer(timer);
        const elapsed = getLiveElapsedSeconds(normalized, nowMs);
        if (normalized.status === 'running') {
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            return `${minutes}:${String(seconds).padStart(2, '0')}`;
        }
        return `${displayMinutes(elapsed)}m`;
    }

    function formatSegmentTimerText(timer, plannedSeconds, nowMs = Date.now()) {
        return `${formatElapsedForSegment(timer, nowMs)} / ${formatPlannedMinutes(plannedSeconds)}`;
    }

    function getSegmentTimerIcon(timer) {
        const status = normalizeSegmentTimer(timer).status;
        if (status === 'running') return '❚❚';
        if (status === 'paused') return '▶';
        return '⏱';
    }

    function getSegmentTimerAction(timer) {
        const status = normalizeSegmentTimer(timer).status;
        if (status === 'running') return 'pause';
        if (status === 'paused') return 'resume';
        return 'start';
    }

    function getSegmentTimeTone(segment = {}, nowMs = Date.now()) {
        const plannedSeconds = Number.isFinite(segment.plannedSeconds) ? Math.max(0, Math.floor(segment.plannedSeconds)) : 0;
        const elapsedSeconds = segment.timer && segment.timer.status === 'running'
            ? getLiveElapsedSeconds(segment.timer, nowMs)
            : (Number.isFinite(segment.elapsedSeconds)
                ? Math.max(0, Math.floor(segment.elapsedSeconds))
                : getLiveElapsedSeconds(segment.timer, nowMs));
        const elapsedMinutes = displayMinutes(elapsedSeconds);
        const plannedMinutes = displayMinutes(plannedSeconds);
        if (plannedMinutes <= 0 || elapsedMinutes < plannedMinutes) return 'under';
        if (elapsedMinutes === plannedMinutes) return 'match';
        return 'over';
    }

    function buildPlanSegmentViewModel(segment = {}, nowMs = Date.now()) {
        const timer = normalizeSegmentTimer(segment.timer || {});
        const plannedSeconds = Number.isFinite(segment.plannedSeconds)
            ? Math.max(0, Math.floor(segment.plannedSeconds))
            : 0;
        const id = String(segment.id || '').trim();
        const title = String(segment.title || '').trim();

        return {
            id,
            title,
            plannedSeconds,
            timer: {
                status: timer.status,
                elapsedSeconds: timer.elapsedSeconds,
                startedAt: timer.startedAt,
                lastPausedAt: timer.lastPausedAt,
            },
            display: {
                icon: getSegmentTimerIcon(timer),
                action: getSegmentTimerAction(timer),
                timeText: formatSegmentTimerText(timer, plannedSeconds, nowMs),
                tone: getSegmentTimeTone({ timer, plannedSeconds }, nowMs),
            },
        };
    }

    return Object.freeze({
        normalizeSegmentTimer,
        getLiveElapsedSeconds,
        formatPlannedMinutes,
        formatElapsedForSegment,
        formatSegmentTimerText,
        getSegmentTimerIcon,
        getSegmentTimerAction,
        getSegmentTimeTone,
        buildPlanSegmentViewModel,
    });
});
