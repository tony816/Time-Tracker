(function attachTimeTrackerTimeControlRenderer(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        const existing = (root.TimeTrackerTimeControlRenderer && typeof root.TimeTrackerTimeControlRenderer === 'object')
            ? root.TimeTrackerTimeControlRenderer
            : {};
        root.TimeTrackerTimeControlRenderer = Object.assign(existing, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildTimeTrackerTimeControlRenderer() {
    function createDurationSpinner(options = {}) {
        const documentRef = options.document;
        if (!documentRef || typeof documentRef.createElement !== 'function') return null;

        const kind = options.kind;
        const index = options.index;
        const seconds = Number.isFinite(options.seconds) ? Math.max(0, Math.floor(options.seconds)) : 0;
        const formatSpinnerValue = (typeof options.formatSpinnerValue === 'function')
            ? options.formatSpinnerValue
            : ((_, value) => String(value || 0));

        const spinner = documentRef.createElement('div');
        spinner.className = 'time-spinner';
        spinner.dataset.kind = kind;
        spinner.dataset.index = String(index);
        spinner.dataset.seconds = String(seconds);

        const display = documentRef.createElement('div');
        display.className = 'spinner-display';
        display.textContent = formatSpinnerValue(kind, seconds);

        const controls = documentRef.createElement('div');
        controls.className = 'spinner-controls';

        const upBtn = documentRef.createElement('button');
        upBtn.type = 'button';
        upBtn.className = 'spinner-btn spinner-up';
        upBtn.dataset.direction = 'up';
        upBtn.dataset.kind = kind;
        upBtn.dataset.index = String(index);
        upBtn.textContent = '\u25B2';

        const downBtn = documentRef.createElement('button');
        downBtn.type = 'button';
        downBtn.className = 'spinner-btn spinner-down';
        downBtn.dataset.direction = 'down';
        downBtn.dataset.kind = kind;
        downBtn.dataset.index = String(index);
        downBtn.textContent = '\u25BC';

        controls.appendChild(upBtn);
        controls.appendChild(downBtn);
        spinner.appendChild(display);
        spinner.appendChild(controls);

        return spinner;
    }

    function updateSpinnerDisplay(options = {}) {
        const spinner = options.spinner;
        if (!spinner) return null;

        const safeSeconds = Number.isFinite(options.seconds) ? Math.max(0, Math.floor(options.seconds)) : 0;
        const normalizeDurationStep = (typeof options.normalizeDurationStep === 'function')
            ? options.normalizeDurationStep
            : ((value) => value);
        const adjusted = normalizeDurationStep(safeSeconds) || 0;
        const formatSpinnerValue = (typeof options.formatSpinnerValue === 'function')
            ? options.formatSpinnerValue
            : ((_, value) => String(value || 0));

        spinner.dataset.seconds = String(adjusted);
        const display = spinner.querySelector ? spinner.querySelector('.spinner-display') : null;
        if (display) {
            const kind = spinner.dataset.kind;
            const formatted = formatSpinnerValue(kind, adjusted);
            if (display.tagName === 'INPUT') {
                display.value = formatted;
            } else {
                display.textContent = formatted;
            }
        }
        if (typeof options.updateSpinnerState === 'function') {
            options.updateSpinnerState(spinner);
        }
        return spinner;
    }

    return Object.freeze({
        createDurationSpinner,
        updateSpinnerDisplay,
    });
});
