class TimeTracker {
    constructor() {
        this.timeSlots = [];
        this.currentDate = this.getTodayLocalDateString();
        this.lastKnownTodayDate = this.currentDate;
        this.selectedPlannedFields = new Set();
        this.selectedActualFields = new Set();
        this.isSelectingPlanned = false;
        this.isSelectingActual = false;
        this.dragStartIndex = -1;
        this.dragBaseEndIndex = -1;
        this.currentColumnType = null;
        this.mergeButton = null;
        this.undoButton = null;
        this.mergedFields = new Map(); // {type-startIndex-endIndex: mergedValue}
        this.selectionOverlay = { planned: null, actual: null };
        this.hoverSelectionOverlay = { planned: null, actual: null };
        this.hoveredMergeKey = null;
        this.scheduleButton = null;
        this.activityHoverButton = null;
        this.activityHoverHideTimer = null;
        this.plannedActivities = [];
        this.modalSelectedActivities = [];
        this.currentPlanSource = 'local';
        this.planTabsContainer = null;
        this.inlinePlanDropdown = null;
        this.inlinePlanTarget = null;
        this.inlinePlanOutsideHandler = null;
        this.inlinePlanEscHandler = null;
        this.inlinePlanScrollHandler = null;
        this.inlinePlanWheelHandler = null;
        this.inlinePlanContext = null;
        // Notion integration (optional)
        this.notionEndpoint = this.loadNotionActivitiesEndpoint ? this.loadNotionActivitiesEndpoint() : (function(){
            try { return window.NOTION_ACTIVITIES_ENDPOINT || null; } catch(e){ return null; }
        })();
        this.notionActivitiesCache = null;
        // 타이머 관련 속성 추가
        this.timers = new Map(); // {index: {running, elapsed, startTime, intervalId}}
        this.timerInterval = null;
        // 저장 직렬화를 위한 간단한 큐
        this._saveQueue = Promise.resolve();
        // 변경 감시 스냅샷
        this._lastSavedSignature = '';
        this._watcher = null;
        // 저장 진행 중 플래그는 사용하지 않음(큐 직렬화만 사용)
        // Supabase (optional)
        this.supabase = null;
        this.supabaseChannels = { timesheet: null, planned: null, routines: null };
        this.supabaseConfigured = false;
        this._sbSaveTimer = null;
        this._sbRetryTimer = null;
        this._sbRetryDelayMs = 2000;
        this._hasPendingRemoteSync = false;
        this.supabaseUser = null;
        this._lastSupabaseIdentity = null;
        this.PLANNED_SENTINEL_DAY = '1970-01-01';
        this.ROUTINE_SENTINEL_DAY = '1970-01-02';
        this._plannedSaveTimer = null;
        this._lastSupabasePlannedSignature = '';
        this._routineSaveTimer = null;
        this._lastSupabaseRoutineSignature = '';
        this.authStatusElement = null;
        this.authButton = null;
        this.deviceId = this.loadOrCreateDeviceId ? this.loadOrCreateDeviceId() : (function(){
            try { const arr=crypto.getRandomValues(new Uint8Array(16)); arr[6]=(arr[6]&0x0f)|0x40; arr[8]=(arr[8]&0x3f)|0x80; const hex=Array.from(arr).map(b=>b.toString(16).padStart(2,'0')).join(''); return `${hex.substring(0,8)}-${hex.substring(8,12)}-${hex.substring(12,16)}-${hex.substring(16,20)}-${hex.substring(20)}`; } catch(_) { return 'device-anon'; } })();
        this._timesheetClearPending = new Set();
        this.loginIntent = null;
        this.modalPlanActivities = [];
        this.modalPlanTotalSeconds = 0;
        this.modalPlanSectionOpen = false;
        this.modalPlanActiveRow = -1;
        this.modalPlanTitle = '';
        this.modalPlanTitleBandOn = false;
        this.modalPlanStartIndex = null;
        this.modalPlanEndIndex = null;
        this.lastPlanOptionInput = 'activity';
        this.modalActualActivities = [];
        this.modalActualTotalSeconds = 0;
        this.modalActualActiveRow = -1;
        this.modalActualBaseIndex = null;
        this.modalActualDirty = false;
        this.modalActualHasPlanUnits = false;
        this.modalActualPlanUnits = [];
        this.modalActualGridUnits = [];
        this.modalActualPlanLabelSet = new Set();
        this.actualActivityMenu = null;
        this.actualActivityMenuContext = null;
        this.actualActivityMenuOutsideHandler = null;
        this.actualActivityMenuEscHandler = null;
        this.splitColorRegistry = new Map();
        this.splitColorUsed = new Set();
        this.splitColorSeed = 0;
        this.saveStatusElement = null;
        this.syncStatusElement = null;
        this.notionStatusElement = null;
        this.notificationRegion = null;
        this.pendingClearUndo = null;
        this.lastFocusedElementBeforeModal = null;
        this.activityModalFocusHandler = null;
        this.activityModalEscHandler = null;
        this.dayStartHour = this.loadDayStartHour();

        // Routines (planned auto-fill)
        this.routines = [];
        this.routinesLoaded = false;
        this.routineMenu = null;
        this.routineMenuContext = null;
        this.routineMenuOutsideHandler = null;
        this.routineMenuEscHandler = null;
        this.planActivityMenu = null;
        this.planActivityMenuContext = null;
        this.planActivityMenuOutsideHandler = null;
        this.planActivityMenuEscHandler = null;
        this.planTitleMenu = null;
        this.planTitleMenuContext = null;
        this.planTitleMenuOutsideHandler = null;
        this.planTitleMenuEscHandler = null;
        this.init();
    }

    init() {
        this.cacheAuthElements();
        this.cacheStatusElements();
        this.generateTimeSlots();
        this.renderTimeEntries();
        this.attachEventListeners();
        this.setCurrentDate();
        this.loadData();
        this.attachModalEventListeners();
        this.loadPlannedActivities();
        this.attachActivityModalEventListeners();
        this.startChangeWatcher();
        this.updateAuthUI();
        this.attachConnectivityListeners();
        this.attachDayStartListeners();
        this.updateDayStartUI();
        this.setSaveStatus('idle', '저장 대기');
        this.setSyncStatus('idle', '동기화 대기');
        this.setNotionStatus('idle', this.notionEndpoint ? '노션 준비됨' : '노션 미설정');
        // Supabase(옵션) 초기화
        try { this.initSupabaseIntegration && this.initSupabaseIntegration(); } catch(_) {}

        // 저장소 전체에 남아있을 수 있는 legacy outcome 필드 일괄 제거
        try {
            setTimeout(() => { this.purgeOutcomeFromAllStoredData(); }, 0);
        } catch (_) {}

        // Studio 탭 전환 등으로 hidden일 때 타이머 스로틀링을 피하고 불필요한 트리거를 줄임
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                if (this._watcher) clearInterval(this._watcher);
            } else {
                this.startChangeWatcher();
            }
        });
    }

    // 디버그 겸 편의 저장 호출 래퍼
    saveNow(reason = 'manual') {
        try { console.log('[saveNow]', reason); } catch (_) {}
        return this.saveData();
    }

    cacheAuthElements() {
        try {
            this.authStatusElement = document.getElementById('authStatus');
            this.authButton = document.getElementById('googleAuthBtn');
        } catch (_) {
            this.authStatusElement = null;
            this.authButton = null;
        }
    }

    getSupabaseRedirectTo() {
        try {
            const configured = (typeof window !== 'undefined' && typeof window.SUPABASE_REDIRECT_URL === 'string')
                ? window.SUPABASE_REDIRECT_URL.trim()
                : '';
            if (configured) return configured;
        } catch (_) {}

        try {
            if (typeof location !== 'undefined' && /^https?:$/i.test(String(location.protocol || ''))) {
                const origin = String(location.origin || '').trim();
                if (!origin) return null;
                const normalizedPath = String(location.pathname || '/').trim() || '/';
                const isRootLike = normalizedPath === '/' || normalizedPath === '/index.html';
                return isRootLike ? origin : `${origin}/auth/callback`;
            }
        } catch (_) {}

        return null;
    }

    updateAuthUI() {
        try {
            if (this.authStatusElement) {
                if (this.supabaseUser && (this.supabaseUser.email || this.supabaseUser.user_metadata)) {
                    const meta = this.supabaseUser.user_metadata || {};
                    const display = this.supabaseUser.email || meta.full_name || meta.name || '로그인됨';
                    this.authStatusElement.textContent = display;
                } else {
                    this.authStatusElement.textContent = '로그인 필요';
                }
            }
            if (this.authButton) {
                this.authButton.textContent = this.supabaseUser ? '로그아웃' : 'Google 로그인';
            }
        } catch (e) {
            console.warn('[auth-ui] update failed', e);
        }
    }

    cacheStatusElements() {
        this.saveStatusElement = document.getElementById('saveStatus');
        this.syncStatusElement = document.getElementById('syncStatus');
        this.notionStatusElement = document.getElementById('notionStatus');
    }

    setStatusChip(element, kind, message) {
        if (!element) return;
        element.className = `status-chip status-${kind || 'idle'}`;
        element.textContent = message || '';
    }

    setSaveStatus(kind, message) { this.setStatusChip(this.saveStatusElement, kind, message); }
    setSyncStatus(kind, message) { this.setStatusChip(this.syncStatusElement, kind, message); }
    setNotionStatus(kind, message) { this.setStatusChip(this.notionStatusElement, kind, message); }

    attachConnectivityListeners() {
        const setNetworkState = () => {
            const online = navigator.onLine;
            if (!online) {
                this.setSyncStatus('warn', '오프라인 (로컬 저장)');
                return;
            }
            if (this._hasPendingRemoteSync) {
                this.setSyncStatus('info', '온라인 복구, 동기화 재시도…');
                this.scheduleSupabaseSave && this.scheduleSupabaseSave();
                return;
            }
            this.setSyncStatus('idle', '동기화 대기');
        };
        window.addEventListener('online', setNetworkState);
        window.addEventListener('offline', setNetworkState);
        setNetworkState();
    }

    loadDayStartHour() {
        const storage = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerStorage)
            ? globalThis.TimeTrackerStorage
            : null;
        if (storage && typeof storage.getDayStartHour === 'function') {
            try {
                return storage.getDayStartHour(4);
            } catch (_) {}
        }
        try {
            const raw = localStorage.getItem('tt.dayStartHour');
            const parsed = parseInt(raw, 10);
            return parsed === 0 ? 0 : 4;
        } catch (_) {
            return 4;
        }
    }

    attachDayStartListeners() {
        const select = document.getElementById('dayStartHour');
        if (!select) return;
        select.value = String(this.dayStartHour === 0 ? 0 : 4);
        select.addEventListener('change', () => {
            const parsed = parseInt(select.value, 10);
            this.dayStartHour = parsed === 0 ? 0 : 4;
            const storage = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerStorage)
                ? globalThis.TimeTrackerStorage
                : null;
            if (storage && typeof storage.setDayStartHour === 'function') {
                try { storage.setDayStartHour(this.dayStartHour); } catch (_) {}
            } else {
                try { localStorage.setItem('tt.dayStartHour', String(this.dayStartHour)); } catch (_) {}
            }
            this.renderTimeEntries(true);
            this.updateDayStartUI();
        });
    }

    formatSlotTimeLabel(rawHour) {
        const core = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerCore)
            ? globalThis.TimeTrackerCore
            : null;
        if (core && typeof core.formatSlotTimeLabel === 'function') {
            return core.formatSlotTimeLabel(rawHour);
        }
        const hour = parseInt(String(rawHour), 10);
        if (!Number.isFinite(hour)) return String(rawHour || '');
        return String(hour).padStart(2, '0');
    }

    updateDayStartUI() {
        const select = document.getElementById('dayStartHour');
        if (select) select.value = String(this.dayStartHour === 0 ? 0 : 4);
    }

    

    createEmptyTimeSlots() {
        const core = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerCore)
            ? globalThis.TimeTrackerCore
            : null;
        if (core && typeof core.createEmptyTimeSlots === 'function') {
            return core.createEmptyTimeSlots();
        }

        const labels = [];
        for (let hour = 4; hour <= 23; hour++) {
            labels.push(String(hour));
        }
        labels.push('00', '1', '2', '3');
        return labels.map((time) => ({
            time,
            planned: '',
            actual: '',
            planActivities: [],
            planTitle: '',
            planTitleBandOn: false,
            timer: { running: false, elapsed: 0, startTime: null, method: 'manual' },
            activityLog: { title: '', details: '', subActivities: [], titleBandOn: false, actualGridUnits: [], actualExtraGridUnits: [], actualOverride: false }
        }));
    }

    generateTimeSlots() {
        this.timeSlots = this.createEmptyTimeSlots();
    }

    buildTimeEntryRowModel(slot, index) {
        const renderer = (typeof globalThis !== 'undefined' && globalThis.TimeEntryRenderer)
            ? globalThis.TimeEntryRenderer
            : null;
        if (renderer && typeof renderer.buildRowRenderModel === 'function') {
            return renderer.buildRowRenderModel({
                slot,
                index,
                currentDate: this.currentDate,
                findMergeKey: (type, rowIndex) => this.findMergeKey(type, rowIndex),
                createMergedField: (mergeKey, type, rowIndex, value) => this.createMergedField(mergeKey, type, rowIndex, value),
                createTimerField: (rowIndex, rowSlot) => this.createTimerField(rowIndex, rowSlot),
                wrapWithSplitVisualization: (type, rowIndex, content) => this.wrapWithSplitVisualization(type, rowIndex, content),
                createTimerControls: (rowIndex, rowSlot) => this.createTimerControls(rowIndex, rowSlot),
                createMergedTimeField: (mergeKey, rowIndex, rowSlot) => this.createMergedTimeField(mergeKey, rowIndex, rowSlot),
                formatSlotTimeLabel: (rawHour) => this.formatSlotTimeLabel(rawHour),
                escapeAttribute: (value) => this.escapeAttribute(value),
                getRoutineForPlannedIndex: (rowIndex, date) => this.getRoutineForPlannedIndex(rowIndex, date),
            });
        }

        const plannedMergeKey = this.findMergeKey('planned', index);
        const actualMergeKey = this.findMergeKey('actual', index);

        let plannedContent = plannedMergeKey
            ? this.createMergedField(plannedMergeKey, 'planned', index, slot.planned)
            : `<input type="text" class="input-field planned-input" 
                        data-index="${index}" 
                        data-type="planned" 
                        value="${this.escapeAttribute(slot.planned)}"
                        placeholder="계획을 입력하려면 클릭 또는 Enter" readonly tabindex="0" aria-label="계획 활동 입력" title="클릭해서 계획 선택/입력" style="cursor: pointer;">`;
        plannedContent = this.wrapWithSplitVisualization('planned', index, plannedContent);

        let actualContent = actualMergeKey
            ? this.createMergedField(actualMergeKey, 'actual', index, slot.actual)
            : this.createTimerField(index, slot);
        actualContent = this.wrapWithSplitVisualization('actual', index, actualContent);

        const timeMergeKey = this.findMergeKey('time', index);
        const timerControls = this.createTimerControls(index, slot);
        let timeContent;
        if (timeMergeKey) {
            timeContent = this.createMergedTimeField(timeMergeKey, index, slot);
        } else {
            timeContent = `<div class="time-slot-container">
                    <div class="time-label">${this.formatSlotTimeLabel(slot.time)}</div>
                    ${timerControls}
                </div>`;
        }

        const parseMergeRange = (mergeKey) => {
            if (!mergeKey || typeof mergeKey !== 'string') return null;
            const parts = mergeKey.split('-');
            if (parts.length !== 3) return null;
            const start = parseInt(parts[1], 10);
            const end = parseInt(parts[2], 10);
            if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
            return { start, end };
        };

        const plannedRange = parseMergeRange(plannedMergeKey);
        const actualRange = parseMergeRange(actualMergeKey);

        return {
            plannedMergeKey,
            actualMergeKey,
            routineMatch: this.getRoutineForPlannedIndex(index, this.currentDate),
            hasPlannedMergeContinuation: Boolean(plannedRange && index >= plannedRange.start && index < plannedRange.end),
            hasActualMergeContinuation: Boolean(actualRange && index >= actualRange.start && index < actualRange.end),
            innerHtml: `
                ${plannedContent}
                ${timeContent}
                ${actualContent}
            `,
        };
    }

    renderTimeEntries(preserveInlineDropdown = false) {
        if (!preserveInlineDropdown) {
            this.closeInlinePlanDropdown();
        }
        const container = document.getElementById('timeEntries');
        container.innerHTML = '';

        this.timeSlots.forEach((slot, index) => {
            const entryDiv = document.createElement('div');
            entryDiv.className = 'time-entry';

            const rowModel = this.buildTimeEntryRowModel(slot, index);
            entryDiv.innerHTML = rowModel.innerHtml;
            entryDiv.dataset.index = index;
            const routineMatch = rowModel.routineMatch;
            if (routineMatch) {
                entryDiv.classList.add('routine-planned');
                entryDiv.dataset.routineId = routineMatch.id;
            }

            if (rowModel.hasPlannedMergeContinuation) {
                entryDiv.classList.add('has-planned-merge');
            }

            if (rowModel.hasActualMergeContinuation) {
                entryDiv.classList.add('has-actual-merge');
            }

            const plannedField = entryDiv.querySelector('.planned-input');
            const actualField = entryDiv.querySelector('.actual-input');

            if (plannedField || actualField) {
                this.attachFieldSelectionListeners(entryDiv, index);
                this.attachCellClickListeners(entryDiv, index);
            }

            // 타이머 이벤트 리스너 추가
            this.attachTimerListeners(entryDiv, index);
            this.attachActivityLogListener(entryDiv, index);

            this.attachRowWideClickTargets(entryDiv, index);
            container.appendChild(entryDiv);
        });

        // 병합된 시간열 컨텐츠를 병합 블록의 세로 중앙으로 정렬
        this.centerMergedTimeContent(container);
        // 병합된 실제/계획 입력의 시각적 높이를 병합 범위에 맞게 설정
        this.resizeMergedActualContent(container);
        this.resizeMergedPlannedContent(container);
    }

    attachEventListeners() {
        if (this.authButton) {
            this.authButton.addEventListener('click', () => {
                if (!this.supabaseConfigured || !this.supabase) {
                    this.showNotification('Supabase 설정을 먼저 확인해주세요.');
                    return;
                }
                if (this.supabaseUser) {
                    this.commitRunningTimers({ render: true, calculate: true, autoSave: false });
                    this.saveData().finally(() => {
                        this.supabase.auth.signOut().catch((err) => {
                            console.warn('[auth] sign out failed', err);
                            this.showNotification('로그아웃 중 오류가 발생했습니다.');
                        });
                    });
                } else {
                    const options = {};
                    const redirectTo = this.getSupabaseRedirectTo();
                    if (redirectTo) {
                        options.redirectTo = redirectTo;
                    }
                    const params = { provider: 'google' };
                    if (Object.keys(options).length > 0) {
                        params.options = options;
                    }
                    this.loginIntent = 'google';
                    this.supabase.auth.signInWithOAuth(params).catch((err) => {
                        console.warn('[auth] sign in failed', err, { redirectTo: options.redirectTo || null });
                        this.showNotification('Google 로그인에 실패했습니다.');
                    });
                }
            });
        }
        document.getElementById('date').addEventListener('change', (e) => {
            this.transitionToDate(e.target.value);
        });
        // 창 크기 변경 시 병합된 블록들의 시각적 높이를 재계산
        window.addEventListener('resize', () => {
            const entries = document.getElementById('timeEntries');
            this.centerMergedTimeContent(entries);
            this.resizeMergedActualContent(entries);
            this.resizeMergedPlannedContent(entries);
            this.updateSchedulePreview();
        });

        document.getElementById('timeEntries').addEventListener('input', (e) => {
            if (e.target.classList.contains('input-field') && !e.target.classList.contains('timer-result-input')) {
                const index = parseInt(e.target.dataset.index);
                const type = e.target.dataset.type;
                this.timeSlots[index][type] = e.target.value;
                if (type === 'actual') {
                    this.clearSubActivitiesForIndex(index);
                }
                this.calculateTotals();
                this.autoSave();
            }
        });

        document.getElementById('timeEntries').addEventListener('keydown', (e) => {
            const planned = e.target.closest('.planned-input');
            if (!planned) return;
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            const index = parseInt(planned.dataset.index, 10);
            if (Number.isFinite(index)) {
                this.openScheduleModal('planned', index);
            }
        });

        // 수동 저장/불러오기 제거(완전 자동 저장)

        document.getElementById('clearBtn').addEventListener('click', () => {
            if (!confirm('모든 데이터를 초기화하시겠습니까? (5초 안에 실행 취소 가능)')) return;
            const snapshot = this.createStateSnapshot();
            this.clearData();
            this.pendingClearUndo = snapshot;
            this.showNotification('데이터가 초기화되었습니다. 실행 취소 가능', 'warn', {
                duration: 5000,
                actionLabel: '실행 취소',
                onAction: () => {
                    if (!this.pendingClearUndo) return;
                    this.timeSlots = this.pendingClearUndo.timeSlots;
                    this.mergedFields = new Map(Object.entries(this.pendingClearUndo.mergedFields || {}));
                    this.clearTimesheetClearPending(this.currentDate);
                    this.renderTimeEntries();
                    this.calculateTotals();
                    this.autoSave();
                    this._hasPendingRemoteSync = true;
                    this.scheduleSupabaseSave && this.scheduleSupabaseSave();
                    this.pendingClearUndo = null;
                    this.showNotification('초기화를 되돌렸습니다.', 'success');
                },
                onClose: () => { this.pendingClearUndo = null; }
            });
        });

        document.getElementById('prevDayBtn').addEventListener('click', () => {
            this.changeDate(-1);
        });

        document.getElementById('todayBtn').addEventListener('click', () => {
            this.transitionToDate(this.getTodayLocalDateString());
        });

        document.getElementById('nextDayBtn').addEventListener('click', () => {
            this.changeDate(1);
        });

        // 병합된 셀은 완전 일체화: 어느 위치를 클릭해도 전체 범위 선택
        const timeEntries = document.getElementById('timeEntries');
        if (timeEntries) {
            // 캡처 단계에서 먼저 가로챔: 드래그/단일선택 로직보다 선행
            const captureHandler = (e) => this.handleMergedClickCapture(e);
            timeEntries.addEventListener('mousedown', captureHandler, true);
            timeEntries.addEventListener('click', captureHandler, true);

            // 좌측열 호버만으로도 스케줄 버튼이 자연스럽게 따라오도록 마우스 이동 추적
            timeEntries.addEventListener('mousemove', (e) => {
                if (this.isSelectingPlanned) return; // 드래그 중엔 표시 안 함
                const idx = this.getIndexAtClientPosition('planned', e.clientX, e.clientY);
                if (idx != null && !isNaN(idx)) {
                    this.showScheduleButtonOnHover(idx);
                }
            });
            timeEntries.addEventListener('mouseleave', (e) => {
                const toEl = e.relatedTarget;
                // 스케줄 버튼으로 이동할 때는 유지
                if (toEl && toEl.closest && (toEl.closest('.schedule-button') || toEl.closest('.undo-button'))) return;
                this.hideHoverScheduleButton && this.hideHoverScheduleButton();
            });

            // 계획 입력 필드 클릭 시 드롭다운 바로 열기
            timeEntries.addEventListener('click', (e) => {
                const planned = e.target.closest('.planned-input');
                if (!planned || !timeEntries.contains(planned)) return;
                const idx = parseInt(planned.dataset.index, 10);
                if (!Number.isFinite(idx)) return;

                let start = idx;
                let end = idx;
                const mk = this.findMergeKey('planned', idx);
                if (mk) {
                    const [, sStr, eStr] = mk.split('-');
                    const sVal = parseInt(sStr, 10);
                    const eVal = parseInt(eStr, 10);
                    if (Number.isFinite(sVal)) start = sVal;
                    if (Number.isFinite(eVal)) end = eVal;
                }

                const anchor = planned.closest('.split-cell-wrapper.split-type-planned') || planned;
                this.openInlinePlanDropdown(start, anchor, end);
            });
        }

        // 가져오기/내보내기 기능 제거됨: 관련 UI 및 리스너 없음

        

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.clearAllSelections();
            }
        });
        
        // 타이머 결과 입력 필드 이벤트 리스너 (우측 칸과 모달을 연결: 병합 포함 갱신)
        document.getElementById('timeEntries').addEventListener('input', (e) => {
            if (e.target.classList.contains('timer-result-input')) {
                try {
                    const index = parseInt(e.target.dataset.index);
                    const value = e.target.value;
                    // 디버그: 입력 이벤트 수신
                    // console.log('[actual-input] input', { index, value });
                    const actualMergeKey = this.findMergeKey('actual', index);
                    if (actualMergeKey) {
                        const [, startStr, endStr] = actualMergeKey.split('-');
                        const start = parseInt(startStr, 10);
                        const end = parseInt(endStr, 10);
                        this.mergedFields.set(actualMergeKey, value);
                        for (let i = start; i <= end; i++) {
                            this.timeSlots[i].actual = (i === start) ? value : '';
                        }
                    } else {
                        this.timeSlots[index].actual = value;
                    }
                    this.enforceActualLimit(index);
                    this.clearSubActivitiesForIndex(index);
                    // 텍스트에서 시간값을 인식해 타이머 경과 시간 동기화
                    this.syncTimerElapsedFromActualInput(index, value);
                    this.calculateTotals();
                    this.autoSave();
                    // 즉시 저장 한 번 더(큐로 직렬화)
                    this.saveData().catch(() => {});
                } catch (err) {
                    console.error('[actual-input] input handler error:', err);
                }
            }
        });

        // 한글 IME 등 입력 조합 종료 시 저장 보조(일부 환경에서 input 이벤트 지연/누락 대비)
        document.getElementById('timeEntries').addEventListener('compositionend', (e) => {
            if (e.target.classList.contains('timer-result-input')) {
                const index = parseInt(e.target.dataset.index);
                const value = e.target.value;
                const actualMergeKey = this.findMergeKey('actual', index);
                if (actualMergeKey) {
                    const [, startStr, endStr] = actualMergeKey.split('-');
                    const start = parseInt(startStr, 10);
                    const end = parseInt(endStr, 10);
                    this.mergedFields.set(actualMergeKey, value);
                    for (let i = start; i <= end; i++) {
                        this.timeSlots[i].actual = (i === start) ? value : '';
                    }
                } else {
                    this.timeSlots[index].actual = value;
                }
                this.enforceActualLimit(index);
                this.clearSubActivitiesForIndex(index);
                this.syncTimerElapsedFromActualInput(index, value);
                this.calculateTotals();
                this.autoSave();
            }
        });

        // 포커스가 빠질 때도 보조 저장 트리거 (blur는 버블링 안 됨 → focusout 사용)
        document.getElementById('timeEntries').addEventListener('focusout', (e) => {
            if (e.target.classList && e.target.classList.contains('timer-result-input')) {
                const index = parseInt(e.target.dataset.index);
                const value = e.target.value;
                const actualMergeKey = this.findMergeKey('actual', index);
                if (actualMergeKey) {
                    const [, startStr, endStr] = actualMergeKey.split('-');
                    const start = parseInt(startStr, 10);
                    const end = parseInt(endStr, 10);
                    this.mergedFields.set(actualMergeKey, value);
                    for (let i = start; i <= end; i++) {
                        this.timeSlots[i].actual = (i === start) ? value : '';
                    }
                } else {
                    this.timeSlots[index].actual = value;
                }
                this.enforceActualLimit(index);
                this.clearSubActivitiesForIndex(index);
                this.syncTimerElapsedFromActualInput(index, value);
                this.calculateTotals();
                this.autoSave();
            }
        });

        // change 이벤트 보조 훅: 일부 환경에서 input 이벤트가 누락될 수 있음
        document.getElementById('timeEntries').addEventListener('change', (e) => {
            if (e.target.classList.contains('timer-result-input')) {
                try {
                    const index = parseInt(e.target.dataset.index);
                    const value = e.target.value;
                    // console.log('[actual-input] change', { index, value });
                    const actualMergeKey = this.findMergeKey('actual', index);
                    if (actualMergeKey) {
                        const [, startStr, endStr] = actualMergeKey.split('-');
                        const start = parseInt(startStr, 10);
                        const end = parseInt(endStr, 10);
                        this.mergedFields.set(actualMergeKey, value);
                        for (let i = start; i <= end; i++) {
                            this.timeSlots[i].actual = (i === start) ? value : '';
                        }
                    } else {
                        this.timeSlots[index].actual = value;
                    }
                    this.enforceActualLimit(index);
                    this.clearSubActivitiesForIndex(index);
                    this.syncTimerElapsedFromActualInput(index, value);
                    this.calculateTotals();
                    this.autoSave();
                } catch (err) {
                    console.error('[actual-input] change handler error:', err);
                }
            }
        });

        // keyup 보조 훅: 특정 환경에서 input/change가 지연될 경우 대비
        document.getElementById('timeEntries').addEventListener('keyup', (e) => {
            if (e.target.classList.contains('timer-result-input')) {
                try {
                    const index = parseInt(e.target.dataset.index);
                    const value = e.target.value;
                    // console.log('[actual-input] keyup', e.key, { index, value });
                    // 문자 입력/백스페이스/엔터 등 주요 키에서 커밋
                    const key = e.key || '';
                    if (!(key.length === 1 || key === 'Backspace' || key === 'Enter' || key === 'Delete')) return;
                    const actualMergeKey = this.findMergeKey('actual', index);
                    if (actualMergeKey) {
                        const [, startStr, endStr] = actualMergeKey.split('-');
                        const start = parseInt(startStr, 10);
                        const end = parseInt(endStr, 10);
                        this.mergedFields.set(actualMergeKey, value);
                        for (let i = start; i <= end; i++) {
                            this.timeSlots[i].actual = (i === start) ? value : '';
                        }
                    } else {
                        this.timeSlots[index].actual = value;
                    }
                    this.clearSubActivitiesForIndex(index);
                    this.syncTimerElapsedFromActualInput(index, value);
                    this.calculateTotals();
                    this.autoSave();
                } catch (err) {
                    console.error('[actual-input] keyup handler error:', err);
                }
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.isSelectingPlanned || this.currentColumnType !== 'planned') return;
            if (typeof e.buttons === 'number' && e.buttons === 0) return;
            const hoverIndex = this.getIndexAtClientPosition('planned', e.clientX, e.clientY);
            if (!Number.isInteger(hoverIndex)) return;
            const baseStart = Number.isInteger(this.dragStartIndex) ? this.dragStartIndex : hoverIndex;
            const baseEnd = Number.isInteger(this.dragBaseEndIndex) && this.dragBaseEndIndex >= 0
                ? this.dragBaseEndIndex
                : baseStart;
            this.clearSelection('planned');
            this.selectFieldRange('planned', Math.min(baseStart, hoverIndex), Math.max(baseEnd, hoverIndex));
        });

        document.addEventListener('mouseup', () => {
            this.isSelectingPlanned = false;
            this.isSelectingActual = false;
            this.dragStartIndex = -1;
            this.dragBaseEndIndex = -1;
            this.currentColumnType = null;
        });
        document.addEventListener('touchend', () => {
            this.isSelectingPlanned = false;
            this.isSelectingActual = false;
            this.dragStartIndex = -1;
            this.dragBaseEndIndex = -1;
            this.currentColumnType = null;
        }, { passive: true });

        window.addEventListener('resize', () => {
            this.updateSelectionOverlay('planned');
            this.updateSelectionOverlay('actual');
            this.hideUndoButton();
            this.centerMergedTimeContent(document.getElementById('timeEntries'));
            this.hideHoverScheduleButton && this.hideHoverScheduleButton();
        });
        window.addEventListener('scroll', () => {
            this.updateSelectionOverlay('planned');
            this.updateSelectionOverlay('actual');
            this.hideUndoButton();
            this.hideHoverScheduleButton && this.hideHoverScheduleButton();
            this.centerMergedTimeContent(document.getElementById('timeEntries'));
        });
    }

    setCurrentDate() {
        document.getElementById('date').value = this.currentDate;
    }

    // 병합 셀 내부 어디를 클릭해도 전체 병합 범위를 선택하도록 캡처 처리
    handleMergedClickCapture(e) {
        const target = e.target;
        // 예외: 실제 활동 상세 기록 버튼은 통과
        if (target.closest && target.closest('.activity-log-btn')) return;
        if (target.closest && target.closest('.split-visualization-actual')) return;

        // 시간열(병합) 클릭: 타이머 컨트롤은 통과, 그 외는 선택과 무관하므로 차단
        const timeMerged = target.closest && target.closest('.time-slot-container.merged-time-main, .time-slot-container.merged-time-secondary');
        if (timeMerged) {
            // 타이머 버튼/컨트롤 영역 클릭이면 통과시킴
            if (target.closest('.timer-controls-container') || target.closest('.timer-btn')) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        // 계획(좌측) 병합 클릭 처리
        const plannedEl = target.closest && target.closest('.planned-input[data-merge-key]');
        if (plannedEl) {
            const mergeKey = plannedEl.getAttribute('data-merge-key');
            if (!mergeKey) return;
            e.preventDefault();
            e.stopPropagation();
            if (e.type === 'mousedown') return; // 클릭에서 처리
            if (this.isMergeRangeSelected('planned', mergeKey)) this.clearSelection('planned');
            else {
                const canAppend = this.selectedPlannedFields && this.selectedPlannedFields.size > 0;
                if (!canAppend) this.clearAllSelections();
                this.selectMergedRange('planned', mergeKey, { append: canAppend });
            }
            if (e.type === 'click') {
                const [, startStr, endStr] = mergeKey.split('-');
                const startIdx = parseInt(startStr, 10);
                const endIdx = parseInt(endStr, 10);
                const safeStart = Number.isFinite(startIdx) ? startIdx : parseInt(plannedEl.dataset.index, 10);
                const safeEnd = Number.isFinite(endIdx) ? endIdx : safeStart;
                if (!Number.isFinite(safeStart)) return;
                const anchor = document.querySelector(`[data-index="${safeStart}"] .planned-input`) || plannedEl;
                this.openInlinePlanDropdown(safeStart, anchor, safeEnd);
            }
            return;
        }

        // 실제(우측) 병합 클릭은 선택/병합 조작을 제공하지 않음

        // 보조 요소(pointer-events: none) 등으로 위 검사에 걸리지 않는 경우 좌표 기반 판정
        const row = target.closest && target.closest('.time-entry');
        if (row && typeof e.clientX === 'number') {
            const rowRect = row.getBoundingClientRect();
            const index = parseInt(row.getAttribute('data-index'), 10);
            const x = e.clientX, y = e.clientY;

            // 좌측(계획) 컬럼 영역
            const prEl = row.querySelector('.planned-input');
            if (prEl) {
                const pr = prEl.getBoundingClientRect();
                const inPlanned = (x >= pr.left && x <= pr.right && y >= rowRect.top && y <= rowRect.bottom);
                if (inPlanned) {
                    const mk = this.findMergeKey('planned', index);
                    if (mk) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.type === 'click') {
                            if (this.isMergeRangeSelected('planned', mk)) this.clearSelection('planned');
                            else {
                                const canAppend = this.selectedPlannedFields && this.selectedPlannedFields.size > 0;
                                if (!canAppend) this.clearAllSelections();
                                this.selectMergedRange('planned', mk, { append: canAppend });
                            }
                        }
                        return;
                    }
                }
            }

            // 우측(실제) 컬럼 영역
            const arEl = row.querySelector('.actual-input');
            if (arEl) {
                const ar = arEl.getBoundingClientRect();
                const inActual = (x >= ar.left && x <= ar.right && y >= rowRect.top && y <= rowRect.bottom);
                if (inActual) {
                    const mk = this.findMergeKey('actual', index);
                    if (mk) {
                        const [, startStr] = mk.split('-');
                        const startIdx = parseInt(startStr, 10);
                        const mainContainer = target.closest && target.closest('.actual-field-container.merged-actual-main');
                        const clickedInput = target.closest && target.closest('.timer-result-input');

                        if (mainContainer && index === startIdx && !this.isSelectingPlanned && !this.isSelectingActual) {
                            if (clickedInput) {
                                return;
                            }
                            if (e.type === 'click') {
                                const inputEl = mainContainer.querySelector('.timer-result-input');
                                if (inputEl) {
                                    inputEl.focus();
                                    try {
                                        const len = inputEl.value.length;
                                        inputEl.setSelectionRange(len, len);
                                    } catch (_) {}
                                }
                            }
                            return;
                        }

                        e.preventDefault();
                        e.stopPropagation();
                        if (e.type === 'click') {
                            if (this.isMergeRangeSelected('actual', mk)) this.clearSelection('actual');
                            else { this.clearAllSelections(); this.selectMergedRange('actual', mk); }
                        }
                        return;
                    }
                }
            }
        }
    }

    calculateTotals() {
        let plannedSeconds = 0;
        let actualSeconds = 0;
        const nowMs = Date.now();

        const handledPlannedMerges = new Set();
        const handledActualMerges = new Set();

        const getTimerElapsedForSlot = (slot) => {
            if (!slot || !slot.timer) return 0;
            let elapsed = Number(slot.timer.elapsed) || 0;
            if (slot.timer.running && Number.isFinite(slot.timer.startTime)) {
                elapsed += Math.max(0, Math.floor((nowMs - slot.timer.startTime) / 1000));
            }
            return elapsed > 0 ? elapsed : 0;
        };

        const sumTimerElapsedInRange = (start, end) => {
            let total = 0;
            for (let i = start; i <= end; i++) {
                const slot = this.timeSlots[i];
                const elapsed = getTimerElapsedForSlot(slot);
                if (elapsed > 0) total += elapsed;
            }
            return total;
        };

        const sumActivitiesSeconds = (list) => {
            if (!Array.isArray(list)) return 0;
            return list.reduce((sum, item) => {
                if (!item) return sum;
                const secs = Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
                return sum + secs;
            }, 0);
        };

        this.timeSlots.forEach((slot, index) => {
            const plannedMergeKey = this.findMergeKey('planned', index);
            if (plannedMergeKey) {
                if (handledPlannedMerges.has(plannedMergeKey)) return;
                handledPlannedMerges.add(plannedMergeKey);

                const [, startStr, endStr] = plannedMergeKey.split('-');
                const start = parseInt(startStr, 10);
                const end = parseInt(endStr, 10);
                const length = Number.isFinite(end) && Number.isFinite(start) ? Math.max(1, end - start + 1) : 1;
                const baseSlot = this.timeSlots[start];
                const plannedValue = String((this.mergedFields.get(plannedMergeKey) || (baseSlot && baseSlot.planned) || '')).trim();
                const planActivities = this.normalizePlanActivitiesArray(baseSlot && baseSlot.planActivities);
                const planSeconds = sumActivitiesSeconds(planActivities);
                if (planSeconds > 0) {
                    plannedSeconds += planSeconds;
                } else if (plannedValue) {
                    plannedSeconds += length * 3600;
                }
                return;
            }

            if (slot && slot.planned && slot.planned.trim() !== '') {
                const planActivities = this.normalizePlanActivitiesArray(slot.planActivities);
                const planSeconds = sumActivitiesSeconds(planActivities);
                plannedSeconds += planSeconds > 0 ? planSeconds : 3600;
            } else {
                const planActivities = this.normalizePlanActivitiesArray(slot && slot.planActivities);
                const planSeconds = sumActivitiesSeconds(planActivities);
                plannedSeconds += planSeconds;
            }
        });

        this.timeSlots.forEach((slot, index) => {
            const actualMergeKey = this.findMergeKey('actual', index);
            if (actualMergeKey) {
                if (handledActualMerges.has(actualMergeKey)) return;
                handledActualMerges.add(actualMergeKey);

                const [, startStr, endStr] = actualMergeKey.split('-');
                const start = parseInt(startStr, 10);
                const end = parseInt(endStr, 10);
                const baseSlot = this.timeSlots[start] || {};
                const subActivities = this.normalizeActivitiesArray(baseSlot.activityLog && baseSlot.activityLog.subActivities);
                let seconds = sumActivitiesSeconds(subActivities);
                if (seconds <= 0) {
                    const mergedValue = String((this.mergedFields.get(actualMergeKey) || baseSlot.actual || '')).trim();
                    seconds = this.parseDurationFromText(mergedValue);
                }
                if (seconds == null || Number.isNaN(seconds) || seconds <= 0) {
                    seconds = sumTimerElapsedInRange(start, end);
                }
                if (Number.isFinite(seconds) && seconds > 0) {
                    actualSeconds += Math.floor(seconds);
                }
                return;
            }

            if (!slot) return;
            const subActivities = this.normalizeActivitiesArray(slot.activityLog && slot.activityLog.subActivities);
            const subSeconds = sumActivitiesSeconds(subActivities);
            if (subSeconds > 0) {
                actualSeconds += subSeconds;
                return;
            }
            const actualValue = String(slot.actual || '').trim();
            if (actualValue) {
                let seconds = this.parseDurationFromText(actualValue);
                if (seconds == null || Number.isNaN(seconds)) {
                    seconds = slot.timer && Number.isFinite(slot.timer.elapsed) ? slot.timer.elapsed : 0;
                }
                if (Number.isFinite(seconds) && seconds > 0) {
                    actualSeconds += Math.floor(seconds);
                }
            } else if (slot.timer && Number.isFinite(slot.timer.elapsed) && slot.timer.elapsed > 0) {
                actualSeconds += Math.floor(slot.timer.elapsed);
            }
        });

        document.getElementById('totalPlanned').textContent = this.formatDurationSummary(plannedSeconds);
        document.getElementById('totalActual').textContent = this.formatDurationSummary(actualSeconds);

        const recordedSeconds = this.timeSlots.reduce((sum, slot) => sum + Math.floor(getTimerElapsedForSlot(slot)), 0);
        this.updateAnalysis(plannedSeconds, actualSeconds, recordedSeconds);
    }

    updateAnalysis(plannedSeconds, actualSeconds, recordedSeconds) {
        const executionRate = plannedSeconds > 0 ? Math.round((actualSeconds / plannedSeconds) * 100) : 0;
        const executionRateElement = document.getElementById('executionRate');
        executionRateElement.textContent = `${executionRate}%`;

        executionRateElement.className = 'analysis-value';
        if (executionRate >= 80) {
            executionRateElement.classList.add('good');
        } else if (executionRate >= 60) {
            executionRateElement.classList.add('warning');
        } else if (executionRate > 0) {
            executionRateElement.classList.add('poor');
        }

        const timerUsageElement = document.getElementById('timerUsage');
        timerUsageElement.textContent = this.formatDurationSummary(recordedSeconds);

        timerUsageElement.className = 'analysis-value';
        if (recordedSeconds > 0) {
            timerUsageElement.classList.add('good');
        }
    }

    async saveData() {
        const data = {
            date: this.currentDate,
            timeSlots: this.timeSlots,
            mergedFields: Object.fromEntries(this.mergedFields),
            savedAt: Date.now()
        };
        const serializedData = JSON.stringify(data);
        this.setSaveStatus('info', '저장 중…');
        try {
            const storage = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerStorage)
                ? globalThis.TimeTrackerStorage
                : null;
            let stored = false;
            if (storage && typeof storage.setTimesheetData === 'function') {
                stored = Boolean(storage.setTimesheetData(this.currentDate, serializedData));
            } else {
                localStorage.setItem(`timesheetData:${this.currentDate}`, serializedData);
                localStorage.setItem('timesheetData:last', serializedData);
                stored = true;
            }
            if (!stored) {
                throw new Error('local storage unavailable');
            }
            this.setSaveStatus('success', `저장됨 ${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`);
        } catch (_) {
            this.setSaveStatus('error', '로컬 저장 실패');
        }
        try {
            this._lastSavedSignature = JSON.stringify({
                date: this.currentDate,
                timeSlots: this.timeSlots,
                mergedFields: Object.fromEntries(this.mergedFields)
            });
        } catch (_) {}
        try {
            this._hasPendingRemoteSync = true;
            this.setSyncStatus(navigator.onLine ? 'info' : 'warn', navigator.onLine ? '동기화 예약됨' : '오프라인 (온라인 시 동기화)');
            this.scheduleSupabaseSave && this.scheduleSupabaseSave();
        } catch(_) {}
    }

    createStateSnapshot(timeSlots = this.timeSlots, mergedFields = this.mergedFields) {
        const safeSlots = Array.isArray(timeSlots) ? timeSlots : [];
        let clonedSlots;
        try {
            clonedSlots = JSON.parse(JSON.stringify(safeSlots));
        } catch (_) {
            clonedSlots = safeSlots.map((slot) => ({ ...(slot || {}) }));
        }

        let mergedObject = {};
        if (mergedFields instanceof Map) {
            mergedObject = Object.fromEntries(mergedFields);
        } else if (mergedFields && typeof mergedFields === 'object') {
            mergedObject = { ...mergedFields };
        }

        return {
            timeSlots: clonedSlots,
            mergedFields: mergedObject
        };
    }

    async loadData() {
        // 로컬에서 로드
        let savedData = null;
        try {
            const storage = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerStorage)
                ? globalThis.TimeTrackerStorage
                : null;
            if (storage && typeof storage.getTimesheetData === 'function') {
                savedData = storage.getTimesheetData(this.currentDate);
            } else {
                savedData = localStorage.getItem(`timesheetData:${this.currentDate}`) || localStorage.getItem('timesheetData:last');
            }
        } catch (_) {
            savedData = null;
        }
        if (savedData) {
            const data = JSON.parse(savedData);
            this.timeSlots = (data.timeSlots || this.timeSlots).map((slot) => {
                // activityLog 구조 정규화 및 legacy 필드(outcome) 제거
                if (!slot.activityLog || typeof slot.activityLog !== 'object') {
                    slot.activityLog = { title: '', details: '', subActivities: [], titleBandOn: false, actualGridUnits: [], actualExtraGridUnits: [], actualOverride: false };
                } else {
                    if (typeof slot.activityLog.title !== 'string') {
                        slot.activityLog.title = String(slot.activityLog.title || '');
                    }
                    if (typeof slot.activityLog.details !== 'string') {
                        slot.activityLog.details = String(slot.activityLog.details || '');
                    }
                    if (!Array.isArray(slot.activityLog.subActivities)) {
                        slot.activityLog.subActivities = [];
                    } else {
                        slot.activityLog.subActivities = this.normalizeActivitiesArray(slot.activityLog.subActivities);
                    }
                    if (!Array.isArray(slot.activityLog.actualGridUnits)) {
                        slot.activityLog.actualGridUnits = [];
                    } else {
                        slot.activityLog.actualGridUnits = slot.activityLog.actualGridUnits.map(value => Boolean(value));
                    }
                    if (!Array.isArray(slot.activityLog.actualExtraGridUnits)) {
                        slot.activityLog.actualExtraGridUnits = [];
                    } else {
                        slot.activityLog.actualExtraGridUnits = slot.activityLog.actualExtraGridUnits.map(value => Boolean(value));
                    }
                    if ('outcome' in slot.activityLog) {
                        try { delete slot.activityLog.outcome; } catch (_) { slot.activityLog.outcome = undefined; }
                    }
                    slot.activityLog.titleBandOn = Boolean(slot.activityLog.titleBandOn);
                }
                if (!Array.isArray(slot.planActivities)) {
                    slot.planActivities = [];
                } else {
                    slot.planActivities = this.normalizePlanActivitiesArray(slot.planActivities);
                }
                if (typeof slot.planTitle === 'string') {
                    slot.planTitle = this.normalizeActivityText
                        ? this.normalizeActivityText(slot.planTitle)
                        : slot.planTitle.trim();
                } else {
                    const fallbackTitle = typeof slot.planned === 'string'
                        ? (this.normalizeActivityText ? this.normalizeActivityText(slot.planned) : slot.planned.trim())
                        : '';
                    slot.planTitle = fallbackTitle;
                }
                slot.planTitleBandOn = Boolean(slot.planTitleBandOn);
                slot.activityLog.titleBandOn = Boolean(slot.activityLog.titleBandOn);
                slot.activityLog.actualOverride = Boolean(slot.activityLog.actualOverride);
                return slot;
            });

            // 실행중 타이머는 정지
            this.timeSlots.forEach(slot => {
                if (slot.timer && slot.timer.running) {
                    slot.timer.running = false;
                    slot.timer.startTime = null;
                }
            });

            if (data.mergedFields) {
                this.mergedFields = new Map(Object.entries(data.mergedFields));
            } else {
                this.mergedFields.clear();
            }
        } else {
            this.generateTimeSlots();
            this.mergedFields.clear();
        }

        const routineApplied = this.applyRoutinesToDate
            ? this.applyRoutinesToDate(this.currentDate, { reason: 'load' })
            : false;

        this.renderTimeEntries();
        this.calculateTotals();
        if (routineApplied) {
            this.autoSave();
        }
        // Supabase에서 최신 데이터 가져오기(옵션)
        try { this.fetchFromSupabaseForDate && this.fetchFromSupabaseForDate(this.currentDate); } catch(_) {}
    }

    

    // 주기적으로 변경 사항을 감지해 저장 (이벤트 누락 대비)
    startChangeWatcher() {
        if (this._watcher) clearInterval(this._watcher);
        this._watcher = setInterval(() => {
            try {
                let shouldPersist = false;
                // DOM에서 실제 입력값을 읽어 상태와 불일치 시 보정(이벤트 누락 대비)
                try {
                    for (let i = 0; i < (this.timeSlots?.length || 0); i++) {
                        const row = document.querySelector(`[data-index="${i}"]`);
                        if (!row) continue;
                        const inp = row.querySelector('.timer-result-input');
                        if (!inp) continue;
                        const v = String(inp.value || '');
                        if (this.timeSlots[i].actual !== v) {
                            this.timeSlots[i].actual = v;
                            // 시간 텍스트로 timer.elapsed 동기화
                            this.syncTimerElapsedFromActualInput(i, v);
                            shouldPersist = true;
                        }
                    }
                } catch (_) {}

                const sig = JSON.stringify({
                    date: this.currentDate,
                    timeSlots: this.timeSlots,
                    mergedFields: Object.fromEntries(this.mergedFields)
                });
                if (sig !== this._lastSavedSignature) {
                    shouldPersist = true;
                }
                if (shouldPersist) {
                    this.autoSave();
                }
            } catch (_) {}
        }, 5000);
    }

    

    autoSave() {
        clearTimeout(this.autoSaveTimeout);
        this.autoSaveTimeout = setTimeout(() => {
            this.saveData();
        }, 1500);
    }

    clearData() {
        this.commitRunningTimers({ render: false, calculate: false, autoSave: false });
        let routineChanged = false;
        if (this.routinesLoaded && Array.isArray(this.routines)) {
            this.routines.forEach((routine) => {
                if (!routine || typeof routine !== 'object') return;
                if (this.isRoutineStoppedForDate(routine, this.currentDate)) return;
                if (!this.isRoutineActiveOnDate(routine, this.currentDate)) return;
                if (!this.isRoutinePresentOnDate(routine)) return;
                const updated = this.passRoutineForDate(routine.id, this.currentDate);
                if (updated) routineChanged = true;
            });
            if (routineChanged) {
                this.scheduleSupabaseRoutineSave();
            }
        }
        this.generateTimeSlots();
        this.mergedFields.clear();
        this.renderTimeEntries();
        this.calculateTotals();
        this.renderInlinePlanDropdownOptions();
        this.closeRoutineMenu();
        try {
            const storage = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerStorage)
                ? globalThis.TimeTrackerStorage
                : null;
            if (storage && typeof storage.removeTimesheetData === 'function') {
                storage.removeTimesheetData(this.currentDate);
            } else {
                localStorage.removeItem(`timesheetData:${this.currentDate}`);
            }
        } catch (_) {}
        // If user refreshes quickly, Supabase fetch could re-apply stale data.
        // Mark this day as "pending clear" so the next load will delete remote first.
        this.markTimesheetClearPending(this.currentDate);
        try { this.deleteFromSupabaseForDate(this.currentDate); } catch (_) {}
        try {
            this._lastSavedSignature = JSON.stringify({
                date: this.currentDate,
                timeSlots: this.timeSlots,
                mergedFields: {}
            });
        } catch (_) {
            this._lastSavedSignature = '';
        }
        // 자동 저장 시스템: 초기화 후에도 서버에 반영
        this.autoSave();
    }

    // 가져오기/내보내기 기능 제거됨: 관련 함수 삭제

    // ===== Supabase integration (optional) =====
    getSupabaseIdentity() {
        const userId = (this.supabaseUser && this.supabaseUser.id) ? String(this.supabaseUser.id).trim() : '';
        return userId || null;
    }

    handleSupabaseIdentityChange(force = false) {
        if (!this.supabaseConfigured || !this.supabase) return;
        const identity = this.getSupabaseIdentity();
        if (!identity) {
            this.commitRunningTimers({ render: true, calculate: true, autoSave: false });
            this._lastSupabaseIdentity = null;
            this.clearSupabaseChannels();
            clearTimeout(this._sbSaveTimer);
            clearTimeout(this._sbRetryTimer);
            this._sbRetryDelayMs = 2000;
            this._hasPendingRemoteSync = false;
            clearTimeout(this._plannedSaveTimer);
            this._lastSupabasePlannedSignature = '';
            clearTimeout(this._routineSaveTimer);
            this._lastSupabaseRoutineSignature = '';
            this.routines = [];
            this.routinesLoaded = false;
            return;
        }
        if (force || this._lastSupabaseIdentity !== identity) {
            this._lastSupabaseIdentity = identity;
            this._lastSupabasePlannedSignature = '';
            this._lastSupabaseRoutineSignature = '';
            try { this.resubscribeSupabaseRealtime && this.resubscribeSupabaseRealtime(); } catch (_) {}
            try {
                if (this.fetchFromSupabaseForDate) {
                    const promise = this.fetchFromSupabaseForDate(this.currentDate);
                    if (promise && typeof promise.catch === 'function') {
                        promise.catch(() => {});
                    }
                }
            } catch (_) {}
            try {
                if (this.fetchPlannedCatalogFromSupabase) {
                    const p = this.fetchPlannedCatalogFromSupabase();
                    if (p && typeof p.catch === 'function') {
                        p.catch(() => {});
                    }
                }
            } catch (_) {}
            try {
                if (this.fetchRoutinesFromSupabase) {
                    const r = this.fetchRoutinesFromSupabase();
                    if (r && typeof r.catch === 'function') {
                        r.catch(() => {});
                    }
                }
            } catch (_) {}
        }
    }

    applySupabaseSession(session, opts = {}) {
        const user = session && session.user ? session.user : null;
        const previousId = this.supabaseUser && this.supabaseUser.id;
        this.supabaseUser = user;
        this.updateAuthUI();
        const nextId = user && user.id;
        if (previousId !== nextId) {
            this.handleSupabaseIdentityChange(true);
        }
        const ev = String(opts.event || '');
        const hadPrev = Boolean(previousId);
        const hasUser = Boolean(user && user.id);
        // 로그인 성공 알림: 실제로 사용자 의도로 로그인 플로우를 시작한 경우에만
        if (ev === 'SIGNED_IN' && hasUser) {
            let startedByUser = false;
            startedByUser = this.loginIntent === 'google';
            if (startedByUser) {
                this.showNotification('Google 로그인에 성공했습니다.');
            }
            this.loginIntent = null;
        }
        // 로그아웃 알림: 명시적 SIGNED_OUT 이벤트일 때만
        if (ev === 'SIGNED_OUT' && hadPrev) {
            this.showNotification('로그아웃되었습니다.');
        }
    }

    initSupabaseAuthHandlers() {
        if (!this.supabase) return;
        try {
            this.supabase.auth.getSession()
                .then(({ data }) => {
                    this.applySupabaseSession(data && data.session ? data.session : null, { fromGetSession: true });
                })
                .catch((err) => {
                    console.warn('[auth] failed to fetch session', err);
                });
        } catch (e) {
            console.warn('[auth] getSession error', e);
        }
        try {
            this.supabase.auth.onAuthStateChange((event, session) => {
                this.applySupabaseSession(session, { event });
            });
        } catch (e) {
            console.warn('[auth] subscribe failed', e);
        }
    }

    // 시간 라벨('00','1'..'23') <-> 정수 시(0..23) 변환 헬퍼
    labelToHour(label) {
        const s = String(label).trim();
        if (s === '00' || s === '0') return 0;
        const n = parseInt(s, 10);
        return isNaN(n) ? 0 : (n % 24);
    }
    hourToLabel(hour) {
        const n = Number(hour) % 24;
        return n === 0 ? '00' : String(n);
    }
    // 메모리 -> DB 전송용 slots JSON 생성(비어있는 시간은 생략)
    buildSlotsJson() {
        const slots = {};
        const handledMerges = new Set();
        try {
            this.timeSlots.forEach((slot, index) => {
                const timeMergeKey = this.findMergeKey('time', index);
                if (timeMergeKey) {
                    if (handledMerges.has(timeMergeKey)) return;
                    handledMerges.add(timeMergeKey);

                    const [, startStr, endStr] = timeMergeKey.split('-');
                    const start = parseInt(startStr, 10);
                    const end = parseInt(endStr, 10);
                    if (isNaN(start) || isNaN(end)) return;
                    const startSlot = this.timeSlots[start];
                    const endSlot = this.timeSlots[end];
                    if (!startSlot || !endSlot) return;

                    const startLabel = String(startSlot.time || '').trim();
                    const endLabel = String(endSlot.time || '').trim();
                    const plannedKey = `planned-${start}-${end}`;
                    const actualKey = `actual-${start}-${end}`;
                    const plannedValue = String((this.mergedFields.get(plannedKey) ?? startSlot.planned ?? '')).trim();
                    const actualValue = String((this.mergedFields.get(actualKey) ?? startSlot.actual ?? '')).trim();
                    const detailsValue = String((startSlot.activityLog && startSlot.activityLog.details) || '').trim();
                    const activitiesValue = this.normalizeActivitiesArray(startSlot.activityLog && startSlot.activityLog.subActivities);
                    const planActivitiesValue = this.normalizePlanActivitiesArray(startSlot.planActivities);
                    const planTitleValue = this.normalizeActivityText
                        ? this.normalizeActivityText(startSlot.planTitle || '')
                        : String(startSlot.planTitle || '').trim();
                    const planTitleBand = Boolean(startSlot.planTitleBandOn && planTitleValue);
                    const actualTitleBand = Boolean(startSlot.activityLog && startSlot.activityLog.titleBandOn);
                    const actualGridUnits = (startSlot.activityLog && Array.isArray(startSlot.activityLog.actualGridUnits))
                        ? startSlot.activityLog.actualGridUnits.map(value => Boolean(value))
                        : [];
                    const hasActualGridUnits = actualGridUnits.some(value => value);
                    const actualExtraGridUnits = (startSlot.activityLog && Array.isArray(startSlot.activityLog.actualExtraGridUnits))
                        ? startSlot.activityLog.actualExtraGridUnits.map(value => Boolean(value))
                        : [];
                    const hasActualExtraGridUnits = actualExtraGridUnits.some(value => value);

                    if (plannedValue === ''
                        && actualValue === ''
                        && detailsValue === ''
                        && activitiesValue.length === 0
                        && planActivitiesValue.length === 0
                        && !planTitleValue) {
                        return;
                    }

                    const storageKey = String(this.labelToHour(startLabel));
                    slots[storageKey] = {
                        planned: plannedValue,
                        actual: actualValue,
                        details: detailsValue,
                        merged: true,
                        timeRange: `${startLabel} ~ ${endLabel}`
                    };
                    if (activitiesValue.length > 0) {
                        slots[storageKey].activities = activitiesValue.map(item => ({ ...item }));
                    }
                    if (planActivitiesValue.length > 0) {
                        slots[storageKey].planActivities = planActivitiesValue.map(item => ({ ...item }));
                    }
                    if (planTitleValue) {
                        slots[storageKey].planTitle = planTitleValue;
                    }
                    if (planTitleBand) {
                        slots[storageKey].planTitleBandOn = true;
                    }
                    if (actualTitleBand) {
                        slots[storageKey].actualTitleBandOn = true;
                    }
                    if (hasActualGridUnits) {
                        slots[storageKey].actualGridUnits = actualGridUnits;
                    }
                    if (hasActualExtraGridUnits) {
                        slots[storageKey].actualExtraGridUnits = actualExtraGridUnits;
                    }
                    return;
                }

                const hour = this.labelToHour(slot.time);
                const planned = String(slot.planned || '').trim();
                const actual = String(slot.actual || '').trim();
                const details = String((slot.activityLog && slot.activityLog.details) || '').trim();
                const activitiesValue = this.normalizeActivitiesArray(slot.activityLog && slot.activityLog.subActivities);
                const planActivitiesValue = this.normalizePlanActivitiesArray(slot.planActivities);
                const planTitleValue = this.normalizeActivityText
                    ? this.normalizeActivityText(slot.planTitle || '')
                    : String(slot.planTitle || '').trim();
                const planTitleBand = Boolean(slot.planTitleBandOn && planTitleValue);
                const actualTitleBand = Boolean(slot.activityLog && slot.activityLog.titleBandOn);
                const actualGridUnits = (slot.activityLog && Array.isArray(slot.activityLog.actualGridUnits))
                    ? slot.activityLog.actualGridUnits.map(value => Boolean(value))
                    : [];
                const hasActualGridUnits = actualGridUnits.some(value => value);
                const actualExtraGridUnits = (slot.activityLog && Array.isArray(slot.activityLog.actualExtraGridUnits))
                    ? slot.activityLog.actualExtraGridUnits.map(value => Boolean(value))
                    : [];
                const hasActualExtraGridUnits = actualExtraGridUnits.some(value => value);
                if (planned !== ''
                    || actual !== ''
                    || details !== ''
                    || activitiesValue.length > 0
                    || planActivitiesValue.length > 0
                    || planTitleValue) {
                    const entry = { planned, actual, details };
                    if (activitiesValue.length > 0) {
                        entry.activities = activitiesValue.map(item => ({ ...item }));
                    }
                    if (planActivitiesValue.length > 0) {
                        entry.planActivities = planActivitiesValue.map(item => ({ ...item }));
                    }
                    if (planTitleValue) {
                        entry.planTitle = planTitleValue;
                    }
                    if (planTitleBand) {
                        entry.planTitleBandOn = true;
                    }
                    if (actualTitleBand) {
                        entry.actualTitleBandOn = true;
                    }
                    if (hasActualGridUnits) {
                        entry.actualGridUnits = actualGridUnits;
                    }
                    if (hasActualExtraGridUnits) {
                        entry.actualExtraGridUnits = actualExtraGridUnits;
                    }
                    slots[String(hour)] = entry;
                }
            });
        } catch (_) {}
        return slots;
    }
    // DB slots JSON -> 메모리 반영(존재하는 키만 반영)
    applySlotsJson(slotsJson) {
        if (!slotsJson || typeof slotsJson !== 'object') return false;
        let changed = false;
        const nextMergedFields = new Map();
        try {
            Object.keys(slotsJson).forEach((k) => {
                const hour = parseInt(k, 10);
                if (isNaN(hour)) return;
                const label = this.hourToLabel(hour);
                const idx = this.timeSlots.findIndex(s => String(s.time) === label);
                if (idx < 0) return;
                const row = slotsJson[k] || {};

                const plannedValue = typeof row.planned === 'string' ? row.planned : '';
                const actualValue = typeof row.actual === 'string' ? row.actual : '';
                const detailsValue = typeof row.details === 'string' ? row.details : '';
                const hasActivities = Array.isArray(row.activities);
                const hasPlanActivities = Array.isArray(row.planActivities);
                const planTitleValue = typeof row.planTitle === 'string'
                    ? (this.normalizeActivityText ? this.normalizeActivityText(row.planTitle) : row.planTitle.trim())
                    : '';
                const planTitleBand = Boolean(row.planTitleBandOn);
                const actualTitleBand = Boolean(row.actualTitleBandOn);
                const actualGridUnits = Array.isArray(row.actualGridUnits)
                    ? row.actualGridUnits.map(value => Boolean(value))
                    : [];
                const actualExtraGridUnits = Array.isArray(row.actualExtraGridUnits)
                    ? row.actualExtraGridUnits.map(value => Boolean(value))
                    : [];

                if (row && row.merged && typeof row.timeRange === 'string') {
                    const parts = row.timeRange.split('~').map(part => String(part || '').trim()).filter(Boolean);
                    if (parts.length === 2) {
                        const [startLabel, endLabel] = parts;
                        const startIdx = this.timeSlots.findIndex(s => String(s.time) === startLabel);
                        const endIdx = this.timeSlots.findIndex(s => String(s.time) === endLabel);
                        if (startIdx >= 0 && endIdx >= startIdx) {
                            const plannedKey = `planned-${startIdx}-${endIdx}`;
                            const timeKey = `time-${startIdx}-${endIdx}`;
                            const actualKey = `actual-${startIdx}-${endIdx}`;
                            const plannedTrimmed = String(plannedValue || '').trim();
                            const actualTrimmed = String(actualValue || '').trim();
                            const activitiesValue = hasActivities ? this.normalizeActivitiesArray(row.activities) : null;
                            const planActivitiesValue = hasPlanActivities ? this.normalizePlanActivitiesArray(row.planActivities) : null;
                            nextMergedFields.set(plannedKey, plannedTrimmed);
                            nextMergedFields.set(timeKey, `${startLabel}-${endLabel}`);
                            nextMergedFields.set(actualKey, actualTrimmed);

                            for (let i = startIdx; i <= endIdx; i++) {
                                const slot = this.timeSlots[i];
                                const nextPlanned = i === startIdx ? plannedTrimmed : '';
                                const nextActual = i === startIdx ? actualTrimmed : '';
                                if (slot.planned !== nextPlanned) { slot.planned = nextPlanned; changed = true; }
                                if (slot.actual !== nextActual) { slot.actual = nextActual; changed = true; }
                                if (!slot.activityLog || typeof slot.activityLog !== 'object') {
                                    slot.activityLog = { title: '', details: '', subActivities: [], titleBandOn: false, actualGridUnits: [], actualExtraGridUnits: [], actualOverride: false };
                                }
                                const desiredDetails = (i === startIdx) ? detailsValue : '';
                                if (slot.activityLog.details !== desiredDetails) {
                                    slot.activityLog.details = desiredDetails;
                                    changed = true;
                                }
                                const desiredPlanTitle = (i === startIdx) ? planTitleValue : '';
                                if (slot.planTitle !== desiredPlanTitle) {
                                    slot.planTitle = desiredPlanTitle;
                                    changed = true;
                                }
                                const shouldPlanBand = (i === startIdx) && planTitleBand && Boolean(planTitleValue);
                                if (slot.planTitleBandOn !== shouldPlanBand) {
                                    slot.planTitleBandOn = shouldPlanBand;
                                    changed = true;
                                }
                                const desiredTitleBand = (i === startIdx) && actualTitleBand && Array.isArray(activitiesValue) && activitiesValue.length > 0;
                                if (slot.activityLog.titleBandOn !== desiredTitleBand) {
                                    slot.activityLog.titleBandOn = desiredTitleBand;
                                    changed = true;
                                }
                                if (i === startIdx) {
                                    slot.activityLog.actualGridUnits = actualGridUnits.slice();
                                    slot.activityLog.actualExtraGridUnits = actualExtraGridUnits.slice();
                                } else {
                                    slot.activityLog.actualGridUnits = [];
                                    slot.activityLog.actualExtraGridUnits = [];
                                }
                                if (hasActivities) {
                                    const desiredActivities = (i === startIdx) ? activitiesValue : [];
                                    const currentActivities = Array.isArray(slot.activityLog.subActivities) ? slot.activityLog.subActivities : [];
                                    const desiredSignature = JSON.stringify(desiredActivities);
                                    const currentSignature = JSON.stringify(this.normalizeActivitiesArray(currentActivities));
                                    if (desiredSignature !== currentSignature) {
                                        slot.activityLog.subActivities = desiredActivities.map(item => ({ ...item }));
                                        changed = true;
                                    }
                                }
                                if (hasPlanActivities) {
                                    const desiredPlan = (i === startIdx) ? planActivitiesValue : [];
                                    const currentPlan = Array.isArray(slot.planActivities) ? slot.planActivities : [];
                                    const desiredPlanSig = JSON.stringify(desiredPlan);
                                    const currentPlanSig = JSON.stringify(this.normalizePlanActivitiesArray(currentPlan));
                                    if (desiredPlanSig !== currentPlanSig) {
                                        slot.planActivities = desiredPlan.map(item => ({ ...item }));
                                        changed = true;
                                    }
                                }
                            }
                            return;
                        }
                    }
                }

                const slot = this.timeSlots[idx];
                if (slot.planned !== plannedValue) { slot.planned = plannedValue; changed = true; }
                if (slot.actual !== actualValue) { slot.actual = actualValue; changed = true; }
                if (!slot.activityLog || typeof slot.activityLog !== 'object') slot.activityLog = { title: '', details: '', subActivities: [], titleBandOn: false, actualGridUnits: [], actualExtraGridUnits: [], actualOverride: false };
                if (slot.activityLog.details !== detailsValue) { slot.activityLog.details = detailsValue; changed = true; }
                const normalizedActivities = hasActivities ? this.normalizeActivitiesArray(row.activities) : [];
                const normalizedPlanActivities = hasPlanActivities ? this.normalizePlanActivitiesArray(row.planActivities) : [];
                if (slot.planTitle !== planTitleValue) { slot.planTitle = planTitleValue; changed = true; }
                const appliedPlanBand = planTitleBand && Boolean(planTitleValue);
                if (slot.planTitleBandOn !== appliedPlanBand) { slot.planTitleBandOn = appliedPlanBand; changed = true; }
                const appliedTitleBand = actualTitleBand && normalizedActivities.length > 0;
                if (slot.activityLog.titleBandOn !== appliedTitleBand) { slot.activityLog.titleBandOn = appliedTitleBand; changed = true; }
                slot.activityLog.actualGridUnits = actualGridUnits.slice();
                slot.activityLog.actualExtraGridUnits = actualExtraGridUnits.slice();
                if (hasActivities) {
                    const currentActivities = Array.isArray(slot.activityLog.subActivities) ? slot.activityLog.subActivities : [];
                    const desiredSignature = JSON.stringify(normalizedActivities);
                    const currentSignature = JSON.stringify(this.normalizeActivitiesArray(currentActivities));
                    if (desiredSignature !== currentSignature) {
                        slot.activityLog.subActivities = normalizedActivities.map(item => ({ ...item }));
                        changed = true;
                    }
                }
                if (hasPlanActivities) {
                    const currentPlan = Array.isArray(slot.planActivities) ? slot.planActivities : [];
                    const desiredPlanSig = JSON.stringify(normalizedPlanActivities);
                    const currentPlanSig = JSON.stringify(this.normalizePlanActivitiesArray(currentPlan));
                    if (desiredPlanSig !== currentPlanSig) {
                        slot.planActivities = normalizedPlanActivities.map(item => ({ ...item }));
                        changed = true;
                    }
                }
            });
        } catch (_) {}

        const currentMergedSignature = JSON.stringify(Object.fromEntries(this.mergedFields));
        const nextMergedSignature = JSON.stringify(Object.fromEntries(nextMergedFields));
        if (currentMergedSignature !== nextMergedSignature) {
            this.mergedFields = nextMergedFields;
            changed = true;
        } else {
            this.mergedFields = nextMergedFields;
        }
        return changed;
    }
    loadOrCreateDeviceId() {
        try {
            const rnd = crypto && crypto.getRandomValues ? crypto.getRandomValues(new Uint8Array(16)) : Array.from({length:16},()=>Math.floor(Math.random()*256));
            rnd[6] = (rnd[6] & 0x0f) | 0x40;
            rnd[8] = (rnd[8] & 0x3f) | 0x80;
            const hex = Array.from(rnd).map(b=>b.toString(16).padStart(2,'0')).join('');
            return `${hex.substring(0,8)}-${hex.substring(8,12)}-${hex.substring(12,16)}-${hex.substring(16,20)}-${hex.substring(20)}`;
        } catch(_) { return 'device-anon'; }
    }
    loadSupabaseConfig() {
        try {
            const url = (typeof window !== 'undefined' && window.SUPABASE_URL) || null;
            const anon = (typeof window !== 'undefined' && window.SUPABASE_ANON_KEY) || null;
            if (url && anon) return { url: String(url), anonKey: String(anon) };
        } catch(_) {}
        return null;
    }
    initSupabaseIntegration() {
        try { if (!(window && window.supabase)) return; } catch(_) { return; }
        const cfg = this.loadSupabaseConfig();
        if (!cfg) return;
        try {
            this.supabase = window.supabase.createClient(cfg.url, cfg.anonKey);
            this.supabaseConfigured = true;
            this.handleSupabaseIdentityChange(true);
            this.initSupabaseAuthHandlers();
        } catch(e) {
            console.warn('[supabase] init failed:', e);
            this.supabase = null;
            this.supabaseConfigured = false;
        }
    }
    clearSupabaseChannels() {
        if (!this.supabase || !this.supabaseChannels) return;
        try {
            if (this.supabaseChannels.timesheet) {
                this.supabase.removeChannel(this.supabaseChannels.timesheet);
            }
        } catch (_) {}
        try {
            if (this.supabaseChannels.planned) {
                this.supabase.removeChannel(this.supabaseChannels.planned);
            }
        } catch (_) {}
        try {
            if (this.supabaseChannels.routines) {
                this.supabase.removeChannel(this.supabaseChannels.routines);
            }
        } catch (_) {}
        this.supabaseChannels = { timesheet: null, planned: null, routines: null };
    }
    resubscribeSupabaseRealtime() {
        if (!this.supabaseConfigured || !this.supabase) return;
        const identity = this.getSupabaseIdentity();
        if (!identity) return;
        this.clearSupabaseChannels();

        const timesheetFilter = `user_id=eq.${identity},day=eq.${this.currentDate}`;
        const timesheetChannelKey = `timesheet_days:${identity}:${this.currentDate}`;
        this.supabaseChannels.timesheet = this.supabase
            .channel(timesheetChannelKey)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'timesheet_days', filter: timesheetFilter }, (payload) => {
                try {
                    const row = payload.new || payload.old;
                    if (!row || row.day !== this.currentDate) return;
                    if (this.isTimesheetClearPending(row.day)) return;
                    const changed = this.applySlotsJson(row.slots || {});
                    if (changed) {
                        this.renderTimeEntries();
                        this.calculateTotals();
                        this.autoSave();
                    }
                } catch(e) { console.warn('[supabase] apply change failed', e); }
            })
            .subscribe();

        const plannedFilter = `user_id=eq.${identity},day=eq.${this.PLANNED_SENTINEL_DAY}`;
        const plannedChannelKey = `timesheet_days:${identity}:planned`; // 센티널 행 전용 채널 키
        this.supabaseChannels.planned = this.supabase
            .channel(plannedChannelKey)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'timesheet_days', filter: plannedFilter }, (payload) => {
                try {
                    const row = payload.new || payload.old;
                    if (!row || row.day !== this.PLANNED_SENTINEL_DAY) return;
                    const changed = this.applyPlannedCatalogFromRow ? this.applyPlannedCatalogFromRow(row) : false;
                    if (changed) {
                        this.renderPlannedActivityDropdown && this.renderPlannedActivityDropdown();
                    }
                } catch (e) { console.warn('[supabase] planned catalog change failed', e); }
            })
            .subscribe();

        const routinesFilter = `user_id=eq.${identity},day=eq.${this.ROUTINE_SENTINEL_DAY}`;
        const routinesChannelKey = `timesheet_days:${identity}:routines`;
        this.supabaseChannels.routines = this.supabase
            .channel(routinesChannelKey)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'timesheet_days', filter: routinesFilter }, (payload) => {
                try {
                    const row = payload.new || payload.old;
                    if (!row || row.day !== this.ROUTINE_SENTINEL_DAY) return;
                    const changed = this.applyRoutinesFromRow ? this.applyRoutinesFromRow(row) : false;
                    if (changed) {
                        const applied = this.applyRoutinesToDate
                            ? this.applyRoutinesToDate(this.currentDate, { reason: 'routines-realtime' })
                            : false;
                        if (applied) {
                            this.renderTimeEntries();
                            this.calculateTotals();
                            this.autoSave();
                        }
                        if (this.inlinePlanDropdown) {
                            this.renderInlinePlanDropdownOptions();
                        }
                    }
                } catch (e) { console.warn('[supabase] routines change failed', e); }
            })
            .subscribe();
    }
    async fetchFromSupabaseForDate(date) {
        if (!this.supabaseConfigured || !this.supabase) return false;
        const identity = this.getSupabaseIdentity();
        if (!identity) return false;
        const requestedDate = String(date || '');
        // If a clear/reset happened right before a refresh, remote data can be stale.
        // In that case, delete the remote row first and skip applying fetched slots.
        if (this.isTimesheetClearPending(requestedDate)) {
            const deleted = await this.deleteFromSupabaseForDate(requestedDate);
            if (deleted) {
                this.clearTimesheetClearPending(requestedDate);
            }
            return true;
        }
        try {
            const { data, error } = await this.supabase
                .from('timesheet_days')
                .select('slots')
                .eq('user_id', identity)
                .eq('day', requestedDate)
                .maybeSingle();
            if (error && error.code !== 'PGRST116') throw error; // PGRST116: No rows
            if (requestedDate !== this.currentDate) return false;
            if (this.isTimesheetClearPending(requestedDate)) return true;
            let changed = false;
            if (data && data.slots) {
                changed = this.applySlotsJson(data.slots);
            }
            const routineApplied = (requestedDate === this.currentDate && this.applyRoutinesToDate)
                ? this.applyRoutinesToDate(requestedDate, { reason: 'supabase-fetch' })
                : false;
            if (changed || routineApplied) {
                this.renderTimeEntries();
                this.calculateTotals();
                this.autoSave();
            }
            return true;
        } catch(e) {
            console.warn('[supabase] fetch failed:', e);
            return false;
        }
    }
    scheduleSupabaseSave() {
        if (!this.supabaseConfigured || !this.supabase) return;
        if (!navigator.onLine) return;
        const identity = this.getSupabaseIdentity();
        if (!identity) return;
        clearTimeout(this._sbSaveTimer);
        this._sbSaveTimer = setTimeout(() => { try { this.saveToSupabase && this.saveToSupabase(); } catch(_) {} }, 500);
    }
    scheduleSupabaseRetry() {
        clearTimeout(this._sbRetryTimer);
        if (!this._hasPendingRemoteSync || !navigator.onLine) return;
        const nextDelay = Number.isFinite(this._sbRetryDelayMs) ? this._sbRetryDelayMs : 2000;
        this._sbRetryTimer = setTimeout(() => {
            this.scheduleSupabaseSave && this.scheduleSupabaseSave();
        }, nextDelay);
        this._sbRetryDelayMs = Math.min(nextDelay * 2, 30000);
    }
    getTimesheetClearPendingKey(date) {
        return String(date || '');
    }
    isTimesheetClearPending(date) {
        const key = this.getTimesheetClearPendingKey(date);
        return key ? this._timesheetClearPending.has(key) : false;
    }
    markTimesheetClearPending(date) {
        const key = this.getTimesheetClearPendingKey(date);
        if (key) this._timesheetClearPending.add(key);
    }
    clearTimesheetClearPending(date) {
        const key = this.getTimesheetClearPendingKey(date);
        if (key) this._timesheetClearPending.delete(key);
    }
    async deleteFromSupabaseForDate(date) {
        if (!this.supabaseConfigured || !this.supabase) return false;
        const identity = this.getSupabaseIdentity();
        if (!identity) return false;
        try {
            const { error } = await this.supabase
                .from('timesheet_days')
                .delete()
                .eq('user_id', identity)
                .eq('day', date);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('[supabase] delete failed:', e);
            return false;
        }
    }
    async saveToSupabase() {
        if (!this.supabaseConfigured || !this.supabase) return false;
        if (!navigator.onLine) {
            this._hasPendingRemoteSync = true;
            this.setSyncStatus('warn', '오프라인 (온라인 시 동기화)');
            return false;
        }
        const identity = this.getSupabaseIdentity();
        if (!identity) {
            this._hasPendingRemoteSync = true;
            this.setSyncStatus('warn', '로그인 후 동기화됩니다');
            return false;
        }
        try {
            const slotsJson = this.buildSlotsJson();
            if (Object.keys(slotsJson).length === 0) {
                const deleted = await this.deleteFromSupabaseForDate(this.currentDate);
                if (deleted) {
                    this.clearTimesheetClearPending(this.currentDate);
                    this._hasPendingRemoteSync = false;
                    this._sbRetryDelayMs = 2000;
                    clearTimeout(this._sbRetryTimer);
                    this.setSyncStatus('success', '동기화 완료');
                }
                return deleted;
            }
            const payload = {
                user_id: identity,
                day: this.currentDate,
                slots: slotsJson,
                updated_at: new Date().toISOString(),
            };
            const { error } = await this.supabase
                .from('timesheet_days')
                .upsert([payload], { onConflict: 'user_id,day' });
            if (error) throw error;
            this._hasPendingRemoteSync = false;
            this._sbRetryDelayMs = 2000;
            clearTimeout(this._sbRetryTimer);
            this.setSyncStatus('success', `동기화 완료 ${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`);
            return true;
        } catch(e) {
            console.warn('[supabase] upsert failed:', e);
            this._hasPendingRemoteSync = true;
            this.setSyncStatus('error', '동기화 실패 (자동 재시도)');
            this.scheduleSupabaseRetry && this.scheduleSupabaseRetry();
            return false;
        }
    }
    async persistSnapshotForDate(date, snapshotSlots, snapshotMergedObj) {
        if (!this.supabaseConfigured || !this.supabase) return false;
        const identity = this.getSupabaseIdentity();
        if (!identity) return false;
        const day = String(date || '').trim();
        if (!day) return false;

        const contextSlots = Array.isArray(snapshotSlots) ? snapshotSlots : [];
        const mergedMap = new Map(Object.entries(snapshotMergedObj || {}));

        try {
            const slotsJson = this.buildSlotsJsonForContext(contextSlots, mergedMap);
            if (Object.keys(slotsJson).length === 0) {
                const { error } = await this.supabase
                    .from('timesheet_days')
                    .delete()
                    .eq('user_id', identity)
                    .eq('day', day);
                if (error) throw error;
                this.clearTimesheetClearPending(day);
                return true;
            }
            const payload = {
                user_id: identity,
                day,
                slots: slotsJson,
                updated_at: new Date().toISOString(),
            };
            const { error } = await this.supabase
                .from('timesheet_days')
                .upsert([payload], { onConflict: 'user_id,day' });
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('[supabase] snapshot upsert failed:', e);
            return false;
        }
    }
    applyPlannedCatalogFromRow(row) {
        if (!row || typeof row !== 'object') return false;
        const slots = row.slots || {};
        return this.applyPlannedCatalogJson(slots);
    }
    getLocalPlannedLabels() {
        const labels = [];
        (this.plannedActivities || []).forEach((item) => {
            if (!item || item.source === 'notion') return;
            const label = this.normalizeActivityText(item.label || '');
            if (!label) return;
            if (!labels.includes(label)) labels.push(label);
        });
        return labels;
    }
    computePlannedSignature(labels) {
        if (!Array.isArray(labels)) return '';
        const normalized = labels
            .map(label => this.normalizeActivityText(label))
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));
        return JSON.stringify(normalized);
    }
    applyPlannedCatalogJson(slotsJson) {
        if (!slotsJson || typeof slotsJson !== 'object') return false;
        const catalog = (slotsJson && typeof slotsJson.catalog === 'object') ? slotsJson.catalog : null;
        const locals = Array.isArray(catalog && catalog.locals) ? catalog.locals : [];
        const normalizedLocals = locals
            .map(label => this.normalizeActivityText(label))
            .filter(Boolean);
        const remoteSignature = this.computePlannedSignature(normalizedLocals);
        if (remoteSignature && remoteSignature === this._lastSupabasePlannedSignature) {
            return false;
        }

        const before = JSON.stringify(this.plannedActivities || []);
        const merged = [];
        const seen = new Set();

        normalizedLocals.forEach((label) => {
            if (seen.has(label)) return;
            seen.add(label);
            merged.push({ label, source: 'local', priorityRank: null, recommendedSeconds: null });
        });

        (this.plannedActivities || []).forEach((item) => {
            if (!item) return;
            const label = this.normalizeActivityText(item.label || '');
            if (!label) return;
            if (item.source === 'notion') {
                merged.push({
                    label,
                    source: 'notion',
                    priorityRank: Number.isFinite(item.priorityRank) ? Number(item.priorityRank) : null,
                    recommendedSeconds: Number.isFinite(item.recommendedSeconds) ? Math.max(0, Number(item.recommendedSeconds)) : null
                });
                seen.add(label);
            }
        });

        this.plannedActivities = merged;
        this.dedupeAndSortPlannedActivities();
        const after = JSON.stringify(this.plannedActivities || []);
        const selectionChanged = this.pruneSelectedActivitiesByAvailability ? this.pruneSelectedActivitiesByAvailability() : false;
        const changed = before !== after || selectionChanged;
        this.savePlannedActivities({ skipSupabase: true });
        if (remoteSignature) {
            this._lastSupabasePlannedSignature = remoteSignature;
        }
        return changed;
    }
    async fetchPlannedCatalogFromSupabase() {
        if (!this.supabaseConfigured || !this.supabase) return false;
        const identity = this.getSupabaseIdentity();
        if (!identity) return false;
        try {
            const { data, error } = await this.supabase
                .from('timesheet_days')
                .select('slots')
                .eq('user_id', identity)
                .eq('day', this.PLANNED_SENTINEL_DAY)
                .maybeSingle();
            if (error && error.code !== 'PGRST116') throw error;
            if (data && data.slots) {
                const changed = this.applyPlannedCatalogJson(data.slots);
                if (this.renderPlannedActivityDropdown) {
                    this.renderPlannedActivityDropdown();
                }
                return true;
            }
            // 센티널 행이 없는데 로컬 데이터가 있으면 서버로 업로드 스케줄링
            const localLabels = this.getLocalPlannedLabels();
            if (localLabels.length > 0) {
                this.scheduleSupabasePlannedSave(true);
            }
            return true;
        } catch (e) {
            console.warn('[supabase] planned catalog fetch failed:', e);
            return false;
        }
    }
    scheduleSupabasePlannedSave(force = false) {
        if (!this.supabaseConfigured || !this.supabase) return;
        const identity = this.getSupabaseIdentity();
        if (!identity) return;
        clearTimeout(this._plannedSaveTimer);
        const executor = () => {
            this._plannedSaveTimer = null;
            try {
                const promise = this.savePlannedCatalogToSupabase(force);
                if (promise && typeof promise.catch === 'function') {
                    promise.catch(() => {});
                }
            } catch (_) {}
        };
        if (force) {
            executor();
        } else {
            this._plannedSaveTimer = setTimeout(executor, 500);
        }
    }
    async savePlannedCatalogToSupabase(force = false) {
        if (!this.supabaseConfigured || !this.supabase) return false;
        const identity = this.getSupabaseIdentity();
        if (!identity) return false;
        const locals = this.getLocalPlannedLabels();
        const signature = this.computePlannedSignature(locals);
        if (!force && signature && signature === this._lastSupabasePlannedSignature) {
            return true;
        }
        try {
            const catalog = {
                version: 1,
                locals,
                updatedAt: new Date().toISOString(),
                updatedBy: this.deviceId || null,
            };
            const payload = {
                user_id: identity,
                day: this.PLANNED_SENTINEL_DAY,
                slots: { catalog },
                updated_at: new Date().toISOString(),
            };
            const { error } = await this.supabase
                .from('timesheet_days')
                .upsert([payload], { onConflict: 'user_id,day' });
            if (error) throw error;
            this._lastSupabasePlannedSignature = signature;
            return true;
        } catch (e) {
            console.warn('[supabase] planned catalog upsert failed:', e);
            return false;
        }
    }

    // ===== Routines (planned auto-fill) =====
    normalizeRoutinePattern(pattern) {
        const p = String(pattern || '').trim().toLowerCase();
        if (p === 'weekday' || p === 'weekdays') return 'weekday';
        if (p === 'weekend' || p === 'weekends') return 'weekend';
        return 'daily';
    }
    getRoutinePatternLabel(pattern) {
        const p = this.normalizeRoutinePattern(pattern);
        if (p === 'weekday') return '평일';
        if (p === 'weekend') return '주말';
        return '매일';
    }
    createRoutineId() {
        try {
            if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                return crypto.randomUUID();
            }
        } catch (_) {}
        return `routine_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    }
    normalizeRoutineItems(items) {
        if (!Array.isArray(items)) return [];
        const seen = new Set();
        const out = [];
        items.forEach((raw) => {
            if (!raw || typeof raw !== 'object') return;
            const id = String(raw.id || '').trim() || this.createRoutineId();
            if (seen.has(id)) return;
            seen.add(id);
            const label = this.normalizeActivityText
                ? this.normalizeActivityText(raw.label || '')
                : String(raw.label || '').trim();
            if (!label) return;
            const startHour = Number.isFinite(raw.startHour) ? (Number(raw.startHour) % 24) : this.labelToHour(raw.startHour);
            const durationHours = Number.isFinite(raw.durationHours)
                ? Math.max(1, Math.min(24, Math.floor(Number(raw.durationHours))))
                : 1;
            const pattern = this.normalizeRoutinePattern(raw.pattern);
            const stoppedAtMs = Number.isFinite(raw.stoppedAtMs) ? Math.max(0, Math.floor(Number(raw.stoppedAtMs))) : null;
            const passDates = Array.isArray(raw.passDates)
                ? raw.passDates.map(d => String(d || '').trim()).filter(Boolean)
                : [];
            const uniquePasses = Array.from(new Set(passDates)).sort((a, b) => a.localeCompare(b));
            out.push({
                id,
                label,
                startHour: (startHour + 24) % 24,
                durationHours,
                pattern,
                passDates: uniquePasses,
                stoppedAtMs,
                createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : null,
                createdBy: typeof raw.createdBy === 'string' ? raw.createdBy : null,
                updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
                updatedBy: typeof raw.updatedBy === 'string' ? raw.updatedBy : null,
            });
        });
        return out;
    }
    computeRoutineSignature(items) {
        try {
            const normalized = this.normalizeRoutineItems(items).map((r) => ({
                id: r.id,
                label: r.label,
                startHour: r.startHour,
                durationHours: r.durationHours,
                pattern: r.pattern,
                passDates: Array.isArray(r.passDates) ? Array.from(new Set(r.passDates)).sort() : [],
                stoppedAtMs: Number.isFinite(r.stoppedAtMs) ? r.stoppedAtMs : null,
            }));
            normalized.sort((a, b) => {
                const aKey = `${a.label}|${a.startHour}|${a.durationHours}|${a.id}`;
                const bKey = `${b.label}|${b.startHour}|${b.durationHours}|${b.id}`;
                return aKey.localeCompare(bKey);
            });
            return JSON.stringify(normalized);
        } catch (_) {
            return '';
        }
    }
    applyRoutinesJson(slotsJson) {
        const routines = (slotsJson && typeof slotsJson === 'object' && slotsJson.routines && typeof slotsJson.routines === 'object')
            ? slotsJson.routines
            : null;
        const items = routines && Array.isArray(routines.items) ? routines.items : [];
        const next = this.normalizeRoutineItems(items);
        const before = JSON.stringify(this.routines || []);
        const after = JSON.stringify(next);
        const changed = before !== after;
        this.routines = next;
        this.routinesLoaded = true;
        const signature = this.computeRoutineSignature(next);
        if (signature) {
            this._lastSupabaseRoutineSignature = signature;
        }
        return changed;
    }
    applyRoutinesFromRow(row) {
        if (!row || typeof row !== 'object') return false;
        const slots = row.slots || {};
        return this.applyRoutinesJson(slots);
    }
    async fetchRoutinesFromSupabase() {
        if (!this.supabaseConfigured || !this.supabase) return false;
        const identity = this.getSupabaseIdentity();
        if (!identity) return false;
        try {
            const { data, error } = await this.supabase
                .from('timesheet_days')
                .select('slots')
                .eq('user_id', identity)
                .eq('day', this.ROUTINE_SENTINEL_DAY)
                .maybeSingle();
            if (error && error.code !== 'PGRST116') throw error;
            if (data && data.slots) {
                const changed = this.applyRoutinesJson(data.slots);
                if (changed) {
                    const applied = this.applyRoutinesToDate ? this.applyRoutinesToDate(this.currentDate, { reason: 'routines-fetch' }) : false;
                    if (applied) {
                        this.renderTimeEntries();
                        this.calculateTotals();
                        this.autoSave();
                    }
                } else {
                    this.routinesLoaded = true;
                }
                return true;
            }
            this.routinesLoaded = true;
            return true;
        } catch (e) {
            console.warn('[supabase] routines fetch failed:', e);
            return false;
        }
    }
    scheduleSupabaseRoutineSave(force = false) {
        if (!this.supabaseConfigured || !this.supabase) return;
        const identity = this.getSupabaseIdentity();
        if (!identity) return;
        clearTimeout(this._routineSaveTimer);
        const executor = () => {
            this._routineSaveTimer = null;
            try {
                const promise = this.saveRoutinesToSupabase(force);
                if (promise && typeof promise.catch === 'function') {
                    promise.catch(() => {});
                }
            } catch (_) {}
        };
        if (force) {
            executor();
        } else {
            this._routineSaveTimer = setTimeout(executor, 500);
        }
    }
    async saveRoutinesToSupabase(force = false) {
        if (!this.supabaseConfigured || !this.supabase) return false;
        const identity = this.getSupabaseIdentity();
        if (!identity) return false;
        const items = this.normalizeRoutineItems(this.routines || []);
        const signature = this.computeRoutineSignature(items);
        if (!force && signature && signature === this._lastSupabaseRoutineSignature) {
            return true;
        }
        try {
            const routines = {
                version: 1,
                items,
                updatedAt: new Date().toISOString(),
                updatedBy: this.deviceId || null,
            };
            const payload = {
                user_id: identity,
                day: this.ROUTINE_SENTINEL_DAY,
                slots: { routines },
                updated_at: new Date().toISOString(),
            };
            const { error } = await this.supabase
                .from('timesheet_days')
                .upsert([payload], { onConflict: 'user_id,day' });
            if (error) throw error;
            this._lastSupabaseRoutineSignature = signature;
            return true;
        } catch (e) {
            console.warn('[supabase] routines upsert failed:', e);
            return false;
        }
    }
    getLocalDateParts(date) {
        const dateCore = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerDateCore)
            ? globalThis.TimeTrackerDateCore
            : null;
        if (dateCore && typeof dateCore.parseLocalDateParts === 'function') {
            return dateCore.parseLocalDateParts(date);
        }
        const s = String(date || '').trim();
        const [yStr, mStr, dStr] = s.split('-');
        const year = parseInt(yStr, 10);
        const month = parseInt(mStr, 10);
        const day = parseInt(dStr, 10);
        if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
        return { year, month, day };
    }
    getDateValue(date) {
        const dateCore = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerDateCore)
            ? globalThis.TimeTrackerDateCore
            : null;
        if (dateCore && typeof dateCore.getDateValue === 'function') {
            return dateCore.getDateValue(date);
        }
        const parts = this.getLocalDateParts(date);
        if (!parts) return null;
        const ms = new Date(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0).getTime();
        return Number.isFinite(ms) ? ms : null;
    }
    compareDateStrings(a, b) {
        const dateCore = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerDateCore)
            ? globalThis.TimeTrackerDateCore
            : null;
        if (dateCore && typeof dateCore.compareDateStrings === 'function') {
            return dateCore.compareDateStrings(a, b);
        }
        const av = this.getDateValue(a);
        const bv = this.getDateValue(b);
        if (!Number.isFinite(av) || !Number.isFinite(bv)) return 0;
        if (av < bv) return -1;
        if (av > bv) return 1;
        return 0;
    }
    formatDateFromMsLocal(ms) {
        const dateCore = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerDateCore)
            ? globalThis.TimeTrackerDateCore
            : null;
        if (dateCore && typeof dateCore.formatDateFromMsLocal === 'function') {
            return dateCore.formatDateFromMsLocal(ms);
        }
        if (!Number.isFinite(ms)) return '';
        const dt = new Date(ms);
        if (isNaN(dt.getTime())) return '';
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const d = String(dt.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    getTodayLocalDateString() {
        const dateCore = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerDateCore)
            ? globalThis.TimeTrackerDateCore
            : null;
        if (dateCore && typeof dateCore.getTodayLocalDateString === 'function') {
            return dateCore.getTodayLocalDateString();
        }
        return this.formatDateFromMsLocal(Date.now());
    }
    getLocalSlotStartMs(date, hour) {
        const dateCore = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerDateCore)
            ? globalThis.TimeTrackerDateCore
            : null;
        if (dateCore && typeof dateCore.getLocalSlotStartMs === 'function') {
            return dateCore.getLocalSlotStartMs(date, hour);
        }
        const parts = this.getLocalDateParts(date);
        if (!parts) return null;
        const h = Number.isFinite(hour) ? Math.floor(Number(hour)) : 0;
        const dt = new Date(parts.year, parts.month - 1, parts.day, h, 0, 0, 0);
        const ms = dt.getTime();
        return Number.isFinite(ms) ? ms : null;
    }
    getDayOfWeek(date) {
        const dateCore = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerDateCore)
            ? globalThis.TimeTrackerDateCore
            : null;
        if (dateCore && typeof dateCore.getDayOfWeek === 'function') {
            return dateCore.getDayOfWeek(date);
        }
        const parts = this.getLocalDateParts(date);
        if (!parts) return 0;
        return new Date(parts.year, parts.month - 1, parts.day).getDay();
    }
    withTemporarySlots(timeSlots, mergedFieldsMap, fn) {
        const originalSlots = this.timeSlots;
        const originalMerged = this.mergedFields;
        this.timeSlots = timeSlots;
        this.mergedFields = mergedFieldsMap;
        try {
            return fn();
        } finally {
            this.timeSlots = originalSlots;
            this.mergedFields = originalMerged;
        }
    }
    applySlotsJsonToContext(slotsJson, timeSlots, mergedFieldsMap) {
        return this.withTemporarySlots(timeSlots, mergedFieldsMap, () => this.applySlotsJson(slotsJson));
    }
    buildSlotsJsonForContext(timeSlots, mergedFieldsMap) {
        return this.withTemporarySlots(timeSlots, mergedFieldsMap, () => this.buildSlotsJson());
    }
    findMergeKeyInMap(mergedFieldsMap, type, index) {
        if (!mergedFieldsMap || !Number.isInteger(index)) return null;
        const entries = mergedFieldsMap instanceof Map ? mergedFieldsMap : new Map(Object.entries(mergedFieldsMap));
        for (let [key] of entries) {
            if (!key || !key.startsWith(`${type}-`)) continue;
            const [, startStr, endStr] = key.split('-');
            const start = parseInt(startStr, 10);
            const end = parseInt(endStr, 10);
            if (index >= start && index <= end) {
                return key;
            }
        }
        return null;
    }
    routineIncludesHour(routine, hour) {
        if (!routine || typeof routine !== 'object') return false;
        const h = (Number(hour) + 24) % 24;
        const start = (Number(routine.startHour) + 24) % 24;
        const dur = Number.isFinite(routine.durationHours) ? Math.max(1, Math.min(24, Math.floor(Number(routine.durationHours)))) : 1;
        for (let i = 0; i < dur; i++) {
            const hh = (start + i) % 24;
            if (hh === h) return true;
        }
        return false;
    }
    findRoutineForLabelAtIndex(label, index, date = null) {
        const normalizedLabel = this.normalizeActivityText ? this.normalizeActivityText(label) : String(label || '').trim();
        if (!normalizedLabel) return null;
        if (!Number.isInteger(index) || index < 0 || index >= this.timeSlots.length) return null;
        const hour = this.labelToHour(this.timeSlots[index] && this.timeSlots[index].time);
        const targetDate = date || this.currentDate;
        return (this.routines || []).find((r) => {
            if (!r || r.label !== normalizedLabel) return false;
            if (!this.routineIncludesHour(r, hour)) return false;
            if (this.isRoutineStoppedForDate(r, targetDate)) return false;
            return !this.isRoutineStoppedAtSlot(r, targetDate, hour);
        }) || null;
    }
    findActiveRoutineForLabelAtIndex(label, index, date = null) {
        const targetDate = date || this.currentDate;
        const routine = this.findRoutineForLabelAtIndex(label, index, targetDate);
        if (!routine) return null;
        if (!this.isRoutineActiveOnDate(routine, targetDate)) return null;
        return routine;
    }
    findRoutineForLabelAndWindow(label, startHour, durationHours) {
        const normalizedLabel = this.normalizeActivityText ? this.normalizeActivityText(label) : String(label || '').trim();
        if (!normalizedLabel) return null;
        const s = (Number(startHour) + 24) % 24;
        const d = Number.isFinite(durationHours) ? Math.max(1, Math.min(24, Math.floor(Number(durationHours)))) : 1;
        return (this.routines || []).find((r) => {
            if (!r || r.label !== normalizedLabel) return false;
            const rs = (Number(r.startHour) + 24) % 24;
            const rd = Number.isFinite(r.durationHours) ? Math.max(1, Math.min(24, Math.floor(Number(r.durationHours)))) : 1;
            return rs === s && rd === d;
        }) || null;
    }
    isRoutineActiveOnDate(routine, date) {
        if (!routine || typeof routine !== 'object') return false;
        const passes = Array.isArray(routine.passDates) ? routine.passDates : [];
        if (passes.includes(date)) return false;
        const dow = this.getDayOfWeek(date);
        const pattern = this.normalizeRoutinePattern(routine.pattern);
        if (pattern === 'weekday') return dow >= 1 && dow <= 5;
        if (pattern === 'weekend') return dow === 0 || dow === 6;
        return true;
    }
    isRoutineStoppedAtSlot(routine, date, hour) {
        if (!Number.isFinite(routine && routine.stoppedAtMs)) return false;
        const slotStartMs = this.getLocalSlotStartMs(date, hour);
        return slotStartMs != null && slotStartMs >= routine.stoppedAtMs;
    }
    isRoutineStoppedForDate(routine, date) {
        if (!Number.isFinite(routine && routine.stoppedAtMs)) return false;
        const stopDate = this.formatDateFromMsLocal(routine.stoppedAtMs);
        if (!stopDate) return false;
        return this.compareDateStrings(date, stopDate) >= 0;
    }
    isRoutineActiveAtSlot(routine, date, hour) {
        if (this.isRoutineStoppedForDate(routine, date)) return false;
        if (!this.isRoutineActiveOnDate(routine, date)) return false;
        return !this.isRoutineStoppedAtSlot(routine, date, hour);
    }
    isRoutinePresentOnDate(routine) {
        if (!routine || typeof routine !== 'object') return false;
        const label = this.normalizeActivityText
            ? this.normalizeActivityText(routine.label || '')
            : String(routine.label || '').trim();
        if (!label) return false;
        const startHour = (Number(routine.startHour) + 24) % 24;
        const dur = Number.isFinite(routine.durationHours) ? Math.max(1, Math.min(24, Math.floor(Number(routine.durationHours)))) : 1;
        for (let i = 0; i < dur; i++) {
            const hour = (startHour + i) % 24;
            const labelForHour = this.hourToLabel(hour);
            const index = this.timeSlots.findIndex(s => s && String(s.time) === labelForHour);
            if (index < 0) continue;
            const plannedValue = this.getPlannedValueForIndex(index);
            if (plannedValue && plannedValue === label) return true;
            const slot = this.timeSlots[index];
            const titleValue = this.normalizeActivityText
                ? this.normalizeActivityText((slot && slot.planTitle) || '')
                : String((slot && slot.planTitle) || '').trim();
            if (titleValue && titleValue === label) return true;
        }
        return false;
    }
    getRoutineForPlannedIndex(index, date = null) {
        if (!Number.isInteger(index) || index < 0 || index >= this.timeSlots.length) return null;
        const plannedLabel = this.getPlannedValueForIndex(index);
        if (!plannedLabel) return null;
        const targetDate = date || this.currentDate;
        return this.findActiveRoutineForLabelAtIndex(plannedLabel, index, targetDate);
    }
    isPlanSlotEmptyForRoutine(index) {
        if (!Number.isInteger(index) || index < 0 || index >= this.timeSlots.length) return false;
        const mk = this.findMergeKey ? this.findMergeKey('planned', index) : null;
        if (mk) return false;
        const slot = this.timeSlots[index];
        if (!slot) return false;
        const planned = this.normalizeActivityText ? this.normalizeActivityText(slot.planned || '') : String(slot.planned || '').trim();
        const planTitle = this.normalizeActivityText ? this.normalizeActivityText(slot.planTitle || '') : String(slot.planTitle || '').trim();
        const planActivities = this.normalizePlanActivitiesArray(slot.planActivities);
        return !planned && !planTitle && planActivities.length === 0;
    }
    isPlanSlotEmptyForInline(index) {
        if (!Number.isInteger(index) || index < 0 || index >= this.timeSlots.length) return false;
        const planned = this.getPlannedValueForIndex(index);
        const slot = this.timeSlots[index];
        const planTitle = this.normalizeActivityText
            ? this.normalizeActivityText((slot && slot.planTitle) || '')
            : String((slot && slot.planTitle) || '').trim();
        const planActivities = this.normalizePlanActivitiesArray(slot && slot.planActivities);
        return !planned && !planTitle && planActivities.length === 0;
    }
    applyRoutinesToDate(date, options = {}) {
        if (!this.routinesLoaded) return false;
        const d = String(date || '').trim();
        if (!d) return false;
        const routines = Array.isArray(this.routines) ? this.routines : [];
        if (routines.length === 0) return false;

        let changed = false;

        routines.forEach((routine) => {
            if (this.isRoutineStoppedForDate(routine, d)) return;
            if (!this.isRoutineActiveOnDate(routine, d)) return;
            const label = String(routine.label || '').trim();
            if (!label) return;
            const startHour = (Number(routine.startHour) + 24) % 24;
            const dur = Number.isFinite(routine.durationHours) ? Math.max(1, Math.min(24, Math.floor(Number(routine.durationHours)))) : 1;
            for (let i = 0; i < dur; i++) {
                const hour = (startHour + i) % 24;
                const slotStartMs = this.getLocalSlotStartMs(d, hour);
                if (slotStartMs != null && Number.isFinite(routine.stoppedAtMs) && slotStartMs >= routine.stoppedAtMs) {
                    continue;
                }
                const labelForHour = this.hourToLabel(hour);
                const index = this.timeSlots.findIndex(s => s && String(s.time) === labelForHour);
                if (index < 0) continue;
                if (!this.isPlanSlotEmptyForRoutine(index)) continue;
                const slot = this.timeSlots[index];
                slot.planned = label;
                slot.planTitle = label;
                slot.planActivities = [];
                slot.planTitleBandOn = false;
                changed = true;
            }
        });

        if (changed && options && options.reason === 'routines-realtime') {
            // no-op: caller handles render/save
        }
        return changed;
    }
    updateRoutineItem(id, patch = {}) {
        const list = Array.isArray(this.routines) ? this.routines : [];
        const idx = list.findIndex(r => r && r.id === id);
        if (idx < 0) return false;
        const before = JSON.stringify(list[idx]);
        const next = { ...list[idx], ...patch };
        next.updatedAt = new Date().toISOString();
        next.updatedBy = this.deviceId || null;
        list[idx] = next;
        this.routines = list;
        return JSON.stringify(next) !== before;
    }
    upsertRoutineByWindow(label, startHour, durationHours, patch = {}) {
        const normalizedLabel = this.normalizeActivityText ? this.normalizeActivityText(label) : String(label || '').trim();
        if (!normalizedLabel) return null;
        const s = (Number(startHour) + 24) % 24;
        const d = Number.isFinite(durationHours) ? Math.max(1, Math.min(24, Math.floor(Number(durationHours)))) : 1;
        const existing = this.findRoutineForLabelAndWindow(normalizedLabel, s, d);
        if (existing) {
            const updated = this.updateRoutineItem(existing.id, { ...patch, label: normalizedLabel, startHour: s, durationHours: d });
            return updated ? this.findRoutineForLabelAndWindow(normalizedLabel, s, d) : existing;
        }
        const now = new Date().toISOString();
        const item = {
            id: this.createRoutineId(),
            label: normalizedLabel,
            startHour: s,
            durationHours: d,
            pattern: this.normalizeRoutinePattern(patch.pattern),
            passDates: Array.isArray(patch.passDates) ? patch.passDates.slice() : [],
            stoppedAtMs: Number.isFinite(patch.stoppedAtMs) ? patch.stoppedAtMs : null,
            createdAt: now,
            createdBy: this.deviceId || null,
            updatedAt: now,
            updatedBy: this.deviceId || null,
        };
        this.routines = [...(this.routines || []), item];
        return item;
    }
    getInlineTargetRange() {
        if (!this.inlinePlanTarget) return null;
        const safeStart = Number.isInteger(this.inlinePlanTarget.startIndex) ? this.inlinePlanTarget.startIndex : 0;
        const safeEnd = Number.isInteger(this.inlinePlanTarget.endIndex) ? this.inlinePlanTarget.endIndex : safeStart;
        const startIndex = Math.min(safeStart, safeEnd);
        const endIndex = Math.max(safeStart, safeEnd);
        return { startIndex, endIndex };
    }
    getRoutineWindowFromRange(startIndex, endIndex) {
        if (!Number.isInteger(startIndex) || !Number.isInteger(endIndex)) return null;
        const startSlot = this.timeSlots[startIndex];
        const endSlot = this.timeSlots[endIndex];
        if (!startSlot || !endSlot) return null;
        const startHour = this.labelToHour(startSlot.time);
        const durationHours = Math.max(1, endIndex - startIndex + 1);
        return { startHour, durationHours };
    }
    passRoutineForDate(routineId, date) {
        const d = String(date || '').trim();
        if (!d) return false;
        const routine = (this.routines || []).find(r => r && r.id === routineId);
        if (!routine) return false;
        const passes = Array.isArray(routine.passDates) ? routine.passDates.slice() : [];
        if (!passes.includes(d)) passes.push(d);
        passes.sort((a, b) => a.localeCompare(b));
        return this.updateRoutineItem(routineId, { passDates: passes });
    }
    clearRoutinePassForDate(routineId, date) {
        const d = String(date || '').trim();
        if (!d) return false;
        const routine = (this.routines || []).find(r => r && r.id === routineId);
        if (!routine) return false;
        const passes = Array.isArray(routine.passDates) ? routine.passDates.filter(x => x !== d) : [];
        return this.updateRoutineItem(routineId, { passDates: passes });
    }
    clearRoutineRangeForDate(routine, date, options = {}) {
        if (!routine || typeof routine !== 'object') return false;
        const d = String(date || '').trim();
        if (!d) return false;
        const slots = Array.isArray(options.timeSlots) ? options.timeSlots : this.timeSlots;
        const mergedMap = options.mergedFieldsMap instanceof Map ? options.mergedFieldsMap : this.mergedFields;
        if (!Array.isArray(slots) || !mergedMap) return false;
        const label = this.normalizeActivityText
            ? this.normalizeActivityText(routine.label || '')
            : String(routine.label || '').trim();
        if (!label) return false;

        const startHour = (Number(routine.startHour) + 24) % 24;
        const dur = Number.isFinite(routine.durationHours) ? Math.max(1, Math.min(24, Math.floor(Number(routine.durationHours)))) : 1;
        const indicesToClear = new Set();

        for (let i = 0; i < dur; i++) {
            const hour = (startHour + i) % 24;
            const slotStartMs = this.getLocalSlotStartMs(d, hour);
            if (Number.isFinite(options.minSlotStartMs) && slotStartMs != null && slotStartMs < options.minSlotStartMs) {
                continue;
            }
            const labelForHour = this.hourToLabel(hour);
            const index = slots.findIndex(s => s && String(s.time) === labelForHour);
            if (index >= 0) indicesToClear.add(index);
        }

        if (indicesToClear.size === 0) return false;

        let changed = false;
        const handledMerges = new Set();
        const clearSlot = (slot) => {
            if (!slot) return;
            if (slot.planned !== '') { slot.planned = ''; changed = true; }
            if (slot.planTitle !== '') { slot.planTitle = ''; changed = true; }
            if (slot.planTitleBandOn !== false) { slot.planTitleBandOn = false; changed = true; }
            const planActivities = this.normalizePlanActivitiesArray(slot.planActivities);
            if (planActivities.length > 0) { slot.planActivities = []; changed = true; }
        };

        indicesToClear.forEach((index) => {
            const mk = this.findMergeKeyInMap(mergedMap, 'planned', index);
            if (mk) {
                if (handledMerges.has(mk)) return;
                handledMerges.add(mk);
                const [, startStr, endStr] = mk.split('-');
                const start = parseInt(startStr, 10);
                const end = parseInt(endStr, 10);
                if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return;
                const baseSlot = slots[start];
                const mergedRaw = mergedMap.has(mk)
                    ? mergedMap.get(mk)
                    : (baseSlot && baseSlot.planned) || '';
                const mergedText = this.normalizeActivityText
                    ? this.normalizeActivityText(mergedRaw || '')
                    : String(mergedRaw || '').trim();
                if (mergedText && mergedText !== label) return;

                let clearAll = true;
                for (let j = start; j <= end; j++) {
                    if (!indicesToClear.has(j)) {
                        clearAll = false;
                        break;
                    }
                }

                if (mergedMap.has(mk)) {
                    mergedMap.delete(mk);
                    changed = true;
                }

                for (let j = start; j <= end; j++) {
                    const slot = slots[j];
                    if (!slot) continue;
                    if (clearAll || indicesToClear.has(j)) {
                        clearSlot(slot);
                    } else {
                        if (slot.planned !== label) { slot.planned = label; changed = true; }
                        if (slot.planTitle !== label) { slot.planTitle = label; changed = true; }
                        if (slot.planTitleBandOn !== false) { slot.planTitleBandOn = false; changed = true; }
                        const planActivities = this.normalizePlanActivitiesArray(slot.planActivities);
                        if (planActivities.length > 0) { slot.planActivities = []; changed = true; }
                    }
                }
                return;
            }

            const slot = slots[index];
            if (!slot) return;
            const planned = this.normalizeActivityText ? this.normalizeActivityText(slot.planned || '') : String(slot.planned || '').trim();
            const planTitle = this.normalizeActivityText ? this.normalizeActivityText(slot.planTitle || '') : String(slot.planTitle || '').trim();
            if ((planned && planned !== label) && (planTitle && planTitle !== label)) return;
            clearSlot(slot);
        });

        return changed;
    }
    clearRoutineFromLocalStorageFutureDates(routine, fromDate) {
        // local storage disabled
    }
    async clearRoutineFromSupabaseFutureDates(routine, fromDate) {
        if (!this.supabaseConfigured || !this.supabase) return false;
        const identity = this.getSupabaseIdentity();
        if (!identity) return false;
        try {
            const { data, error } = await this.supabase
                .from('timesheet_days')
                .select('day, slots')
                .eq('user_id', identity)
                .gte('day', fromDate)
                .neq('day', this.PLANNED_SENTINEL_DAY)
                .neq('day', this.ROUTINE_SENTINEL_DAY);
            if (error) throw error;
            if (!Array.isArray(data) || data.length === 0) return true;

            for (const row of data) {
                if (!row || !row.day || row.day === fromDate) continue;
                const slotsJson = row.slots || {};
                const tempSlots = this.createEmptyTimeSlots();
                const tempMerged = new Map();
                this.applySlotsJsonToContext(slotsJson, tempSlots, tempMerged);
                const changed = this.clearRoutineRangeForDate(routine, row.day, {
                    timeSlots: tempSlots,
                    mergedFieldsMap: tempMerged
                });
                if (!changed) continue;
                const nextSlotsJson = this.buildSlotsJsonForContext(tempSlots, tempMerged);
                if (Object.keys(nextSlotsJson).length === 0) {
                    await this.deleteFromSupabaseForDate(row.day);
                } else {
                    const payload = {
                        user_id: identity,
                        day: row.day,
                        slots: nextSlotsJson,
                        updated_at: new Date().toISOString(),
                    };
                    await this.supabase
                        .from('timesheet_days')
                        .upsert([payload], { onConflict: 'user_id,day' });
                }
            }
            return true;
        } catch (e) {
            console.warn('[supabase] routines future cleanup failed:', e);
            return false;
        }
    }
    ensureRoutinesAvailableOrNotify() {
        if (this.supabaseConfigured && this.supabase && this.getSupabaseIdentity()) return true;
        this.showNotification('루틴 기능은 Google 로그인 후 사용할 수 있습니다.');
        return false;
    }

    normalizeActivityLog(slot) {
        try {
            if (!slot || typeof slot !== 'object') return slot;
            if (!slot.activityLog || typeof slot.activityLog !== 'object') {
                slot.activityLog = { title: '', details: '', subActivities: [], titleBandOn: false, actualGridUnits: [], actualExtraGridUnits: [], actualOverride: false };
            } else {
                if ('outcome' in slot.activityLog) {
                    try { delete slot.activityLog.outcome; } catch (_) { slot.activityLog.outcome = undefined; }
                }
                if (typeof slot.activityLog.title !== 'string') {
                    slot.activityLog.title = String(slot.activityLog.title || '');
                }
                if (typeof slot.activityLog.details !== 'string') {
                    slot.activityLog.details = String(slot.activityLog.details || '');
                }
                if (!Array.isArray(slot.activityLog.subActivities)) {
                    slot.activityLog.subActivities = [];
                } else {
                    slot.activityLog.subActivities = this.normalizeActivitiesArray(slot.activityLog.subActivities);
                }
                slot.activityLog.titleBandOn = Boolean(slot.activityLog.titleBandOn);
                if (!Array.isArray(slot.activityLog.actualGridUnits)) {
                    slot.activityLog.actualGridUnits = [];
                } else {
                    slot.activityLog.actualGridUnits = slot.activityLog.actualGridUnits.map(value => Boolean(value));
                }
                if (!Array.isArray(slot.activityLog.actualExtraGridUnits)) {
                    slot.activityLog.actualExtraGridUnits = [];
                } else {
                    slot.activityLog.actualExtraGridUnits = slot.activityLog.actualExtraGridUnits.map(value => Boolean(value));
                }
                slot.activityLog.actualOverride = Boolean(slot.activityLog.actualOverride);
            }
        } catch (_) {}
        return slot;
    }

    // 저장소 전체 순회하여 기존 데이터에서 outcome 필드 제거
    purgeOutcomeFromAllStoredData() {
        // local storage disabled
    }

    changeDate(days) {
        const baseMs = this.getDateValue(this.currentDate);
        if (!Number.isFinite(baseMs)) return;
        const currentDate = new Date(baseMs);
        currentDate.setDate(currentDate.getDate() + days);
        this.transitionToDate(this.formatDateFromMsLocal(currentDate.getTime()));
    }

    transitionToDate(nextDate) {
        const targetDate = String(nextDate || '').trim();
        if (!targetDate) return;

        const previousDate = this.currentDate;
        const committed = this.commitRunningTimers({ render: false, calculate: false, autoSave: false });

        if (committed && previousDate) {
            const snapshotSlots = JSON.parse(JSON.stringify(this.timeSlots || []));
            const snapshotMergedObj = Object.fromEntries(this.mergedFields || new Map());
            this.persistSnapshotForDate(previousDate, snapshotSlots, snapshotMergedObj).catch((e) => {
                console.warn('[date-transition] snapshot persist failed:', e);
            });
        }

        this.currentDate = targetDate;
        this.setCurrentDate();

        // 날짜 전환 시 이전 시트가 잠시라도 남지 않도록 즉시 초기화
        if (typeof this.generateTimeSlots === 'function') this.generateTimeSlots();
        if (this.mergedFields && typeof this.mergedFields.clear === 'function') this.mergedFields.clear();
        if (typeof this.renderTimeEntries === 'function') this.renderTimeEntries();
        if (typeof this.calculateTotals === 'function') this.calculateTotals();

        this.loadData();
        try { this.resubscribeSupabaseRealtime && this.resubscribeSupabaseRealtime(); } catch(_) {}
    }

    attachFieldSelectionListeners(entryDiv, index) {
        const plannedField = entryDiv.querySelector('.planned-input');
        const actualField = entryDiv.querySelector('.actual-input');
        
        if (plannedField) {
            plannedField.addEventListener('click', (e) => {
                const mergeKey = this.findMergeKey('planned', index);
                if (!mergeKey) return;

                e.preventDefault();
                e.stopPropagation();

                if (this.isMergeRangeSelected('planned', mergeKey)) {
                    this.clearSelection('planned');
                } else {
                    const canAppend = this.selectedPlannedFields && this.selectedPlannedFields.size > 0;
                    if (!canAppend) this.clearAllSelections();
                    this.selectMergedRange('planned', mergeKey, { append: canAppend });
                }
                const [, startStr] = mergeKey.split('-');
                const parsedStart = parseInt(startStr, 10);
                const mergeStart = Number.isInteger(parsedStart) ? parsedStart : index;
                const anchor = plannedField.closest('.split-cell-wrapper.split-type-planned') || plannedField;
                this.openInlinePlanDropdown(mergeStart, anchor);
            });
        }
        // 우측(실제) 열은 개별 선택/드래그/병합 조작을 제공하지 않음

        let plannedMouseMoved = false;
        let plannedMouseBaseRange = null; // { start, end }
        if (plannedField) {
            plannedField.addEventListener('mousedown', (e) => {
                this.closeInlinePlanDropdown();
                if (e.target === plannedField && !plannedField.matches(':focus')) {
                    e.preventDefault();
                    plannedMouseMoved = false;

                    const mergeKeyAtStart = this.findMergeKey('planned', index);
                    let rangeStart = index;
                    let rangeEnd = index;
                    if (mergeKeyAtStart) {
                        const [, sStr, eStr] = String(mergeKeyAtStart).split('-');
                        const parsedStart = parseInt(sStr, 10);
                        const parsedEnd = parseInt(eStr, 10);
                        if (Number.isFinite(parsedStart) && Number.isFinite(parsedEnd)) {
                            rangeStart = parsedStart;
                            rangeEnd = parsedEnd;
                        }
                    }

                    plannedMouseBaseRange = { start: rangeStart, end: rangeEnd };
                    this.dragStartIndex = rangeStart;
                    this.dragBaseEndIndex = rangeEnd;
                    this.currentColumnType = 'planned';
                    this.isSelectingPlanned = true;
                }
            });
            plannedField.addEventListener('mousemove', (e) => {
                if (this.isSelectingPlanned && this.currentColumnType === 'planned') {
                    plannedMouseMoved = true;
                }
            });
            plannedField.addEventListener('mouseup', (e) => {
                if (e.target === plannedField && !plannedField.matches(':focus') && this.currentColumnType === 'planned') {
                    e.preventDefault();
                    e.stopPropagation();

                    const base = plannedMouseBaseRange || { start: index, end: index };
                    const nextStart = Math.min(base.start, index);
                    const nextEnd = Math.max(base.end, index);

                    if (!plannedMouseMoved) {
                        if (this.selectedPlannedFields.has(index) && this.selectedPlannedFields.size === 1) {
                            this.clearSelection('planned');
                        } else {
                            this.clearAllSelections();
                            this.selectFieldRange('planned', nextStart, nextEnd);
                        }
                        if (!e.ctrlKey && !e.metaKey) {
                            const anchor = plannedField.closest('.split-cell-wrapper.split-type-planned') || plannedField;
                            this.openInlinePlanDropdown(base.start, anchor);
                        }
                    } else {
                        if (!e.ctrlKey && !e.metaKey) {
                            this.clearSelection('planned');
                        }
                        this.selectFieldRange('planned', nextStart, nextEnd);
                    }
                    this.isSelectingPlanned = false;
                    this.currentColumnType = null;
                    this.dragBaseEndIndex = -1;
                    plannedMouseBaseRange = null;
                }
            });

            // 모바일: 롱프레스 후 드래그로 범위 선택 (PC 드래그와 유사)
            let plannedTouchLongPressTimer = null;
            let plannedTouchLongPressActive = false;
            let plannedTouchBaseRange = null; // { start, end }
            const clearPlannedTouchLongPress = () => {
                if (plannedTouchLongPressTimer) {
                    clearTimeout(plannedTouchLongPressTimer);
                    plannedTouchLongPressTimer = null;
                }
            };

            plannedField.addEventListener('touchstart', (e) => {
                if (!e.touches || e.touches.length !== 1) return;
                plannedTouchLongPressActive = false;
                plannedTouchBaseRange = null;
                plannedMouseMoved = false;
                clearPlannedTouchLongPress();

                const mergeKeyAtStart = this.findMergeKey('planned', index);
                let rangeStart = index;
                let rangeEnd = index;
                if (mergeKeyAtStart) {
                    const [, sStr, eStr] = String(mergeKeyAtStart).split('-');
                    const parsedStart = parseInt(sStr, 10);
                    const parsedEnd = parseInt(eStr, 10);
                    if (Number.isFinite(parsedStart) && Number.isFinite(parsedEnd)) {
                        rangeStart = parsedStart;
                        rangeEnd = parsedEnd;
                    }
                }

                plannedTouchLongPressTimer = setTimeout(() => {
                    plannedTouchLongPressActive = true;
                    plannedTouchBaseRange = { start: rangeStart, end: rangeEnd };
                    this.closeInlinePlanDropdown();
                    this.dragStartIndex = rangeStart;
                    this.dragBaseEndIndex = rangeEnd;
                    this.currentColumnType = 'planned';
                    this.isSelectingPlanned = true;
                    this.clearAllSelections();
                    this.selectFieldRange('planned', rangeStart, rangeEnd);
                    try { plannedField.blur(); } catch (_) {}
                }, 280);
            }, { passive: true });

            plannedField.addEventListener('touchmove', (e) => {
                if (!plannedTouchLongPressActive) return;
                const t = e.touches && e.touches[0];
                if (!t) return;
                e.preventDefault();
                const hoverIndex = this.getIndexAtClientPosition('planned', t.clientX, t.clientY);
                if (!Number.isInteger(hoverIndex)) return;
                if (this.currentColumnType !== 'planned') return;
                plannedMouseMoved = true;

                const base = plannedTouchBaseRange || { start: this.dragStartIndex, end: this.dragStartIndex };
                const nextStart = Math.min(base.start, hoverIndex);
                const nextEnd = Math.max(base.end, hoverIndex);
                this.clearSelection('planned');
                this.selectFieldRange('planned', nextStart, nextEnd);
            }, { passive: false });

            plannedField.addEventListener('touchend', (e) => {
                clearPlannedTouchLongPress();
                if (plannedTouchLongPressActive) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.isSelectingPlanned = false;
                    this.currentColumnType = null;
                    this.dragStartIndex = -1;
                    this.dragBaseEndIndex = -1;
                }
                plannedTouchLongPressActive = false;
                plannedTouchBaseRange = null;
            }, { passive: false });

            plannedField.addEventListener('touchcancel', () => {
                clearPlannedTouchLongPress();
                plannedTouchLongPressActive = false;
                plannedTouchBaseRange = null;
                this.isSelectingPlanned = false;
                this.currentColumnType = null;
                this.dragStartIndex = -1;
                this.dragBaseEndIndex = -1;
            }, { passive: true });

            plannedField.addEventListener('mouseenter', (e) => {
                // 드래그 중이 아닐 때는 선택 유무와 관계없이 (단, 멀티선택/자기 자신은 내부 가드) 호버 버튼 표시
                if (!this.isSelectingPlanned) {
                    this.showScheduleButtonOnHover(index);
                }
                // 병합 셀에서는 드래그 확장 업데이트만 생략
                if (this.isSelectingPlanned && this.currentColumnType === 'planned') {
                    plannedMouseMoved = true;
                    if (!e.ctrlKey && !e.metaKey) {
                        this.clearSelection('planned');
                    }
                    const base = plannedMouseBaseRange || { start: this.dragStartIndex, end: this.dragStartIndex };
                    const nextStart = Math.min(base.start, index);
                    const nextEnd = Math.max(base.end, index);
                    this.selectFieldRange('planned', nextStart, nextEnd);
                }
            });
            plannedField.addEventListener('mouseleave', (e) => {
                const toEl = e.relatedTarget;
                // 1) 스케줄/되돌리기 버튼으로 이동하는 경우 유지
                if (toEl && toEl.closest && (toEl.closest('.schedule-button') || toEl.closest('.undo-button'))) return;
                // 2) 병합된 계획 블록 내부로 이동하는 경우(같은 mergeKey) 유지
                const mk = this.findMergeKey('planned', index);
                if (mk && toEl && toEl.closest) {
                    if (
                        toEl.closest(`.planned-merged-main-container[data-merge-key="${mk}"]`) ||
                        toEl.closest('.planned-merged-overlay') ||
                        toEl.closest(`.input-field.planned-input[data-merge-key="${mk}"]`)
                    ) {
                        return;
                    }
                }
                // 3) 그 외에는 호버 버튼만 정리(선택 오버레이 버튼은 유지)
                this.hideHoverScheduleButton();
            });

            // 병합된 계획(좌측) 메인 컨테이너에서도 호버 버튼을 제어
            const mk2 = this.findMergeKey('planned', index);
            if (mk2) {
                const mergedMain = entryDiv.querySelector(`.planned-merged-main-container[data-merge-key="${mk2}"]`);
                if (mergedMain) {
                    const updateHover = (ev) => {
                        if (this.isSelectingPlanned) return; // 드래그 중엔 표시 안 함
                        const hoverIdx = this.getIndexAtClientPosition('planned', ev.clientX, ev.clientY);
                        if (hoverIdx != null) this.showScheduleButtonOnHover(hoverIdx);
                    };
                    mergedMain.addEventListener('mouseenter', updateHover);
                    mergedMain.addEventListener('mousemove', updateHover);
                    mergedMain.addEventListener('mouseleave', (ev) => {
                        const toEl2 = ev.relatedTarget;
                        if (toEl2 && toEl2.closest && (
                            toEl2.closest('.schedule-button') ||
                            toEl2.closest('.undo-button') ||
                            toEl2.closest(`.planned-merged-main-container[data-merge-key="${mk2}"]`)
                        )) return;
                        this.hideHoverScheduleButton();
                    });
                }
            }
        }
        
        // No drag-selection listeners for actualField in the actual column
        if (actualField) {
            const actualContainer = entryDiv.querySelector('.actual-field-container');
            const actualOverlay = entryDiv.querySelector('.actual-merged-overlay');
            const actualSplitViz = entryDiv.querySelector('.split-visualization-actual');

            const bindHover = (el) => {
                if (!el) return;
                el.addEventListener('mouseenter', () => {
                    const wrapper = el.closest('.split-cell-wrapper.split-type-actual.split-has-data');
                    if (!wrapper) return;
                    this.showActivityLogButtonOnHover(index);
                });
                el.addEventListener('mouseleave', (e) => {
                    const toEl = e.relatedTarget;
                    if (toEl && toEl.closest && toEl.closest('.activity-log-btn-floating')) return;
                    this.hideHoverActivityLogButton();
                });
            };

            bindHover(actualContainer);
            bindHover(actualOverlay);
            bindHover(actualSplitViz);

              const actualGrid = entryDiv.querySelector('.split-visualization-actual .split-grid');
              if (actualGrid) {
                  actualGrid.addEventListener('click', (event) => {
                      const segment = event.target.closest('.split-grid-segment');
                      if (!segment || !actualGrid.contains(segment)) return;
                      const unitIndex = parseInt(segment.dataset.unitIndex, 10);
                      const extraLabel = segment.dataset.extraLabel;
                      if (extraLabel) {
                          event.preventDefault();
                          event.stopPropagation();
                          this.toggleExtraGridUnit(index, extraLabel, unitIndex);
                          return;
                      }
                      if (!Number.isFinite(unitIndex)) return;
                      event.preventDefault();
                      event.stopPropagation();
                      this.toggleActualGridUnit(index, unitIndex);
                  });
              }
        }
    }

    startFieldSelection(type, index, e) {
        if (type !== 'planned') return; // 우측 열에서 시작 조작 금지
        this.currentColumnType = type;
        this.dragStartIndex = index;
        
        if (type === 'planned') {
            this.isSelectingPlanned = true;
            if (!e.ctrlKey && !e.metaKey) {
                this.clearSelection('planned');
            }
            this.toggleFieldSelection('planned', index);
        }
    }

    toggleFieldSelection(type, index) {
        const field = document.querySelector(`[data-index="${index}"] .${type}-input`);
        const selectedSet = type === 'planned' ? this.selectedPlannedFields : this.selectedActualFields;
        
        if (selectedSet.has(index)) {
            selectedSet.delete(index);
            if (field) field.classList.remove('field-selected');
        } else {
            selectedSet.add(index);
            // 시각 효과는 오버레이로만 처리
        }
    }

    selectFieldRange(type, startIndex, endIndex) {
        if (type !== 'planned') return; // 우측 열 멀티 선택 금지
        this.clearSelection(type);
        
        const start = Math.min(startIndex, endIndex);
        const end = Math.max(startIndex, endIndex);
        
        for (let i = start; i <= end; i++) {
            const selectedSet = type === 'planned' ? this.selectedPlannedFields : this.selectedActualFields;
            selectedSet.add(i);
            const field = document.querySelector(`[data-index="${i}"] .${type}-input`);
            // 필드 클래스 하이라이트는 사용하지 않음 (투명 오버레이만)
        }
        
        this.updateSelectionOverlay(type);
        
        const selectedSet = this.selectedPlannedFields;
        if (selectedSet.size > 1) {
            this.showMergeButton('planned');
        }
        this.showScheduleButtonForSelection(type);
    }
    
    clearSelection(type) {
        const selectedSet = type === 'planned' ? this.selectedPlannedFields : this.selectedActualFields;
        selectedSet.forEach(index => {
            const field = document.querySelector(`[data-index="${index}"] .${type}-input`);
            if (field) {
                field.classList.remove('field-selected');
                const row = field.closest('.time-entry');
                if (row) {
                    row.classList.remove('selected-merged-planned', 'selected-merged-actual');
                }
            }
        });
        selectedSet.clear();
        
        this.hideMergeButton();
        this.hideUndoButton();
        this.removeSelectionOverlay(type);
        this.hideScheduleButton();
    }
    
    clearAllSelections() {
        this.clearSelection('planned');
        this.clearSelection('actual');
    }
    
    showMergeButton(type) {
        if (type !== 'planned') return; // 우측 열 병합 버튼 금지
        const selectedSet = type === 'planned' ? this.selectedPlannedFields : this.selectedActualFields;
        
        if (selectedSet.size > 1) {
            const selectedIndices = Array.from(selectedSet).sort((a, b) => a - b);
            const startIndex = selectedIndices[0];
            const endIndex = selectedIndices[selectedIndices.length - 1];
            
            const startField = document.querySelector(`[data-index="${startIndex}"] .${type}-input`);
            const endField = document.querySelector(`[data-index="${endIndex}"] .${type}-input`);
            
            if (startField && endField) {
                const startRect = startField.getBoundingClientRect();
                const endRect = endField.getBoundingClientRect();
                
                let centerX, centerY;
                
                const selectedCount = selectedIndices.length;
                
                if (selectedCount % 2 === 1) {
                    const middleIndex = selectedIndices[Math.floor(selectedCount / 2)];
                    const middleField = document.querySelector(`[data-index="${middleIndex}"] .${type}-input`);
                    const middleRect = middleField.getBoundingClientRect();
                    centerX = middleRect.left + (middleRect.width / 2);
                    centerY = middleRect.top + (middleRect.height / 2);
                } else {
                    const midIndex1 = Math.floor(selectedCount / 2) - 1;
                    const midIndex2 = Math.floor(selectedCount / 2);
                    const field1 = document.querySelector(`[data-index="${selectedIndices[midIndex1]}"] .${type}-input`);
                    const field2 = document.querySelector(`[data-index="${selectedIndices[midIndex2]}"] .${type}-input`);
                    const rect1 = field1.getBoundingClientRect();
                    const rect2 = field2.getBoundingClientRect();
                    
                    centerX = (rect1.left + rect1.width / 2 + rect2.left + rect2.width / 2) / 2;
                    centerY = (rect1.bottom + rect2.top) / 2;
                }
                
                this.hideMergeButton();
                
                const scrollX = window.scrollX || document.documentElement.scrollLeft || 0;
                const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
                
                this.mergeButton = document.createElement('button');
                this.mergeButton.className = 'merge-button';
                this.mergeButton.textContent = '병합';
                // 기본 배치(선택 중앙) 후, 스케줄 버튼이 있으면 우측으로 재배치
                this.mergeButton.style.left = `${centerX + scrollX - 25}px`;
                this.mergeButton.style.top = `${centerY + scrollY - 15}px`;
                
                this.mergeButton.addEventListener('click', () => {
                    this.mergeSelectedFields(type);
                });
                
                document.body.appendChild(this.mergeButton);
                // 병합 버튼과 스케줄 버튼은 동시 표기하지 않음
                this.hideScheduleButton();
                this.repositionButtonsNextToSchedule();
            }
        }
    }
    
    hideMergeButton() {
        if (this.mergeButton && this.mergeButton.parentNode) {
            this.mergeButton.parentNode.removeChild(this.mergeButton);
            this.mergeButton = null;
        }
    }
    
    showUndoButton(type, mergeKey) {
        // 우측(실제) 열은 병합 해제 기능 제거
        if (type !== 'planned') return;
        const [, startStr, endStr] = mergeKey.split('-');
        const start = parseInt(startStr);
        const end = parseInt(endStr);
        
        const startField = document.querySelector(`[data-index="${start}"] .${type}-input`);
        const endField = document.querySelector(`[data-index="${end}"] .${type}-input`);
        
        if (startField && endField) {
            const startRect = startField.getBoundingClientRect();
            const endRect = endField.getBoundingClientRect();
            
            this.hideUndoButton();
            
            const scrollX = window.scrollX || document.documentElement.scrollLeft || 0;
            const scrollY = window.scrollY || document.documentElement.scrollTop || 0;

            const anchor = this.scheduleHoverButton || this.scheduleButton;
            let defaultLeft, defaultTop;
            if (anchor) {
                const sbRect = anchor.getBoundingClientRect();
                defaultLeft = window.scrollX + sbRect.left + sbRect.width + 8;
                defaultTop = window.scrollY + sbRect.top;
            } else {
                const centerX = startRect.left + (startRect.width / 2);
                const centerY = startRect.top + ((endRect.bottom - startRect.top) / 2);
                defaultLeft = centerX + scrollX - 17;
                defaultTop = centerY + scrollY - 17;
            }

            this.undoButton = document.createElement('button');
            this.undoButton.className = 'undo-button';
            // 기본 배치: 스케줄 버튼이 있으면 바로 우측, 없으면 중앙
            this.undoButton.style.left = `${Math.round(defaultLeft)}px`;
            this.undoButton.style.top = `${Math.round(defaultTop)}px`;
            
            this.undoButton.addEventListener('click', () => {
                this.undoMerge(type, mergeKey);
            });
            
            document.body.appendChild(this.undoButton);
            this.repositionButtonsNextToSchedule();
        }
    }
    
    hideUndoButton() {
        if (this.undoButton && this.undoButton.parentNode) {
            this.undoButton.parentNode.removeChild(this.undoButton);
            this.undoButton = null;
        }
    }
    
    undoMerge(type, mergeKey) {
        // 우측(실제) 열은 병합 해제 불가
        if (type !== 'planned') {
            this.hideUndoButton();
            this.clearSelection(type);
            return;
        }
        const [, startStr, endStr] = mergeKey.split('-');
        const start = parseInt(startStr);
        const end = parseInt(endStr);
        const slotCount = Math.max(1, (end - start + 1));

        const timeRangeKey = `time-${start}-${end}`;
        const actualMergeKey = `actual-${start}-${end}`;
        const baseSlot = this.timeSlots[start] || {};

        const mergedPlannedText = String(this.mergedFields.get(mergeKey) ?? baseSlot.planned ?? '').trim();
        const mergedActualText = String(this.mergedFields.get(actualMergeKey) ?? baseSlot.actual ?? '').trim();
        const mergedPlanTitle = String(baseSlot.planTitle || '').trim();

        const sourcePlanActivities = this.normalizePlanActivitiesArray(baseSlot.planActivities);
        const sourceActualActivities = this.normalizeActivitiesArray(baseSlot.activityLog && baseSlot.activityLog.subActivities);

        const splitSecondsEvenly = (totalSeconds, count) => {
            const safeTotal = Math.max(0, Math.floor(Number(totalSeconds) || 0));
            const n = Math.max(1, Math.floor(Number(count) || 1));
            const base = Math.floor(safeTotal / n);
            let rem = safeTotal - (base * n);
            const out = new Array(n).fill(base);
            for (let i = 0; i < n && rem > 0; i += 1, rem -= 1) out[i] += 1;
            return out;
        };

        const splitActivitiesBySlots = (items, count, isActual = false) => {
            const normalized = Array.isArray(items) ? items : [];
            const perSlot = Array.from({ length: count }, () => []);
            normalized.forEach((item) => {
                if (!item) return;
                const totalSec = Math.max(0, Math.floor(Number(item.seconds) || 0));
                if (totalSec <= 0) return;
                const secChunks = splitSecondsEvenly(totalSec, count);

                let recChunks = null;
                if (isActual) {
                    const rec = Number.isFinite(item.recordedSeconds)
                        ? Math.max(0, Math.floor(Number(item.recordedSeconds)))
                        : totalSec;
                    recChunks = splitSecondsEvenly(rec, count);
                }

                for (let idx = 0; idx < count; idx++) {
                    const sec = secChunks[idx] || 0;
                    if (sec <= 0) continue;
                    const next = { ...item, seconds: sec };
                    if (isActual) {
                        next.recordedSeconds = recChunks ? (recChunks[idx] || sec) : sec;
                    }
                    perSlot[idx].push(next);
                }
            });
            return perSlot;
        };

        const summarizeLabel = (items, fallbackText) => {
            const arr = Array.isArray(items) ? items : [];
            if (arr.length <= 0) return String(fallbackText || '').trim();
            const labels = arr
                .map((it) => String(it && it.label ? it.label : '').trim())
                .filter(Boolean);
            if (labels.length <= 0) return String(fallbackText || '').trim();
            if (labels.length === 1) return labels[0];
            return `${labels[0]} 외 ${labels.length - 1}`;
        };

        const splitBooleanUnits = (units, count) => {
            const src = Array.isArray(units) ? units.map(v => Boolean(v)) : [];
            const n = Math.max(1, Math.floor(Number(count) || 1));
            const lengths = splitSecondsEvenly(src.length, n);
            const out = [];
            let offset = 0;
            for (let i = 0; i < n; i++) {
                const len = lengths[i] || 0;
                out.push(src.slice(offset, offset + len));
                offset += len;
            }
            return out;
        };

        const planBySlot = splitActivitiesBySlots(sourcePlanActivities, slotCount, false);
        const actualBySlot = splitActivitiesBySlots(sourceActualActivities, slotCount, true);
        const baseLog = (baseSlot && baseSlot.activityLog && typeof baseSlot.activityLog === 'object')
            ? baseSlot.activityLog
            : {};
        const actualUnitsBySlot = splitBooleanUnits(baseLog.actualGridUnits, slotCount);
        const extraUnitsBySlot = splitBooleanUnits(baseLog.actualExtraGridUnits, slotCount);

        // 병합 키 제거
        this.mergedFields.delete(mergeKey);
        this.mergedFields.delete(timeRangeKey);
        this.mergedFields.delete(actualMergeKey);

        for (let i = start; i <= end; i++) {
            const rel = i - start;
            const slot = this.timeSlots[i];
            if (!slot) continue;

            if (!slot.activityLog || typeof slot.activityLog !== 'object') {
                slot.activityLog = { title: '', details: '', subActivities: [], titleBandOn: false, actualGridUnits: [], actualExtraGridUnits: [], actualOverride: false };
            }

            const slotPlanActivities = Array.isArray(planBySlot[rel]) ? planBySlot[rel] : [];
            const slotActualActivities = Array.isArray(actualBySlot[rel]) ? actualBySlot[rel] : [];

            slot.planActivities = slotPlanActivities.map(item => ({ ...item }));
            slot.activityLog.subActivities = slotActualActivities.map(item => ({ ...item }));

            slot.planned = summarizeLabel(slotPlanActivities, mergedPlannedText);
            slot.actual = summarizeLabel(slotActualActivities, mergedActualText);

            slot.planTitle = slot.planned ? mergedPlanTitle : '';
            slot.planTitleBandOn = Boolean(slot.planTitle && slotPlanActivities.length > 0);
            slot.activityLog.titleBandOn = Boolean(slot.activityLog.titleBandOn && slotActualActivities.length > 0);
            slot.activityLog.actualOverride = false;
            slot.activityLog.actualGridUnits = Array.isArray(actualUnitsBySlot[rel]) ? actualUnitsBySlot[rel].slice() : [];
            slot.activityLog.actualExtraGridUnits = Array.isArray(extraUnitsBySlot[rel]) ? extraUnitsBySlot[rel].slice() : [];
        }

        this.renderTimeEntries();
        this.clearAllSelections();
        this.calculateTotals();
        this.autoSave();
    }

    mergeSelectedFields(type) {
        const selectedSet = type === 'planned' ? this.selectedPlannedFields : this.selectedActualFields;
        
        if (selectedSet.size > 1) {
            const selectedIndices = Array.from(selectedSet).sort((a, b) => a - b);
            const startIndex = selectedIndices[0];
            const endIndex = selectedIndices[selectedIndices.length - 1];
            
            const firstField = document.querySelector(`[data-index="${startIndex}"] .${type}-input`);
            const mergedValue = firstField ? firstField.value : '';
            
            const mergeKey = `${type}-${startIndex}-${endIndex}`;
            this.mergedFields.set(mergeKey, mergedValue);
            
            // 좌측 계획 열이 병합될 때 모든 열을 동기화 병합
            if (type === 'planned') {
                // 중앙 시간 열 병합 (시간 범위 표시)
                const timeRangeKey = `time-${startIndex}-${endIndex}`;
                const startTime = this.timeSlots[startIndex].time;
                const endTime = this.timeSlots[endIndex].time;
                const timeRangeValue = `${startTime}-${endTime}`;
                this.mergedFields.set(timeRangeKey, timeRangeValue);
                
                // 우측 실제 활동 열 병합 (기존 값이 있다면 유지, 없으면 빈 값)
                const actualMergeKey = `actual-${startIndex}-${endIndex}`;
                const firstActualField = document.querySelector(`[data-index="${startIndex}"] .timer-result-input`);
                const actualMergedValue = firstActualField ? firstActualField.value : '';
                this.mergedFields.set(actualMergeKey, actualMergedValue);
                
                // 데이터 업데이트
                const basePlanTitle = (this.timeSlots[startIndex] && typeof this.timeSlots[startIndex].planTitle === 'string')
                    ? this.timeSlots[startIndex].planTitle
                    : '';
                for (let i = startIndex; i <= endIndex; i++) {
                    this.timeSlots[i].planned = i === startIndex ? mergedValue : '';
                    this.timeSlots[i].actual = i === startIndex ? actualMergedValue : '';
                    if (!this.timeSlots[i].activityLog || typeof this.timeSlots[i].activityLog !== 'object') {
                        this.timeSlots[i].activityLog = { title: '', details: '', subActivities: [], titleBandOn: false, actualGridUnits: [], actualExtraGridUnits: [], actualOverride: false };
                    }
                    this.timeSlots[i].planTitle = i === startIndex ? basePlanTitle : '';
                    this.timeSlots[i].planTitleBandOn = i === startIndex ? Boolean(this.timeSlots[i].planTitleBandOn) : false;
                    this.timeSlots[i].activityLog.titleBandOn = i === startIndex ? Boolean(this.timeSlots[i].activityLog.titleBandOn) : false;
                    this.timeSlots[i].activityLog.actualOverride = i === startIndex
                        ? Boolean(this.timeSlots[i].activityLog.actualOverride)
                        : false;
                    if (this.timeSlots[i].activityLog.subActivities && this.timeSlots[i].activityLog.subActivities.length) {
                        this.timeSlots[i].activityLog.subActivities = i === startIndex ? this.timeSlots[i].activityLog.subActivities : [];
                    }
                    if (Array.isArray(this.timeSlots[i].activityLog.actualGridUnits)) {
                        this.timeSlots[i].activityLog.actualGridUnits = i === startIndex ? this.timeSlots[i].activityLog.actualGridUnits : [];
                    } else if (i !== startIndex) {
                        this.timeSlots[i].activityLog.actualGridUnits = [];
                    }
                    if (Array.isArray(this.timeSlots[i].activityLog.actualExtraGridUnits)) {
                        this.timeSlots[i].activityLog.actualExtraGridUnits = i === startIndex ? this.timeSlots[i].activityLog.actualExtraGridUnits : [];
                    } else if (i !== startIndex) {
                        this.timeSlots[i].activityLog.actualExtraGridUnits = [];
                    }
                }
            } else {
                // 우측 열만 병합하는 경우
                for (let i = startIndex; i <= endIndex; i++) {
                    this.timeSlots[i].actual = i === startIndex ? mergedValue : '';
                    if (!this.timeSlots[i].activityLog || typeof this.timeSlots[i].activityLog !== 'object') {
                        this.timeSlots[i].activityLog = { title: '', details: '', subActivities: [], titleBandOn: false, actualGridUnits: [], actualExtraGridUnits: [], actualOverride: false };
                    }
                    this.timeSlots[i].activityLog.titleBandOn = i === startIndex ? Boolean(this.timeSlots[i].activityLog.titleBandOn) : false;
                    this.timeSlots[i].activityLog.actualOverride = i === startIndex
                        ? Boolean(this.timeSlots[i].activityLog.actualOverride)
                        : false;
                    if (this.timeSlots[i].activityLog.subActivities && this.timeSlots[i].activityLog.subActivities.length) {
                        this.timeSlots[i].activityLog.subActivities = i === startIndex ? this.timeSlots[i].activityLog.subActivities : [];
                    }
                    if (Array.isArray(this.timeSlots[i].activityLog.actualGridUnits)) {
                        this.timeSlots[i].activityLog.actualGridUnits = i === startIndex ? this.timeSlots[i].activityLog.actualGridUnits : [];
                    } else if (i !== startIndex) {
                        this.timeSlots[i].activityLog.actualGridUnits = [];
                    }
                    if (Array.isArray(this.timeSlots[i].activityLog.actualExtraGridUnits)) {
                        this.timeSlots[i].activityLog.actualExtraGridUnits = i === startIndex ? this.timeSlots[i].activityLog.actualExtraGridUnits : [];
                    } else if (i !== startIndex) {
                        this.timeSlots[i].activityLog.actualExtraGridUnits = [];
                    }
                }
            }
            
            this.renderTimeEntries();
            this.clearAllSelections();
            this.calculateTotals();
            this.autoSave();
        }
    }
    
    findMergeKey(type, index) {
        for (let [key, value] of this.mergedFields) {
            if (key.startsWith(`${type}-`)) {
                const [, startStr, endStr] = key.split('-');
                const start = parseInt(startStr);
                const end = parseInt(endStr);
                if (index >= start && index <= end) {
                    return key;
                }
            }
        }
        return null;
    }

    getBlockLength(type, index) {
        const mergeKey = this.findMergeKey(type, index);
        if (mergeKey) {
            const [, startStr, endStr] = mergeKey.split('-');
            const start = parseInt(startStr, 10);
            const end = parseInt(endStr, 10);
            if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
                return end - start + 1;
            }
        }
        return 1;
    }

    wrapWithSplitVisualization(type, index, content) {
        const splitMarkup = this.buildSplitVisualization(type, index);
        if (!splitMarkup) return content;
        const typeClass = type === 'planned' ? 'split-type-planned' : 'split-type-actual';
        return `<div class="split-cell-wrapper ${typeClass} split-has-data" data-split-type="${type}" data-index="${index}">
                    ${content}
                    ${splitMarkup}
                </div>`;
    }

    buildSplitVisualization(type, index) {
        const context = this.computeSplitSegments(type, index);
        if (!context) return '';
        const { gridSegments, titleSegments, showTitleBand } = context;
        const isActual = type === 'actual';
        const toggleable = isActual ? (context.toggleable !== undefined ? context.toggleable : true) : false;
        const showLabels = !isActual || Boolean(context.showLabels);
        const useConnections = !isActual || !toggleable;
        const hasGrid = Array.isArray(gridSegments) && gridSegments.length > 0;
        if (!hasGrid && !showTitleBand) return '';

        const classes = ['split-visualization', showTitleBand ? 'has-title' : 'no-title'];
        classes.push(type === 'planned' ? 'split-visualization-planned' : 'split-visualization-actual');
        if (type === 'planned' && showTitleBand && Array.isArray(titleSegments) && titleSegments.length === 1) {
            classes.push('split-visualization-single-title');
        }
        if (isActual) {
            classes.push(toggleable ? 'split-toggleable' : 'split-readonly');
        }

        const titleHtml = showTitleBand
            ? `<div class="split-title-band">${(titleSegments || []).map((segment) => {
                const safeLabel = segment.label ? this.escapeHtml(segment.label) : '&nbsp;';
                const color = this.getSplitColor(type, segment.label, segment.isExtra, segment.reservedIndices, 'title');
                const emptyClass = segment.label ? '' : ' split-empty';
                return `<div class="split-title-segment${emptyClass}" style="grid-column: span ${segment.span}; --split-segment-color: ${color};">${safeLabel}</div>`;
            }).join('')}</div>`
            : '';

        const gridHtml = hasGrid
            ? `<div class="split-grid">${gridSegments.map((segment, idx) => {
                const color = this.getSplitColor(type, segment.label, segment.isExtra, segment.reservedIndices, 'grid');
                const emptyClass = segment.label ? '' : ' split-empty';
                const activeClass = (isActual && toggleable) ? (segment.active ? ' is-on' : ' is-off') : '';
                const connTopClass = (useConnections && segment.connectTop) ? ' connect-top' : '';
                const connBotClass = (useConnections && segment.connectBottom) ? ' connect-bottom' : '';
                const canRenderLabel = Boolean(segment.label)
                    && !segment.suppressHoverLabel
                    && (showLabels || Boolean(segment.alwaysVisibleLabel));
                const safeLabel = canRenderLabel ? this.escapeHtml(segment.label) : '';
                const labelClass = segment.alwaysVisibleLabel ? ' split-grid-label-persistent' : '';
                const labelHtml = safeLabel
                    ? `<span class="split-grid-label${labelClass}" title="${safeLabel}">${safeLabel}</span>`
                    : '';
                const unitAttr = (isActual && toggleable && Number.isFinite(segment.unitIndex))
                    ? ` data-unit-index="${segment.unitIndex}"`
                    : '';
                const extraSafe = (isActual && segment.extraLabel) ? this.escapeHtml(segment.extraLabel) : '';
                const extraAttr = extraSafe ? ` data-extra-label="${extraSafe}"` : '';
                return `<div class="split-grid-segment${emptyClass}${activeClass}${connTopClass}${connBotClass}"${unitAttr}${extraAttr} style="grid-column: span ${segment.span}; --split-segment-color: ${color};">${labelHtml}</div>`;
            }).join('')}</div>`
            : '';

        return `<div class="${classes.join(' ')}" aria-hidden="true">
                    ${titleHtml}
                    ${gridHtml}
                </div>`;
    }

    getPlannedLabelForIndex(index) {
        if (!Number.isInteger(index) || index < 0 || index >= this.timeSlots.length) return '';
        const planBaseIndex = this.getSplitBaseIndex ? this.getSplitBaseIndex('planned', index) : index;
        const slot = this.timeSlots[planBaseIndex];
        if (!slot) return '';
        const plannedMergeKey = this.findMergeKey ? this.findMergeKey('planned', planBaseIndex) : null;
        const mergedPlanLabel = plannedMergeKey ? (this.mergedFields.get(plannedMergeKey) || '') : '';
        const raw = mergedPlanLabel || slot.planTitle || slot.planned || '';
        return this.normalizeActivityText ? this.normalizeActivityText(raw) : String(raw || '').trim();
    }

    isActualOverrideActive(index) {
        const baseIndex = this.getSplitBaseIndex ? this.getSplitBaseIndex('actual', index) : index;
        const slot = this.timeSlots[baseIndex];
        return Boolean(slot && slot.activityLog && slot.activityLog.actualOverride);
    }

    isActualGridMode(index) {
        if (this.isActualOverrideActive(index)) return false;
        const planBaseIndex = this.getSplitBaseIndex ? this.getSplitBaseIndex('planned', index) : index;
        const slot = this.timeSlots[planBaseIndex];
        if (!slot) return false;
        const planActivities = this.normalizePlanActivitiesArray(slot.planActivities);
        const planLabel = this.getPlannedLabelForIndex(planBaseIndex);
        return planActivities.length > 0 || Boolean(planLabel);
    }

    getActualGridUnitCount(baseIndex) {
        const hours = Number(this.getBlockLength('actual', baseIndex) || 0);
        if (!Number.isFinite(hours) || hours <= 0) return 0;
        return Math.max(0, Math.floor(hours * 6));
    }

    buildPlanUnitsForActualGrid(baseIndex) {
        const planBaseIndex = this.getSplitBaseIndex ? this.getSplitBaseIndex('planned', baseIndex) : baseIndex;
        const planSlot = this.timeSlots[planBaseIndex] || {};
        const totalUnits = this.getActualGridUnitCount(baseIndex);
        const planActivities = this.normalizePlanActivitiesArray(planSlot.planActivities);
        const planLabel = this.getPlannedLabelForIndex(planBaseIndex);
        let units = [];

        if (planActivities.length > 0) {
            planActivities.forEach((item) => {
                if (!item) return;
                const label = this.normalizeActivityText
                    ? this.normalizeActivityText(item.label || '')
                    : (typeof item.label === 'string' ? item.label.trim() : '');
                if (!label) return;
                const seconds = Number(item.seconds || 0);
                const unitsCount = seconds > 0 ? Math.max(1, Math.ceil(seconds / 600)) : 0;
                for (let i = 0; i < unitsCount; i++) {
                    units.push(label);
                }
            });
        } else if (planLabel) {
            units = new Array(totalUnits).fill(planLabel);
        }

        if (totalUnits > 0) {
            if (units.length > totalUnits) {
                units = units.slice(0, totalUnits);
            } else if (units.length < totalUnits) {
                units = units.concat(new Array(totalUnits - units.length).fill(''));
            }
        }

        return { units, totalUnits, planBaseIndex, planSlot, planLabel };
    }

    getActualGridUnitsForBase(baseIndex, totalUnits, planUnits = null) {
        const slot = this.timeSlots[baseIndex];
        const raw = (slot && slot.activityLog && Array.isArray(slot.activityLog.actualGridUnits))
            ? slot.activityLog.actualGridUnits.map(value => Boolean(value))
            : [];
        if (!Number.isFinite(totalUnits) || totalUnits <= 0) return [];
        let units = raw;
        if (units.length > totalUnits) units = units.slice(0, totalUnits);
        if (units.length < totalUnits) units = units.concat(new Array(totalUnits - units.length).fill(false));

        const hasAny = units.some(value => value);
        if (!hasAny && Array.isArray(planUnits) && planUnits.length > 0) {
            const activities = this.normalizeActivitiesArray(slot && slot.activityLog && slot.activityLog.subActivities);
            if (activities.length > 0) {
                units = this.buildActualUnitsFromActivities(planUnits, activities);
                if (units.length > totalUnits) units = units.slice(0, totalUnits);
                if (units.length < totalUnits) units = units.concat(new Array(totalUnits - units.length).fill(false));
            }
        }

        return units;
    }

    getActualExtraGridUnitsForBase(baseIndex, totalUnits) {
        const slot = this.timeSlots[baseIndex];
        const raw = (slot && slot.activityLog && Array.isArray(slot.activityLog.actualExtraGridUnits))
            ? slot.activityLog.actualExtraGridUnits.map(value => Boolean(value))
            : [];
        if (!Number.isFinite(totalUnits) || totalUnits <= 0) return [];
        let units = raw;
        if (units.length > totalUnits) units = units.slice(0, totalUnits);
        if (units.length < totalUnits) units = units.concat(new Array(totalUnits - units.length).fill(false));
        return units;
    }

    getExtraActivityUnitCount(item) {
        const actualGridCore = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerActualGridCore)
            ? globalThis.TimeTrackerActualGridCore
            : null;
        if (actualGridCore && typeof actualGridCore.getExtraActivityUnitCount === 'function') {
            return actualGridCore.getExtraActivityUnitCount(item, this.getActualDurationStepSeconds());
        }
        if (!item) return 0;
        const assignedSeconds = Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
        const recordedSeconds = Number.isFinite(item.recordedSeconds)
            ? Math.max(0, Math.floor(item.recordedSeconds))
            : assignedSeconds;
        const step = this.getActualDurationStepSeconds();
        let assignedUnits = assignedSeconds > 0 ? Math.floor(assignedSeconds / step) : 0;
        let recordedUnits = recordedSeconds > 0 ? Math.floor(recordedSeconds / step) : 0;
        if (assignedSeconds > 0 && assignedUnits === 0) assignedUnits = 1;
        if (recordedSeconds > 0 && recordedUnits === 0) recordedUnits = 1;
        return Math.max(assignedUnits, recordedUnits);
    }

    buildExtraSlotAllocation(planUnits, actualUnits, extraActivities, orderIndices = null) {
        const slotsByIndex = Array.isArray(planUnits) ? new Array(planUnits.length).fill('') : [];
        const slotsByLabel = new Map();
        if (!Array.isArray(planUnits) || planUnits.length === 0) {
            return { slotsByIndex, slotsByLabel };
        }
        const normalize = (value) => this.normalizeActivityText
            ? this.normalizeActivityText(value || '')
            : String(value || '').trim();
        const available = [];
        const safeActualUnits = Array.isArray(actualUnits) ? actualUnits : [];
        const useOrder = Array.isArray(orderIndices) && orderIndices.length === planUnits.length
            ? orderIndices
            : null;
        if (useOrder) {
            useOrder.forEach((idx) => {
                if (!Number.isFinite(idx) || idx < 0 || idx >= planUnits.length) return;
                const label = normalize(planUnits[idx] || '');
                if (label) return;
                if (!safeActualUnits[idx]) available.push(idx);
            });
        } else {
            for (let i = 0; i < planUnits.length; i++) {
                const label = normalize(planUnits[i] || '');
                if (label) continue;
                if (!safeActualUnits[i]) available.push(i);
            }
        }
        if (available.length === 0) return { slotsByIndex, slotsByLabel };

        let cursor = 0;
        (Array.isArray(extraActivities) ? extraActivities : []).forEach((item) => {
            if (!item) return;
            const label = this.normalizeActivityText
                ? this.normalizeActivityText(item.label || '')
                : String(item.label || '').trim();
            if (!label) return;
            let units = this.getExtraActivityUnitCount(item);
            while (units > 0 && cursor < available.length) {
                const unitIndex = available[cursor];
                cursor += 1;
                units -= 1;
                slotsByIndex[unitIndex] = label;
                if (!slotsByLabel.has(label)) slotsByLabel.set(label, []);
                slotsByLabel.get(label).push(unitIndex);
            }
        });

        return { slotsByIndex, slotsByLabel };
    }

    getActualGridDisplayOrderIndices(planUnits, activities, planLabelSet) {
        if (!Array.isArray(planUnits) || planUnits.length === 0) return [];
        const labelSet = planLabelSet instanceof Set ? planLabelSet : new Set();
        const normalize = (value) => this.normalizeActivityText
            ? this.normalizeActivityText(value || '')
            : String(value || '').trim();
        const ordered = this.sortActivitiesByOrder(Array.isArray(activities) ? activities : []);
        const labelToIndices = new Map();
        planUnits.forEach((label, idx) => {
            const normalized = normalize(label || '');
            if (!labelToIndices.has(normalized)) {
                labelToIndices.set(normalized, []);
            }
            labelToIndices.get(normalized).push(idx);
        });

        const orderIndices = [];
        const seenIndices = new Set();
        const seenLabels = new Set();
        ordered.forEach((item) => {
            const normalized = normalize(item && item.label || '');
            if (!normalized || !labelSet.has(normalized)) return;
            if (seenLabels.has(normalized)) return;
            seenLabels.add(normalized);
            const indices = labelToIndices.get(normalized) || [];
            indices.forEach((idx) => {
                if (seenIndices.has(idx)) return;
                seenIndices.add(idx);
                orderIndices.push(idx);
            });
        });

        for (let i = 0; i < planUnits.length; i++) {
            if (seenIndices.has(i)) continue;
            seenIndices.add(i);
            orderIndices.push(i);
        }
        return orderIndices;
    }

    getActualGridDisplayOrderIndicesWithExtras(planUnits, actualUnits, activities, planLabelSet) {
        if (!Array.isArray(planUnits) || planUnits.length === 0) return [];
        const labelSet = planLabelSet instanceof Set ? planLabelSet : new Set();
        const normalize = (value) => this.normalizeActivityText
            ? this.normalizeActivityText(value || '')
            : String(value || '').trim();
        const ordered = this.sortActivitiesByOrder(Array.isArray(activities) ? activities : []);
        const labelToIndices = new Map();
        planUnits.forEach((label, idx) => {
            const normalized = normalize(label || '');
            if (!labelToIndices.has(normalized)) {
                labelToIndices.set(normalized, []);
            }
            labelToIndices.get(normalized).push(idx);
        });

        const safeActualUnits = Array.isArray(actualUnits) ? actualUnits : [];
        const available = [];
        for (let i = 0; i < planUnits.length; i++) {
            if (!safeActualUnits[i]) available.push(i);
        }

        const orderIndices = [];
        const seenIndices = new Set();
        const seenLabels = new Set();
        let availableCursor = 0;

        ordered.forEach((item) => {
            const normalized = normalize(item && item.label || '');
            if (!normalized) return;
            if (labelSet.has(normalized)) {
                if (seenLabels.has(normalized)) return;
                seenLabels.add(normalized);
                const indices = labelToIndices.get(normalized) || [];
                indices.forEach((idx) => {
                    if (seenIndices.has(idx)) return;
                    seenIndices.add(idx);
                    orderIndices.push(idx);
                });
                return;
            }

            let units = this.getExtraActivityUnitCount(item);
            while (units > 0 && availableCursor < available.length) {
                const idx = available[availableCursor];
                availableCursor += 1;
                if (seenIndices.has(idx)) continue;
                seenIndices.add(idx);
                orderIndices.push(idx);
                units -= 1;
            }
        });

        for (let i = 0; i < planUnits.length; i++) {
            if (seenIndices.has(i)) continue;
            seenIndices.add(i);
            orderIndices.push(i);
        }
        return orderIndices;
    }

    buildExtraActiveGridUnits(totalUnits, allocation, extraActivities, storedUnits = null) {
        const activeUnits = new Array(Number.isFinite(totalUnits) ? totalUnits : 0).fill(false);
        if (!allocation || !Array.isArray(allocation.slotsByIndex) || activeUnits.length === 0) {
            return activeUnits;
        }
        const storedRaw = Array.isArray(storedUnits) ? storedUnits.map(value => Boolean(value)) : [];
        let stored = storedRaw;
        if (stored.length > activeUnits.length) stored = stored.slice(0, activeUnits.length);
        if (stored.length < activeUnits.length) {
            stored = stored.concat(new Array(activeUnits.length - stored.length).fill(false));
        }

        const step = this.getActualDurationStepSeconds();
        const recordedMap = new Map();
        (Array.isArray(extraActivities) ? extraActivities : []).forEach((item) => {
            if (!item) return;
            const label = this.normalizeActivityText
                ? this.normalizeActivityText(item.label || '')
                : String(item.label || '').trim();
            if (!label) return;
            const baseSeconds = Number.isFinite(item.recordedSeconds)
                ? Math.max(0, Math.floor(item.recordedSeconds))
                : (Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0);
            let units = baseSeconds > 0 ? Math.floor(baseSeconds / step) : 0;
            if (baseSeconds > 0 && units === 0) units = 1;
            if (units > 0) {
                recordedMap.set(label, (recordedMap.get(label) || 0) + units);
            }
        });
        const recordedTotal = Array.from(recordedMap.values()).reduce((sum, value) => sum + value, 0);
        const hasStored = stored.some(value => value);
        const useStored = storedRaw.length > 0 && (hasStored || recordedTotal === 0);

        if (useStored) {
            for (let i = 0; i < activeUnits.length; i++) {
                const label = allocation.slotsByIndex[i];
                if (!label) continue;
                activeUnits[i] = Boolean(stored[i]);
            }
            return activeUnits;
        }

        allocation.slotsByLabel.forEach((indices, label) => {
            const count = recordedMap.get(label) || 0;
            for (let i = 0; i < indices.length && i < count; i++) {
                activeUnits[indices[i]] = true;
            }
        });
        return activeUnits;
    }

    getActualGridBlockRange(planUnits, unitIndex, unitsPerRow = 6) {
        const actualGridCore = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerActualGridCore)
            ? globalThis.TimeTrackerActualGridCore
            : null;
        if (actualGridCore && typeof actualGridCore.getActualGridBlockRange === 'function') {
            return actualGridCore.getActualGridBlockRange(planUnits, unitIndex, unitsPerRow);
        }
        if (!Array.isArray(planUnits) || !Number.isFinite(unitIndex)) return null;
        if (unitIndex < 0 || unitIndex >= planUnits.length) return null;
        const label = planUnits[unitIndex];
        if (!label) return null;

        let start = unitIndex;
        while (start > 0 && planUnits[start - 1] === label) {
            start -= 1;
        }
        let end = unitIndex;
        while (end < planUnits.length - 1 && planUnits[end + 1] === label) {
            end += 1;
        }
        return { start, end, label };
    }

    buildActualUnitsFromActivities(planUnits, activities) {
        const actualGridCore = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerActualGridCore)
            ? globalThis.TimeTrackerActualGridCore
            : null;
        if (actualGridCore && typeof actualGridCore.buildActualUnitsFromActivities === 'function') {
            return actualGridCore.buildActualUnitsFromActivities(planUnits, activities, {
                stepSeconds: this.getActualDurationStepSeconds(),
                normalizeLabel: (value) => this.normalizeActivityText
                    ? this.normalizeActivityText(value || '')
                    : String(value || '').trim(),
            });
        }
        if (!Array.isArray(planUnits) || !Array.isArray(activities)) return [];
        const counts = new Map();
        activities.forEach((item) => {
            if (!item || !item.label) return;
            const label = this.normalizeActivityText
                ? this.normalizeActivityText(item.label || '')
                : String(item.label || '').trim();
            if (!label) return;
            const seconds = Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
            const units = Math.floor(seconds / 600);
            if (units > 0) {
                counts.set(label, (counts.get(label) || 0) + units);
            }
        });

        const output = planUnits.map((label) => {
            if (!label) return false;
            const remaining = counts.get(label) || 0;
            if (remaining > 0) {
                counts.set(label, remaining - 1);
                return true;
            }
            return false;
        });
        return output;
    }

    buildActualActivitiesFromGrid(planUnits, actualUnits) {
        const actualGridCore = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerActualGridCore)
            ? globalThis.TimeTrackerActualGridCore
            : null;
        if (actualGridCore && typeof actualGridCore.buildActualActivitiesFromGrid === 'function') {
            return actualGridCore.buildActualActivitiesFromGrid(planUnits, actualUnits, {
                stepSeconds: this.getActualDurationStepSeconds(),
            });
        }
        if (!Array.isArray(planUnits) || !Array.isArray(actualUnits)) return [];
        const counts = new Map();
        for (let i = 0; i < planUnits.length; i++) {
            if (!actualUnits[i]) continue;
            const label = planUnits[i];
            if (!label) continue;
            counts.set(label, (counts.get(label) || 0) + 1);
        }

        const activities = [];
        const seen = new Set();
        planUnits.forEach((label) => {
            if (!label || seen.has(label)) return;
            const units = counts.get(label);
            if (units) {
                activities.push({ label, seconds: units * 600, source: 'grid' });
            }
            seen.add(label);
        });
        return activities;
    }

    collectActualExtraActivities(baseIndex, planUnits) {
        const slot = this.timeSlots[baseIndex];
        if (!slot) return [];
        const existing = this.normalizeActivitiesArray(slot.activityLog && slot.activityLog.subActivities);
        if (!existing.length) return [];
        const labelSet = new Set();
        if (Array.isArray(planUnits)) {
            planUnits.forEach((label) => {
                const normalized = this.normalizeActivityText
                    ? this.normalizeActivityText(label || '')
                    : String(label || '').trim();
                if (normalized) labelSet.add(normalized);
            });
        }

        return this.sortActivitiesByOrder(existing
            .map((item) => {
                const label = this.normalizeActivityText
                    ? this.normalizeActivityText(item.label || '')
                    : String(item.label || '').trim();
                const seconds = Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
                const source = typeof item.source === 'string' ? item.source : null;
                if (!label && seconds <= 0) return null;
                const isExtra = (source && source !== 'grid') || (label && !labelSet.has(label));
                if (!isExtra) return null;
                const extraSource = (source && source !== 'grid') ? source : 'extra';
                const order = Number.isFinite(item.order) ? Math.max(0, Math.floor(item.order)) : null;
                const extra = { label, seconds, source: extraSource };
                if (order != null) extra.order = order;
                return extra;
            })
            .filter(Boolean));
    }

    syncActualGridToSlots(baseIndex, planUnits, actualUnits) {
        const activities = this.buildActualActivitiesFromGrid(planUnits, actualUnits);
        const planContext = this.buildPlanUnitsForActualGrid(baseIndex);
        const mergedActivities = this.mergeActualActivitiesWithGrid(
            baseIndex,
            planUnits,
            activities,
            null,
            planContext && planContext.planLabel ? planContext.planLabel : ''
        );
        const planLabelContext = this.getActualPlanLabelContext(baseIndex);
        const planLabelSet = (planLabelContext && planLabelContext.labelSet) ? planLabelContext.labelSet : new Set();
        const hasExtras = mergedActivities.some((item) => {
            if (!item) return false;
            const label = this.normalizeActivityText
                ? this.normalizeActivityText(item.label || '')
                : String(item.label || '').trim();
            return Boolean(label) && !planLabelSet.has(label);
        });
        const summary = mergedActivities.length > 0 ? this.formatActivitiesSummary(mergedActivities) : '';
        const actualMergeKey = this.findMergeKey('actual', baseIndex);
        const safeUnits = Array.isArray(actualUnits) ? actualUnits.map(value => Boolean(value)) : [];
        const baseSlot = this.timeSlots[baseIndex];
        const rawExtraUnits = (baseSlot && baseSlot.activityLog && Array.isArray(baseSlot.activityLog.actualExtraGridUnits))
            ? baseSlot.activityLog.actualExtraGridUnits.map(value => Boolean(value))
            : [];
        let safeExtraUnits = rawExtraUnits;
        if (Array.isArray(planUnits) && planUnits.length > 0) {
            if (safeExtraUnits.length > planUnits.length) safeExtraUnits = safeExtraUnits.slice(0, planUnits.length);
            if (safeExtraUnits.length < planUnits.length) {
                safeExtraUnits = safeExtraUnits.concat(new Array(planUnits.length - safeExtraUnits.length).fill(false));
            }
        } else {
            safeExtraUnits = [];
        }

        if (actualMergeKey) {
            const [, startStr, endStr] = actualMergeKey.split('-');
            const start = parseInt(startStr, 10);
            const end = parseInt(endStr, 10);
            this.mergedFields.set(actualMergeKey, summary);
            for (let i = start; i <= end; i++) {
                const slot = this.timeSlots[i];
                if (!slot.activityLog || typeof slot.activityLog !== 'object') {
                    slot.activityLog = { title: '', details: '', subActivities: [], titleBandOn: false, actualGridUnits: [], actualExtraGridUnits: [], actualOverride: false };
                }
                slot.activityLog.actualOverride = (i === start) ? hasExtras : false;
                slot.actual = (i === start) ? summary : '';
                if (i === start) {
                    slot.activityLog.subActivities = mergedActivities.map(item => ({ ...item }));
                    slot.activityLog.actualGridUnits = safeUnits.slice();
                    slot.activityLog.actualExtraGridUnits = safeExtraUnits.slice();
                } else {
                    slot.activityLog.subActivities = [];
                    slot.activityLog.actualGridUnits = [];
                    slot.activityLog.actualExtraGridUnits = [];
                }
            }
            return;
        }

        const slot = this.timeSlots[baseIndex];
        if (!slot.activityLog || typeof slot.activityLog !== 'object') {
            slot.activityLog = { title: '', details: '', subActivities: [], titleBandOn: false, actualGridUnits: [], actualExtraGridUnits: [], actualOverride: false };
        }
        slot.activityLog.actualOverride = hasExtras;
        slot.actual = summary;
        slot.activityLog.subActivities = mergedActivities.map(item => ({ ...item }));
        slot.activityLog.actualGridUnits = safeUnits.slice();
        slot.activityLog.actualExtraGridUnits = safeExtraUnits.slice();
    }

    toggleActualGridUnit(index, unitIndex) {
        const baseIndex = this.getSplitBaseIndex('actual', index);
        const planContext = this.buildPlanUnitsForActualGrid(baseIndex);
        if (!planContext || !Array.isArray(planContext.units) || planContext.units.length === 0) return;
        if (!Number.isFinite(unitIndex) || unitIndex < 0 || unitIndex >= planContext.units.length) return;
        const isMultiRow = this.getBlockLength('actual', baseIndex) > 1;
        const baseLabel = planContext.planLabel || '';
        const isSingleLabel = Boolean(baseLabel) && planContext.units.every(label => label === baseLabel);
        const block = (isMultiRow && isSingleLabel)
            ? { start: 0, end: planContext.units.length - 1, label: baseLabel }
            : this.getActualGridBlockRange(planContext.units, unitIndex, 6);
        if (!block) return;
        const actualUnits = this.getActualGridUnitsForBase(baseIndex, planContext.units.length, planContext.units);
        const { start, end } = block;
        const clickedCount = unitIndex - start + 1;
        let currentOnCount = 0;
        for (let i = start; i <= end; i++) {
            if (actualUnits[i]) {
                currentOnCount += 1;
            } else {
                break;
            }
        }
        const isClickedOn = Boolean(actualUnits[unitIndex]);
        let newCount = clickedCount;
        if (isClickedOn && currentOnCount === clickedCount) {
            newCount = 0;
        }

        for (let i = start; i <= end; i++) {
            actualUnits[i] = i < start + newCount;
        }
        this.syncActualGridToSlots(baseIndex, planContext.units, actualUnits);
        this.renderTimeEntries(true);
        this.calculateTotals();
        this.autoSave();
    }

    toggleExtraGridUnit(index, extraLabel, unitIndex = null) {
        const baseIndex = this.getSplitBaseIndex('actual', index);
        const slot = this.timeSlots[baseIndex];
        if (!slot) return;
        const normalizedLabel = this.normalizeActivityText
            ? this.normalizeActivityText(extraLabel || '')
            : String(extraLabel || '').trim();
        if (!normalizedLabel) return;
        const planContext = this.buildPlanUnitsForActualGrid(baseIndex);
        const planUnits = (planContext && Array.isArray(planContext.units)) ? planContext.units : [];
        if (planUnits.length === 0) return;
        const actualUnits = this.getActualGridUnitsForBase(baseIndex, planUnits.length, planUnits);
        const rawSub = (slot.activityLog && Array.isArray(slot.activityLog.subActivities))
            ? slot.activityLog.subActivities
            : [];
        const normalizedSub = this.normalizeActivitiesArray(rawSub).map(item => ({ ...item }));
        const orderedActual = this.sortActivitiesByOrder(normalizedSub);
        const planLabelContext = this.getActualPlanLabelContext(baseIndex);
        const planLabelSet = (planLabelContext && planLabelContext.labelSet) ? planLabelContext.labelSet : new Set();
        const extras = orderedActual.filter((item) => {
            const label = this.normalizeActivityText
                ? this.normalizeActivityText(item.label || '')
                : String(item.label || '').trim();
            return Boolean(label) && !planLabelSet.has(label);
        });
        if (extras.length === 0) return;

        let displayOrder = this.getActualGridDisplayOrderIndicesWithExtras(planUnits, actualUnits, orderedActual, planLabelSet);
        if (displayOrder.length !== planUnits.length) {
            displayOrder = planUnits.map((_, idx) => idx);
        }
        const allocation = this.buildExtraSlotAllocation(planUnits, actualUnits, extras, displayOrder);
        const labelSlots = allocation && allocation.slotsByLabel
            ? allocation.slotsByLabel.get(normalizedLabel)
            : null;
        if (!labelSlots || labelSlots.length === 0) return;

        const totalUnits = planUnits.length;
        const currentExtraUnits = this.buildExtraActiveGridUnits(
            totalUnits,
            allocation,
            extras,
            slot.activityLog ? slot.activityLog.actualExtraGridUnits : null
        );
        const sortedSlots = labelSlots.slice().sort((a, b) => a - b);
        const targetUnitIndex = Number.isFinite(unitIndex) ? unitIndex : sortedSlots[sortedSlots.length - 1];
        if (!sortedSlots.includes(targetUnitIndex)) return;

        const targetPos = sortedSlots.indexOf(targetUnitIndex);
        if (targetPos < 0) return;

        let currentOnCount = 0;
        for (let i = 0; i < sortedSlots.length; i++) {
            if (currentExtraUnits[sortedSlots[i]]) {
                currentOnCount += 1;
            } else {
                break;
            }
        }
        const isClickedOn = Boolean(currentExtraUnits[targetUnitIndex]);
        let newCount = targetPos + 1;
        if (isClickedOn && currentOnCount === newCount) {
            newCount = 0;
        }

        const nextExtraUnits = currentExtraUnits.slice();
        sortedSlots.forEach((idx, i) => {
            nextExtraUnits[idx] = i < newCount;
        });

        if (!slot.activityLog || typeof slot.activityLog !== 'object') {
            slot.activityLog = { title: '', details: '', subActivities: [], titleBandOn: false, actualGridUnits: [], actualExtraGridUnits: [], actualOverride: false };
        }
        slot.activityLog.actualExtraGridUnits = nextExtraUnits.slice();

        const step = this.getActualDurationStepSeconds();
        const newRecordedUnits = sortedSlots.reduce((sum, idx) => sum + (nextExtraUnits[idx] ? 1 : 0), 0);
        const targetIndex = normalizedSub.findIndex((item) => {
            const label = this.normalizeActivityText
                ? this.normalizeActivityText(item && item.label || '')
                : String(item && item.label || '').trim();
            return label && label === normalizedLabel;
        });
        if (targetIndex >= 0) {
            normalizedSub[targetIndex].recordedSeconds = this.normalizeActualDurationStep(newRecordedUnits * step);
        }

        const cleaned = normalizedSub
            .filter(item => item && (item.label || item.seconds > 0))
            .map(item => ({
                label: item.label || '',
                seconds: this.normalizeActualDurationStep(Number.isFinite(item.seconds) ? item.seconds : 0),
                recordedSeconds: Number.isFinite(item.recordedSeconds)
                    ? this.normalizeActualDurationStep(item.recordedSeconds)
                    : null,
                source: item.source || null
            }))
            .filter(item => item.label || item.seconds > 0);

        slot.activityLog.subActivities = cleaned.map(item => ({ ...item }));

        this.syncActualGridToSlots(baseIndex, planUnits, actualUnits);
        this.renderTimeEntries(true);
        this.calculateTotals();
        this.autoSave();
    }

    applyActualGridSeconds(baseIndex, secondsToAdd, startRow = 0) {
        if (this.isActualOverrideActive(baseIndex)) return false;
        const planContext = this.buildPlanUnitsForActualGrid(baseIndex);
        if (!planContext || !Array.isArray(planContext.units) || planContext.units.length === 0) return false;
        const normalized = this.normalizeDurationStep(Number.isFinite(secondsToAdd) ? secondsToAdd : 0) || 0;
        const unitsToAdd = Math.floor(normalized / 600);
        if (unitsToAdd <= 0) return false;

        const actualUnits = this.getActualGridUnitsForBase(baseIndex, planContext.units.length, planContext.units);
        const unitsPerRow = 6;
        let remaining = unitsToAdd;
        let unitIndex = Math.max(0, Math.floor(startRow)) * unitsPerRow;

        while (remaining > 0 && unitIndex < planContext.units.length) {
            const label = planContext.units[unitIndex];
            if (label && !actualUnits[unitIndex]) {
                actualUnits[unitIndex] = true;
                remaining -= 1;
            }
            unitIndex += 1;
        }

        if (remaining === unitsToAdd) return false;
        this.syncActualGridToSlots(baseIndex, planContext.units, actualUnits);
        return true;
    }

    computeSplitSegments(type, index) {
        if (!Number.isInteger(index) || index < 0 || index >= this.timeSlots.length) return null;
        const baseIndex = this.getSplitBaseIndex(type, index);
        if (!Number.isInteger(baseIndex) || baseIndex < 0 || baseIndex >= this.timeSlots.length) return null;

        const slot = this.timeSlots[baseIndex];
        if (!slot) return null;

        const range = this.getSplitRange(type, index);
        if (!range || index < range.start || index > range.end) return null;

        const isMergedRange = range &&
            Number.isInteger(range.start) &&
            Number.isInteger(range.end) &&
            range.end > range.start;

        // 병합 범위에서는 기준 행에만 오버레이를 그려 단일 카드처럼 보이도록 처리
        if (isMergedRange && index !== baseIndex) {
            return null;
        }

        const unitsPerRow = 6;

        const planBaseIndex = this.getSplitBaseIndex ? this.getSplitBaseIndex('planned', baseIndex) : baseIndex;
        const planSlot = (Number.isInteger(planBaseIndex) && planBaseIndex >= 0 && planBaseIndex < this.timeSlots.length)
            ? this.timeSlots[planBaseIndex]
            : slot;

        const normalizedPlanTitle = this.normalizeActivityText
            ? this.normalizeActivityText(planSlot.planTitle || '')
            : (planSlot.planTitle || '').trim();

        const plannedMergeKey = this.findMergeKey ? this.findMergeKey('planned', planBaseIndex) : null;
        const mergedPlanLabel = plannedMergeKey ? (this.mergedFields.get(plannedMergeKey) || '') : '';

        const normalizedPlannedLabel = this.normalizeActivityText
            ? this.normalizeActivityText(mergedPlanLabel || planSlot.planTitle || planSlot.planned || '')
            : String(mergedPlanLabel || planSlot.planTitle || planSlot.planned || '').trim();

        const planTitleBand = Boolean(planSlot.planTitleBandOn && normalizedPlanTitle);

        // 제목 밴드는 항상 분해 범위의 첫 번째 행에만 한 번 표시
        const showTitleBand = (index === baseIndex) && planTitleBand;

        let titleSegments = [];
        if (showTitleBand) {
            if (type === 'planned') {
                if (normalizedPlanTitle) {
                    titleSegments = [{ label: normalizedPlanTitle, span: unitsPerRow }];
                }
            } else {
                // 실제(우측) 분해: 좌측 계획 제목과 동일하게 표시 (좌측에 없으면 표시 안 함)
                const rawTitle = normalizedPlanTitle || normalizedPlannedLabel;
                const normalizedTitle = this.normalizeActivityText
                    ? this.normalizeActivityText(rawTitle || '')
                    : String(rawTitle || '').trim();
                if (normalizedTitle) {
                    titleSegments = [{ label: normalizedTitle, span: unitsPerRow }];
                }
            }
        }

        const actualActivities = (type === 'actual')
            ? this.normalizeActivitiesArray(slot.activityLog && slot.activityLog.subActivities)
            : [];
        const actualOverrideActive = (type === 'actual')
            && Boolean(slot.activityLog && slot.activityLog.actualOverride);
        const shouldUseActualActivities = (type === 'actual')
            && actualActivities.length > 0
            && (actualOverrideActive || !this.isActualGridMode(baseIndex));

        const buildSegmentsFromActivities = (activities, options = {}) => {
            const units = [];
            if (Array.isArray(activities)) {
                activities.forEach((item) => {
                    if (!item) return;
                    const label = this.normalizeActivityText
                        ? this.normalizeActivityText(item.label || '')
                        : (typeof item.label === 'string' ? item.label.trim() : '');
                    const seconds = Number(item.seconds || 0);
                    const unitsCount = seconds > 0 ? Math.max(1, Math.ceil(seconds / 600)) : 0;
                    for (let i = 0; i < unitsCount; i++) {
                        units.push(label);
                    }
                });
            }

            const offset = index - baseIndex;
            if (offset < 0) return null;

            const maxOffset = Math.ceil(units.length / unitsPerRow) - 1;
            if (units.length === 0 && index !== baseIndex) {
                return null;
            }
            if (units.length > 0 && offset > maxOffset) return null;

            const useFullUnits = isMergedRange && index === baseIndex;
            const startUnit = useFullUnits ? 0 : offset * unitsPerRow;
            const endUnit = useFullUnits ? units.length : startUnit + unitsPerRow;
            const slice = units.length > 0 ? units.slice(startUnit, endUnit) : [];

            const segments = [];

            if (slice.length > 0) {
                let segmentStartIdx = 0;

                for (let i = 0; i < slice.length; i++) {
                    const label = slice[i];
                    const isLastItem = (i === slice.length - 1);
                    const nextIsRowStart = ((i + 1) % unitsPerRow === 0);
                    const nextLabel = isLastItem ? null : slice[i + 1];

                    const needsBreak = isLastItem || label !== nextLabel || nextIsRowStart;
                    if (!needsBreak) continue;

                    const span = i - segmentStartIdx + 1;
                    const connectTop = (
                        segmentStartIdx > 0 &&
                        segmentStartIdx % unitsPerRow === 0 &&
                        slice[segmentStartIdx - 1] === label
                    );
                    const connectBottom = (
                        nextIsRowStart &&
                        !isLastItem &&
                        slice[i + 1] === label
                    );

                    segments.push({ label, span, connectTop, connectBottom });
                    segmentStartIdx = i + 1;
                }
            }

            const filledUnits = slice.length;
            const remainder = filledUnits % unitsPerRow;
            if (filledUnits === 0) {
                segments.push({ label: '', span: unitsPerRow, connectTop: false, connectBottom: false });
            } else if (remainder !== 0) {
                const remaining = unitsPerRow - remainder;
                if (segments.length && segments[segments.length - 1].label === '') {
                    segments[segments.length - 1].span += remaining;
                } else {
                    segments.push({ label: '', span: remaining, connectTop: false, connectBottom: false });
                }
            }

            const hasLabels = segments.some(seg => seg && seg.label);

            if (!hasLabels && !showTitleBand) {
                return null; // 빈 병합 영역에서는 시각화 자체를 숨김
            }

            if (!hasLabels && showTitleBand) {
                return { gridSegments: [], titleSegments, showTitleBand, ...options };
            }

            return { gridSegments: segments, titleSegments, showTitleBand, ...options };
        };

        const buildGridSegmentsFromActivities = (activities, totalUnits, options = {}) => {
            let units = [];
            if (Array.isArray(activities)) {
                activities.forEach((item) => {
                    if (!item) return;
                    const label = this.normalizeActivityText
                        ? this.normalizeActivityText(item.label || '')
                        : (typeof item.label === 'string' ? item.label.trim() : '');
                    const seconds = Number(item.seconds || 0);
                    const unitsCount = seconds > 0 ? Math.max(1, Math.ceil(seconds / 600)) : 0;
                    for (let i = 0; i < unitsCount; i++) {
                        units.push(label);
                    }
                });
            }

            if (Number.isFinite(totalUnits) && totalUnits > 0) {
                if (units.length > totalUnits) units = units.slice(0, totalUnits);
                if (units.length < totalUnits) {
                    units = units.concat(new Array(totalUnits - units.length).fill(''));
                }
            }

            const offset = index - baseIndex;
            if (offset < 0) return null;

            const maxOffset = Math.ceil(units.length / unitsPerRow) - 1;
            if (units.length === 0 && index !== baseIndex) {
                return null;
            }
            if (units.length > 0 && offset > maxOffset) return null;

            const useFullUnits = isMergedRange && index === baseIndex;
            const startUnit = useFullUnits ? 0 : offset * unitsPerRow;
            const endUnit = useFullUnits ? units.length : startUnit + unitsPerRow;
            const slice = units.length > 0 ? units.slice(startUnit, endUnit) : [];

            const planLabelSet = options.planLabelSet instanceof Set ? options.planLabelSet : null;
            const reservedIndices = options.reservedIndices instanceof Set ? options.reservedIndices : null;
            const persistExtraFirstLabel = Boolean(options.persistExtraFirstLabel);
            const gridSegments = [];
            const firstExtraSeen = new Set();
            if (slice.length === 0) {
                for (let i = 0; i < unitsPerRow; i++) {
                    gridSegments.push({ label: '', span: 1 });
                }
            } else {
                slice.forEach((label) => {
                    const isExtra = planLabelSet && label ? !planLabelSet.has(label) : false;
                    const alwaysVisibleLabel = Boolean(
                        persistExtraFirstLabel
                        && label
                        && isExtra
                        && !firstExtraSeen.has(label)
                    );
                    const suppressHoverLabel = Boolean(
                        persistExtraFirstLabel
                        && label
                        && isExtra
                        && !alwaysVisibleLabel
                    );
                    if (alwaysVisibleLabel) {
                        firstExtraSeen.add(label);
                    }
                    gridSegments.push({
                        label,
                        span: 1,
                        isExtra,
                        reservedIndices,
                        alwaysVisibleLabel,
                        suppressHoverLabel
                    });
                });
                const remainder = slice.length % unitsPerRow;
                if (remainder !== 0) {
                    const remaining = unitsPerRow - remainder;
                    for (let i = 0; i < remaining; i++) {
                        gridSegments.push({ label: '', span: 1 });
                    }
                }
            }

            const hasLabels = units.some(label => label);
            if (!hasLabels && !showTitleBand) {
                return null;
            }
            if (!hasLabels && showTitleBand) {
                return { gridSegments: [], titleSegments, showTitleBand, ...options };
            }
            return { gridSegments, titleSegments, showTitleBand, ...options };
        };

          if (shouldUseActualActivities) {
              const totalUnits = this.getActualGridUnitCount(baseIndex);
              const planContext = this.buildPlanUnitsForActualGrid(baseIndex);
              const planUnits = (planContext && Array.isArray(planContext.units)) ? planContext.units : [];
              const planLabelSet = new Set();
              planUnits.forEach((label) => {
                  const normalized = this.normalizeActivityText
                      ? this.normalizeActivityText(label || '')
                      : String(label || '').trim();
                  if (normalized) planLabelSet.add(normalized);
              });
              const reservedIndices = this.getPaletteIndicesForLabels(planLabelSet);

              // When we have planned grid units + extra activities, keep the plan-grid clickable,
              // and "insert" extra segments into the remaining (unrecorded) slots for display.
              if (type === 'actual' && actualOverrideActive && planUnits.length > 0) {
                  const actualUnits = this.getActualGridUnitsForBase(baseIndex, planUnits.length, planUnits);
                  const rawSub = (slot && slot.activityLog && Array.isArray(slot.activityLog.subActivities))
                      ? slot.activityLog.subActivities
                      : [];
                  const normalizedSub = this.normalizeActivitiesArray(rawSub).map(item => ({ ...item }));
                  const orderedActual = this.sortActivitiesByOrder(normalizedSub);
                  const extras = orderedActual.filter((item) => {
                      const label = this.normalizeActivityText
                          ? this.normalizeActivityText(item.label || '')
                          : String(item.label || '').trim();
                      return Boolean(label) && !planLabelSet.has(label);
                  });
                  let displayOrder = this.getActualGridDisplayOrderIndicesWithExtras(planUnits, actualUnits, orderedActual, planLabelSet);
                  if (displayOrder.length !== planUnits.length) {
                      displayOrder = planUnits.map((_, idx) => idx);
                  }
                  const allocation = this.buildExtraSlotAllocation(planUnits, actualUnits, extras, displayOrder);
                  const extraActiveUnits = this.buildExtraActiveGridUnits(
                      planUnits.length,
                      allocation,
                      extras,
                      slot && slot.activityLog ? slot.activityLog.actualExtraGridUnits : null
                  );
                  const shownExtraLabels = new Set();

                  const gridSegments = displayOrder.map((unitIndex) => {
                      const label = planUnits[unitIndex];
                      const extraLabel = allocation && allocation.slotsByIndex
                          ? allocation.slotsByIndex[unitIndex]
                          : '';
                      if (extraLabel) {
                          const alwaysVisibleLabel = !shownExtraLabels.has(extraLabel);
                          const suppressHoverLabel = !alwaysVisibleLabel;
                          if (alwaysVisibleLabel) {
                              shownExtraLabels.add(extraLabel);
                          }
                          return {
                              label: extraLabel,
                              span: 1,
                              unitIndex,
                              active: Boolean(extraActiveUnits[unitIndex]),
                              isExtra: true,
                              reservedIndices,
                              extraLabel,
                              alwaysVisibleLabel,
                              suppressHoverLabel
                          };
                      }
                      return {
                          label,
                          span: 1,
                          unitIndex,
                          active: Boolean(actualUnits[unitIndex]),
                          isExtra: false,
                          reservedIndices
                      };
                  });

                  const hasLabels = planUnits.some(label => label) || extras.length > 0;
                  if (!hasLabels && !showTitleBand) {
                      return null;
                  }
                  if (!hasLabels && showTitleBand) {
                      return { gridSegments: [], titleSegments, showTitleBand, toggleable: true, showLabels: true };
                  }
                  return { gridSegments, titleSegments, showTitleBand, toggleable: true, showLabels: true };
              }

              return buildGridSegmentsFromActivities(actualActivities, totalUnits, {
                  toggleable: false,
                  showLabels: false,
                  planLabelSet,
                  reservedIndices,
                  persistExtraFirstLabel: true
              });
          }

        if (type === 'actual') {
            const planContext = this.buildPlanUnitsForActualGrid(baseIndex);
            const planUnits = (planContext && Array.isArray(planContext.units)) ? planContext.units : [];
            if (planUnits.length === 0) {
                if (!showTitleBand) return null;
                return { gridSegments: [], titleSegments, showTitleBand, toggleable: true, showLabels: false };
            }
            const actualUnits = this.getActualGridUnitsForBase(baseIndex, planUnits.length, planUnits);
            const planLabelSet = new Set();
            planUnits.forEach((label) => {
                const normalized = this.normalizeActivityText
                    ? this.normalizeActivityText(label || '')
                    : String(label || '').trim();
                if (normalized) planLabelSet.add(normalized);
            });
            const orderedActual = this.sortActivitiesByOrder(actualActivities);
            let displayOrder = this.getActualGridDisplayOrderIndices(planUnits, orderedActual, planLabelSet);
            if (displayOrder.length !== planUnits.length) {
                displayOrder = planUnits.map((_, idx) => idx);
            }
            const gridSegments = displayOrder.map((unitIndex) => ({
                label: planUnits[unitIndex],
                span: 1,
                unitIndex,
                active: Boolean(actualUnits[unitIndex])
            }));
            const hasLabels = planUnits.some(label => label);
            if (!hasLabels && !showTitleBand) {
                return null;
            }
            if (!hasLabels && showTitleBand) {
                return { gridSegments: [], titleSegments, showTitleBand, toggleable: true, showLabels: true };
            }
            return { gridSegments, titleSegments, showTitleBand, toggleable: true, showLabels: true };
        }

        const activities = this.getSplitActivities(type, baseIndex);
        return buildSegmentsFromActivities(activities);
    }

    getSplitRange(type, index) {
        const mergeKey = this.findMergeKey(type, index);
        if (mergeKey) {
            const [, startStr, endStr] = mergeKey.split('-');
            const start = parseInt(startStr, 10);
            const end = parseInt(endStr, 10);
            if (Number.isInteger(start) && Number.isInteger(end)) {
                return { start, end };
            }
        }
        return { start: index, end: index };
    }

    getSplitBaseIndex(type, index) {
        const mergeKey = this.findMergeKey(type, index);
        if (mergeKey) {
            const [, startStr] = mergeKey.split('-');
            const start = parseInt(startStr, 10);
            if (Number.isInteger(start)) return start;
        }
        return index;
    }

    getSplitActivities(type, baseIndex) {
        const slot = this.timeSlots[baseIndex];
        if (!slot) return [];
        if (type === 'planned') {
            return this.normalizePlanActivitiesArray(slot.planActivities).map(item => ({ ...item }));
        }

          const sub = slot.activityLog && slot.activityLog.subActivities;
          const normalizedActual = this.normalizeActivitiesArray(sub).map(item => ({ ...item }));
          const actualOverrideActive = Boolean(slot.activityLog && slot.activityLog.actualOverride);
          const planActs = this.normalizePlanActivitiesArray(slot.planActivities);

          // actualOverrideActive + planned grid exists:
          // render the main grid by "recorded" time for planned labels (from actualGridUnits),
          // while keeping extra labels as-is (assigned == recorded for extras).
          if (actualOverrideActive) {
              const planContext = this.buildPlanUnitsForActualGrid(baseIndex);
              const planUnits = (planContext && Array.isArray(planContext.units)) ? planContext.units : [];
              if (planUnits.length > 0) {
                  const planLabelSet = new Set();
                  planUnits.forEach((label) => {
                      const normalized = this.normalizeActivityText
                          ? this.normalizeActivityText(label || '')
                          : String(label || '').trim();
                      if (normalized) planLabelSet.add(normalized);
                  });
                  const actualUnits = this.getActualGridUnitsForBase(baseIndex, planUnits.length, planUnits);
                  const recordMap = this.getActualGridSecondsMap(planUnits, actualUnits);
                  return normalizedActual.map((item) => {
                      const label = this.normalizeActivityText
                          ? this.normalizeActivityText(item.label || '')
                          : String(item.label || '').trim();
                      if (label && planLabelSet.has(label)) {
                          return { ...item, seconds: recordMap.get(label) || 0, source: 'grid' };
                      }
                      const recordedSeconds = Number.isFinite(item.recordedSeconds)
                          ? Math.max(0, Math.floor(item.recordedSeconds))
                          : (Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0);
                      return { ...item, seconds: recordedSeconds };
                  });
              }
              return normalizedActual;
          }

        // 계획 분해가 있으면 계획 레이아웃 그대로 사용 (라벨 텍스트만)
        if (!actualOverrideActive && planActs && planActs.length > 0) {
            const blockSeconds = Math.max(3600, this.getBlockLength('actual', baseIndex) * 3600);
            const fallbackSeconds = Math.max(600, Math.floor(blockSeconds / Math.max(1, planActs.length)));
            return planActs
                .map((item) => {
                    if (!item) return null;
                    const baseLabel = this.normalizeActivityText
                        ? this.normalizeActivityText(item.label || '')
                        : (item.label || '').trim();
                    if (!baseLabel) return null;
                    const planSeconds = Number.isFinite(item.seconds) && item.seconds > 0
                        ? Math.floor(item.seconds)
                        : fallbackSeconds;
                    return { label: baseLabel, seconds: planSeconds, source: 'plan-template' };
                })
                .filter(Boolean);
        }

        const planLabel = this.getPlannedLabelForIndex(baseIndex);
        if (planLabel) {
            const blockSeconds = Math.max(3600, this.getBlockLength('actual', baseIndex) * 3600);
            return [{ label: planLabel, seconds: blockSeconds, source: 'plan-template' }];
        }

        // 계획이 없을 때는 실제 분해만으로 그리드 생성
        return normalizedActual;
    }

    getPaletteIndexForLabel(label, paletteLength) {
        if (!label || !paletteLength) return 0;
        const base = Math.abs(this.hashStringColor(label));
        return base % paletteLength;
    }

    getPaletteIndicesForLabels(labelSet) {
        if (!(labelSet instanceof Set)) return new Set();
        const plannedPalette = [
            '#a6d9ff', '#ffdca3', '#c8f0c0',
            '#cbbef3', '#ffb2a3', '#fafca4'
        ];
        const indices = new Set();
        labelSet.forEach((label) => {
            if (!label) return;
            const idx = this.getPaletteIndexForLabel(label, plannedPalette.length);
            indices.add(idx);
        });
        return indices;
    }

    normalizeSplitColorLabel(type, label) {
        let colorKey = label;
        if (type === 'actual') {
            const m = String(colorKey || '').match(/^(.+?)\s+\d+(시간|분|초)(\s+\d+(분|초))?$/);
            if (m && m[1]) {
                colorKey = m[1].trim();
            }
        }
        if (this.normalizeActivityText) {
            colorKey = this.normalizeActivityText(colorKey || '');
        } else {
            colorKey = String(colorKey || '').trim();
        }
        return colorKey;
    }

    getSplitColorKey(type, label, role = 'grid') {
        const normalized = this.normalizeSplitColorLabel(type, label);
        if (!normalized) return '';
        const safeRole = role === 'title' ? 'title' : 'grid';
        return `${safeRole}:${normalized}`;
    }

    getSplitColorBasePalette() {
        return [
            '#a6d9ff', '#ffdca3', '#c8f0c0',
            '#cbbef3', '#ffb2a3', '#fafca4'
        ];
    }

    getSplitColorFromIndex(index) {
        const palette = this.getSplitColorBasePalette();
        if (index < palette.length) return palette[index];
        const offset = index - palette.length;
        const hue = (offset * 137.508) % 360;
        const lightnessLevels = [82, 74, 66, 60];
        const saturationLevels = [68, 60, 52];
        const cycle = Math.floor(offset / 360);
        const lightness = lightnessLevels[cycle % lightnessLevels.length];
        const saturation = saturationLevels[Math.floor(cycle / lightnessLevels.length) % saturationLevels.length];
        return `hsl(${hue.toFixed(1)}, ${saturation}%, ${lightness}%)`;
    }

    getNextSplitColor() {
        if (!this.splitColorUsed) {
            this.splitColorUsed = new Set();
        }
        if (!Number.isInteger(this.splitColorSeed)) {
            this.splitColorSeed = 0;
        }
        let attempts = 0;
        while (attempts < 5000) {
            const color = this.getSplitColorFromIndex(this.splitColorSeed);
            this.splitColorSeed += 1;
            if (!this.splitColorUsed.has(color)) {
                this.splitColorUsed.add(color);
                return color;
            }
            attempts += 1;
        }
        return '#dfe4ea';
    }

    getSplitColor(type, label, isExtra = false, reservedIndices = null, role = 'grid') {
        const colorKey = this.getSplitColorKey(type, label, role);
        if (!colorKey) {
            return type === 'planned' ? 'rgba(223, 228, 234, 0.6)' : 'rgba(224, 236, 255, 0.45)';
        }
        if (!this.splitColorRegistry) {
            this.splitColorRegistry = new Map();
            this.splitColorUsed = new Set();
            this.splitColorSeed = 0;
        }
        let color = this.splitColorRegistry.get(colorKey);
        if (!color) {
            color = this.getNextSplitColor();
            this.splitColorRegistry.set(colorKey, color);
        }
        return color;
    }

    hashStringColor(label) {
        if (!label) return 0;
        let hash = 0;
        for (let i = 0; i < label.length; i++) {
            hash = ((hash << 5) - hash) + label.charCodeAt(i);
            hash |= 0;
        }
        return hash;
    }

    escapeHtml(text) {
        const textCore = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerTextCore)
            ? globalThis.TimeTrackerTextCore
            : null;
        if (textCore && typeof textCore.escapeHtml === 'function') {
            return textCore.escapeHtml(text);
        }
        if (text == null) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    escapeAttribute(text) {
        const textCore = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerTextCore)
            ? globalThis.TimeTrackerTextCore
            : null;
        if (textCore && typeof textCore.escapeAttribute === 'function') {
            return textCore.escapeAttribute(text);
        }
        return this.escapeHtml(text);
    }

    normalizeMergeKey(rawMergeKey, expectedType = null) {
        const textCore = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerTextCore)
            ? globalThis.TimeTrackerTextCore
            : null;
        if (textCore && typeof textCore.normalizeMergeKey === 'function') {
            const slotCount = Array.isArray(this.timeSlots) ? this.timeSlots.length : null;
            return textCore.normalizeMergeKey(rawMergeKey, expectedType, slotCount);
        }
        const match = /^(planned|actual|time)-(\d+)-(\d+)$/.exec(String(rawMergeKey || '').trim());
        if (!match) return null;
        const type = match[1];
        const start = parseInt(match[2], 10);
        const end = parseInt(match[3], 10);
        if (expectedType && type !== expectedType) return null;
        if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end >= this.timeSlots.length) {
            return null;
        }
        return `${type}-${start}-${end}`;
    }

    createTimerField(index, slot) {
        return `<div class="actual-field-container">
                    <input type="text" class="input-field actual-input timer-result-input" 
                           data-index="${index}" 
                           data-type="actual" 
                           value="${this.escapeAttribute(slot.actual)}"
                           placeholder="활동 기록">
                    <button class="activity-log-btn" data-index="${index}" aria-label="활동 상세 기록 열기" title="상세 기록 열기">📝</button>
                </div>`;
    }

    createMergedTimeField(mergeKey, index, slot) {
        const safeMergeKey = this.normalizeMergeKey(mergeKey, 'time');
        if (!safeMergeKey) {
            const timerControls = this.createTimerControls(index, slot);
            return `<div class="time-slot-container">
                        <div class="time-label">${this.formatSlotTimeLabel(slot.time)}</div>
                        ${timerControls}
                    </div>`;
        }

        const [, startStr, endStr] = safeMergeKey.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);

        if (index === start) {
            // 병합된 시간 필드의 주 셀 - 시간 범위 표시 및 단일 타이머 컨트롤
            const timerControls = this.createTimerControls(index, slot);
            
            // 시간 범위 생성 (예: 12 ~ 13 형태)
            const startTime = this.formatSlotTimeLabel(this.timeSlots[start].time);
            const endTime = this.formatSlotTimeLabel(this.timeSlots[end].time);
            const timeRangeDisplay = `${startTime} ~ ${endTime}`;
            
            return `<div class="time-slot-container merged-time-main" 
                           data-merge-key="${safeMergeKey}"
                           data-merge-start="${start}"
                           data-merge-end="${end}">
                        <div class="merged-time-content">
                            <div class="time-label">${timeRangeDisplay}</div>
                            ${timerControls}
                        </div>
                    </div>`;
        } else if (index === end) {
            // 병합된 시간 필드의 마지막 보조 셀 - 하단 경계선 유지
            return `<div class="time-slot-container merged-time-secondary merged-time-last" 
                           data-merge-key="${safeMergeKey}"
                           data-merge-start="${start}"
                           data-merge-end="${end}">
                        <div class="time-label merged-secondary-hidden"></div>
                    </div>`;
        } else {
            // 병합된 시간 필드의 중간 보조 셀 - 완전히 경계선 제거
            return `<div class="time-slot-container merged-time-secondary" 
                           data-merge-key="${safeMergeKey}"
                           data-merge-start="${start}"
                           data-merge-end="${end}">
                        <div class="time-label merged-secondary-hidden"></div>
                    </div>`;
        }
    }

    createTimerControls(index, slot) {
        const isRunning = slot.timer.running;
        const hasElapsed = slot.timer.elapsed > 0;
        const eligibility = this.getTimerEligibility(index, slot);

        let buttonIcon = '시작';
        let buttonAction = 'start';
        let buttonDisabled = (!eligibility.canStartWithoutDate && !isRunning) || eligibility.disabledByDate;
        let buttonTitle = '';

        const timerController = (typeof globalThis !== 'undefined' && globalThis.TimerController)
            ? globalThis.TimerController
            : null;
        if (timerController && typeof timerController.resolveTimerControlState === 'function') {
            const state = timerController.resolveTimerControlState(
                eligibility,
                { isRunning, hasElapsed },
                {
                    notToday: '오늘 날짜에서만 타이머를 사용할 수 있습니다.',
                    noPlanned: '계획을 먼저 입력해주세요.',
                    outOfRange: '현재 시간 범위에서만 시작할 수 있습니다.',
                }
            );
            buttonIcon = state.buttonIcon;
            buttonAction = state.buttonAction;
            buttonDisabled = state.buttonDisabled;
            buttonTitle = state.buttonTitle;
        } else {
            if (isRunning) {
                buttonIcon = '일시정지';
                buttonAction = 'pause';
                buttonDisabled = false;
            } else if (hasElapsed) {
                buttonIcon = '재개';
                buttonAction = 'resume';
                buttonDisabled = !eligibility.canStartWithoutDate || eligibility.disabledByDate;
            }

            if (buttonDisabled) {
                if (eligibility.disabledByDate) {
                    buttonTitle = '오늘 날짜에서만 타이머를 사용할 수 있습니다.';
                } else if (!eligibility.hasPlannedActivity) {
                    buttonTitle = '계획을 먼저 입력해주세요.';
                } else if (!eligibility.isCurrentTimeInRange) {
                    buttonTitle = '현재 시간 범위에서만 시작할 수 있습니다.';
                }
            }
        }

        const startButtonAttributes = [];
        if (buttonDisabled) startButtonAttributes.push('disabled');
        if (buttonTitle) startButtonAttributes.push(`title="${buttonTitle}"`);
        const startButtonAttrString = startButtonAttributes.length ? ' ' + startButtonAttributes.join(' ') : '';

        const stopButtonStyle = isRunning || hasElapsed ? 'display: inline-block;' : 'display: none;';
        const timerDisplayStyle = isRunning || hasElapsed ? 'display: block;' : 'display: none;';
        const timerDisplay = this.formatTime(slot.timer.elapsed);

        return `
            <div class="timer-controls-container ${isRunning ? 'timer-running' : ''}" data-index="${index}">
                <div class="timer-controls">
                    <button class="timer-btn timer-start-pause" 
                            data-index="${index}" 
                            data-action="${buttonAction}" aria-label="타이머 ${buttonIcon}"${startButtonAttrString}>
                        ${buttonIcon}
                    </button>
                    <button class="timer-btn timer-stop" 
                            data-index="${index}" 
                            data-action="stop" aria-label="타이머 정지"
                            style="${stopButtonStyle}">
                        정지
                    </button>
                </div>
                <div class="timer-display" style="${timerDisplayStyle}">${timerDisplay}</div>
            </div>
        `;
    }
    
    formatTime(seconds) {
        const durationCore = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerDurationCore)
            ? globalThis.TimeTrackerDurationCore
            : null;
        if (durationCore && typeof durationCore.formatTime === 'function') {
            return durationCore.formatTime(seconds);
        }
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    formatDurationSummary(rawSeconds) {
        const durationCore = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerDurationCore)
            ? globalThis.TimeTrackerDurationCore
            : null;
        if (durationCore && typeof durationCore.formatDurationSummary === 'function') {
            return durationCore.formatDurationSummary(rawSeconds);
        }
        if (!Number.isFinite(rawSeconds) || rawSeconds <= 0) {
            return '0시간';
        }
        const seconds = Math.floor(rawSeconds);
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        const parts = [];
        if (hours > 0) parts.push(`${hours}시간`);
        if (minutes > 0) parts.push(`${minutes}분`);
        if (secs > 0 && parts.length === 0) {
            parts.push(`${secs}초`);
        } else if (secs > 0 && parts.length > 0) {
            parts.push(`${secs}초`);
        }
        return parts.join(' ') || '0시간';
    }

    formatActivitiesSummary(activities, options = {}) {
        const activityCore = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerActivityCore)
            ? globalThis.TimeTrackerActivityCore
            : null;
        if (activityCore && typeof activityCore.formatActivitiesSummary === 'function') {
            return activityCore.formatActivitiesSummary(activities, {
                hideTotal: Boolean(options && options.hideTotal),
                normalizeActivityText: (value) => this.normalizeActivityText
                    ? this.normalizeActivityText(value || '')
                    : String(value || '').trim(),
                normalizeDurationStep: (seconds) => this.normalizeDurationStep(seconds),
                formatDurationSummary: (seconds) => this.formatDurationSummary(seconds),
            });
        }
        const items = Array.isArray(activities) ? activities : [];
        if (items.length === 0) return '';
        const normalized = items
            .map(item => ({
                label: this.normalizeActivityText ? this.normalizeActivityText(item.label || '') : (item.label || '').trim(),
                seconds: this.normalizeDurationStep(Number.isFinite(item.seconds) ? Number(item.seconds) : 0)
            }))
            .filter(item => item.label || item.seconds > 0);
        if (normalized.length === 0) return '';

        const parts = normalized.map(item => {
            const label = item.label || '';
            const duration = this.formatDurationSummary(item.seconds);
            return label ? `${label} ${duration}` : duration;
        });
        const total = normalized.reduce((sum, item) => sum + item.seconds, 0);
        const totalLabel = options.hideTotal ? '' : ` (총 ${this.formatDurationSummary(total)})`;
        return `${parts.join(' · ')}${totalLabel}`.trim();
    }

    normalizeDurationStep(seconds) {
        const durationCore = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerDurationCore)
            ? globalThis.TimeTrackerDurationCore
            : null;
        if (durationCore && typeof durationCore.normalizeDurationStep === 'function') {
            return durationCore.normalizeDurationStep(seconds);
        }
        if (!Number.isFinite(seconds)) return null;
        // 더 작은 단위(초)도 보존하도록 변경
        return Math.max(0, Math.floor(seconds));
    }

    getActualDurationStepSeconds() {
        return 600;
    }

    normalizeActualDurationStep(seconds) {
        const durationCore = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerDurationCore)
            ? globalThis.TimeTrackerDurationCore
            : null;
        if (durationCore && typeof durationCore.normalizeActualDurationStep === 'function') {
            return durationCore.normalizeActualDurationStep(seconds, this.getActualDurationStepSeconds());
        }
        if (!Number.isFinite(seconds)) return 0;
        const step = this.getActualDurationStepSeconds();
        return Math.max(0, Math.round(seconds / step) * step);
    }

    normalizeActivitiesArray(raw) {
        const activityCore = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerActivityCore)
            ? globalThis.TimeTrackerActivityCore
            : null;
        if (activityCore && typeof activityCore.normalizeActivitiesArray === 'function') {
            return activityCore.normalizeActivitiesArray(raw, {
                normalizeActivityText: (value) => this.normalizeActivityText
                    ? this.normalizeActivityText(value || '')
                    : String(value || '').trim(),
                normalizeDurationStep: (seconds) => this.normalizeDurationStep(seconds),
            });
        }
        if (!Array.isArray(raw)) return [];
        return raw
            .filter(item => item && typeof item === 'object')
            .map(item => {
                const labelSource = (item.label ?? item.title ?? '').toString();
                const label = this.normalizeActivityText ? this.normalizeActivityText(labelSource) : labelSource.trim();
                const rawSeconds = Number.isFinite(item.seconds) ? Number(item.seconds) : 0;
                const seconds = this.normalizeDurationStep(rawSeconds) ?? 0;
                const source = typeof item.source === 'string' ? item.source : null;
                const rawRecorded = Number.isFinite(item.recordedSeconds) ? Number(item.recordedSeconds) : null;
                const recordedSeconds = rawRecorded == null
                    ? null
                    : (this.normalizeDurationStep(rawRecorded) ?? 0);
                const order = Number.isFinite(item.order) ? Math.max(0, Math.floor(item.order)) : null;
                const normalized = { label, seconds, source };
                if (rawRecorded != null) {
                    normalized.recordedSeconds = recordedSeconds;
                }
                if (order != null) {
                    normalized.order = order;
                }
                return normalized;
            })
            .filter(item => item.label || item.seconds > 0);
    }

    normalizePlanActivitiesArray(raw) {
        const activityCore = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerActivityCore)
            ? globalThis.TimeTrackerActivityCore
            : null;
        if (activityCore && typeof activityCore.normalizePlanActivitiesArray === 'function') {
            return activityCore.normalizePlanActivitiesArray(raw, {
                normalizeActivityText: (value) => this.normalizeActivityText
                    ? this.normalizeActivityText(value || '')
                    : String(value || '').trim(),
                normalizeDurationStep: (seconds) => this.normalizeDurationStep(seconds),
            });
        }
        if (!Array.isArray(raw)) return [];
        return raw
            .filter(item => item && typeof item === 'object')
            .map(item => {
                const labelSource = (item.label ?? item.title ?? '').toString();
                const label = this.normalizeActivityText ? this.normalizeActivityText(labelSource) : labelSource.trim();
                const rawSeconds = Number.isFinite(item.seconds) ? Number(item.seconds) : 0;
                const seconds = this.normalizeDurationStep(rawSeconds) ?? 0;
                return { label, seconds };
            })
            .filter(item => item.label || item.seconds > 0);
    }

    formatSecondsForInput(seconds) {
        const inputFormatCore = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerInputFormatCore)
            ? globalThis.TimeTrackerInputFormatCore
            : null;
        if (inputFormatCore && typeof inputFormatCore.formatSecondsForInput === 'function') {
            return inputFormatCore.formatSecondsForInput(seconds);
        }
        if (!Number.isFinite(seconds) || seconds <= 0) return '00:00';
        const total = Math.floor(seconds);
        const hrs = Math.floor(total / 3600);
        const mins = Math.floor((total % 3600) / 60);
        const secs = total % 60;
        if (secs === 0) {
            return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
        }
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    formatMinutesForInput(seconds) {
        const inputFormatCore = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerInputFormatCore)
            ? globalThis.TimeTrackerInputFormatCore
            : null;
        if (inputFormatCore && typeof inputFormatCore.formatMinutesForInput === 'function') {
            return inputFormatCore.formatMinutesForInput(seconds);
        }
        if (!Number.isFinite(seconds) || seconds <= 0) return '0';
        return String(Math.round(seconds / 60));
    }

    formatSpinnerValue(kind, seconds) {
        const inputFormatCore = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerInputFormatCore)
            ? globalThis.TimeTrackerInputFormatCore
            : null;
        if (inputFormatCore && typeof inputFormatCore.formatSpinnerValue === 'function') {
            return inputFormatCore.formatSpinnerValue(kind, seconds);
        }
        return kind === 'actual'
            ? this.formatMinutesForInput(seconds)
            : this.formatSecondsForInput(seconds);
    }

    clearSubActivitiesForIndex(index) {
        const mergeKey = this.findMergeKey('actual', index);
        if (mergeKey) {
            const [, startStr, endStr] = mergeKey.split('-');
            const start = parseInt(startStr, 10);
            const end = parseInt(endStr, 10);
            for (let i = start; i <= end; i++) {
                const slot = this.timeSlots[i];
                if (slot && slot.activityLog && Array.isArray(slot.activityLog.subActivities)) {
                    slot.activityLog.subActivities = [];
                    slot.activityLog.titleBandOn = false;
                    slot.activityLog.actualOverride = false;
                    if (Array.isArray(slot.activityLog.actualGridUnits)) {
                        slot.activityLog.actualGridUnits = [];
                    }
                    if (Array.isArray(slot.activityLog.actualExtraGridUnits)) {
                        slot.activityLog.actualExtraGridUnits = [];
                    }
                }
            }
        } else {
            const slot = this.timeSlots[index];
            if (slot && slot.activityLog && Array.isArray(slot.activityLog.subActivities)) {
                slot.activityLog.subActivities = [];
                slot.activityLog.titleBandOn = false;
                slot.activityLog.actualOverride = false;
                if (Array.isArray(slot.activityLog.actualGridUnits)) {
                    slot.activityLog.actualGridUnits = [];
                }
                if (Array.isArray(slot.activityLog.actualExtraGridUnits)) {
                    slot.activityLog.actualExtraGridUnits = [];
                }
            }
        }
    }

    enforceActualLimit(index) {
        const actualMergeKey = this.findMergeKey('actual', index);
        let baseIndex = index;
        let rangeStart = index;
        let rangeEnd = index;
        if (actualMergeKey) {
            const [, startStr, endStr] = actualMergeKey.split('-');
            const parsedStart = parseInt(startStr, 10);
            const parsedEnd = parseInt(endStr, 10);
            if (Number.isFinite(parsedStart)) {
                baseIndex = parsedStart;
                rangeStart = parsedStart;
            }
            if (Number.isFinite(parsedEnd)) {
                rangeEnd = parsedEnd;
            }
        }
        const limit = this.getBlockLength('actual', baseIndex) * 3600;
        if (!(limit > 0)) return;
        const slot = this.timeSlots[baseIndex];
        if (!slot) return;
        const value = actualMergeKey
            ? String(this.mergedFields.get(actualMergeKey) || slot.actual || '').trim()
            : String(slot.actual || '').trim();
        const secs = this.parseDurationFromText(value);
        if (secs != null && Number.isFinite(secs) && secs > limit) {
            const clamped = this.formatDurationSummary(limit);
            if (actualMergeKey) {
                this.mergedFields.set(actualMergeKey, clamped);
                for (let i = rangeStart; i <= rangeEnd; i++) {
                    if (!this.timeSlots[i]) continue;
                    this.timeSlots[i].actual = (i === rangeStart) ? clamped : '';
                }
            } else {
                if (slot.actual === clamped) return;
                slot.actual = clamped;
            }
            try {
                const row = document.querySelector(`[data-index="${baseIndex}"]`);
                if (row) {
                    const input = row.querySelector('.timer-result-input');
                    if (input) input.value = clamped;
                }
            } catch (_) {}
            this.showNotification('기록 시간은 한 칸당 최대 60분까지 입력할 수 있습니다.');
        }
    }

    getPlanActivitiesForIndex(index) {
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

    updatePlanActivitiesAssignment(baseIndex, label, seconds) {
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

    getValidPlanActivitiesSeconds() {
        if (!Array.isArray(this.modalPlanActivities)) return 0;
        return this.modalPlanActivities.reduce((sum, item) => {
            if (!item || item.invalid) return sum;
            const secs = Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
            return sum + secs;
        }, 0);
    }

    getPlanUIElements() {
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

    updatePlanActivitiesToggleLabel() {
        const toggleBtn = document.getElementById('togglePlanActivities');
        if (toggleBtn) {
            toggleBtn.textContent = this.modalPlanSectionOpen ? '세부 활동 접기' : '세부 활동 분해';
        }
    }

    updatePlanActivitiesSummary() {
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

    syncPlanTitleBandToggleState() {
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

    renderPlanActivitiesList() {
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

    isValidPlanRow(index) {
        return Number.isInteger(index)
            && index >= 0
            && index < (this.modalPlanActivities ? this.modalPlanActivities.length : 0);
    }

    updatePlanRowActiveStyles() {
        const { list } = this.getPlanUIElements();
        if (!list) return;
        const activeIndex = this.isValidPlanRow(this.modalPlanActiveRow) ? this.modalPlanActiveRow : -1;
        list.querySelectorAll('.sub-activity-row').forEach((rowEl) => {
            const idx = parseInt(rowEl.dataset.index, 10);
            rowEl.classList.toggle('active', idx === activeIndex);
        });
    }

    setPlanActiveRow(index, options = {}) {
        const validIndex = this.isValidPlanRow(index) ? index : -1;
        this.modalPlanActiveRow = validIndex;
        this.updatePlanRowActiveStyles();
        if (options.focusLabel && this.isValidPlanRow(validIndex)) {
            this.focusPlanRowLabel(validIndex);
        }
    }

    focusPlanRowLabel(index) {
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

    syncSelectedActivitiesFromPlan(options = {}) {
        const planLabels = Array.from(new Set(
            (this.modalPlanActivities || [])
                .map(item => this.normalizeActivityText ? this.normalizeActivityText(item?.label || '') : (item?.label || '').trim())
                .filter(Boolean)
        ));
        const changed = planLabels.length !== (this.modalSelectedActivities || []).length
            || planLabels.some((label, idx) => label !== this.modalSelectedActivities[idx]);
        if (changed) {
            this.modalSelectedActivities = planLabels;
        }
        if (options.rerenderDropdown) {
            this.renderPlannedActivityDropdown();
        }
        return changed;
    }

    resolveRecommendedPlanSeconds(meta = {}) {
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

    createDurationSpinner({ kind, index, seconds }) {
        const spinner = document.createElement('div');
        spinner.className = 'time-spinner';
        spinner.dataset.kind = kind;
        spinner.dataset.index = String(index);
        spinner.dataset.seconds = String(Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0);

        const display = (kind === 'actual') ? document.createElement('input') : document.createElement('div');
        if (kind === 'actual') {
            display.type = 'text';
            display.inputMode = 'numeric';
            display.autocomplete = 'off';
            display.placeholder = '분';
            display.className = 'spinner-display actual-duration-input';
            display.value = this.formatSpinnerValue(kind, Number(spinner.dataset.seconds));
            display.setAttribute('aria-label', '분 입력');
        } else {
            display.className = 'spinner-display';
            display.textContent = this.formatSpinnerValue(kind, Number(spinner.dataset.seconds));
        }

        const controls = document.createElement('div');
        controls.className = 'spinner-controls';

        const upBtn = document.createElement('button');
        upBtn.type = 'button';
        upBtn.className = 'spinner-btn spinner-up';
        upBtn.dataset.direction = 'up';
        upBtn.dataset.kind = kind;
        upBtn.dataset.index = String(index);
        upBtn.textContent = '▲';

        const downBtn = document.createElement('button');
        downBtn.type = 'button';
        downBtn.className = 'spinner-btn spinner-down';
        downBtn.dataset.direction = 'down';
        downBtn.dataset.kind = kind;
        downBtn.dataset.index = String(index);
        downBtn.textContent = '▼';

        controls.appendChild(upBtn);
        controls.appendChild(downBtn);
        spinner.appendChild(display);
        spinner.appendChild(controls);

        return spinner;
    }

    createActualTimeControl({ kind, index, seconds, label, disabled = false }) {
        const control = document.createElement('div');
        control.className = `actual-time-control actual-time-${kind}`;
        control.dataset.kind = kind;
        control.dataset.index = String(index);
        if (label) control.dataset.label = label;
        if (disabled) control.classList.add('is-disabled');

        const caption = document.createElement('div');
        caption.className = 'actual-time-caption';
        caption.textContent = kind === 'grid' ? '기록' : '배정';

        const upBtn = document.createElement('button');
        upBtn.type = 'button';
        upBtn.className = 'actual-time-btn actual-time-up';
        upBtn.dataset.kind = kind;
        upBtn.dataset.direction = 'up';
        upBtn.dataset.index = String(index);
        upBtn.textContent = '▲';

        const input = document.createElement('input');
        input.type = 'text';
        input.inputMode = 'numeric';
        input.autocomplete = 'off';
        input.className = `actual-time-input actual-${kind}-input`;
        input.dataset.kind = kind;
        input.dataset.index = String(index);
        input.value = this.formatSecondsForInput(Number.isFinite(seconds) ? seconds : 0);
        input.readOnly = true;
        input.setAttribute('aria-label', kind === 'grid' ? '기록 시간' : '배정 시간');

        const downBtn = document.createElement('button');
        downBtn.type = 'button';
        downBtn.className = 'actual-time-btn actual-time-down';
        downBtn.dataset.kind = kind;
        downBtn.dataset.direction = 'down';
        downBtn.dataset.index = String(index);
        downBtn.textContent = '▼';

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

    updateSpinnerDisplay(spinner, seconds) {
        if (!spinner) return;
        const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
        const adjusted = this.normalizeDurationStep(safeSeconds) || 0;
        spinner.dataset.seconds = String(adjusted);
        const display = spinner.querySelector('.spinner-display');
        if (display) {
            const kind = spinner.dataset.kind;
            const formatted = this.formatSpinnerValue(kind, adjusted);
            if (display.tagName === 'INPUT') {
                display.value = formatted;
            } else {
                display.textContent = formatted;
            }
        }
        this.updateSpinnerState(spinner);
    }

    updateSpinnerState(spinner) {
        if (!spinner) return;
        const kind = spinner.dataset.kind;
        if (kind !== 'plan') return;
        const index = parseInt(spinner.dataset.index, 10);
        const seconds = parseInt(spinner.dataset.seconds, 10) || 0;
        const upBtn = spinner.querySelector('.spinner-up');
        const downBtn = spinner.querySelector('.spinner-down');

        const limit = Number(this.modalPlanTotalSeconds) || 0;
        const items = this.modalPlanActivities || [];

        let available = 0;
        if (Number.isFinite(limit) && limit > 0 && Array.isArray(items)) {
            const otherSum = items.reduce((sum, item, idx) => {
                if (idx === index || !item) return sum;
                const secs = Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
                return sum + secs;
            }, 0);
            available = Math.max(0, limit - otherSum);
        }

        if (downBtn) {
            downBtn.disabled = seconds <= 0 && available <= 0;
        }

        if (upBtn) {
            upBtn.disabled = !(Number.isFinite(limit) && limit > 0) || seconds >= available;
        }
    }

    refreshSpinnerStates(kind) {
        document.querySelectorAll(`.time-spinner[data-kind="${kind}"]`).forEach((spinner) => {
            this.updateSpinnerState(spinner);
        });
    }

    adjustActivityDuration(kind, index, direction) {
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

    openPlanActivitiesSection() {
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

    closePlanActivitiesSection() {
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

    addPlanActivityRow(defaults = {}) {
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

    handlePlanActivitiesInput(event) {
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

    applyPlanActivityLabelSelection(index, label) {
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

    openPlanActivityMenu(index, anchorEl) {
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
        menu.appendChild(buildSection('노션', grouped.notion || []));

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

    positionPlanActivityMenu(anchorEl) {
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

    closePlanActivityMenu() {
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

    openPlanTitleMenu(anchorEl, options = {}) {
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
        menu.appendChild(buildSection('노션', grouped.notion || []));

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

    positionPlanTitleMenu(anchorEl) {
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

    closePlanTitleMenu() {
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

    handlePlanActivitiesRemoval(event) {
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

    insertPlanLabelToRow(label, meta = {}) {
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

    removePlanActivitiesByLabel(label) {
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

    syncInlinePlanToSlots() {
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

    fillRemainingPlanActivity() {
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

    ensurePlanTitleButton(inputEl) {
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

    getPlanTitleInputValue(inputEl) {
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

    setPlanTitleInputDisplay(inputEl, value) {
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

    setPlanTitle(text) {
        const normalized = this.normalizeActivityText
            ? this.normalizeActivityText(text)
            : (text || '').trim();
        this.modalPlanTitle = normalized;
        const input = this.ensurePlanTitleButton(document.getElementById('planTitleInput'));
        this.setPlanTitleInputDisplay(input, normalized);
        this.syncPlanTitleBandToggleState();
        if (this.renderPlanTitleDropdown) this.renderPlanTitleDropdown();
    }

    confirmPlanTitleSelection() {
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

    renderPlanTitleDropdown(options = {}) {
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
        const activeSource = this.currentPlanSource === 'notion' ? 'notion' : 'local';

        const suggestions = [];
        const seen = new Set();
        (this.plannedActivities || []).forEach((item) => {
            if (!item) return;
            const label = this.normalizeActivityText ? this.normalizeActivityText(item.label || '') : (item.label || '').trim();
            if (!label || seen.has(label)) return;
            const source = item.source === 'notion' ? 'notion' : 'local';
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

    preparePlanActivitiesSection(startIndex, endIndex) {
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

    // 텍스트에서 시간값(HH:MM(:SS) 또는 1h/분/초 표기)을 초로 파싱
    // 규칙: 문자열 어디에 있든 "마지막으로 등장한" 시간을 우선 사용
    parseDurationFromText(text) {
        const core = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerCore)
            ? globalThis.TimeTrackerCore
            : null;
        if (core && typeof core.parseDurationFromText === 'function') {
            return core.parseDurationFromText(text, (seconds) => this.normalizeDurationStep(seconds));
        }

        if (!text || typeof text !== 'string') return null;
        const t = text.trim();

        // 1) HH:MM(:SS) 패턴 전체를 훑어서 마지막 매치를 사용
        try {
            const all = Array.from(t.matchAll(/(\d{1,2}):(\d{2})(?::(\d{2}))?/g));
            if (all.length) {
                const m = all[all.length - 1];
                const h = parseInt(m[1] || '0', 10);
                const mm = parseInt(m[2] || '0', 10);
                const ss = parseInt(m[3] || '0', 10) || 0;
                if (mm < 60 && ss < 60) return this.normalizeDurationStep(h * 3600 + mm * 60 + ss);
            }
        } catch (_) {}

        // 2) 영문/한글 단위 토큰을 문자열 어디서나 탐지해 조합
        let H = null, M = null, S = null;
        try {
            for (const m of t.matchAll(/(\d+)\s*(시간|h|hr|hrs)/gi)) { H = parseInt(m[1], 10); }
            for (const m of t.matchAll(/(\d+)\s*(분|m|min|mins)/gi)) { M = parseInt(m[1], 10); }
            for (const m of t.matchAll(/(\d+)\s*(초|s|sec|secs)/gi)) { S = parseInt(m[1], 10); }
        } catch (_) {}
        if (H != null || M != null || S != null) {
            const hh = H || 0, mm = M || 0, ss = S || 0;
            return this.normalizeDurationStep(hh * 3600 + mm * 60 + ss);
        }

        // 3) 단일 숫자 + 분/초 토큰 (문자열 내 어디든)
        const onlyMin = Array.from(t.matchAll(/(\d+)\s*(분|m|min)/gi)).pop();
        if (onlyMin) return this.normalizeDurationStep(parseInt(onlyMin[1], 10) * 60);
        const onlySec = Array.from(t.matchAll(/(\d+)\s*(초|s|sec)/gi)).pop();
        if (onlySec) return this.normalizeDurationStep(parseInt(onlySec[1], 10));

        return null;
    }

    parseActualDurationInput(value) {
        const text = String(value || '').trim();
        if (!text) return 0;
        const parsed = this.parseDurationFromText(text);
        if (parsed != null && Number.isFinite(parsed)) {
            return parsed;
        }
        if (/^\d+$/.test(text)) {
            return parseInt(text, 10) * 60;
        }
        return null;
    }

    // 실제 활동 입력 변경 시, 텍스트에 포함된 시간값을 timer.elapsed로 반영
    syncTimerElapsedFromActualInput(index, text) {
        const secs = this.parseDurationFromText(text);
        if (secs == null || isNaN(secs)) return;
        const slot = this.timeSlots[index];
        if (!slot || !slot.timer) return;
        slot.timer.elapsed = Math.max(0, Math.floor(secs));
        slot.timer.running = false;
        slot.timer.startTime = null;
        slot.timer.method = 'manual';

        // 타이머 표시 즉시 갱신 (존재할 경우)
        try {
            const row = document.querySelector(`[data-index="${index}"]`);
            if (row) {
                const disp = row.querySelector('.timer-display');
                if (disp) {
                    disp.textContent = this.formatTime(slot.timer.elapsed);
                    if (slot.timer.elapsed > 0) disp.style.display = 'block';
                }
            }
        } catch (_) {}
    }
    
    getCurrentTimeIndex() {
        if (!this.isCurrentDateToday()) {
            return -1;
        }
        const now = new Date();
        const currentHour = now.getHours();
        
        // 4시-23시는 순서대로
        if (currentHour >= 4 && currentHour <= 23) {
            return currentHour - 4;
        }
        // 0시-3시는 마지막 부분
        if (currentHour >= 0 && currentHour <= 3) {
            return 20 + currentHour;
        }
        return -1; // 해당 시간 없음
    }

    isCurrentDateToday() {
        try {
            const today = this.getTodayLocalDateString();
            return this.currentDate === today;
        } catch (_) {
            return false;
        }
    }

    getTimerEligibility(index, slotOverride = null) {
        const slot = slotOverride || this.timeSlots[index] || {};
        const currentIndex = this.getCurrentTimeIndex();
        const isCurrentDateToday = this.isCurrentDateToday();

        const timerController = (typeof globalThis !== 'undefined' && globalThis.TimerController)
            ? globalThis.TimerController
            : null;
        if (timerController && typeof timerController.resolveTimerEligibility === 'function') {
            return timerController.resolveTimerEligibility({
                index,
                currentIndex,
                isCurrentDateToday,
                slotPlanned: slot.planned,
                findMergeKey: (type, rowIndex) => this.findMergeKey(type, rowIndex),
                getMergedField: (mergeKey) => this.mergedFields.get(mergeKey),
            });
        }

        let timeStart = index;
        let timeEnd = index;
        const timeMergeKey = this.findMergeKey('time', index);
        if (timeMergeKey) {
            const parts = timeMergeKey.split('-');
            timeStart = parseInt(parts[1], 10);
            timeEnd = parseInt(parts[2], 10);
        }

        let plannedText = '';
        const plannedMergeKeyForIndex = this.findMergeKey('planned', index);
        const plannedMergeKeyForCurrent = currentIndex >= 0 ? this.findMergeKey('planned', currentIndex) : null;
        if (plannedMergeKeyForIndex) {
            plannedText = (this.mergedFields.get(plannedMergeKeyForIndex) || '').trim();
        } else if (plannedMergeKeyForCurrent) {
            plannedText = (this.mergedFields.get(plannedMergeKeyForCurrent) || '').trim();
        } else {
            plannedText = String(slot.planned || '').trim();
        }

        const hasPlannedActivity = plannedText !== '';
        const isCurrentTimeInRange = currentIndex >= timeStart && currentIndex <= timeEnd;
        const disabledByDate = !isCurrentDateToday;
        const canStartWithoutDate = hasPlannedActivity && isCurrentTimeInRange;

        return {
            index,
            currentIndex,
            isCurrentDateToday,
            timeStart,
            timeEnd,
            plannedText,
            hasPlannedActivity,
            isCurrentTimeInRange,
            disabledByDate,
            canStartWithoutDate,
        };
    }

    canStartTimer(index) {
        return this.getTimerStartBlockReason(index) === null;
    }

    getTimerStartBlockReason(index) {
        const eligibility = this.getTimerEligibility(index);
        const timerController = (typeof globalThis !== 'undefined' && globalThis.TimerController)
            ? globalThis.TimerController
            : null;
        if (timerController && typeof timerController.getStartBlockReason === 'function') {
            return timerController.getStartBlockReason(eligibility, {
                notToday: '오늘 날짜에서만 타이머를 사용할 수 있습니다.',
                invalidCurrentSlot: '현재 시간 슬롯에서만 시작할 수 있습니다.',
                noPlanned: '계획된 활동이 있어야 타이머를 시작할 수 있습니다.',
                outOfRange: '현재 시간 범위의 칸에서만 타이머를 시작할 수 있습니다.',
            });
        }

        if (!eligibility.isCurrentDateToday) {
            return '오늘 날짜에서만 타이머를 사용할 수 있습니다.';
        }
        if (!Number.isFinite(eligibility.currentIndex) || eligibility.currentIndex < 0) {
            return '현재 시간 슬롯에서만 시작할 수 있습니다.';
        }
        if (!eligibility.hasPlannedActivity) {
            return '계획된 활동이 있어야 타이머를 시작할 수 있습니다.';
        }
        if (!eligibility.isCurrentTimeInRange) {
            return '현재 시간 범위의 칸에서만 타이머를 시작할 수 있습니다.';
        }
        return null;
    }
    
    createMergedField(mergeKey, type, index, value) {
        const safeMergeKey = this.normalizeMergeKey(mergeKey, type);
        if (!safeMergeKey) {
            if (type === 'actual') {
                return this.createTimerField(index, { ...this.timeSlots[index], actual: value || '' });
            }
            return `<input type="text" class="input-field ${type}-input" 
                           data-index="${index}" 
                           data-type="${type}" 
                           value="${this.escapeAttribute(value || '')}"
                           placeholder="계획을 입력하려면 클릭 또는 Enter" readonly tabindex="0" aria-label="계획 활동 입력" title="클릭해서 계획 선택/입력" style="cursor: pointer;">`;
        }

        const [, startStr, endStr] = safeMergeKey.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        const safeMergeValue = this.escapeAttribute(this.mergedFields.get(safeMergeKey) || '');
        
        if (type === 'actual') {
            // 우측 실제 활동 열의 경우 입력 필드와 버튼을 포함하는 컨테이너로 처리
            if (index === start) {
                return `<div class="actual-field-container merged-actual-main" 
                               data-merge-key="${safeMergeKey}"
                               data-merge-start="${start}"
                               data-merge-end="${end}">
                            <div class="actual-merged-overlay">
                                <input type="text" class="input-field actual-input timer-result-input merged-field" 
                                       data-index="${index}" 
                                       data-type="actual" 
                                       data-merge-key="${safeMergeKey}"
                                       value="${safeMergeValue}"
                                       placeholder="활동 기록">
                                <button class="activity-log-btn" data-index="${index}" aria-label="활동 상세 기록 열기" title="상세 기록 열기">📝</button>
                            </div>
                        </div>`;
            } else {
                const isLast = index === end;
                return `<div class="actual-field-container merged-actual-secondary ${isLast ? 'merged-actual-last' : ''}" 
                               data-merge-key="${safeMergeKey}"
                               data-merge-start="${start}"
                               data-merge-end="${end}">
                            <input type="text" class="input-field actual-input merged-secondary" 
                                   data-index="${index}" 
                                   data-type="actual" 
                                   data-merge-key="${safeMergeKey}"
                                   value="${safeMergeValue}"
                                   readonly
                                   tabindex="-1"
                                   style="cursor: pointer; opacity: 0;"
                                   placeholder="">
                        </div>`;
            }
        } else {
            // 좌측 계획 열도 절대배치 오버레이로 시각적 병합, 레이아웃 유지
            if (index === start) {
                return `<div class="planned-merged-main-container" 
                               data-merge-key="${safeMergeKey}"
                               data-merge-start="${start}"
                               data-merge-end="${end}">
                            <div class="planned-merged-overlay">
                                <input type="text" class="input-field ${type}-input merged-field merged-main" 
                                       data-index="${index}" 
                                       data-type="${type}" 
                                       data-merge-key="${safeMergeKey}"
                                       data-merge-start="${start}"
                                       data-merge-end="${end}"
                                       value="${safeMergeValue}"
                                       placeholder="계획을 입력하려면 클릭 또는 Enter" readonly tabindex="0" aria-label="병합된 계획 활동 입력" title="클릭해서 계획 선택/입력" style="cursor: pointer;">
                            </div>
                        </div>`;
            } else {
                const isLast = index === end;
                return `<input type="text" class="input-field ${type}-input merged-secondary planned-merged-secondary ${isLast ? 'merged-planned-last' : ''}" 
                               data-index="${index}" 
                               data-type="${type}" 
                               data-merge-key="${safeMergeKey}"
                               data-merge-start="${start}"
                               data-merge-end="${end}"
                               value="${safeMergeValue}"
                               readonly
                               tabindex="-1"
                               style="cursor: pointer;"
                               placeholder="">`;
            }
        }
    }

    // 병합된 시간열의 컨텐츠(레이블+버튼)를 병합 블록의 세로 중앙으로 이동
    centerMergedTimeContent(root = document) {
        try {
            const scope = root || document;
            const mains = scope.querySelectorAll('.time-slot-container.merged-time-main');
            if (!mains || mains.length === 0) return;

            mains.forEach(main => {
                const content = main.querySelector('.merged-time-content');
                if (!content) return;

                // 초기화: 위치 원복
                content.style.transform = '';
                main.style.removeProperty('--merged-block-height');

                const start = parseInt(main.getAttribute('data-merge-start'), 10);
                const end = parseInt(main.getAttribute('data-merge-end'), 10);
                // 블록 전체 높이를 각 행 높이의 합으로 계산
                let totalHeight = 0;
                let firstRowTop = null;
                for (let i = start; i <= end; i++) {
                    const row = scope.querySelector(`.time-entry[data-index="${i}"]`);
                    if (!row) continue;
                    const r = row.getBoundingClientRect();
                    if (firstRowTop === null) firstRowTop = r.top;
                    totalHeight += (r.bottom - r.top);
                }
                if (firstRowTop === null) return;
                main.style.setProperty('--merged-block-height', `${totalHeight}px`);

                const contentRect = content.getBoundingClientRect();
                const contentCenterY = (contentRect.top + contentRect.bottom) / 2;
                const blockCenterY = firstRowTop + (totalHeight / 2);
                const deltaY = blockCenterY - contentCenterY;
                if (Math.abs(deltaY) > 1) {
                    content.style.transform = `translateY(${deltaY}px)`;
                }
            });
        } catch (e) {
            // 무시 (안전)
        }
    }

    resizeMergedActualContent(root = document) {
        try {
            const scope = root || document;
            const mains = scope.querySelectorAll('.actual-field-container.merged-actual-main');
            mains.forEach((main) => {
                const input = main.querySelector('.timer-result-input');
                if (!input) return;

                const start = parseInt(main.getAttribute('data-merge-start'), 10);
                const end = parseInt(main.getAttribute('data-merge-end'), 10);
                // 각 행 높이의 합으로 블록 높이 계산
                let totalHeight = 0;
                for (let i = start; i <= end; i++) {
                    const row = scope.querySelector(`.time-entry[data-index="${i}"]`);
                    if (!row) continue;
                    const r = row.getBoundingClientRect();
                    totalHeight += (r.bottom - r.top);
                }
                if (totalHeight <= 0) return;
                // 레이아웃은 고정, 시각적 외곽선 높이만 변수로 전달
                main.style.setProperty('--merged-actual-block-height', `${totalHeight}px`);
                // 혹시 남아있을 수 있는 인라인 높이 제거
                main.style.removeProperty('height');
                input.style.removeProperty('height');

                // ??(??) ?? ????? ?? ????? ?? ??? ??? ??? ??
                const wrapper = main.closest('.split-cell-wrapper');
                if (wrapper) {
                    const splitViz = wrapper.querySelector('.split-visualization');
                    if (splitViz) {
                        const vizHeight = Math.max(0, totalHeight - 12); // ?? inset 6px? ??
                        splitViz.style.height = `${vizHeight}px`;
                    }
                }
            });
        } catch (e) {
            // ignore
        }
    }

    resizeMergedPlannedContent(root = document) {
        try {
            const scope = root || document;
            const mains = scope.querySelectorAll('.planned-merged-main-container');
            if (!mains || mains.length === 0) return;

            mains.forEach((main) => {
                const overlay = main.querySelector('.planned-merged-overlay');
                if (overlay) {
                    overlay.style.removeProperty('height');
                    overlay.style.removeProperty('--merged-planned-block-height');
                }

                const start = parseInt(main.getAttribute('data-merge-start'), 10);
                const end = parseInt(main.getAttribute('data-merge-end'), 10);
                // 각 행 높이의 합으로 블록 높이 계산
                let totalHeight = 0;
                for (let i = start; i <= end; i++) {
                    const row = scope.querySelector(`.time-entry[data-index="${i}"]`);
                    if (!row) continue;
                    const r = row.getBoundingClientRect();
                    totalHeight += (r.bottom - r.top);
                }
                if (totalHeight <= 0) return;
                main.style.setProperty('--merged-planned-block-height', `${totalHeight}px`);
                if (overlay) {
                    const overlayHeight = Math.max(0, totalHeight - 2);
                    overlay.style.setProperty('--merged-planned-block-height', `${totalHeight}px`);
                    overlay.style.height = `${overlayHeight}px`;
                }

                const wrapper = main.closest('.split-cell-wrapper');
                if (wrapper) {
                    const splitViz = wrapper.querySelector('.split-visualization');
                    if (splitViz) {
                        const vizHeight = Math.max(0, totalHeight - 12);
                        splitViz.classList.add('split-plan-merged-visualization');
                        splitViz.style.setProperty('--split-plan-merged-height', `${vizHeight}px`);
                        splitViz.style.height = `${vizHeight}px`;
                    }
                }
            });
        } catch (e) {
            // ignore
        }
    }

    // (의도 변경) 좌측 계획 입력은 모달로만 편집하며
    // 인풋 필드는 표시/선택 용도로만 사용합니다.

    selectMergedRange(type, mergeKey, opts = {}) {
        if (type !== 'planned') return; // 우측 열 병합 범위 선택 금지
        const [, startStr, endStr] = mergeKey.split('-');
        let start = parseInt(startStr, 10);
        let end = parseInt(endStr, 10);
        if (!Number.isFinite(start) || !Number.isFinite(end)) return;

        const append = Boolean(opts && opts.append);
        const selectedSet = type === 'planned' ? this.selectedPlannedFields : this.selectedActualFields;

        if (append && selectedSet && selectedSet.size > 0) {
            const selectedIndices = Array.from(selectedSet).sort((a, b) => a - b);
            const curStart = selectedIndices[0];
            const curEnd = selectedIndices[selectedIndices.length - 1];
            start = Math.min(start, curStart);
            end = Math.max(end, curEnd);
        }

        this.clearSelection(type);

        for (let i = start; i <= end; i++) {
            selectedSet.add(i);
            // 선택 시각 효과는 공통 오버레이로 대체
        }

        this.updateSelectionOverlay(type);
        this.showScheduleButtonForSelection(type);
        if (type === 'planned' && selectedSet.size > 1) {
            this.showMergeButton('planned');
        }

        // Undo 버튼은 "기존 병합 블록 단독 선택"일 때만 노출
        if (!append && type === 'planned') {
            this.showUndoButton(type, mergeKey);
        } else {
            this.hideUndoButton();
        }
    }

    ensureSelectionOverlay(type) {
        if (!this.selectionOverlay[type]) {
            const el = document.createElement('div');
            el.className = 'selection-overlay';
            el.dataset.type = type;

            // 오버레이 위에서 드래그 시작을 허용하여 단일 선택 상태에서도 드래그 확장 가능
            let overlayDrag = { active: false, moved: false, startIndex: -1 };

            const onOverlayMouseDown = (e) => {
                if (e.button !== 0) return; // 좌클릭만 처리
                // 오버레이 내부 버튼(스케줄/되돌리기/병합) 클릭은 통과
                if (e.target.closest('.schedule-button') || e.target.closest('.undo-button') || e.target.closest('.merge-button')) {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                const idx = this.getIndexAtClientPosition(type, e.clientX, e.clientY);
                if (idx == null || isNaN(idx)) return;
                overlayDrag = { active: true, moved: false, startIndex: idx };
                this.currentColumnType = type;
                if (type === 'planned') this.isSelectingPlanned = true; else this.isSelectingActual = true;

                // 드래그가 오버레이 밖으로 나가도 추적되도록 문서 레벨로 이동/업 핸들러 바인딩
                this._overlayMouseMove = (ev) => {
                    if (!overlayDrag.active) return;
                    const curIdx = this.getIndexAtClientPosition(type, ev.clientX, ev.clientY);
                    if (curIdx == null || isNaN(curIdx)) return;
                    if (curIdx !== overlayDrag.startIndex) overlayDrag.moved = true;
                    // 드래그 확장: 기존 선택을 드래그 범위로 갱신
                    this.selectFieldRange(type, overlayDrag.startIndex, curIdx);
                };
                this._overlayMouseUp = (ev) => {
                    if (!overlayDrag.active) return;
                    ev.preventDefault();
                    ev.stopPropagation();
                    // 드래그 없이 클릭만 했다면 기존 동작(선택 해제) 유지
                    if (!overlayDrag.moved) {
                        this.clearSelection(type);
                    }
                    overlayDrag = { active: false, moved: false, startIndex: -1 };
                    if (type === 'planned') this.isSelectingPlanned = false; else this.isSelectingActual = false;
                    this.currentColumnType = null;
                    document.removeEventListener('mousemove', this._overlayMouseMove, true);
                    document.removeEventListener('mouseup', this._overlayMouseUp, true);
                    this._overlayMouseMove = null;
                    this._overlayMouseUp = null;
                };
                document.addEventListener('mousemove', this._overlayMouseMove, true);
                document.addEventListener('mouseup', this._overlayMouseUp, true);
            };

            el.addEventListener('mousedown', onOverlayMouseDown, true);
            // 클릭만의 경우(드래그 없음)는 mouseup 핸들러에서 clearSelection 처리

            document.body.appendChild(el);
            this.selectionOverlay[type] = el;
        }
        return this.selectionOverlay[type];
    }

    // 현재 좌표 위치에 있는 type 컬럼(.planned-input | .actual-input)의 인덱스를 반환
    getIndexAtClientPosition(type, clientX, clientY) {
        const selector = type === 'planned' ? '.planned-input' : '.actual-input';
        const elements = document.elementsFromPoint(clientX, clientY) || [];
        for (const el of elements) {
            if (el.matches && el.matches(selector)) {
                const idx = el.getAttribute('data-index');
                if (idx !== null) return parseInt(idx, 10);
            }
            const row = el.closest && el.closest('.time-entry[data-index]');
            if (row) {
                const rowIdx = row.getAttribute('data-index');
                if (rowIdx !== null) return parseInt(rowIdx, 10);
            }
        }
        return null;
    }

    removeSelectionOverlay(type) {
        const el = this.selectionOverlay[type];
        if (el && el.parentNode) el.parentNode.removeChild(el);
        this.selectionOverlay[type] = null;
    }

    updateSelectionOverlay(type) {
        const selectedSet = (type === 'planned') ? this.selectedPlannedFields : this.selectedActualFields;
        if (!selectedSet || selectedSet.size < 1) {
            this.removeSelectionOverlay(type);
            return;
        }
        this.removeHoverSelectionOverlay(type);
        if (type === 'planned') this.hoveredMergeKey = null;

        const idx = Array.from(selectedSet).sort((a,b)=>a-b);
        const startIndex = idx[0];
        const endIndex   = idx[idx.length - 1];

        const startField = document.querySelector(`[data-index="${startIndex}"] .${type}-input`);
        const endField   = document.querySelector(`[data-index="${endIndex}"] .${type}-input`);
        if (!startField || !endField) {
            this.removeSelectionOverlay(type);
            return;
        }

        // 좌/우 컬럼별 선택 기준 요소(rect)를 계산
        const startRect = this.getSelectionCellRect(type, startIndex);
        if (!startRect) {
            this.removeSelectionOverlay(type);
            return;
        }
        // 하단 기준 계산
        let endBottom;
        if (type === 'actual') {
            // 우측은 "활동 기록" 입력창의 하단까지로 한정
            const endRect = this.getSelectionCellRect(type, endIndex) || endField.getBoundingClientRect();
            endBottom = endRect.bottom;
        } else {
            // 좌측은 행 경계 하단까지
            const endRow = endField.closest('.time-entry');
            const endRowRect = endRow ? endRow.getBoundingClientRect() : endField.getBoundingClientRect();
            endBottom = endRowRect.bottom;
        }

        const overlay   = this.ensureSelectionOverlay(type);
        if (type === 'planned') {
            overlay.dataset.fill = selectedSet.size > 1 ? 'solid' : 'outline';
        } else {
            delete overlay.dataset.fill;
        }
        const left      = startRect.left + window.scrollX;
        const top       = startRect.top  + window.scrollY;
        const width     = startRect.width;
        const height    = Math.max(0, (endBottom - startRect.top));

        overlay.style.left   = `${left}px`;
        overlay.style.top    = `${top}px`;
        overlay.style.width  = `${width}px`;
        overlay.style.height = `${height}px`;
    }

    // 선택 박스의 기준 사각형을 컬럼/병합 상태에 맞춰 반환
    getSelectionCellRect(type, index) {
        if (type === 'actual') {
            const mergeKey = this.findMergeKey('actual', index);
            if (mergeKey) {
                const [ , startStr ] = mergeKey.split('-');
                const start = parseInt(startStr, 10);
                const input = document.querySelector(`[data-index="${start}"] .actual-field-container.merged-actual-main .timer-result-input`);
                if (input) return input.getBoundingClientRect();
            }
            const input = document.querySelector(`[data-index="${index}"] .timer-result-input`);
            if (input) return input.getBoundingClientRect();
            // 폴백: 필드 자체
            const field = document.querySelector(`[data-index="${index}"] .actual-input`);
            return field ? field.getBoundingClientRect() : null;
        } else {
            const field = document.querySelector(`[data-index="${index}"] .${type}-input`);
            return field ? field.getBoundingClientRect() : null;
        }
    }

    ensureHoverSelectionOverlay(type) {
        if (!this.hoverSelectionOverlay[type]) {
            const el = document.createElement('div');
            el.className = 'selection-overlay hover-selection-overlay';
            el.dataset.type = type;
            document.body.appendChild(el);
            this.hoverSelectionOverlay[type] = el;
        }
        return this.hoverSelectionOverlay[type];
    }

    removeHoverSelectionOverlay(type) {
        const el = this.hoverSelectionOverlay[type];
        if (el && el.parentNode) el.parentNode.removeChild(el);
        this.hoverSelectionOverlay[type] = null;
    }

    updateHoverSelectionOverlay(type, startIndex, endIndex) {
        const startField = document.querySelector(`[data-index="${startIndex}"] .${type}-input`);
        const endField = document.querySelector(`[data-index="${endIndex}"] .${type}-input`);
        if (!startField || !endField) {
            this.removeHoverSelectionOverlay(type);
            return;
        }

        const startRect = this.getSelectionCellRect(type, startIndex);
        if (!startRect) {
            this.removeHoverSelectionOverlay(type);
            return;
        }

        let endBottom;
        if (type === 'actual') {
            const endRect = this.getSelectionCellRect(type, endIndex) || endField.getBoundingClientRect();
            endBottom = endRect.bottom;
        } else {
            const endRow = endField.closest('.time-entry');
            const endRowRect = endRow ? endRow.getBoundingClientRect() : endField.getBoundingClientRect();
            endBottom = endRowRect.bottom;
        }

        const overlay = this.ensureHoverSelectionOverlay(type);
        overlay.style.left = `${startRect.left + window.scrollX}px`;
        overlay.style.top = `${startRect.top + window.scrollY}px`;
        overlay.style.width = `${startRect.width}px`;
        overlay.style.height = `${Math.max(0, (endBottom - startRect.top))}px`;
    }

    isMergeRangeSelected(type, mergeKey) {
        const [, startStr, endStr] = mergeKey.split('-');
        const start = parseInt(startStr, 10);
        const end   = parseInt(endStr, 10);
        const set   = (type === 'planned') ? this.selectedPlannedFields : this.selectedActualFields;

        if (set.size !== (end - start + 1)) return false;
        for (let i = start; i <= end; i++) {
            if (!set.has(i)) return false;
        }
        return true;
    }

    attachRowWideClickTargets(entryDiv, index) {
        entryDiv.addEventListener('click', (e) => {
            const plannedField = entryDiv.querySelector('.planned-input');
            const actualField  = entryDiv.querySelector('.actual-input');
            if (!plannedField && !actualField) return;

            const rowRect      = entryDiv.getBoundingClientRect();
            const x = e.clientX, y = e.clientY;

            if (plannedField) {
                const pr = plannedField.getBoundingClientRect();
                const inPlannedCol = (x >= pr.left && x <= pr.right && y >= rowRect.top && y <= rowRect.bottom);
                if (inPlannedCol) {
                    const mk = this.findMergeKey('planned', index);
                    if (mk) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (this.isMergeRangeSelected('planned', mk)) this.clearSelection('planned');
                        else this.selectMergedRange('planned', mk);
                        return;
                    }
                }
            }

            // 우측 열은 행 전체 클릭으로 선택 조작을 제공하지 않음
        });
    }

    attachCellClickListeners(entryDiv, index) {
        // This function is now intentionally left empty 
        // to avoid conflicts with the unified mouseup/click handling logic
        // in attachFieldSelectionListeners.
    }

    hideScheduleButton() {
        if (this.scheduleButton) {
            if (this.scheduleButton.parentNode) {
                this.scheduleButton.parentNode.removeChild(this.scheduleButton);
            }
            this.scheduleButton = null;
        }
    }

    showScheduleButtonForSelection(type) {
        this.hideScheduleButton();
        return;
        
        // 스케줄 입력 버튼은 계획(planned) 컬럼에서만 표시
        if (type !== 'planned') return;
    
        const overlay = this.selectionOverlay[type];
        if (!overlay) return;
        
        const selectedSet = type === 'planned' ? this.selectedPlannedFields : this.selectedActualFields;
        if (selectedSet.size === 0) return;

        // 병합 버튼과 동시 표시는 하지 않음: 멀티 선택(병합 후보)에서는 스케줄 버튼 숨김
        // 단, 이미 병합된 범위를 선택한 경우(Undo 가능)는 예외로 스케줄 버튼 표시
        if (selectedSet.size > 1) {
            const indices = Array.from(selectedSet).sort((a,b)=>a-b);
            const firstIndex = indices[0];
            const mk = this.findMergeKey('planned', firstIndex);
            const isMergedSelection = mk ? this.isMergeRangeSelected('planned', mk) : false;
            if (!isMergedSelection) {
                // 멀티 선택이지만 병합 범위가 아닌 경우 → 병합 버튼만 필요
                return;
            }
        }
    
        const rect = overlay.getBoundingClientRect();
        
        this.scheduleButton = document.createElement('button');
        this.scheduleButton.className = 'schedule-button';
        this.scheduleButton.textContent = '📅';
        this.scheduleButton.title = '스케줄 입력';
        this.scheduleButton.setAttribute('aria-label', '스케줄 입력');
        // 위치는 CSS로 오버레이 정중앙에 표시 (hover 시 노출)
        
            this.scheduleButton.addEventListener('click', (e) => {
                e.stopPropagation();
                const selectedIndices = Array.from(selectedSet).sort((a, b) => a - b);
                const firstIndex = selectedIndices[0];
                const lastIndex = selectedIndices[selectedIndices.length - 1];
                const anchor = document.querySelector(`[data-index="${firstIndex}"] .planned-input`) || document.querySelector(`[data-index="${firstIndex}"]`);
                this.openInlinePlanDropdown(firstIndex, anchor, lastIndex);
            });
        
        // 스케줄 버튼은 오버레이 내부에 배치
        overlay.appendChild(this.scheduleButton);
        // 되돌리기 버튼(병합된 범위 선택 시)이 있으면 스케줄 버튼 우측으로 정렬
        this.repositionButtonsNextToSchedule();

        // 클릭 시 현재 선택 범위에 대해 모달 오픈
        this.scheduleButton.onclick = (e) => {
            e.stopPropagation();
            const selectedIndices = Array.from(selectedSet).sort((a, b) => a - b);
            const firstIndex = selectedIndices[0];
            const lastIndex = selectedIndices[selectedIndices.length - 1];
            this.openScheduleModal(type, firstIndex, lastIndex);
        };
    }

    // 좌측 열 셀에 마우스를 올렸을 때 단일/병합 대상의 스케줄 버튼을 표시
    showScheduleButtonOnHover(index) {
        this.hideHoverScheduleButton();
        return;
        // 멀티 선택 중(병합 후보)에는 스케줄 버튼을 표시하지 않음
        if (this.selectedPlannedFields && this.selectedPlannedFields.size > 1) {
            const indices = Array.from(this.selectedPlannedFields).sort((a,b)=>a-b);
            const firstIndex = indices[0];
            const mk = this.findMergeKey('planned', firstIndex);
            const isMergedSelection = mk ? this.isMergeRangeSelected('planned', mk) : false;
            if (!isMergedSelection) return; // 병합 후보(아직 병합 아님)일 때만 차단
        }
        // 선택 중인 셀 자체에는 오버레이 내부 버튼이 있으므로 중복 표시하지 않음
        if (this.selectedPlannedFields && this.selectedPlannedFields.size > 0) {
            this.hideHoverScheduleButton();
            return;
        }

        const field = document.querySelector(`[data-index="${index}"] .planned-input`);
        if (!field) {
            this.removeHoverSelectionOverlay('planned');
            return;
        }
        const rect = field.getBoundingClientRect();
        const scrollX = window.scrollX || document.documentElement.scrollLeft || 0;
        const scrollY = window.scrollY || document.documentElement.scrollTop || 0;

        // 생성/표시
        this.hideHoverScheduleButton();
        const btn = document.createElement('button');
        btn.className = 'schedule-button';
        btn.textContent = '📅';
        btn.title = '스케줄 입력';
        btn.setAttribute('aria-label', '스케줄 입력');
        // 셀 정중앙에 배치
        const btnW = 28, btnH = 28;
        const centerX = rect.left + scrollX + (rect.width / 2);
        const centerY = rect.top  + scrollY + (rect.height / 2);
        btn.style.left = `${Math.round(centerX - (btnW/2))}px`;
        btn.style.top  = `${Math.round(centerY - (btnH/2))}px`;

        btn.onclick = (e) => {
            e.stopPropagation();
            const mk = this.findMergeKey('planned', index);
            if (mk) {
                const [, s, eIdx] = mk.split('-');
                const anchor = document.querySelector(`[data-index="${s}"] .planned-input`) || document.querySelector(`[data-index="${s}"]`);
                this.openInlinePlanDropdown(parseInt(s,10), anchor, parseInt(eIdx,10));
            } else {
                const anchor = document.querySelector(`[data-index="${index}"] .planned-input`) || document.querySelector(`[data-index="${index}"]`);
                this.openInlinePlanDropdown(index, anchor, index);
            }
        };

        // 호버 유지: 버튼 위로 올리면 유지, 버튼에서 벗어나면 숨김
        let hideTimer = null;
        const requestHide = () => {
            hideTimer = setTimeout(() => {
                // 되돌리기 버튼 위에 있을 땐 숨기지 않음
                if (this.undoButton && this.undoButton.matches(':hover')) return;
                this.hideHoverScheduleButton();
            }, 150);
        };
        btn.addEventListener('mouseleave', requestHide);
        btn.addEventListener('mouseenter', () => { if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; } });

        document.body.appendChild(btn);
        this.scheduleHoverButton = btn;

        const mergeKey = this.findMergeKey('planned', index);
        const mkParts = mergeKey ? mergeKey.split('-') : null;
        const startIndex = mkParts ? parseInt(mkParts[1], 10) : index;
        const endIndex = mkParts ? parseInt(mkParts[2], 10) : index;
        this.updateHoverSelectionOverlay('planned', startIndex, endIndex);
        if (mergeKey) {
            this.hoveredMergeKey = mergeKey;
            this.showUndoButton('planned', mergeKey);
        } else {
            this.hoveredMergeKey = null;
            this.hideUndoButton();
        }

        this.repositionButtonsNextToSchedule();
    }

    showActivityLogButtonOnHover(index) {
        const wrapper = document.querySelector(`.time-entry[data-index="${index}"] .split-cell-wrapper.split-type-actual.split-has-data`);
        if (!wrapper) return;

        const container = wrapper.querySelector('.actual-field-container') || wrapper;
        const viz = wrapper.querySelector('.split-visualization');
        const targetRect = (viz && viz.getBoundingClientRect()) || container.getBoundingClientRect();
        const scrollX = window.scrollX || document.documentElement.scrollLeft || 0;
        const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
        const btnW = 30;
        const btnH = 30;
        const centerX = targetRect.left + scrollX + (targetRect.width * 0.9);
        const centerY = targetRect.top + scrollY + (targetRect.height / 2);

        this.hideHoverActivityLogButton();

        const btn = document.createElement('button');
        btn.className = 'activity-log-btn activity-log-btn-floating';
        btn.textContent = '📝';
        btn.title = '상세 기록';
        btn.setAttribute('aria-label', '상세 기록');
        btn.style.left = `${Math.round(centerX - (btnW / 2))}px`;
        btn.style.top = `${Math.round(centerY - (btnH / 2))}px`;

        btn.onclick = (e) => {
            e.stopPropagation();
            this.openActivityLogModal(index);
        };

        const requestHide = () => {
            if (this.activityHoverHideTimer) clearTimeout(this.activityHoverHideTimer);
            this.activityHoverHideTimer = setTimeout(() => this.hideHoverActivityLogButton(), 150);
        };

        btn.addEventListener('mouseleave', requestHide);
        btn.addEventListener('mouseenter', () => {
            if (this.activityHoverHideTimer) {
                clearTimeout(this.activityHoverHideTimer);
                this.activityHoverHideTimer = null;
            }
        });

        document.body.appendChild(btn);
        this.activityHoverButton = btn;
    }

    hideHoverActivityLogButton() {
        if (this.activityHoverHideTimer) {
            clearTimeout(this.activityHoverHideTimer);
            this.activityHoverHideTimer = null;
        }
        if (this.activityHoverButton && this.activityHoverButton.parentNode) {
            this.activityHoverButton.parentNode.removeChild(this.activityHoverButton);
        }
        this.activityHoverButton = null;
    }

    hideHoverScheduleButton() {
        // 되돌리기 버튼에 커서가 있으면 유지
        if (this.undoButton && this.undoButton.matches(':hover')) return;
        if (this.scheduleHoverButton && this.scheduleHoverButton.parentNode) {
            this.scheduleHoverButton.parentNode.removeChild(this.scheduleHoverButton);
            this.scheduleHoverButton = null;
        }
        this.removeHoverSelectionOverlay('planned');
        if (this.hoveredMergeKey && (!this.selectedPlannedFields || this.selectedPlannedFields.size === 0)) {
            this.hideUndoButton();
        }
        this.hoveredMergeKey = null;
    }

    // 스케줄 버튼 우측으로 병합/되돌리기 버튼 정렬
    repositionButtonsNextToSchedule() {
        const anchor = this.scheduleButton || this.scheduleHoverButton;
        if (!anchor) return;
        const spacing = 8;
        const sbRect = anchor.getBoundingClientRect();
        const baseLeft = window.scrollX + sbRect.left + sbRect.width + spacing;
        const baseTop  = window.scrollY + sbRect.top;

        if (this.mergeButton) {
            this.mergeButton.style.left = `${Math.round(baseLeft)}px`;
            this.mergeButton.style.top  = `${Math.round(baseTop)}px`;
        }
        if (this.undoButton) {
            this.undoButton.style.left = `${Math.round(baseLeft)}px`;
            this.undoButton.style.top  = `${Math.round(baseTop)}px`;
        }
    }

    getSchedulePreviewData() {
        const modal = document.getElementById('scheduleModal');
        if (!modal) return null;
        const type = modal.dataset.type || 'planned';
        const activity = (this.modalSelectedActivities || []).join(', ').trim();
        if (type !== 'planned') {
            return {
                text: activity,
                title: '',
                titleBand: false,
                planActivities: [],
                planTitle: '',
                planTitleBandOn: false,
                hasInvalid: false,
                hasMismatch: false
            };
        }

        const rawPlanActivities = Array.isArray(this.modalPlanActivities) ? this.modalPlanActivities : [];
        const sanitizedPlanActivities = rawPlanActivities
            .filter(item => item && !item.invalid && (String(item.label || '').trim() !== ''
                || (Number.isFinite(item.seconds) && item.seconds > 0)))
            .map(item => {
                const label = this.normalizeActivityText
                    ? this.normalizeActivityText(item.label || '')
                    : String(item.label || '').trim();
                const seconds = Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
                return { label, seconds };
            });
        const planSummary = sanitizedPlanActivities.length > 0 ? this.formatActivitiesSummary(sanitizedPlanActivities) : '';
        const planText = planSummary || activity;
        const planTitleText = this.normalizeActivityText
            ? this.normalizeActivityText(this.modalPlanTitle || '')
            : String(this.modalPlanTitle || '').trim();
        const planTitleBandEnabled = Boolean(this.modalPlanTitleBandOn && planTitleText);
        const planTotalSeconds = Math.max(0, Number(this.modalPlanTotalSeconds) || 0);
        const planUsedSeconds = sanitizedPlanActivities.reduce((sum, item) => sum + item.seconds, 0);
        const hasPlanInvalid = rawPlanActivities.some(item => item && item.invalid);
        const hasPlanMismatch = sanitizedPlanActivities.length > 0 && planTotalSeconds > 0 && planUsedSeconds !== planTotalSeconds;

        return {
            text: planText,
            title: planTitleText,
            titleBand: Boolean(this.modalPlanTitleBandOn && planTitleText),
            planActivities: sanitizedPlanActivities,
            planTitle: planTitleText,
            planTitleBandOn: planTitleBandEnabled,
            hasInvalid: hasPlanInvalid,
            hasMismatch: hasPlanMismatch
        };
    }

    resetSchedulePreview() {
        const list = document.getElementById('schedulePreviewList');
        const meta = document.getElementById('schedulePreviewMeta');
        const note = document.getElementById('schedulePreviewNote');
        if (list) list.innerHTML = '';
        if (meta) meta.textContent = '';
        if (note) note.textContent = '';
    }

    updateSchedulePreview() {
        const modal = document.getElementById('scheduleModal');
        if (!modal || modal.style.display !== 'flex') return;
        const list = document.getElementById('schedulePreviewList');
        const meta = document.getElementById('schedulePreviewMeta');
        const note = document.getElementById('schedulePreviewNote');
        if (!list || !meta || !note) return;

        const startIndex = parseInt(modal.dataset.startIndex, 10);
        const endIndex = parseInt(modal.dataset.endIndex, 10);
        if (!Number.isFinite(startIndex) || !Number.isFinite(endIndex)) {
            this.resetSchedulePreview();
            return;
        }

        const count = Math.max(1, (endIndex - startIndex + 1));
        const timeField = document.getElementById('scheduleTime');
        const totalLabel = this.formatDurationSummary(count * 3600);
        const timeLabel = timeField ? timeField.value : '';
        meta.textContent = timeLabel ? `${totalLabel} · ${timeLabel}` : totalLabel;

        const preview = this.getSchedulePreviewData();
        const type = modal.dataset.type || 'planned';
        note.textContent = '';
        if (preview) {
            if (preview.hasInvalid) {
                note.textContent = '계획 분해에 잘못된 시간 형식이 있습니다.';
            } else if (preview.hasMismatch) {
                note.textContent = '분해 합계가 총 시간과 일치하지 않습니다.';
            }
        }

        const originalSlots = this.timeSlots;
        const originalMerged = this.mergedFields;
        const previewSlots = (this.timeSlots || []).map((slot) => {
            const timer = slot && typeof slot.timer === 'object'
                ? { ...slot.timer }
                : { running: false, elapsed: 0, startTime: null, method: 'manual' };
            const activityLog = slot && typeof slot.activityLog === 'object'
                ? {
                    ...slot.activityLog,
                    subActivities: Array.isArray(slot.activityLog.subActivities)
                        ? slot.activityLog.subActivities.map(item => ({ ...item }))
                        : [],
                    actualGridUnits: Array.isArray(slot.activityLog.actualGridUnits)
                        ? slot.activityLog.actualGridUnits.slice()
                        : []
                }
                : { title: '', details: '', subActivities: [], titleBandOn: false, actualGridUnits: [], actualOverride: false };
            const planActivities = Array.isArray(slot.planActivities)
                ? slot.planActivities.map(item => ({ ...item }))
                : [];
            return {
                ...slot,
                timer,
                activityLog,
                planActivities
            };
        });
        const previewMerged = new Map(this.mergedFields);

        if (type === 'planned' && preview) {
            const planActivities = (preview.planActivities || []).map(item => ({ ...item }));
            const planTitle = preview.planTitle || '';
            const planTitleBandOn = Boolean(preview.planTitleBandOn && planTitle);
            const planText = preview.text || '';

            if (startIndex === endIndex) {
                if (previewSlots[startIndex]) {
                    previewSlots[startIndex].planned = planText;
                    previewSlots[startIndex].planActivities = planActivities;
                    previewSlots[startIndex].planTitle = planTitle;
                    previewSlots[startIndex].planTitleBandOn = planTitleBandOn;
                }
            } else {
                const mergeKey = `planned-${startIndex}-${endIndex}`;
                previewMerged.set(mergeKey, planText);
                for (let i = startIndex; i <= endIndex; i++) {
                    if (!previewSlots[i]) continue;
                    previewSlots[i].planned = i === startIndex ? planText : '';
                    previewSlots[i].planActivities = i === startIndex ? planActivities.map(item => ({ ...item })) : [];
                    previewSlots[i].planTitle = i === startIndex ? planTitle : '';
                    previewSlots[i].planTitleBandOn = i === startIndex ? planTitleBandOn : false;
                }
            }
        }

        list.innerHTML = '';
        try {
            this.timeSlots = previewSlots;
            this.mergedFields = previewMerged;

            const sheet = document.createElement('div');
            sheet.className = 'timesheet schedule-preview-sheet';

            const header = document.createElement('div');
            header.className = 'header-row';
            header.innerHTML = `
                <div class="planned-label">계획된 활동</div>
                <div class="time-label">시간</div>
                <div class="actual-label">실제 활동</div>
            `;
            sheet.appendChild(header);

            const entries = document.createElement('div');
            entries.className = 'time-entries schedule-preview-entries';

            for (let index = startIndex; index <= endIndex; index++) {
                const slot = previewSlots[index];
                if (!slot) continue;
                const entryDiv = document.createElement('div');
                entryDiv.className = 'time-entry';
                entryDiv.dataset.index = String(index);

                const plannedMergeKey = this.findMergeKey('planned', index);
                const actualMergeKey = this.findMergeKey('actual', index);

                let plannedContent = plannedMergeKey
                    ? this.createMergedField(plannedMergeKey, 'planned', index, slot.planned)
                    : `<input type="text" class="input-field planned-input" 
                            data-index="${index}" 
                            data-type="planned" 
                            value="${this.escapeAttribute(slot.planned)}"
                            placeholder="계획을 입력하려면 클릭 또는 Enter" readonly tabindex="0" aria-label="계획 활동 입력" title="클릭해서 계획 선택/입력" style="cursor: pointer;">`;

                plannedContent = this.wrapWithSplitVisualization('planned', index, plannedContent);

                let actualContent = actualMergeKey
                    ? this.createMergedField(actualMergeKey, 'actual', index, slot.actual)
                    : this.createTimerField(index, slot);

                actualContent = this.wrapWithSplitVisualization('actual', index, actualContent);

                const timeMergeKey = this.findMergeKey('time', index);
                const timerControls = this.createTimerControls(index, slot);
                let timeContent;
                if (timeMergeKey) {
                    timeContent = this.createMergedTimeField(timeMergeKey, index, slot);
                } else {
                    timeContent = `<div class="time-slot-container">
                        <div class="time-label">${slot.time}</div>
                        ${timerControls}
                    </div>`;
                }

                entryDiv.innerHTML = `
                    ${plannedContent}
                    ${timeContent}
                    ${actualContent}
                `;

                if (plannedMergeKey) {
                    const plannedStart = parseInt(plannedMergeKey.split('-')[1], 10);
                    const plannedEnd = parseInt(plannedMergeKey.split('-')[2], 10);
                    if (index >= plannedStart && index < plannedEnd) {
                        entryDiv.classList.add('has-planned-merge');
                    }
                }

                if (actualMergeKey) {
                    const actualStart = parseInt(actualMergeKey.split('-')[1], 10);
                    const actualEnd = parseInt(actualMergeKey.split('-')[2], 10);
                    if (index >= actualStart && index < actualEnd) {
                        entryDiv.classList.add('has-actual-merge');
                    }
                }

                entries.appendChild(entryDiv);
            }

            sheet.appendChild(entries);
            list.appendChild(sheet);

            this.centerMergedTimeContent(entries);
            this.resizeMergedActualContent(entries);
            this.resizeMergedPlannedContent(entries);
        } finally {
            this.timeSlots = originalSlots;
            this.mergedFields = originalMerged;
        }
    }
    
    openScheduleModal(type, startIndex, endIndex = null) {
        // Modal 제거됨: 인라인 드롭다운으로 대체
        if (type !== 'planned') return;
        const end = endIndex != null ? endIndex : startIndex;
        const anchor = document.querySelector(`[data-index="${startIndex}"] .planned-input`) || document.querySelector(`[data-index="${startIndex}"]`);
        this.openInlinePlanDropdown(startIndex, anchor, end);
    }
    
    closeScheduleModal() {
        // Legacy no-op: schedule modal was replaced by inline plan dropdown.
        return false;
    }
    
    saveScheduleFromModal() {
        // Legacy no-op: schedule modal save flow was replaced by inline plan dropdown.
        return false;
    }
    
    attachModalEventListeners() {
        // Legacy no-op: schedule modal listeners were removed with inline plan editor migration.
        return false;
    }

    // Planned activities: load/save and render dropdown
    loadPlannedActivities() {
        this.plannedActivities = [];
        this.dedupeAndSortPlannedActivities();
    }
    savePlannedActivities(options = {}) {
        const opts = options || {};
        const locals = this.persistPlannedActivitiesLocally();
        if (!opts.skipSupabase) {
            try { this.scheduleSupabasePlannedSave && this.scheduleSupabasePlannedSave(); } catch (_) {}
        }
        return locals;
    }
    persistPlannedActivitiesLocally() {
        return [];
    }
    addPlannedActivityOption(text, selectAfter = false) {
        const label = this.normalizeActivityText(text);
        if (!label) return;
        const idx = this.findPlannedActivityIndex(label);
        if (idx >= 0) {
            this.plannedActivities[idx] = { label, source: 'local', priorityRank: null, recommendedSeconds: null };
        } else {
            this.plannedActivities.push({ label, source: 'local', priorityRank: null, recommendedSeconds: null });
        }
        this.dedupeAndSortPlannedActivities();
        this.savePlannedActivities();
        if (selectAfter) {
            if (!this.modalSelectedActivities.includes(label)) this.modalSelectedActivities.push(label);
        }
        this.renderPlannedActivityDropdown();
        this.refreshSubActivityOptions();
    }
    removePlannedActivityOption(text) {
        const label = this.normalizeActivityText(text);
        const idx = this.findPlannedActivityIndex(label);
        if (idx >= 0) {
            this.plannedActivities.splice(idx, 1);
            this.savePlannedActivities();
            // 선택되어 있으면 선택도 제거
            const sidx = this.modalSelectedActivities.indexOf(label);
            if (sidx >= 0) this.modalSelectedActivities.splice(sidx, 1);
            this.renderPlannedActivityDropdown();
            this.refreshSubActivityOptions();
            if (this.inlinePlanTarget) {
                const range = this.getPlannedRangeInfo(this.inlinePlanTarget.startIndex);
                const current = this.getPlannedValueForIndex(range.startIndex);
                const normalizedCurrent = this.normalizeActivityText
                    ? this.normalizeActivityText(current || '')
                    : String(current || '').trim();
                if (normalizedCurrent === label) {
                    for (let i = range.startIndex; i <= range.endIndex; i++) {
                        if (this.timeSlots[i]) {
                            this.timeSlots[i].planned = '';
                            this.timeSlots[i].planActivities = [];
                            this.timeSlots[i].planTitle = '';
                            this.timeSlots[i].planTitleBandOn = false;
                        }
                    }
                    if (range.mergeKey) {
                        this.mergedFields.set(range.mergeKey, '');
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
                    this.renderTimeEntries();
                    this.calculateTotals();
                    this.autoSave();
                    this.renderInlinePlanDropdownOptions();
                }
            }
        }
    }
    toggleSelectActivity(text, options = {}) {
        const label = this.normalizeActivityText(text);
        if (!label) return;

        if (this.modalPlanSectionOpen) {
            const shouldRemove = options.fromChip || options.checked === false;
            if (shouldRemove) {
                const removed = this.removePlanActivitiesByLabel(label);
                if (!removed) {
                    const idx = (this.modalPlanActivities || []).findIndex(item => {
                        const current = this.normalizeActivityText(item?.label || '');
                        return current === label;
                    });
                    if (idx >= 0) {
                        this.setPlanActiveRow(idx);
                        this.showNotification('이미 동일한 라벨이 있어 해당 행으로 이동했어요.');
                    } else {
                        this.syncSelectedActivitiesFromPlan({ rerenderDropdown: true });
                    }
                }
                return;
            }
            this.insertPlanLabelToRow(label, options || {});
            return;
        }

        const selections = Array.isArray(this.modalSelectedActivities) ? this.modalSelectedActivities : [];
        const existing = selections.indexOf(label);
        if (existing >= 0) {
            selections.splice(existing, 1);
        } else {
            selections.push(label);
        }
        this.modalSelectedActivities = selections;
        this.renderPlannedActivityDropdown();
    }
    editPlannedActivityOption(oldText, newText) {
        const oldLabel = this.normalizeActivityText(oldText);
        const newLabel = this.normalizeActivityText(newText);
        if (!newLabel || oldLabel === newLabel) return;
        const i = this.findPlannedActivityIndex(oldLabel);
        if (i >= 0) {
            // rename in list (편집 시에는 항상 로컬 항목으로 취급)
            this.plannedActivities[i] = { label: newLabel, source: 'local', priorityRank: null, recommendedSeconds: null };
            // update selection
            const si = this.modalSelectedActivities.indexOf(oldLabel);
            if (si >= 0) this.modalSelectedActivities[si] = newLabel;
            this.dedupeAndSortPlannedActivities();
            this.savePlannedActivities();
            this.renderPlannedActivityDropdown();
            this.refreshSubActivityOptions();
        }
    }
    findPlannedActivityIndex(label) {
        if (!Array.isArray(this.plannedActivities)) return -1;
        return this.plannedActivities.findIndex(item => item && item.label === label);
    }
    dedupeAndSortPlannedActivities() {
        const byLabel = new Map();
        (this.plannedActivities || []).forEach((item) => {
            if (!item) return;
            const label = this.normalizeActivityText(item.label || '');
            if (!label) return;
            const source = item.source === 'notion' ? 'notion' : 'local';
            const priorityRank = Number.isFinite(item.priorityRank) ? Number(item.priorityRank) : null;
            const recommendedSeconds = Number.isFinite(item.recommendedSeconds) ? Math.max(0, Number(item.recommendedSeconds)) : null;
            const entry = { label, source, priorityRank, recommendedSeconds };
            const existing = byLabel.get(label);
            let replace = false;
            if (!existing) {
                replace = true;
            } else if (existing.source === 'local' && source !== 'local') {
                replace = false;
            } else if (source === 'local' && existing.source !== 'local') {
                replace = true;
            } else {
                const existingRecommended = Number.isFinite(existing.recommendedSeconds) ? existing.recommendedSeconds : null;
                if (existingRecommended > 0 && !(recommendedSeconds > 0)) {
                    replace = false;
                } else if (!(existingRecommended > 0) && recommendedSeconds > 0) {
                    replace = true;
                } else {
                    replace = true;
                }
            }
            if (replace) {
                byLabel.set(label, entry);
            }
        });
        this.plannedActivities = Array.from(byLabel.values()).sort((a, b) => {
            const ra = Number.isFinite(a.priorityRank) ? a.priorityRank : Infinity;
            const rb = Number.isFinite(b.priorityRank) ? b.priorityRank : Infinity;
            if (ra !== rb) return ra - rb;
            return a.label.localeCompare(b.label);
        });
    }
    pruneSelectedActivitiesByAvailability() {
        if (!Array.isArray(this.modalSelectedActivities)) return false;
        const available = new Set((this.plannedActivities || []).map(item => item.label));
        const before = this.modalSelectedActivities.length;
        this.modalSelectedActivities = this.modalSelectedActivities
            .map(label => this.normalizeActivityText(label))
            .filter(label => label && available.has(label));
        return this.modalSelectedActivities.length !== before;
    }
    normalizeActivityText(text) {
        const textCore = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerTextCore)
            ? globalThis.TimeTrackerTextCore
            : null;
        if (textCore && typeof textCore.normalizeActivityText === 'function') {
            return textCore.normalizeActivityText(text);
        }
        if (!text) return '';
        // 제거: 줄바꿈/탭, 공백 축약
        return String(text)
            .replace(/[\r\n\t]+/g, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
    }
    normalizeNotionActivities(items) {
        if (!Array.isArray(items)) return [];
        const normalized = [];
        items.forEach((it) => {
            if (!it) return;
            const label = this.normalizeActivityText(it.title || '');
            if (!label) return;
            const priorityRank = Number.isFinite(it.priorityRank) ? Number(it.priorityRank) : null;
            const recommendedSeconds = this.resolveRecommendedPlanSeconds ? this.resolveRecommendedPlanSeconds(it) : 0;
            normalized.push({
                id: it.id,
                title: label,
                priorityRank,
                recommendedSeconds: recommendedSeconds > 0 ? recommendedSeconds : null,
            });
        });
        normalized.sort((a, b) => {
            const ra = Number.isFinite(a.priorityRank) ? a.priorityRank : Infinity;
            const rb = Number.isFinite(b.priorityRank) ? b.priorityRank : Infinity;
            if (ra !== rb) return ra - rb;
            return a.title.localeCompare(b.title);
        });
        return normalized;
    }
    makePriorityBadge(rank) {
        if (!Number.isFinite(rank)) return null;
        const badge = document.createElement('span');
        badge.className = 'pr-badge';
        badge.dataset.pr = String(rank);
        badge.textContent = `Pr.${rank}`;
        badge.setAttribute('aria-label', `우선순위 ${rank}`);
        return badge;
    }
    getPriorityRankForLabel(label) {
        const normalized = this.normalizeActivityText(label);
        if (!normalized) return null;
        const match = (this.plannedActivities || []).find((item) => {
            if (!item) return false;
            return this.normalizeActivityText(item.label || '') === normalized;
        });
        const rank = match && Number.isFinite(match.priorityRank) ? Number(match.priorityRank) : null;
        return Number.isFinite(rank) ? rank : null;
    }
    buildPlannedActivityOptions(extraLabels = []) {
        const grouped = { local: [], notion: [] };
        const seen = new Set();

        (this.plannedActivities || []).forEach((item) => {
            if (!item) return;
            const label = this.normalizeActivityText ? this.normalizeActivityText(item.label || '') : String(item.label || '').trim();
            if (!label || seen.has(label)) return;
            seen.add(label);
            const source = item.source === 'notion' ? 'notion' : 'local';
            const priorityRank = Number.isFinite(item.priorityRank) ? Number(item.priorityRank) : null;
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
    buildActivityLabelOptions(extraLabels = []) {
        const seen = new Set();
        const options = [];
        const normalize = (value) => {
            return this.normalizeActivityText ? this.normalizeActivityText(value || '') : String(value || '').trim();
        };

        (this.plannedActivities || []).forEach((item) => {
            if (!item) return;
            const label = normalize(item.label || item.title || '');
            if (!label || seen.has(label)) return;
            seen.add(label);
            options.push(label);
        });

        (extraLabels || []).forEach((raw) => {
            const label = normalize(raw);
            if (!label || seen.has(label)) return;
            seen.add(label);
            options.push(label);
        });

        return options;
    }
    populateActivityLabelSelect(select, optionLabels, currentLabel, placeholderText = '세부 활동') {
        if (!select) return;
        select.innerHTML = '';

        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = placeholderText;
        select.appendChild(placeholder);

        (optionLabels || []).forEach((label) => {
            const option = document.createElement('option');
            option.value = label;
            option.textContent = label;
            select.appendChild(option);
        });

        const normalizedCurrent = this.normalizeActivityText
            ? this.normalizeActivityText(currentLabel || '')
            : String(currentLabel || '').trim();
        select.value = normalizedCurrent || '';
    }
    refreshSubActivityOptions() {
        if (this.modalPlanSectionOpen) {
            this.renderPlanActivitiesList();
        }
    }
    renderPlannedActivityDropdown() {
        const chips = document.getElementById('activityChips');
        const list = document.getElementById('activityOptions');
        if (!chips || !list) return;
        // chips
        chips.innerHTML = '';
        (this.modalSelectedActivities || []).forEach(t => {
            const text = this.normalizeActivityText(t);
            if (!text) return;
            const chip = document.createElement('span');
            chip.className = 'chip';
            const chipBadge = this.makePriorityBadge(this.getPriorityRankForLabel(text));
            if (chipBadge) chip.appendChild(chipBadge);
            const chipLabel = document.createElement('span');
            chipLabel.className = 'chip-label';
            chipLabel.textContent = text;
            chip.appendChild(chipLabel);
            const btn = document.createElement('button');
            btn.className = 'remove-chip';
            btn.textContent = '×';
            btn.title = '제거';
            btn.onclick = () => {
                this.toggleSelectActivity(text, { fromChip: true });
            };
            chip.appendChild(btn);
            chips.appendChild(chip);
        });
        // list
        list.innerHTML = '';
        const normalizedSelections = (this.modalSelectedActivities || [])
            .map(t => this.normalizeActivityText(t))
            .filter(Boolean);
        const selectedSet = new Set(normalizedSelections);
        const grouped = this.buildPlannedActivityOptions(normalizedSelections);

        this.updatePlanSourceTabs({
            local: grouped.local.length,
            notion: grouped.notion.length
        });

        const activeSource = this.currentPlanSource === 'notion' ? 'notion' : 'local';
        const visibleItems = grouped[activeSource] || [];
        const planTotalSeconds = Math.max(0, Number(this.modalPlanTotalSeconds) || 0);
        const planUsedSeconds = this.getValidPlanActivitiesSeconds();
        const planRemainingSeconds = Math.max(0, planTotalSeconds - planUsedSeconds);
        const hasActivePlanRow = this.isValidPlanRow(this.modalPlanActiveRow);

        if (visibleItems.length === 0) {
            const empty = document.createElement('li');
            empty.className = 'empty-option';
            empty.textContent = activeSource === 'notion'
                ? '노션에서 불러온 활동이 없습니다.'
                : '직접 추가한 활동이 없습니다.';
            empty.dataset.source = activeSource;
            list.appendChild(empty);
            this.updateSchedulePreview();
            return;
        }

        visibleItems.forEach((item) => {
            const { label, source, priorityRank } = item;
            const recommendedSeconds = Number.isFinite(item.recommendedSeconds) ? Math.max(0, Math.floor(item.recommendedSeconds)) : null;
            const li = document.createElement('li');
            li.dataset.source = source;
            if (Number.isFinite(priorityRank)) {
                li.dataset.priorityRank = String(priorityRank);
            } else {
                delete li.dataset.priorityRank;
            }
            if (Number.isFinite(recommendedSeconds) && recommendedSeconds > 0) {
                li.dataset.recommendedSeconds = String(recommendedSeconds);
            } else {
                delete li.dataset.recommendedSeconds;
            }
            const left = document.createElement('div');
            left.style.display = 'flex';
            left.style.alignItems = 'center';
            left.style.gap = '6px';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = selectedSet.has(label);
            const disableInsert = this.modalPlanSectionOpen && !hasActivePlanRow && planRemainingSeconds <= 0 && !selectedSet.has(label);
            cb.disabled = disableInsert;
            cb.onchange = (event) => this.toggleSelectActivity(label, {
                source,
                recommendedSeconds,
                checked: event.target.checked
            });
            const span = document.createElement('span');
            span.className = 'option-label';
            span.textContent = label;
            left.appendChild(cb);
            const badge = this.makePriorityBadge(priorityRank);
            if (badge) left.appendChild(badge);
            left.appendChild(span);
            li.appendChild(left);
            const recommendedDisplay = Number.isFinite(recommendedSeconds) && recommendedSeconds > 0
                ? (this.normalizeDurationStep(recommendedSeconds) || recommendedSeconds)
                : null;
            let tooltip = '선택/해제';
            if (this.modalPlanSectionOpen) {
                if (hasActivePlanRow) {
                    tooltip = '활성 행으로 추가';
                } else if (planRemainingSeconds > 0) {
                    tooltip = '새 행으로 추가';
                } else {
                    tooltip = '잔여 시간이 없어 추가할 수 없어요';
                }
            }
            if (recommendedDisplay) {
                tooltip += ` · 추천 ${this.formatDurationSummary(recommendedDisplay)}`;
            }
            li.title = tooltip;
            li.classList.toggle('disabled-option', cb.disabled);
            const actions = document.createElement('div');
            actions.className = 'option-actions';
            const editBtn = document.createElement('button');
            editBtn.className = 'opt-btn';
            editBtn.textContent = '수정';
            editBtn.onclick = () => {
                const nt = prompt('활동명을 수정하세요', label);
                if (nt && nt.trim()) this.editPlannedActivityOption(label, nt.trim());
            };
            const delBtn = document.createElement('button');
            delBtn.className = 'opt-btn';
            delBtn.textContent = '삭제';
            delBtn.onclick = () => {
                this.removePlannedActivityOption(label);
            };
            actions.appendChild(editBtn);
            actions.appendChild(delBtn);
            li.appendChild(actions);
            list.appendChild(li);
        });

        if (this.renderPlanTitleDropdown) this.renderPlanTitleDropdown();
        this.updateSchedulePreview();
    }

    updatePlanSourceTabs(counts = {}, containerOverride = null) {
        const container = containerOverride || this.planTabsContainer || document.getElementById('planTabs');
        if (!container) return;
        const activeSource = this.currentPlanSource === 'notion' ? 'notion' : 'local';
        container.querySelectorAll('.plan-tab').forEach((button) => {
            const source = button.dataset.source === 'notion' ? 'notion' : 'local';
            const isActive = source === activeSource;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-selected', isActive ? 'true' : 'false');
            button.classList.toggle('empty', !(counts[source] > 0));
        });
    }
    getPlannedRangeInfo(index) {
        const info = { startIndex: index, endIndex: index, mergeKey: null };
        if (!Number.isInteger(index)) return info;
        const mk = this.findMergeKey ? this.findMergeKey('planned', index) : null;
        if (!mk) return info;
        const [, sStr, eStr] = mk.split('-');
        const s = parseInt(sStr, 10);
        const e = parseInt(eStr, 10);
        const startIndex = Number.isInteger(s) ? s : index;
        const endIndex = Number.isInteger(e) ? e : startIndex;
        return { startIndex, endIndex, mergeKey: mk };
    }
    getPlannedValueForIndex(index) {
        if (!Number.isInteger(index) || index < 0 || index >= this.timeSlots.length) return '';
        const mk = this.findMergeKey ? this.findMergeKey('planned', index) : null;
        if (mk) {
            const merged = this.mergedFields.get(mk);
            if (merged != null) {
                return this.normalizeActivityText ? this.normalizeActivityText(merged) : String(merged || '').trim();
            }
        }
        const slot = this.timeSlots[index];
        const raw = slot && typeof slot.planned === 'string' ? slot.planned : '';
        return this.normalizeActivityText ? this.normalizeActivityText(raw) : String(raw || '').trim();
    }
    resolveInlinePlanAnchor(anchorEl, fallbackIndex = null) {
        if (anchorEl && anchorEl.isConnected) return anchorEl;
        const target = this.inlinePlanTarget;
        const index = Number.isInteger(fallbackIndex)
            ? fallbackIndex
            : (target && Number.isInteger(target.startIndex) ? target.startIndex : null);
        if (!Number.isInteger(index)) return anchorEl || null;
        return document.querySelector(`[data-index="${index}"] .planned-input`)
            || document.querySelector(`[data-index="${index}"]`);
    }
    canInlineWheelScroll(targetEl, boundaryEl, deltaY) {
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
    handleInlinePlanWheel(event) {
        const dropdown = this.inlinePlanDropdown;
        if (!dropdown) return;
        const deltaY = Number(event.deltaY) || 0;
        if (deltaY === 0) return;
        if (this.canInlineWheelScroll(event.target, dropdown, deltaY)) return;
        event.preventDefault();
    }
    positionInlinePlanDropdown(anchorEl) {
        if (!this.inlinePlanDropdown) return;
        const anchor = this.resolveInlinePlanAnchor(anchorEl);
        if (!anchor) return;
        const rect = anchor.getBoundingClientRect();
        if (!rect || (!rect.width && !rect.height)) return;
        const scrollX = window.scrollX || document.documentElement.scrollLeft || 0;
        const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
        const dropdown = this.inlinePlanDropdown;
        const viewportWidth = document.documentElement.clientWidth || window.innerWidth || 0;
        const viewportHeight = document.documentElement.clientHeight || window.innerHeight || 0;
        const margin = 12;
        const gap = 6;

        const maxWidth = Math.max(240, viewportWidth - (margin * 2));
        const minWidth = Math.min(Math.max(240, rect.width + 32), maxWidth);
        dropdown.style.minWidth = `${minWidth}px`;
        dropdown.style.width = `${minWidth}px`;

        let left = rect.left + scrollX;
        const maxLeft = scrollX + viewportWidth - minWidth - margin;
        if (left > maxLeft) {
            left = Math.max(scrollX + margin, maxLeft);
        }

        dropdown.style.visibility = 'hidden';
        dropdown.style.left = '0px';
        dropdown.style.top = '0px';
        dropdown.style.maxHeight = '';

        const naturalHeight = Math.max(
            Number(dropdown.scrollHeight) || 0,
            Number(dropdown.offsetHeight) || 0
        );
        const spaceBelow = Math.max(120, Math.floor(viewportHeight - rect.bottom - margin));
        const spaceAbove = Math.max(120, Math.floor(rect.top - margin));

        let placeAbove = false;
        if (spaceBelow < 220 && spaceAbove > spaceBelow) {
            placeAbove = true;
        }

        let available = placeAbove ? spaceAbove : spaceBelow;
        if (available < 120) {
            placeAbove = spaceAbove > spaceBelow;
            available = Math.max(spaceAbove, spaceBelow, 120);
        }

        const maxHeight = Math.max(120, Math.floor(available));
        dropdown.style.maxHeight = `${maxHeight}px`;

        const estimatedHeight = Math.min(maxHeight, naturalHeight || maxHeight);
        let top = placeAbove
            ? (rect.top + scrollY - estimatedHeight - gap)
            : (rect.bottom + scrollY + gap);

        const minTop = scrollY + margin;
        const maxTop = scrollY + viewportHeight - margin - estimatedHeight;
        if (top < minTop) top = minTop;
        if (top > maxTop) top = Math.max(minTop, maxTop);

        dropdown.style.left = `${Math.round(left)}px`;
        dropdown.style.top = `${Math.round(top)}px`;
        dropdown.style.visibility = 'visible';
    }
    renderInlinePlanDropdownOptions() {
        if (!this.inlinePlanDropdown || !this.inlinePlanTarget) return;
        const list = this.inlinePlanDropdown.querySelector('.inline-plan-options-list');
        const tabs = this.inlinePlanDropdown.querySelector('.inline-plan-tabs');
        if (!list) return;

        const startIndex = Number.isInteger(this.inlinePlanTarget.startIndex) ? this.inlinePlanTarget.startIndex : 0;
        const currentValue = this.getPlannedValueForIndex(startIndex);
        const planActivities = this.getPlanActivitiesForIndex(startIndex);
        const hasPlanSplit = Array.isArray(planActivities) && planActivities.length > 0;
        const grouped = this.buildPlannedActivityOptions(!hasPlanSplit && currentValue ? [currentValue] : []);
        const counts = { local: (grouped.local || []).length, notion: (grouped.notion || []).length };
        this.updatePlanSourceTabs(counts, tabs);

        const activeSource = this.currentPlanSource === 'notion' ? 'notion' : 'local';
        const visibleItems = grouped[activeSource] || [];
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
            const priorityRank = Number.isFinite(item.priorityRank) ? Number(item.priorityRank) : null;
            const recommendedSeconds = Number.isFinite(item.recommendedSeconds) ? Math.max(0, Math.floor(item.recommendedSeconds)) : null;
            const normalizedLabel = this.normalizeActivityText ? this.normalizeActivityText(label) : String(label || '').trim();
            const li = document.createElement('li');
            li.className = 'inline-plan-option';
            li.dataset.source = source;
            if (normalizedCurrent && normalizedLabel === normalizedCurrent) {
                li.classList.add('selected');
            }

            const left = document.createElement('div');
            left.className = 'inline-plan-option-left';
            const badge = this.makePriorityBadge(priorityRank);
            if (badge) left.appendChild(badge);
            const text = document.createElement('span');
            text.className = 'inline-plan-option-label';
            text.textContent = label;
            left.appendChild(text);

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

            li.appendChild(left);
            li.appendChild(right);
            li.addEventListener('click', () => this.applyInlinePlanSelection(label, { keepOpen: true }));
            list.appendChild(li);
        });
    }

    openRoutineMenuFromInlinePlan(label, anchorEl) {
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
    positionRoutineMenu(anchorEl) {
        if (!this.routineMenu) return;
        if (!anchorEl || !anchorEl.isConnected) return;
        const rect = anchorEl.getBoundingClientRect();
        if (!rect || (!rect.width && !rect.height)) return;

        const menu = this.routineMenu;
        const scrollX = window.scrollX || document.documentElement.scrollLeft || 0;
        const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
        const viewportWidth = document.documentElement.clientWidth || window.innerWidth || 0;
        const viewportHeight = document.documentElement.clientHeight || window.innerHeight || 0;

        menu.style.visibility = 'hidden';
        menu.style.left = '0px';
        menu.style.top = '0px';

        const menuWidth = menu.offsetWidth || 220;
        const menuHeight = menu.offsetHeight || 180;

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
    closeRoutineMenu() {
        if (this.routineMenuOutsideHandler) {
            document.removeEventListener('mousedown', this.routineMenuOutsideHandler, true);
            this.routineMenuOutsideHandler = null;
        }
        if (this.routineMenuEscHandler) {
            document.removeEventListener('keydown', this.routineMenuEscHandler);
            this.routineMenuEscHandler = null;
        }
        if (this.routineMenu && this.routineMenu.parentNode) {
            this.routineMenu.parentNode.removeChild(this.routineMenu);
        }
        this.routineMenu = null;
        this.routineMenuContext = null;
    }
    handleRoutineMenuAction(action) {
        const ctx = this.routineMenuContext;
        if (!ctx) return;
        const act = String(action || '').trim().toLowerCase();

        if (act === 'daily' || act === 'weekday' || act === 'weekend') {
            const target = ctx.routineAtIndex || ctx.routineForWindow;
            let routine = target;
            if (routine) {
                const nextPassDates = Array.isArray(routine.passDates)
                    ? routine.passDates.filter(d => d !== this.currentDate)
                    : [];
                this.updateRoutineItem(routine.id, {
                    pattern: act,
                    stoppedAtMs: null,
                    passDates: nextPassDates
                });
            } else {
                let win = ctx.windowInfo;
                if (!win && Number.isInteger(ctx.ctxIndex) && this.timeSlots[ctx.ctxIndex]) {
                    win = { startHour: this.labelToHour(this.timeSlots[ctx.ctxIndex].time), durationHours: 1 };
                }
                if (!win) return;
                routine = this.upsertRoutineByWindow(ctx.label, win.startHour, win.durationHours, { pattern: act, stoppedAtMs: null, passDates: [] });
            }
            this.scheduleSupabaseRoutineSave();
            this.closeRoutineMenu();
            this.applyInlinePlanSelection(ctx.label, { keepOpen: true });
            this.renderInlinePlanDropdownOptions();
            return;
        }

        if (act === 'pass') {
            const routine = ctx.routineAtIndex || ctx.routineForWindow;
            if (!routine) {
                this.showNotification('이 시간대에 설정된 루틴이 없습니다.');
                this.closeRoutineMenu();
                return;
            }
            const routineChanged = this.passRoutineForDate(routine.id, this.currentDate);
            if (routineChanged) {
                this.scheduleSupabaseRoutineSave();
            }
            const cleared = this.clearRoutineRangeForDate(routine, this.currentDate);
            this.closeRoutineMenu();
            if (cleared) {
                this.renderTimeEntries(true);
                this.calculateTotals();
                this.autoSave();
            }
            this.renderInlinePlanDropdownOptions();
            if (this.inlinePlanTarget && Number.isInteger(ctx.ctxIndex)) {
                const anchor = document.querySelector(`[data-index="${ctx.ctxIndex}"] .planned-input`)
                    || document.querySelector(`[data-index="${ctx.ctxIndex}"]`);
                if (anchor) {
                    this.inlinePlanTarget.anchor = anchor;
                    this.positionInlinePlanDropdown(anchor);
                }
            }
            return;
        }

        if (act === 'stop') {
            const routine = ctx.routineAtIndex || ctx.routineForWindow;
            if (!routine) {
                this.showNotification('중단할 루틴이 없습니다.');
                this.closeRoutineMenu();
                return;
            }
            const stoppedAtMs = Date.now();
            this.updateRoutineItem(routine.id, { stoppedAtMs });
            this.scheduleSupabaseRoutineSave();
            const clearedNow = this.clearRoutineRangeForDate(routine, this.currentDate, { minSlotStartMs: stoppedAtMs });
            this.closeRoutineMenu();
            this.renderTimeEntries(true);
            if (clearedNow) {
                this.calculateTotals();
                this.autoSave();
            }
            this.clearRoutineFromLocalStorageFutureDates(routine, this.currentDate);
            this.clearRoutineFromSupabaseFutureDates(routine, this.currentDate);
            this.routines = (this.routines || []).filter((item) => item && item.id !== routine.id);
            this.scheduleSupabaseRoutineSave(true);
            this.renderInlinePlanDropdownOptions();
            return;
        }
    }
    openInlinePlanDropdown(index, anchorEl, endIndex = null) {
        const range = this.getPlannedRangeInfo(index);
        if (Number.isInteger(endIndex)) {
            range.startIndex = Math.min(range.startIndex, endIndex);
            range.endIndex = Math.max(range.endIndex, endIndex);
        }
        const anchor = this.resolveInlinePlanAnchor(anchorEl, range.startIndex);
        if (!anchor) return;
        this.closeInlinePlanDropdown();

        this.inlinePlanTarget = { ...range, anchor };
        const dropdown = document.createElement('div');
        dropdown.className = 'inline-plan-dropdown';
        dropdown.innerHTML = `
            <div class="inline-plan-tabs plan-tabs">
                <button type="button" class="plan-tab" data-source="local" role="tab" aria-selected="false">직접 추가</button>
                <button type="button" class="plan-tab" data-source="notion" role="tab" aria-selected="false">노션</button>
            </div>
            <div class="inline-plan-input-row">
                <input type="text" class="inline-plan-input" placeholder="활동 추가 또는 검색" />
                <button type="button" class="inline-plan-add-btn">추가</button>
                <button type="button" class="inline-plan-sync-btn">지우기</button>
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
        document.body.appendChild(dropdown);
        this.inlinePlanDropdown = dropdown;
        this.inlinePlanWheelHandler = (event) => this.handleInlinePlanWheel(event);
        dropdown.addEventListener('wheel', this.inlinePlanWheelHandler, { passive: false });

        const input = dropdown.querySelector('.inline-plan-input');
        const addBtn = dropdown.querySelector('.inline-plan-add-btn');
        const clearBtn = dropdown.querySelector('.inline-plan-sync-btn');
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
                const source = btn.dataset.source === 'notion' ? 'notion' : 'local';
                if (this.currentPlanSource === source) return;
                this.currentPlanSource = source;
                this.renderInlinePlanDropdownOptions();
                if (source === 'notion') runInlineNotionSync();
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
                this.applyInlinePlanSelection(val, options);
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
                    this.timeSlots[i].activityLog = { title: '', details: '', subActivities: [], titleBandOn: false, actualGridUnits: [], actualExtraGridUnits: [], actualOverride: false };
                }
                this.timeSlots[i].activityLog.subActivities = [];
                this.timeSlots[i].activityLog.actualGridUnits = [];
                this.timeSlots[i].activityLog.actualExtraGridUnits = [];
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

            if (this.inlinePlanTarget) {
                const anchor = document.querySelector(`[data-index="${baseIndex}"] .planned-input`)
                    || document.querySelector(`[data-index="${baseIndex}"]`);
                if (anchor) {
                    this.inlinePlanTarget.anchor = anchor;
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
        }
        if (addBtn) {
            addBtn.addEventListener('click', addHandler);
        }
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                clearHandler();
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
            this.inlinePlanTarget.anchor = anchorNow;
            this.positionInlinePlanDropdown(anchorNow);
            if (input) input.focus();
        });

        this.inlinePlanOutsideHandler = (event) => {
            if (!this.inlinePlanDropdown) return;
            if (this.inlinePlanDropdown.contains(event.target)) return;
            if (this.routineMenu && this.routineMenu.contains(event.target)) return;
            if (this.planActivityMenu && this.planActivityMenu.contains(event.target)) return;
            if (this.planTitleMenu && this.planTitleMenu.contains(event.target)) return;
            const currentAnchor = this.inlinePlanTarget && this.inlinePlanTarget.anchor;
            if (currentAnchor && currentAnchor.contains(event.target)) return;
            this.closeInlinePlanDropdown();
        };
        document.addEventListener('mousedown', this.inlinePlanOutsideHandler, true);

        this.inlinePlanEscHandler = (event) => {
            if (event.key === 'Escape') this.closeInlinePlanDropdown();
        };
        document.addEventListener('keydown', this.inlinePlanEscHandler);

        this.inlinePlanScrollHandler = (event) => {
            if (this.inlinePlanDropdown && event && event.target) {
                if (event.target === this.inlinePlanDropdown || this.inlinePlanDropdown.contains(event.target)) {
                    return;
                }
            }
            const currentAnchor = this.inlinePlanTarget && this.inlinePlanTarget.anchor;
            if (currentAnchor) this.positionInlinePlanDropdown(currentAnchor);
        };
        window.addEventListener('resize', this.inlinePlanScrollHandler);
        window.addEventListener('scroll', this.inlinePlanScrollHandler, true);

        if (this.prefetchNotionActivitiesIfConfigured) {
            this.prefetchNotionActivitiesIfConfigured()
                .then((added) => {
                    if (added && this.inlinePlanDropdown) {
                        this.renderInlinePlanDropdownOptions();
                    }
                })
                .catch(() => {});
        }
    }
    closeInlinePlanDropdown() {
        this.closeRoutineMenu();
        this.closePlanActivityMenu();
        this.closePlanTitleMenu();
        if (this.inlinePlanOutsideHandler) {
            document.removeEventListener('mousedown', this.inlinePlanOutsideHandler, true);
            this.inlinePlanOutsideHandler = null;
        }
        if (this.inlinePlanEscHandler) {
            document.removeEventListener('keydown', this.inlinePlanEscHandler);
            this.inlinePlanEscHandler = null;
        }
        if (this.inlinePlanScrollHandler) {
            window.removeEventListener('resize', this.inlinePlanScrollHandler);
            window.removeEventListener('scroll', this.inlinePlanScrollHandler, true);
            this.inlinePlanScrollHandler = null;
        }
        if (this.inlinePlanDropdown && this.inlinePlanWheelHandler) {
            this.inlinePlanDropdown.removeEventListener('wheel', this.inlinePlanWheelHandler);
            this.inlinePlanWheelHandler = null;
        }
        if (this.inlinePlanDropdown && this.inlinePlanDropdown.parentNode) {
            this.inlinePlanDropdown.parentNode.removeChild(this.inlinePlanDropdown);
        }
        this.inlinePlanDropdown = null;
        this.inlinePlanTarget = null;
        this.inlinePlanContext = null;
    }
    applyInlinePlanSelection(label, options = {}) {
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
                this.inlinePlanTarget.anchor = anchor;
                this.positionInlinePlanDropdown(anchor);
                const dropdownInput = this.inlinePlanDropdown && this.inlinePlanDropdown.querySelector('.inline-plan-input');
                if (dropdownInput) dropdownInput.focus();
            }
            return;
        }
        this.closeInlinePlanDropdown();
    }

    // ===== Notion integration (optional) =====
    loadNotionActivitiesEndpoint() {
        try {
            if (typeof window !== 'undefined' && window.NOTION_ACTIVITIES_ENDPOINT) {
                return String(window.NOTION_ACTIVITIES_ENDPOINT);
            }
        } catch (e) {}
        return null;
    }
    async prefetchNotionActivitiesIfConfigured() {
        const url = this.notionEndpoint;
        if (!url) {
            this.setNotionStatus('warn', '노션 미설정');
            return false;
        }

        this.setNotionStatus('info', '노션 동기화 중…');

        let changed = false;

        if (this.notionActivitiesCache) {
            const cached = this.normalizeNotionActivities(this.notionActivitiesCache);
            this.notionActivitiesCache = cached;
            changed = this.mergeNotionActivities(cached) || changed;
            if (changed) {
                this.renderPlannedActivityDropdown();
            }
        }

        try {
            const resp = await fetch(url, { method: 'GET', cache: 'no-store' });
            if (!resp.ok) throw new Error('Failed to fetch activities');
            const json = await resp.json();
            const items = Array.isArray(json?.activities) ? json.activities : [];
            const normalized = this.normalizeNotionActivities(items);
            this.notionActivitiesCache = normalized;
            const fetchChanged = this.mergeNotionActivities(normalized);
            this.setNotionStatus('success', `노션 동기화 완료 (${normalized.length}개)`);
            return changed || fetchChanged;
        } catch (e) {
            console.warn('Notion activities fetch failed:', e);
            this.setNotionStatus('error', '노션 동기화 실패 (재시도 가능)');
            this.showNotification('노션 동기화에 실패했습니다.', 'warn', {
                duration: 5000,
                actionLabel: '재시도',
                onAction: () => {
                    this.prefetchNotionActivitiesIfConfigured && this.prefetchNotionActivitiesIfConfigured();
                }
            });
            return changed;
        }
    }
    mergeNotionActivities(items) {
        const normalizedItems = this.normalizeNotionActivities(items);
        if (normalizedItems.length === 0) {
            const before = (this.plannedActivities || []).length;
            this.plannedActivities = (this.plannedActivities || []).filter(item => item && item.source !== 'notion');
            this.dedupeAndSortPlannedActivities();
            const selectionChanged = this.pruneSelectedActivitiesByAvailability();
            return selectionChanged || ((this.plannedActivities || []).length !== before);
        }

        const next = [];
        let changed = false;
        const notionMap = new Map();

        normalizedItems.forEach((item) => {
            const label = this.normalizeActivityText(item.title || '');
            if (!label) return;
            const rank = Number.isFinite(item.priorityRank) ? Number(item.priorityRank) : null;
            const recommendedSeconds = Number.isFinite(item.recommendedSeconds) ? Math.max(0, Number(item.recommendedSeconds)) : null;
            const existing = notionMap.get(label);
            if (!existing) {
                notionMap.set(label, { priorityRank: rank, recommendedSeconds });
                return;
            }
            const existingRank = existing.priorityRank ?? Infinity;
            const incomingRank = rank ?? Infinity;
            let replace = false;
            if (existingRank > incomingRank) {
                replace = true;
            } else if (existingRank === incomingRank) {
                const existingRecommended = Number.isFinite(existing.recommendedSeconds) ? existing.recommendedSeconds : null;
                if (!(existingRecommended > 0) && recommendedSeconds > 0) {
                    replace = true;
                }
            }
            if (replace) {
                notionMap.set(label, { priorityRank: rank, recommendedSeconds });
            }
        });

        (this.plannedActivities || []).forEach((item) => {
            if (!item) return;
            const label = this.normalizeActivityText(item.label || '');
            if (!label) return;

            if (item.source === 'notion') {
                if (notionMap.has(label)) {
                    const info = notionMap.get(label);
                    const rank = info.priorityRank ?? null;
                    const recommended = Number.isFinite(info.recommendedSeconds) ? Math.max(0, Number(info.recommendedSeconds)) : null;
                    const prevRecommended = Number.isFinite(item.recommendedSeconds) ? Math.max(0, Number(item.recommendedSeconds)) : null;
                    if ((item.priorityRank ?? null) !== rank || (prevRecommended ?? null) !== (recommended ?? null)) changed = true;
                    next.push({ label, source: 'notion', priorityRank: rank, recommendedSeconds: recommended });
                    notionMap.delete(label);
                } else {
                    changed = true; // stale notion entry removed
                }
                return;
            }

            const localRecommended = Number.isFinite(item.recommendedSeconds) ? Math.max(0, Number(item.recommendedSeconds)) : null;
            next.push({ label, source: 'local', priorityRank: null, recommendedSeconds: localRecommended });
            if (notionMap.has(label)) notionMap.delete(label);
        });

        notionMap.forEach((info, label) => {
            next.push({
                label,
                source: 'notion',
                priorityRank: info.priorityRank ?? null,
                recommendedSeconds: Number.isFinite(info.recommendedSeconds) ? Math.max(0, Number(info.recommendedSeconds)) : null
            });
            changed = true;
        });

        this.plannedActivities = next;
        this.dedupeAndSortPlannedActivities();
        if (this.pruneSelectedActivitiesByAvailability()) {
            changed = true;
        }
        if (changed) {
            this.refreshSubActivityOptions();
        }
        return changed;
    }

    showNotification(message, type = 'info', options = {}) {
        if (!this.notificationRegion) {
            const region = document.createElement('div');
            region.className = 'notification-region';
            region.setAttribute('role', 'region');
            region.setAttribute('aria-label', '알림');
            region.setAttribute('aria-live', 'polite');
            region.setAttribute('aria-atomic', 'true');
            document.body.appendChild(region);
            this.notificationRegion = region;
        }
        const notification = document.createElement('div');
        notification.className = `toast toast-${type}`;
        notification.setAttribute('role', type === 'error' ? 'alert' : 'status');
        notification.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
        const text = document.createElement('span');
        text.textContent = message;
        notification.appendChild(text);
        if (options.actionLabel && typeof options.onAction === 'function') {
            const actionBtn = document.createElement('button');
            actionBtn.type = 'button';
            actionBtn.className = 'toast-action';
            actionBtn.textContent = options.actionLabel;
            actionBtn.setAttribute('aria-label', `${options.actionLabel} 실행`);
            actionBtn.addEventListener('click', () => {
                options.onAction();
                notification.remove();
            });
            notification.appendChild(actionBtn);
        }
        this.notificationRegion.appendChild(notification);

        const duration = Number.isFinite(options.duration) ? options.duration : 3000;
        setTimeout(() => {
            notification.classList.add('toast-exit');
            setTimeout(() => {
                notification.remove();
                if (typeof options.onClose === 'function') options.onClose();
            }, 250);
        }, duration);
    }

    // 타이머 관련 메서드들 추가
    attachTimerListeners(entryDiv, index) {
        const timerBtns = entryDiv.querySelectorAll('.timer-btn');
        
        timerBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const btnIndex = parseInt(btn.dataset.index);
                
                switch(action) {
                    case 'start':
                        this.startTimer(btnIndex);
                        break;
                    case 'pause':
                        this.pauseTimer(btnIndex);
                        break;
                    case 'resume':
                        this.resumeTimer(btnIndex);
                        break;
                    case 'stop':
                        this.stopTimer(btnIndex);
                        break;
                }
            });
        });
    }

    startTimer(index) {
        const reason = this.getTimerStartBlockReason(index);
        if (reason) {
            this.showNotification(reason, 'warn');
            if (reason.includes('계획된 활동')) {
                const plannedInput = document.querySelector(`.planned-input[data-index="${index}"]`);
                if (plannedInput && typeof plannedInput.focus === 'function') plannedInput.focus();
            }
            return;
        }
        
        // 다른 모든 타이머 정지
        this.stopAllTimers();
        
        const slot = this.timeSlots[index];
        slot.timer.running = true;
        slot.timer.startTime = Date.now();
        slot.timer.method = 'timer';
        
        this.startTimerInterval();
        this.renderTimeEntries();
        this.autoSave();
    }

    pauseTimer(index) {
        const slot = this.timeSlots[index];
        slot.timer.running = false;
        slot.timer.elapsed += Math.floor((Date.now() - slot.timer.startTime) / 1000);
        slot.timer.startTime = null;
        
        this.stopTimerInterval();
        this.renderTimeEntries();
        this.autoSave();
    }

    resumeTimer(index) {
        const reason = this.getTimerStartBlockReason(index);
        if (reason) {
            this.showNotification(reason, 'warn');
            if (reason.includes('계획된 활동')) {
                const plannedInput = document.querySelector(`.planned-input[data-index="${index}"]`);
                if (plannedInput && typeof plannedInput.focus === 'function') plannedInput.focus();
            }
            return;
        }
        
        // 다른 모든 타이머 정지
        this.stopAllTimers();
        
        const slot = this.timeSlots[index];
        slot.timer.running = true;
        slot.timer.startTime = Date.now();
        
        this.startTimerInterval();
        this.renderTimeEntries();
        this.autoSave();
    }

    stopTimer(index) {
        const slot = this.timeSlots[index];
        let additionalSeconds = 0;
        
        if (slot.timer.running) {
            additionalSeconds = Math.max(0, Math.floor((Date.now() - slot.timer.startTime) / 1000));
            slot.timer.elapsed += additionalSeconds;
        }
        
        slot.timer.running = false;
        slot.timer.startTime = null;

        let recordedWithPlan = false;

        // 자동 기록: 타이머 시간을 실제 활동의 10분 그리드로 반영
        if (additionalSeconds > 0) {
            const actualMergeKey = this.findMergeKey('actual', index);
            const actualBaseIndex = actualMergeKey ? parseInt(actualMergeKey.split('-')[1], 10) : index;
            if (this.isActualGridMode(actualBaseIndex)) {
                const range = this.getSplitRange('actual', actualBaseIndex);
                const currentTimeIndex = this.getCurrentTimeIndex ? this.getCurrentTimeIndex() : -1;
                const targetIndex = (Number.isInteger(currentTimeIndex)
                    && currentTimeIndex >= range.start
                    && currentTimeIndex <= range.end)
                    ? currentTimeIndex
                    : index;
                const startRow = Math.max(0, targetIndex - range.start);
                this.applyActualGridSeconds(actualBaseIndex, additionalSeconds, startRow);
                recordedWithPlan = true;
            }
        }

        // 계획 분배에 실패했을 때의 기본 동작(기존 텍스트 기록 유지)
        if (!recordedWithPlan && additionalSeconds > 0) {
            const timeStr = this.formatTime(slot.timer.elapsed);

            // 병합된 계획 값이 있으면 그 값을 우선 사용하여 라벨 구성
            let plannedLabel = '';
            const plannedMergeKey = this.findMergeKey('planned', index);
            if (plannedMergeKey) {
                plannedLabel = (this.mergedFields.get(plannedMergeKey) || '').trim();
            } else {
                plannedLabel = (slot.planned || '').trim();
            }
            const resultText = plannedLabel ? `${plannedLabel} (${timeStr})` : timeStr;

            // 실제(우측) 열이 병합 상태라면 병합 키 기준으로 값 업데이트
            const actualMergeKey = this.findMergeKey('actual', index);
            if (actualMergeKey) {
                const [, startStr, endStr] = actualMergeKey.split('-');
                const start = parseInt(startStr, 10);
                const end = parseInt(endStr, 10);
                this.mergedFields.set(actualMergeKey, resultText);
                for (let i = start; i <= end; i++) {
                    this.timeSlots[i].actual = (i === start) ? resultText : '';
                }
            } else {
                // 단일 셀인 경우 해당 인덱스만 기록
                slot.actual = resultText;
            }
        }
        
        this.stopTimerInterval();
        this.renderTimeEntries();
        this.calculateTotals();
        this.autoSave();
    }

    stopAllTimers() {
        this.commitRunningTimers({ render: false, calculate: false, autoSave: false });
    }

    commitRunningTimers(options = {}) {
        const shouldRender = Boolean(options.render);
        const shouldCalculate = Boolean(options.calculate);
        const shouldAutoSave = Boolean(options.autoSave);
        const nowMs = Date.now();
        let changed = false;
        this.timeSlots.forEach((slot) => {
            if (slot.timer.running) {
                slot.timer.elapsed += Math.max(0, Math.floor((nowMs - slot.timer.startTime) / 1000));
                slot.timer.running = false;
                slot.timer.startTime = null;
                changed = true;
            }
        });
        this.stopTimerInterval();
        if (!changed) return false;
        if (shouldRender) this.renderTimeEntries();
        if (shouldCalculate) this.calculateTotals();
        if (shouldAutoSave) this.autoSave();
        return true;
    }

    startTimerInterval() {
        if (this.timerInterval) return;
        
        this.timerInterval = setInterval(() => {
            this.updateRunningTimers();
        }, 1000);
    }

    stopTimerInterval() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    updateRunningTimers() {
        const today = this.getTodayLocalDateString();
        if (this.lastKnownTodayDate !== today) {
            this.lastKnownTodayDate = today;
            const hasRunningBeforeRollover = this.timeSlots.some((slot) => slot && slot.timer && slot.timer.running);
            if (hasRunningBeforeRollover && this.currentDate !== today) {
                this.transitionToDate(today);
                return;
            }
        }

        let hasRunningTimer = false;

        this.timeSlots.forEach((slot, index) => {
            if (slot.timer.running) {
                hasRunningTimer = true;
                const currentElapsed = slot.timer.elapsed + Math.floor((Date.now() - slot.timer.startTime) / 1000);
                const displayElement = document.querySelector(`[data-index="${index}"] .timer-display`);
                if (displayElement) {
                    displayElement.textContent = this.formatTime(currentElapsed);
                }
            }
        });

        if (!hasRunningTimer) {
            this.stopTimerInterval();
        }
    }

    // 활동 로그 관련 메서드들
    attachActivityLogListener(entryDiv, index) {
        const activityBtn = entryDiv.querySelector('.activity-log-btn');
        if (activityBtn) {
            activityBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openActivityLogModal(index);
            });
        }
    }

    getActualModalElements() {
        return {
            list: document.getElementById('actualActivitiesList'),
            totalEl: document.getElementById('actualSplitTotalTime'),
            usedEl: document.getElementById('actualSplitUsedTime'),
            noticeEl: document.getElementById('actualActivitiesNotice'),
            addBtn: document.getElementById('addActualActivityRow')
        };
    }

    normalizeActualActivitiesList(raw) {
        if (!Array.isArray(raw)) return [];
        return raw
            .filter(item => item && typeof item === 'object')
            .map(item => {
                const labelSource = (item.label ?? item.title ?? '').toString();
                const label = this.normalizeActivityText ? this.normalizeActivityText(labelSource) : labelSource.trim();
                const rawSeconds = Number.isFinite(item.seconds) ? Number(item.seconds) : 0;
                const seconds = this.normalizeActualDurationStep(rawSeconds);
                const rawRecorded = Number.isFinite(item.recordedSeconds) ? Number(item.recordedSeconds) : null;
                const recordedSeconds = (rawRecorded == null) ? null : this.normalizeActualDurationStep(rawRecorded);
                const source = typeof item.source === 'string' ? item.source : null;
                const order = Number.isFinite(item.order) ? Math.max(0, Math.floor(item.order)) : null;
                const normalized = { label, seconds, source, recordedSeconds };
                if (order != null) {
                    normalized.order = order;
                }
                return normalized;
            })
            .filter(item => item.label || item.seconds > 0);
    }

    sortActivitiesByOrder(list) {
        if (!Array.isArray(list)) return [];
        return list
            .map((item, idx) => ({
                item,
                idx,
                order: Number.isFinite(item && item.order) ? Math.max(0, Math.floor(item.order)) : null
            }))
            .sort((a, b) => {
                const aHas = a.order != null;
                const bHas = b.order != null;
                if (aHas && bHas) return a.order - b.order;
                if (aHas) return -1;
                if (bHas) return 1;
                return a.idx - b.idx;
            })
            .map(entry => entry.item);
    }

    getActualActivitiesSeconds(items = null) {
        const list = Array.isArray(items) ? items : (this.modalActualActivities || []);
        return list.reduce((sum, item) => {
            if (!item) return sum;
            const secs = Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
            return sum + secs;
        }, 0);
    }

    buildActualActivitiesSeed(baseIndex, totalSeconds) {
        const baseSlot = this.timeSlots[baseIndex] || {};
        const existing = this.normalizeActualActivitiesList(baseSlot.activityLog && baseSlot.activityLog.subActivities);
        if (existing.length > 0) return existing.map(item => ({ ...item }));

        const planActivities = this.getPlanActivitiesForIndex(baseIndex);
        if (planActivities.length > 0) {
            const sumSeconds = planActivities.reduce((sum, item) => {
                const secs = Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
                return sum + secs;
            }, 0);
            if (sumSeconds <= 0 && totalSeconds > 0) {
                const fallbackSeconds = this.normalizeActualDurationStep(
                    Math.floor(totalSeconds / Math.max(1, planActivities.length))
                );
                return planActivities.map(item => ({
                    label: item.label || '',
                    seconds: fallbackSeconds
                }));
            }
            return planActivities.map(item => ({
                label: item.label || '',
                seconds: this.normalizeActualDurationStep(Number.isFinite(item.seconds) ? item.seconds : 0)
            }));
        }

        const planLabel = this.getPlannedLabelForIndex(baseIndex);
        if (planLabel) {
            return [{ label: planLabel, seconds: totalSeconds }];
        }
        return totalSeconds > 0 ? [{ label: '', seconds: totalSeconds }] : [];
    }

    getActualPlanLabelContext(baseIndex) {
        const context = this.buildPlanUnitsForActualGrid(baseIndex);
        const units = (context && Array.isArray(context.units)) ? context.units : [];
        const labelSet = new Set();
        units.forEach((label) => {
            const normalized = this.normalizeActivityText
                ? this.normalizeActivityText(label || '')
                : String(label || '').trim();
            if (normalized) {
                labelSet.add(normalized);
            }
        });
        const planActivities = this.getPlanActivitiesForIndex(baseIndex);
        if (Array.isArray(planActivities)) {
            planActivities.forEach((item) => {
                if (!item) return;
                const normalized = this.normalizeActivityText
                    ? this.normalizeActivityText(item.label || '')
                    : String(item.label || '').trim();
                if (normalized) {
                    labelSet.add(normalized);
                }
            });
        }
        const planLabel = context && context.planLabel
            ? (this.normalizeActivityText ? this.normalizeActivityText(context.planLabel) : String(context.planLabel || '').trim())
            : '';
        if (planLabel) {
            labelSet.add(planLabel);
        }
        return { units, labelSet, hasLabels: labelSet.size > 0, planLabel };
    }

    getActualGridSecondsMap(planUnits = null, actualUnits = null) {
        const gridMetricsCore = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerGridMetricsCore)
            ? globalThis.TimeTrackerGridMetricsCore
            : null;
        if (gridMetricsCore && typeof gridMetricsCore.getActualGridSecondsMap === 'function') {
            return gridMetricsCore.getActualGridSecondsMap(planUnits, actualUnits, {
                fallbackPlanUnits: this.modalActualPlanUnits,
                fallbackActualUnits: this.modalActualGridUnits,
                stepSeconds: this.getActualDurationStepSeconds(),
                normalizeActivityText: (value) => this.normalizeActivityText
                    ? this.normalizeActivityText(value || '')
                    : String(value || '').trim(),
            });
        }
        const units = Array.isArray(planUnits) ? planUnits : this.modalActualPlanUnits;
        const activeUnits = Array.isArray(actualUnits) ? actualUnits : this.modalActualGridUnits;
        const map = new Map();
        if (!Array.isArray(units) || !Array.isArray(activeUnits)) return map;
        const step = this.getActualDurationStepSeconds();
        for (let i = 0; i < units.length; i++) {
            if (!activeUnits[i]) continue;
            const normalized = this.normalizeActivityText
                ? this.normalizeActivityText(units[i] || '')
                : String(units[i] || '').trim();
            if (!normalized) continue;
            map.set(normalized, (map.get(normalized) || 0) + step);
        }
        return map;
    }

    getActualGridSecondsForLabel(label, gridMap = null) {
        const gridMetricsCore = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerGridMetricsCore)
            ? globalThis.TimeTrackerGridMetricsCore
            : null;
        if (gridMetricsCore && typeof gridMetricsCore.getActualGridSecondsForLabel === 'function') {
            return gridMetricsCore.getActualGridSecondsForLabel(label, {
                gridMap,
                resolveGridMap: () => this.getActualGridSecondsMap(),
                normalizeActivityText: (value) => this.normalizeActivityText
                    ? this.normalizeActivityText(value || '')
                    : String(value || '').trim(),
            });
        }
        const normalized = this.normalizeActivityText
            ? this.normalizeActivityText(label || '')
            : String(label || '').trim();
        if (!normalized) return 0;
        const map = gridMap || this.getActualGridSecondsMap();
        return map.get(normalized) || 0;
    }

    getActualGridUnitCounts(planUnits = null, actualUnits = null) {
        const gridMetricsCore = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerGridMetricsCore)
            ? globalThis.TimeTrackerGridMetricsCore
            : null;
        if (gridMetricsCore && typeof gridMetricsCore.getActualGridUnitCounts === 'function') {
            return gridMetricsCore.getActualGridUnitCounts(planUnits, actualUnits, {
                fallbackPlanUnits: this.modalActualPlanUnits,
                fallbackActualUnits: this.modalActualGridUnits,
                normalizeActivityText: (value) => this.normalizeActivityText
                    ? this.normalizeActivityText(value || '')
                    : String(value || '').trim(),
            });
        }
        const units = Array.isArray(planUnits) ? planUnits : this.modalActualPlanUnits;
        const activeUnits = Array.isArray(actualUnits) ? actualUnits : this.modalActualGridUnits;
        const counts = new Map();
        if (!Array.isArray(units) || !Array.isArray(activeUnits)) return counts;
        for (let i = 0; i < units.length; i++) {
            if (!activeUnits[i]) continue;
            const normalized = this.normalizeActivityText
                ? this.normalizeActivityText(units[i] || '')
                : String(units[i] || '').trim();
            if (!normalized) continue;
            counts.set(normalized, (counts.get(normalized) || 0) + 1);
        }
        return counts;
    }

    getActualAssignedSecondsMap() {
        const gridMetricsCore = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerGridMetricsCore)
            ? globalThis.TimeTrackerGridMetricsCore
            : null;
        if (gridMetricsCore && typeof gridMetricsCore.getActualAssignedSecondsMap === 'function') {
            return gridMetricsCore.getActualAssignedSecondsMap(this.modalActualActivities, {
                normalizeActivityText: (value) => this.normalizeActivityText
                    ? this.normalizeActivityText(value || '')
                    : String(value || '').trim(),
            });
        }
        const map = new Map();
        (this.modalActualActivities || []).forEach((item) => {
            if (!item) return;
            const label = this.normalizeActivityText
                ? this.normalizeActivityText(item.label || '')
                : String(item.label || '').trim();
            if (!label) return;
            const seconds = Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
            map.set(label, seconds);
        });
        return map;
    }

    clampActualGridToAssigned() {
        if (!this.modalActualHasPlanUnits) return;
        const planUnits = Array.isArray(this.modalActualPlanUnits) ? this.modalActualPlanUnits : [];
        const gridUnits = Array.isArray(this.modalActualGridUnits)
            ? this.modalActualGridUnits.map(value => Boolean(value))
            : [];
        if (planUnits.length === 0 || gridUnits.length === 0) return;

        const step = this.getActualDurationStepSeconds();
        const assignedMap = this.getActualAssignedSecondsMap();
        const allowedCounts = new Map();
        assignedMap.forEach((seconds, label) => {
            const allowed = seconds > 0 ? Math.floor(seconds / step) : 0;
            allowedCounts.set(label, allowed);
        });

        const currentCounts = this.getActualGridUnitCounts(planUnits, gridUnits);
        let changed = false;
        allowedCounts.forEach((allowed, label) => {
            const current = currentCounts.get(label) || 0;
            if (current <= allowed) return;
            let excess = current - allowed;
            for (let i = planUnits.length - 1; i >= 0 && excess > 0; i--) {
                const normalized = this.normalizeActivityText
                    ? this.normalizeActivityText(planUnits[i] || '')
                    : String(planUnits[i] || '').trim();
                if (!normalized || normalized !== label) continue;
                if (!gridUnits[i]) continue;
                gridUnits[i] = false;
                excess -= 1;
                changed = true;
            }
        });

        if (changed) {
            this.modalActualGridUnits = gridUnits;
        }

        if (Array.isArray(this.modalActualActivities)) {
            this.modalActualActivities.forEach((item) => {
                if (!item) return;
                const label = this.normalizeActivityText
                    ? this.normalizeActivityText(item.label || '')
                    : String(item.label || '').trim();
                if (!label) return;
                const isPlanLabel = (this.modalActualPlanLabelSet instanceof Set && this.modalActualPlanLabelSet.has(label))
                    || item.source === 'grid';
                if (isPlanLabel) return;
                const assigned = Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
                if (!Number.isFinite(item.recordedSeconds)) return;
                if (assigned > 0 && item.recordedSeconds > assigned) {
                    item.recordedSeconds = assigned;
                }
            });
        }
    }

    getPlanLabelOrderForActual(baseIndex, planUnits, planLabel = '') {
        const order = [];
        const seen = new Set();
        const pushLabel = (raw) => {
            const normalized = this.normalizeActivityText
                ? this.normalizeActivityText(raw || '')
                : String(raw || '').trim();
            if (!normalized || seen.has(normalized)) return;
            seen.add(normalized);
            order.push(normalized);
        };

        const planActivities = this.getPlanActivitiesForIndex(baseIndex);
        if (planActivities.length > 0) {
            planActivities.forEach((item) => {
                if (!item) return;
                pushLabel(item.label || '');
            });
        }

        if (order.length === 0) {
            pushLabel(planLabel);
        }

        if (order.length === 0 && Array.isArray(planUnits)) {
            planUnits.forEach((label) => {
                pushLabel(label);
            });
        }

        return order;
    }

    buildActualModalActivities(baseIndex, planUnits, gridUnits, existingActivities = null, planLabel = '') {
        const normalize = (value) => this.normalizeActivityText
            ? this.normalizeActivityText(value || '')
            : String(value || '').trim();
        const planLabelSet = new Set();
        if (Array.isArray(planUnits)) {
            planUnits.forEach((label) => {
                const normalized = normalize(label);
                if (normalized) planLabelSet.add(normalized);
            });
        }

        const planAssignedMap = new Map();
        const planActivities = this.getPlanActivitiesForIndex(baseIndex);
        if (Array.isArray(planActivities) && planActivities.length > 0) {
            planActivities.forEach((item) => {
                if (!item) return;
                const label = normalize(item.label || '');
                if (!label) return;
                const seconds = this.normalizeActualDurationStep(Number.isFinite(item.seconds) ? item.seconds : 0);
                if (seconds > 0) {
                    planAssignedMap.set(label, seconds);
                }
            });
        } else if (planLabel) {
            const totalSeconds = Number.isFinite(this.modalActualTotalSeconds) && this.modalActualTotalSeconds > 0
                ? this.modalActualTotalSeconds
                : Math.max(0, this.getBlockLength('actual', baseIndex) * 3600);
            const normalizedTotal = this.normalizeActualDurationStep(totalSeconds);
            const normalizedLabel = normalize(planLabel);
            if (normalizedLabel && normalizedTotal > 0) {
                planAssignedMap.set(normalizedLabel, normalizedTotal);
            }
        }

        const gridSecondsMap = this.getActualGridSecondsMap(planUnits, gridUnits);
        const hasGrid = Array.from(gridSecondsMap.values()).some(seconds => seconds > 0);
        const planOrder = this.getPlanLabelOrderForActual(baseIndex, planUnits, planLabel);
        const existing = this.normalizeActualActivitiesList(existingActivities);

        let baseList = existing;
        if (baseList.length === 0) {
            if (hasGrid && planOrder.length > 0) {
                baseList = planOrder.map(label => ({
                    label,
                    seconds: planAssignedMap.get(label) || (gridSecondsMap.get(label) || 0),
                    source: 'grid'
                }));
            } else {
                baseList = this.buildActualActivitiesSeed(baseIndex, this.modalActualTotalSeconds)
                    .map(item => ({ ...item }));
            }
        }

        const merged = [];
        const seenPlanLabels = new Set();

        baseList.forEach((item) => {
            if (!item) return;
            const label = normalize(item.label || '');
            let seconds = Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
            const rawRecorded = Number.isFinite(item.recordedSeconds) ? Math.max(0, Math.floor(item.recordedSeconds)) : null;
            if (!label && seconds <= 0) return;
            const isPlanLabel = label && planLabelSet.has(label);
            if (isPlanLabel) seenPlanLabels.add(label);
            if (isPlanLabel) {
                const plannedSeconds = planAssignedMap.get(label);
                if (Number.isFinite(plannedSeconds) && plannedSeconds > 0) {
                    seconds = plannedSeconds;
                }
            }
            const source = item.source && item.source !== 'grid'
                ? item.source
                : (isPlanLabel ? 'grid' : 'extra');
            const entry = { label, seconds, source };
            if (!isPlanLabel && rawRecorded != null) {
                entry.recordedSeconds = rawRecorded;
            }
            merged.push(entry);
        });

        planOrder.forEach((label) => {
            if (!label || seenPlanLabels.has(label)) return;
            const plannedSeconds = planAssignedMap.get(label);
            const seconds = Number.isFinite(plannedSeconds) && plannedSeconds > 0
                ? plannedSeconds
                : (gridSecondsMap.get(label) || 0);
            merged.push({ label, seconds, source: 'grid' });
            seenPlanLabels.add(label);
        });

        return merged;
    }

    getModalActualGridUnitsForSave(totalUnits) {
        if (!Number.isFinite(totalUnits) || totalUnits <= 0) return [];
        const raw = Array.isArray(this.modalActualGridUnits)
            ? this.modalActualGridUnits.map(value => Boolean(value))
            : [];
        let units = raw;
        if (units.length > totalUnits) units = units.slice(0, totalUnits);
        if (units.length < totalUnits) {
            units = units.concat(new Array(totalUnits - units.length).fill(false));
        }
        return units;
    }

    mergeActualActivitiesWithGrid(baseIndex, planUnits, gridActivities, existingActivities = null, planLabel = '') {
        const labelSet = new Set();
        if (Array.isArray(planUnits)) {
            planUnits.forEach((label) => {
                const normalized = this.normalizeActivityText
                    ? this.normalizeActivityText(label || '')
                    : String(label || '').trim();
                if (normalized) labelSet.add(normalized);
            });
        }

        const gridSecondsMap = new Map();
        (Array.isArray(gridActivities) ? gridActivities : []).forEach((item) => {
            if (!item || !item.label) return;
            const normalized = this.normalizeActivityText
                ? this.normalizeActivityText(item.label || '')
                : String(item.label || '').trim();
            if (!normalized) return;
            const seconds = Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
            gridSecondsMap.set(normalized, seconds);
        });

        const slot = this.timeSlots[baseIndex];
        const baseList = Array.isArray(existingActivities)
            ? existingActivities
            : this.normalizeActualActivitiesList(slot && slot.activityLog && slot.activityLog.subActivities);

        const merged = [];
        const seenGrid = new Set();

        if (baseList.length > 0) {
            baseList.forEach((item) => {
                if (!item) return;
                const label = this.normalizeActivityText
                    ? this.normalizeActivityText(item.label || '')
                    : String(item.label || '').trim();
                const seconds = Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
                const recordedSeconds = Number.isFinite(item.recordedSeconds)
                    ? Math.max(0, Math.floor(item.recordedSeconds))
                    : null;
                if (!label && seconds <= 0) return;
                if (label && labelSet.has(label)) {
                    merged.push({ label, seconds: gridSecondsMap.get(label) || 0, source: 'grid' });
                    seenGrid.add(label);
                } else {
                    const source = (item.source && item.source !== 'grid') ? item.source : 'extra';
                    const entry = { label, seconds, source };
                    if (recordedSeconds != null) entry.recordedSeconds = recordedSeconds;
                    merged.push(entry);
                }
            });
        }

        const orderedLabels = this.getPlanLabelOrderForActual(baseIndex, planUnits, planLabel);
        orderedLabels.forEach((label) => {
            if (seenGrid.has(label)) return;
            merged.push({ label, seconds: gridSecondsMap.get(label) || 0, source: 'grid' });
            seenGrid.add(label);
        });

        return merged;
    }

    splitActualActivitiesByPlan(baseIndex, activities) {
        const { units, labelSet, hasLabels } = this.getActualPlanLabelContext(baseIndex);
        const gridActivities = [];
        const extraActivities = [];
        (Array.isArray(activities) ? activities : []).forEach((item) => {
            if (!item) return;
            const label = this.normalizeActivityText
                ? this.normalizeActivityText(item.label || '')
                : String(item.label || '').trim();
            const seconds = Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
            if (!label && seconds <= 0) return;
            const isGridLabel = hasLabels && labelSet.has(label);
            const source = isGridLabel
                ? 'grid'
                : ((item.source && item.source !== 'grid') ? item.source : 'extra');
            const normalizedItem = { label, seconds, source };
            if (isGridLabel) {
                gridActivities.push(normalizedItem);
            } else {
                extraActivities.push(normalizedItem);
            }
        });
        return { units, gridActivities, extraActivities, hasLabels };
    }

    normalizeActualActivitiesToTotal(totalSeconds = null) {
        const total = Math.max(0, Number(totalSeconds != null ? totalSeconds : this.modalActualTotalSeconds) || 0);
        if (!Array.isArray(this.modalActualActivities)) {
            this.modalActualActivities = [];
        }
        const items = this.modalActualActivities;
        if (items.length === 0) {
            if (total > 0) {
                items.push({ label: '', seconds: total });
            }
            return;
        }

        items.forEach((item) => {
            item.seconds = this.normalizeActualDurationStep(Number.isFinite(item.seconds) ? item.seconds : 0);
        });

        if (total === 0) {
            items.forEach((item) => { item.seconds = 0; });
            return;
        }

        let sum = this.getActualActivitiesSeconds(items);
        if (sum === total) return;
        if (sum === 0) {
            items[0].seconds = total;
            return;
        }
        if (sum < total) {
            items[items.length - 1].seconds += (total - sum);
            return;
        }

        let remaining = sum - total;
        for (let i = items.length - 1; i >= 0 && remaining > 0; i--) {
            const reduce = Math.min(items[i].seconds, remaining);
            items[i].seconds -= reduce;
            remaining -= reduce;
        }
    }

    normalizeActualActivitiesToStep() {
        if (!Array.isArray(this.modalActualActivities)) {
            this.modalActualActivities = [];
        }
        this.modalActualActivities.forEach((item) => {
            item.seconds = this.normalizeActualDurationStep(Number.isFinite(item.seconds) ? item.seconds : 0);
            if (Number.isFinite(item.recordedSeconds)) {
                item.recordedSeconds = this.normalizeActualDurationStep(item.recordedSeconds);
            }
        });
    }

    updateActualActivitiesSummary() {
        const { totalEl, usedEl, noticeEl } = this.getActualModalElements();
        if (!totalEl || !usedEl || !noticeEl) return;

        const total = Math.max(0, Number(this.modalActualTotalSeconds) || 0);
        const used = this.getActualActivitiesSeconds();

        totalEl.textContent = this.formatDurationSummary(total);
        usedEl.textContent = this.formatDurationSummary(used);

        noticeEl.textContent = '';
        noticeEl.classList.remove('ok');
        if (this.modalActualHasPlanUnits) {
            return;
        }
        if (!Array.isArray(this.modalActualActivities) || this.modalActualActivities.length === 0) {
            if (total > 0) {
                noticeEl.textContent = '세부 활동을 추가하세요.';
            }
            return;
        }
        if (total > 0 && used !== total) {
            noticeEl.textContent = '합계가 자동 맞춤됩니다.';
        }
    }

    isValidActualRow(index) {
        return Number.isInteger(index)
            && index >= 0
            && index < (this.modalActualActivities ? this.modalActualActivities.length : 0);
    }

    updateActualRowActiveStyles() {
        const { list } = this.getActualModalElements();
        if (!list) return;
        const activeIndex = this.isValidActualRow(this.modalActualActiveRow) ? this.modalActualActiveRow : -1;
        list.querySelectorAll('.sub-activity-row').forEach((rowEl) => {
            const idx = parseInt(rowEl.dataset.index, 10);
            rowEl.classList.toggle('active', idx === activeIndex);
        });
    }

    setActualActiveRow(index, options = {}) {
        const validIndex = this.isValidActualRow(index) ? index : -1;
        this.modalActualActiveRow = validIndex;
        this.updateActualRowActiveStyles();
        if (options.focusLabel && this.isValidActualRow(validIndex)) {
            this.focusActualRowLabel(validIndex);
        }
    }

    focusActualRowLabel(index) {
        if (!this.isValidActualRow(index)) return;
        try {
            const { list } = this.getActualModalElements();
            if (!list) return;
            const row = list.querySelector(`.sub-activity-row[data-index="${index}"]`);
            if (!row) return;
            const input = row.querySelector('.actual-activity-label');
            if (input) input.focus();
        } catch (e) {}
    }

    renderActualActivitiesList() {
        const { list } = this.getActualModalElements();
        if (!list) return;
        this.closeActualActivityMenu();

        if (!this.isValidActualRow(this.modalActualActiveRow)) {
            this.modalActualActiveRow = (this.modalActualActivities && this.modalActualActivities.length > 0) ? 0 : -1;
        }

        list.innerHTML = '';
        const gridSecondsMap = this.getActualGridSecondsMap();
        const planLabelSet = (this.modalActualPlanLabelSet instanceof Set) ? this.modalActualPlanLabelSet : new Set();
        (this.modalActualActivities || []).forEach((item, idx) => {
            const row = document.createElement('div');
            row.className = 'sub-activity-row actual-row';
            row.dataset.index = String(idx);
            if (idx === this.modalActualActiveRow) row.classList.add('active');

            const labelButton = document.createElement('button');
            labelButton.type = 'button';
            labelButton.className = 'actual-activity-label';
            labelButton.setAttribute('aria-label', '세부 활동');
            labelButton.setAttribute('aria-haspopup', 'menu');
            labelButton.setAttribute('aria-expanded', 'false');
            const normalizedLabel = this.normalizeActivityText
                ? this.normalizeActivityText(item.label || '')
                : String(item.label || '').trim();
            labelButton.textContent = normalizedLabel || '세부 활동';
            if (!normalizedLabel) labelButton.classList.add('empty');

            const safeSeconds = Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
            const isPlanLabel = Boolean(normalizedLabel)
                && (planLabelSet.has(normalizedLabel) || item.source === 'grid');
            const isExtraLabel = Boolean(normalizedLabel) && !isPlanLabel;
            if (isExtraLabel) row.classList.add('actual-row-extra');
            const recordedSeconds = Number.isFinite(item.recordedSeconds)
                ? Math.max(0, Math.floor(item.recordedSeconds))
                : safeSeconds;
            const gridSeconds = isPlanLabel
                ? (gridSecondsMap.get(normalizedLabel) || 0)
                : recordedSeconds;
            const gridDisabled = !this.modalActualHasPlanUnits
                || !normalizedLabel
                || (!isPlanLabel && !isExtraLabel);
            const gridControl = this.createActualTimeControl({
                kind: 'grid',
                index: idx,
                seconds: gridSeconds,
                label: normalizedLabel,
                disabled: gridDisabled
            });
            if (isExtraLabel) gridControl.classList.add('actual-time-extra');

            const assignControl = this.createActualTimeControl({
                kind: 'assign',
                index: idx,
                seconds: safeSeconds,
                label: normalizedLabel
            });

            const actions = document.createElement('div');
            actions.className = 'actual-row-actions';

            const upBtn = document.createElement('button');
            upBtn.type = 'button';
            upBtn.className = 'sub-activity-action-btn sub-activity-action-compact actual-move-btn';
            upBtn.dataset.direction = 'up';
            upBtn.textContent = '위';
            upBtn.disabled = idx === 0;

            const downBtn = document.createElement('button');
            downBtn.type = 'button';
            downBtn.className = 'sub-activity-action-btn sub-activity-action-compact actual-move-btn';
            downBtn.dataset.direction = 'down';
            downBtn.textContent = '아래';
            downBtn.disabled = idx >= (this.modalActualActivities.length - 1);

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'actual-remove-btn';
            removeBtn.textContent = '삭제';
            removeBtn.disabled = (this.modalActualActivities.length <= 1);

            actions.appendChild(upBtn);
            actions.appendChild(downBtn);
            actions.appendChild(removeBtn);

            row.appendChild(labelButton);
            row.appendChild(gridControl);
            row.appendChild(assignControl);
            row.appendChild(actions);
            list.appendChild(row);
        });

        if ((this.modalActualActivities || []).length === 0) {
            const empty = document.createElement('div');
            empty.className = 'sub-activities-empty';
            empty.textContent = '세부 활동을 추가하세요.';
            list.appendChild(empty);
        }

        this.updateActualActivitiesSummary();
        this.updateActualRowActiveStyles();
    }

    addActualActivityRow(defaults = {}) {
        if (!Array.isArray(this.modalActualActivities)) {
            this.modalActualActivities = [];
        }
        const label = typeof defaults.label === 'string' ? defaults.label : '';
        const source = typeof defaults.source === 'string' ? defaults.source : 'extra';
        const seededRecorded = Number.isFinite(defaults.recordedSeconds) ? Math.max(0, Math.floor(defaults.recordedSeconds)) : null;
        const newIndex = this.modalActualActivities.push({ label, seconds: 0, recordedSeconds: seededRecorded, source }) - 1;
        this.modalActualActiveRow = newIndex;
        this.modalActualDirty = true;
        if (this.modalActualHasPlanUnits) {
            this.normalizeActualActivitiesToStep();
        } else {
            this.normalizeActualActivitiesToTotal();
        }
        this.renderActualActivitiesList();
        if (defaults.focusLabel !== false) {
            this.focusActualRowLabel(newIndex);
        }
    }

    removeActualActivityRow(index) {
        if (!this.isValidActualRow(index)) return;
        const removed = this.modalActualActivities.splice(index, 1)[0];
        if (this.modalActualActivities.length > 0) {
            const targetIndex = Math.min(index, this.modalActualActivities.length - 1);
            if (!this.modalActualHasPlanUnits) {
                const extra = Number.isFinite(removed.seconds) ? Math.max(0, Math.floor(removed.seconds)) : 0;
                const current = Number.isFinite(this.modalActualActivities[targetIndex].seconds)
                    ? Math.max(0, Math.floor(this.modalActualActivities[targetIndex].seconds))
                    : 0;
                this.modalActualActivities[targetIndex].seconds = current + extra;
            }
            this.modalActualActiveRow = targetIndex;
        } else {
            this.modalActualActiveRow = -1;
        }
        this.modalActualDirty = true;
        if (this.modalActualHasPlanUnits) {
            this.normalizeActualActivitiesToStep();
        } else {
            this.normalizeActualActivitiesToTotal();
        }
        this.renderActualActivitiesList();
    }

    moveActualActivityRow(index, direction) {
        if (!this.isValidActualRow(index)) return;
        const items = this.modalActualActivities || [];
        const target = direction < 0 ? index - 1 : index + 1;
        if (target < 0 || target >= items.length) return;
        const temp = items[index];
        items[index] = items[target];
        items[target] = temp;
        this.modalActualActiveRow = target;
        this.modalActualDirty = true;
        this.renderActualActivitiesList();
        this.focusActualRowLabel(target);
    }

    applyActualActivityLabelSelection(index, label) {
        if (!this.isValidActualRow(index)) return false;
        const normalized = this.normalizeActivityText
            ? this.normalizeActivityText(label || '')
            : String(label || '').trim();
        const item = this.modalActualActivities[index];
        if (!item) return false;
        item.label = normalized;
        const isGridLabel = this.modalActualHasPlanUnits
            && (this.modalActualPlanLabelSet instanceof Set)
            && this.modalActualPlanLabelSet.has(normalized);
        if (normalized) {
            item.source = isGridLabel ? 'grid' : 'extra';
            if (isGridLabel) {
                item.recordedSeconds = null;
            } else if (!Number.isFinite(item.recordedSeconds)) {
                item.recordedSeconds = null;
            }
        } else {
            item.source = 'extra';
            item.recordedSeconds = null;
        }
        this.modalActualActiveRow = index;
        this.modalActualDirty = true;
        this.renderActualActivitiesList();
        return true;
    }

    getActualBalanceOrder(index, length) {
        const order = [];
        for (let i = index + 1; i < length; i++) order.push(i);
        for (let i = 0; i < index; i++) order.push(i);
        return order;
    }

    applyActualDurationChange(index, targetSeconds, options = {}) {
        if (!this.isValidActualRow(index)) return;
        const items = this.modalActualActivities || [];
        const total = Math.max(0, Number(this.modalActualTotalSeconds) || 0);
        const wasDirty = this.modalActualDirty;
        const beforeSeconds = this.modalActualHasPlanUnits
            ? items.map(item => this.normalizeActualDurationStep(Number.isFinite(item && item.seconds) ? item.seconds : 0))
            : null;
        const currentSeconds = Number.isFinite(items[index].seconds) ? Math.max(0, Math.floor(items[index].seconds)) : 0;
        let nextSeconds = this.normalizeActualDurationStep(Number.isFinite(targetSeconds) ? targetSeconds : 0);

        if (total > 0 && !this.modalActualHasPlanUnits) nextSeconds = Math.min(nextSeconds, total);
        if (this.modalActualHasPlanUnits) {
            if (total > 0) {
                const otherSum = items.reduce((sum, item, idx) => {
                    if (idx === index) return sum;
                    const seconds = Number.isFinite(item && item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
                    return sum + this.normalizeActualDurationStep(seconds);
                }, 0);
                const maxAllowed = Math.max(0, total - otherSum);
                nextSeconds = Math.min(nextSeconds, maxAllowed);
            }
            items[index].seconds = nextSeconds;
            this.clampActualGridToAssigned();
            this.updateActualSpinnerDisplays();
            this.updateActualActivitiesSummary();
            const afterSeconds = items.map(item => this.normalizeActualDurationStep(Number.isFinite(item && item.seconds) ? item.seconds : 0));
            const changed = beforeSeconds
                ? beforeSeconds.some((value, idx) => value !== afterSeconds[idx])
                : false;
            if (!changed) {
                if (!wasDirty) this.modalActualDirty = false;
                return;
            }
            this.modalActualDirty = true;
            if (options.updatePlan) {
                const label = this.normalizeActivityText
                    ? this.normalizeActivityText(items[index].label || '')
                    : String(items[index].label || '').trim();
                const isPlanLabel = label
                    && ((this.modalActualPlanLabelSet instanceof Set && this.modalActualPlanLabelSet.has(label))
                        || items[index].source === 'grid');
                if (isPlanLabel) {
                    const baseIndex = Number.isFinite(this.modalActualBaseIndex) ? this.modalActualBaseIndex : null;
                    const finalSeconds = Number.isFinite(items[index].seconds)
                        ? Math.max(0, Math.floor(items[index].seconds))
                        : 0;
                    if (Number.isFinite(baseIndex)) {
                        this.updatePlanActivitiesAssignment(baseIndex, label, finalSeconds);
                    }
                }
            }
            return;
        }
        if (items.length <= 1) {
            items[index].seconds = total > 0 ? total : nextSeconds;
            this.modalActualDirty = true;
            this.updateActualSpinnerDisplays();
            this.updateActualActivitiesSummary();
            return;
        }

        let delta = nextSeconds - currentSeconds;
        if (delta > 0) {
            let remaining = delta;
            const order = this.getActualBalanceOrder(index, items.length);
            order.forEach((idx) => {
                if (remaining <= 0) return;
                const available = Number.isFinite(items[idx].seconds) ? Math.max(0, Math.floor(items[idx].seconds)) : 0;
                const reduce = Math.min(available, remaining);
                items[idx].seconds = available - reduce;
                remaining -= reduce;
            });
            if (remaining > 0) {
                nextSeconds = Math.max(0, nextSeconds - remaining);
            }
        } else if (delta < 0) {
            const order = this.getActualBalanceOrder(index, items.length);
            if (order.length > 0) {
                const targetIndex = order[0];
                const base = Number.isFinite(items[targetIndex].seconds)
                    ? Math.max(0, Math.floor(items[targetIndex].seconds))
                    : 0;
                items[targetIndex].seconds = base + Math.abs(delta);
            }
        }

        items[index].seconds = nextSeconds;
        this.modalActualDirty = true;
        this.updateActualSpinnerDisplays();
        this.updateActualActivitiesSummary();
    }

    balanceActualAssignmentsToTotal(changedIndex = null) {
        if (!this.modalActualHasPlanUnits) return;
        const items = this.modalActualActivities || [];
        const total = Math.max(0, Number(this.modalActualTotalSeconds) || 0);
        if (items.length === 0 || total <= 0) return;

        items.forEach((item) => {
            if (!item) return;
            item.seconds = this.normalizeActualDurationStep(Number.isFinite(item.seconds) ? item.seconds : 0);
        });

        let sum = this.getActualActivitiesSeconds(items);
        let delta = sum - total;
        if (delta === 0) return;

        const normalize = (value) => this.normalizeActivityText
            ? this.normalizeActivityText(value || '')
            : String(value || '').trim();
        const isPlanItem = (item) => {
            if (!item) return false;
            const label = normalize(item.label || '');
            if (!label) return false;
            if (item.source === 'grid') return true;
            return (this.modalActualPlanLabelSet instanceof Set) && this.modalActualPlanLabelSet.has(label);
        };

        const order = [];
        const changedIsPlan = Number.isFinite(changedIndex) && items[changedIndex]
            ? isPlanItem(items[changedIndex])
            : false;

        const pushIndex = (idx) => {
            if (!Number.isFinite(idx)) return;
            if (idx < 0 || idx >= items.length) return;
            if (order.includes(idx)) return;
            order.push(idx);
        };

        if (delta > 0) {
            const reducePlanFirst = !changedIsPlan;
            items.forEach((item, idx) => {
                if (idx === changedIndex) return;
                if (reducePlanFirst && isPlanItem(item)) pushIndex(idx);
                if (!reducePlanFirst && !isPlanItem(item)) pushIndex(idx);
            });
            items.forEach((item, idx) => {
                if (idx === changedIndex) return;
                if (reducePlanFirst && !isPlanItem(item)) pushIndex(idx);
                if (!reducePlanFirst && isPlanItem(item)) pushIndex(idx);
            });
            pushIndex(changedIndex);

            for (let i = 0; i < order.length && delta > 0; i++) {
                const idx = order[i];
                const current = Number.isFinite(items[idx].seconds) ? Math.max(0, Math.floor(items[idx].seconds)) : 0;
                if (current <= 0) continue;
                const reduce = Math.min(current, delta);
                items[idx].seconds = current - reduce;
                delta -= reduce;
            }
        } else {
            const addAmount = Math.abs(delta);
            const addPlanFirst = !changedIsPlan;
            let targetIndex = null;

            items.forEach((item, idx) => {
                if (idx === changedIndex) return;
                if (targetIndex != null) return;
                if (addPlanFirst && isPlanItem(item)) targetIndex = idx;
                if (!addPlanFirst && !isPlanItem(item)) targetIndex = idx;
            });
            if (targetIndex == null) {
                items.forEach((item, idx) => {
                    if (idx === changedIndex) return;
                    if (targetIndex == null) targetIndex = idx;
                });
            }
            if (targetIndex == null && Number.isFinite(changedIndex)) {
                targetIndex = changedIndex;
            }
            if (Number.isFinite(targetIndex)) {
                const current = Number.isFinite(items[targetIndex].seconds)
                    ? Math.max(0, Math.floor(items[targetIndex].seconds))
                    : 0;
                items[targetIndex].seconds = current + addAmount;
            }
        }
    }

    applyActualGridDurationChange(index, targetSeconds) {
        if (!this.isValidActualRow(index) || !this.modalActualHasPlanUnits) return;
        const item = this.modalActualActivities[index];
        const label = this.normalizeActivityText
            ? this.normalizeActivityText(item && item.label || '')
            : String(item && item.label || '').trim();
        if (!label) return;
        const isPlanLabel = (this.modalActualPlanLabelSet instanceof Set && this.modalActualPlanLabelSet.has(label))
            || (item && item.source === 'grid');
        if (!isPlanLabel) {
            const assigned = Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
            let nextRecorded = this.normalizeActualDurationStep(Number.isFinite(targetSeconds) ? targetSeconds : 0);
            if (assigned > 0) nextRecorded = Math.min(nextRecorded, assigned);
            item.recordedSeconds = nextRecorded;
            this.modalActualDirty = true;
            this.updateActualSpinnerDisplays();
            return;
        }

        const step = this.getActualDurationStepSeconds();
        const normalized = this.normalizeActualDurationStep(Number.isFinite(targetSeconds) ? targetSeconds : 0);
        const targetUnits = Math.max(0, Math.round(normalized / step));

        const counts = this.getActualGridUnitCounts();
        if (targetUnits > 0) {
            counts.set(label, targetUnits);
        } else {
            counts.delete(label);
        }

        const activities = [];
        counts.forEach((count, key) => {
            if (count > 0) {
                activities.push({ label: key, seconds: count * step });
            }
        });

        const nextUnits = this.buildActualUnitsFromActivities(this.modalActualPlanUnits, activities);
        this.modalActualGridUnits = Array.isArray(nextUnits) ? nextUnits.slice() : [];
        this.modalActualDirty = true;
        this.clampActualGridToAssigned();
        this.updateActualSpinnerDisplays();
    }

    adjustActualActivityDuration(index, direction, options = {}) {
        if (!this.isValidActualRow(index)) return;
        const step = this.getActualDurationStepSeconds();
        const current = Number.isFinite(this.modalActualActivities[index].seconds)
            ? Math.max(0, Math.floor(this.modalActualActivities[index].seconds))
            : 0;
        const total = Math.max(0, Number(this.modalActualTotalSeconds) || 0);
        let maxAllowed = total;
        if (this.modalActualHasPlanUnits && total > 0) {
            const items = this.modalActualActivities || [];
            const otherSum = items.reduce((sum, item, idx) => {
                if (idx === index) return sum;
                const seconds = Number.isFinite(item && item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
                return sum + this.normalizeActualDurationStep(seconds);
            }, 0);
            maxAllowed = Math.max(0, total - otherSum);
        }
        let nextSeconds;
        if (direction < 0 && current === 0) {
            nextSeconds = Number.isFinite(maxAllowed) ? maxAllowed : 0;
        } else {
            nextSeconds = current + (direction * step);
        }
        this.applyActualDurationChange(index, nextSeconds, options);
    }

    adjustActualGridDuration(index, direction) {
        if (!this.isValidActualRow(index) || !this.modalActualHasPlanUnits) return;
        const item = this.modalActualActivities[index];
        const label = this.normalizeActivityText
            ? this.normalizeActivityText(item && item.label || '')
            : String(item && item.label || '').trim();
        if (!label) return;
        const step = this.getActualDurationStepSeconds();
        const isPlanLabel = (this.modalActualPlanLabelSet instanceof Set && this.modalActualPlanLabelSet.has(label))
            || (item && item.source === 'grid');
        if (!isPlanLabel) {
            const assigned = Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
            const currentRecorded = Number.isFinite(item.recordedSeconds)
                ? Math.max(0, Math.floor(item.recordedSeconds))
                : assigned;
            let nextRecorded;
            if (direction < 0 && currentRecorded === 0) {
                nextRecorded = assigned;
            } else {
                nextRecorded = currentRecorded + (direction * step);
            }
            nextRecorded = Math.max(0, nextRecorded);
            if (assigned > 0) nextRecorded = Math.min(nextRecorded, assigned);
            item.recordedSeconds = this.normalizeActualDurationStep(nextRecorded);
            this.modalActualDirty = true;
            this.updateActualSpinnerDisplays();
            return;
        }
        const current = this.getActualGridSecondsForLabel(label);
        const assigned = Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
        let nextSeconds;
        if (direction < 0 && current === 0) {
            nextSeconds = assigned;
        } else {
            nextSeconds = current + (direction * step);
        }
        this.applyActualGridDurationChange(index, nextSeconds);
    }

    updateActualSpinnerDisplays() {
        const { list } = this.getActualModalElements();
        if (!list) return;
        const gridSecondsMap = this.getActualGridSecondsMap();
        const planLabelSet = (this.modalActualPlanLabelSet instanceof Set) ? this.modalActualPlanLabelSet : new Set();
        (this.modalActualActivities || []).forEach((item, idx) => {
            const assignInput = list.querySelector(`.actual-assign-input[data-index="${idx}"]`);
            if (assignInput) {
                const safeSeconds = Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
                assignInput.value = this.formatSecondsForInput(safeSeconds);
            }
            const normalizedLabel = this.normalizeActivityText
                ? this.normalizeActivityText(item && item.label || '')
                : String(item && item.label || '').trim();
            const isPlanLabel = Boolean(normalizedLabel)
                && (planLabelSet.has(normalizedLabel) || item.source === 'grid');
            const recordedSeconds = Number.isFinite(item.recordedSeconds)
                ? Math.max(0, Math.floor(item.recordedSeconds))
                : (Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0);
            const gridSeconds = normalizedLabel
                ? (isPlanLabel ? (gridSecondsMap.get(normalizedLabel) || 0) : recordedSeconds)
                : 0;
            const gridInput = list.querySelector(`.actual-grid-input[data-index="${idx}"]`);
            if (gridInput) {
                gridInput.value = this.formatSecondsForInput(gridSeconds);
            }
        });
    }

    finalizeActualActivitiesForSave() {
        const total = Math.max(0, Number(this.modalActualTotalSeconds) || 0);
        let activities = this.normalizeActualActivitiesList(this.modalActualActivities).map(item => ({ ...item }));
        activities = activities.map((item, idx) => ({ ...item, order: idx }));
        if (this.modalActualHasPlanUnits) {
            return activities;
        }
        if (total > 0) {
            if (activities.length === 0) {
                activities = [{ label: '', seconds: total }];
            } else {
                const used = this.getActualActivitiesSeconds(activities);
                if (used !== total) {
                    const diff = total - used;
                    const last = activities.length - 1;
                    const adjusted = (activities[last].seconds || 0) + diff;
                    activities[last].seconds = Math.max(0, this.normalizeActualDurationStep(adjusted));
                }
            }
        }
        return activities;
    }

    openActualActivityMenu(index, anchorEl) {
        if (!this.isValidActualRow(index) || !anchorEl || !anchorEl.isConnected) return;
        if (this.actualActivityMenu
            && this.actualActivityMenuContext
            && this.actualActivityMenuContext.index === index
            && this.actualActivityMenuContext.anchorEl === anchorEl) {
            this.closeActualActivityMenu();
            return;
        }
        this.closeActualActivityMenu();

        const currentRaw = this.modalActualActivities[index] && this.modalActualActivities[index].label;
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
        menu.appendChild(buildSection('노션', grouped.notion || []));

        document.body.appendChild(menu);
        this.actualActivityMenu = menu;
        this.actualActivityMenuContext = { index, anchorEl };
        anchorEl.setAttribute('aria-expanded', 'true');

        menu.addEventListener('click', (event) => {
            const btn = event.target.closest('.plan-activity-menu-item');
            if (!btn || !menu.contains(btn)) {
                this.closeActualActivityMenu();
                return;
            }
            if (btn.disabled) return;
            event.preventDefault();
            event.stopPropagation();
            const label = btn.dataset.label != null ? btn.dataset.label : '';
            this.applyActualActivityLabelSelection(index, label);
            this.closeActualActivityMenu();
        });

        this.positionActualActivityMenu(anchorEl);

        this.actualActivityMenuOutsideHandler = (event) => {
            if (!this.actualActivityMenu) return;
            const t = event.target;
            if (this.actualActivityMenu.contains(t)) return;
            if (anchorEl && (t === anchorEl || (anchorEl.contains && anchorEl.contains(t)))) return;
            this.closeActualActivityMenu();
        };
        document.addEventListener('mousedown', this.actualActivityMenuOutsideHandler, true);

        this.actualActivityMenuEscHandler = (event) => {
            if (event.key === 'Escape') {
                this.closeActualActivityMenu();
            }
        };
        document.addEventListener('keydown', this.actualActivityMenuEscHandler);
    }

    positionActualActivityMenu(anchorEl) {
        if (!this.actualActivityMenu) return;
        if (!anchorEl || !anchorEl.isConnected) return;
        const rect = anchorEl.getBoundingClientRect();
        if (!rect || (!rect.width && !rect.height)) return;

        const menu = this.actualActivityMenu;
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

    closeActualActivityMenu() {
        if (this.actualActivityMenuOutsideHandler) {
            document.removeEventListener('mousedown', this.actualActivityMenuOutsideHandler, true);
            this.actualActivityMenuOutsideHandler = null;
        }
        if (this.actualActivityMenuEscHandler) {
            document.removeEventListener('keydown', this.actualActivityMenuEscHandler);
            this.actualActivityMenuEscHandler = null;
        }
        if (this.actualActivityMenuContext && this.actualActivityMenuContext.anchorEl) {
            try { this.actualActivityMenuContext.anchorEl.setAttribute('aria-expanded', 'false'); } catch (_) {}
        }
        if (this.actualActivityMenu && this.actualActivityMenu.parentNode) {
            this.actualActivityMenu.parentNode.removeChild(this.actualActivityMenu);
        }
        this.actualActivityMenu = null;
        this.actualActivityMenuContext = null;
    }

    openActivityLogModal(index) {
        const modal = document.getElementById('activityLogModal');
        const slot = this.timeSlots[index];
        const actualMergeKey = this.findMergeKey('actual', index);
        let baseIndex = index;
        if (actualMergeKey) {
            const [, startStr] = actualMergeKey.split('-');
            const start = parseInt(startStr, 10);
            if (Number.isFinite(start)) baseIndex = start;
        }
        const baseSlot = this.timeSlots[baseIndex] || slot;

        const range = this.getSplitRange('actual', baseIndex);
        const startSlot = this.timeSlots[range.start] || baseSlot;
        const endSlot = this.timeSlots[range.end] || baseSlot;
        const startLabel = startSlot && startSlot.time ? this.formatSlotTimeLabel(startSlot.time) : '';
        const endLabel = endSlot && endSlot.time ? this.formatSlotTimeLabel(endSlot.time) : '';
        const timeLabel = (range.start === range.end || !endLabel) ? startLabel : `${startLabel} ~ ${endLabel}`;
        document.getElementById('activityTime').value = timeLabel;
        // '활동 제목' 입력은 이제 우측 실제 칸(시간 기록 표시)을 직접 편집하는 컨텍스트로 사용
        // 병합된 실제 칸인 경우 병합 값, 아니면 개별 slot.actual을 채운다
        document.getElementById('activityDetails').value = (baseSlot.activityLog && baseSlot.activityLog.details) || '';

        this.modalActualBaseIndex = baseIndex;
        this.modalActualTotalSeconds = Math.max(0, this.getBlockLength('actual', baseIndex) * 3600);
        const planContext = this.getActualPlanLabelContext(baseIndex);
        this.modalActualHasPlanUnits = planContext.hasLabels;
        this.modalActualPlanUnits = Array.isArray(planContext.units) ? planContext.units.slice() : [];
        this.modalActualPlanLabelSet = planContext.labelSet ? new Set(planContext.labelSet) : new Set();
        if (this.modalActualHasPlanUnits) {
            const existing = this.normalizeActualActivitiesList(baseSlot.activityLog && baseSlot.activityLog.subActivities);
            const actualUnits = this.getActualGridUnitsForBase(
                baseIndex,
                this.modalActualPlanUnits.length,
                this.modalActualPlanUnits
            );
            this.modalActualGridUnits = Array.isArray(actualUnits) ? actualUnits.slice() : [];
            this.modalActualActivities = this.buildActualModalActivities(
                baseIndex,
                this.modalActualPlanUnits,
                this.modalActualGridUnits,
                existing,
                planContext.planLabel
            );
            this.normalizeActualActivitiesToStep();
        } else {
            this.modalActualPlanUnits = [];
            this.modalActualPlanLabelSet = new Set();
            this.modalActualGridUnits = [];
            this.modalActualActivities = this.buildActualActivitiesSeed(baseIndex, this.modalActualTotalSeconds);
            this.normalizeActualActivitiesToTotal();
        }
        this.modalActualActiveRow = this.modalActualActivities.length > 0 ? 0 : -1;
        this.modalActualDirty = false;
        this.renderActualActivitiesList();

        this.lastFocusedElementBeforeModal = document.activeElement;
        modal.style.display = 'flex';
        modal.dataset.index = index;
        modal.dataset.baseIndex = String(baseIndex);
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');

        setTimeout(() => {
            document.getElementById('activityDetails').focus();
        }, 100);
    }

    closeActivityLogModal(options = {}) {
        const modal = document.getElementById('activityLogModal');
        if (!options.force && this.modalActualDirty) {
            const discard = confirm('저장하지 않은 실제 활동 변경사항이 있습니다. 닫을까요?');
            if (!discard) return;
        }
        modal.style.display = 'none';
        
        document.getElementById('activityDetails').value = '';

        this.closeActualActivityMenu();
        this.modalActualActivities = [];
        this.modalActualTotalSeconds = 0;
        this.modalActualActiveRow = -1;
        this.modalActualBaseIndex = null;
        this.modalActualDirty = false;
        this.modalActualHasPlanUnits = false;
        this.modalActualPlanUnits = [];
        this.modalActualGridUnits = [];
        this.modalActualPlanLabelSet = new Set();
        const { list, totalEl, usedEl, noticeEl } = this.getActualModalElements();
        if (list) list.innerHTML = '';
        if (totalEl) totalEl.textContent = '0시간';
        if (usedEl) usedEl.textContent = '0시간';
        if (noticeEl) noticeEl.textContent = '';
        
        delete modal.dataset.index;
        delete modal.dataset.baseIndex;
        if (this.lastFocusedElementBeforeModal && typeof this.lastFocusedElementBeforeModal.focus === 'function') {
            try { this.lastFocusedElementBeforeModal.focus(); } catch (_) {}
        }
    }

    saveActivityLogFromModal() {
        const modal = document.getElementById('activityLogModal');
        const index = parseInt(modal.dataset.index, 10);
        const baseIndexRaw = parseInt(modal.dataset.baseIndex, 10);
        const baseIndex = Number.isFinite(baseIndexRaw) ? baseIndexRaw : index;

        if (Number.isFinite(baseIndex) && baseIndex >= 0) {
            const range = this.getSplitRange('actual', baseIndex);
            const start = range.start;
            const end = range.end;
            const details = document.getElementById('activityDetails').value.trim();

            if (!this.modalActualDirty) {
                for (let i = start; i <= end; i++) {
                    const slot = this.timeSlots[i];
                    if (!slot) continue;
                    if (!slot.activityLog || typeof slot.activityLog !== 'object') {
                        slot.activityLog = { title: '', details: '', subActivities: [], titleBandOn: false, actualGridUnits: [], actualExtraGridUnits: [], actualOverride: false };
                    }
                    slot.activityLog.details = (i === start) ? details : '';
                }
            } else {
                const activities = this.finalizeActualActivitiesForSave();
                const split = this.splitActualActivitiesByPlan(baseIndex, activities);
                const mergedActivities = activities.map(item => ({ ...item }));
                const summary = mergedActivities.length > 0 ? this.formatActivitiesSummary(mergedActivities) : '';
                const actualUnits = split.hasLabels
                    ? this.getModalActualGridUnitsForSave(split.units.length)
                    : [];
                const actualMergeKey = this.findMergeKey('actual', start);
                if (actualMergeKey) {
                    this.mergedFields.set(actualMergeKey, summary);
                }

                  for (let i = start; i <= end; i++) {
                      const slot = this.timeSlots[i];
                      if (!slot) continue;
                      if (!slot.activityLog || typeof slot.activityLog !== 'object') {
                          slot.activityLog = { title: '', details: '', subActivities: [], titleBandOn: false, actualGridUnits: [], actualExtraGridUnits: [], actualOverride: false };
                      }
                      slot.actual = (i === start) ? summary : '';
                      slot.activityLog.details = (i === start) ? details : '';
                      if (i === start) {
                          slot.activityLog.subActivities = mergedActivities.map(item => ({ ...item }));
                          if (split.hasLabels) {
                              slot.activityLog.actualGridUnits = actualUnits.slice();
                              slot.activityLog.actualExtraGridUnits = [];
                              slot.activityLog.actualOverride = (split.extraActivities && split.extraActivities.length > 0);
                          } else {
                              slot.activityLog.actualGridUnits = [];
                              slot.activityLog.actualExtraGridUnits = [];
                              slot.activityLog.actualOverride = mergedActivities.length > 0;
                          }
                      } else {
                        slot.activityLog.subActivities = [];
                        slot.activityLog.actualGridUnits = [];
                        slot.activityLog.actualExtraGridUnits = [];
                        slot.activityLog.actualOverride = false;
                    }
                }
            }

            this.renderTimeEntries();
            this.calculateTotals();
            this.autoSave();
        }

        this.closeActivityLogModal({ force: true });
    }

    attachActivityModalEventListeners() {
        const modal = document.getElementById('activityLogModal');
        const closeBtn = document.getElementById('closeActivityModal');
        const saveBtn = document.getElementById('saveActivityLog');
        const cancelBtn = document.getElementById('cancelActivityLog');

        closeBtn.addEventListener('click', () => {
            this.closeActivityLogModal();
        });

        saveBtn.addEventListener('click', () => {
            this.saveActivityLogFromModal();
        });
        
        cancelBtn.addEventListener('click', () => {
            this.closeActivityLogModal();
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeActivityLogModal();
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (modal.style.display !== 'flex') return;
            if (e.key === 'Escape') {
                this.closeActivityLogModal();
                return;
            }
            if (e.key === 'Tab') {
                const focusable = modal.querySelectorAll('button, input, textarea, select, [tabindex]:not([tabindex="-1"])');
                if (!focusable.length) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        });

        const actualList = document.getElementById('actualActivitiesList');
        const addActualBtn = document.getElementById('addActualActivityRow');

        if (addActualBtn) {
            addActualBtn.addEventListener('click', () => {
                this.addActualActivityRow();
            });
        }

        if (actualList) {
            actualList.addEventListener('click', (event) => {
                const timeBtn = event.target.closest('.actual-time-btn');
                if (timeBtn) {
                    if (timeBtn.disabled) return;
                    const direction = timeBtn.dataset.direction === 'up' ? 1 : -1;
                    const idx = parseInt(timeBtn.dataset.index, 10);
                    const kind = timeBtn.dataset.kind;
                    if (Number.isFinite(idx)) {
                        this.setActualActiveRow(idx);
                        if (kind === 'grid') {
                            this.adjustActualGridDuration(idx, direction);
                        } else {
                            this.adjustActualActivityDuration(idx, direction);
                        }
                    }
                    return;
                }

                const moveBtn = event.target.closest('.actual-move-btn');
                if (moveBtn) {
                    const row = moveBtn.closest('.sub-activity-row');
                    const idx = row ? parseInt(row.dataset.index, 10) : NaN;
                    const direction = moveBtn.dataset.direction === 'up' ? -1 : 1;
                    if (Number.isFinite(idx)) {
                        this.moveActualActivityRow(idx, direction);
                    }
                    return;
                }

                const removeBtn = event.target.closest('.actual-remove-btn');
                if (removeBtn) {
                    const row = removeBtn.closest('.sub-activity-row');
                    const idx = row ? parseInt(row.dataset.index, 10) : NaN;
                    if (Number.isFinite(idx)) {
                        this.removeActualActivityRow(idx);
                    }
                    return;
                }

                const labelBtn = event.target.closest('.actual-activity-label');
                if (labelBtn) {
                    const row = labelBtn.closest('.sub-activity-row');
                    const idx = row ? parseInt(row.dataset.index, 10) : NaN;
                    if (Number.isFinite(idx)) {
                        this.setActualActiveRow(idx);
                        this.openActualActivityMenu(idx, labelBtn);
                    }
                    return;
                }

                const row = event.target.closest('.sub-activity-row');
                if (row && actualList.contains(row)) {
                    const idx = parseInt(row.dataset.index, 10);
                    if (Number.isFinite(idx)) this.setActualActiveRow(idx);
                }
            });

            actualList.addEventListener('change', (event) => {
                if (event.target.classList.contains('actual-assign-input')) {
                    if (event.target.readOnly) {
                        this.updateActualSpinnerDisplays();
                        return;
                    }
                    const idx = parseInt(event.target.dataset.index, 10);
                    if (!Number.isFinite(idx)) return;
                    const parsed = this.parseActualDurationInput(event.target.value);
                    if (parsed == null) {
                        this.updateActualSpinnerDisplays();
                        return;
                    }
                    this.setActualActiveRow(idx);
                    this.applyActualDurationChange(idx, parsed);
                    return;
                }

                if (event.target.classList.contains('actual-grid-input')) {
                    if (event.target.readOnly) {
                        this.updateActualSpinnerDisplays();
                        return;
                    }
                    const idx = parseInt(event.target.dataset.index, 10);
                    if (!Number.isFinite(idx)) return;
                    const parsed = this.parseActualDurationInput(event.target.value);
                    if (parsed == null) {
                        this.updateActualSpinnerDisplays();
                        return;
                    }
                    this.setActualActiveRow(idx);
                    this.applyActualGridDurationChange(idx, parsed);
                }
            });

            actualList.addEventListener('focusin', (event) => {
                const row = event.target.closest('.sub-activity-row');
                if (!row || !actualList.contains(row)) return;
                const idx = parseInt(row.dataset.index, 10);
                if (Number.isFinite(idx)) this.setActualActiveRow(idx);
            });
        }

    }
}

window.TimeTracker = TimeTracker;
