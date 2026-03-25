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

        const display = (kind === 'actual') ? documentRef.createElement('input') : documentRef.createElement('div');
        if (kind === 'actual') {
            display.type = 'text';
            display.inputMode = 'numeric';
            display.autocomplete = 'off';
            display.placeholder = '\uBD84';
            display.className = 'spinner-display actual-duration-input';
            display.value = formatSpinnerValue(kind, seconds);
            display.setAttribute('aria-label', '\uBD84 \uC785\uB825');
        } else {
            display.className = 'spinner-display';
            display.textContent = formatSpinnerValue(kind, seconds);
        }

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

    function createActualTimeControl(options = {}) {
        const documentRef = options.document;
        if (!documentRef || typeof documentRef.createElement !== 'function') return null;

        const kind = options.kind;
        const index = options.index;
        const seconds = Number.isFinite(options.seconds) ? options.seconds : 0;
        const label = options.label;
        const disabled = options.disabled === true;
        const formatSecondsForInput = (typeof options.formatSecondsForInput === 'function')
            ? options.formatSecondsForInput
            : ((value) => String(value || 0));

        const control = documentRef.createElement('div');
        control.className = `actual-time-control actual-time-${kind}`;
        control.dataset.kind = kind;
        control.dataset.index = String(index);
        if (label) control.dataset.label = label;
        if (disabled) control.classList.add('is-disabled');

        const caption = documentRef.createElement('div');
        caption.className = 'actual-time-caption';
        caption.textContent = kind === 'grid' ? '\uAE30\uB85D' : '\uBC30\uC815';

        const upBtn = documentRef.createElement('button');
        upBtn.type = 'button';
        upBtn.className = 'actual-time-btn actual-time-up';
        upBtn.dataset.kind = kind;
        upBtn.dataset.direction = 'up';
        upBtn.dataset.index = String(index);
        upBtn.textContent = '\u25B2';

        const input = documentRef.createElement('input');
        input.type = 'text';
        input.inputMode = 'numeric';
        input.autocomplete = 'off';
        input.className = `actual-time-input actual-${kind}-input`;
        input.dataset.kind = kind;
        input.dataset.index = String(index);
        input.value = formatSecondsForInput(seconds);
        input.readOnly = true;
        input.setAttribute('aria-label', kind === 'grid' ? '\uAE30\uB85D \uC2DC\uAC04' : '\uBC30\uC815 \uC2DC\uAC04');

        const downBtn = documentRef.createElement('button');
        downBtn.type = 'button';
        downBtn.className = 'actual-time-btn actual-time-down';
        downBtn.dataset.kind = kind;
        downBtn.dataset.direction = 'down';
        downBtn.dataset.index = String(index);
        downBtn.textContent = '\u25BC';

        if (disabled) {
            input.disabled = true;
            upBtn.disabled = true;
            downBtn.disabled = true;
        }

        control.appendChild(caption);
        control.appendChild(upBtn);
        control.appendChild(input);
        control.appendChild(downBtn);
        return control;
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
        createActualTimeControl,
        updateSpinnerDisplay,
    });
});
