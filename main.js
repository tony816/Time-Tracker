(function bootstrapTimeTrackerApp() {
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
        if (window.tracker) return;
        if (typeof window.TimeTracker !== 'function') {
            console.error('[bootstrap] TimeTracker class is not available.');
            return;
        }
        window.tracker = new window.TimeTracker();
    }

    injectAnimationKeyframes();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTracker, { once: true });
    } else {
        initTracker();
    }
})();
