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
        safe.forEach((item) => {
            if (!item || typeof item !== 'object') return;
            const id = String(item.id || item.label || '').trim();
            if (id) byId.set(id, item);
            const parentId = String(item.parentId || '').trim();
            const key = parentId || '';
            if (!byParentId.has(key)) byParentId.set(key, []);
            byParentId.get(key).push(item);
        });
        const topLevel = safe.filter((item) => !item || !item.parentId);
        return {
            items: safe,
            byId,
            byParentId,
            pinned: topLevel.filter((item) => item && item.pinned && !item.archived),
            recent: topLevel.filter((item) => item && !item.pinned && !item.archived).slice(0, 8),
            parents: topLevel.slice(),
            children: safe.filter((item) => item && item.parentId),
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
        const state = {
            startY: 0,
            lastY: 0,
            dragging: false,
            armed: false,
            pointerId: null
        };
        const getPointY = (event) => {
            if (!event) return 0;
            if (event.touches && event.touches.length) return event.touches[0].clientY;
            if (event.changedTouches && event.changedTouches.length) return event.changedTouches[0].clientY;
            return Number(event.clientY) || 0;
        };
        const shouldArm = (event) => {
            if (!this.inlinePlanDropdown || this.inlinePlanDropdown !== dropdown) return false;
            const scrollTop = dropdown.scrollTop || 0;
            if (scrollTop > 2) return false;
            const interactive = event.target && event.target.closest
                ? event.target.closest('input, textarea, button, select, .inline-plan-options')
                : null;
            return !interactive || (interactive === dropdown.querySelector('.inline-plan-options') && scrollTop <= 2);
        };
        const start = (event) => {
            if (!shouldArm(event)) return;
            state.startY = getPointY(event);
            state.lastY = state.startY;
            state.dragging = false;
            state.armed = true;
            state.pointerId = Number.isFinite(event.pointerId) ? event.pointerId : null;
            dropdown.style.transition = 'transform 0.18s ease';
        };
        const move = (event) => {
            if (!state.armed) return;
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
            dropdown.style.transform = `translateY(${Math.min(deltaY, 240)}px)`;
            if (event.cancelable) event.preventDefault();
        };
        const end = () => {
            if (!state.armed) return;
            const deltaY = state.lastY - state.startY;
            dropdown.style.transition = 'transform 0.18s ease';
            if (state.dragging && deltaY >= 90) {
                dropdown.style.transform = 'translateY(100%)';
                setTimeout(() => {
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
        const docEl = document.documentElement;
        const layoutScrollX = window.scrollX || docEl.scrollLeft || 0;
        const layoutScrollY = window.scrollY || docEl.scrollTop || 0;
        const vv = (typeof window !== 'undefined' && window.visualViewport) ? window.visualViewport : null;
        const viewportLeft = vv ? (layoutScrollX + vv.offsetLeft) : layoutScrollX;
        const viewportTop = vv ? (layoutScrollY + vv.offsetTop) : layoutScrollY;
        const viewportWidth = vv ? vv.width : (docEl.clientWidth || window.innerWidth || 0);
        const viewportHeight = vv ? vv.height : (docEl.clientHeight || window.innerHeight || 0);

        return {
            left: viewportLeft,
            top: viewportTop,
            width: viewportWidth,
            height: viewportHeight,
            right: viewportLeft + viewportWidth,
            bottom: viewportTop + viewportHeight,
        };
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
        const viewport = this.getInlinePlanViewportMetrics();
        const margin = 12;
        const gap = 6;
        const maxWidth = Math.max(240, viewport.width - (margin * 2));
        const anchor = this.resolveInlinePlanAnchor(anchorEl);
        if (!anchor) return;
        if (getInlinePlanTargetState.call(this) && getInlinePlanAnchorState.call(this) !== anchor) {
            setInlinePlanAnchorState.call(this, anchor);
        }
        const rect = anchor.getBoundingClientRect();
        if (!rect || (!rect.width && !rect.height)) return;
        const docEl = document.documentElement;
        const layoutScrollX = window.scrollX || docEl.scrollLeft || 0;
        const layoutScrollY = window.scrollY || docEl.scrollTop || 0;
        const anchorLeft = layoutScrollX + rect.left;
        const anchorTop = layoutScrollY + rect.top;
        const anchorBottom = layoutScrollY + rect.bottom;
        const minWidth = Math.min(Math.max(240, rect.width + 32), maxWidth);
        dropdown.style.minWidth = `${minWidth}px`;
        dropdown.style.width = `${minWidth}px`;

        let left = anchorLeft;
        const maxLeft = viewport.right - minWidth - margin;
        if (left > maxLeft) {
            left = Math.max(viewport.left + margin, maxLeft);
        }
        if (left < viewport.left + margin) {
            left = viewport.left + margin;
        }

        dropdown.style.visibility = 'hidden';
        dropdown.style.left = '0px';
        dropdown.style.top = '0px';
        dropdown.style.maxHeight = '';

        const naturalHeight = Math.max(
            Number(dropdown.scrollHeight) || 0,
            Number(dropdown.offsetHeight) || 0
        );
        const minimumInteractiveHeight = this.getInlinePlanMinimumInteractiveHeight(dropdown);
        const fallbackHeight = Math.max(1, Math.floor(viewport.height - (margin * 2)));
        const rawSpaceBelow = Math.max(0, Math.floor(viewport.bottom - anchorBottom - gap - margin));
        const rawSpaceAbove = Math.max(0, Math.floor(anchorTop - viewport.top - gap - margin));

        const forceBelow = this.isInlinePlanMobileInputContext();

        let placeAbove = false;
        if (!forceBelow) {
            if (rawSpaceBelow <= 0 && rawSpaceAbove > 0) {
                placeAbove = true;
            } else if (
                rawSpaceBelow < minimumInteractiveHeight
                && rawSpaceAbove > rawSpaceBelow
                && rawSpaceAbove >= Math.min(minimumInteractiveHeight, naturalHeight || minimumInteractiveHeight)
            ) {
                placeAbove = true;
            }
        }

        let available = placeAbove ? rawSpaceAbove : rawSpaceBelow;
        if (available <= 0) {
            available = forceBelow ? 1 : fallbackHeight;
        }

        const maxHeight = Math.max(1, available > 0 ? Math.floor(available) : fallbackHeight);
        dropdown.style.maxHeight = `${maxHeight}px`;

        const estimatedHeight = Math.min(maxHeight, naturalHeight || maxHeight);
        let top = placeAbove
            ? (anchorTop - estimatedHeight - gap)
            : (anchorBottom + gap);

        if (placeAbove) {
            const minTop = viewport.top + margin;
            if (top < minTop) top = minTop;
        }

        dropdown.style.left = `${Math.round(left)}px`;
        dropdown.style.top = `${Math.round(top)}px`;
        dropdown.style.visibility = 'visible';
        if (this.positionInlinePlanChildPopover) {
            this.positionInlinePlanChildPopover(this.inlinePlanChildPopoverAnchorEl || anchorEl || null);
        }
    }

function positionInlinePlanChildPopover(anchorEl = null) {
        if (!this.inlinePlanDropdown) return;
        const section = this.inlinePlanDropdown.querySelector('.inline-plan-subsection');
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
            return;
        }
        if (typeof this.inlinePlanDropdown.getBoundingClientRect !== 'function') return;

        const dropdown = this.inlinePlanDropdown;
        const dropdownRect = dropdown.getBoundingClientRect();
        const anchorRect = resolvedAnchor.getBoundingClientRect();
        if (!dropdownRect || !anchorRect) return;

        const dropdownWidth = Number.isFinite(dropdownRect.width) ? dropdownRect.width : 0;
        const dropdownHeight = Number.isFinite(dropdownRect.height) ? dropdownRect.height : 0;
        const anchorLeft = Number.isFinite(anchorRect.left) ? anchorRect.left : 0;
        const anchorTop = Number.isFinite(anchorRect.top) ? anchorRect.top : 0;
        const anchorBottom = Number.isFinite(anchorRect.bottom) ? anchorRect.bottom : (anchorTop + (Number.isFinite(anchorRect.height) ? anchorRect.height : 0));

        const useFlowLayout = Boolean(
            this.isInlinePlanMobileInputContext && this.isInlinePlanMobileInputContext()
            || dropdown.classList.contains('inline-plan-dropdown-sheet')
            || dropdownWidth < 320
        );

        if (useFlowLayout) {
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
            section.style.visibility = 'visible';
            section.style.zIndex = '80';
            this.inlinePlanChildPopoverAnchorEl = resolvedAnchor;
            return;
        }

        section.classList.remove('inline-plan-subsection-flow');
        section.classList.add('inline-plan-subsection-anchored');
        const gap = 8;
        const margin = 8;
        const minWidth = 300;
        const maxWidth = 360;
        const minHeight = 220;
        const width = Math.max(minWidth, Math.min(maxWidth, Math.floor(dropdownWidth - (margin * 2)) || maxWidth));
        let left = Math.round(anchorLeft - dropdownRect.left);
        if (left + width > dropdownWidth - margin) {
            left = Math.max(margin, Math.round(dropdownWidth - width - margin));
        }
        left = Math.max(margin, left);

        const viewportHeight = Number.isFinite(dropdownHeight) && dropdownHeight > 0
            ? dropdownHeight
            : ((typeof window !== 'undefined' && Number.isFinite(window.innerHeight)) ? window.innerHeight : 0);
        const topBelow = Math.round(anchorBottom - dropdownRect.top + gap);
        const availableBelow = Math.max(0, Math.floor(viewportHeight - topBelow - margin));
        const naturalHeight = Math.max(Number(section.scrollHeight) || 0, Number(section.offsetHeight) || 0);
        const maxHeightLimit = Math.min(420, Math.max(300, Math.floor(viewportHeight - topBelow - margin)));
        const available = availableBelow;
        const boundedHeight = Math.max(
            Math.min(minHeight, Math.max(available, 0)),
            Math.min(maxHeightLimit, available || maxHeightLimit, naturalHeight || maxHeightLimit)
        );
        const top = Math.max(margin, topBelow);

        const anchorCenter = anchorLeft - dropdownRect.left + Math.max(0, Math.floor((Number.isFinite(anchorRect.width) ? anchorRect.width : 0) / 2));
        const notchLeft = Math.max(16, Math.min(width - 16, anchorCenter - left));

        section.style.position = 'absolute';
        section.style.top = `${top}px`;
        section.style.left = `${left}px`;
        section.style.width = `${width}px`;
        section.style.maxWidth = `${width}px`;
        section.style.maxHeight = `${boundedHeight}px`;
        section.style.marginTop = '0';
        section.style.right = 'auto';
        section.style.bottom = 'auto';
        section.style.visibility = 'visible';
        section.style.zIndex = '80';
        section.style.setProperty('--inline-plan-subsection-notch-left', `${Math.round(notchLeft)}px`);
        this.inlinePlanChildPopoverAnchorEl = resolvedAnchor;
    }

function getCatalogItemLabel(item) {
        return this.normalizeActivityText
            ? this.normalizeActivityText((item && (item.name || item.label || item.title)) || '')
            : String((item && (item.name || item.label || item.title)) || '').trim();
    }

function getInlinePlanSelectionSeconds() {
        const target = this.inlinePlanTarget || {};
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
        const chips = Array.from(dropdown.querySelectorAll('.activity-chip[data-activity-id]'));
        const chip = chips.find((node) => node && node.dataset && String(node.dataset.activityId || '').trim() === parentId);
        if (!chip || typeof chip.querySelector !== 'function') return null;
        return chip.querySelector('.activity-chip-caret') || null;
    }

function hasActivityUsageHistory(item) {
        return Boolean(item && ((Number(item.usageCount) || 0) > 0 || String(item.lastUsedAt || '').trim()));
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

function applyActivityCatalogSelection(activityItem, parentItem = null, options = {}) {
        if (!this.inlinePlanTarget || !activityItem) return;
        const activityText = getCatalogItemLabel.call(this, activityItem);
        if (!activityText) return;
        const titleText = parentItem ? getCatalogItemLabel.call(this, parentItem) : null;

        const safeStart = Number.isInteger(this.inlinePlanTarget.startIndex) ? this.inlinePlanTarget.startIndex : 0;
        const safeEnd = Number.isInteger(this.inlinePlanTarget.endIndex) ? this.inlinePlanTarget.endIndex : safeStart;
        const startIndex = Math.min(safeStart, safeEnd);
        const endIndex = Math.max(safeStart, safeEnd);
        const seconds = getInlinePlanSelectionSeconds.call(this);
        const planItem = {
            label: activityText,
            seconds,
            titleActivityId: parentItem ? (String(parentItem.id || '').trim() || null) : null,
            titleText,
            activityId: String(activityItem.id || '').trim() || null,
            activityText,
        };

        if (this.inlinePlanTarget.mergeKey) {
            this.mergedFields.set(this.inlinePlanTarget.mergeKey, activityText);
        }

        for (let i = startIndex; i <= endIndex; i++) {
            if (!this.timeSlots[i]) continue;
            const isStart = i === startIndex;
            this.timeSlots[i].planned = isStart ? activityText : '';
            this.timeSlots[i].planActivities = isStart ? [{ ...planItem }] : [];
            this.timeSlots[i].planTitle = isStart && titleText ? titleText : '';
            this.timeSlots[i].planTitleBandOn = Boolean(isStart && titleText);
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

        this.renderTimeEntries(Boolean(options.keepOpen));
        this.calculateTotals();
        this.autoSave();
        if (options.keepOpen && this.inlinePlanTarget) {
            const anchor = document.querySelector(`[data-index="${startIndex}"] .planned-input`)
                || document.querySelector(`[data-index="${startIndex}"]`);
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
        if (this.inlinePriorityMenu) {
            this.closeInlinePriorityMenu();
        }
        const board = this.inlinePlanDropdown.querySelector('.activity-chip-board');
        if (!board) return;

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
        const recentCandidates = topLevelItems
            .filter((item) => item && !item.archived && !item.pinned && queryMatches(item))
            .sort((a, b) => {
                const at = a.lastUsedAt || '';
                const bt = b.lastUsedAt || '';
                if (at !== bt) return bt.localeCompare(at);
                return (b.usageCount || 0) - (a.usageCount || 0);
            })
            .slice(0, 8);
        const shouldShowRecentSection = recentCandidates.length > 0 && (
            recentCandidates.some((item) => hasActivityUsageHistory(item))
            || !areActivityListsEquivalent(recentCandidates, topLevelItems)
        );
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
            recent: shouldShowRecentSection ? recentCandidates : [],
            parents: (catalogGrouped.parents || []).filter((item) => item && !item.archived),
            all: topLevelItems,
        };

        const renderChip = (item) => {
            const label = getCatalogItemLabel.call(this, item);
            if (!label) return null;
            const canOpenChildBoard = !item.parentId;
            const childItemsForParent = canOpenChildBoard
                ? (catalogGrouped.byParentId.get(String(item.id || '')) || []).filter((child) => child && child.id !== item.id)
                : [];
            const chip = document.createElement('span');
            chip.className = `activity-chip${canOpenChildBoard ? ' activity-chip-parent activity-chip-split' : ''}`;
            chip.dataset.label = label;
            const itemId = String(item.id || '').trim();
            chip.dataset.activityId = itemId;
            if (canOpenChildBoard) chip.dataset.parentId = itemId;
            const currentOpenParentId = String(this.modalPlanSectionOpenParentId || '').trim();
            const isOpenParent = canOpenChildBoard && this.modalPlanSectionOpen && currentOpenParentId === itemId;
            if (isOpenParent) chip.classList.add('activity-chip-open');

            const labelButton = document.createElement('button');
            labelButton.type = 'button';
            labelButton.className = 'activity-chip-main';
            labelButton.setAttribute('aria-label', `${label} 선택`);
            labelButton.title = `${label} 선택`;
            const text = document.createElement('span');
            text.className = 'activity-chip-label';
            text.textContent = label;
            labelButton.appendChild(text);
            labelButton.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const parent = item && item.parentId ? catalogGrouped.byId.get(item.parentId) : null;
                applyActivityCatalogSelection.call(this, item, parent || null, { keepOpen: true });
            });
            chip.appendChild(labelButton);

            if (canOpenChildBoard) {
                const caret = document.createElement('button');
                caret.type = 'button';
                caret.className = 'activity-chip-caret';
                caret.dataset.activityId = itemId;
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
                    if (this.modalPlanSectionOpen && currentlyOpenParentId === parentId) {
                        this.closePlanActivityChildMenu();
                        return;
                    }
                    this.openPlanActivityChildMenu(item, caret, childItemsForParent);
                });
                chip.appendChild(caret);
            }

            return chip;
        };

        const renderSearchChip = (entry) => {
            if (!entry || !entry.item) return null;
            const item = entry.item;
            const parent = entry.parent || null;
            const label = parent ? `${getCatalogItemLabel.call(this, item)} · ${getCatalogItemLabel.call(this, parent)}` : getCatalogItemLabel.call(this, item);
            if (!label) return null;
            const chip = document.createElement('span');
            chip.className = 'activity-chip';
            chip.dataset.label = label;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'activity-chip-main';
            btn.setAttribute('aria-label', parent ? `${getCatalogItemLabel.call(this, item)} · ${getCatalogItemLabel.call(this, parent)}` : `${label} 선택`);
            btn.title = parent ? `${getCatalogItemLabel.call(this, item)} · ${getCatalogItemLabel.call(this, parent)}` : `${label} 선택`;
            const text = document.createElement('span');
            text.className = 'activity-chip-label';
            text.textContent = label;
            btn.appendChild(text);
            btn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                applyActivityCatalogSelection.call(this, item, parent, { keepOpen: true });
            });
            chip.appendChild(btn);
            return chip;
        };

        board.innerHTML = '';
        const sections = [
            { title: '검색 결과', key: 'search' },
            { title: '고정', key: 'pinned' },
            { title: '최근 사용', key: 'recent' },
            { title: '전체 활동군', key: 'parents' },
            { title: '전체 활동', key: 'all' },
        ];
        let renderedSectionCount = 0;
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
                const chip = section.key === 'search' ? renderSearchChip(item) : renderChip(item);
                if (chip) row.appendChild(chip);
            });
            wrap.appendChild(row);
            board.appendChild(wrap);
        });
        if (renderedSectionCount === 0) {
            const empty = document.createElement('div');
            empty.className = 'inline-plan-empty';
            empty.textContent = normalizedQuery ? '검색 결과가 없습니다.' : '등록된 활동이 없습니다.';
            board.appendChild(empty);
        }
        const currentAnchor = getInlinePlanAnchorState.call(this);
        if (currentAnchor && this.positionInlinePlanDropdown) {
            this.positionInlinePlanDropdown(currentAnchor);
        }
    }

