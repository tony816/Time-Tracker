(function attachTimeTrackerInlinePlanDropdownController(root, factory) {
    const api = factory(root);

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        const existing = (root.TimeTrackerInlinePlanDropdownController && typeof root.TimeTrackerInlinePlanDropdownController === 'object')
            ? root.TimeTrackerInlinePlanDropdownController
            : {};
        root.TimeTrackerInlinePlanDropdownController = Object.assign(existing, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildTimeTrackerInlinePlanDropdownController(root) {
function getControllerStateAccess() {
        return (root && root.TimeTrackerControllerStateAccess && typeof root.TimeTrackerControllerStateAccess === 'object')
            ? root.TimeTrackerControllerStateAccess
            : null;
    }

function getInlinePlanTargetState() {
        const access = getControllerStateAccess();
        if (access && typeof access.getInlinePlanTarget === 'function') {
            return access.getInlinePlanTarget.call(this);
        }
        return this.inlinePlanTarget || null;
    }

function getInlinePlanAnchorState() {
        const access = getControllerStateAccess();
        if (access && typeof access.getInlinePlanAnchor === 'function') {
            return access.getInlinePlanAnchor.call(this);
        }
        const target = getInlinePlanTargetState.call(this);
        return target && target.anchor ? target.anchor : null;
    }

function setInlinePlanAnchorState(anchor) {
        const access = getControllerStateAccess();
        if (access && typeof access.setInlinePlanAnchor === 'function') {
            return access.setInlinePlanAnchor.call(this, anchor);
        }
        const target = getInlinePlanTargetState.call(this);
        if (!target) return null;
        target.anchor = anchor || null;
        return target.anchor;
    }

function setInlinePlanTargetState(target) {
        const access = getControllerStateAccess();
        if (access && typeof access.setInlinePlanTarget === 'function') {
            return access.setInlinePlanTarget.call(this, target);
        }
        this.inlinePlanTarget = target && typeof target === 'object' ? target : null;
        return this.inlinePlanTarget;
    }

function clearInlinePlanTargetState() {
        const access = getControllerStateAccess();
        if (access && typeof access.clearInlinePlanTarget === 'function') {
            return access.clearInlinePlanTarget.call(this);
        }
        this.inlinePlanTarget = null;
        this.inlinePlanAnchor = null;
        return null;
    }

function clearPlannedSelectionForMobileSheetDismiss() {
        const dropdown = this.inlinePlanDropdown;
        const isMobileSheet = Boolean(
            dropdown
            && dropdown.classList
            && dropdown.classList.contains('inline-plan-dropdown-sheet')
        );
        if (!isMobileSheet) return;
        if (!this.selectedPlannedFields || this.selectedPlannedFields.size < 1) return;
        if (typeof this.clearSelection === 'function') {
            this.clearSelection('planned');
        }
    }

function isInlinePlanInternalScrollTarget(ctx, target) {
        if (!ctx || !target) return false;
        const dropdown = ctx.inlinePlanDropdown || null;
        if (dropdown && (target === dropdown || nodeContains(dropdown, target))) return true;
        const childPopover = ctx.inlinePlanChildPopoverLayer || null;
        if (childPopover && (target === childPopover || nodeContains(childPopover, target))) return true;
        return false;
    }

function buildPlannedActivityOptions(extraLabels = []) {
        const grouped = { local: [], notion: [] };
        const seen = new Set();
        const notionUIVisible = this.isNotionUIVisible();

        (this.plannedActivities || []).forEach((item) => {
            if (!item) return;
            const label = this.normalizeActivityText ? this.normalizeActivityText(item.label || '') : String(item.label || '').trim();
            if (!label || seen.has(label)) return;
            const source = item.source === 'notion' ? 'notion' : 'local';
            if (!notionUIVisible && source === 'notion') return;
            seen.add(label);
            const priorityRank = this.normalizePriorityRankValue(item.priorityRank);
            const recommendedSeconds = Number.isFinite(item.recommendedSeconds) ? Math.max(0, Number(item.recommendedSeconds)) : null;
            grouped[source].push({ label, source, priorityRank, recommendedSeconds });
        });

        (extraLabels || []).forEach((raw) => {
            const label = this.normalizeActivityText ? this.normalizeActivityText(raw) : String(raw || '').trim();
            if (!label || seen.has(label)) return;
            seen.add(label);
            grouped.local.push({ label, source: 'local', priorityRank: null, recommendedSeconds: null });
        });

        return grouped;
    }

function groupActivityBoard(entries) {
        if (typeof this.groupActivityCatalogEntries === 'function') {
            return this.groupActivityCatalogEntries(entries);
        }
        const safe = Array.isArray(entries) ? entries.slice() : [];
        const byId = new Map();
        const byParentId = new Map();
        const topLevelIdCounts = new Map();
        const topLevelItems = safe.filter((item) => item && !item.parentId);
        topLevelItems.forEach((item) => {
            const id = String(item.id || '').trim();
            if (!id) return;
            topLevelIdCounts.set(id, (topLevelIdCounts.get(id) || 0) + 1);
        });
        safe.forEach((item) => {
            if (!item || typeof item !== 'object') return;
            const id = String(item.id || item.label || '').trim();
            if (id) byId.set(id, item);
            const parentId = String(item.parentId || '').trim();
            if (parentId && (topLevelIdCounts.get(parentId) || 0) > 1) return;
            const key = parentId || '';
            if (!byParentId.has(key)) byParentId.set(key, []);
            byParentId.get(key).push(item);
        });
        const topLevel = topLevelItems;
        return {
            items: safe,
            byId,
            byParentId,
            pinned: topLevel.filter((item) => item && item.pinned && !item.archived),
            parents: topLevel.slice(),
            children: safe.filter((item) => item && item.parentId && (topLevelIdCounts.get(String(item.parentId || '').trim()) || 0) <= 1),
            topLevel,
        };
    }

function getHangulInitialSearchKey(text) {
        const value = this.normalizeActivityText ? this.normalizeActivityText(text || '') : String(text || '').trim();
        if (!value) return '';
        const initials = [];
        const CHOSEONG = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
        for (const char of value) {
            const code = char.charCodeAt(0);
            if (code >= 0xac00 && code <= 0xd7a3) {
                const index = Math.floor((code - 0xac00) / 588);
                initials.push(CHOSEONG[index] || char);
            } else if (/\s/.test(char)) {
                continue;
            } else {
                initials.push(char.toLowerCase());
            }
        }
        return initials.join('');
    }

function scoreInlinePlanSearchMatch(label, query) {
        const normalizedLabel = this.normalizeActivityText ? this.normalizeActivityText(label || '') : String(label || '').trim();
        const normalizedQuery = this.normalizeActivityText ? this.normalizeActivityText(query || '') : String(query || '').trim();
        if (!normalizedQuery) return 0;
        const labelLower = normalizedLabel.toLowerCase();
        const queryLower = normalizedQuery.toLowerCase();
        if (labelLower.startsWith(queryLower)) return 4000 - normalizedLabel.length;
        const initials = this.getHangulInitialSearchKey(normalizedLabel);
        if (initials && initials.startsWith(queryLower)) return 3000 - normalizedLabel.length;
        return Number.NEGATIVE_INFINITY;
    }

function filterInlinePlanSearchItems(items, query) {
        const safeItems = Array.isArray(items) ? items.slice() : [];
        const normalizedQuery = this.normalizeActivityText ? this.normalizeActivityText(query || '') : String(query || '').trim();
        if (!normalizedQuery) return safeItems;
        return safeItems
            .map((item, index) => ({ item, index, score: this.scoreInlinePlanSearchMatch(item && item.label, normalizedQuery) }))
            .filter((entry) => Number.isFinite(entry.score))
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                return a.index - b.index;
            })
            .map((entry) => entry.item);
    }

function resolveInlinePlanAnchor(anchorEl, fallbackIndex = null) {
        if (anchorEl && anchorEl.isConnected) return anchorEl;
        const target = getInlinePlanTargetState.call(this);
        const index = Number.isInteger(fallbackIndex)
            ? fallbackIndex
            : (target && Number.isInteger(target.startIndex) ? target.startIndex : null);
        if (!Number.isInteger(index)) return anchorEl || null;
        return document.querySelector(`[data-index="${index}"] .planned-input`)
            || document.querySelector(`[data-index="${index}"]`);
    }

function canInlineWheelScroll(targetEl, boundaryEl, deltaY) {
        if (!boundaryEl || !targetEl || !Number.isFinite(deltaY) || deltaY === 0) return false;
        let el = targetEl.nodeType === 1 ? targetEl : targetEl.parentElement;
        while (el && boundaryEl.contains(el)) {
            if (el instanceof HTMLElement) {
                const style = window.getComputedStyle(el);
                const overflowY = style ? style.overflowY : '';
                const scrollable = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
                if (scrollable && (el.scrollHeight - el.clientHeight) > 1) {
                    const maxTop = el.scrollHeight - el.clientHeight;
                    const top = el.scrollTop;
                    if (deltaY > 0 && top < (maxTop - 1)) return true;
                    if (deltaY < 0 && top > 1) return true;
                }
            }
            if (el === boundaryEl) break;
            el = el.parentElement;
        }
        return false;
    }

function handleInlinePlanWheel(event) {
        const dropdown = this.inlinePlanDropdown;
        if (!dropdown) return;
        const deltaY = Number(event.deltaY) || 0;
        if (deltaY === 0) return;
        if (this.canInlineWheelScroll(event.target, dropdown, deltaY)) return;
        event.preventDefault();
    }

function isInlinePlanMobileInputContext() {
        try {
            if (typeof window === 'undefined') return false;
            const hasMatchMedia = typeof window.matchMedia === 'function';
            const coarsePointer = hasMatchMedia
                ? window.matchMedia('(hover: none), (pointer: coarse)').matches
                : false;
            const narrowViewport = Number.isFinite(window.innerWidth) ? window.innerWidth <= 768 : false;
            return coarsePointer || narrowViewport;
        } catch (_) {
            return false;
        }
    }

function shouldAutofocusInlinePlanInput() {
        return !this.isInlinePlanMobileInputContext();
    }

function setupInlinePlanSheetTouchDismiss(dropdown) {
        if (!dropdown || !dropdown.classList.contains('inline-plan-dropdown-sheet')) return;
        this.cleanupInlinePlanSheetTouchDismiss();
        const supportsPointerEvents = typeof window !== 'undefined' && typeof window.PointerEvent === 'function';
        const DISMISS_THRESHOLD_PX = 45;
        const MAX_TRANSLATE_PX = 240;
        const state = {
            startY: 0,
            lastY: 0,
            dragging: false,
            armed: false,
            pointerId: null,
            closeTimer: null,
            activeSource: null,
            captureTarget: null
        };
        const getPointY = (event) => {
            if (!event) return 0;
            if (event.touches && event.touches.length) return event.touches[0].clientY;
            if (event.changedTouches && event.changedTouches.length) return event.changedTouches[0].clientY;
            return Number(event.clientY) || 0;
        };
        const getEventSource = (event) => {
            const type = String(event && event.type || '');
            if (type.startsWith('pointer')) return 'pointer';
            if (type.startsWith('touch')) return 'touch';
            return 'unknown';
        };
        const shouldArm = (event) => {
            if (!this.inlinePlanDropdown || this.inlinePlanDropdown !== dropdown) return false;
            const scrollTop = dropdown.scrollTop || 0;
            if (scrollTop > 2) return false;
            const target = event && event.target ? event.target : null;
            if (!target || typeof target.closest !== 'function') return false;
            const interactive = target.closest(
                'input, textarea, button, select, .inline-plan-options, .activity-chip-board, .inline-plan-subsection, .inline-plan-sub-board, .inline-plan-input-row, .inline-plan-child-actions'
            );
            if (interactive) return false;
            return Boolean(
                target.closest('.inline-plan-sheet-drag-handle')
                || target.closest('.inline-plan-dropdown-sheet')
            );
        };
        const start = (event) => {
            const source = getEventSource(event);
            if (supportsPointerEvents && source === 'touch') return;
            if (!supportsPointerEvents && source === 'pointer') return;
            if (!shouldArm(event)) return;
            if (state.closeTimer) {
                clearTimeout(state.closeTimer);
                state.closeTimer = null;
            }
            state.startY = getPointY(event);
            state.lastY = state.startY;
            state.dragging = false;
            state.armed = true;
            state.pointerId = Number.isFinite(event.pointerId) ? event.pointerId : null;
            state.activeSource = source;
            dropdown.style.transition = 'transform 0.18s ease';
            if (source === 'pointer' && event.target && typeof event.target.setPointerCapture === 'function' && Number.isFinite(event.pointerId)) {
                try {
                    event.target.setPointerCapture(event.pointerId);
                    state.captureTarget = event.target;
                } catch (_) {}
            }
        };
        const move = (event) => {
            if (!state.armed) return;
            const source = getEventSource(event);
            if (state.activeSource && source !== 'unknown' && source !== state.activeSource) return;
            if (supportsPointerEvents && source === 'touch') return;
            if (!supportsPointerEvents && source === 'pointer') return;
            if (state.pointerId !== null && Number.isFinite(event.pointerId) && event.pointerId !== state.pointerId) return;
            const currentY = getPointY(event);
            const deltaY = currentY - state.startY;
            state.lastY = currentY;
            if (deltaY <= 0) {
                if (state.dragging) {
                    dropdown.style.transform = 'translateY(0px)';
                }
                return;
            }
            state.dragging = true;
            dropdown.style.transform = `translateY(${Math.min(deltaY, MAX_TRANSLATE_PX)}px)`;
            if (event.cancelable) event.preventDefault();
        };
        const end = () => {
            if (!state.armed) return;
            if (state.captureTarget && state.pointerId !== null && typeof state.captureTarget.releasePointerCapture === 'function') {
                try { state.captureTarget.releasePointerCapture(state.pointerId); } catch (_) {}
            }
            state.captureTarget = null;
            const deltaY = state.lastY - state.startY;
            dropdown.style.transition = 'transform 0.18s ease';
            if (state.dragging && deltaY >= DISMISS_THRESHOLD_PX) {
                dropdown.style.transform = 'translateY(100%)';
                state.closeTimer = setTimeout(() => {
                    state.closeTimer = null;
                    if (this.inlinePlanDropdown === dropdown) this.closeInlinePlanDropdown();
                }, 150);
            } else {
                dropdown.style.transform = 'translateY(0px)';
            }
            state.startY = 0;
            state.lastY = 0;
            state.dragging = false;
            state.armed = false;
            state.pointerId = null;
            state.activeSource = null;
        };
        dropdown.addEventListener('touchstart', start, { passive: true });
        dropdown.addEventListener('touchmove', move, { passive: false });
        dropdown.addEventListener('touchend', end);
        dropdown.addEventListener('touchcancel', end);
        dropdown.addEventListener('pointerdown', start, { passive: true });
        dropdown.addEventListener('pointermove', move);
        dropdown.addEventListener('pointerup', end);
        dropdown.addEventListener('pointercancel', end);
        this.inlinePlanSheetTouchState = state;
        this.inlinePlanSheetTouchHandlers = { start, move, end, dropdown };
    }

function cleanupInlinePlanSheetTouchDismiss() {
        const handlers = this.inlinePlanSheetTouchHandlers;
        if (!handlers || !handlers.dropdown) return;
        const { dropdown, start, move, end } = handlers;
        const state = this.inlinePlanSheetTouchState;
        if (state && state.closeTimer) {
            clearTimeout(state.closeTimer);
            state.closeTimer = null;
        }
        if (state && state.captureTarget && state.pointerId !== null && typeof state.captureTarget.releasePointerCapture === 'function') {
            try { state.captureTarget.releasePointerCapture(state.pointerId); } catch (_) {}
        }
        dropdown.removeEventListener('touchstart', start);
        dropdown.removeEventListener('touchmove', move);
        dropdown.removeEventListener('touchend', end);
        dropdown.removeEventListener('touchcancel', end);
        dropdown.removeEventListener('pointerdown', start);
        dropdown.removeEventListener('pointermove', move);
        dropdown.removeEventListener('pointerup', end);
        dropdown.removeEventListener('pointercancel', end);
        dropdown.style.transform = '';
        dropdown.style.transition = '';
        this.inlinePlanSheetTouchHandlers = null;
        this.inlinePlanSheetTouchState = null;
    }

function scheduleInlinePlanInputVisibilitySync(inputEl) {
        if (!inputEl || !this.inlinePlanDropdown) return;
        if (this.inlinePlanFocusSyncTimer) {
            clearTimeout(this.inlinePlanFocusSyncTimer);
            this.inlinePlanFocusSyncTimer = null;
        }

        const delay = this.isInlinePlanMobileInputContext() ? 140 : 0;
        this.inlinePlanFocusSyncTimer = setTimeout(() => {
            this.inlinePlanFocusSyncTimer = null;
            requestAnimationFrame(() => {
                this.ensureInlinePlanInputVisible(inputEl);
            });
        }, delay);
    }

function scheduleInlinePlanViewportSync() {
        if (!this.inlinePlanDropdown) return;

        const priorityAnchor = this.inlinePriorityMenuContext && this.inlinePriorityMenuContext.anchorEl;
        const inlineInput = this.inlinePlanDropdown.querySelector('.inline-plan-input');
        const inputFocused = Boolean(
            this.isInlinePlanMobileInputContext()
            && inlineInput
            && document.activeElement === inlineInput
        );

        const runSync = () => {
            if (!this.inlinePlanDropdown) return;
            const target = getInlinePlanTargetState.call(this);
            const currentAnchor = target
                ? this.resolveInlinePlanAnchor(
                    getInlinePlanAnchorState.call(this),
                    Number.isInteger(target.startIndex) ? target.startIndex : null
                )
                : null;
            if (target && currentAnchor) {
                setInlinePlanAnchorState.call(this, currentAnchor);
            }
            if (inputFocused && inlineInput) {
                this.ensureInlinePlanInputVisible(inlineInput);
            } else if (currentAnchor) {
                this.positionInlinePlanDropdown(currentAnchor);
            }
            if (
                this.inlinePlanDropdown
                && this.inlinePlanDropdown.classList
                && this.inlinePlanDropdown.classList.contains('inline-plan-dropdown-sheet')
                && this.inlinePlanSheetTargetEl
                && typeof this.scheduleInlinePlanSheetTargetViewportCorrection === 'function'
            ) {
                this.scheduleInlinePlanSheetTargetViewportCorrection(this.inlinePlanSheetTargetEl);
            }
            if (priorityAnchor) this.positionInlinePriorityMenu(priorityAnchor);
        };

        if (!inputFocused) {
            runSync();
            return;
        }

        if (this.inlinePlanViewportSyncTimer) {
            clearTimeout(this.inlinePlanViewportSyncTimer);
            this.inlinePlanViewportSyncTimer = null;
        }
        this.inlinePlanViewportSyncTimer = setTimeout(() => {
            this.inlinePlanViewportSyncTimer = null;
            runSync();
        }, 90);
    }

function getInlinePlanViewportMetrics() {
        const root = typeof window !== 'undefined' ? window : globalThis;
        const doc = typeof document !== 'undefined' ? document : { documentElement: {} };
        const docEl = doc.documentElement || {};
        const layoutScrollX = Number(root && root.scrollX) || Number(docEl.scrollLeft) || 0;
        const layoutScrollY = Number(root && root.scrollY) || Number(docEl.scrollTop) || 0;
        const vv = (root && root.visualViewport) ? root.visualViewport : null;
        const viewportLeft = vv ? (layoutScrollX + vv.offsetLeft) : layoutScrollX;
        const viewportTop = vv ? (layoutScrollY + vv.offsetTop) : layoutScrollY;
        const viewportWidth = vv ? vv.width : (Number(docEl.clientWidth) || Number(root && root.innerWidth) || 0);
        const viewportHeight = vv ? vv.height : (Number(docEl.clientHeight) || Number(root && root.innerHeight) || 0);

        return {
            left: viewportLeft,
            top: viewportTop,
            width: viewportWidth,
            height: viewportHeight,
            right: viewportLeft + viewportWidth,
            bottom: viewportTop + viewportHeight,
        };
    }

function measureInlinePlanPanel(panel, fallbackWidth = 0) {
        if (!panel) return { width: fallbackWidth, height: 0 };
        const rect = typeof panel.getBoundingClientRect === 'function'
            ? panel.getBoundingClientRect()
            : null;
        const width = Number.isFinite(rect && rect.width) && rect.width > 0
            ? Number(rect.width)
            : Math.max(Number(panel.offsetWidth) || 0, Number(panel.scrollWidth) || 0, Number(fallbackWidth) || 0);
        const height = Number.isFinite(rect && rect.height) && rect.height > 0
            ? Number(rect.height)
            : Math.max(Number(panel.offsetHeight) || 0, Number(panel.scrollHeight) || 0);
        return { width, height };
    }

function layoutInlinePlanAnchoredPanel(panel, anchorRect, options = {}) {
        if (!panel || !anchorRect) return null;
        let viewport = this.getInlinePlanViewportMetrics
            ? this.getInlinePlanViewportMetrics()
            : getInlinePlanViewportMetrics.call(this);
        if ((!viewport || !Number(viewport.width) || !Number(viewport.height)) && options.fallbackViewport) {
            viewport = options.fallbackViewport;
        }
        const positionMode = options.positionMode === 'fixed' ? 'fixed' : 'absolute';
        const margin = Number.isFinite(options.margin) ? options.margin : 12;
        const gap = Number.isFinite(options.gap) ? options.gap : 6;
        const minHeight = Math.max(1, Number(options.minHeight) || 1);
        const preferredWidth = Number.isFinite(options.preferredWidth) ? options.preferredWidth : 420;
        const layoutViewport = positionMode === 'fixed'
            ? {
                left: 0,
                top: 0,
                width: viewport.width,
                height: viewport.height,
                right: viewport.width,
                bottom: viewport.height,
            }
            : viewport;
        const maxAllowedWidth = Math.max(1, layoutViewport.width - (margin * 2));
        const width = Math.max(
            1,
            Math.min(
                maxAllowedWidth,
                Math.max(Number(options.minWidth) || 1, preferredWidth)
            )
        );
        const normalizeRect = (rect) => {
            if (!rect) return null;
            const left = Number.isFinite(rect.left) ? Number(rect.left) : 0;
            const top = Number.isFinite(rect.top) ? Number(rect.top) : 0;
            const right = Number.isFinite(rect.right)
                ? Number(rect.right)
                : left + (Number(rect.width) || 0);
            const bottom = Number.isFinite(rect.bottom)
                ? Number(rect.bottom)
                : top + (Number(rect.height) || 0);
            const width = Math.max(0, right - left);
            const height = Math.max(0, bottom - top);
            return { left, top, right, bottom, width, height };
        };
        const sourceRect = normalizeRect(anchorRect);
        if (!sourceRect) return null;
        const rectLeft = sourceRect.left;
        const rectTop = sourceRect.top;
        const rectRight = sourceRect.right;
        const rectBottom = sourceRect.bottom;
        const anchorWidth = Math.max(0, rectRight - rectLeft);
        const root = typeof window !== 'undefined' ? window : globalThis;
        const docEl = typeof document !== 'undefined' && document.documentElement ? document.documentElement : {};
        const layoutScrollX = (root && Number(root.scrollX)) || Number(docEl.scrollLeft) || 0;
        const layoutScrollY = (root && Number(root.scrollY)) || Number(docEl.scrollTop) || 0;
        const anchorLeft = positionMode === 'fixed' ? rectLeft : layoutScrollX + rectLeft;
        const anchorTop = positionMode === 'fixed' ? rectTop : layoutScrollY + rectTop;
        const anchorBottom = positionMode === 'fixed' ? rectBottom : layoutScrollY + rectBottom;
        let left = options.align === 'center'
            ? anchorLeft + (anchorWidth / 2) - (width / 2)
            : anchorLeft;
        left = Math.max(layoutViewport.left + margin, Math.min(left, layoutViewport.right - width - margin));

        panel.style.width = `${Math.round(width)}px`;
        panel.style.minWidth = `${Math.round(width)}px`;
        panel.style.maxHeight = '';
        panel.style.visibility = 'hidden';
        panel.style.left = '0px';
        panel.style.top = '0px';

        const measured = measureInlinePlanPanel(panel, width);
        const naturalHeight = Math.max(1, measured.height || Number(options.fallbackHeight) || minHeight);
        const avoidRect = normalizeRect(options.avoidOverlapRect);
        const avoidTop = avoidRect
            ? (positionMode === 'fixed' ? avoidRect.top : layoutScrollY + avoidRect.top)
            : anchorTop;
        const avoidBottom = avoidRect
            ? (positionMode === 'fixed' ? avoidRect.bottom : layoutScrollY + avoidRect.bottom)
            : anchorBottom;
        const belowTop = Math.max(anchorBottom, avoidBottom) + gap;
        const aboveBottom = Math.min(anchorTop, avoidTop) - gap;
        const spaceBelow = Math.max(0, Math.floor(layoutViewport.bottom - belowTop - margin));
        const spaceAbove = Math.max(0, Math.floor(aboveBottom - layoutViewport.top - margin));
        const requiredHeight = Math.min(naturalHeight, minHeight);
        const preferAbove = options.prefer === 'above';
        const forceBelow = options.forceBelow === true;
        let placeAbove = false;
        if (!forceBelow) {
            if (preferAbove && spaceAbove >= requiredHeight) {
                placeAbove = true;
            } else if (spaceBelow < requiredHeight && spaceAbove > spaceBelow) {
                placeAbove = true;
            }
        }
        let available = placeAbove ? spaceAbove : spaceBelow;
        if (available < 1) {
            available = forceBelow
                ? 1
                : Math.max(1, layoutViewport.height - (margin * 2));
        }
        if (Number.isFinite(options.maxHeight) && options.maxHeight > 0) {
            available = Math.min(available, options.maxHeight);
        }
        const maxHeight = Math.max(1, Math.floor(available));
        const height = Math.min(naturalHeight, maxHeight);
        let top = placeAbove ? aboveBottom - height : belowTop;
        if (forceBelow) {
            const bottomLimit = layoutViewport.bottom - height - margin;
            top = bottomLimit >= belowTop ? Math.min(top, bottomLimit) : belowTop;
        } else {
            top = Math.max(layoutViewport.top + margin, Math.min(top, layoutViewport.bottom - height - margin));
        }

        panel.style.left = `${Math.round(left)}px`;
        panel.style.top = `${Math.round(top)}px`;
        panel.style.maxHeight = `${Math.round(maxHeight)}px`;
        panel.style.visibility = 'visible';
        return { left, top, width, maxHeight, placement: placeAbove ? 'above' : 'below' };
    }

function getInlinePlanMinimumInteractiveHeight(dropdown = this.inlinePlanDropdown) {
        if (!dropdown) return 0;
        const baseMin = this.isInlinePlanMobileInputContext() ? 168 : 120;
        const sections = [
            dropdown.querySelector('.inline-plan-tabs'),
            dropdown.querySelector('.inline-plan-input-row'),
            dropdown.querySelector('.inline-plan-options-head'),
            dropdown.querySelector('.inline-plan-options-list > li')
        ];
        const measured = sections.reduce((sum, el) => {
            if (!el) return sum;
            const rect = typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null;
            const height = rect && Number.isFinite(rect.height) && rect.height > 0
                ? rect.height
                : (el.offsetHeight || 0);
            return sum + Math.max(0, Math.ceil(height));
        }, 0);
        const buffer = this.isInlinePlanMobileInputContext() ? 18 : 12;
        return Math.max(baseMin, measured + buffer);
    }

function ensureInlinePlanInputVisible(inputEl) {
        if (!inputEl || !this.inlinePlanDropdown) return;
        const target = getInlinePlanTargetState.call(this);
        const currentAnchor = target
            ? this.resolveInlinePlanAnchor(
                getInlinePlanAnchorState.call(this),
                Number.isInteger(target.startIndex) ? target.startIndex : null
            )
            : null;
        if (!currentAnchor) return;
        if (target && getInlinePlanAnchorState.call(this) !== currentAnchor) {
            setInlinePlanAnchorState.call(this, currentAnchor);
        }
        this.positionInlinePlanDropdown(currentAnchor);
    }

function isInlinePlanInputFocused() {
        if (!this.inlinePlanDropdown || !this.isInlinePlanMobileInputContext()) return false;
        const inlineInput = this.inlinePlanDropdown.querySelector('.inline-plan-input');
        return Boolean(inlineInput && document.activeElement === inlineInput);
    }

function markInlinePlanInputIntent(durationMs = 420) {
        const now = Date.now();
        const windowMs = Math.max(120, Number(durationMs) || 0);
        this.inlinePlanInputIntentUntil = now + windowMs;
    }

function hasRecentInlinePlanInputIntent() {
        return Boolean(this.inlinePlanInputIntentUntil && Date.now() < this.inlinePlanInputIntentUntil);
    }

function getInlinePlanAnchorRect(anchor) {
        const rect = anchor && typeof anchor.getBoundingClientRect === 'function'
            ? anchor.getBoundingClientRect()
            : null;
        const rectHeight = rect && Number.isFinite(rect.height) ? rect.height : 0;
        if (!anchor || typeof anchor.querySelector !== 'function') return rect;
        const overlay = anchor.querySelector('.planned-merged-overlay')
            || anchor.querySelector('.merged-field');
        const overlayRect = overlay && typeof overlay.getBoundingClientRect === 'function'
            ? overlay.getBoundingClientRect()
            : null;
        const overlayHeight = overlayRect && Number.isFinite(overlayRect.height) ? overlayRect.height : 0;
        return overlayHeight > rectHeight ? overlayRect : rect;
    }

function getInlinePlanRangeAnchorRect(anchor, target = null) {
        if (target && target.mode === 'plan-segment-replace' && target.sourceRect) {
            return target.sourceRect;
        }
        const baseRect = getInlinePlanAnchorRect(anchor);
        const resolvedTarget = target || getInlinePlanTargetState.call(this);
        const rangeStart = Number.isInteger(resolvedTarget && resolvedTarget.rangeStart)
            ? resolvedTarget.rangeStart
            : Number.isInteger(resolvedTarget && resolvedTarget.startIndex)
                ? resolvedTarget.startIndex
                : null;
        const rangeEnd = Number.isInteger(resolvedTarget && resolvedTarget.rangeEnd)
            ? resolvedTarget.rangeEnd
            : Number.isInteger(resolvedTarget && resolvedTarget.endIndex)
                ? resolvedTarget.endIndex
                : rangeStart;
        const mergeKey = resolvedTarget && resolvedTarget.mergeKey;
        const isMergedRange = Boolean(mergeKey && Number.isInteger(rangeStart) && Number.isInteger(rangeEnd));
        if (!isMergedRange || typeof document === 'undefined' || typeof document.querySelector !== 'function') {
            return baseRect;
        }

        const start = Math.min(rangeStart, rangeEnd);
        const end = Math.max(rangeStart, rangeEnd);
        let rangeTop = null;
        let rangeBottom = null;
        for (let i = start; i <= end; i += 1) {
            const row = document.querySelector(`.time-entry[data-index="${i}"]`);
            if (!row || typeof row.getBoundingClientRect !== 'function') continue;
            const rowRect = row.getBoundingClientRect();
            if (!rowRect) continue;
            if (Number.isFinite(rowRect.top)) {
                rangeTop = rangeTop === null ? rowRect.top : Math.min(rangeTop, rowRect.top);
            }
            if (Number.isFinite(rowRect.bottom)) {
                rangeBottom = rangeBottom === null ? rowRect.bottom : Math.max(rangeBottom, rowRect.bottom);
            }
        }

        if (rangeTop === null || rangeBottom === null) {
            return baseRect;
        }

        const mergedRangeRect = {
            left: baseRect && Number.isFinite(baseRect.left) ? baseRect.left : 0,
            top: rangeTop,
            width: baseRect && Number.isFinite(baseRect.width) ? baseRect.width : 0,
            height: Math.max(0, rangeBottom - rangeTop),
            right: baseRect && Number.isFinite(baseRect.right) ? baseRect.right : 0,
            bottom: rangeBottom,
        };
        mergedRangeRect.right = mergedRangeRect.left + mergedRangeRect.width;
        return mergedRangeRect;
    }

function positionInlinePlanDropdown(anchorEl) {
        if (!this.inlinePlanDropdown) return;
        const dropdown = this.inlinePlanDropdown;
        if (dropdown.classList.contains('inline-plan-dropdown-sheet')) {
            dropdown.style.visibility = 'visible';
            dropdown.style.position = 'fixed';
            dropdown.style.left = '0px';
            dropdown.style.right = '0px';
            dropdown.style.top = 'auto';
            dropdown.style.bottom = '0px';
            dropdown.style.width = '100vw';
            dropdown.style.minWidth = '0px';
            dropdown.style.maxWidth = '100vw';
            dropdown.style.maxHeight = '82vh';
            if (this.positionInlinePlanChildPopover) {
                this.positionInlinePlanChildPopover(this.inlinePlanChildPopoverAnchorEl || anchorEl || null);
            }
            return;
        }
        const margin = 12;
        const gap = 6;
        const preferredWidth = 420;
        const inlineTarget = getInlinePlanTargetState.call(this);
        const requestedMinWidth = Number(inlineTarget && inlineTarget.anchorMinWidth);
        const expandedWidth = Number.isFinite(requestedMinWidth) && requestedMinWidth > preferredWidth
            ? requestedMinWidth
            : preferredWidth;
        const anchor = this.resolveInlinePlanAnchor(anchorEl);
        if (!anchor) return;
        const target = getInlinePlanTargetState.call(this);
        if (target && getInlinePlanAnchorState.call(this) !== anchor) {
            setInlinePlanAnchorState.call(this, anchor);
        }
        const rect = getInlinePlanRangeAnchorRect.call(this, anchor, target);
        if (!rect || (!rect.width && !rect.height)) return;
        const isSegmentReplacement = target?.mode === 'plan-segment-replace';
        const alignToCenter = isSegmentReplacement
            && target?.anchorAlign === 'center';
        const layoutAnchoredPanel = this.layoutInlinePlanAnchoredPanel || layoutInlinePlanAnchoredPanel;
        layoutAnchoredPanel.call(this, dropdown, rect, {
            margin,
            gap,
            positionMode: 'absolute',
            preferredWidth: expandedWidth,
            minWidth: Math.min(240, expandedWidth),
            minHeight: this.getInlinePlanMinimumInteractiveHeight(dropdown),
            align: alignToCenter ? 'center' : 'left',
            forceBelow: isSegmentReplacement,
            avoidOverlapRect: isSegmentReplacement ? rect : null,
        });
        if (this.positionInlinePlanChildPopover) {
            this.positionInlinePlanChildPopover(this.inlinePlanChildPopoverAnchorEl || anchorEl || null);
        }
    }

function getInlinePlanChildPopoverLayer() {
        if (this.inlinePlanChildPopoverLayer && this.inlinePlanChildPopoverLayer.parentNode) {
            return this.inlinePlanChildPopoverLayer;
        }
        if (typeof document === 'undefined' || !document.body || typeof document.createElement !== 'function') {
            return null;
        }
        const layer = document.createElement('div');
        layer.className = 'inline-plan-child-popover-layer';
        layer.hidden = true;
        document.body.appendChild(layer);
        this.inlinePlanChildPopoverLayer = layer;
        return layer;
    }

function getInlinePlanChildPopoverSection() {
        if (this.inlinePlanDropdown && typeof this.inlinePlanDropdown.querySelector === 'function') {
            const section = this.inlinePlanDropdown.querySelector('.inline-plan-subsection');
            if (section) return section;
        }
        if (this.inlinePlanChildPopoverLayer && typeof this.inlinePlanChildPopoverLayer.querySelector === 'function') {
            return this.inlinePlanChildPopoverLayer.querySelector('.inline-plan-subsection');
        }
        return null;
    }

function queryInlinePlanChildPopoverPart(section, dropdown, selector) {
        if (section && typeof section.querySelector === 'function') {
            const node = section.querySelector(selector);
            if (node) return node;
        }
        if (dropdown && typeof dropdown.querySelector === 'function') {
            return dropdown.querySelector(selector);
        }
        return null;
    }

function positionInlinePlanChildPopover(anchorEl = null) {
        if (!this.inlinePlanDropdown) return;
        const section = getInlinePlanChildPopoverSection.call(this);
        if (!section) return;
        const shouldShow = Boolean(
            this.modalPlanSectionOpen
            && String(this.modalPlanSectionOpenParentId || '').trim()
        );
        if (!shouldShow) {
            section.hidden = true;
            if (section.style) {
                section.style.visibility = 'hidden';
                if (typeof section.style.removeProperty === 'function') {
                    section.style.removeProperty('--inline-plan-subsection-notch-left');
                }
            }
            if (section.classList && typeof section.classList.remove === 'function') {
                section.classList.remove('inline-plan-subsection-anchored');
                section.classList.remove('inline-plan-subsection-flow');
            }
            if (this.inlinePlanDropdown.classList && typeof this.inlinePlanDropdown.classList.remove === 'function') {
                this.inlinePlanDropdown.classList.remove('inline-plan-child-popover-open');
            }
            if (this.inlinePlanChildPopoverLayer) this.inlinePlanChildPopoverLayer.hidden = true;
            return;
        }
        if (section.hidden) return;

        const resolvedAnchor = getOpenParentCaretAnchor.call(this)
            || (anchorEl && anchorEl.isConnected ? anchorEl : null)
            || (this.inlinePlanChildPopoverAnchorEl && this.inlinePlanChildPopoverAnchorEl.isConnected ? this.inlinePlanChildPopoverAnchorEl : null);
        if (!resolvedAnchor || typeof resolvedAnchor.getBoundingClientRect !== 'function') {
            section.hidden = true;
            if (section.style) {
                section.style.visibility = 'hidden';
                if (typeof section.style.removeProperty === 'function') {
                    section.style.removeProperty('--inline-plan-subsection-notch-left');
                }
            }
            if (section.classList && typeof section.classList.remove === 'function') {
                section.classList.remove('inline-plan-subsection-anchored');
                section.classList.remove('inline-plan-subsection-flow');
            }
            if (this.inlinePlanDropdown.classList && typeof this.inlinePlanDropdown.classList.remove === 'function') {
                this.inlinePlanDropdown.classList.remove('inline-plan-child-popover-open');
            }
            this.inlinePlanChildPopoverAnchorEl = null;
            this.inlinePlanChildPopoverAnchorSectionKey = null;
            this.inlinePlanChildPopoverAnchorInstanceKey = null;
            return;
        }
        if (typeof this.inlinePlanDropdown.getBoundingClientRect !== 'function') return;

        const dropdown = this.inlinePlanDropdown;
        const dropdownRect = dropdown.getBoundingClientRect();
        const anchorRect = resolvedAnchor.getBoundingClientRect();
        if (!dropdownRect || !anchorRect) return;

        const anchorLeft = Number.isFinite(anchorRect.left) ? anchorRect.left : 0;

        const useFlowLayout = Boolean(
            this.isInlinePlanMobileInputContext && this.isInlinePlanMobileInputContext()
            || dropdown.classList.contains('inline-plan-dropdown-sheet')
        );

        if (useFlowLayout) {
            if (section.parentElement !== dropdown && typeof dropdown.appendChild === 'function') {
                dropdown.appendChild(section);
            }
            if (this.inlinePlanChildPopoverLayer) this.inlinePlanChildPopoverLayer.hidden = true;
            section.classList.add('inline-plan-subsection-flow');
            section.classList.remove('inline-plan-subsection-anchored');
            section.style.position = 'relative';
            section.style.top = '';
            section.style.left = '';
            section.style.right = '';
            section.style.bottom = '';
            section.style.width = '100%';
            section.style.maxWidth = 'none';
            section.style.marginTop = '10px';
            section.style.maxHeight = 'min(420px, calc(100vh - 96px))';
            section.style.overflow = 'hidden';
            section.style.visibility = 'visible';
            section.style.zIndex = '80';
            const flowBoard = this.inlinePlanDropdown.querySelector('.inline-plan-sub-board');
            if (flowBoard && flowBoard.style) {
                flowBoard.style.maxHeight = '';
                flowBoard.style.overflow = 'auto';
            }
            this.inlinePlanChildPopoverAnchorEl = resolvedAnchor;
            return;
        }

        const layer = getInlinePlanChildPopoverLayer.call(this);
        if (layer && section.parentElement !== layer && typeof layer.appendChild === 'function') {
            layer.appendChild(section);
        }
        if (layer) layer.hidden = false;
        section.classList.remove('inline-plan-subsection-flow');
        section.classList.add('inline-plan-subsection-anchored');
        const gap = 8;
        const margin = 8;
        const minWidth = 300;
        const maxWidth = 360;
        const minPopoverHeight = 280;
        const maxPopoverHeight = 420;
        const root = typeof window !== 'undefined' ? window : globalThis;
        const fallbackViewportWidth = Number(root && root.innerWidth)
            || (Number.isFinite(dropdownRect.right) ? dropdownRect.right + margin : 0)
            || 800;
        const fallbackViewportHeight = Number(root && root.innerHeight)
            || (Number.isFinite(dropdownRect.bottom) ? dropdownRect.bottom + 600 : 0)
            || 600;
        section.style.position = 'fixed';
        section.style.marginTop = '0';
        section.style.right = 'auto';
        section.style.bottom = 'auto';
        section.style.overflow = 'hidden';
        section.style.zIndex = '80';
        const layoutAnchoredPanel = this.layoutInlinePlanAnchoredPanel || layoutInlinePlanAnchoredPanel;
        const layout = layoutAnchoredPanel.call(this, section, anchorRect, {
            margin,
            gap,
            positionMode: 'fixed',
            preferredWidth: maxWidth,
            minWidth,
            minHeight: minPopoverHeight,
            maxHeight: maxPopoverHeight,
            align: 'left',
            fallbackViewport: {
                left: 0,
                top: 0,
                right: fallbackViewportWidth,
                bottom: fallbackViewportHeight,
                width: fallbackViewportWidth,
                height: fallbackViewportHeight,
            },
        });
        const width = layout && Number.isFinite(layout.width) ? layout.width : maxWidth;
        const left = layout && Number.isFinite(layout.left) ? layout.left : anchorLeft;
        section.style.maxWidth = `${Math.round(width)}px`;
        const anchorCenter = anchorLeft + Math.max(0, Math.floor((Number.isFinite(anchorRect.width) ? anchorRect.width : 0) / 2));
        const notchLeft = Math.max(16, Math.min(width - 16, anchorCenter - left));
        section.style.setProperty('--inline-plan-subsection-notch-left', `${Math.round(notchLeft)}px`);
        const anchoredBoard = queryInlinePlanChildPopoverPart(section, this.inlinePlanDropdown, '.inline-plan-sub-board');
        const header = queryInlinePlanChildPopoverPart(section, this.inlinePlanDropdown, '.inline-plan-subsection-head');
        if (anchoredBoard && anchoredBoard.style) {
            const headerHeight = header && typeof header.getBoundingClientRect === 'function'
                ? Math.ceil(header.getBoundingClientRect().height || 0)
                : 0;
            const actions = queryInlinePlanChildPopoverPart(section, this.inlinePlanDropdown, '.inline-plan-child-actions');
            const actionsHeight = actions && typeof actions.getBoundingClientRect === 'function'
                ? Math.ceil(actions.getBoundingClientRect().height || 0)
                : 0;
            const verticalPadding = 24;
            const boundedHeight = layout && Number.isFinite(layout.maxHeight) ? layout.maxHeight : minPopoverHeight;
            const boardMaxHeight = Math.max(72, boundedHeight - headerHeight - actionsHeight - verticalPadding - gap);
            anchoredBoard.style.maxHeight = `${boardMaxHeight}px`;
            anchoredBoard.style.overflow = 'auto';
        }
        this.inlinePlanChildPopoverAnchorEl = resolvedAnchor;
    }

function nodeContains(parent, child) {
        if (!parent || !child) return false;
        if (parent === child) return true;
        if (typeof parent.contains === 'function') {
            try {
                return parent.contains(child);
            } catch (error) {
                // Fall back to parentElement walking for test doubles.
            }
        }

        let current = child;
        while (current) {
            if (current === parent) return true;
            current = current.parentElement || null;
        }
        return false;
    }

function isScrollableDropdownNode(node) {
        if (!node || typeof node.getBoundingClientRect !== 'function') return false;
        const style = typeof window !== 'undefined' && window.getComputedStyle
            ? window.getComputedStyle(node)
            : null;
        const overflowY = style ? String(style.overflowY || style.overflow || '') : '';
        const canScroll = Number(node.scrollHeight) > (Number(node.clientHeight) + 1);
        return canScroll || /auto|scroll|overlay/.test(overflowY);
    }

function getScrollableAncestorsWithinDropdown(node, dropdown) {
        const result = [];
        let current = node && node.parentElement ? node.parentElement : null;

        while (current && dropdown && nodeContains(dropdown, current)) {
            if (isScrollableDropdownNode(current)) {
                result.push(current);
            }

            if (current === dropdown) break;
            current = current.parentElement || null;
        }

        if (dropdown && !result.includes(dropdown)) {
            result.push(dropdown);
        }

        return result;
    }

function getInlinePlanDropdownScrollContainer(dropdown, options = {}) {
        if (!dropdown) return null;

        const anchorEl = options && options.anchorEl ? options.anchorEl : null;
        const popover = options && options.popover ? options.popover : null;
        if (anchorEl) {
            const ancestors = getScrollableAncestorsWithinDropdown(anchorEl, dropdown);
            const sharedScrollContainer = ancestors.find((node) => (
                node === dropdown
                || !popover
                || nodeContains(node, popover)
            ) && isScrollableDropdownNode(node));
            if (sharedScrollContainer) return sharedScrollContainer;

            if (isScrollableDropdownNode(dropdown)) return dropdown;

            const fallbackBoard = typeof dropdown.querySelector === 'function'
                ? dropdown.querySelector('.activity-chip-board')
                : null;
            if (
                fallbackBoard
                && nodeContains(fallbackBoard, anchorEl)
                && (!popover || nodeContains(fallbackBoard, popover))
                && isScrollableDropdownNode(fallbackBoard)
            ) {
                return fallbackBoard;
            }

            return dropdown;
        }

        const candidates = [
            typeof dropdown.querySelector === 'function' ? dropdown.querySelector('.inline-plan-dropdown-content') : null,
            typeof dropdown.querySelector === 'function' ? dropdown.querySelector('.activity-chip-board') : null,
            dropdown,
        ].filter(Boolean);

        return candidates.find((node) => isScrollableDropdownNode(node)) || dropdown;
    }

function scrollChildPopoverIntoDropdownView(dropdown, popover, options = {}) {
        if (!dropdown || !popover) return false;
        if (typeof popover.getBoundingClientRect !== 'function') return false;

        const scrollContainer = getInlinePlanDropdownScrollContainer(dropdown, {
            anchorEl: options.anchorEl || null,
            popover,
        });
        if (!scrollContainer || typeof scrollContainer.getBoundingClientRect !== 'function') return false;

        const margin = Number.isFinite(options.margin) ? options.margin : 8;

        const scrollRect = scrollContainer.getBoundingClientRect();
        const dropdownRect = typeof dropdown.getBoundingClientRect === 'function'
            ? dropdown.getBoundingClientRect()
            : scrollRect;
        const popoverRect = popover.getBoundingClientRect();

        if (!scrollRect || !dropdownRect || !popoverRect) return false;

        let delta = 0;
        const visibleTop = Math.max(
            Number.isFinite(scrollRect.top) ? scrollRect.top : 0,
            Number.isFinite(dropdownRect.top) ? dropdownRect.top : 0
        ) + margin;
        const visibleBottom = Math.min(
            Number.isFinite(scrollRect.bottom) ? scrollRect.bottom : 0,
            Number.isFinite(dropdownRect.bottom) ? dropdownRect.bottom : 0
        ) - margin;

        const bottomOverflow = popoverRect.bottom - visibleBottom;
        if (bottomOverflow > 0) {
            delta = bottomOverflow;
        } else {
            const topOverflow = visibleTop - popoverRect.top;
            if (topOverflow > 0) {
                delta = -topOverflow;
            }
        }

        if (Math.abs(delta) < 1) return false;

        const before = Number(scrollContainer.scrollTop) || 0;
        const maxScroll = Math.max(0, (Number(scrollContainer.scrollHeight) || 0) - (Number(scrollContainer.clientHeight) || 0));
        const next = Math.max(0, Math.min(maxScroll, before + delta));

        if (Math.abs(next - before) < 1) return false;

        scrollContainer.scrollTop = next;
        return true;
    }

function getCatalogItemLabel(item) {
        return this.normalizeActivityText
            ? this.normalizeActivityText((item && (item.name || item.label || item.title)) || '')
            : String((item && (item.name || item.label || item.title)) || '').trim();
    }

function getInlinePlanSelectionSeconds() {
        const target = this.inlinePlanTarget || {};
        if (Number.isFinite(target.blockMinutes) && target.blockMinutes > 0) {
            return Math.max(1, Math.floor(target.blockMinutes)) * 60;
        }
        const startIndex = Number.isInteger(target.startIndex) ? target.startIndex : 0;
        const endIndex = Number.isInteger(target.endIndex) ? target.endIndex : startIndex;
        return Math.max(1, Math.abs(endIndex - startIndex) + 1) * 3600;
    }

function getActivityBoardItemId(item) {
        return String(item && item.id ? item.id : '').trim();
    }

function getOpenParentCaretAnchor() {
        if (!this.inlinePlanDropdown) return null;
        const parentId = String(this.modalPlanSectionOpenParentId || '').trim();
        if (!parentId) return null;
        const dropdown = this.inlinePlanDropdown;
        if (typeof dropdown.querySelectorAll !== 'function') return null;
        const carets = Array.from(dropdown.querySelectorAll('.activity-chip-caret[data-activity-id]'));

        const instanceKey = String(this.inlinePlanChildPopoverAnchorInstanceKey || '').trim();
        if (instanceKey) {
            const exactInstance = carets.find((node) =>
                node
                && node.dataset
                && String(node.dataset.chipInstanceKey || '').trim() === instanceKey
            );
            if (exactInstance) return exactInstance;
        }

        const sectionKey = String(this.inlinePlanChildPopoverAnchorSectionKey || '').trim();
        if (sectionKey) {
            const exactSection = carets.find((node) =>
                node
                && node.dataset
                && String(node.dataset.activityId || '').trim() === parentId
                && String(node.dataset.boardSection || '').trim() === sectionKey
            );
            if (exactSection) return exactSection;
        }

        if (
            this.inlinePlanChildPopoverAnchorEl
            && this.inlinePlanChildPopoverAnchorEl.isConnected
            && typeof this.inlinePlanChildPopoverAnchorEl.getBoundingClientRect === 'function'
        ) {
            return this.inlinePlanChildPopoverAnchorEl;
        }

        return carets.find((node) =>
            node
            && node.dataset
            && String(node.dataset.activityId || '').trim() === parentId
        ) || null;
    }

function areActivityListsEquivalent(leftItems = [], rightItems = []) {
        const left = Array.isArray(leftItems) ? leftItems : [];
        const right = Array.isArray(rightItems) ? rightItems : [];
        if (left.length !== right.length) return false;
        for (let i = 0; i < left.length; i++) {
            if (getActivityBoardItemId(left[i]) !== getActivityBoardItemId(right[i])) return false;
        }
        return true;
    }

    function normalizeActivityBoardId(value) {
        return String(value || '').trim();
    }

    function getActivityBoardParentId(item) {
        return String(item && item.parentId || '').trim() || null;
    }

    function getActivityBoardItemById(items, id) {
        const targetId = normalizeActivityBoardId(id);
        if (!targetId || !Array.isArray(items)) return null;
        return items.find((item) => item && normalizeActivityBoardId(item.id) === targetId) || null;
    }

    function isActivityBoardDescendant(items, ancestorId, candidateId) {
        const normalizedAncestorId = normalizeActivityBoardId(ancestorId);
        let currentId = normalizeActivityBoardId(candidateId);
        if (!normalizedAncestorId || !currentId) return false;
        const seen = new Set();
        while (currentId && !seen.has(currentId)) {
            seen.add(currentId);
            const current = getActivityBoardItemById(items, currentId);
            if (!current) return false;
            const parentId = getActivityBoardParentId(current);
            if (!parentId) return false;
            if (parentId === normalizedAncestorId) return true;
            currentId = parentId;
        }
        return false;
    }

    function sortActivityBoardSiblings(items, parentId, sourceIndexById, excludedId = '') {
        const normalizedParentId = normalizeActivityBoardId(parentId);
        const normalizedExcludedId = normalizeActivityBoardId(excludedId);
        return (Array.isArray(items) ? items : [])
            .filter((item) => {
                if (!item) return false;
                const itemId = normalizeActivityBoardId(item.id);
                if (!itemId || (normalizedExcludedId && itemId === normalizedExcludedId)) return false;
                return (getActivityBoardParentId(item) || '') === normalizedParentId;
            })
            .sort((a, b) => {
                const ao = Number.isFinite(a.boardOrder) ? Math.max(0, Math.floor(Number(a.boardOrder))) : Infinity;
                const bo = Number.isFinite(b.boardOrder) ? Math.max(0, Math.floor(Number(b.boardOrder))) : Infinity;
                if (ao !== bo) return ao - bo;
                const ar = Number.isFinite(a.priorityRank) ? a.priorityRank : Infinity;
                const br = Number.isFinite(b.priorityRank) ? b.priorityRank : Infinity;
                if (ar !== br) return ar - br;
                const al = String(a.lastUsedAt || '');
                const bl = String(b.lastUsedAt || '');
                if (al !== bl) return bl.localeCompare(al);
                const ai = sourceIndexById && sourceIndexById.has(normalizeActivityBoardId(a.id)) ? sourceIndexById.get(normalizeActivityBoardId(a.id)) : Infinity;
                const bi = sourceIndexById && sourceIndexById.has(normalizeActivityBoardId(b.id)) ? sourceIndexById.get(normalizeActivityBoardId(b.id)) : Infinity;
                if (ai !== bi) return ai - bi;
                return getCatalogItemLabel.call(this, a).localeCompare(getCatalogItemLabel.call(this, b));
            });
    }

    function assignActivityBoardSiblingOrder(siblings) {
        (Array.isArray(siblings) ? siblings : []).forEach((item, index) => {
            if (item) item.boardOrder = index;
        });
    }

    function getActivityChipboardStateSignature(items) {
        return JSON.stringify((Array.isArray(items) ? items : [])
            .filter((item) => item && normalizeActivityBoardId(item.id))
            .map((item) => ({
                id: normalizeActivityBoardId(item.id),
                parentId: getActivityBoardParentId(item) || '',
                boardOrder: Number.isFinite(item.boardOrder) ? Math.max(0, Math.floor(Number(item.boardOrder))) : null,
            }))
            .sort((left, right) => left.id.localeCompare(right.id)));
    }

    function normalizeActivityChipboardDropIntent(intent = {}) {
        const rawType = String(intent.type || intent.intent || '').trim();
        const type = rawType === 'nest' ? 'nest' : (rawType === 'detach' ? 'detach' : 'reorder');
        const rawPlacement = String(intent.placement || '').trim();
        const placement = rawPlacement === 'after' ? 'after' : 'before';
        return {
            type,
            placement,
            targetId: normalizeActivityBoardId(intent.targetId),
            parentId: normalizeActivityBoardId(intent.parentId),
            parentIdSpecified: Object.prototype.hasOwnProperty.call(intent || {}, 'parentId'),
        };
    }

    function validateActivityChipboardDrop(sourceId, intent = {}) {
        const activities = Array.isArray(this.plannedActivities) ? this.plannedActivities : [];
        const normalizedSourceId = normalizeActivityBoardId(sourceId);
        const normalizedIntent = normalizeActivityChipboardDropIntent(intent);
        const targetId = normalizedIntent.targetId;
        const source = getActivityBoardItemById(activities, normalizedSourceId);
        if (normalizedIntent.type === 'detach') {
            if (!source || !normalizedSourceId) return { valid: false, status: 'missing-target' };
            const nextParentId = normalizedIntent.parentIdSpecified ? normalizedIntent.parentId : '';
            if (nextParentId === normalizedSourceId) return { valid: false, status: 'self' };
            if (nextParentId && isActivityBoardDescendant(activities, normalizedSourceId, nextParentId)) {
                return { valid: false, status: 'circular' };
            }
            return { valid: true, status: 'valid', intent: normalizedIntent };
        }
        const target = getActivityBoardItemById(activities, targetId);
        if (!source || !target || !normalizedSourceId || !targetId) return { valid: false, status: 'missing-target' };
        if (normalizedSourceId === targetId) return { valid: false, status: 'self' };
        const nextParentId = normalizedIntent.type === 'nest'
            ? targetId
            : (normalizedIntent.parentIdSpecified ? normalizedIntent.parentId : getActivityBoardParentId(target));
        if (nextParentId === normalizedSourceId) return { valid: false, status: 'self' };
        if (nextParentId && isActivityBoardDescendant(activities, normalizedSourceId, nextParentId)) {
            return { valid: false, status: 'circular' };
        }
        if (normalizedIntent.type === 'nest' && isActivityBoardDescendant(activities, normalizedSourceId, targetId)) {
            return { valid: false, status: 'descendant' };
        }
        return { valid: true, status: 'valid', intent: normalizedIntent };
    }

    function applyActivityChipboardDrop(sourceId, intent = {}) {
        const activities = Array.isArray(this.plannedActivities) ? this.plannedActivities : [];
        const normalizedSourceId = normalizeActivityBoardId(sourceId);
        const normalizedIntent = normalizeActivityChipboardDropIntent(intent);
        const validation = validateActivityChipboardDrop.call(this, normalizedSourceId, normalizedIntent);
        if (!validation.valid) return { changed: false, status: validation.status };
        const undoSnapshot = cloneInlinePlanPlannedActivitiesSnapshot(activities);
        const beforeSignature = getActivityChipboardStateSignature(undoSnapshot);

        const source = getActivityBoardItemById(activities, normalizedSourceId);
        const target = getActivityBoardItemById(activities, normalizedIntent.targetId);
        const oldParentId = getActivityBoardParentId(source);
        const nextParentId = normalizedIntent.type === 'detach'
            ? (normalizedIntent.parentIdSpecified ? normalizedIntent.parentId : '')
            : normalizedIntent.type === 'nest'
            ? normalizeActivityBoardId(target.id)
            : (normalizedIntent.parentIdSpecified ? normalizedIntent.parentId : getActivityBoardParentId(target));
        const sourceIndexById = new Map();
        activities.forEach((item, index) => {
            const itemId = normalizeActivityBoardId(item && item.id);
            if (itemId && !sourceIndexById.has(itemId)) sourceIndexById.set(itemId, index);
        });

        if ((oldParentId || '') !== (nextParentId || '')) {
            const oldSiblings = sortActivityBoardSiblings.call(this, activities, oldParentId, sourceIndexById, normalizedSourceId);
            assignActivityBoardSiblingOrder(oldSiblings);
        }

        source.parentId = nextParentId || null;
        const nextSiblings = sortActivityBoardSiblings.call(this, activities, nextParentId, sourceIndexById, normalizedSourceId);
        let insertIndex = nextSiblings.length;
        if (normalizedIntent.type !== 'nest' && normalizedIntent.type !== 'detach') {
            const targetIndex = nextSiblings.findIndex((item) => normalizeActivityBoardId(item && item.id) === normalizeActivityBoardId(target.id));
            insertIndex = targetIndex < 0 ? nextSiblings.length : targetIndex + (normalizedIntent.placement === 'after' ? 1 : 0);
        }
        nextSiblings.splice(insertIndex, 0, source);
        assignActivityBoardSiblingOrder(nextSiblings);

        const afterSignature = getActivityChipboardStateSignature(activities);
        if (afterSignature === beforeSignature) {
            return {
                changed: false,
                status: 'no-op',
                parentId: nextParentId || null,
            };
        }

        if (typeof this.dedupeAndSortPlannedActivities === 'function') {
            this.dedupeAndSortPlannedActivities();
        }
        if (typeof this.savePlannedActivities === 'function') {
            this.savePlannedActivities();
        }
        if (typeof this.renderPlannedActivityDropdown === 'function') {
            this.renderPlannedActivityDropdown();
        }
        if (typeof this.refreshSubActivityOptions === 'function') {
            this.refreshSubActivityOptions();
        }
        setInlinePlanChipUndoState.call(this, undoSnapshot);
        if (this.inlinePlanDropdown && typeof this.renderInlinePlanDropdownOptions === 'function') {
            this.renderInlinePlanDropdownOptions();
        }
        return {
            changed: true,
            status: normalizedIntent.type === 'nest' ? 'nested' : (normalizedIntent.type === 'detach' ? 'detached' : 'reordered'),
            parentId: nextParentId || null,
        };
    }

    function isPrimaryActivityChipboardSection(sectionKey) {
        const key = String(sectionKey || '').trim();
        return key === 'parents' || key === 'all';
    }

    function isInlinePlanChipDragBlockedTarget(target) {
        let el = target && target.nodeType === 1 ? target : (target && target.parentElement ? target.parentElement : null);
        while (el) {
            if (typeof el.matches === 'function' && el.matches('button, input, textarea, select, [contenteditable="true"], .activity-chip-delete, .activity-chip-caret, .inline-plan-options, .inline-plan-child-actions')) {
                return true;
            }
            if (typeof el.matches === 'function' && el.matches('.activity-chip[data-activity-id]')) return false;
            el = el.parentElement || null;
        }
        return false;
    }

    const INLINE_PLAN_CHIP_DRAG_THRESHOLD_PX = 5;
    const INLINE_PLAN_CHIP_AUTOSCROLL_EDGE_PX = 44;
    const INLINE_PLAN_CHIP_AUTOSCROLL_MAX_STEP = 18;
    const INLINE_PLAN_CHIP_UNDO_TIMEOUT_MS = 8000;
    const INLINE_PLAN_CHIP_DROP_LABELS = Object.freeze({
        before: '앞에 배치',
        after: '뒤에 배치',
        nest: '하위로 넣기',
        invalid: '불가',
    });

function isVirtualRestGapTarget(target) {
        return Boolean(
            target
            && target.mode === 'virtual-rest-gap'
            && Number.isFinite(target.gapStartMinute)
            && Number.isFinite(target.gapDurationMinutes)
            && target.gapDurationMinutes > 0
        );
    }

function buildPlanActivitiesWithVirtualGapFill(existingActivities, planItem, target) {
        const source = Array.isArray(existingActivities) ? existingActivities : [];
        const gapStartMinute = Math.max(0, Math.floor(Number(target && target.gapStartMinute) || 0));
        const gapDurationMinutes = Math.max(0, Math.floor(Number(target && target.gapDurationMinutes) || 0));
        const fillItem = {
            ...planItem,
            seconds: gapDurationMinutes * 60,
        };
        delete fillItem.kind;
        delete fillItem.virtual;

        const nextActivities = source
            .filter((item) => item && item.kind !== 'virtual-rest' && item.virtual !== true)
            .map((item) => {
                const copy = { ...item };
                delete copy.kind;
                delete copy.virtual;
                return copy;
            });

        let cursor = 0;
        let insertIndex = nextActivities.length;
        for (let i = 0; i < nextActivities.length; i += 1) {
            const item = nextActivities[i] || {};
            const startMinute = Number.isFinite(item.startMinute)
                ? Math.max(0, Math.floor(item.startMinute))
                : cursor;
            const durationMinutes = Number.isFinite(item.durationMinutes)
                ? Math.max(0, Math.floor(item.durationMinutes))
                : Math.max(0, Math.floor((Number(item.seconds) || 0) / 60));
            const endMinute = Number.isFinite(item.endMinute)
                ? Math.max(startMinute, Math.floor(item.endMinute))
                : startMinute + durationMinutes;
            if (gapStartMinute < startMinute || gapStartMinute < endMinute) {
                insertIndex = i;
                break;
            }
            cursor = Math.max(cursor, endMinute);
            if (gapStartMinute >= cursor) {
                insertIndex = i + 1;
            }
        }

        nextActivities.splice(insertIndex, 0, fillItem);
        return nextActivities;
    }

function touchPlannedActivityUsage(activityItem, parentItem = null) {
        if (!activityItem || !Array.isArray(this.plannedActivities)) return null;
        const activityId = String(activityItem.id || '').trim();
        const parentId = parentItem ? String(parentItem.id || '').trim() || null : null;
        const label = getCatalogItemLabel.call(this, activityItem);
        if (!label) return null;
        const normalizedParentId = parentId || null;
        const idx = this.plannedActivities.findIndex((item) => {
            if (!item) return false;
            const itemLabel = getCatalogItemLabel.call(this, item);
            if (!itemLabel || itemLabel !== label) return false;
            if (activityId && String(item.id || '').trim() === activityId) return true;
            const itemParentId = String(item.parentId || '').trim() || null;
            return itemParentId === normalizedParentId;
        });
        if (idx < 0) return null;
        const nextUsageCount = (Number(this.plannedActivities[idx].usageCount) || 0) + 1;
        const lastUsedAt = new Date().toISOString();
        this.plannedActivities[idx] = {
            ...this.plannedActivities[idx],
            usageCount: nextUsageCount,
            lastUsedAt,
        };
        return this.plannedActivities[idx];
    }

    function isInlinePlanChipDeleteModeEnabled() {
        return Boolean(this.inlinePlanChipDeleteMode);
    }

    function setInlinePlanChipDeleteMode(enabled) {
        const nextValue = Boolean(enabled);
        this.inlinePlanChipDeleteMode = nextValue;
        if (nextValue) {
            setInlinePlanChipEditMode.call(this, false, { rerender: false });
        }
        if (this.inlinePlanDropdown && this.inlinePlanDropdown.classList && typeof this.inlinePlanDropdown.classList.toggle === 'function') {
            this.inlinePlanDropdown.classList.toggle('inline-plan-chip-delete-mode', nextValue);
        }
        const board = this.inlinePlanDropdown && typeof this.inlinePlanDropdown.querySelector === 'function'
            ? this.inlinePlanDropdown.querySelector('.activity-chip-board')
            : null;
        if (board && board.classList && typeof board.classList.toggle === 'function') {
            board.classList.toggle('activity-chip-board-delete-mode', nextValue);
            board.classList.toggle('activity-chip-board-reorder-enabled', !nextValue);
        }
        return nextValue;
    }

    function isInlinePlanChipEditModeEnabled() {
        return Boolean(this.inlinePlanChipEditMode);
    }

    function setInlinePlanChipEditMode(enabled, options = {}) {
        const nextValue = Boolean(enabled);
        this.inlinePlanChipEditMode = nextValue;
        if (nextValue) {
            this.inlinePlanChipDeleteMode = false;
        } else {
            cleanupInlinePlanChipDragState.call(this);
        }
        if (this.inlinePlanDropdown && this.inlinePlanDropdown.classList && typeof this.inlinePlanDropdown.classList.toggle === 'function') {
            this.inlinePlanDropdown.classList.toggle('inline-plan-chip-delete-mode', Boolean(this.inlinePlanChipDeleteMode));
        }
        const board = this.inlinePlanDropdown && typeof this.inlinePlanDropdown.querySelector === 'function'
            ? this.inlinePlanDropdown.querySelector('.activity-chip-board')
            : null;
        if (board && board.classList && typeof board.classList.toggle === 'function') {
            board.classList.toggle('activity-chip-board-delete-mode', Boolean(this.inlinePlanChipDeleteMode));
            board.classList.toggle('activity-chip-board-reorder-enabled', !this.inlinePlanChipDeleteMode);
        }
        if (options && options.rerender !== false && this.inlinePlanDropdown) {
            if (typeof this.renderInlinePlanDropdownOptions === 'function') {
                this.renderInlinePlanDropdownOptions();
            } else {
                renderInlinePlanDropdownOptions.call(this);
            }
        }
        return nextValue;
    }

    function cloneInlinePlanPlannedActivitiesSnapshot(items) {
        const source = Array.isArray(items) ? items : [];
        if (typeof structuredClone === 'function') {
            try {
                return structuredClone(source);
            } catch (_) {}
        }
        return source.map((item) =>
            item && typeof item === 'object' ? { ...item } : item
        );
    }

    function renderInlinePlanDropdownOptionsAfterChipStateChange(ctx) {
        if (!ctx || !ctx.inlinePlanDropdown) return;
        if (typeof ctx.renderInlinePlanDropdownOptions === 'function') {
            ctx.renderInlinePlanDropdownOptions();
        } else {
            renderInlinePlanDropdownOptions.call(ctx);
        }
    }

    function clearInlinePlanChipUndoState(options = {}) {
        if (this.inlinePlanChipUndoTimer && typeof clearTimeout === 'function') {
            clearTimeout(this.inlinePlanChipUndoTimer);
        }
        this.inlinePlanChipUndoTimer = null;
        this.inlinePlanChipUndoState = null;
        if (options && options.rerender) {
            renderInlinePlanDropdownOptionsAfterChipStateChange(this);
        }
    }

    function setInlinePlanChipUndoState(snapshot) {
        const previous = cloneInlinePlanPlannedActivitiesSnapshot(snapshot);
        if (!previous.length) {
            clearInlinePlanChipUndoState.call(this);
            return null;
        }
        clearInlinePlanChipUndoState.call(this);
        const undoState = { plannedActivities: previous };
        this.inlinePlanChipUndoState = undoState;
        if (typeof setTimeout === 'function') {
            const timer = setTimeout(() => {
                if (this.inlinePlanChipUndoState !== undoState) return;
                clearInlinePlanChipUndoState.call(this, { rerender: true });
            }, INLINE_PLAN_CHIP_UNDO_TIMEOUT_MS);
            if (timer && typeof timer.unref === 'function') timer.unref();
            this.inlinePlanChipUndoTimer = timer;
        }
        return undoState;
    }

    function restoreInlinePlanChipUndoState() {
        const undoState = this.inlinePlanChipUndoState || null;
        if (!undoState || !Array.isArray(undoState.plannedActivities)) return false;
        const restored = cloneInlinePlanPlannedActivitiesSnapshot(undoState.plannedActivities);
        clearInlinePlanChipUndoState.call(this);
        this.plannedActivities = restored;
        if (typeof this.savePlannedActivities === 'function') {
            this.savePlannedActivities();
        }
        if (typeof this.renderPlannedActivityDropdown === 'function') {
            this.renderPlannedActivityDropdown();
        }
        if (typeof this.refreshSubActivityOptions === 'function') {
            this.refreshSubActivityOptions();
        }
        renderInlinePlanDropdownOptionsAfterChipStateChange(this);
        return true;
    }

    function renderInlinePlanChipUndoControl(actions) {
        if (!actions || !this.inlinePlanChipUndoState || typeof document === 'undefined' || typeof document.createElement !== 'function') return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'activity-chip-undo-toast';
        button.dataset.inlineChipUndo = 'true';
        button.textContent = '이동됨 · 되돌리기';
        button.addEventListener('click', (event) => {
            if (event && typeof event.preventDefault === 'function') event.preventDefault();
            if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
            restoreInlinePlanChipUndoState.call(this);
        });
        actions.appendChild(button);
    }

    function clearInlinePlanChipDropFeedback(board) {
        const rootEl = board || (this.inlinePlanDropdown && typeof this.inlinePlanDropdown.querySelector === 'function'
            ? this.inlinePlanDropdown.querySelector('.activity-chip-board')
            : null);
        if (!rootEl || typeof rootEl.querySelectorAll !== 'function') return;
        rootEl.querySelectorAll('.activity-chip-drop-label').forEach((node) => {
            if (node && node.parentNode && typeof node.parentNode.removeChild === 'function') {
                node.parentNode.removeChild(node);
            }
        });
        rootEl.querySelectorAll('.activity-chip-drop-before, .activity-chip-drop-after, .activity-chip-drop-nest, .activity-chip-drop-invalid, .activity-chip-drag-pending, .activity-chip-dragging').forEach((node) => {
            removeInlinePlanClass(
                node,
                'activity-chip-drop-before',
                'activity-chip-drop-after',
                'activity-chip-drop-nest',
                'activity-chip-drop-invalid',
                'activity-chip-drag-pending',
                'activity-chip-dragging'
            );
            if (node && node.dataset) {
                delete node.dataset.chipDropLabel;
                delete node.dataset.chipDropIntent;
            }
        });
    }

    function removeInlinePlanChipDragPreview() {
        const preview = this.inlinePlanChipDragPreview || null;
        if (!preview) return;
        if (preview.parentNode && typeof preview.parentNode.removeChild === 'function') {
            preview.parentNode.removeChild(preview);
        }
        this.inlinePlanChipDragPreview = null;
    }

    function createInlinePlanChipDragPreview(sourceChip) {
        const doc = sourceChip && sourceChip.ownerDocument ? sourceChip.ownerDocument : (typeof document !== 'undefined' ? document : null);
        if (!doc || typeof doc.createElement !== 'function') return null;
        const preview = doc.createElement('div');
        preview.className = 'activity-chip-drag-preview';
        if (!preview.style) preview.style = {};
        preview.setAttribute('aria-hidden', 'true');
        const sourceRect = sourceChip && typeof sourceChip.getBoundingClientRect === 'function'
            ? sourceChip.getBoundingClientRect()
            : null;
        const sourceWidth = sourceRect && Number.isFinite(sourceRect.width) && sourceRect.width > 0
            ? Math.ceil(sourceRect.width)
            : null;
        const sourceHeight = sourceRect && Number.isFinite(sourceRect.height) && sourceRect.height > 0
            ? Math.ceil(sourceRect.height)
            : null;
        if (sourceWidth !== null) preview.style.width = `${sourceWidth}px`;
        if (sourceHeight !== null) {
            preview.style.height = `${sourceHeight}px`;
            preview.style.minHeight = `${sourceHeight}px`;
        }
        let chipPreview = null;
        if (sourceChip && typeof sourceChip.cloneNode === 'function') {
            chipPreview = sourceChip.cloneNode(true);
            removeInlinePlanClass(
                chipPreview,
                'activity-chip-dragging',
                'activity-chip-drop-before',
                'activity-chip-drop-after',
                'activity-chip-drop-nest',
                'activity-chip-drop-invalid',
                'activity-chip-drag-pending'
            );
            addInlinePlanClass(chipPreview, 'activity-chip-drag-preview-chip');
            if (typeof chipPreview.removeAttribute === 'function') chipPreview.removeAttribute('id');
        } else {
            chipPreview = doc.createElement('span');
            chipPreview.className = 'activity-chip activity-chip-drag-preview-chip';
            const label = sourceChip && sourceChip.dataset && sourceChip.dataset.label
                ? String(sourceChip.dataset.label)
                : (sourceChip && typeof sourceChip.textContent === 'string' ? sourceChip.textContent.trim() : '');
            chipPreview.textContent = label;
        }
        if (chipPreview && typeof chipPreview.querySelectorAll === 'function') {
            chipPreview.querySelectorAll('button, input, select, textarea, a, [tabindex]').forEach((node) => {
                if (typeof node.setAttribute === 'function') node.setAttribute('tabindex', '-1');
                if (typeof node.removeAttribute === 'function') node.removeAttribute('id');
            });
            chipPreview.querySelectorAll('.activity-chip-caret, .activity-chip-delete').forEach((node) => {
                if (node && node.parentNode && typeof node.parentNode.removeChild === 'function') {
                    node.parentNode.removeChild(node);
                }
            });
        }
        if (chipPreview) preview.appendChild(chipPreview);
        if (doc.body && typeof doc.body.appendChild === 'function') {
            doc.body.appendChild(preview);
            return preview;
        }
        return null;
    }

    function updateInlinePlanChipDragPreview(state, event) {
        const preview = this.inlinePlanChipDragPreview || null;
        if (!preview) return;
        const clientX = Number(event && event.clientX);
        const clientY = Number(event && event.clientY);
        const x = Number.isFinite(clientX) ? clientX : 0;
        const y = Number.isFinite(clientY) ? clientY : 0;
        const rect = state && state.sourceChip && typeof state.sourceChip.getBoundingClientRect === 'function'
            ? state.sourceChip.getBoundingClientRect()
            : null;
        const fallbackOffsetX = rect && Number.isFinite(rect.width) ? Math.min(24, Math.max(8, rect.width * 0.15)) : 12;
        const fallbackOffsetY = rect && Number.isFinite(rect.height) ? Math.min(24, Math.max(8, rect.height * 0.5)) : 12;
        const offsetX = state && Number.isFinite(state.dragOffsetX) ? state.dragOffsetX : fallbackOffsetX;
        const offsetY = state && Number.isFinite(state.dragOffsetY) ? state.dragOffsetY : fallbackOffsetY;
        preview.style.transform = `translate3d(${Math.round(x - offsetX)}px, ${Math.round(y - offsetY)}px, 0)`;
    }

    function getInlinePlanChipDragDistance(state, event) {
        const startX = Number(state && state.startX);
        const startY = Number(state && state.startY);
        const clientX = Number(event && event.clientX);
        const clientY = Number(event && event.clientY);
        if (!Number.isFinite(startX) || !Number.isFinite(startY) || !Number.isFinite(clientX) || !Number.isFinite(clientY)) {
            return 0;
        }
        const dx = clientX - startX;
        const dy = clientY - startY;
        return Math.sqrt((dx * dx) + (dy * dy));
    }

    function activateInlinePlanChipDragState(state, event) {
        if (!state || state.active) return false;
        state.active = true;
        this.inlinePlanChipDragPreview = createInlinePlanChipDragPreview.call(this, state.sourceChip);
        updateInlinePlanChipDragPreview.call(this, state, event);
        if (state.sourceChip) removeInlinePlanClass(state.sourceChip, 'activity-chip-drag-pending');
        if (state.sourceChip) addInlinePlanClass(state.sourceChip, 'activity-chip-dragging');
        if (state.board) addInlinePlanClass(state.board, 'activity-chip-board-drag-active');
        return Boolean(this.inlinePlanChipDragPreview);
    }

    function getInlinePlanChipDropFeedbackName(intent, validation) {
        if (!intent) return '';
        if (!validation || !validation.valid) return 'invalid';
        if (intent.type === 'nest') return 'nest';
        return intent.placement === 'after' ? 'after' : 'before';
    }

    function applyInlinePlanChipDropLabel(chip, feedbackName) {
        if (!chip || !feedbackName) return;
        const label = INLINE_PLAN_CHIP_DROP_LABELS[feedbackName] || '';
        if (!label) return;
        if (chip.dataset) {
            chip.dataset.chipDropLabel = label;
            chip.dataset.chipDropIntent = feedbackName;
        }
        const doc = chip.ownerDocument || (typeof document !== 'undefined' ? document : null);
        if (!doc || typeof doc.createElement !== 'function' || typeof chip.appendChild !== 'function') return;
        let badge = null;
        if (typeof chip.querySelectorAll === 'function') {
            badge = chip.querySelectorAll('.activity-chip-drop-label')[0] || null;
        }
        if (!badge) {
            badge = doc.createElement('span');
            badge.setAttribute('aria-hidden', 'true');
            chip.appendChild(badge);
        }
        badge.className = `activity-chip-drop-label activity-chip-drop-label-${feedbackName}`;
        badge.textContent = label;
    }

    function refreshInlinePlanChipDropIntent(state) {
        if (!state || !state.active) return null;
        const clientX = Number(state.lastClientX);
        const clientY = Number(state.lastClientY);
        if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
        const eventLike = { clientX, clientY };
        const intent = resolveInlinePlanChipDropIntent.call(this, eventLike, state);
        const validation = intent
            ? validateActivityChipboardDrop.call(this, state.sourceId, intent)
            : { valid: false, status: 'missing-target' };
        state.intent = intent;
        state.validation = validation;
        applyInlinePlanChipDropFeedback.call(this, intent, validation, state);
        return { intent, validation };
    }

    function getInlinePlanChipAutoScrollStep(board, clientY) {
        if (!board || typeof board.getBoundingClientRect !== 'function') {
            return { delta: 0, before: 0, after: 0, maxScroll: 0 };
        }
        const rect = board.getBoundingClientRect();
        const top = Number(rect && rect.top);
        const bottom = Number(rect && rect.bottom);
        const y = Number(clientY);
        const before = Math.max(0, Number(board.scrollTop) || 0);
        const scrollHeight = Number(board.scrollHeight) || 0;
        const clientHeight = Number(board.clientHeight) || 0;
        const maxScroll = Math.max(0, scrollHeight - clientHeight);
        if (!Number.isFinite(top) || !Number.isFinite(bottom) || !Number.isFinite(y) || bottom <= top || maxScroll <= 0) {
            return { delta: 0, before, after: before, maxScroll };
        }
        const edge = Math.min(INLINE_PLAN_CHIP_AUTOSCROLL_EDGE_PX, Math.max(24, (bottom - top) * 0.35));
        let strength = 0;
        if (y < top + edge) {
            strength = -Math.min(1, Math.max(0, ((top + edge) - y) / edge));
        } else if (y > bottom - edge) {
            strength = Math.min(1, Math.max(0, (y - (bottom - edge)) / edge));
        }
        if (strength === 0) return { delta: 0, before, after: before, maxScroll };
        const direction = strength > 0 ? 1 : -1;
        const delta = direction * Math.max(2, Math.ceil(Math.abs(strength) * INLINE_PLAN_CHIP_AUTOSCROLL_MAX_STEP));
        const after = Math.max(0, Math.min(maxScroll, before + delta));
        return { delta, before, after, maxScroll };
    }

    function cancelInlinePlanChipAutoScrollFrame(state) {
        if (!state || state.autoScrollFrame == null) return;
        const frame = state.autoScrollFrame;
        const frameType = state.autoScrollFrameType;
        const win = state.window || (typeof window !== 'undefined' ? window : null);
        if (frameType === 'raf') {
            if (win && typeof win.cancelAnimationFrame === 'function') {
                win.cancelAnimationFrame(frame);
            } else if (typeof cancelAnimationFrame === 'function') {
                cancelAnimationFrame(frame);
            }
        } else if (typeof clearTimeout === 'function') {
            clearTimeout(frame);
        }
        state.autoScrollFrame = null;
        state.autoScrollFrameType = null;
    }

    function scheduleInlinePlanChipAutoScrollFrame(state) {
        if (!state || state.autoScrollFrame != null) return;
        const win = state.window || (typeof window !== 'undefined' ? window : null);
        const callback = () => {
            state.autoScrollFrame = null;
            state.autoScrollFrameType = null;
            if (!state.active) return;
            const step = getInlinePlanChipAutoScrollStep(state.board, state.autoScrollClientY);
            if (step.after !== step.before && state.board) {
                state.board.scrollTop = step.after;
                if (state.context) {
                    refreshInlinePlanChipDropIntent.call(state.context, state);
                }
            }
            if (state.active && step.delta !== 0 && step.after !== step.before) {
                scheduleInlinePlanChipAutoScrollFrame(state);
            }
        };
        if (win && typeof win.requestAnimationFrame === 'function') {
            state.autoScrollFrameType = 'raf';
            state.autoScrollFrame = win.requestAnimationFrame(callback);
            return;
        }
        if (typeof requestAnimationFrame === 'function') {
            state.autoScrollFrameType = 'raf';
            state.autoScrollFrame = requestAnimationFrame(callback);
            return;
        }
        if (typeof setTimeout === 'function') {
            state.autoScrollFrameType = 'timeout';
            state.autoScrollFrame = setTimeout(callback, 16);
            if (state.autoScrollFrame && typeof state.autoScrollFrame.unref === 'function') {
                state.autoScrollFrame.unref();
            }
        }
    }

    function updateInlinePlanChipAutoScroll(state, event) {
        if (!state || !state.active || !state.board) return;
        state.autoScrollClientY = Number(event && event.clientY);
        state.lastClientX = Number(event && event.clientX);
        state.lastClientY = Number(event && event.clientY);
        const step = getInlinePlanChipAutoScrollStep(state.board, state.autoScrollClientY);
        if (step.delta === 0 || step.after === step.before) {
            cancelInlinePlanChipAutoScrollFrame(state);
            return;
        }
        scheduleInlinePlanChipAutoScrollFrame(state);
    }

    function cleanupInlinePlanChipDragState() {
        const state = this.inlinePlanChipDragState || null;
        if (!state) return;
        const doc = state.document || (typeof document !== 'undefined' ? document : null);
        const win = state.window || (typeof window !== 'undefined' ? window : null);
        if (doc && typeof doc.removeEventListener === 'function') {
            doc.removeEventListener('pointermove', state.moveHandler, true);
            doc.removeEventListener('pointerup', state.endHandler, true);
            doc.removeEventListener('pointercancel', state.cancelHandler, true);
            doc.removeEventListener('keydown', state.keyHandler, true);
        }
        if (win && typeof win.removeEventListener === 'function') {
            win.removeEventListener('blur', state.cancelHandler, true);
        }
        cancelInlinePlanChipAutoScrollFrame(state);
        if (state.captureTarget && Number.isFinite(state.pointerId) && typeof state.captureTarget.releasePointerCapture === 'function') {
            try { state.captureTarget.releasePointerCapture(state.pointerId); } catch (_) {}
        }
        clearInlinePlanChipDropFeedback.call(this, state.board);
        removeInlinePlanChipDragPreview.call(this);
        if (state.board) removeInlinePlanClass(state.board, 'activity-chip-board-drag-active');
        this.inlinePlanChipDragState = null;
    }

    function getInlinePlanChipFromEvent(event) {
        const target = event && event.target ? event.target : null;
        if (!target || typeof target.closest !== 'function') return null;
        return target.closest('.activity-chip[data-activity-id]');
    }

    function resolveInlinePlanChipDropIntent(event, state) {
        const doc = state && state.document ? state.document : (typeof document !== 'undefined' ? document : null);
        const pointerTarget = doc && typeof doc.elementFromPoint === 'function'
            ? doc.elementFromPoint(Number(event.clientX) || 0, Number(event.clientY) || 0)
            : (event && event.target ? event.target : null);
        const chip = pointerTarget && typeof pointerTarget.closest === 'function'
            ? pointerTarget.closest('.activity-chip[data-activity-id]')
            : null;
        if (!state) return null;
        const sourceChip = state.sourceChip || null;
        const sourceBoard = sourceChip && typeof sourceChip.closest === 'function' ? sourceChip.closest('.activity-chip-board') : null;
        const sourceSection = sourceChip && sourceChip.dataset ? String(sourceChip.dataset.boardSection || '').trim() : '';
        if (!chip) {
            const targetBoard = pointerTarget && typeof pointerTarget.closest === 'function'
                ? pointerTarget.closest('.activity-chip-board')
                : null;
            const targetIsChildBoard = Boolean(
                targetBoard
                && targetBoard.classList
                && typeof targetBoard.classList.contains === 'function'
                && targetBoard.classList.contains('inline-plan-sub-board')
            );
            if (sourceBoard && targetBoard && sourceBoard !== targetBoard && sourceSection === 'children' && !targetIsChildBoard) {
                return { type: 'detach', placement: 'after', targetId: '', parentId: '', targetBoard };
            }
            return null;
        }
        const targetId = normalizeActivityBoardId(chip.dataset && chip.dataset.activityId);
        if (!targetId) return null;
        const targetBoard = chip && typeof chip.closest === 'function' ? chip.closest('.activity-chip-board') : null;
        const targetSection = chip && chip.dataset ? String(chip.dataset.boardSection || '').trim() : '';
        const rect = typeof chip.getBoundingClientRect === 'function' ? chip.getBoundingClientRect() : null;
        const width = rect && Number.isFinite(rect.width) && rect.width > 0 ? rect.width : 1;
        const x = rect && Number.isFinite(rect.left) ? (Number(event.clientX) - rect.left) : width / 2;
        const ratioX = Math.max(0, Math.min(1, x / width));
        const detachesToTopLevel = sourceBoard && targetBoard && sourceBoard !== targetBoard && sourceSection === 'children' && isPrimaryActivityChipboardSection(targetSection);
        const buildReorderIntent = (placement) => {
            const nextIntent = { type: 'reorder', placement, targetId, targetChip: chip };
            if (detachesToTopLevel) nextIntent.parentId = '';
            return nextIntent;
        };
        if (ratioX <= 0.25) return buildReorderIntent('before');
        if (ratioX >= 0.75) return buildReorderIntent('after');
        return { type: 'nest', placement: 'after', targetId, targetChip: chip };
    }

    function applyInlinePlanChipDropFeedback(intent, validation, state) {
        if (!state) return;
        clearInlinePlanChipDropFeedback.call(this, state.board);
        if (state.sourceChip) addInlinePlanClass(state.sourceChip, 'activity-chip-dragging');
        if (!intent || !intent.targetChip) return;
        const feedbackName = getInlinePlanChipDropFeedbackName(intent, validation);
        if (!validation || !validation.valid) {
            addInlinePlanClass(intent.targetChip, 'activity-chip-drop-invalid');
            applyInlinePlanChipDropLabel(intent.targetChip, feedbackName);
            return;
        }
        if (intent.type === 'nest') {
            addInlinePlanClass(intent.targetChip, 'activity-chip-drop-nest');
            applyInlinePlanChipDropLabel(intent.targetChip, feedbackName);
            return;
        }
        addInlinePlanClass(intent.targetChip, intent.placement === 'after' ? 'activity-chip-drop-after' : 'activity-chip-drop-before');
        applyInlinePlanChipDropLabel(intent.targetChip, feedbackName);
    }

    function beginInlinePlanChipDrag(event) {
        if (isInlinePlanChipDeleteModeEnabled.call(this)) return;
        if (!event || (Number.isFinite(event.button) && event.button !== 0)) return;
        const target = event.target || null;
        if (!target || typeof target.closest !== 'function') return;
        if (isInlinePlanChipDragBlockedTarget(target)) return;
        const sourceChip = getInlinePlanChipFromEvent(event);
        const sourceId = normalizeActivityBoardId(sourceChip && sourceChip.dataset && sourceChip.dataset.activityId);
        if (!sourceChip || !sourceId) return;
        const board = sourceChip.closest && sourceChip.closest('.activity-chip-board');
        const doc = (sourceChip.ownerDocument || (typeof document !== 'undefined' ? document : null));
        const win = doc && doc.defaultView ? doc.defaultView : (typeof window !== 'undefined' ? window : null);
        const sourceRect = typeof sourceChip.getBoundingClientRect === 'function' ? sourceChip.getBoundingClientRect() : null;
        const sourceWidth = sourceRect && Number.isFinite(sourceRect.width) && sourceRect.width > 0 ? sourceRect.width : null;
        const sourceHeight = sourceRect && Number.isFinite(sourceRect.height) && sourceRect.height > 0 ? sourceRect.height : null;
        const eventClientX = Number(event.clientX);
        const eventClientY = Number(event.clientY);
        const dragOffsetX = sourceRect && sourceWidth !== null && Number.isFinite(sourceRect.left) && Number.isFinite(eventClientX)
            ? Math.max(0, Math.min(sourceWidth, eventClientX - sourceRect.left))
            : null;
        const dragOffsetY = sourceRect && sourceHeight !== null && Number.isFinite(sourceRect.top) && Number.isFinite(eventClientY)
            ? Math.max(0, Math.min(sourceHeight, eventClientY - sourceRect.top))
            : null;
        cleanupInlinePlanChipDragState.call(this);

        const state = {
            board,
            sourceChip,
            sourceId,
            dragOffsetX,
            dragOffsetY,
            startX: Number.isFinite(eventClientX) ? eventClientX : 0,
            startY: Number.isFinite(eventClientY) ? eventClientY : 0,
            lastClientX: Number.isFinite(eventClientX) ? eventClientX : 0,
            lastClientY: Number.isFinite(eventClientY) ? eventClientY : 0,
            active: false,
            pointerId: Number.isFinite(event.pointerId) ? event.pointerId : null,
            captureTarget: target,
            document: doc,
            window: win,
            context: this,
            intent: null,
            validation: null,
            autoScrollClientY: Number.isFinite(eventClientY) ? eventClientY : 0,
            autoScrollFrame: null,
            autoScrollFrameType: null,
            moveHandler: null,
            endHandler: null,
            cancelHandler: null,
            keyHandler: null,
        };
        state.moveHandler = (moveEvent) => {
            if (state.pointerId !== null && Number.isFinite(moveEvent.pointerId) && moveEvent.pointerId !== state.pointerId) return;
            state.lastClientX = Number(moveEvent.clientX);
            state.lastClientY = Number(moveEvent.clientY);
            if (!state.active) {
                if (getInlinePlanChipDragDistance(state, moveEvent) < INLINE_PLAN_CHIP_DRAG_THRESHOLD_PX) {
                    if (moveEvent.cancelable) moveEvent.preventDefault();
                    if (typeof moveEvent.stopPropagation === 'function') moveEvent.stopPropagation();
                    return;
                }
                activateInlinePlanChipDragState.call(this, state, moveEvent);
            }
            updateInlinePlanChipDragPreview.call(this, state, moveEvent);
            refreshInlinePlanChipDropIntent.call(this, state);
            updateInlinePlanChipAutoScroll(state, moveEvent);
            if (moveEvent.cancelable) moveEvent.preventDefault();
            if (typeof moveEvent.stopPropagation === 'function') moveEvent.stopPropagation();
        };
        state.endHandler = (endEvent) => {
            if (state.pointerId !== null && Number.isFinite(endEvent.pointerId) && endEvent.pointerId !== state.pointerId) return;
            const endClientX = Number(endEvent && endEvent.clientX);
            const endClientY = Number(endEvent && endEvent.clientY);
            if (Number.isFinite(endClientX)) state.lastClientX = endClientX;
            if (Number.isFinite(endClientY)) state.lastClientY = endClientY;
            if (state.active) refreshInlinePlanChipDropIntent.call(this, state);
            const finalIntent = state.intent;
            const finalValidation = state.validation;
            const wasActive = state.active;
            cleanupInlinePlanChipDragState.call(this);
            if (wasActive && finalIntent && finalValidation && finalValidation.valid) {
                applyActivityChipboardDrop.call(this, state.sourceId, finalIntent);
            }
            if (wasActive && endEvent && endEvent.cancelable) endEvent.preventDefault();
            if (wasActive && endEvent && typeof endEvent.stopPropagation === 'function') endEvent.stopPropagation();
        };
        state.cancelHandler = (cancelEvent) => {
            cleanupInlinePlanChipDragState.call(this);
            if (cancelEvent && typeof cancelEvent.stopPropagation === 'function') cancelEvent.stopPropagation();
        };
        state.keyHandler = (keyEvent) => {
            if (keyEvent && keyEvent.key === 'Escape') {
                cleanupInlinePlanChipDragState.call(this);
                if (typeof keyEvent.stopPropagation === 'function') keyEvent.stopPropagation();
            }
        };
        if (doc && typeof doc.addEventListener === 'function') {
            doc.addEventListener('pointermove', state.moveHandler, true);
            doc.addEventListener('pointerup', state.endHandler, true);
            doc.addEventListener('pointercancel', state.cancelHandler, true);
            doc.addEventListener('keydown', state.keyHandler, true);
        }
        if (win && typeof win.addEventListener === 'function') {
            win.addEventListener('blur', state.cancelHandler, true);
        }
        if (target && Number.isFinite(event.pointerId) && typeof target.setPointerCapture === 'function') {
            try { target.setPointerCapture(event.pointerId); } catch (_) {}
        }
        this.inlinePlanChipDragState = state;
        if (sourceChip) addInlinePlanClass(sourceChip, 'activity-chip-drag-pending');
        if (typeof event.stopPropagation === 'function') event.stopPropagation();
    }

    function removePlannedActivityCatalogEntry(activityItem) {
        if (!activityItem || !Array.isArray(this.plannedActivities)) return false;
        const targetId = String(activityItem.id || '').trim();
        const targetLabel = getCatalogItemLabel.call(this, activityItem);
        if (!targetId && !targetLabel) return false;
        const removeIds = new Set([targetId].filter(Boolean));
        let changed = false;
        if (targetId) {
            const childIds = [];
            const queue = [targetId];
            while (queue.length > 0) {
                const currentId = queue.shift();
                this.plannedActivities.forEach((item) => {
                    if (!item) return;
                    const itemId = String(item.id || '').trim();
                    const parentId = String(item.parentId || '').trim();
                    if (parentId !== currentId || !itemId || removeIds.has(itemId)) return;
                    removeIds.add(itemId);
                    childIds.push(itemId);
                    queue.push(itemId);
                });
            }
        }
        const nextActivities = [];
        this.plannedActivities.forEach((item) => {
            if (!item) return;
            const itemId = String(item.id || '').trim();
            const itemLabel = getCatalogItemLabel.call(this, item);
            const shouldRemove = (itemId && removeIds.has(itemId)) || (!targetId && targetLabel && itemLabel === targetLabel);
            if (shouldRemove) {
                changed = true;
                return;
            }
            nextActivities.push(item);
        });
        if (!changed) return false;
        clearInlinePlanChipUndoState.call(this);
        this.plannedActivities = nextActivities;
        if (Array.isArray(this.modalSelectedActivities) && targetLabel) {
            const selectedIndex = this.modalSelectedActivities.indexOf(targetLabel);
            if (selectedIndex >= 0) this.modalSelectedActivities.splice(selectedIndex, 1);
        }
        this.dedupeAndSortPlannedActivities();
        this.savePlannedActivities();
        if (typeof this.renderPlannedActivityDropdown === 'function') {
            this.renderPlannedActivityDropdown();
        }
        if (typeof this.refreshSubActivityOptions === 'function') {
            this.refreshSubActivityOptions();
        }
        if (typeof this.renderInlinePlanDropdownOptions === 'function' && this.inlinePlanDropdown) {
            this.renderInlinePlanDropdownOptions();
        }
        return true;
    }

    function addInlinePlanClass(el, ...classNames) {
        if (!el) return false;
        const classes = classNames.filter(Boolean);
        if (!classes.length) return false;
        if (el.classList && typeof el.classList.add === 'function') {
            el.classList.add(...classes);
            return true;
        }
        const current = String(el.className || '').split(/\s+/).filter(Boolean);
        classes.forEach((className) => {
            if (!current.includes(className)) current.push(className);
        });
        el.className = current.join(' ');
        return true;
    }

    function removeInlinePlanClass(el, ...classNames) {
        if (!el) return;
        const classes = classNames.filter(Boolean);
        if (!classes.length) return;
        if (el.classList && typeof el.classList.remove === 'function') {
            el.classList.remove(...classes);
            return;
        }
        const removeSet = new Set(classes);
        el.className = String(el.className || '')
            .split(/\s+/)
            .filter(className => className && !removeSet.has(className))
            .join(' ');
    }

    function getInlinePlanSlotContextTarget(anchor) {
        if (!anchor) return null;
        if (anchor.classList && anchor.classList.contains('split-cell-wrapper') && anchor.classList.contains('split-type-planned')) {
            return anchor;
        }
        if (typeof anchor.matches === 'function' && anchor.matches('.split-cell-wrapper.split-type-planned')) {
            return anchor;
        }
        if (anchor.classList && anchor.classList.contains('planned-input')) return anchor;
        if (typeof anchor.matches === 'function' && anchor.matches('.planned-input')) return anchor;
        if (typeof anchor.querySelector === 'function') {
            const plannedWrapper = anchor.querySelector('.split-cell-wrapper.split-type-planned');
            if (plannedWrapper) return plannedWrapper;
            const plannedInput = anchor.querySelector('.planned-input');
            if (plannedInput) return plannedInput;
        }
        if (typeof anchor.closest === 'function') {
            return anchor.closest('.split-cell-wrapper.split-type-planned')
                || anchor.closest('.planned-input')
                || anchor.closest('.time-entry')
                || anchor;
        }
        return anchor;
    }

    function isMobileInlinePlanInputContext(ctx) {
        return Boolean(
            ctx
            && typeof ctx.isInlinePlanMobileInputContext === 'function'
            && ctx.isInlinePlanMobileInputContext()
        );
    }

    function shouldKeepInlinePlanOpenAfterSelection(ctx, options = {}) {
        if (!options || !options.keepOpen) return false;
        if (!isMobileInlinePlanInputContext(ctx)) return true;
        return Boolean(options.keepOpenOnMobile);
    }

    function blurInlinePlanActiveInput(ctx) {
        if (!ctx || !ctx.inlinePlanDropdown || typeof document === 'undefined') return false;
        const activeEl = document.activeElement || null;
        if (!activeEl || typeof activeEl.blur !== 'function') return false;
        const dropdown = ctx.inlinePlanDropdown;
        if (dropdown.contains && !dropdown.contains(activeEl)) return false;
        try {
            activeEl.blur();
            return true;
        } catch (_) {
            return false;
        }
    }

function applyActivityCatalogSelection(activityItem, parentItem = null, options = {}) {
        if (!activityItem) return;
        const keepOpenAfterSelection = shouldKeepInlinePlanOpenAfterSelection(this, options);
        if (this.inlinePlanSegmentTitleEditSession) {
            this.inlinePlanSegmentTitleEditSession = null;
        }

        if (this.inlinePlanTarget && this.inlinePlanTarget.mode === 'plan-segment-replace') {
            const baseIndex = Number.isInteger(this.inlinePlanTarget.baseIndex)
                ? this.inlinePlanTarget.baseIndex
                : Number(this.inlinePlanTarget.startIndex);
            const segmentIndex = Number(this.inlinePlanTarget.segmentIndex);
            const replaced = Number.isInteger(baseIndex)
                && Number.isInteger(segmentIndex)
                && typeof this.replacePlanSegmentActivity === 'function'
                && this.replacePlanSegmentActivity(baseIndex, segmentIndex, activityItem, parentItem || null);
            if (!replaced) return;
            const touched = this.touchPlannedActivityUsage ? this.touchPlannedActivityUsage(activityItem, parentItem || null) : null;
            if (touched) {
                this.dedupeAndSortPlannedActivities();
                this.savePlannedActivities();
                if (typeof this.renderInlinePlanDropdownOptions === 'function') {
                    this.renderInlinePlanDropdownOptions();
                }
            }
            this.renderTimeEntries(keepOpenAfterSelection);
            this.calculateTotals();
            this.autoSave();
            if (keepOpenAfterSelection && options && options.keepOpenSegmentReplace) {
                if (typeof this.renderInlinePlanDropdownOptions === 'function') {
                    this.renderInlinePlanDropdownOptions();
                }
                if (typeof this.positionInlinePlanDropdown === 'function') {
                    this.positionInlinePlanDropdown();
                }
            } else {
                this.closeInlinePlanDropdown();
            }
            return;
        }

        if (!this.inlinePlanTarget) {
            if (this.selectedPlanSegment && typeof this.replaceSelectedPlanSegmentActivity === 'function') {
                const replaced = this.replaceSelectedPlanSegmentActivity(activityItem, parentItem || null);
                if (replaced) {
                    const touched = this.touchPlannedActivityUsage ? this.touchPlannedActivityUsage(activityItem, parentItem || null) : null;
                    if (touched) {
                        this.dedupeAndSortPlannedActivities();
                        this.savePlannedActivities();
                        if (typeof this.renderInlinePlanDropdownOptions === 'function') {
                            this.renderInlinePlanDropdownOptions();
                        }
                    }
                    return;
                }
            }
            return;
        }

        const activityText = getCatalogItemLabel.call(this, activityItem);
        if (!activityText) return;
        const titleText = parentItem ? getCatalogItemLabel.call(this, parentItem) : null;

        const safeStart = Number.isInteger(this.inlinePlanTarget.startIndex) ? this.inlinePlanTarget.startIndex : 0;
        const safeEnd = Number.isInteger(this.inlinePlanTarget.endIndex) ? this.inlinePlanTarget.endIndex : safeStart;
        const startIndex = Math.min(safeStart, safeEnd);
        const endIndex = Math.max(safeStart, safeEnd);
        const baseIndex = Number.isInteger(this.inlinePlanTarget.baseIndex) ? this.inlinePlanTarget.baseIndex : startIndex;
        const rangeStart = Number.isInteger(this.inlinePlanTarget.rangeStart) ? this.inlinePlanTarget.rangeStart : startIndex;
        const rangeEnd = Number.isInteger(this.inlinePlanTarget.rangeEnd) ? this.inlinePlanTarget.rangeEnd : endIndex;
        const seconds = getInlinePlanSelectionSeconds.call(this);
        const planItem = {
            label: activityText,
            seconds,
            titleActivityId: parentItem ? (String(parentItem.id || '').trim() || null) : null,
            titleText,
            activityId: String(activityItem.id || '').trim() || null,
            activityText,
        };

        if (isVirtualRestGapTarget(this.inlinePlanTarget)) {
            const baseSlot = this.timeSlots[baseIndex];
            if (!baseSlot) return;
            baseSlot.planActivities = buildPlanActivitiesWithVirtualGapFill(
                this.normalizePlanActivitiesArray ? this.normalizePlanActivitiesArray(baseSlot.planActivities) : baseSlot.planActivities,
                planItem,
                this.inlinePlanTarget
            );
            const summary = this.formatActivitiesSummary ? this.formatActivitiesSummary(baseSlot.planActivities) : activityText;
            baseSlot.planned = summary || activityText;
            baseSlot.planTitle = titleText || '';
            baseSlot.planTitleBandOn = Boolean(titleText);
            for (let i = rangeStart; i <= rangeEnd; i++) {
                if (i === baseIndex) continue;
                if (!this.timeSlots[i]) continue;
                this.timeSlots[i].planned = '';
                this.timeSlots[i].planActivities = [];
                this.timeSlots[i].planTitle = '';
                this.timeSlots[i].planTitleBandOn = false;
            }
        } else if (this.inlinePlanTarget.mergeKey) {
            this.mergedFields.set(this.inlinePlanTarget.mergeKey, activityText);
            for (let i = rangeStart; i <= rangeEnd; i++) {
                if (!this.timeSlots[i]) continue;
                const isStart = i === baseIndex;
                this.timeSlots[i].planned = isStart ? activityText : '';
                this.timeSlots[i].planActivities = isStart ? [{ ...planItem }] : [];
                this.timeSlots[i].planTitle = isStart && titleText ? titleText : '';
                this.timeSlots[i].planTitleBandOn = Boolean(isStart && titleText);
            }
        } else {
            for (let i = startIndex; i <= endIndex; i++) {
                if (!this.timeSlots[i]) continue;
                const isStart = i === startIndex;
                this.timeSlots[i].planned = isStart ? activityText : '';
                this.timeSlots[i].planActivities = isStart ? [{ ...planItem }] : [];
                this.timeSlots[i].planTitle = isStart && titleText ? titleText : '';
                this.timeSlots[i].planTitleBandOn = Boolean(isStart && titleText);
            }
        }

        this.modalPlanActivities = [{ ...planItem, invalid: false }];
        this.modalPlanActiveRow = 0;
        this.modalPlanTitle = titleText || '';
        this.modalPlanTitleBandOn = Boolean(titleText);

        const touched = this.touchPlannedActivityUsage ? this.touchPlannedActivityUsage(activityItem, parentItem || null) : null;
        if (touched) {
            this.dedupeAndSortPlannedActivities();
            this.savePlannedActivities();
            if (typeof this.renderInlinePlanDropdownOptions === 'function') {
                this.renderInlinePlanDropdownOptions();
            }
        }

        this.renderTimeEntries(keepOpenAfterSelection);
        this.calculateTotals();
        this.autoSave();
        if (keepOpenAfterSelection && this.inlinePlanTarget) {
            const anchor = document.querySelector(`[data-index="${baseIndex}"] .planned-merged-main-container`)
                || document.querySelector(`[data-index="${baseIndex}"] .planned-input`)
                || document.querySelector(`[data-index="${baseIndex}"]`);
            if (anchor) {
                setInlinePlanAnchorState.call(this, anchor);
                this.positionInlinePlanDropdown(anchor);
            }
            return;
        }
        this.closeInlinePlanDropdown();
    }

    function renderInlinePlanDropdownOptions() {
        if (!this.inlinePlanDropdown || !this.inlinePlanTarget) return;
        if (this.inlinePlanChipDragState) cleanupInlinePlanChipDragState.call(this);
        if (this.inlinePriorityMenu) {
            this.closeInlinePriorityMenu();
        }
        const boardShell = this.inlinePlanDropdown.querySelector('.activity-chip-board-shell');
        const board = this.inlinePlanDropdown.querySelector('.activity-chip-board');
        if (!board) return;
        const actions = boardShell && typeof boardShell.querySelector === 'function'
            ? boardShell.querySelector('.activity-chip-board-actions')
            : null;
        const deleteModeEnabled = isInlinePlanChipDeleteModeEnabled.call(this);
        if (this.inlinePlanDropdown.classList && typeof this.inlinePlanDropdown.classList.toggle === 'function') {
            this.inlinePlanDropdown.classList.toggle('inline-plan-chip-delete-mode', deleteModeEnabled);
        }
        if (board.classList && typeof board.classList.toggle === 'function') {
            board.classList.toggle('activity-chip-board-delete-mode', deleteModeEnabled);
            board.classList.toggle('activity-chip-board-reorder-enabled', !deleteModeEnabled);
        }
        if (actions) actions.innerHTML = '';

        if (typeof this.repairPlannedActivityCatalogIdentity === 'function') {
            this.repairPlannedActivityCatalogIdentity({ save: true });
        }

        const catalogGrouped = this.groupActivityBoard(this.plannedActivities || []);
        const searchInput = this.inlinePlanDropdown.querySelector('.inline-plan-input');
        const searchQuery = searchInput ? (searchInput.value || '') : '';
        const normalizedQuery = this.normalizeActivityText ? this.normalizeActivityText(searchQuery || '') : String(searchQuery || '').trim();
        const queryMatches = (item) => {
            if (!normalizedQuery) return true;
            const label = getCatalogItemLabel.call(this, item);
            return label.toLowerCase().includes(normalizedQuery.toLowerCase());
        };
        const topLevelItems = (catalogGrouped.topLevel || []).filter((item) => item && !item.archived && queryMatches(item));
        const childItems = (catalogGrouped.children || []).filter((item) => item && !item.archived && queryMatches(item));
        const searchResults = [];
        const seenSearchIds = new Set();
        topLevelItems.forEach((item) => {
            const id = String(item.id || '').trim();
            if (!id || seenSearchIds.has(id)) return;
            searchResults.push({ kind: 'parent', item, parent: null });
            seenSearchIds.add(id);
        });
        childItems.forEach((item) => {
            const id = String(item.id || '').trim();
            if (!id || seenSearchIds.has(id)) return;
            const parent = item.parentId ? catalogGrouped.byId.get(item.parentId) : null;
            if (!parent) return;
            searchResults.push({ kind: 'child', item, parent });
            seenSearchIds.add(id);
        });

        const sectionMap = {
            search: normalizedQuery ? searchResults : [],
            pinned: topLevelItems.filter((item) => item.pinned),
            parents: (catalogGrouped.parents || []).filter((item) => item && !item.archived),
            all: topLevelItems,
        };

        const renderChip = (item, sectionKey = '') => {
            const label = getCatalogItemLabel.call(this, item);
            if (!label) return null;
            const canHaveChildBoard = !item.parentId;
            const childItemsForParent = canHaveChildBoard
                ? (catalogGrouped.byParentId.get(String(item.id || '')) || []).filter((child) => child && child.id !== item.id)
                : [];
            const hasChildren = childItemsForParent.length > 0;
            const canOpenChildBoard = canHaveChildBoard && hasChildren;
            const chip = document.createElement('span');
            chip.className = `activity-chip${canOpenChildBoard ? ' activity-chip-parent activity-chip-split' : ''}`;
            chip.dataset.label = label;
            const itemId = String(item.id || '').trim();
            const normalizedSectionKey = String(sectionKey || 'unknown').trim() || 'unknown';
            const chipInstanceKey = `${normalizedSectionKey}::${itemId}`;
            chip.dataset.activityId = itemId;
            chip.dataset.boardSection = normalizedSectionKey;
            chip.dataset.chipInstanceKey = chipInstanceKey;
            if (canOpenChildBoard) chip.dataset.parentId = itemId;
            const currentOpenParentId = String(this.modalPlanSectionOpenParentId || '').trim();
            const isOpenParent = canOpenChildBoard && this.modalPlanSectionOpen && currentOpenParentId === itemId;
            if (isOpenParent) chip.classList.add('activity-chip-open');

            if (!deleteModeEnabled && isPrimaryActivityChipboardSection(normalizedSectionKey)) {
                chip.dataset.draggableActivity = 'true';
                chip.addEventListener('pointerdown', (event) => {
                    beginInlinePlanChipDrag.call(this, event);
                });
            }

            const labelButton = document.createElement('span');
            labelButton.className = 'activity-chip-main';
            labelButton.setAttribute('role', 'button');
            labelButton.setAttribute('tabindex', '0');
            labelButton.setAttribute('aria-label', `${label} 선택`);
            labelButton.title = `${label} 선택`;
            const text = document.createElement('span');
            text.className = 'activity-chip-label';
            text.textContent = label;
            labelButton.appendChild(text);
            labelButton.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (deleteModeEnabled) return;
                const parent = item && item.parentId ? catalogGrouped.byId.get(item.parentId) : null;
                applyActivityCatalogSelection.call(this, item, parent || null, { keepOpen: true });
            });
            labelButton.addEventListener('keydown', (event) => {
                if (!event || (event.key !== 'Enter' && event.key !== ' ')) return;
                event.preventDefault();
                event.stopPropagation();
                if (deleteModeEnabled) return;
                const parent = item && item.parentId ? catalogGrouped.byId.get(item.parentId) : null;
                applyActivityCatalogSelection.call(this, item, parent || null, { keepOpen: true });
            });
            chip.appendChild(labelButton);

            if (deleteModeEnabled) {
                const deleteBtn = document.createElement('button');
                deleteBtn.type = 'button';
                deleteBtn.className = 'activity-chip-delete';
                deleteBtn.dataset.activityId = itemId;
                deleteBtn.dataset.boardSection = normalizedSectionKey;
                deleteBtn.dataset.chipInstanceKey = chipInstanceKey;
                deleteBtn.setAttribute('aria-label', `${label} 삭제`);
                deleteBtn.title = `${label} 삭제`;
                deleteBtn.textContent = '×';
                deleteBtn.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const removed = removePlannedActivityCatalogEntry.call(this, item);
                    if (!removed) return;
                    if (this.modalPlanSectionOpen && currentOpenParentId === itemId) {
                        this.closePlanActivityChildMenu({ rerender: false });
                    }
                });
                chip.appendChild(deleteBtn);
            }

            if (canOpenChildBoard) {
                const caret = document.createElement('button');
                caret.type = 'button';
                caret.className = 'activity-chip-caret';
                caret.dataset.activityId = itemId;
                caret.dataset.boardSection = normalizedSectionKey;
                caret.dataset.chipInstanceKey = chipInstanceKey;
                caret.innerHTML = `
                    <svg
                        viewBox="0 0 20 20"
                        fill="none"
                        aria-hidden="true"
                        focusable="false"
                    >
                        <path
                            d="M5.75 7.75L10 12.25L14.25 7.75"
                            stroke="currentColor"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                    </svg>
                `;
                caret.setAttribute('aria-label', `${label} 세부활동 추가 또는 보기`);
                caret.title = `${label} 세부활동 추가 또는 보기`;
                caret.setAttribute('aria-expanded', isOpenParent ? 'true' : 'false');
                caret.setAttribute('aria-controls', 'inline-plan-subsection');
                caret.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const parentId = String(item.id || '').trim();
                    const currentlyOpenParentId = String(this.modalPlanSectionOpenParentId || '').trim();
                    const clickedInstanceKey = String(caret.dataset.chipInstanceKey || '').trim();
                    const openInstanceKey = String(this.inlinePlanChildPopoverAnchorInstanceKey || '').trim();
                    if (
                        this.modalPlanSectionOpen
                        && currentlyOpenParentId === parentId
                        && openInstanceKey
                        && clickedInstanceKey
                        && openInstanceKey === clickedInstanceKey
                    ) {
                        this.closePlanActivityChildMenu();
                        return;
                    }
                    this.inlinePlanChildPopoverAnchorEl = caret;
                    this.inlinePlanChildPopoverAnchorSectionKey = caret.dataset.boardSection || '';
                    this.inlinePlanChildPopoverAnchorInstanceKey = caret.dataset.chipInstanceKey || '';
                    this.openPlanActivityChildMenu(item, caret, childItemsForParent);
                });
                chip.appendChild(caret);
            }

            return chip;
        };

        const renderSearchChip = (entry, sectionKey = '') => {
            if (!entry || !entry.item) return null;
            const item = entry.item;
            const parent = entry.parent || null;
            const label = parent ? `${getCatalogItemLabel.call(this, item)} · ${getCatalogItemLabel.call(this, parent)}` : getCatalogItemLabel.call(this, item);
            if (!label) return null;
            const chip = document.createElement('span');
            chip.className = 'activity-chip';
            chip.dataset.label = label;
            const itemId = String(item.id || '').trim();
            const normalizedSectionKey = String(sectionKey || 'unknown').trim() || 'unknown';
            chip.dataset.activityId = itemId;
            chip.dataset.boardSection = normalizedSectionKey;
            chip.dataset.chipInstanceKey = `${normalizedSectionKey}::${itemId}`;
            const btn = document.createElement('span');
            btn.className = 'activity-chip-main';
            btn.setAttribute('role', 'button');
            btn.setAttribute('tabindex', '0');
            btn.setAttribute('aria-label', parent ? `${getCatalogItemLabel.call(this, item)} · ${getCatalogItemLabel.call(this, parent)}` : `${label} 선택`);
            btn.title = parent ? `${getCatalogItemLabel.call(this, item)} · ${getCatalogItemLabel.call(this, parent)}` : `${label} 선택`;
            const text = document.createElement('span');
            text.className = 'activity-chip-label';
            text.textContent = label;
            btn.appendChild(text);
            btn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (deleteModeEnabled) return;
                applyActivityCatalogSelection.call(this, item, parent, { keepOpen: true });
            });
            btn.addEventListener('keydown', (event) => {
                if (!event || (event.key !== 'Enter' && event.key !== ' ')) return;
                event.preventDefault();
                event.stopPropagation();
                if (deleteModeEnabled) return;
                applyActivityCatalogSelection.call(this, item, parent, { keepOpen: true });
            });
            chip.appendChild(btn);
            if (deleteModeEnabled) {
                const deleteBtn = document.createElement('button');
                deleteBtn.type = 'button';
                deleteBtn.className = 'activity-chip-delete';
                deleteBtn.dataset.activityId = itemId;
                deleteBtn.dataset.boardSection = normalizedSectionKey;
                deleteBtn.dataset.chipInstanceKey = `${normalizedSectionKey}::${itemId}`;
                deleteBtn.setAttribute('aria-label', `${label} 삭제`);
                deleteBtn.title = `${label} 삭제`;
                deleteBtn.textContent = '×';
                deleteBtn.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    removePlannedActivityCatalogEntry.call(this, item);
                });
                chip.appendChild(deleteBtn);
            }
            return chip;
        };

        board.innerHTML = '';
        renderInlinePlanChipUndoControl.call(this, board);
        const sections = [
            { title: '검색 결과', key: 'search' },
            { title: '고정', key: 'pinned' },
            { title: '전체 활동군', key: 'parents' },
            { title: '전체 활동', key: 'all' },
        ];
        let renderedSectionCount = 0;
        const deleteModeToggle = document.createElement('button');
        deleteModeToggle.type = 'button';
        deleteModeToggle.className = 'activity-chip-delete-mode-toggle';
        deleteModeToggle.setAttribute('aria-pressed', deleteModeEnabled ? 'true' : 'false');
        deleteModeToggle.textContent = deleteModeEnabled ? '삭제 모드 ON' : '삭제 모드';
        deleteModeToggle.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const nextValue = !isInlinePlanChipDeleteModeEnabled.call(this);
            setInlinePlanChipDeleteMode.call(this, nextValue);
            renderInlinePlanDropdownOptions.call(this);
        });
        if (actions) {
            actions.innerHTML = '';
            actions.appendChild(deleteModeToggle);
        }
        sections.forEach((section) => {
            const items = sectionMap[section.key] || [];
            if (items.length === 0) return;
            if (section.key === 'all' && areActivityListsEquivalent(items, sectionMap.parents)) return;
            renderedSectionCount += 1;
            const wrap = document.createElement('section');
            wrap.className = 'activity-chip-board-section';
            const heading = document.createElement('div');
            heading.className = 'activity-chip-board-title';
            heading.textContent = section.title;
            wrap.appendChild(heading);
            const row = document.createElement('div');
            row.className = 'activity-chip-row';
            items.forEach((item) => {
                const chip = section.key === 'search' ? renderSearchChip(item, section.key) : renderChip(item, section.key);
                if (chip) row.appendChild(chip);
            });
            wrap.appendChild(row);
            board.appendChild(wrap);
        });
        if (renderedSectionCount === 0) {
            const empty = document.createElement('div');
            empty.className = 'inline-plan-empty';
            empty.textContent = normalizedQuery ? '검색 결과가 없습니다.' : '등록된 활동이 없습니다.';
            const emptyRow = document.createElement('div');
            emptyRow.className = 'activity-chip-row';
            emptyRow.appendChild(empty);
            board.appendChild(emptyRow);
        }
        const currentAnchor = getInlinePlanAnchorState.call(this);
        if (currentAnchor && this.positionInlinePlanDropdown) {
            this.positionInlinePlanDropdown(currentAnchor);
        }
    }

