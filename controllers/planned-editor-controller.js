(function attachTimeTrackerPlannedEditorController(root, factory) {
    const api = factory(root);

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        const existing = (root.TimeTrackerPlannedEditorController && typeof root.TimeTrackerPlannedEditorController === 'object')
            ? root.TimeTrackerPlannedEditorController
            : {};
        root.TimeTrackerPlannedEditorController = Object.assign(existing, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildTimeTrackerPlannedEditorController(root) {
    function getPlanActivitiesForIndex(index) {
            let baseIndex = index;
            const plannedMergeKey = this.findMergeKey('planned', index);
            if (plannedMergeKey) {
                const [, startStr] = plannedMergeKey.split('-');
                const start = parseInt(startStr, 10);
                if (Number.isFinite(start)) baseIndex = start;
            }
            const slot = this.timeSlots[baseIndex];
            return this.normalizePlanActivitiesArray(slot && slot.planActivities);
        }

    function updatePlanActivitiesAssignment(baseIndex, label, seconds) {
            if (!Number.isFinite(baseIndex) || baseIndex < 0 || baseIndex >= this.timeSlots.length) return false;
            const normalizedLabel = this.normalizeActivityText
                ? this.normalizeActivityText(label || '')
                : String(label || '').trim();
            if (!normalizedLabel) return false;
            const plannedBaseIndex = this.getSplitBaseIndex ? this.getSplitBaseIndex('planned', baseIndex) : baseIndex;
            const slot = this.timeSlots[plannedBaseIndex];
            if (!slot) return false;
            const normalizedSeconds = this.normalizeDurationStep(Number.isFinite(seconds) ? seconds : 0) || 0;
            let planActivities = this.normalizePlanActivitiesArray(slot.planActivities);
            let updated = false;
    
            if (planActivities.length > 0) {
                let found = false;
                planActivities = planActivities.map((item) => {
                    const itemLabel = this.normalizeActivityText
                        ? this.normalizeActivityText(item.label || '')
                        : String(item.label || '').trim();
                    if (!itemLabel) return item;
                    if (itemLabel === normalizedLabel) {
                        found = true;
                        updated = true;
                        return { label: itemLabel, seconds: normalizedSeconds };
                    }
                    return item;
                });
                if (!found) {
                    planActivities.push({ label: normalizedLabel, seconds: normalizedSeconds });
                    updated = true;
                }
            } else {
                planActivities = [{ label: normalizedLabel, seconds: normalizedSeconds }];
                updated = true;
            }
    
            if (updated) {
                slot.planActivities = planActivities.map(item => ({ ...item }));
            }
            return updated;
        }

    function getValidPlanActivitiesSeconds() {
            if (!Array.isArray(this.modalPlanActivities)) return 0;
            return this.modalPlanActivities.reduce((sum, item) => {
                if (!item || item.invalid) return sum;
                const secs = Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
                return sum + secs;
            }, 0);
        }

    function getPlanUIElements() {
            if (this.inlinePlanContext) {
                return this.inlinePlanContext;
            }
            return {
                list: document.getElementById('planActivitiesList'),
                totalEl: document.getElementById('planSplitTotalTime'),
                usedEl: document.getElementById('planSplitUsedTime'),
                noticeEl: document.getElementById('planActivitiesNotice'),
                fillBtn: document.getElementById('fillRemainingPlanActivity'),
                addBtn: document.getElementById('addPlanActivityRow'),
                section: document.getElementById('planActivitiesSection')
            };
        }

    function updatePlanActivitiesToggleLabel() {
            const toggleBtn = document.getElementById('togglePlanActivities');
            if (toggleBtn) {
                toggleBtn.textContent = this.modalPlanSectionOpen ? '세부 활동 접기' : '세부 활동 분해';
            }
        }

    function updatePlanActivitiesSummary() {
            const { totalEl, usedEl, noticeEl } = this.getPlanUIElements();
            if (!totalEl || !usedEl || !noticeEl) return;
    
            const total = Math.max(0, Number(this.modalPlanTotalSeconds) || 0);
            const used = this.getValidPlanActivitiesSeconds();
            const hasInvalid = (this.modalPlanActivities || []).some(item => item && item.invalid);
    
            totalEl.textContent = this.formatDurationSummary(total);
            usedEl.textContent = this.formatDurationSummary(used);
    
            noticeEl.textContent = '';
            noticeEl.classList.remove('ok');
    
            if (!Array.isArray(this.modalPlanActivities) || this.modalPlanActivities.length === 0) {
                if (total > 0) {
                    noticeEl.textContent = '분해를 추가하지 않으면 전체 시간이 동일하게 적용됩니다.';
                }
                return;
            }
    
            if (hasInvalid) {
                noticeEl.textContent = '잘못된 시간 형식이 있습니다.';
                return;
            }
    
            if (total === 0) {
                noticeEl.textContent = '총 시간이 0이라 분해 합계 검증을 건너뜁니다.';
                noticeEl.classList.add('ok');
                return;
            }
    
            if (used === total) {
                noticeEl.textContent = '분해 합계가 총 시간과 일치합니다.';
                noticeEl.classList.add('ok');
            } else if (used > total) {
                noticeEl.textContent = '분해 합계가 총 시간을 초과했습니다.';
            } else {
                const remaining = total - used;
                noticeEl.textContent = `잔여 시간 ${this.formatDurationSummary(remaining)}이 남아 있습니다.`;
            }
            this.refreshSpinnerStates('plan');
            this.syncPlanTitleBandToggleState();
        }

    function syncPlanTitleBandToggleState() {
            const ctxToggle = this.inlinePlanContext && this.inlinePlanContext.titleToggle;
            const ctxField = this.inlinePlanContext && this.inlinePlanContext.titleField;
            const ctxInput = this.inlinePlanContext && this.inlinePlanContext.titleInput;
            const toggle = ctxToggle || document.getElementById('planTitleBandToggle');
            const field = ctxField || document.getElementById('planTitleField');
            const input = ctxInput || this.ensurePlanTitleButton(document.getElementById('planTitleInput'));
            if (!toggle) return;
            const normalizedTitle = this.normalizeActivityText
                ? this.normalizeActivityText(this.modalPlanTitle || '')
                : (this.modalPlanTitle || '').trim();
            const hasTitle = Boolean(normalizedTitle);
    
            // 제목이 없더라도 토글은 항상 활성화(입력 가능하게)하고,
            // 토글이 켜졌는데 제목이 없다면 기본값을 자동 채움
            if (this.modalPlanTitleBandOn && !hasTitle) {
                const fallbackRaw = (this.modalSelectedActivities && this.modalSelectedActivities[0])
                    || (this.modalPlanActivities && this.modalPlanActivities[0] && this.modalPlanActivities[0].label)
                    || '';
                const fallback = this.normalizeActivityText
                    ? this.normalizeActivityText(fallbackRaw || '')
                    : (fallbackRaw || '').trim();
                if (fallback) {
                    this.modalPlanTitle = fallback;
                    if (input) input.value = fallback;
                }
            }
    
            if (field) {
                field.hidden = !this.modalPlanTitleBandOn;
            }
            if (input) {
                this.setPlanTitleInputDisplay(input, this.modalPlanTitle || '');
            }
            toggle.checked = this.modalPlanTitleBandOn;
            toggle.disabled = false;
            this.updateSchedulePreview && this.updateSchedulePreview();
        }

    function renderPlanActivitiesList() {
            const { list } = this.getPlanUIElements();
            if (!list) return;
            const dropdown = this.inlinePlanDropdown;
            const previousDropdownScrollTop = dropdown ? dropdown.scrollTop : null;
            this.closePlanActivityMenu();
            list.innerHTML = '';
            (this.modalPlanActivities || []).forEach((item, idx) => {
                const row = document.createElement('div');
                row.className = 'sub-activity-row';
                row.dataset.index = String(idx);
                if (item.invalid) row.classList.add('invalid');
                if (idx === this.modalPlanActiveRow) row.classList.add('active');
    
                const labelButton = document.createElement('button');
                labelButton.type = 'button';
                labelButton.className = 'plan-activity-label';
                labelButton.setAttribute('aria-label', '세부 활동');
                labelButton.setAttribute('aria-haspopup', 'menu');
                labelButton.setAttribute('aria-expanded', 'false');
                const normalizedLabel = this.normalizeActivityText
                    ? this.normalizeActivityText(item.label || '')
                    : String(item.label || '').trim();
                labelButton.textContent = normalizedLabel || '세부 활동';
                if (!normalizedLabel) labelButton.classList.add('empty');
                labelButton.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    this.setPlanActiveRow(idx);
                    this.openPlanActivityMenu(idx, labelButton);
                });
    
                const spinner = this.createDurationSpinner({
                    kind: 'plan',
                    index: idx,
                    seconds: Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0
                });
    
                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'remove-sub-activity';
                removeBtn.textContent = '삭제';
    
                row.appendChild(labelButton);
                row.appendChild(spinner);
                row.appendChild(removeBtn);
                list.appendChild(row);
            });
    
            if ((this.modalPlanActivities || []).length === 0 && this.modalPlanSectionOpen) {
                const empty = document.createElement('div');
                empty.className = 'sub-activities-empty';
                empty.textContent = '세부 활동을 추가해보세요.';
                list.appendChild(empty);
            }
    
            this.updatePlanActivitiesSummary();
            this.refreshSpinnerStates('plan');
            this.updatePlanRowActiveStyles();
            this.syncPlanTitleBandToggleState();
            this.syncInlinePlanToSlots();
            if (dropdown && previousDropdownScrollTop != null) {
                const maxScrollTop = Math.max(0, dropdown.scrollHeight - dropdown.clientHeight);
                dropdown.scrollTop = Math.min(previousDropdownScrollTop, maxScrollTop);
            }
        }

    function isValidPlanRow(index) {
            return Number.isInteger(index)
                && index >= 0
                && index < (this.modalPlanActivities ? this.modalPlanActivities.length : 0);
        }

    function updatePlanRowActiveStyles() {
            const { list } = this.getPlanUIElements();
            if (!list) return;
            const activeIndex = this.isValidPlanRow(this.modalPlanActiveRow) ? this.modalPlanActiveRow : -1;
            list.querySelectorAll('.sub-activity-row').forEach((rowEl) => {
                const idx = parseInt(rowEl.dataset.index, 10);
                rowEl.classList.toggle('active', idx === activeIndex);
            });
        }

    function setPlanActiveRow(index, options = {}) {
            const validIndex = this.isValidPlanRow(index) ? index : -1;
            this.modalPlanActiveRow = validIndex;
            this.updatePlanRowActiveStyles();
            if (options.focusLabel && this.isValidPlanRow(validIndex)) {
                this.focusPlanRowLabel(validIndex);
            }
        }

    function focusPlanRowLabel(index) {
            if (!this.isValidPlanRow(index)) return;
            try {
                const { list } = this.getPlanUIElements();
                if (!list) return;
                const row = list.querySelector(`.sub-activity-row[data-index="${index}"]`);
                if (!row) return;
                const input = row.querySelector('.plan-activity-label');
                if (input) input.focus();
            } catch (e) {}
        }

    function resolveRecommendedPlanSeconds(meta = {}) {
            if (!meta || typeof meta !== 'object') return 0;
            const secondKeys = [
                'recommendedSeconds',
                'suggestedSeconds',
                'seconds',
                'estimatedSeconds',
                'expectedSeconds',
                'plannedSeconds',
                'defaultSeconds',
                'durationSeconds'
            ];
            for (const key of secondKeys) {
                if (!Object.prototype.hasOwnProperty.call(meta, key)) continue;
                const value = Number(meta[key]);
                if (Number.isFinite(value) && value > 0) {
                    return value;
                }
            }
            const minuteKeys = [
                'recommendedMinutes',
                'suggestedMinutes',
                'minutes',
                'estimatedMinutes',
                'expectedMinutes',
                'plannedMinutes',
                'durationMinutes'
            ];
            for (const key of minuteKeys) {
                if (!Object.prototype.hasOwnProperty.call(meta, key)) continue;
                const value = Number(meta[key]);
                if (Number.isFinite(value) && value > 0) {
                    return value * 60;
                }
            }
            return 0;
        }

    function adjustActivityDuration(kind, index, direction) {
            if (kind !== 'plan') return;
            const step = 600;
            const items = this.modalPlanActivities || [];
            if (!items[index]) return;
            const ctx = this.getPlanUIElements();
            const spinnerList = (ctx && ctx.list) || document.getElementById('planActivitiesList');
            const spinner = spinnerList ? spinnerList.querySelector(`.time-spinner[data-kind="${kind}"][data-index="${index}"]`) : null;
            const currentSeconds = Number.isFinite(items[index].seconds) ? Math.max(0, Math.floor(items[index].seconds)) : 0;
            const limit = Number(this.modalPlanTotalSeconds) || 0;
    
            let available = 0;
            if (Number.isFinite(limit) && limit > 0 && Array.isArray(items)) {
                const otherSum = items.reduce((sum, item, idx) => {
                    if (idx === index || !item) return sum;
                    const secs = Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
                    return sum + secs;
                }, 0);
                available = Math.max(0, limit - otherSum);
            }
    
            let newSeconds;
            if (direction < 0 && currentSeconds === 0) {
                newSeconds = available > 0 ? available : 0;
            } else {
                newSeconds = currentSeconds + (direction * step);
            }
            if (newSeconds < 0) newSeconds = 0;
            if (Number.isFinite(available) && newSeconds > available) {
                newSeconds = available;
            }
    
            newSeconds = this.normalizeDurationStep(newSeconds) || 0;
            if (Number.isFinite(available) && newSeconds > available) {
                newSeconds = this.normalizeDurationStep(available) || available;
            }
            if (!Number.isFinite(newSeconds)) newSeconds = 0;
    
            items[index].seconds = newSeconds;
            items[index].invalid = false;
            if (spinner) this.updateSpinnerDisplay(spinner, newSeconds);
    
            this.updatePlanActivitiesSummary();
            this.syncInlinePlanToSlots();
            this.refreshSpinnerStates(kind);
        }

    function openPlanActivitiesSection() {
            const ctx = this.getPlanUIElements();
            const section = ctx.section || document.getElementById('planActivitiesSection');
            this.modalPlanSectionOpen = true;
            if (section) section.hidden = false;
            const planTitleToggleRow = document.getElementById('planTitleToggleRow');
            if (planTitleToggleRow) {
                planTitleToggleRow.hidden = false;
            }
            const fillPlanBtn = ctx.fillBtn || document.getElementById('fillRemainingPlanActivity');
            if (fillPlanBtn) {
                fillPlanBtn.hidden = false;
            }
            this.updatePlanActivitiesToggleLabel();
            if (!this.isValidPlanRow(this.modalPlanActiveRow) && (this.modalPlanActivities || []).length > 0) {
                this.modalPlanActiveRow = 0;
            }
            this.updatePlanRowActiveStyles();
        }

    function closePlanActivitiesSection() {
            const ctx = this.getPlanUIElements();
            const section = ctx.section || document.getElementById('planActivitiesSection');
            this.modalPlanSectionOpen = false;
            if (section) section.hidden = true;
            const planTitleToggleRow = document.getElementById('planTitleToggleRow');
            if (planTitleToggleRow) {
                planTitleToggleRow.hidden = true;
            }
            const fillPlanBtn = ctx.fillBtn || document.getElementById('fillRemainingPlanActivity');
            if (fillPlanBtn) {
                fillPlanBtn.hidden = true;
            }
            this.updatePlanActivitiesToggleLabel();
            this.modalPlanActiveRow = -1;
            this.updatePlanRowActiveStyles();
        }

    function addPlanActivityRow(defaults = {}) {
            const seconds = this.normalizeDurationStep(Number.isFinite(defaults.seconds) ? Number(defaults.seconds) : 0) || 0;
            const label = typeof defaults.label === 'string' ? defaults.label : '';
            const newIndex = this.modalPlanActivities.push({ label, seconds, invalid: !!defaults.invalid }) - 1;
            this.modalPlanActiveRow = newIndex;
            this.renderPlanActivitiesList();
            if (defaults.focusLabel !== false) {
                this.focusPlanRowLabel(newIndex);
            }
            this.syncInlinePlanToSlots();
        }

    function handlePlanActivitiesInput(event) {
            const { list } = this.getPlanUIElements();
            if (!list || !list.contains(event.target)) return;
            const row = event.target.closest('.sub-activity-row');
            if (!row) return;
            const idx = parseInt(row.dataset.index, 10);
            if (!Number.isFinite(idx) || !this.modalPlanActivities[idx]) return;
            const item = this.modalPlanActivities[idx];
    
            if (event.target.classList.contains('plan-activity-label')) {
                item.label = this.normalizeActivityText
                    ? this.normalizeActivityText(event.target.value || '')
                    : String(event.target.value || '').trim();
            }
    
            this.updatePlanActivitiesSummary();
            this.syncInlinePlanToSlots();
        }

    function applyPlanActivityLabelSelection(index, label) {
            if (!this.isValidPlanRow(index)) return false;
            const normalized = this.normalizeActivityText
                ? this.normalizeActivityText(label || '')
                : String(label || '').trim();
            const item = this.modalPlanActivities[index];
            if (!item) return false;
            item.label = normalized;
            item.invalid = false;
            this.modalPlanActiveRow = index;
            this.renderPlanActivitiesList();
            return true;
        }

    function openPlanActivityMenu(index, anchorEl) {
            if (!this.isValidPlanRow(index) || !anchorEl || !anchorEl.isConnected) return;
            this.closePlanActivityMenu();
    
            const currentRaw = this.modalPlanActivities[index] && this.modalPlanActivities[index].label;
            const normalize = (value) => this.normalizeActivityText
                ? this.normalizeActivityText(value || '')
                : String(value || '').trim();
            const normalizedCurrent = normalize(currentRaw);
            const grouped = this.buildPlannedActivityOptions(normalizedCurrent ? [normalizedCurrent] : []);
    
            const menu = document.createElement('div');
            menu.className = 'plan-activity-menu actual-activity-menu';
            menu.setAttribute('role', 'menu');
    
            const clearBtn = document.createElement('button');
            clearBtn.type = 'button';
            clearBtn.className = 'plan-activity-menu-item plan-activity-menu-clear';
            clearBtn.dataset.label = '';
            clearBtn.textContent = '비우기';
            menu.appendChild(clearBtn);
    
            const divider = document.createElement('div');
            divider.className = 'plan-activity-menu-divider';
            menu.appendChild(divider);
    
            const buildSection = (title, items) => {
                const section = document.createElement('div');
                section.className = 'plan-activity-menu-section';
                const heading = document.createElement('div');
                heading.className = 'plan-activity-menu-title';
                heading.textContent = title;
                section.appendChild(heading);
                if (!items || items.length === 0) {
                    const empty = document.createElement('div');
                    empty.className = 'plan-activity-menu-empty';
                    empty.textContent = '목록 없음';
                    section.appendChild(empty);
                    return section;
                }
                items.forEach((item) => {
                    const label = normalize(item && item.label);
                    if (!label) return;
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'plan-activity-menu-item';
                    btn.dataset.label = label;
                    btn.textContent = label;
                    if (normalizedCurrent && label === normalizedCurrent) {
                        btn.classList.add('active');
                    }
                    section.appendChild(btn);
                });
                return section;
            };
    
            menu.appendChild(buildSection('직접 추가', grouped.local || []));
            if (this.isNotionUIVisible()) menu.appendChild(buildSection('노션', grouped.notion || []));
    
            document.body.appendChild(menu);
            this.planActivityMenu = menu;
            this.planActivityMenuContext = { index, anchorEl };
            anchorEl.setAttribute('aria-expanded', 'true');
    
            menu.addEventListener('click', (event) => {
                const btn = event.target.closest('.plan-activity-menu-item');
                if (!btn || !menu.contains(btn)) return;
                if (btn.disabled) return;
                event.preventDefault();
                event.stopPropagation();
                const label = btn.dataset.label != null ? btn.dataset.label : '';
                this.applyPlanActivityLabelSelection(index, label);
                this.closePlanActivityMenu();
            });
    
            this.positionPlanActivityMenu(anchorEl);
    
            this.planActivityMenuOutsideHandler = (event) => {
                if (!this.planActivityMenu) return;
                const t = event.target;
                if (this.planActivityMenu.contains(t)) return;
                if (anchorEl && (t === anchorEl || (anchorEl.contains && anchorEl.contains(t)))) return;
                this.closePlanActivityMenu();
            };
            document.addEventListener('mousedown', this.planActivityMenuOutsideHandler, true);
    
            this.planActivityMenuEscHandler = (event) => {
                if (event.key === 'Escape') {
                    this.closePlanActivityMenu();
                }
            };
            document.addEventListener('keydown', this.planActivityMenuEscHandler);
        }

    function positionPlanActivityMenu(anchorEl) {
            if (!this.planActivityMenu) return;
            if (!anchorEl || !anchorEl.isConnected) return;
            const rect = anchorEl.getBoundingClientRect();
            if (!rect || (!rect.width && !rect.height)) return;
    
            const menu = this.planActivityMenu;
            const scrollX = window.scrollX || document.documentElement.scrollLeft || 0;
            const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
            const viewportWidth = document.documentElement.clientWidth || window.innerWidth || 0;
            const viewportHeight = document.documentElement.clientHeight || window.innerHeight || 0;
    
            menu.style.visibility = 'hidden';
            menu.style.left = '0px';
            menu.style.top = '0px';
    
            const menuWidth = menu.offsetWidth || 240;
            const menuHeight = menu.offsetHeight || 220;
    
            let left = rect.left + scrollX;
            let top = rect.bottom + scrollY + 6;
    
            const maxLeft = scrollX + viewportWidth - menuWidth - 12;
            if (left > maxLeft) {
                left = Math.max(scrollX + 12, maxLeft);
            }
    
            const maxTop = scrollY + viewportHeight - menuHeight - 12;
            if (top > maxTop) {
                top = rect.top + scrollY - menuHeight - 6;
            }
            if (top < scrollY + 12) {
                top = scrollY + 12;
            }
    
            menu.style.left = `${Math.round(left)}px`;
            menu.style.top = `${Math.round(top)}px`;
            menu.style.visibility = 'visible';
        }

    function closePlanActivityMenu() {
            if (this.planActivityMenuOutsideHandler) {
                document.removeEventListener('mousedown', this.planActivityMenuOutsideHandler, true);
                this.planActivityMenuOutsideHandler = null;
            }
            if (this.planActivityMenuEscHandler) {
                document.removeEventListener('keydown', this.planActivityMenuEscHandler);
                this.planActivityMenuEscHandler = null;
            }
            if (this.planActivityMenuContext && this.planActivityMenuContext.anchorEl) {
                try { this.planActivityMenuContext.anchorEl.setAttribute('aria-expanded', 'false'); } catch (_) {}
            }
            if (this.planActivityMenu && this.planActivityMenu.parentNode) {
                this.planActivityMenu.parentNode.removeChild(this.planActivityMenu);
            }
            this.planActivityMenu = null;
            this.planActivityMenuContext = null;
        }

    function openPlanTitleMenu(anchorEl, options = {}) {
            if (!anchorEl || !anchorEl.isConnected) return;
            this.closePlanActivityMenu();
            this.closePlanTitleMenu();
    
            const normalize = (value) => this.normalizeActivityText
                ? this.normalizeActivityText(value || '')
                : String(value || '').trim();
            const normalizedCurrent = normalize(this.modalPlanTitle || '');
            const grouped = this.buildPlannedActivityOptions(normalizedCurrent ? [normalizedCurrent] : []);
    
            const menu = document.createElement('div');
            menu.className = 'plan-activity-menu actual-activity-menu';
            menu.setAttribute('role', 'menu');
    
            const clearBtn = document.createElement('button');
            clearBtn.type = 'button';
            clearBtn.className = 'plan-activity-menu-item plan-activity-menu-clear';
            clearBtn.dataset.label = '';
            clearBtn.textContent = '비우기';
            menu.appendChild(clearBtn);
    
            const divider = document.createElement('div');
            divider.className = 'plan-activity-menu-divider';
            menu.appendChild(divider);
    
            const buildSection = (title, items) => {
                const section = document.createElement('div');
                section.className = 'plan-activity-menu-section';
                const heading = document.createElement('div');
                heading.className = 'plan-activity-menu-title';
                heading.textContent = title;
                section.appendChild(heading);
                if (!items || items.length === 0) {
                    const empty = document.createElement('div');
                    empty.className = 'plan-activity-menu-empty';
                    empty.textContent = '목록 없음';
                    section.appendChild(empty);
                    return section;
                }
                items.forEach((item) => {
                    const label = normalize(item && item.label);
                    if (!label) return;
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'plan-activity-menu-item';
                    btn.dataset.label = label;
                    btn.textContent = label;
                    if (normalizedCurrent && label === normalizedCurrent) {
                        btn.classList.add('active');
                    }
                    section.appendChild(btn);
                });
                return section;
            };
    
            menu.appendChild(buildSection('직접 추가', grouped.local || []));
            if (this.isNotionUIVisible()) menu.appendChild(buildSection('노션', grouped.notion || []));
    
            document.body.appendChild(menu);
            this.planTitleMenu = menu;
            this.planTitleMenuContext = { anchorEl, inline: Boolean(options.inline) };
            anchorEl.setAttribute('aria-expanded', 'true');
    
            menu.addEventListener('click', (event) => {
                const btn = event.target.closest('.plan-activity-menu-item');
                if (!btn || !menu.contains(btn)) return;
                if (btn.disabled) return;
                event.preventDefault();
                event.stopPropagation();
                const label = btn.dataset.label != null ? btn.dataset.label : '';
                if (!label) {
                    this.modalPlanTitle = '';
                    this.modalPlanTitleBandOn = false;
                } else {
                    this.modalPlanTitle = label;
                }
                this.syncPlanTitleBandToggleState();
                this.syncInlinePlanToSlots();
                this.closePlanTitleMenu();
            });
    
            this.positionPlanTitleMenu(anchorEl);
    
            this.planTitleMenuOutsideHandler = (event) => {
                if (!this.planTitleMenu) return;
                const t = event.target;
                if (this.planTitleMenu.contains(t)) return;
                if (anchorEl && (t === anchorEl || (anchorEl.contains && anchorEl.contains(t)))) return;
                this.closePlanTitleMenu();
            };
            document.addEventListener('mousedown', this.planTitleMenuOutsideHandler, true);
    
            this.planTitleMenuEscHandler = (event) => {
                if (event.key === 'Escape') {
                    this.closePlanTitleMenu();
                }
            };
            document.addEventListener('keydown', this.planTitleMenuEscHandler);
        }

    function positionPlanTitleMenu(anchorEl) {
            if (!this.planTitleMenu) return;
            if (!anchorEl || !anchorEl.isConnected) return;
            const rect = anchorEl.getBoundingClientRect();
            if (!rect || (!rect.width && !rect.height)) return;
    
            const menu = this.planTitleMenu;
            const scrollX = window.scrollX || document.documentElement.scrollLeft || 0;
            const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
            const viewportWidth = document.documentElement.clientWidth || window.innerWidth || 0;
            const viewportHeight = document.documentElement.clientHeight || window.innerHeight || 0;
    
            menu.style.visibility = 'hidden';
            menu.style.left = '0px';
            menu.style.top = '0px';
    
            const menuWidth = menu.offsetWidth || 240;
            const menuHeight = menu.offsetHeight || 220;
    
            let left = rect.left + scrollX;
            let top = rect.bottom + scrollY + 6;
    
            const maxLeft = scrollX + viewportWidth - menuWidth - 12;
            if (left > maxLeft) {
                left = Math.max(scrollX + 12, maxLeft);
            }
    
            const maxTop = scrollY + viewportHeight - menuHeight - 12;
            if (top > maxTop) {
                top = rect.top + scrollY - menuHeight - 6;
            }
            if (top < scrollY + 12) {
                top = scrollY + 12;
            }
    
            menu.style.left = `${Math.round(left)}px`;
            menu.style.top = `${Math.round(top)}px`;
            menu.style.visibility = 'visible';
        }

    function closePlanTitleMenu() {
            if (this.planTitleMenuOutsideHandler) {
                document.removeEventListener('mousedown', this.planTitleMenuOutsideHandler, true);
                this.planTitleMenuOutsideHandler = null;
            }
            if (this.planTitleMenuEscHandler) {
                document.removeEventListener('keydown', this.planTitleMenuEscHandler);
                this.planTitleMenuEscHandler = null;
            }
            if (this.planTitleMenuContext && this.planTitleMenuContext.anchorEl) {
                try { this.planTitleMenuContext.anchorEl.setAttribute('aria-expanded', 'false'); } catch (_) {}
            }
            if (this.planTitleMenu && this.planTitleMenu.parentNode) {
                this.planTitleMenu.parentNode.removeChild(this.planTitleMenu);
            }
            this.planTitleMenu = null;
            this.planTitleMenuContext = null;
        }

    function openInlinePriorityMenu(anchorEl, options = {}) {
            if (!anchorEl || !anchorEl.isConnected) return;
            const label = this.normalizeActivityText ? this.normalizeActivityText(options.label || '') : String(options.label || '').trim();
            if (!label) return;
            if (options.source === 'notion') return;
    
            const currentPriorityRank = this.normalizePriorityRankValue(options.priorityRank);
            if (this.inlinePriorityMenu
                && this.inlinePriorityMenuContext
                && this.inlinePriorityMenuContext.label === label
                && this.inlinePriorityMenuContext.anchorEl === anchorEl) {
                this.closeInlinePriorityMenu();
                return;
            }
    
            this.closeInlinePriorityMenu();
    
            const menu = document.createElement('div');
            menu.className = 'inline-priority-menu';
            menu.setAttribute('role', 'menu');
    
            const title = document.createElement('div');
            title.className = 'inline-priority-menu-title';
            title.textContent = '\uc6b0\uc120\uc21c\uc704 \uc120\ud0dd';
            menu.appendChild(title);
    
            [null, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].forEach((value) => {
                const item = document.createElement('button');
                item.type = 'button';
                item.className = 'inline-priority-menu-item';
                item.setAttribute('role', 'menuitemradio');
                item.dataset.label = label;
                item.dataset.priority = value == null ? '' : String(value);
                item.setAttribute('aria-checked', String((currentPriorityRank ?? null) === (value ?? null)));
                if ((currentPriorityRank ?? null) === (value ?? null)) {
                    item.classList.add('active');
                }
    
                const grip = document.createElement('span');
                grip.className = 'inline-priority-menu-grip';
                grip.setAttribute('aria-hidden', 'true');
                item.appendChild(grip);
    
                const badge = document.createElement('span');
                badge.className = 'inline-plan-priority-chip';
                if (value == null) {
                    badge.dataset.empty = 'true';
                    badge.textContent = '\ud574\uc81c';
                } else {
                    badge.dataset.pr = String(value);
                    badge.textContent = `Pr.${value}`;
                }
                item.appendChild(badge);
    
                menu.appendChild(item);
            });
    
            document.body.appendChild(menu);
            this.inlinePriorityMenu = menu;
            this.inlinePriorityMenuContext = { anchorEl, label };
            anchorEl.setAttribute('aria-expanded', 'true');
    
            menu.addEventListener('click', (event) => {
                const btn = event.target.closest('.inline-priority-menu-item');
                if (!btn || !menu.contains(btn)) return;
                if (btn.disabled) return;
                event.preventDefault();
                event.stopPropagation();
    
                const rawValue = btn.dataset.priority != null ? btn.dataset.priority : '';
                const nextValue = rawValue === '' ? null : Number(rawValue);
                this.closeInlinePriorityMenu();
                const changed = this.updatePlannedActivityPriority(label, nextValue);
                if (changed && this.inlinePlanDropdown) {
                    this.renderInlinePlanDropdownOptions();
                    const currentAnchor = this.inlinePlanTarget && this.inlinePlanTarget.anchor;
                    if (currentAnchor && currentAnchor.isConnected) {
                        this.positionInlinePlanDropdown(currentAnchor);
                    }
                }
            });
    
            this.positionInlinePriorityMenu(anchorEl);
    
            this.inlinePriorityMenuOutsideHandler = (event) => {
                if (!this.inlinePriorityMenu) return;
                const target = event.target;
                if (this.inlinePriorityMenu.contains(target)) return;
                if (anchorEl && (target === anchorEl || (anchorEl.contains && anchorEl.contains(target)))) return;
                this.closeInlinePriorityMenu();
            };
            document.addEventListener('mousedown', this.inlinePriorityMenuOutsideHandler, true);
    
            this.inlinePriorityMenuEscHandler = (event) => {
                if (event.key === 'Escape') {
                    this.closeInlinePriorityMenu();
                }
            };
            document.addEventListener('keydown', this.inlinePriorityMenuEscHandler);
        }

    function positionInlinePriorityMenu(anchorEl) {
            if (!this.inlinePriorityMenu) return;
            if (!anchorEl || !anchorEl.isConnected) {
                this.closeInlinePriorityMenu();
                return;
            }
    
            const rect = anchorEl.getBoundingClientRect();
            if (!rect || (!rect.width && !rect.height)) {
                this.closeInlinePriorityMenu();
                return;
            }
    
            const menu = this.inlinePriorityMenu;
            const scrollX = window.scrollX || document.documentElement.scrollLeft || 0;
            const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
            const viewportWidth = document.documentElement.clientWidth || window.innerWidth || 0;
            const viewportHeight = document.documentElement.clientHeight || window.innerHeight || 0;
            const margin = 12;
            const gap = 8;
    
            menu.style.visibility = 'hidden';
            menu.style.left = '0px';
            menu.style.top = '0px';
    
            const menuWidth = menu.offsetWidth || 148;
            const menuHeight = menu.offsetHeight || 320;
    
            let left = rect.left + scrollX;
            let top = rect.bottom + scrollY + gap;
    
            const maxLeft = scrollX + viewportWidth - menuWidth - margin;
            if (left > maxLeft) {
                left = Math.max(scrollX + margin, rect.right + scrollX - menuWidth);
            }
            if (left < scrollX + margin) {
                left = scrollX + margin;
            }
    
            const maxTop = scrollY + viewportHeight - menuHeight - margin;
            if (top > maxTop) {
                top = rect.top + scrollY - menuHeight - gap;
            }
            if (top < scrollY + margin) {
                top = scrollY + margin;
            }
    
            menu.style.left = `${Math.round(left)}px`;
            menu.style.top = `${Math.round(top)}px`;
            menu.style.visibility = 'visible';
        }

    function closeInlinePriorityMenu() {
            if (this.inlinePriorityMenuOutsideHandler) {
                document.removeEventListener('mousedown', this.inlinePriorityMenuOutsideHandler, true);
                this.inlinePriorityMenuOutsideHandler = null;
            }
            if (this.inlinePriorityMenuEscHandler) {
                document.removeEventListener('keydown', this.inlinePriorityMenuEscHandler);
                this.inlinePriorityMenuEscHandler = null;
            }
            if (this.inlinePriorityMenuContext && this.inlinePriorityMenuContext.anchorEl) {
                try { this.inlinePriorityMenuContext.anchorEl.setAttribute('aria-expanded', 'false'); } catch (_) {}
            }
            if (this.inlinePriorityMenu && this.inlinePriorityMenu.parentNode) {
                this.inlinePriorityMenu.parentNode.removeChild(this.inlinePriorityMenu);
            }
            this.inlinePriorityMenu = null;
            this.inlinePriorityMenuContext = null;
        }

    function handlePlanActivitiesRemoval(event) {
            const row = event.target.closest('.sub-activity-row');
            if (!row) return;
            const idx = parseInt(row.dataset.index, 10);
            if (!Number.isFinite(idx)) return;
            this.modalPlanActivities.splice(idx, 1);
            if (this.modalPlanActivities.length === 0) {
                this.modalPlanActiveRow = -1;
            } else if (this.modalPlanActiveRow === idx) {
                this.modalPlanActiveRow = Math.min(idx, this.modalPlanActivities.length - 1);
            } else if (this.modalPlanActiveRow > idx) {
                this.modalPlanActiveRow = Math.max(0, this.modalPlanActiveRow - 1);
            }
            this.renderPlanActivitiesList();
            this.syncInlinePlanToSlots();
        }

    function insertPlanLabelToRow(label, meta = {}) {
            const normalizedLabel = this.normalizeActivityText ? this.normalizeActivityText(label || '') : (label || '').trim();
            if (!normalizedLabel) return;
    
            if (!Array.isArray(this.modalPlanActivities)) {
                this.modalPlanActivities = [];
            }
    
            const planActivities = this.modalPlanActivities;
            const totalLimit = Math.max(0, Number(this.modalPlanTotalSeconds) || 0);
            const usedSeconds = this.getValidPlanActivitiesSeconds();
            const recommendedRaw = this.resolveRecommendedPlanSeconds(meta);
            const recommendedNormalized = recommendedRaw > 0
                ? (this.normalizeDurationStep(recommendedRaw) || recommendedRaw)
                : 0;
    
            const normalizeWithin = (value, limit) => {
                if (!(value > 0)) return 0;
                let candidate = Number.isFinite(value) ? value : 0;
                if (candidate > 0 && Number.isFinite(candidate)) {
                    const rounded = this.normalizeDurationStep(candidate);
                    if (rounded != null) candidate = rounded;
                }
                if (Number.isFinite(limit) && limit > 0 && candidate > limit) {
                    const floored = Math.floor(limit / 600) * 600;
                    candidate = floored > 0 ? floored : Math.min(limit, candidate);
                }
                if (Number.isFinite(limit) && limit > 0 && candidate > limit) {
                    candidate = limit;
                }
                return candidate > 0 ? candidate : 0;
            };
    
            const defaultIncrement = (available) => {
                if (!(available > 0)) return 0;
                if (recommendedNormalized > 0) {
                    return Math.min(available, recommendedNormalized);
                }
                if (available >= 600) return 600;
                return available;
            };
    
            const normalize = (value) => this.normalizeActivityText
                ? this.normalizeActivityText(value || '')
                : (value || '').trim();
    
            const existingIndex = planActivities.findIndex(item => normalize(item?.label) === normalizedLabel);
            let targetIndex = this.isValidPlanRow(this.modalPlanActiveRow) ? this.modalPlanActiveRow : -1;
    
            if (existingIndex >= 0 && existingIndex !== targetIndex) {
                this.setPlanActiveRow(existingIndex);
                this.showNotification('이미 동일한 라벨이 있어 해당 행으로 이동했어요.');
                return;
            }
    
            if (existingIndex >= 0) {
                targetIndex = existingIndex;
            }
    
            if (targetIndex >= 0) {
                const item = planActivities[targetIndex] || { label: '', seconds: 0, invalid: false };
                const currentSeconds = Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
                const otherSum = Math.max(0, usedSeconds - currentSeconds);
                const rowLimit = totalLimit > 0 ? Math.max(0, totalLimit - otherSum) : Infinity;
                if (!(rowLimit > 0)) {
                    this.setPlanActiveRow(targetIndex);
                    this.showNotification('잔여 시간이 없어 더 이상 시간을 늘릴 수 없습니다.');
                    return;
                }
    
                const sameLabel = normalize(item.label) === normalizedLabel;
                let nextSeconds = currentSeconds;
    
                if (sameLabel) {
                    const availableIncrease = Math.max(0, rowLimit - currentSeconds);
                    if (availableIncrease <= 0) {
                        this.setPlanActiveRow(targetIndex);
                        this.showNotification('잔여 시간이 없어 더 이상 시간을 늘릴 수 없습니다.');
                        return;
                    }
                    const increment = normalizeWithin(defaultIncrement(availableIncrease), availableIncrease);
                    if (!(increment > 0)) {
                        this.setPlanActiveRow(targetIndex);
                        this.showNotification('10분 단위로 배분할 수 있는 잔여 시간이 없어요.');
                        return;
                    }
                    nextSeconds = currentSeconds + increment;
                } else {
                    item.label = normalizedLabel;
                    if (currentSeconds === 0) {
                        const candidate = normalizeWithin(defaultIncrement(rowLimit), rowLimit);
                        if (candidate > 0) {
                            nextSeconds = candidate;
                        } else {
                            item.seconds = 0;
                            item.invalid = false;
                            planActivities[targetIndex] = item;
                            this.setPlanActiveRow(targetIndex);
                            this.renderPlanActivitiesList();
                            this.syncSelectedActivitiesFromPlan({ rerenderDropdown: true });
                            return;
                        }
                    } else if (Number.isFinite(rowLimit) && currentSeconds > rowLimit) {
                        nextSeconds = rowLimit;
                    }
                }
    
                nextSeconds = normalizeWithin(nextSeconds, rowLimit);
                item.label = normalizedLabel;
                item.seconds = nextSeconds;
                item.invalid = false;
                planActivities[targetIndex] = item;
                this.setPlanActiveRow(targetIndex);
                this.renderPlanActivitiesList();
                this.syncSelectedActivitiesFromPlan({ rerenderDropdown: true });
                return;
            }
    
            const remaining = totalLimit > 0 ? Math.max(0, totalLimit - usedSeconds) : defaultIncrement(Infinity);
            if (!(remaining > 0)) {
                this.showNotification('잔여 계획 시간이 없어 새 행을 만들 수 없어요.');
                return;
            }
            const assigned = normalizeWithin(defaultIncrement(remaining), remaining);
            if (!(assigned > 0)) {
                this.showNotification('잔여 시간이 너무 적어 새 행을 만들 수 없어요.');
                return;
            }
            planActivities.push({ label: normalizedLabel, seconds: assigned, invalid: false });
            this.modalPlanActiveRow = planActivities.length - 1;
            this.renderPlanActivitiesList();
            this.syncSelectedActivitiesFromPlan({ rerenderDropdown: true });
        }

    function removePlanActivitiesByLabel(label) {
            const normalizedLabel = this.normalizeActivityText ? this.normalizeActivityText(label || '') : (label || '').trim();
            if (!normalizedLabel || !Array.isArray(this.modalPlanActivities)) return false;
            const beforeLength = this.modalPlanActivities.length;
            const previousActive = this.modalPlanActiveRow;
            if (beforeLength === 0) return false;
            this.modalPlanActivities = this.modalPlanActivities.filter((item) => {
                if (!item) return false;
                const current = this.normalizeActivityText ? this.normalizeActivityText(item.label || '') : (item.label || '').trim();
                return current !== normalizedLabel;
            });
            if (this.modalPlanActivities.length === beforeLength) {
                return false;
            }
            if (this.modalPlanActivities.length === 0) {
                this.modalPlanActiveRow = -1;
            } else if (previousActive >= 0) {
                this.modalPlanActiveRow = Math.min(previousActive, this.modalPlanActivities.length - 1);
            } else {
                this.modalPlanActiveRow = -1;
            }
            this.renderPlanActivitiesList();
            this.syncSelectedActivitiesFromPlan({ rerenderDropdown: true });
            return true;
        }

    function syncInlinePlanToSlots() {
            const target = this.inlinePlanTarget;
            if (!target) return;
            const dropdown = this.inlinePlanDropdown;
            const previousDropdownScrollTop = dropdown ? dropdown.scrollTop : null;
            const startIndex = Number.isInteger(target.startIndex) ? target.startIndex : 0;
            const endIndex = Number.isInteger(target.endIndex) ? target.endIndex : startIndex;
            const baseIndex = Math.min(startIndex, endIndex);
            const planActivities = (this.modalPlanActivities || [])
                .filter(item => item && !item.invalid && (String(item.label || '').trim() !== '' || (Number.isFinite(item.seconds) && item.seconds > 0)))
                .map(item => {
                    const label = this.normalizeActivityText ? this.normalizeActivityText(item.label || '') : (item.label || '').trim();
                    const seconds = this.normalizeDurationStep(Number.isFinite(item.seconds) ? Number(item.seconds) : 0) || 0;
                    return { label, seconds };
                });
    
            const planSummary = (() => {
                const summary = this.formatActivitiesSummary ? this.formatActivitiesSummary(planActivities) : '';
                if (summary) return summary;
                const labels = planActivities.map(item => item.label).filter(Boolean);
                return labels.join(', ');
            })();
    
            for (let i = startIndex; i <= endIndex; i++) {
                const slot = this.timeSlots[i];
                if (!slot) continue;
                slot.planActivities = [];
                slot.planTitle = '';
                slot.planTitleBandOn = false;
                // keep planned text empty here; will set below
                if (!target.mergeKey) slot.planned = '';
            }
    
            if (this.timeSlots[baseIndex]) {
                this.timeSlots[baseIndex].planActivities = planActivities.map(item => ({ ...item }));
                const plannedText = planSummary || this.timeSlots[baseIndex].planned || this.modalPlanTitle || '';
                this.timeSlots[baseIndex].planned = plannedText;
                this.timeSlots[baseIndex].planTitle = this.modalPlanTitle || '';
                this.timeSlots[baseIndex].planTitleBandOn = Boolean(this.modalPlanTitleBandOn && this.modalPlanTitle);
    
                if (target.mergeKey) {
                    this.mergedFields.set(target.mergeKey, plannedText);
                    // ensure other merged slots blank planned text
                    for (let i = startIndex; i <= endIndex; i++) {
                        if (i === baseIndex) continue;
                        if (this.timeSlots[i]) this.timeSlots[i].planned = '';
                    }
                }
            }
    
            this.renderTimeEntries(true);
            if (this.inlinePlanTarget) {
                const anchor = document.querySelector(`[data-index="${baseIndex}"] .planned-input`)
                    || document.querySelector(`[data-index="${baseIndex}"]`);
                if (anchor) {
                    this.inlinePlanTarget.anchor = anchor;
                    this.positionInlinePlanDropdown(anchor);
                }
            }
            if (dropdown && previousDropdownScrollTop != null) {
                const maxScrollTop = Math.max(0, dropdown.scrollHeight - dropdown.clientHeight);
                dropdown.scrollTop = Math.min(previousDropdownScrollTop, maxScrollTop);
            }
            this.calculateTotals();
            this.autoSave();
        }

    function fillRemainingPlanActivity() {
            const remainingRaw = Math.max(0, this.modalPlanTotalSeconds - this.getValidPlanActivitiesSeconds());
            const remaining = this.normalizeDurationStep(remainingRaw) || 0;
            if (remaining <= 0) {
                const { noticeEl } = this.getPlanUIElements();
                if (noticeEl) {
                    noticeEl.textContent = '잔여 시간이 없습니다.';
                    noticeEl.classList.remove('ok');
                }
                return;
            }
            this.openPlanActivitiesSection();
            this.addPlanActivityRow({ seconds: remaining });
            this.updatePlanActivitiesSummary();
            this.syncInlinePlanToSlots();
        }

    function ensurePlanTitleButton(inputEl) {
            if (!inputEl || !inputEl.parentNode) return inputEl || null;
            if (inputEl.tagName === 'BUTTON') return inputEl;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.id = inputEl.id || '';
            btn.className = `plan-title-input ${inputEl.className || ''}`.trim();
            btn.setAttribute('aria-haspopup', 'menu');
            btn.setAttribute('aria-expanded', 'false');
            const placeholder = inputEl.getAttribute('placeholder') || '활동 제목';
            const value = typeof inputEl.value === 'string' ? inputEl.value.trim() : '';
            btn.textContent = value || placeholder;
            if (!value) btn.classList.add('empty');
            inputEl.parentNode.replaceChild(btn, inputEl);
            return btn;
        }

    function getPlanTitleInputValue(inputEl) {
            if (!inputEl) return '';
            if (inputEl.tagName === 'BUTTON') {
                return this.normalizeActivityText
                    ? this.normalizeActivityText(this.modalPlanTitle || '')
                    : String(this.modalPlanTitle || '').trim();
            }
            return this.normalizeActivityText
                ? this.normalizeActivityText(inputEl.value || '')
                : String(inputEl.value || '').trim();
        }

    function setPlanTitleInputDisplay(inputEl, value) {
            if (!inputEl) return;
            const normalized = this.normalizeActivityText
                ? this.normalizeActivityText(value || '')
                : String(value || '').trim();
            if (inputEl.tagName === 'BUTTON') {
                inputEl.textContent = normalized || '활동 제목';
                inputEl.classList.toggle('empty', !normalized);
                return;
            }
            inputEl.value = normalized;
        }

    function setPlanTitle(text) {
            const normalized = this.normalizeActivityText
                ? this.normalizeActivityText(text)
                : (text || '').trim();
            this.modalPlanTitle = normalized;
            const input = this.ensurePlanTitleButton(document.getElementById('planTitleInput'));
            this.setPlanTitleInputDisplay(input, normalized);
            this.syncPlanTitleBandToggleState();
            if (this.renderPlanTitleDropdown) this.renderPlanTitleDropdown();
        }

    function confirmPlanTitleSelection() {
            const input = this.ensurePlanTitleButton(document.getElementById('planTitleInput'));
            if (!input) return;
            if (input.tagName === 'BUTTON') return;
            const value = input.value;
            if (!value) {
                this.modalPlanTitle = '';
                this.modalPlanTitleBandOn = false;
                this.syncPlanTitleBandToggleState();
                const dropdown = document.getElementById('planTitleDropdown');
                if (dropdown) dropdown.classList.remove('open');
                return;
            }
            this.setPlanTitle(value);
            const dropdown = document.getElementById('planTitleDropdown');
            if (dropdown) dropdown.classList.remove('open');
        }

    function renderPlanTitleDropdown(options = {}) {
            const dropdown = document.getElementById('planTitleDropdown');
            const list = document.getElementById('planTitleOptions');
            const input = this.ensurePlanTitleButton(document.getElementById('planTitleInput'));
            if (!dropdown || !list || !input) return;
            if (input.tagName === 'BUTTON') return;
    
            const { open = false } = options || {};
            const rawSearch = input.value || '';
            const search = this.normalizeActivityText
                ? this.normalizeActivityText(rawSearch)
                : rawSearch.trim();
            const activeSource = this.getActivePlanSource();
    
            const suggestions = [];
            const seen = new Set();
            (this.plannedActivities || []).forEach((item) => {
                if (!item) return;
                const label = this.normalizeActivityText ? this.normalizeActivityText(item.label || '') : (item.label || '').trim();
                if (!label || seen.has(label)) return;
                const source = item.source === 'notion' ? 'notion' : 'local';
                if (!this.isNotionUIVisible() && source === 'notion') return;
                if (source !== activeSource) return;
                if (search && !label.toLowerCase().includes(search.toLowerCase())) return;
                seen.add(label);
                const priorityRank = Number.isFinite(item.priorityRank) ? Number(item.priorityRank) : null;
                const recommendedSeconds = Number.isFinite(item.recommendedSeconds) ? Math.max(0, Number(item.recommendedSeconds)) : null;
                suggestions.push({ label, priorityRank, recommendedSeconds });
            });
    
            list.innerHTML = '';
    
            const normalizedTitle = this.normalizeActivityText
                ? this.normalizeActivityText(this.modalPlanTitle || '')
                : (this.modalPlanTitle || '').trim();
    
            if (search && !seen.has(search)) {
                const li = document.createElement('li');
                li.dataset.label = search;
                li.className = 'use-input-option';
                const labelWrap = document.createElement('div');
                labelWrap.className = 'title-option-label';
                labelWrap.textContent = `"${search}" 제목 사용`;
                li.appendChild(labelWrap);
                list.appendChild(li);
            }
    
            suggestions.slice(0, 20).forEach((item) => {
                const li = document.createElement('li');
                li.dataset.label = item.label;
                if (normalizedTitle && normalizedTitle === item.label) {
                    li.classList.add('active');
                }
                const labelWrap = document.createElement('div');
                labelWrap.className = 'title-option-label';
                const badge = this.makePriorityBadge ? this.makePriorityBadge(item.priorityRank) : null;
                if (badge) labelWrap.appendChild(badge);
                const textSpan = document.createElement('span');
                textSpan.textContent = item.label;
                labelWrap.appendChild(textSpan);
                li.appendChild(labelWrap);
    
                if (Number.isFinite(item.recommendedSeconds) && item.recommendedSeconds > 0 && this.formatDurationSummary) {
                    const meta = document.createElement('span');
                    meta.className = 'title-option-meta';
                    meta.textContent = this.formatDurationSummary(item.recommendedSeconds);
                    li.appendChild(meta);
                }
                list.appendChild(li);
            });
    
            if (!list.children.length) {
                const empty = document.createElement('li');
                empty.className = 'empty-option';
                empty.textContent = activeSource === 'notion'
                    ? '노션에서 사용할 제목이 없습니다.'
                    : '추가된 활동 제목이 없습니다.';
                list.appendChild(empty);
            }
    
            const isFocused = document.activeElement === input;
            const shouldOpen = open || isFocused || Boolean(rawSearch);
            if (shouldOpen) {
                dropdown.classList.add('open');
            } else {
                dropdown.classList.remove('open');
            }
        }

    function preparePlanActivitiesSection(startIndex, endIndex) {
            const section = document.getElementById('planActivitiesSection');
            if (!section) return;
            const activities = this.getPlanActivitiesForIndex(startIndex);
            this.modalPlanActivities = activities.map(item => ({ ...item, invalid: false }));
            const shouldOpen = this.modalPlanActivities.length > 0;
            this.modalPlanSectionOpen = shouldOpen;
            this.modalPlanActiveRow = shouldOpen ? 0 : -1;
            section.hidden = !shouldOpen;
            const planTitleToggleRow = document.getElementById('planTitleToggleRow');
            if (planTitleToggleRow) {
                planTitleToggleRow.hidden = !shouldOpen;
            }
            const fillPlanBtn = document.getElementById('fillRemainingPlanActivity');
            if (fillPlanBtn) {
                fillPlanBtn.hidden = !shouldOpen;
            }
            const baseSlot = this.timeSlots[startIndex] || {};
            const storedBand = Boolean(baseSlot.planTitleBandOn);
            const normalizedTitle = this.normalizeActivityText
                ? this.normalizeActivityText(this.modalPlanTitle || '')
                : (this.modalPlanTitle || '').trim();
            this.modalPlanTitleBandOn = storedBand && Boolean(normalizedTitle);
            this.syncPlanTitleBandToggleState();
            this.updatePlanActivitiesToggleLabel();
            this.renderPlanActivitiesList();
            this.updatePlanActivitiesSummary();
        }

    return {
        getPlanActivitiesForIndex,
        updatePlanActivitiesAssignment,
        getValidPlanActivitiesSeconds,
        getPlanUIElements,
        updatePlanActivitiesToggleLabel,
        updatePlanActivitiesSummary,
        syncPlanTitleBandToggleState,
        renderPlanActivitiesList,
        isValidPlanRow,
        updatePlanRowActiveStyles,
        setPlanActiveRow,
        focusPlanRowLabel,
        resolveRecommendedPlanSeconds,
        adjustActivityDuration,
        openPlanActivitiesSection,
        closePlanActivitiesSection,
        addPlanActivityRow,
        handlePlanActivitiesInput,
        applyPlanActivityLabelSelection,
        openPlanActivityMenu,
        positionPlanActivityMenu,
        closePlanActivityMenu,
        openPlanTitleMenu,
        positionPlanTitleMenu,
        closePlanTitleMenu,
        openInlinePriorityMenu,
        positionInlinePriorityMenu,
        closeInlinePriorityMenu,
        handlePlanActivitiesRemoval,
        insertPlanLabelToRow,
        removePlanActivitiesByLabel,
        syncInlinePlanToSlots,
        fillRemainingPlanActivity,
        ensurePlanTitleButton,
        getPlanTitleInputValue,
        setPlanTitleInputDisplay,
        setPlanTitle,
        confirmPlanTitleSelection,
        renderPlanTitleDropdown,
        preparePlanActivitiesSection,
    };
});