function createChildActivityForParent(parentItem, rawName) {
        const normalizedName = this.normalizeActivityText ? this.normalizeActivityText(rawName) : String(rawName || '').trim();
        if (!normalizedName) return { status: 'empty' };

        const parentId = String(parentItem && parentItem.id ? parentItem.id : '').trim() || null;
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
            id: `${parentId || 'activity'}_${Date.now()}`,
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
        this.dedupeAndSortPlannedActivities();
        this.savePlannedActivities();
        this.inlineChildComposerError = '';
        this.inlineChildComposerHighlightId = child.id || null;
        this.inlineChildComposerHighlightKind = 'new';
        this.inlineChildComposerValue = '';
        return { status: 'created', item: child };
    }

function closePlanActivityChildMenu(options = {}) {
        const section = this.inlinePlanDropdown
            ? this.inlinePlanDropdown.querySelector('.inline-plan-subsection')
            : null;
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
        this.modalPlanSectionOpen = false;
        this.modalPlanSectionOpenParentId = null;
        this.inlineChildComposerOpenParentId = null;
        this.inlineChildComposerError = '';
        this.inlineChildComposerHighlightId = null;
        this.inlineChildComposerHighlightKind = null;
        this.inlineChildComposerValue = '';
        this.inlineChildComposerFocusPending = false;
        this.inlinePlanChildPopoverAnchorEl = null;

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
        const section = this.inlinePlanDropdown.querySelector('.inline-plan-subsection');
        const board = this.inlinePlanDropdown.querySelector('.inline-plan-sub-board');
        const backBtn = this.inlinePlanDropdown.querySelector('.inline-plan-sub-back');
        const closeBtn = this.inlinePlanDropdown.querySelector('.inline-plan-subsection-close');
        const title = this.inlinePlanDropdown.querySelector('.inline-plan-subsection-title');
        if (!section || !board) return;

        const parentLabel = getCatalogItemLabel.call(this, parentItem);
        section.hidden = false;
        if (section.style) section.style.visibility = 'visible';
        if (this.inlinePlanDropdown.classList && typeof this.inlinePlanDropdown.classList.add === 'function') {
            this.inlinePlanDropdown.classList.add('inline-plan-child-popover-open');
        }
        if (!section.id) section.id = 'inline-plan-subsection';
        this.modalPlanSectionOpen = true;
        const parentId = String(parentItem.id || '').trim() || null;
        this.modalPlanSectionOpenParentId = parentId;
        this.inlinePlanChildPopoverAnchorEl = anchorEl || null;
        const composerOpenParentId = String(this.inlineChildComposerOpenParentId || '').trim();
        if (composerOpenParentId && composerOpenParentId !== parentId) {
            this.inlineChildComposerOpenParentId = null;
            this.inlineChildComposerError = '';
            this.inlineChildComposerHighlightId = null;
            this.inlineChildComposerHighlightKind = null;
            this.inlineChildComposerValue = '';
            this.inlineChildComposerFocusPending = false;
        } else if (composerOpenParentId === parentId) {
            this.inlineChildComposerOpenParentId = parentId;
        }
        board.innerHTML = '';
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

        const selfRow = document.createElement('div');
        selfRow.className = 'activity-chip-row';

        const parentSelf = document.createElement('button');
        parentSelf.type = 'button';
        parentSelf.className = 'activity-chip activity-chip-self';
        parentSelf.setAttribute('aria-label', parentLabel ? `${parentLabel} 자체 선택` : '자체 선택');
        parentSelf.title = parentLabel ? `${parentLabel} 자체 선택` : '자체 선택';
        parentSelf.textContent = parentLabel ? `${parentLabel} 자체 선택` : '자체 선택';
        parentSelf.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            applyActivityCatalogSelection.call(this, parentItem, null, { keepOpen: true });
        });
        selfRow.appendChild(parentSelf);
        board.appendChild(selfRow);

        const childTitle = document.createElement('div');
        childTitle.className = 'activity-chip-board-title';
        childTitle.textContent = '세부활동';
        board.appendChild(childTitle);

        const childRow = document.createElement('div');
        childRow.className = 'activity-chip-row';

        (Array.isArray(children) ? children : []).forEach((child) => {
            const childLabel = getCatalogItemLabel.call(this, child);
            if (!childLabel) return;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'activity-chip';
            const childId = String(child.id || '').trim();
            if (String(this.inlineChildComposerHighlightId || '').trim() === childId) {
                btn.className += ` ${this.inlineChildComposerHighlightKind === 'duplicate' ? 'activity-chip-duplicate-highlight' : 'activity-chip-new-highlight'}`;
            }
            btn.dataset.label = childLabel;
            btn.setAttribute('aria-label', `${childLabel} 선택`);
            btn.title = `${childLabel} 선택`;
            btn.textContent = childLabel;
            btn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
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
            board.appendChild(empty);
        }

        if (String(this.inlineChildComposerOpenParentId || '').trim() === parentId) {
            const composer = document.createElement('div');
            composer.className = 'activity-child-composer';

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'activity-child-composer-input';
            input.setAttribute('placeholder', parentLabel && parentLabel.length <= 12 ? `${parentLabel}의 세부활동 입력` : '세부활동 이름 입력...');
            input.value = this.inlineChildComposerValue || '';

            const submitBtn = document.createElement('button');
            submitBtn.type = 'button';
            submitBtn.className = 'activity-child-composer-submit';
            submitBtn.textContent = '추가';

            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'activity-child-composer-cancel';
            cancelBtn.textContent = '취소';

            const closeComposer = () => {
                this.inlineChildComposerOpenParentId = null;
                this.inlineChildComposerError = '';
                this.inlineChildComposerHighlightId = null;
                this.inlineChildComposerHighlightKind = null;
                this.inlineChildComposerValue = '';
                this.inlineChildComposerFocusPending = false;
            };

            const commitValue = () => {
                this.inlineChildComposerValue = input.value;
                const result = createChildActivityForParent.call(this, parentItem, input.value);
                if (result.status === 'empty') {
                    if (typeof input.focus === 'function') input.focus();
                    return;
                }
                this.inlineChildComposerFocusPending = true;
                const nextChildren = (this.plannedActivities || []).filter((item) => item && String(item.parentId || '').trim() === parentId);
                this.openPlanActivityChildMenu(parentItem, anchorEl, nextChildren);
            };

            input.addEventListener('input', () => {
                this.inlineChildComposerValue = input.value;
                this.inlineChildComposerError = '';
                this.inlineChildComposerHighlightId = null;
                this.inlineChildComposerHighlightKind = null;
            });
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' && !event.isComposing) {
                    event.preventDefault();
                    commitValue();
                } else if (event.key === 'Escape') {
                    event.preventDefault();
                    closeComposer();
                    this.openPlanActivityChildMenu(parentItem, anchorEl, children);
                }
            });
            submitBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                commitValue();
            });
            cancelBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                closeComposer();
                this.openPlanActivityChildMenu(parentItem, anchorEl, children);
            });

            composer.appendChild(input);
            composer.appendChild(submitBtn);
            composer.appendChild(cancelBtn);
            board.appendChild(composer);

            if (this.inlineChildComposerError) {
                const error = document.createElement('div');
                error.className = 'activity-child-composer-error';
                error.textContent = this.inlineChildComposerError;
                board.appendChild(error);
            }

            if (this.inlineChildComposerFocusPending) {
                this.inlineChildComposerFocusPending = false;
                const scheduleFocus = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (fn) => setTimeout(fn, 0);
                scheduleFocus(() => {
                    if (!this.inlinePlanDropdown) return;
                    const composerInput = this.inlinePlanDropdown.querySelector('.activity-child-composer-input');
                    if (composerInput && typeof composerInput.focus === 'function') {
                        composerInput.focus();
                        if (String(this.inlineChildComposerHighlightKind || '') === 'duplicate' && typeof composerInput.select === 'function') {
                            composerInput.select();
                        }
                    }
                });
            }
        } else {
            const addChildBtn = document.createElement('button');
            addChildBtn.type = 'button';
            addChildBtn.className = 'activity-chip activity-chip-add';
            addChildBtn.setAttribute('aria-label', '+ 세부활동 추가');
            addChildBtn.title = '+ 세부활동 추가';
            addChildBtn.textContent = '+ 세부활동 추가';
            addChildBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.inlineChildComposerOpenParentId = parentId;
                this.inlineChildComposerError = '';
                this.inlineChildComposerHighlightId = null;
                this.inlineChildComposerHighlightKind = null;
                this.inlineChildComposerValue = '';
                this.inlineChildComposerFocusPending = true;
                this.openPlanActivityChildMenu(parentItem, anchorEl, children);
            });
            board.appendChild(addChildBtn);
        }

        if (typeof this.renderInlinePlanDropdownOptions === 'function') {
            this.renderInlinePlanDropdownOptions();
        }

        const freshAnchor = getOpenParentCaretAnchor.call(this) || anchorEl || null;
        if (freshAnchor) {
            this.inlinePlanChildPopoverAnchorEl = freshAnchor;
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

function openInlinePlanDropdown(index, anchorEl, endIndex = null) {
        if (this.suppressInlinePlanOpenUntil && Date.now() < this.suppressInlinePlanOpenUntil) {
            return;
        }
        const range = this.getPlannedRangeInfo(index);
        if (Number.isInteger(endIndex)) {
            range.startIndex = Math.min(range.startIndex, endIndex);
            range.endIndex = Math.max(range.endIndex, endIndex);
        }
        const anchor = this.resolveInlinePlanAnchor(anchorEl, range.startIndex);
        if (!anchor) return;
        if (this.inlinePlanDropdown && this.isSameInlinePlanTarget(range, anchor)) {
            this.clearSelection('planned');
            this.closeInlinePlanDropdown();
            return;
        }
        this.closeInlinePlanDropdown();
        this.currentPlanSource = this.getActivePlanSource();

        const isMobileInputContext = this.isInlinePlanMobileInputContext();
        this.inlinePlanTarget = { ...range, anchor };
        this.inlinePlanHighlightRange = isMobileInputContext
            ? { startIndex: range.startIndex, endIndex: range.endIndex, mergeKey: range.mergeKey || null }
            : null;
        const dropdown = document.createElement('div');
        dropdown.className = `inline-plan-dropdown${isMobileInputContext ? ' inline-plan-dropdown-sheet' : ''}`;
        dropdown.innerHTML = `
            <div class="inline-plan-input-row${isMobileInputContext ? ' inline-plan-input-row-mobile-close' : ''}">
                ${isMobileInputContext ? '<button type="button" class="inline-plan-close-btn" aria-label="닫기">×</button>' : ''}
                <input type="text" class="inline-plan-input" placeholder="활동 추가 또는 검색" />
                <button type="button" class="inline-plan-add-btn" aria-label="활동 추가" title="활동 추가">＋</button>
            </div>
            <div class="activity-chip-board"></div>
            <div class="inline-plan-subsection" hidden>
                <div class="inline-plan-subsection-head">
                    <div class="inline-plan-subsection-title"></div>
                    <button type="button" class="inline-plan-subsection-close" aria-label="세부활동 설정 닫기">×</button>
                </div>
                <div class="activity-chip-board inline-plan-sub-board"></div>
            </div>`;        dropdown.style.visibility = 'hidden';
        if (isMobileInputContext) {
            const backdrop = document.createElement('div');
            backdrop.className = 'inline-plan-backdrop';
            backdrop.addEventListener('click', () => this.closeInlinePlanDropdown());
            document.body.appendChild(backdrop);
            this.inlinePlanBackdrop = backdrop;
            document.body.classList.add('inline-plan-sheet-open');
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
        const clearBtn = dropdown.querySelector('.inline-plan-sync-btn');
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
            this.addPlannedActivityOption(val, false);
            input.value = '';
            this.currentPlanSource = 'local';
            this.renderInlinePlanDropdownOptions();
            const target = this.inlinePlanTarget;
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
                const applyOptions = { ...options, keepOpen: false };
                this.applyInlinePlanSelection(val, applyOptions);
            }
        };
        const clearHandler = () => {
            const target = this.inlinePlanTarget;
            if (!target) return;
            const startIndex = Number.isInteger(target.startIndex) ? target.startIndex : 0;
            const endIndex = Number.isInteger(target.endIndex) ? target.endIndex : startIndex;
            const baseIndex = Math.min(startIndex, endIndex);

            const previousLabel = this.getPlannedValueForIndex(baseIndex);
            const routine = previousLabel ? this.findRoutineForLabelAtIndex(previousLabel, baseIndex) : null;

            if (routine && this.ensureRoutinesAvailableOrNotify()) {
                const routineChanged = this.passRoutineForDate(routine.id, this.currentDate);
                if (routineChanged) {
                    this.scheduleSupabaseRoutineSave();
                }
                this.clearRoutineRangeForDate(routine, this.currentDate);
            } else {
                if (target.mergeKey && this.mergedFields && this.mergedFields.has(target.mergeKey)) {
                    this.mergedFields.delete(target.mergeKey);
                }
                for (let i = Math.min(startIndex, endIndex); i <= Math.max(startIndex, endIndex); i++) {
                    if (!this.timeSlots[i]) continue;
                    this.timeSlots[i].planned = '';
                    this.timeSlots[i].planActivities = [];
                    this.timeSlots[i].planTitle = '';
                    this.timeSlots[i].planTitleBandOn = false;
                }
            }
            for (let i = Math.min(startIndex, endIndex); i <= Math.max(startIndex, endIndex); i++) {
                if (!this.timeSlots[i]) continue;
                if (!this.timeSlots[i].activityLog || typeof this.timeSlots[i].activityLog !== 'object') {
                    this.timeSlots[i].activityLog = { title: '', details: '', subActivities: [], titleBandOn: false, actualGridUnits: [], actualExtraGridUnits: [], actualFailedGridUnits: [], actualOverride: false };
                }
                this.timeSlots[i].activityLog.subActivities = [];
                this.timeSlots[i].activityLog.actualGridUnits = [];
                this.timeSlots[i].activityLog.actualExtraGridUnits = [];
                this.timeSlots[i].activityLog.actualFailedGridUnits = [];
                this.timeSlots[i].activityLog.actualOverride = false;
            }
            this.modalPlanActivities = [];
            this.modalPlanActiveRow = -1;
            this.modalPlanTitle = '';
            this.modalPlanTitleBandOn = false;
            if (this.inlinePlanContext && this.inlinePlanContext.titleInput) {
                this.inlinePlanContext.titleInput.value = '';
            }
            if (this.inlinePlanContext && this.inlinePlanContext.titleToggle) {
                this.inlinePlanContext.titleToggle.checked = false;
            }
            if (this.inlinePlanContext && this.inlinePlanContext.titleField) {
                this.inlinePlanContext.titleField.hidden = true;
            }
            this.renderPlanActivitiesList();
            this.renderTimeEntries(true);
            this.calculateTotals();
            this.autoSave();
            this.renderInlinePlanDropdownOptions();

            if (getInlinePlanTargetState.call(this)) {
                const anchor = document.querySelector(`[data-index="${baseIndex}"] .planned-input`)
                    || document.querySelector(`[data-index="${baseIndex}"]`);
                if (anchor) {
                    setInlinePlanAnchorState.call(this, anchor);
                    this.positionInlinePlanDropdown(anchor);
                }
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
            addBtn.addEventListener('click', addHandler);
        }
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                clearHandler();
            });
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (this.isInlinePlanMobileInputContext()) {
                    this.suppressInlinePlanOpenUntil = Date.now() + 800;
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
        this.inlinePlanChildPopoverAnchorEl = null;
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
            if (this.routineMenu && this.routineMenu.contains(event.target)) return;
            if (this.planActivityMenu && this.planActivityMenu.contains(event.target)) return;
            if (this.planTitleMenu && this.planTitleMenu.contains(event.target)) return;
            if (this.inlinePriorityMenu && this.inlinePriorityMenu.contains(event.target)) return;
            const currentAnchor = getInlinePlanAnchorState.call(this);
            if (currentAnchor && currentAnchor.contains(event.target)) return;
            if (this.isEventWithinCurrentInlinePlanRange(event.target)) return;
            this.closeInlinePlanDropdown();
        };
        document.addEventListener('click', this.inlinePlanOutsideHandler, true);

        this.inlinePlanEscHandler = (event) => {
            if (event.key === 'Escape') this.closeInlinePlanDropdown();
        };
        document.addEventListener('keydown', this.inlinePlanEscHandler);

        this.inlinePlanPageScrollCloseHandler = (event) => {
            if (this.inlinePlanDropdown && event && event.target) {
                if (event.target === this.inlinePlanDropdown || this.inlinePlanDropdown.contains(event.target)) {
                    return;
                }
            }
            if (this.isInlinePlanMobileInputContext()) {
                this.scheduleInlinePlanViewportSync();
                return;
            }
            if (this.isInlinePlanInputFocused() || this.hasRecentInlinePlanInputIntent()) {
                this.scheduleInlinePlanViewportSync();
                return;
            }
            this.scheduleInlinePlanViewportSync();
        };
        window.addEventListener('scroll', this.inlinePlanPageScrollCloseHandler, true);
        document.addEventListener('scroll', this.inlinePlanPageScrollCloseHandler, true);

        this.inlinePlanGestureCloseHandler = (event) => {
            if (!this.inlinePlanDropdown || !event || !event.target) return;
            if (event.target === this.inlinePlanDropdown || this.inlinePlanDropdown.contains(event.target)) return;
            if (this.routineMenu && this.routineMenu.contains(event.target)) return;
            if (this.planActivityMenu && this.planActivityMenu.contains(event.target)) return;
            if (this.planTitleMenu && this.planTitleMenu.contains(event.target)) return;
            if (this.inlinePriorityMenu && this.inlinePriorityMenu.contains(event.target)) return;
            const currentAnchor = getInlinePlanAnchorState.call(this);
            if (currentAnchor && currentAnchor.contains(event.target)) return;
            if (this.isEventWithinCurrentInlinePlanRange(event.target)) return;
            if (this.isInlinePlanMobileInputContext()) {
                this.scheduleInlinePlanViewportSync();
                return;
            }
            this.scheduleInlinePlanViewportSync();
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
        if (this.inlinePlanBackdrop && this.inlinePlanBackdrop.parentNode) {
            this.inlinePlanBackdrop.parentNode.removeChild(this.inlinePlanBackdrop);
        }
        this.inlinePlanBackdrop = null;
        document.body.classList.remove('inline-plan-sheet-open');
        const timeEntries = document.getElementById('timeEntries');
        if (timeEntries) {
            timeEntries.classList.remove('inline-plan-context-active');
            timeEntries.querySelectorAll('.inline-plan-context-keep-clear').forEach((el) => el.classList.remove('inline-plan-context-keep-clear'));
        }
        this.inlinePlanDropdown = null;
        this.inlinePlanTarget = null;
        this.inlinePlanHighlightRange = null;
        this.modalPlanSectionOpen = false;
        this.modalPlanSectionOpenParentId = null;
        this.inlineChildComposerOpenParentId = null;
        this.inlineChildComposerError = '';
        this.inlineChildComposerHighlightId = null;
        this.inlineChildComposerHighlightKind = null;
        this.inlineChildComposerValue = '';
        this.inlineChildComposerFocusPending = false;
        this.inlinePlanChildPopoverAnchorEl = null;
        this.inlinePlanContext = null;
        this.inlinePlanInputIntentUntil = 0;
    }