function createChildActivityForParent(parentItem, rawName) {
        const normalizedName = this.normalizeActivityText ? this.normalizeActivityText(rawName) : String(rawName || '').trim();
        if (!normalizedName) return { status: 'empty' };

        if (typeof this.repairPlannedActivityCatalogIdentity === 'function') {
            this.repairPlannedActivityCatalogIdentity({ save: false });
        }

        const originalParentId = String(parentItem && parentItem.id ? parentItem.id : '').trim();
        const parentLabel = this.normalizeActivityText
            ? this.normalizeActivityText(parentItem && (parentItem.label || parentItem.name || parentItem.title || ''))
            : String(parentItem && (parentItem.label || parentItem.name || parentItem.title || '')).trim();
        const repairedParent = (Array.isArray(this.plannedActivities) ? this.plannedActivities : []).find((item) => {
            if (!item || item.parentId) return false;
            const itemLabel = this.normalizeActivityText
                ? this.normalizeActivityText(item.label || item.name || item.title || '')
                : String(item.label || item.name || item.title || '').trim();
            const itemId = String(item.id || '').trim();
            if (originalParentId && itemId === originalParentId) return true;
            return Boolean(parentLabel) && itemLabel === parentLabel;
        }) || parentItem;
        const parentId = String(repairedParent && repairedParent.id ? repairedParent.id : '').trim();
        if (!parentId) {
            this.inlineChildComposerError = '부모 활동을 찾을 수 없습니다.';
            this.inlineChildComposerHighlightId = null;
            this.inlineChildComposerHighlightKind = null;
            return { status: 'invalid-parent' };
        }
        const currentItems = Array.isArray(this.plannedActivities) ? this.plannedActivities : [];
        const existing = currentItems.find((item) => {
            if (!item || String(item.parentId || '').trim() !== parentId) return false;
            const currentName = this.normalizeActivityText(item.label || item.title || item.name || '');
            return currentName === normalizedName;
        });
        if (existing) {
            this.inlineChildComposerError = '이미 있는 세부활동입니다.';
            this.inlineChildComposerHighlightId = existing.id || null;
            this.inlineChildComposerHighlightKind = 'duplicate';
            return { status: 'duplicate', item: existing };
        }

        const child = {
            id: `${parentId}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
            name: normalizedName,
            label: normalizedName,
            title: normalizedName,
            normalizedName,
            parentId,
            colorKey: parentItem && parentItem.colorKey ? parentItem.colorKey : null,
            defaultDurationMinutes: parentItem && parentItem.defaultDurationMinutes ? parentItem.defaultDurationMinutes : null,
            displayMode: parentItem && parentItem.displayMode ? parentItem.displayMode : 'chip',
            pinned: false,
            archived: false,
            usageCount: 0,
            lastUsedAt: null,
            source: 'local',
        };
        this.plannedActivities.push(child);
        clearInlinePlanChipUndoState.call(this);
        this.dedupeAndSortPlannedActivities();
        this.savePlannedActivities();
        this.inlineChildComposerError = '';
        this.inlineChildComposerHighlightId = child.id || null;
        this.inlineChildComposerHighlightKind = 'new';
        this.inlineChildComposerValue = '';
        return { status: 'created', item: child };
    }

function closePlanActivityChildMenu(options = {}) {
        const section = getInlinePlanChildPopoverSection.call(this);
        if (section) {
            section.hidden = true;
            if (section.style) {
                section.style.visibility = 'hidden';
                if (typeof section.style.removeProperty === 'function') {
                    section.style.removeProperty('--inline-plan-subsection-notch-left');
                }
            }
            if (section.classList && typeof section.classList.remove === 'function') {
                section.classList.remove('inline-plan-subsection-anchored');
                section.classList.remove('inline-plan-subsection-flow');
            }
        }
        if (
            this.inlinePlanDropdown
            && this.inlinePlanDropdown.classList
            && typeof this.inlinePlanDropdown.classList.remove === 'function'
        ) {
            this.inlinePlanDropdown.classList.remove('inline-plan-child-popover-open');
        }
        if (this.inlinePlanChildPopoverLayer) this.inlinePlanChildPopoverLayer.hidden = true;
        this.modalPlanSectionOpen = false;
        this.modalPlanSectionOpenParentId = null;
        this.inlineChildComposerOpenParentId = null;
        this.inlineChildComposerError = '';
        this.inlineChildComposerHighlightId = null;
        this.inlineChildComposerHighlightKind = null;
        this.inlineChildComposerValue = '';
        this.inlineChildComposerFocusPending = false;
        this.inlinePlanChildPopoverAnchorEl = null;
        this.inlinePlanChildPopoverAnchorSectionKey = null;
        this.inlinePlanChildPopoverAnchorInstanceKey = null;

        if (options.rerender !== false && typeof this.renderInlinePlanDropdownOptions === 'function') {
            this.renderInlinePlanDropdownOptions();
        }

        const targetAnchor = getInlinePlanAnchorState.call(this);
        if (targetAnchor && this.positionInlinePlanDropdown) {
            this.positionInlinePlanDropdown(targetAnchor);
        }
    }

function openPlanActivityChildMenu(parentItem, anchorEl, children = []) {
        if (!this.inlinePlanDropdown || !this.inlinePlanTarget || !parentItem) return;
        const section = getInlinePlanChildPopoverSection.call(this);
        const board = queryInlinePlanChildPopoverPart(section, this.inlinePlanDropdown, '.inline-plan-sub-board');
        const actions = queryInlinePlanChildPopoverPart(section, this.inlinePlanDropdown, '.inline-plan-child-actions');
        const backBtn = queryInlinePlanChildPopoverPart(section, this.inlinePlanDropdown, '.inline-plan-sub-back');
        const closeBtn = queryInlinePlanChildPopoverPart(section, this.inlinePlanDropdown, '.inline-plan-subsection-close');
        const title = queryInlinePlanChildPopoverPart(section, this.inlinePlanDropdown, '.inline-plan-subsection-title');
        if (!section || !board || !actions) return;

        const parentLabel = getCatalogItemLabel.call(this, parentItem);
        const parentId = String(parentItem.id || '').trim();
        if (!parentId) return;
        const deleteModeEnabled = isInlinePlanChipDeleteModeEnabled.call(this);
        if (board.classList && typeof board.classList.toggle === 'function') {
            board.classList.toggle('activity-chip-board-delete-mode', deleteModeEnabled);
            board.classList.toggle('activity-chip-board-reorder-enabled', !deleteModeEnabled);
        }
        section.hidden = false;
        if (section.style) section.style.visibility = 'visible';
        if (this.inlinePlanDropdown.classList && typeof this.inlinePlanDropdown.classList.add === 'function') {
            this.inlinePlanDropdown.classList.add('inline-plan-child-popover-open');
        }
        if (!section.id) section.id = 'inline-plan-subsection';
        this.modalPlanSectionOpen = true;
        this.modalPlanSectionOpenParentId = parentId;
        this.inlinePlanChildPopoverAnchorEl = anchorEl || null;
        if (anchorEl && anchorEl.dataset) {
            this.inlinePlanChildPopoverAnchorSectionKey = anchorEl.dataset.boardSection || this.inlinePlanChildPopoverAnchorSectionKey || '';
            this.inlinePlanChildPopoverAnchorInstanceKey = anchorEl.dataset.chipInstanceKey || this.inlinePlanChildPopoverAnchorInstanceKey || '';
        }
        const composerOpenParentId = String(this.inlineChildComposerOpenParentId || '').trim();
        if (composerOpenParentId && composerOpenParentId !== parentId) {
            this.inlineChildComposerError = '';
            this.inlineChildComposerHighlightId = null;
            this.inlineChildComposerHighlightKind = null;
            this.inlineChildComposerValue = '';
            this.inlineChildComposerFocusPending = false;
        }
        this.inlineChildComposerOpenParentId = parentId;
        board.innerHTML = '';
        actions.innerHTML = '';
        if (backBtn) {
            backBtn.hidden = true;
            backBtn.setAttribute('aria-hidden', 'true');
            backBtn.onclick = null;
        }
        if (closeBtn) {
            closeBtn.setAttribute('aria-label', '세부활동 설정 닫기');
            closeBtn.title = '세부활동 설정 닫기';
            closeBtn.onclick = (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.closePlanActivityChildMenu();
            };
        }

        if (title) {
            title.textContent = parentLabel ? `${parentLabel}의 세부활동` : '세부활동';
        }

        const childRow = document.createElement('div');
        childRow.className = 'activity-chip-row';

        const childTitle = document.createElement('div');
        childTitle.className = 'activity-chip-board-title';
        childTitle.textContent = '세부활동';
        board.appendChild(childTitle);
        childTitle.hidden = true;

        (Array.isArray(children) ? children : []).forEach((child) => {
            const childLabel = getCatalogItemLabel.call(this, child);
            if (!childLabel) return;
            const btn = document.createElement('span');
            btn.className = 'activity-chip';
            const childId = String(child.id || '').trim();
            if (String(this.inlineChildComposerHighlightId || '').trim() === childId) {
                btn.className += ` ${this.inlineChildComposerHighlightKind === 'duplicate' ? 'activity-chip-duplicate-highlight' : 'activity-chip-new-highlight'}`;
            }
            btn.dataset.label = childLabel;
            btn.dataset.activityId = childId;
            btn.dataset.boardSection = 'children';
            btn.dataset.chipInstanceKey = `children::${childId}`;
            btn.dataset.draggableActivity = deleteModeEnabled ? 'false' : 'true';
            btn.setAttribute('role', 'button');
            btn.setAttribute('tabindex', '0');
            btn.setAttribute('aria-label', `${childLabel} 선택`);
            btn.title = `${childLabel} 선택`;
            btn.textContent = childLabel;
            if (!deleteModeEnabled) {
                btn.addEventListener('pointerdown', (event) => {
                    beginInlinePlanChipDrag.call(this, event);
                });
            }
            btn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (deleteModeEnabled) return;
                applyActivityCatalogSelection.call(this, child, parentItem, { keepOpen: true });
            });
            btn.addEventListener('keydown', (event) => {
                if (!event || (event.key !== 'Enter' && event.key !== ' ')) return;
                event.preventDefault();
                event.stopPropagation();
                if (deleteModeEnabled) return;
                applyActivityCatalogSelection.call(this, child, parentItem, { keepOpen: true });
            });
            childRow.appendChild(btn);
        });

        if (childRow.children.length > 0) {
            board.appendChild(childRow);
        } else {
            const empty = document.createElement('div');
            empty.className = 'inline-plan-empty';
            empty.textContent = '아직 세부활동이 없습니다.';
            childRow.appendChild(empty);
            board.appendChild(childRow);
        }

        if (typeof this.renderInlinePlanDropdownOptions === 'function') {
            this.renderInlinePlanDropdownOptions();
        }

        const freshAnchor = getOpenParentCaretAnchor.call(this) || anchorEl || null;
        if (freshAnchor) {
            this.inlinePlanChildPopoverAnchorEl = freshAnchor;
            if (freshAnchor.dataset) {
                this.inlinePlanChildPopoverAnchorSectionKey = freshAnchor.dataset.boardSection || this.inlinePlanChildPopoverAnchorSectionKey || '';
                this.inlinePlanChildPopoverAnchorInstanceKey = freshAnchor.dataset.chipInstanceKey || this.inlinePlanChildPopoverAnchorInstanceKey || '';
            }
        }

        const targetAnchor = getInlinePlanAnchorState.call(this);
        if (targetAnchor && this.positionInlinePlanDropdown) {
            this.positionInlinePlanDropdown(targetAnchor);
        }
    }
function openRoutineMenuFromInlinePlan(label, anchorEl) {
        if (!anchorEl || !anchorEl.isConnected) return;
        if (!this.inlinePlanTarget) return;
        if (!this.ensureRoutinesAvailableOrNotify()) return;

        const normalizedLabel = this.normalizeActivityText ? this.normalizeActivityText(label) : String(label || '').trim();
        if (!normalizedLabel) return;

        const range = this.getInlineTargetRange();
        const ctxIndex = range && Number.isInteger(range.startIndex) ? range.startIndex : null;
        const windowInfo = range ? this.getRoutineWindowFromRange(range.startIndex, range.endIndex) : null;

        const routineAtIndex = Number.isInteger(ctxIndex)
            ? this.findRoutineForLabelAtIndex(normalizedLabel, ctxIndex, this.currentDate)
            : null;
        const routineForWindow = windowInfo ? this.findRoutineForLabelAndWindow(normalizedLabel, windowInfo.startHour, windowInfo.durationHours) : null;

        this.closeRoutineMenu();

        const menu = document.createElement('div');
        menu.className = 'routine-menu';
        menu.setAttribute('role', 'menu');
        menu.innerHTML = `
            <button type="button" class="routine-menu-item" data-action="daily" role="menuitem">매일</button>
            <button type="button" class="routine-menu-item" data-action="weekday" role="menuitem">평일</button>
            <button type="button" class="routine-menu-item" data-action="weekend" role="menuitem">주말</button>
            <div class="routine-menu-divider" role="separator"></div>
            <button type="button" class="routine-menu-item" data-action="pass" role="menuitem">패스</button>
            <button type="button" class="routine-menu-item danger" data-action="stop" role="menuitem">루틴 중단</button>
        `;
        document.body.appendChild(menu);
        this.routineMenu = menu;
        this.routineMenuContext = {
            label: normalizedLabel,
            rawLabel: label,
            anchorEl,
            ctxIndex,
            windowInfo,
            routineAtIndex,
            routineForWindow
        };

        const routineActiveForDate = routineAtIndex && this.isRoutineActiveOnDate(routineAtIndex, this.currentDate);
        if (routineActiveForDate) {
            const p = this.normalizeRoutinePattern(routineAtIndex.pattern);
            const activeBtn = menu.querySelector(`[data-action="${p}"]`);
            if (activeBtn) activeBtn.classList.add('active');
        }

        const passBtn = menu.querySelector('[data-action="pass"]');
        const stopBtn = menu.querySelector('[data-action="stop"]');
        if (!routineActiveForDate) {
            if (passBtn) passBtn.disabled = true;
            if (stopBtn) stopBtn.disabled = true;
        } else {
            const passed = Array.isArray(routineAtIndex.passDates) && routineAtIndex.passDates.includes(this.currentDate);
            if (passBtn && passed) {
                passBtn.classList.add('active');
            }
        }

        menu.addEventListener('click', (event) => {
            const btn = event.target.closest('.routine-menu-item');
            if (!btn || !menu.contains(btn)) return;
            if (btn.disabled) return;
            const action = String(btn.dataset.action || '').trim();
            if (!action) return;
            event.preventDefault();
            event.stopPropagation();
            this.handleRoutineMenuAction(action);
        });

        this.positionRoutineMenu(anchorEl);

        this.routineMenuOutsideHandler = (event) => {
            if (!this.routineMenu) return;
            const t = event.target;
            if (this.routineMenu.contains(t)) return;
            if (anchorEl && (t === anchorEl || (anchorEl.contains && anchorEl.contains(t)))) return;
            this.closeRoutineMenu();
        };
        document.addEventListener('mousedown', this.routineMenuOutsideHandler, true);

        this.routineMenuEscHandler = (event) => {
            if (event.key === 'Escape') {
                this.closeRoutineMenu();
            }
        };
        document.addEventListener('keydown', this.routineMenuEscHandler);
    }

function isSameInlinePlanTarget(range, anchorEl = null) {
        const current = getInlinePlanTargetState.call(this);
        if (!current || !range) return false;

        const currentStart = Number.isInteger(current.startIndex) ? current.startIndex : null;
        const currentEnd = Number.isInteger(current.endIndex) ? current.endIndex : currentStart;
        const nextStart = Number.isInteger(range.startIndex) ? range.startIndex : null;
        const nextEnd = Number.isInteger(range.endIndex) ? range.endIndex : nextStart;

        if (currentStart !== nextStart || currentEnd !== nextEnd) {
            return false;
        }
        const currentMode = String(current.mode || '');
        const nextMode = String(range.mode || '');
        if (currentMode !== nextMode) return false;
        if (currentMode === 'virtual-rest-gap') {
            const currentGapStart = Number(current.gapStartMinute);
            const nextGapStart = Number(range.gapStartMinute);
            const currentGapDuration = Number(current.gapDurationMinutes);
            const nextGapDuration = Number(range.gapDurationMinutes);
            return Number.isFinite(currentGapStart)
                && Number.isFinite(nextGapStart)
                && Number.isFinite(currentGapDuration)
                && Number.isFinite(nextGapDuration)
                && currentGapStart === nextGapStart
                && currentGapDuration === nextGapDuration;
        }
        if (currentMode === 'plan-segment-replace') {
            return Number(current.segmentIndex) === Number(range.segmentIndex)
                && String(current.segmentId || '') === String(range.segmentId || '');
        }
        return true;
    }

function isEventWithinCurrentInlinePlanRange(targetEl) {
        const current = getInlinePlanTargetState.call(this);
        if (!current || !targetEl || !targetEl.closest) return false;

        const row = targetEl.closest('.time-entry[data-index]');
        if (!row) return false;

        const rowIndex = parseInt(row.getAttribute('data-index'), 10);
        if (!Number.isInteger(rowIndex)) return false;

        const startIndex = Number.isInteger(current.startIndex) ? current.startIndex : rowIndex;
        const endIndex = Number.isInteger(current.endIndex) ? current.endIndex : startIndex;
        const safeStart = Math.min(startIndex, endIndex);
        const safeEnd = Math.max(startIndex, endIndex);

        return rowIndex >= safeStart && rowIndex <= safeEnd;
    }

function openInlinePlanDropdown(index, anchorEl, endIndex = null, options = {}) {
        // Returns true when a dropdown is open or intentionally remains open, false when opening is suppressed, fails, or same-target toggle closes it.
        const segmentReplaceTargetRequested = options && options.mode === 'plan-segment-replace'
            && Number.isInteger(Number(options.segmentIndex));
        if (!segmentReplaceTargetRequested && this.suppressInlinePlanOpenUntil && Date.now() < this.suppressInlinePlanOpenUntil) {
            return false;
        }
        const hasExplicitEndIndex = Number.isInteger(endIndex);
        const plannedContext = typeof this.resolvePlannedSlotContext === 'function'
            ? this.resolvePlannedSlotContext(index)
            : null;
        const range = this.getPlannedRangeInfo(plannedContext ? plannedContext.baseIndex : index);
        if (hasExplicitEndIndex) {
            range.startIndex = Math.min(range.startIndex, endIndex);
            range.endIndex = Math.max(range.endIndex, endIndex);
        }
        if (plannedContext) {
            const useContextRange = plannedContext.isMerged || !hasExplicitEndIndex;
            const explicitStart = hasExplicitEndIndex ? Math.min(index, endIndex) : plannedContext.rangeStart;
            const explicitEnd = hasExplicitEndIndex ? Math.max(index, endIndex) : plannedContext.rangeEnd;
            range.startIndex = useContextRange ? plannedContext.rangeStart : explicitStart;
            range.endIndex = useContextRange ? plannedContext.rangeEnd : explicitEnd;
            range.baseIndex = plannedContext.baseIndex;
            range.rangeStart = range.startIndex;
            range.rangeEnd = range.endIndex;
            range.mergeKey = plannedContext.mergeKey;
            range.isMerged = plannedContext.isMerged;
            range.slotCount = Math.max(1, range.endIndex - range.startIndex + 1);
            range.blockMinutes = plannedContext.isMerged ? plannedContext.blockMinutes : range.slotCount * 60;
            range.clickedIndex = plannedContext.clickedIndex;
        } else {
            const start = Number.isInteger(range.startIndex) ? range.startIndex : index;
            const end = Number.isInteger(range.endIndex) ? range.endIndex : start;
            const slotCount = Math.max(1, end - start + 1);
            range.baseIndex = Number.isInteger(range.baseIndex) ? range.baseIndex : start;
            range.rangeStart = Number.isInteger(range.rangeStart) ? range.rangeStart : start;
            range.rangeEnd = Number.isInteger(range.rangeEnd) ? range.rangeEnd : end;
            range.slotCount = Number.isInteger(range.slotCount) ? range.slotCount : slotCount;
            range.blockMinutes = Number.isFinite(range.blockMinutes) ? range.blockMinutes : range.slotCount * 60;
            range.clickedIndex = Number.isInteger(range.clickedIndex) ? range.clickedIndex : index;
        }
        if (options && Number.isInteger(options.baseIndex)) range.baseIndex = options.baseIndex;
        if (options && Number.isInteger(options.rangeStart)) range.rangeStart = options.rangeStart;
        if (options && Number.isInteger(options.rangeEnd)) range.rangeEnd = options.rangeEnd;
        if (options && options.mergeKey != null) range.mergeKey = options.mergeKey;
        if (options && Number.isFinite(options.blockMinutes) && options.blockMinutes > 0) {
            range.blockMinutes = Math.floor(options.blockMinutes);
        }
        const gapStartMinute = Number(options && options.gapStartMinute);
        const gapDurationMinutes = Number(options && options.gapDurationMinutes);
        const virtualGapTarget = options && options.mode === 'virtual-rest-gap'
            && Number.isFinite(gapStartMinute)
            && Number.isFinite(gapDurationMinutes)
            && gapDurationMinutes > 0;
        if (virtualGapTarget) {
            range.mode = 'virtual-rest-gap';
            range.gapStartMinute = Math.max(0, Math.floor(gapStartMinute));
            range.gapDurationMinutes = Math.max(0, Math.floor(gapDurationMinutes));
        }
        const segmentReplaceTarget = segmentReplaceTargetRequested;
        const anchorMinWidth = Number(options && options.anchorMinWidth);
        if (Number.isFinite(anchorMinWidth) && anchorMinWidth > 0) {
            range.anchorMinWidth = Math.floor(anchorMinWidth);
        }
        if (segmentReplaceTarget) {
            range.mode = 'plan-segment-replace';
            range.segmentIndex = Number(options.segmentIndex);
            range.segmentId = String(options.segmentId || '');
            range.anchorAlign = options.anchorAlign === 'center' ? 'center' : '';
            if (options.sourceRect) {
                const rect = options.sourceRect;
                const left = Number(rect.left);
                const top = Number(rect.top);
                const width = Number(rect.width);
                const height = Number(rect.height);
                const right = Number.isFinite(Number(rect.right)) ? Number(rect.right) : left + width;
                const bottom = Number.isFinite(Number(rect.bottom)) ? Number(rect.bottom) : top + height;
                if ([left, top, right, bottom].every(Number.isFinite)) {
                    range.sourceRect = {
                        left,
                        top,
                        right,
                        bottom,
                        width: Math.max(0, right - left),
                        height: Math.max(0, bottom - top),
                    };
                }
            }
        }
        const anchor = this.resolveInlinePlanAnchor(anchorEl, range.startIndex);
        if (!anchor) return false;
        const sheetTargetEl = options && options.sheetTargetEl && typeof options.sheetTargetEl.getBoundingClientRect === 'function'
            ? options.sheetTargetEl
            : anchor;
        this.inlinePlanSheetTargetEl = sheetTargetEl;
        if (this.inlinePlanDropdown && this.isSameInlinePlanTarget(range, anchor)) {
            if (
                this.inlinePlanDropdown.classList
                && this.inlinePlanDropdown.classList.contains('inline-plan-dropdown-sheet')
                && this.isInlinePlanMobileInputContext()
            ) {
                if (typeof this.scheduleInlinePlanSheetTargetViewportCorrection === 'function') {
                    this.scheduleInlinePlanSheetTargetViewportCorrection(sheetTargetEl);
                } else if (typeof this.scheduleInlinePlanViewportSync === 'function') {
                    this.scheduleInlinePlanViewportSync();
                }
                return true;
            }
            this.clearSelection('planned');
            this.closeInlinePlanDropdown();
            return false;
        }
        const preserveSheetScrollSpacer = typeof document !== 'undefined'
            && document.getElementById
            && document.getElementById('inline-plan-sheet-scroll-spacer');
        if (preserveSheetScrollSpacer) this.preserveInlinePlanSheetScrollSpacer = true;
        this.closeInlinePlanDropdown();
        this.preserveInlinePlanSheetScrollSpacer = false;
        this.currentPlanSource = this.getActivePlanSource();

        const isMobileInputContext = options.forceAnchored ? false : this.isInlinePlanMobileInputContext();
        const nextInlinePlanTarget = virtualGapTarget
            ? {
                ...range,
                anchor,
                mode: 'virtual-rest-gap',
                gapStartMinute: range.gapStartMinute,
                gapDurationMinutes: range.gapDurationMinutes,
            }
            : segmentReplaceTarget
                ? {
                    ...range,
                    anchor,
                    mode: 'plan-segment-replace',
                    segmentIndex: range.segmentIndex,
                    segmentId: range.segmentId,
                    anchorAlign: range.anchorAlign,
                    sourceRect: range.sourceRect || null,
                    keepInlineEditor: Boolean(options.keepInlineEditor),
                }
            : { ...range, anchor, keepInlineEditor: Boolean(options.keepInlineEditor) };
        setInlinePlanTargetState.call(this, nextInlinePlanTarget);
        this.inlinePlanSheetTargetEl = sheetTargetEl;
        this.inlinePlanHighlightRange = isMobileInputContext
            ? { startIndex: range.startIndex, endIndex: range.endIndex, mergeKey: range.mergeKey || null }
            : null;
        const dropdown = document.createElement('div');
        dropdown.className = `inline-plan-dropdown${isMobileInputContext ? ' inline-plan-dropdown-sheet' : ''}`;
        dropdown.innerHTML = `
            <div class="inline-plan-sheet-drag-handle" aria-hidden="true"></div>
            <div class="inline-plan-input-row${isMobileInputContext ? ' inline-plan-input-row-mobile-close' : ''}">
                ${isMobileInputContext ? '<button type="button" class="inline-plan-close-btn" aria-label="닫기">×</button>' : ''}
                <input type="text" class="inline-plan-input" placeholder="활동 추가 또는 검색" />
                <button type="button" class="inline-plan-add-btn" aria-label="활동 추가" title="활동 추가">＋</button>
            </div>
            <div class="activity-chip-board-shell">
                <div class="activity-chip-board-actions"></div>
                <div class="activity-chip-board"></div>
            </div>
            <div class="inline-plan-subsection" hidden>
                <div class="inline-plan-subsection-head">
                    <div class="inline-plan-subsection-title"></div>
                    <button type="button" class="inline-plan-subsection-close" aria-label="세부활동 설정 닫기">×</button>
                </div>
                <div class="activity-chip-board inline-plan-sub-board"></div>
                <div class="inline-plan-child-actions"></div>
            </div>`;        dropdown.style.visibility = 'hidden';
        if (isMobileInputContext) {
            const backdrop = document.createElement('div');
            backdrop.className = 'inline-plan-backdrop';
            backdrop.addEventListener('click', () => {
                clearPlannedSelectionForMobileSheetDismiss.call(this);
                this.closeInlinePlanDropdown();
            });
            document.body.appendChild(backdrop);
            this.inlinePlanBackdrop = backdrop;
            document.body.classList.add('inline-plan-sheet-open');
            if (!segmentReplaceTarget && !virtualGapTarget) {
                const slotTarget = getInlinePlanSlotContextTarget(sheetTargetEl);
                addInlinePlanClass(slotTarget, 'inline-plan-sheet-context-target', 'inline-plan-slot-context-target');
            }
        }
        document.body.appendChild(dropdown);
        this.inlinePlanDropdown = dropdown;
        if (isMobileInputContext) {
            this.setupInlinePlanSheetTouchDismiss(dropdown);
        }
        this.inlinePlanWheelHandler = (event) => this.handleInlinePlanWheel(event);
        dropdown.addEventListener('wheel', this.inlinePlanWheelHandler, { passive: false });

        const input = dropdown.querySelector('.inline-plan-input');
        const addBtn = dropdown.querySelector('.inline-plan-add-btn');
        const closeBtn = dropdown.querySelector('.inline-plan-close-btn');
        this.inlinePlanInputFocusHandler = null;
        const runInlineNotionSync = async () => {
            if (!this.prefetchNotionActivitiesIfConfigured) return false;
            try {
                const added = await this.prefetchNotionActivitiesIfConfigured();
                if (added) this.renderInlinePlanDropdownOptions();
                return added;
            } catch (e) {
                console.warn('[inline notion sync] failed:', e);
                return false;
            }
        };

        const addHandler = (options = {}) => {
            const val = this.normalizeActivityText ? this.normalizeActivityText(input.value) : String(input.value || '').trim();
            if (!val) return;
            clearInlinePlanChipUndoState.call(this);
            this.addPlannedActivityOption(val, false);
            input.value = '';
            this.currentPlanSource = 'local';
            this.renderInlinePlanDropdownOptions();
            const target = this.inlinePlanTarget;
            if (target && target.mode === 'plan-segment-replace') {
                const activityItem = (this.plannedActivities || []).find((item) => getCatalogItemLabel.call(this, item) === val)
                    || { label: val, name: val, activityText: val };
                applyActivityCatalogSelection.call(this, activityItem, null, { ...options, keepOpen: true, keepOpenOnMobile: true, keepOpenSegmentReplace: true });
                return;
            }
            const startIndex = target && Number.isInteger(target.startIndex) ? target.startIndex : 0;
            const endIndex = target && Number.isInteger(target.endIndex) ? target.endIndex : startIndex;
            const rangeStart = Math.min(startIndex, endIndex);
            const rangeEnd = Math.max(startIndex, endIndex);
            let canAutoApply = true;
            for (let i = rangeStart; i <= rangeEnd; i++) {
                if (!this.isPlanSlotEmptyForInline(i)) {
                    canAutoApply = false;
                    break;
                }
            }
            if (canAutoApply) {
                const applyOptions = { ...options, keepOpen: true, keepOpenOnMobile: true };
                this.applyInlinePlanSelection(val, applyOptions);
            }
        };
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.isComposing) {
                    e.preventDefault();
                    addHandler({ keepOpen: true });
                }
            });
            input.addEventListener('input', () => {
                this.renderInlinePlanDropdownOptions();
            });
            const markInputIntent = () => {
                this.markInlinePlanInputIntent();
            };
            input.addEventListener('touchstart', markInputIntent, { passive: true });
            input.addEventListener('pointerdown', markInputIntent, { passive: true });
            input.addEventListener('mousedown', markInputIntent);
            this.inlinePlanInputFocusHandler = () => {
                this.markInlinePlanInputIntent(700);
                this.scheduleInlinePlanInputVisibilitySync(input);
            };
            input.addEventListener('focus', this.inlinePlanInputFocusHandler);
        }
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                addHandler({ keepOpen: true });
            });
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const closingTarget = this.inlinePlanTarget || null;
                if (this.isInlinePlanMobileInputContext()) {
                    if (!closingTarget || closingTarget.mode !== 'plan-segment-replace') {
                        this.suppressInlinePlanOpenUntil = Date.now() + 800;
                    }
                    this.clearSelection('planned');
                    const activeEl = document.activeElement;
                    if (activeEl && typeof activeEl.blur === 'function') {
                        try { activeEl.blur(); } catch (_) {}
                    }
                }
                this.closeInlinePlanDropdown();
            });
        }
        const subSection = dropdown.querySelector('.inline-plan-subsection');
        if (subSection && !subSection.id) subSection.id = 'inline-plan-subsection';
        const inlineBoard = dropdown.querySelector('.activity-chip-board');
        const inlineSubBoard = dropdown.querySelector('.inline-plan-sub-board');
        const inlineBack = dropdown.querySelector('.inline-plan-sub-back');
        const inlineSubClose = dropdown.querySelector('.inline-plan-subsection-close');
        if (inlineBack) {
            inlineBack.hidden = true;
            inlineBack.setAttribute('aria-hidden', 'true');
        }
        if (inlineSubClose && !inlineSubClose.getAttribute('aria-label')) {
            inlineSubClose.setAttribute('aria-label', '세부활동 설정 닫기');
        }
        // 컨텍스트 초기화: 인라인 전용 세부활동 요소 지정
        this.inlinePlanContext = {
            root: dropdown,
            list: inlineBoard,
            section: subSection,
            subBoard: inlineSubBoard,
            backBtn: inlineBack,
            closeBtn: inlineSubClose
        };

        // 현재 슬롯 범위 기준 기본 총시간 및 기존 세부활동 불러오기
        const blockHours = Math.max(1, (range.endIndex - range.startIndex + 1));
        this.modalPlanTotalSeconds = blockHours * 3600;
        this.modalPlanActivities = this.getPlanActivitiesForIndex(range.startIndex).map(item => ({
            label: item.label || '',
            seconds: Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0,
            invalid: false
        }));
        this.modalPlanActiveRow = this.modalPlanActivities.length > 0 ? 0 : -1;
        this.modalPlanSectionOpen = false;
        this.modalPlanSectionOpenParentId = null;
        setInlinePlanChipDeleteMode.call(this, false);
        this.inlinePlanChildPopoverAnchorEl = null;
        this.inlinePlanChildPopoverAnchorSectionKey = null;
        this.inlinePlanChildPopoverAnchorInstanceKey = null;
        this.inlineChildComposerOpenParentId = null;
        this.inlineChildComposerError = '';
        this.inlineChildComposerHighlightId = null;
        this.inlineChildComposerHighlightKind = null;
        this.inlineChildComposerValue = '';
        this.inlineChildComposerFocusPending = false;
        if (subSection) {
            subSection.hidden = true;
            if (subSection.style) {
                subSection.style.visibility = 'hidden';
                if (typeof subSection.style.removeProperty === 'function') {
                    subSection.style.removeProperty('--inline-plan-subsection-notch-left');
                }
            }
            if (subSection.classList && typeof subSection.classList.remove === 'function') {
                subSection.classList.remove('inline-plan-subsection-anchored');
                subSection.classList.remove('inline-plan-subsection-flow');
            }
        }
        const baseSlot = this.timeSlots[range.startIndex] || {};
        this.modalPlanTitle = typeof baseSlot.planTitle === 'string'
            ? (this.normalizeActivityText ? this.normalizeActivityText(baseSlot.planTitle) : baseSlot.planTitle.trim())
            : '';
        this.modalPlanTitleBandOn = Boolean(baseSlot.planTitleBandOn && this.modalPlanTitle);

        if (inlineBack) {
            inlineBack.addEventListener('click', () => {
                if (subSection) subSection.hidden = true;
                this.modalPlanSectionOpen = false;
                this.modalPlanSectionOpenParentId = null;
                this.inlinePlanChildPopoverAnchorEl = null;
                this.inlinePlanChildPopoverAnchorSectionKey = null;
                this.inlinePlanChildPopoverAnchorInstanceKey = null;
            });
        }

        this.renderInlinePlanDropdownOptions();
        this.positionInlinePlanDropdown(anchor);
        requestAnimationFrame(() => {
            if (!this.inlinePlanDropdown) return;
            const anchorNow = this.resolveInlinePlanAnchor(anchor, range.startIndex);
            if (!anchorNow) return;
            setInlinePlanAnchorState.call(this, anchorNow);
            this.positionInlinePlanDropdown(anchorNow);
            if (input && this.shouldAutofocusInlinePlanInput()) input.focus();
        });

        this.inlinePlanOutsideHandler = (event) => {
            if (!this.inlinePlanDropdown) return;
            if (this.inlinePlanDropdown.contains(event.target)) return;
            if (this.inlinePlanChildPopoverLayer && this.inlinePlanChildPopoverLayer.contains(event.target)) return;
            if (this.routineMenu && this.routineMenu.contains(event.target)) return;
            if (this.planActivityMenu && this.planActivityMenu.contains(event.target)) return;
            if (this.planTitleMenu && this.planTitleMenu.contains(event.target)) return;
            if (this.inlinePriorityMenu && this.inlinePriorityMenu.contains(event.target)) return;
            const currentAnchor = getInlinePlanAnchorState.call(this);
            if (currentAnchor && currentAnchor.contains(event.target)) return;
            if (this.isEventWithinCurrentInlinePlanRange(event.target)) return;
            clearPlannedSelectionForMobileSheetDismiss.call(this);
            this.closeInlinePlanDropdown();
        };
        document.addEventListener('click', this.inlinePlanOutsideHandler, true);

        this.inlinePlanEscHandler = (event) => {
            if (event.key === 'Escape') {
                clearPlannedSelectionForMobileSheetDismiss.call(this);
                this.closeInlinePlanDropdown();
            }
        };
        document.addEventListener('keydown', this.inlinePlanEscHandler);

        this.inlinePlanPageScrollCloseHandler = (event) => {
            if (!this.inlinePlanDropdown) return;
            if (event && isInlinePlanInternalScrollTarget(this, event.target)) return;
            if (this.isInlinePlanMobileInputContext()) return;
            this.closeInlinePlanDropdown();
        };
        window.addEventListener('scroll', this.inlinePlanPageScrollCloseHandler, true);
        document.addEventListener('scroll', this.inlinePlanPageScrollCloseHandler, true);

        this.inlinePlanGestureCloseHandler = (event) => {
            if (!this.inlinePlanDropdown || !event || !event.target) return;
            if (event.target === this.inlinePlanDropdown || this.inlinePlanDropdown.contains(event.target)) return;
            if (this.inlinePlanChildPopoverLayer && this.inlinePlanChildPopoverLayer.contains(event.target)) return;
            if (this.routineMenu && this.routineMenu.contains(event.target)) return;
            if (this.planActivityMenu && this.planActivityMenu.contains(event.target)) return;
            if (this.planTitleMenu && this.planTitleMenu.contains(event.target)) return;
            if (this.inlinePriorityMenu && this.inlinePriorityMenu.contains(event.target)) return;
            const currentAnchor = getInlinePlanAnchorState.call(this);
            if (currentAnchor && currentAnchor.contains(event.target)) return;
            if (this.isEventWithinCurrentInlinePlanRange(event.target)) return;
            if (this.isInlinePlanMobileInputContext()) {
                if (event.cancelable && typeof event.preventDefault === 'function') event.preventDefault();
                return;
            }
            this.closeInlinePlanDropdown();
        };
        document.addEventListener('touchmove', this.inlinePlanGestureCloseHandler, true);
        window.addEventListener('wheel', this.inlinePlanGestureCloseHandler, true);

        this.inlinePlanScrollHandler = () => {
            this.scheduleInlinePlanViewportSync();
        };
        window.addEventListener('resize', this.inlinePlanScrollHandler);
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', this.inlinePlanScrollHandler);
            window.visualViewport.addEventListener('scroll', this.inlinePlanScrollHandler);
        }

        if (this.isNotionUIVisible() && this.prefetchNotionActivitiesIfConfigured) {
            this.prefetchNotionActivitiesIfConfigured()
                .then((added) => {
                    if (added && this.inlinePlanDropdown) {
                        this.renderInlinePlanDropdownOptions();
                    }
                })
                .catch(() => {});
        }
        this.applyInlinePlanBackgroundContext();
        return true;
    }

function applyInlinePlanBackgroundContext() {
        const timeEntries = document.getElementById('timeEntries');
        if (!timeEntries) return;
        timeEntries.classList.remove('inline-plan-context-active');
        timeEntries.querySelectorAll('.inline-plan-context-keep-clear').forEach((el) => el.classList.remove('inline-plan-context-keep-clear'));
        if (!this.inlinePlanDropdown || !this.inlinePlanDropdown.classList.contains('inline-plan-dropdown-sheet')) {
            return;
        }
        const range = this.inlinePlanHighlightRange;
        if (!range) return;
        const start = Number.isInteger(range.startIndex) ? Math.min(range.startIndex, range.endIndex) : null;
        const end = Number.isInteger(range.endIndex) ? Math.max(range.startIndex, range.endIndex) : start;
        if (!Number.isInteger(start) || !Number.isInteger(end)) return;
        timeEntries.classList.add('inline-plan-context-active');
        for (let i = start; i <= end; i += 1) {
            const row = timeEntries.querySelector(`.time-entry[data-index="${i}"]`);
            if (row) row.classList.add('inline-plan-context-keep-clear');
        }
    }

function closeInlinePlanDropdown() {
        const closingTarget = this.inlinePlanTarget || null;
        blurInlinePlanActiveInput(this);
        cleanupInlinePlanChipDragState.call(this);
        clearInlinePlanChipUndoState.call(this);
        this.closeInlinePriorityMenu();
        this.closeRoutineMenu();
        this.closePlanActivityMenu();
        this.closePlanTitleMenu();
        if (this.inlinePlanOutsideHandler) {
            document.removeEventListener('click', this.inlinePlanOutsideHandler, true);
            this.inlinePlanOutsideHandler = null;
        }
        if (this.inlinePlanEscHandler) {
            document.removeEventListener('keydown', this.inlinePlanEscHandler);
            this.inlinePlanEscHandler = null;
        }
        if (this.inlinePlanPageScrollCloseHandler) {
            window.removeEventListener('scroll', this.inlinePlanPageScrollCloseHandler, true);
            document.removeEventListener('scroll', this.inlinePlanPageScrollCloseHandler, true);
            this.inlinePlanPageScrollCloseHandler = null;
        }
        if (this.inlinePlanGestureCloseHandler) {
            document.removeEventListener('touchmove', this.inlinePlanGestureCloseHandler, true);
            window.removeEventListener('wheel', this.inlinePlanGestureCloseHandler, true);
            this.inlinePlanGestureCloseHandler = null;
        }
        if (this.inlinePlanScrollHandler) {
            window.removeEventListener('resize', this.inlinePlanScrollHandler);
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', this.inlinePlanScrollHandler);
                window.visualViewport.removeEventListener('scroll', this.inlinePlanScrollHandler);
            }
            this.inlinePlanScrollHandler = null;
        }
        if (this.inlinePlanDropdown && this.inlinePlanInputFocusHandler) {
            const input = this.inlinePlanDropdown.querySelector('.inline-plan-input');
            if (input) input.removeEventListener('focus', this.inlinePlanInputFocusHandler);
            this.inlinePlanInputFocusHandler = null;
        }
        if (this.inlinePlanFocusSyncTimer) {
            clearTimeout(this.inlinePlanFocusSyncTimer);
            this.inlinePlanFocusSyncTimer = null;
        }
        if (this.inlinePlanViewportSyncTimer) {
            clearTimeout(this.inlinePlanViewportSyncTimer);
            this.inlinePlanViewportSyncTimer = null;
        }
        if (this.inlinePlanDropdown && this.inlinePlanWheelHandler) {
            this.inlinePlanDropdown.removeEventListener('wheel', this.inlinePlanWheelHandler);
            this.inlinePlanWheelHandler = null;
        }
        this.cleanupInlinePlanSheetTouchDismiss();
        if (this.inlinePlanDropdown && this.inlinePlanDropdown.parentNode) {
            this.inlinePlanDropdown.parentNode.removeChild(this.inlinePlanDropdown);
        }
        if (this.inlinePlanChildPopoverLayer && this.inlinePlanChildPopoverLayer.parentNode) {
            this.inlinePlanChildPopoverLayer.parentNode.removeChild(this.inlinePlanChildPopoverLayer);
        }
        this.inlinePlanChildPopoverLayer = null;
        if (this.inlinePlanBackdrop && this.inlinePlanBackdrop.parentNode) {
            this.inlinePlanBackdrop.parentNode.removeChild(this.inlinePlanBackdrop);
        }
        this.inlinePlanBackdrop = null;
        const sheetScrollSpacer = document.getElementById ? document.getElementById('inline-plan-sheet-scroll-spacer') : null;
        if (!this.preserveInlinePlanSheetScrollSpacer && sheetScrollSpacer && sheetScrollSpacer.parentNode) {
            sheetScrollSpacer.parentNode.removeChild(sheetScrollSpacer);
        }
        document.body.classList.remove('inline-plan-sheet-open');
        const timeEntries = document.getElementById('timeEntries');
        if (timeEntries) {
            timeEntries.classList.remove('inline-plan-context-active');
            timeEntries.querySelectorAll('.inline-plan-context-keep-clear').forEach((el) => el.classList.remove('inline-plan-context-keep-clear'));
            timeEntries.querySelectorAll('.inline-plan-sheet-context-target, .inline-plan-segment-context-target, .inline-plan-slot-context-target, .inline-plan-gap-context-target').forEach((el) => {
                removeInlinePlanClass(
                    el,
                    'inline-plan-sheet-context-target',
                    'inline-plan-segment-context-target',
                    'inline-plan-slot-context-target',
                    'inline-plan-gap-context-target'
                );
            });
        }
        this.inlinePlanDropdown = null;
        if (closingTarget && closingTarget.mode === 'plan-segment-replace') {
            this.selectedPlanSegment = null;
            this.suppressInlinePlanOpenUntil = 0;
        }
        clearInlinePlanTargetState.call(this);
        this.inlinePlanHighlightRange = null;
        this.modalPlanSectionOpen = false;
        this.modalPlanSectionOpenParentId = null;
        setInlinePlanChipDeleteMode.call(this, false);
        setInlinePlanChipEditMode.call(this, false, { rerender: false });
        this.inlineChildComposerOpenParentId = null;
        this.inlineChildComposerError = '';
        this.inlineChildComposerHighlightId = null;
        this.inlineChildComposerHighlightKind = null;
        this.inlineChildComposerValue = '';
        this.inlineChildComposerFocusPending = false;
        this.inlinePlanChildPopoverAnchorEl = null;
        this.inlinePlanChildPopoverAnchorSectionKey = null;
        this.inlinePlanChildPopoverAnchorInstanceKey = null;
        this.inlinePlanSheetTargetEl = null;
        this.inlinePlanContext = null;
        this.inlinePlanInputIntentUntil = 0;
    }

function applyInlinePlanSelection(label, options = {}) {
        if (!this.inlinePlanTarget) return;
        const normalized = this.normalizeActivityText ? this.normalizeActivityText(label) : String(label || '').trim();
        if (!normalized) return;
        const keepOpenAfterSelection = shouldKeepInlinePlanOpenAfterSelection(this, options);

        if (this.inlinePlanTarget.mode === 'plan-segment-replace') {
            const activityItem = (this.plannedActivities || []).find((item) => getCatalogItemLabel.call(this, item) === normalized)
                || { label: normalized, name: normalized, activityText: normalized };
            applyActivityCatalogSelection.call(this, activityItem, null, { ...options, keepOpen: false });
            return;
        }

        const safeStart = Number.isInteger(this.inlinePlanTarget.startIndex) ? this.inlinePlanTarget.startIndex : 0;
        const safeEnd = Number.isInteger(this.inlinePlanTarget.endIndex) ? this.inlinePlanTarget.endIndex : safeStart;
        const startIndex = Math.min(safeStart, safeEnd);
        const endIndex = Math.max(safeStart, safeEnd);
        const baseIndex = Number.isInteger(this.inlinePlanTarget.baseIndex) ? this.inlinePlanTarget.baseIndex : startIndex;
        const rangeStart = Number.isInteger(this.inlinePlanTarget.rangeStart) ? this.inlinePlanTarget.rangeStart : startIndex;
        const rangeEnd = Number.isInteger(this.inlinePlanTarget.rangeEnd) ? this.inlinePlanTarget.rangeEnd : endIndex;

        if (isVirtualRestGapTarget(this.inlinePlanTarget)) {
            const planItem = {
                label: normalized,
                seconds: this.inlinePlanTarget.gapDurationMinutes * 60,
            };
            const baseSlot = this.timeSlots[baseIndex];
            if (!baseSlot) return;
            baseSlot.planActivities = buildPlanActivitiesWithVirtualGapFill(
                this.normalizePlanActivitiesArray ? this.normalizePlanActivitiesArray(baseSlot.planActivities) : baseSlot.planActivities,
                planItem,
                this.inlinePlanTarget
            );
            baseSlot.planned = this.formatActivitiesSummary ? this.formatActivitiesSummary(baseSlot.planActivities) : normalized;
            baseSlot.planTitle = '';
            baseSlot.planTitleBandOn = false;
            for (let i = rangeStart; i <= rangeEnd; i++) {
                if (i === baseIndex) continue;
                if (!this.timeSlots[i]) continue;
                this.timeSlots[i].planned = '';
                this.timeSlots[i].planActivities = [];
                this.timeSlots[i].planTitle = '';
                this.timeSlots[i].planTitleBandOn = false;
            }
        } else if (this.inlinePlanTarget.mergeKey) {
            this.mergedFields.set(this.inlinePlanTarget.mergeKey, normalized);
            for (let i = rangeStart; i <= rangeEnd; i++) {
                if (!this.timeSlots[i]) continue;
                const isStart = i === baseIndex;
                this.timeSlots[i].planned = isStart ? normalized : '';
                this.timeSlots[i].planActivities = [];
                this.timeSlots[i].planTitle = isStart ? normalized : '';
                this.timeSlots[i].planTitleBandOn = isStart ? false : false;
            }
        } else {
            for (let i = startIndex; i <= endIndex; i++) {
                if (!this.timeSlots[i]) continue;
                const isStart = i === startIndex;
                this.timeSlots[i].planned = isStart ? normalized : '';
                this.timeSlots[i].planActivities = [];
                this.timeSlots[i].planTitle = isStart ? normalized : '';
                this.timeSlots[i].planTitleBandOn = isStart ? false : false;
            }
        }

        this.renderTimeEntries(keepOpenAfterSelection);
        this.calculateTotals();
        this.autoSave();
        if (keepOpenAfterSelection && this.inlinePlanTarget) {
            const anchor = document.querySelector(`[data-index="${baseIndex}"] .planned-merged-main-container`)
                || document.querySelector(`[data-index="${baseIndex}"] .planned-input`)
                || document.querySelector(`[data-index="${baseIndex}"]`);
            if (anchor) {
                setInlinePlanAnchorState.call(this, anchor);
                this.positionInlinePlanDropdown(anchor);
                const dropdownInput = this.inlinePlanDropdown && this.inlinePlanDropdown.querySelector('.inline-plan-input');
                if (dropdownInput && this.shouldAutofocusInlinePlanInput()) dropdownInput.focus();
            }
            return;
        }
        this.closeInlinePlanDropdown();
    }
    return Object.freeze({
        buildPlannedActivityOptions,
        getHangulInitialSearchKey,
        scoreInlinePlanSearchMatch,
        filterInlinePlanSearchItems,
        resolveInlinePlanAnchor,
        canInlineWheelScroll,
        handleInlinePlanWheel,
        isInlinePlanMobileInputContext,
        shouldAutofocusInlinePlanInput,
        setupInlinePlanSheetTouchDismiss,
        cleanupInlinePlanSheetTouchDismiss,
        scheduleInlinePlanInputVisibilitySync,
        scheduleInlinePlanViewportSync,
        getInlinePlanViewportMetrics,
        measureInlinePlanPanel,
        layoutInlinePlanAnchoredPanel,
        getInlinePlanMinimumInteractiveHeight,
        getInlinePlanDropdownScrollContainer,
        scrollChildPopoverIntoDropdownView,
        ensureInlinePlanInputVisible,
        isInlinePlanInputFocused,
        markInlinePlanInputIntent,
        hasRecentInlinePlanInputIntent,
        isInlinePlanChipDeleteModeEnabled,
        setInlinePlanChipDeleteMode,
        isInlinePlanChipEditModeEnabled,
        setInlinePlanChipEditMode,
        cleanupInlinePlanChipDragState,
        setInlinePlanTargetState,
        clearInlinePlanTargetState,
        resolveInlinePlanChipDropIntent,
        applyInlinePlanChipDropFeedback,
        getInlinePlanChipAutoScrollStep,
        restoreInlinePlanChipUndoState,
        validateActivityChipboardDrop,
        applyActivityChipboardDrop,
        removePlannedActivityCatalogEntry,
        getInlinePlanAnchorRect,
        getInlinePlanRangeAnchorRect,
        getOpenParentCaretAnchor,
        positionInlinePlanDropdown,
        positionInlinePlanChildPopover,
        renderInlinePlanDropdownOptions,
        createChildActivityForParent,
        touchPlannedActivityUsage,
        groupActivityBoard,
        closePlanActivityChildMenu,
        openPlanActivityChildMenu,
        openRoutineMenuFromInlinePlan,
        isSameInlinePlanTarget,
        isEventWithinCurrentInlinePlanRange,
        openInlinePlanDropdown,
        applyInlinePlanBackgroundContext,
        closeInlinePlanDropdown,
        applyInlinePlanSelection
    });
});
