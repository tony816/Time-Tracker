(function bootstrapTimeTrackerApp() {
    let bootstrapRetryTimer = null;

    function injectAnimationKeyframes() {
        if (!document || !document.head) return;
        if (document.getElementById('tt-animation-keyframes')) return;

        const style = document.createElement('style');
        style.id = 'tt-animation-keyframes';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }

            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    function initTracker() {
        if (window.tracker) return true;
        if (typeof window.TimeTracker !== 'function') {
            console.error('[bootstrap] TimeTracker class is not available.');
            scheduleBootstrapRetry(200);
            return false;
        }
        window.tracker = new window.TimeTracker();
        return true;
    }

    function scheduleBootstrapRetry(delayMs) {
        if (window.tracker) return;
        if (bootstrapRetryTimer) {
            clearTimeout(bootstrapRetryTimer);
        }
        bootstrapRetryTimer = window.setTimeout(() => {
            bootstrapRetryTimer = null;
            initTracker();
        }, delayMs);
    }

    injectAnimationKeyframes();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTracker, { once: true });
    } else {
        initTracker();
    }

    window.addEventListener('load', () => {
        if (!window.tracker) {
            initTracker();
        }
    }, { once: true });
})();
