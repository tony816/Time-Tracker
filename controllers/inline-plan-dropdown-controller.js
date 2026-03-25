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
    }

function renderInlinePlanDropdownOptions() {
        if (!this.inlinePlanDropdown || !this.inlinePlanTarget) return;
        if (this.inlinePriorityMenu) {
            this.closeInlinePriorityMenu();
        }
        const list = this.inlinePlanDropdown.querySelector('.inline-plan-options-list');
        const tabs = this.inlinePlanDropdown.querySelector('.inline-plan-tabs');
        if (!list) return;

        const startIndex = Number.isInteger(this.inlinePlanTarget.startIndex) ? this.inlinePlanTarget.startIndex : 0;
        const currentValue = this.getPlannedValueForIndex(startIndex);
        const planActivities = this.getPlanActivitiesForIndex(startIndex);
        const hasPlanSplit = Array.isArray(planActivities) && planActivities.length > 0;
        const grouped = this.buildPlannedActivityOptions(!hasPlanSplit && currentValue ? [currentValue] : []);
        const searchInput = this.inlinePlanDropdown.querySelector('.inline-plan-input');
        const searchQuery = searchInput ? (searchInput.value || '') : '';
        const filteredGrouped = {
            local: this.filterInlinePlanSearchItems(grouped.local || [], searchQuery),
            notion: this.filterInlinePlanSearchItems(grouped.notion || [], searchQuery)
        };
        const counts = { local: (filteredGrouped.local || []).length, notion: (filteredGrouped.notion || []).length };
        this.updatePlanSourceTabs(counts, tabs);

        const activeSource = this.getActivePlanSource();
        const visibleItems = filteredGrouped[activeSource] || [];
        const normalizedCurrent = this.normalizeActivityText ? this.normalizeActivityText(currentValue) : String(currentValue || '').trim();

        list.innerHTML = '';
        if (visibleItems.length === 0) {
            const empty = document.createElement('li');
            empty.className = 'inline-plan-empty';
            empty.textContent = activeSource === 'notion'
                ? '노션에서 불러온 활동이 없습니다.'
                : '등록된 활동이 없습니다.';
            list.appendChild(empty);
            return;
        }

        visibleItems.forEach((item) => {
            const { label, source } = item;
            const priorityRank = this.normalizePriorityRankValue(item.priorityRank);
            const recommendedSeconds = Number.isFinite(item.recommendedSeconds) ? Math.max(0, Math.floor(item.recommendedSeconds)) : null;
            const normalizedLabel = this.normalizeActivityText ? this.normalizeActivityText(label) : String(label || '').trim();
            const li = document.createElement('li');
            li.className = 'inline-plan-option inline-plan-option-row';
            li.dataset.source = source;
            if (normalizedCurrent && normalizedLabel === normalizedCurrent) {
                li.classList.add('selected');
            }

            const content = document.createElement('div');
            content.className = 'inline-plan-task-cell';
            const titleWrap = document.createElement('div');
            titleWrap.className = 'inline-plan-task-main';
            const priorityButton = document.createElement('button');
            priorityButton.type = 'button';
            priorityButton.className = 'inline-plan-priority-chip';
            priorityButton.setAttribute('aria-haspopup', 'menu');
            priorityButton.setAttribute('aria-expanded', 'false');
            if (Number.isFinite(priorityRank)) {
                priorityButton.dataset.pr = String(priorityRank);
                priorityButton.textContent = `Pr.${priorityRank}`;
            } else {
                priorityButton.dataset.empty = 'true';
                priorityButton.textContent = 'Pr.-';
            }
            if (source === 'notion') {
                priorityButton.disabled = true;
                priorityButton.title = 'Notion priority';
            } else {
                priorityButton.title = 'Priority options';
                priorityButton.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    this.openInlinePriorityMenu(priorityButton, { label, source, priorityRank });
                });
            }
            titleWrap.appendChild(priorityButton);
            const text = document.createElement('span');
            text.className = 'inline-plan-option-label';
            text.textContent = label;
            titleWrap.appendChild(text);

            const right = document.createElement('div');
            right.className = 'inline-plan-option-meta';
            if (source === 'notion') {
                const sourceTag = document.createElement('span');
                sourceTag.className = 'inline-plan-option-source';
                sourceTag.textContent = '노션';
                right.appendChild(sourceTag);
            }

            const routineBtn = document.createElement('button');
            routineBtn.type = 'button';
            routineBtn.className = 'inline-plan-option-routine';
            routineBtn.textContent = '루틴';
            const ctxIndex = this.inlinePlanTarget && Number.isInteger(this.inlinePlanTarget.startIndex)
                ? this.inlinePlanTarget.startIndex
                : null;
            const activeRoutine = Number.isInteger(ctxIndex)
                ? this.findActiveRoutineForLabelAtIndex(normalizedLabel, ctxIndex, this.currentDate)
                : null;
            if (activeRoutine) {
                routineBtn.classList.add('active');
                routineBtn.title = `루틴: ${this.getRoutinePatternLabel(activeRoutine.pattern)}`;
            } else {
                routineBtn.title = '루틴 설정';
            }
            routineBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                this.openRoutineMenuFromInlinePlan(label, routineBtn);
            });
            right.appendChild(routineBtn);
            if (source !== 'notion') {
                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'inline-plan-option-remove';
                removeBtn.textContent = '삭제';
                removeBtn.addEventListener('click', (event) => {
                    event.stopPropagation();
                    this.removePlannedActivityOption(label);
                    this.renderInlinePlanDropdownOptions();
                });
                right.appendChild(removeBtn);
            }
            if (recommendedSeconds && recommendedSeconds > 0) {
                const displaySeconds = this.normalizeDurationStep
                    ? (this.normalizeDurationStep(recommendedSeconds) || recommendedSeconds)
                    : recommendedSeconds;
                const time = document.createElement('span');
                time.className = 'inline-plan-option-time';
                time.textContent = this.formatDurationSummary(displaySeconds);
                right.appendChild(time);
            }

            content.appendChild(titleWrap);
            content.appendChild(right);
            li.appendChild(content);
            content.addEventListener('click', () => this.applyInlinePlanSelection(label, { keepOpen: true }));
            list.appendChild(li);
        });
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
            <div class="inline-plan-tabs plan-tabs">
                <button type="button" class="plan-tab" data-source="local" role="tab" aria-selected="false">Clear</button>
                ${this.isNotionUIVisible() ? '<button type="button" class="plan-tab" data-source="notion" role="tab" aria-selected="false">노션</button>' : ''}
            </div>
            <div class="inline-plan-input-row${isMobileInputContext ? ' inline-plan-input-row-mobile-close' : ''}">
                ${isMobileInputContext ? '<button type="button" class="inline-plan-close-btn" aria-label="드롭다운 닫기">‹</button>' : ''}
                <input type="text" class="inline-plan-input" placeholder="활동 추가 또는 검색" />
                <button type="button" class="inline-plan-add-btn" aria-label="활동 추가" title="활동 추가">＋</button>
            </div>
            <div class="inline-plan-options dropdown">
                <ul class="inline-plan-options-list"></ul>
            </div>
            <button type="button" class="inline-plan-split-btn" aria-label="세부 활동 분해">세부 활동 분해</button>
            <div class="inline-plan-subsection" hidden>
                <div class="inline-plan-title-area">
                    <div class="title-band-toggle inline-plan-title-toggle">
                        <label>
                            <input type="checkbox" class="inline-plan-title-band">
                            활동 제목 밴드 표시
                        </label>
                    </div>
                    <div class="inline-plan-title-field">
                        <div class="title-input-wrapper">
                            <button type="button" class="inline-plan-title-input plan-title-input" aria-haspopup="menu" aria-expanded="false">활동 제목</button>
                            <button type="button" class="title-clear-btn inline-plan-title-clear">지우기</button>
                        </div>
                    </div>
                </div>
                <div class="sub-activities-summary">
                    <div>총 시간: <span class="inline-plan-sub-total">0시간</span></div>
                    <div>분해 합계: <span class="inline-plan-sub-used">0시간</span></div>
                </div>
                <div class="sub-activities-list inline-plan-sub-list"></div>
                <div class="sub-activities-actions">
                    <button type="button" class="sub-activity-action-btn inline-plan-sub-add">행 추가</button>
                    <button type="button" class="sub-activity-action-btn inline-plan-sub-fill" title="잔여 시간 추가">잔여+</button>
                    <span class="sub-activities-notice inline-plan-sub-note"></span>
                </div>
            </div>
        `;
        dropdown.style.visibility = 'hidden';
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

        const tabs = dropdown.querySelector('.inline-plan-tabs');
        if (tabs) {
            tabs.addEventListener('click', (event) => {
                const btn = event.target.closest('.plan-tab');
                if (!btn || !tabs.contains(btn)) return;
                const source = this.isNotionUIVisible() && btn.dataset.source === 'notion' ? 'notion' : 'local';

                // "직접 추가" 탭은 휴지통 버튼과 동일하게 입력/슬롯 내용을 비우는 액션 버튼으로 동작
                if (source === 'local') {
                    clearHandler();
                    return;
                }

                if (this.currentPlanSource === source) return;
                this.currentPlanSource = source;
                this.renderInlinePlanDropdownOptions();
                if (source === 'notion' && this.isNotionUIVisible()) runInlineNotionSync();
            });
        }

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
        const splitBtn = dropdown.querySelector('.inline-plan-split-btn');
        const subSection = dropdown.querySelector('.inline-plan-subsection');
        const inlineList = dropdown.querySelector('.inline-plan-sub-list');
        const inlineAdd = dropdown.querySelector('.inline-plan-sub-add');
        const inlineFill = dropdown.querySelector('.inline-plan-sub-fill');
        const inlineNotice = dropdown.querySelector('.inline-plan-sub-note');
        const inlineTotal = dropdown.querySelector('.inline-plan-sub-total');
        const inlineUsed = dropdown.querySelector('.inline-plan-sub-used');
        const inlineTitleInput = dropdown.querySelector('.inline-plan-title-input');
        const inlineTitleClear = dropdown.querySelector('.inline-plan-title-clear');
        const inlineTitleBand = dropdown.querySelector('.inline-plan-title-band');
        const inlineTitleField = dropdown.querySelector('.inline-plan-title-field');

        // 컨텍스트 초기화: 인라인 전용 세부활동 요소 지정
        this.inlinePlanContext = {
            root: dropdown,
            list: inlineList,
            totalEl: inlineTotal,
            usedEl: inlineUsed,
            noticeEl: inlineNotice,
            fillBtn: inlineFill,
            addBtn: inlineAdd,
            section: subSection,
            titleInput: inlineTitleInput,
            titleClear: inlineTitleClear,
            titleToggle: inlineTitleBand,
            titleField: inlineTitleField
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
        if (subSection) subSection.hidden = true;
        if (inlineFill) inlineFill.hidden = true;
        // 제목 초기화
        const baseSlot = this.timeSlots[range.startIndex] || {};
        this.modalPlanTitle = typeof baseSlot.planTitle === 'string'
            ? (this.normalizeActivityText ? this.normalizeActivityText(baseSlot.planTitle) : baseSlot.planTitle.trim())
            : '';
        this.modalPlanTitleBandOn = Boolean(baseSlot.planTitleBandOn && this.modalPlanTitle);
        if (inlineTitleInput) this.setPlanTitleInputDisplay(inlineTitleInput, this.modalPlanTitle || '');
        if (inlineTitleBand) {
            inlineTitleBand.checked = this.modalPlanTitleBandOn;
        }
        if (inlineTitleField) {
            inlineTitleField.hidden = !this.modalPlanTitleBandOn;
        }
        this.updatePlanActivitiesSummary();
        this.renderPlanActivitiesList();

        if (splitBtn && subSection) {
            splitBtn.addEventListener('click', () => {
                const willShow = subSection.hidden;
                subSection.hidden = !willShow;
                this.modalPlanSectionOpen = willShow;
                if (inlineFill) inlineFill.hidden = !willShow;
                splitBtn.classList.toggle('open', willShow);
                splitBtn.textContent = willShow ? '세부 활동 분해 닫기' : '세부 활동 분해';
                if (willShow && this.modalPlanActivities.length === 0) {
                    this.addPlanActivityRow();
                } else if (willShow) {
                    this.renderPlanActivitiesList();
                }
                this.updatePlanActivitiesSummary();
            });
        }

        if (inlineAdd) {
            inlineAdd.addEventListener('click', () => {
                this.openPlanActivitiesSection();
                this.addPlanActivityRow();
            });
        }

        if (inlineFill) {
            inlineFill.addEventListener('click', () => {
                this.fillRemainingPlanActivity();
            });
        }

        if (inlineList) {
            inlineList.addEventListener('input', (event) => {
                if (event.target.classList.contains('plan-activity-label')) {
                    this.handlePlanActivitiesInput(event);
                }
            });
            inlineList.addEventListener('change', (event) => {
                if (event.target.classList.contains('plan-activity-label')) {
                    this.handlePlanActivitiesInput(event);
                }
            });
            inlineList.addEventListener('click', (event) => {
                const spinnerBtn = event.target.closest('.spinner-btn');
                if (spinnerBtn) {
                    const direction = spinnerBtn.dataset.direction === 'up' ? 1 : -1;
                    const idx = parseInt(spinnerBtn.dataset.index, 10);
                    if (Number.isFinite(idx)) {
                        this.adjustActivityDuration('plan', idx, direction);
                    }
                    return;
                }
                const removeBtn = event.target.closest('.remove-sub-activity');
                if (removeBtn) {
                    this.handlePlanActivitiesRemoval(event);
                    return;
                }
                const row = event.target.closest('.sub-activity-row');
                if (row && inlineList.contains(row)) {
                    const idx = parseInt(row.dataset.index, 10);
                    if (Number.isFinite(idx)) this.setPlanActiveRow(idx);
                }
            });
        }

        if (inlineTitleInput) {
            if (inlineTitleInput.tagName === 'BUTTON') {
                inlineTitleInput.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    this.openPlanTitleMenu(inlineTitleInput, { inline: true });
                });
            } else {
                inlineTitleInput.addEventListener('input', () => {
                    this.modalPlanTitle = this.normalizeActivityText
                        ? this.normalizeActivityText(inlineTitleInput.value || '')
                        : (inlineTitleInput.value || '').trim();
                    this.syncPlanTitleBandToggleState();
                    this.syncInlinePlanToSlots();
                });
            }
        }

        if (inlineTitleClear && inlineTitleInput) {
            inlineTitleClear.addEventListener('click', () => {
                this.setPlanTitleInputDisplay(inlineTitleInput, '');
                this.modalPlanTitle = '';
                this.modalPlanTitleBandOn = false;
                if (inlineTitleBand) inlineTitleBand.checked = false;
                if (inlineTitleField) inlineTitleField.hidden = true;
                this.syncPlanTitleBandToggleState();
                this.syncInlinePlanToSlots();
            });
        }

        if (inlineTitleBand) {
            inlineTitleBand.addEventListener('change', () => {
                this.modalPlanTitleBandOn = inlineTitleBand.checked;
                if (inlineTitleField) inlineTitleField.hidden = !inlineTitleBand.checked;
                this.syncPlanTitleBandToggleState();
                this.syncInlinePlanToSlots();
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
            this.closeInlinePlanDropdown();
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
        renderInlinePlanDropdownOptions,
        openRoutineMenuFromInlinePlan,
        isSameInlinePlanTarget,
        isEventWithinCurrentInlinePlanRange,
        openInlinePlanDropdown,
        applyInlinePlanBackgroundContext,
        closeInlinePlanDropdown,
        applyInlinePlanSelection
    });
});