function applyInlinePlanSelection(label, options = {}) {
        if (!this.inlinePlanTarget) return;
        const normalized = this.normalizeActivityText ? this.normalizeActivityText(label) : String(label || '').trim();
        if (!normalized) return;

        const safeStart = Number.isInteger(this.inlinePlanTarget.startIndex) ? this.inlinePlanTarget.startIndex : 0;
        const safeEnd = Number.isInteger(this.inlinePlanTarget.endIndex) ? this.inlinePlanTarget.endIndex : safeStart;
        const startIndex = Math.min(safeStart, safeEnd);
        const endIndex = Math.max(safeStart, safeEnd);

        if (this.inlinePlanTarget.mergeKey) {
            this.mergedFields.set(this.inlinePlanTarget.mergeKey, normalized);
        }

        for (let i = startIndex; i <= endIndex; i++) {
            if (!this.timeSlots[i]) continue;
            const isStart = i === startIndex;
            this.timeSlots[i].planned = isStart ? normalized : '';
            this.timeSlots[i].planActivities = [];
            this.timeSlots[i].planTitle = isStart ? normalized : '';
            this.timeSlots[i].planTitleBandOn = isStart ? false : false;
        }

        this.renderTimeEntries(Boolean(options.keepOpen));
        this.calculateTotals();
        this.autoSave();
        if (options.keepOpen && this.inlinePlanTarget) {
            const anchor = document.querySelector(`[data-index="${startIndex}"] .planned-input`)
                || document.querySelector(`[data-index="${startIndex}"]`);
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
        getInlinePlanMinimumInteractiveHeight,
        ensureInlinePlanInputVisible,
        isInlinePlanInputFocused,
        markInlinePlanInputIntent,
        hasRecentInlinePlanInputIntent,
        positionInlinePlanDropdown,
        positionInlinePlanChildPopover,
        renderInlinePlanDropdownOptions,
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
