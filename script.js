const UI_LABELS = Object.freeze({
    plannedHeader: '\uacc4\ud68d\ub41c \ud65c\ub3d9',
    timeHeader: '\uc2dc\uac04',
    actualHeader: '\uc2e4\uc81c \ud65c\ub3d9',
    dateLabel: '\ub0a0\uc9dc:',
    todayButton: '\uc624\ub298',
    clearButton: '\ucd08\uae30\ud654',
    authRequired: '\ub85c\uadf8\uc778 \ud544\uc694',
    googleLogin: 'Google \ub85c\uadf8\uc778',
    activityLogTitle: '\ud65c\ub3d9 \uc0c1\uc138 \uae30\ub85d',
    timeFieldLabel: '\uc2dc\uac04',
    memoFieldLabel: '\uba54\ubaa8',
    actualDetailLabel: '\uc2e4\uc81c \uc138\ubd80 \ud65c\ub3d9',
    actualEditBadge: '\uae30\ub85d \ud3b8\uc9d1',
    addActualDetail: '+ \uc138\ubd80 \ud65c\ub3d9',
    actualHint: '\uae30\ub85d/\ubc30\uc815\uc740 10\ubd84 \ub2e8\uc704\ub85c \uc870\uc808\ub429\ub2c8\ub2e4. \ud569\uacc4\ub294 \ubcd1\ud569 \uc2dc\uac04\uc5d0 \uc790\ub3d9 \ub9de\ucda4\ub429\ub2c8\ub2e4.',
    saveButton: '\uc800\uc7a5',
    cancelButton: '\ucde8\uc18c',
});

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
        this.pendingMergedMouseSelection = null;
        this.suppressMergedClickOnce = false;
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
        this.showNotionUI = false;
        this.planTabsContainer = null;
        this.inlinePlanDropdown = null;
        this.inlinePlanBackdrop = null;
        this.inlinePlanTarget = null;
        this.inlinePlanHighlightRange = null;
        this.inlinePlanOutsideHandler = null;
        this.inlinePlanEscHandler = null;
        this.inlinePlanScrollHandler = null;
        this.inlinePlanPageScrollCloseHandler = null;
        this.inlinePlanGestureCloseHandler = null;
        this.inlinePlanWheelHandler = null;
        this.inlinePlanInputFocusHandler = null;
        this.inlinePlanSheetTouchState = null;
        this.inlinePlanSheetTouchHandlers = null;
        this.inlinePlanFocusSyncTimer = null;
        this.inlinePlanViewportSyncTimer = null;
        this.inlinePlanInputIntentUntil = 0;
        this.inlinePlanContext = null;
        this.inlinePriorityMenu = null;
        this.inlinePriorityMenuContext = null;
        this.inlinePriorityMenuOutsideHandler = null;
        this.inlinePriorityMenuEscHandler = null;
        this.suppressInlinePlanClickOnce = null;
        this.suppressInlinePlanOpenUntil = 0;
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
        this._supabaseAuthStorage = null;
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
        this.pendingAuthAnalyticsStorageKey = 'tt.pendingAuthAnalytics';
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
        this.lastRenderedCurrentTimeIndex = null;

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
        this.applyEncodingSafeLabels();
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
        this.handlePendingAuthAnalyticsCallback();
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
                this.persistLocalSnapshotNow();
                if (this._watcher) clearInterval(this._watcher);
            } else {
                this.startChangeWatcher();
            }
        });
        window.addEventListener('pagehide', () => {
            this.persistLocalSnapshotNow();
        });
        window.addEventListener('beforeunload', () => {
            this.persistLocalSnapshotNow();
        });
    }

    applyEncodingSafeLabels() {
        const setText = (selector, text) => {
            const element = document.querySelector(selector);
            if (element) element.textContent = text;
        };

        setText('.header-row .planned-label', UI_LABELS.plannedHeader);
        setText('.header-row .time-label', UI_LABELS.timeHeader);
        setText('.header-row .actual-label', UI_LABELS.actualHeader);
        setText('label[for="date"]', UI_LABELS.dateLabel);
        setText('#todayBtn', UI_LABELS.todayButton);
        setText('#clearBtn', UI_LABELS.clearButton);
        setText('#authStatus', UI_LABELS.authRequired);
        setText('#googleAuthBtn', UI_LABELS.googleLogin);

        setText('#activityLogModal .modal-header h3', UI_LABELS.activityLogTitle);
        setText('#activityLogModal label[for="activityTime"]', UI_LABELS.timeFieldLabel);
        setText('#activityLogModal label[for="activityDetails"]', UI_LABELS.memoFieldLabel);
        setText('#activityLogModal .actual-sub-activities-header > label', UI_LABELS.actualDetailLabel);
        setText('#activityLogModal .actual-edit-badge', UI_LABELS.actualEditBadge);
        setText('#addActualActivityRow', UI_LABELS.addActualDetail);
        setText('#activityLogModal .actual-sub-activities-hint', UI_LABELS.actualHint);
        setText('#saveActivityLog', UI_LABELS.saveButton);
        setText('#cancelActivityLog', UI_LABELS.cancelButton);
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
    ensureGtag() {
        try {
            if (typeof window === 'undefined') return null;
            window.dataLayer = window.dataLayer || [];
            if (typeof window.gtag !== 'function') {
                window.gtag = function(){ window.dataLayer.push(arguments); };
            }
            return window.gtag;
        } catch (_) {
            return null;
        }
    }
    trackAnalyticsEvent(name, params = {}) {
        const eventName = String(name || '').trim();
        if (!eventName) return;
        try {
            const gtag = this.ensureGtag();
            if (!gtag) return;
            gtag('event', eventName, params && typeof params === 'object' ? params : {});
        } catch (_) {}
    }
    getPendingAuthAnalytics() {
        try {
            if (typeof sessionStorage === 'undefined' || !sessionStorage) return null;
            const raw = sessionStorage.getItem(this.pendingAuthAnalyticsStorageKey);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return null;
            const provider = String(parsed.provider || '').trim();
            const startedAt = Number(parsed.startedAt || 0);
            if (!provider || !Number.isFinite(startedAt) || startedAt <= 0) return null;
            return { provider, startedAt };
        } catch (_) {
            return null;
        }
    }
    setPendingAuthAnalytics(provider) {
        const normalizedProvider = String(provider || '').trim();
        if (!normalizedProvider) return;
        try {
            if (typeof sessionStorage === 'undefined' || !sessionStorage) return;
            sessionStorage.setItem(this.pendingAuthAnalyticsStorageKey, JSON.stringify({
                provider: normalizedProvider,
                startedAt: Date.now()
            }));
        } catch (_) {}
    }
    clearPendingAuthAnalytics() {
        try {
            if (typeof sessionStorage === 'undefined' || !sessionStorage) return;
            sessionStorage.removeItem(this.pendingAuthAnalyticsStorageKey);
        } catch (_) {}
    }
    consumePendingAuthAnalytics() {
        const pending = this.getPendingAuthAnalytics();
        if (!pending) return null;
        this.clearPendingAuthAnalytics();
        return pending;
    }
    getAuthCallbackErrorDetails() {
        try {
            if (typeof window === 'undefined' || !window.location) return null;
            const params = new URLSearchParams(window.location.search || '');
            const hash = String(window.location.hash || '').replace(/^#/, '');
            const hashParams = new URLSearchParams(hash);
            const all = [params, hashParams];
            for (let i = 0; i < all.length; i++) {
                const source = all[i];
                const code = String(source.get('error_code') || source.get('error') || '').trim();
                const description = String(source.get('error_description') || source.get('errorDescription') || '').trim();
                if (code || description) {
                    return {
                        code: code || 'oauth_callback_error',
                        source: i === 0 ? 'query' : 'hash'
                    };
                }
            }
        } catch (_) {}
        return null;
    }
    handlePendingAuthAnalyticsCallback() {
        const pending = this.getPendingAuthAnalytics();
        if (!pending) return;
        const maxAgeMs = 15 * 60 * 1000;
        if (!Number.isFinite(pending.startedAt) || (Date.now() - pending.startedAt) > maxAgeMs) {
            this.clearPendingAuthAnalytics();
            return;
        }
        const callbackError = this.getAuthCallbackErrorDetails();
        if (!callbackError) return;
        this.clearPendingAuthAnalytics();
        this.loginIntent = null;
        this.trackAnalyticsEvent('login_failure', {
            method: pending.provider,
            auth_provider: pending.provider,
            reason: callbackError.code,
            failure_source: callbackError.source
        });
    }

        getSupabaseRedirectTo() {
        return globalThis.TimeTrackerSupabaseSyncController.getSupabaseRedirectTo.call(this);
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
    isNotionUIVisible() {
        return this.showNotionUI === true;
    }
    getActivePlanSource() {
        return this.isNotionUIVisible() && this.currentPlanSource === 'notion' ? 'notion' : 'local';
    }

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
        try {
            const storage = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerStorage)
                ? globalThis.TimeTrackerStorage
                : null;
            if (storage && typeof storage.getDayStartHour === 'function') {
                return storage.getDayStartHour(4);
            }
            if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.getItem === 'function') {
                const stored = parseInt(String(localStorage.getItem('tt.dayStartHour')), 10);
                return stored === 0 ? 0 : 4;
            }
        } catch (_) {}
        return 4;
    }

    attachDayStartListeners() {
        const select = document.getElementById('dayStartHour');
        if (!select) return;
        select.value = String(this.dayStartHour === 0 ? 0 : 4);
        select.addEventListener('change', () => {
            const parsed = parseInt(select.value, 10);
            const storage = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerStorage)
                ? globalThis.TimeTrackerStorage
                : null;
            this.dayStartHour = (storage && typeof storage.setDayStartHour === 'function')
                ? storage.setDayStartHour(parsed)
                : (parsed === 0 ? 0 : 4);
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
            timer: { running: false, elapsed: 0, rawElapsed: 0, startTime: null, method: 'manual', status: 'idle' },
            activityLog: { title: '', details: '', subActivities: [], titleBandOn: false, actualGridUnits: [], actualExtraGridUnits: [], actualOverride: false }
        }));
    }

    generateTimeSlots() {
        this.timeSlots = this.createEmptyTimeSlots();
    }

        buildTimeEntryRowModel(slot, index) {
        return globalThis.TimeEntryRenderController.buildTimeEntryRowModel.call(this, slot, index);
    }

        renderTimeEntries(preserveInlineDropdown = false) {
        return globalThis.TimeEntryRenderController.renderTimeEntries.call(this, preserveInlineDropdown);
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
                    const provider = 'google';
                    const options = {};
                    const redirectTo = this.getSupabaseRedirectTo();
                    if (redirectTo) {
                        options.redirectTo = redirectTo;
                    }
                    const params = { provider };
                    if (Object.keys(options).length > 0) {
                        params.options = options;
                    }
                    this.loginIntent = provider;
                    this.setPendingAuthAnalytics(provider);
                    this.trackAnalyticsEvent('login_attempt', {
                        method: provider,
                        auth_provider: provider
                    });
                    this.supabase.auth.signInWithOAuth(params).catch((err) => {
                        this.loginIntent = null;
                        this.clearPendingAuthAnalytics();
                        console.warn('[auth] sign in failed', err, { redirectTo: options.redirectTo || null });
                        this.trackAnalyticsEvent('login_failure', {
                            method: provider,
                            auth_provider: provider,
                            reason: 'oauth_start_failed'
                        });
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
            this.handleClearButtonClick();
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
            if (e.target.tagName === 'INPUT' && e.target.classList.contains('timer-result-input')) {
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
            if (e.target.tagName === 'INPUT' && e.target.classList.contains('timer-result-input')) {
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
            if (e.target.classList && e.target.tagName === 'INPUT' && e.target.classList.contains('timer-result-input')) {
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
            if (e.target.tagName === 'INPUT' && e.target.classList.contains('timer-result-input')) {
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
            if (e.target.tagName === 'INPUT' && e.target.classList.contains('timer-result-input')) {
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
            if (!this.isSelectingPlanned && this.pendingMergedMouseSelection) {
                if (typeof e.buttons === 'number' && e.buttons === 0) {
                    this.pendingMergedMouseSelection = null;
                } else {
                    const pending = this.pendingMergedMouseSelection;
                    const dx = (Number.isFinite(e.clientX) && Number.isFinite(pending.startX))
                        ? (e.clientX - pending.startX)
                        : 0;
                    const dy = (Number.isFinite(e.clientY) && Number.isFinite(pending.startY))
                        ? (e.clientY - pending.startY)
                        : 0;
                    const movedPx = Math.hypot(dx, dy);
                    if (movedPx >= 4) {
                        this.beginMergedPlannedMouseSelection(pending.mergeKey, pending.fallbackIndex);
                        this.suppressMergedClickOnce = true;
                    }
                }
            }
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
            this.pendingMergedMouseSelection = null;
            this.dragStartIndex = -1;
            this.dragBaseEndIndex = -1;
            this.currentColumnType = null;
            if (this.suppressMergedClickOnce) {
                setTimeout(() => {
                    this.suppressMergedClickOnce = false;
                }, 0);
            }
        });
        document.addEventListener('touchend', () => {
            this.isSelectingPlanned = false;
            this.isSelectingActual = false;
            this.pendingMergedMouseSelection = null;
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
            this.hideHoverActivityLogButton && this.hideHoverActivityLogButton();
        });
        window.addEventListener('scroll', () => {
            this.updateSelectionOverlay('planned');
            this.updateSelectionOverlay('actual');
            this.hideUndoButton();
            this.hideHoverScheduleButton && this.hideHoverScheduleButton();
            this.hideHoverActivityLogButton && this.hideHoverActivityLogButton();
            this.centerMergedTimeContent(document.getElementById('timeEntries'));
        });
    }

    setCurrentDate() {
        document.getElementById('date').value = this.currentDate;
    }

    isMobileTimeExpansionEnabled() {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return false;
        }
        return window.matchMedia('(max-width: 640px)').matches;
    }

    normalizeTimerStatus(rawStatus, slot = null) {
        const normalized = String(rawStatus || '').trim();
        if (normalized === 'running' || normalized === 'paused' || normalized === 'completed' || normalized === 'idle') {
            return normalized;
        }
        if (slot && slot.timer && slot.timer.running) {
            return 'running';
        }
        return 'idle';
    }

    getTimerRawElapsed(slot) {
        if (!slot || !slot.timer) return 0;
        if (Number.isFinite(slot.timer.rawElapsed) && Number(slot.timer.rawElapsed) > 0) {
            return Math.max(0, Math.floor(slot.timer.rawElapsed));
        }
        if (slot.timer.running || this.normalizeTimerStatus(slot.timer.status, slot) === 'paused') {
            return Number.isFinite(slot.timer.elapsed) ? Math.max(0, Math.floor(slot.timer.elapsed)) : 0;
        }
        return 0;
    }

    getTimeUiHostIndex(index) {
        const timeMergeKey = this.findMergeKey('time', index);
        if (!timeMergeKey) return index;
        const [, startStr] = timeMergeKey.split('-');
        const start = parseInt(startStr, 10);
        return Number.isInteger(start) ? start : index;
    }

    getMobileTimeUiState(index, slotOverride = null) {
        const slot = slotOverride || this.timeSlots[index] || {};
        const hostIndex = this.getTimeUiHostIndex(index);
        const status = this.normalizeTimerStatus(slot.timer && slot.timer.status, slot);
        const currentIndex = this.getCurrentTimeIndex();
        const currentHostIndex = Number.isInteger(currentIndex) && currentIndex >= 0
            ? this.getTimeUiHostIndex(currentIndex)
            : -1;
        const isCurrent = currentHostIndex === hostIndex;
        const rawElapsed = this.getTimerRawElapsed(slot);
        let mode = 'label';

        if (status === 'running') {
            mode = 'running';
        } else if (status === 'paused') {
            mode = 'paused';
        } else if (status === 'completed' && rawElapsed > 0 && isCurrent) {
            mode = 'completed';
        } else if (isCurrent) {
            mode = 'current';
        }

        return {
            hostIndex,
            mode,
            status,
            rawElapsed,
            isCurrent,
            showControls: mode !== 'label',
        };
    }

    getMergeRangeBounds(mergeKey, fallbackIndex = null) {
        if (!mergeKey || typeof mergeKey !== 'string') return null;
        const [, startStr, endStr] = mergeKey.split('-');
        const parsedStart = parseInt(startStr, 10);
        const parsedEnd = parseInt(endStr, 10);
        const fallback = Number.isFinite(fallbackIndex) ? fallbackIndex : parseInt(fallbackIndex, 10);
        const start = Number.isFinite(parsedStart) ? parsedStart : fallback;
        const end = Number.isFinite(parsedEnd) ? parsedEnd : start;
        if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
        return { start: Math.min(start, end), end: Math.max(start, end) };
    }

    activateMergedPlannedSelection(mergeKey, fallbackIndex = null) {
        const range = this.getMergeRangeBounds(mergeKey, fallbackIndex);
        if (!range) return null;
        this.clearAllSelections();
        this.selectMergedRange('planned', mergeKey, { append: false });
        const activeEl = document.activeElement;
        if (activeEl && activeEl.classList && activeEl.classList.contains('planned-input')) {
            try { activeEl.blur(); } catch (_) {}
        }
        return range;
    }

    queueMergedPlannedMouseSelection(mergeKey, fallbackIndex = null, clientX = 0, clientY = 0) {
        const range = this.getMergeRangeBounds(mergeKey, fallbackIndex);
        if (!range) return null;
        const fallback = Number.isFinite(fallbackIndex) ? fallbackIndex : parseInt(fallbackIndex, 10);
        this.pendingMergedMouseSelection = {
            mergeKey,
            fallbackIndex: Number.isFinite(fallback) ? fallback : range.start,
            startX: Number.isFinite(clientX) ? clientX : 0,
            startY: Number.isFinite(clientY) ? clientY : 0,
            startTime: Date.now(),
        };
        return range;
    }

    beginMergedPlannedMouseSelection(mergeKey, fallbackIndex = null) {
        const range = this.getMergeRangeBounds(mergeKey, fallbackIndex);
        if (!range) return null;
        this.pendingMergedMouseSelection = null;
        this.closeInlinePlanDropdown();
        this.dragStartIndex = range.start;
        this.dragBaseEndIndex = range.end;
        this.currentColumnType = 'planned';
        this.isSelectingPlanned = true;
        return range;
    }

    // 병합 셀 내부 어디를 클릭해도 전체 병합 범위를 선택하도록 캡처 처리
        handleMergedClickCapture(e) {
        return globalThis.TimeTrackerFieldInteractionController.handleMergedClickCapture.call(this, ...arguments);
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
        return globalThis.TimeTrackerPersistenceController.saveData.call(this);
    }

    persistLocalSnapshotNow() {
        return globalThis.TimeTrackerPersistenceController.persistLocalSnapshotNow.call(this);
    }

    createStateSnapshot(timeSlots = this.timeSlots, mergedFields = this.mergedFields) {
        return globalThis.TimeTrackerPersistenceController.createStateSnapshot.call(this, timeSlots, mergedFields);
    }

    async loadData() {
        return globalThis.TimeTrackerPersistenceController.loadData.call(this);
    }

    clearLegacyLocalStorageData() {
        return globalThis.TimeTrackerPersistenceController.clearLegacyLocalStorageData.call(this);
    }

    startChangeWatcher() {
        return globalThis.TimeTrackerPersistenceController.startChangeWatcher.call(this);
    }

    autoSave() {
        return globalThis.TimeTrackerPersistenceController.autoSave.call(this);
    }

    handleClearButtonClick() {
        return globalThis.TimeTrackerLifecycleController.handleClearButtonClick.call(this);
    }

    clearData() {
        return globalThis.TimeTrackerLifecycleController.clearData.call(this);
    }

    // 가져오기/내보내기 기능 제거됨: 관련 함수 삭제

    // ===== Supabase integration (optional) =====
        getSupabaseIdentity() {
        return globalThis.TimeTrackerSupabaseSyncController.getSupabaseIdentity.call(this);
    }

        handleSupabaseIdentityChange(force = false) {
        return globalThis.TimeTrackerSupabaseSyncController.handleSupabaseIdentityChange.call(this, force);
    }

        applySupabaseSession(session, opts = {}) {
        return globalThis.TimeTrackerSupabaseSyncController.applySupabaseSession.call(this, session, opts);
    }

        initSupabaseAuthHandlers() {
        return globalThis.TimeTrackerSupabaseSyncController.initSupabaseAuthHandlers.call(this);
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
        return globalThis.TimeTrackerPersistenceController.buildSlotsJson.call(this);
    }
    // DB slots JSON -> 메모리 반영(존재하는 키만 반영)
        applySlotsJson(slotsJson) {
        return globalThis.TimeTrackerPersistenceController.applySlotsJson.call(this, slotsJson);
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
        return globalThis.TimeTrackerSupabaseSyncController.loadSupabaseConfig.call(this);
    }
        getSupabaseAuthStorage() {
        return globalThis.TimeTrackerSupabaseSyncController.getSupabaseAuthStorage.call(this);
    }
        initSupabaseIntegration() {
        return globalThis.TimeTrackerSupabaseSyncController.initSupabaseIntegration.call(this);
    }
        clearSupabaseChannels() {
        return globalThis.TimeTrackerSupabaseSyncController.clearSupabaseChannels.call(this);
    }
        resubscribeSupabaseRealtime() {
        return globalThis.TimeTrackerSupabaseSyncController.resubscribeSupabaseRealtime.call(this);
    }
        async fetchFromSupabaseForDate(date) {
        return globalThis.TimeTrackerSupabaseSyncController.fetchFromSupabaseForDate.call(this, date);
    }
        scheduleSupabaseSave() {
        return globalThis.TimeTrackerSupabaseSyncController.scheduleSupabaseSave.call(this);
    }
        scheduleSupabaseRetry() {
        return globalThis.TimeTrackerSupabaseSyncController.scheduleSupabaseRetry.call(this);
    }
        getTimesheetClearPendingKey(date) {
        return globalThis.TimeTrackerSupabaseSyncController.getTimesheetClearPendingKey.call(this, date);
    }
        isTimesheetClearPending(date) {
        return globalThis.TimeTrackerSupabaseSyncController.isTimesheetClearPending.call(this, date);
    }
        markTimesheetClearPending(date) {
        return globalThis.TimeTrackerSupabaseSyncController.markTimesheetClearPending.call(this, date);
    }
        clearTimesheetClearPending(date) {
        return globalThis.TimeTrackerSupabaseSyncController.clearTimesheetClearPending.call(this, date);
    }
        async deleteFromSupabaseForDate(date) {
        return globalThis.TimeTrackerSupabaseSyncController.deleteFromSupabaseForDate.call(this, date);
    }
        async saveToSupabase() {
        return globalThis.TimeTrackerSupabaseSyncController.saveToSupabase.call(this);
    }
        async persistSnapshotForDate(date, snapshotSlots, snapshotMergedObj) {
        return globalThis.TimeTrackerSupabaseSyncController.persistSnapshotForDate.call(this, date, snapshotSlots, snapshotMergedObj);
    }
    applyPlannedCatalogFromRow(row) {
        if (!row || typeof row !== 'object') return false;
        const slots = row.slots || {};
        return this.applyPlannedCatalogJson(slots);
    }
    normalizePriorityRankValue(value) {
        if (value === '' || value == null) return null;
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return null;
        return Math.max(1, Math.floor(parsed));
    }
    normalizeLocalPlannedCatalogEntries(entries) {
        if (!Array.isArray(entries)) return [];
        const normalized = [];
        entries.forEach((entry) => {
            if (typeof entry === 'string') {
                const label = this.normalizeActivityText(entry);
                if (label) {
                    normalized.push({ label, priorityRank: null });
                }
                return;
            }
            if (!entry || typeof entry !== 'object') return;
            const label = this.normalizeActivityText(entry.label || entry.title || '');
            if (!label) return;
            normalized.push({
                label,
                priorityRank: this.normalizePriorityRankValue(entry.priorityRank),
            });
        });
        return normalized;
    }
    getLocalPlannedEntries() {
        const entries = [];
        (this.plannedActivities || []).forEach((item) => {
            if (!item || item.source === 'notion') return;
            const label = this.normalizeActivityText(item.label || '');
            if (!label) return;
            if (entries.some((entry) => entry.label === label)) return;
            entries.push({
                label,
                priorityRank: this.normalizePriorityRankValue(item.priorityRank),
            });
        });
        return entries;
    }
    computePlannedSignature(entries) {
        if (!Array.isArray(entries)) return '';
        const normalized = this.normalizeLocalPlannedCatalogEntries(entries)
            .map((entry) => ({
                label: entry.label,
                priorityRank: this.normalizePriorityRankValue(entry.priorityRank),
            }))
            .sort((a, b) => {
                if (a.label !== b.label) return a.label.localeCompare(b.label);
                const ra = Number.isFinite(a.priorityRank) ? a.priorityRank : Infinity;
                const rb = Number.isFinite(b.priorityRank) ? b.priorityRank : Infinity;
                return ra - rb;
            });
        return JSON.stringify(normalized);
    }
        applyPlannedCatalogJson(slotsJson) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.applyPlannedCatalogJson.call(this, ...arguments);
    }
        async fetchPlannedCatalogFromSupabase() {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.fetchPlannedCatalogFromSupabase.call(this, ...arguments);
    }
        scheduleSupabasePlannedSave(force = false) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.scheduleSupabasePlannedSave.call(this, ...arguments);
    }
        async savePlannedCatalogToSupabase(force = false) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.savePlannedCatalogToSupabase.call(this, ...arguments);
    }

    // ===== Routines (planned auto-fill) =====
        normalizeRoutinePattern(pattern) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.normalizeRoutinePattern.call(this, ...arguments);
    }
        getRoutinePatternLabel(pattern) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.getRoutinePatternLabel.call(this, ...arguments);
    }
        createRoutineId() {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.createRoutineId.call(this, ...arguments);
    }
        normalizeRoutineItems(items) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.normalizeRoutineItems.call(this, ...arguments);
    }
        computeRoutineSignature(items) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.computeRoutineSignature.call(this, ...arguments);
    }
        applyRoutinesJson(slotsJson) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.applyRoutinesJson.call(this, ...arguments);
    }
        applyRoutinesFromRow(row) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.applyRoutinesFromRow.call(this, ...arguments);
    }
        async fetchRoutinesFromSupabase() {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.fetchRoutinesFromSupabase.call(this, ...arguments);
    }
        scheduleSupabaseRoutineSave(force = false) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.scheduleSupabaseRoutineSave.call(this, ...arguments);
    }
        async saveRoutinesToSupabase(force = false) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.saveRoutinesToSupabase.call(this, ...arguments);
    }
        getLocalDateParts(date) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.getLocalDateParts.call(this, ...arguments);
    }
        getDateValue(date) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.getDateValue.call(this, ...arguments);
    }
        compareDateStrings(a, b) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.compareDateStrings.call(this, ...arguments);
    }
        formatDateFromMsLocal(ms) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.formatDateFromMsLocal.call(this, ...arguments);
    }
        getTodayLocalDateString() {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.getTodayLocalDateString.call(this, ...arguments);
    }
        getLocalSlotStartMs(date, hour) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.getLocalSlotStartMs.call(this, ...arguments);
    }
        getDayOfWeek(date) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.getDayOfWeek.call(this, ...arguments);
    }
        withTemporarySlots(timeSlots, mergedFieldsMap, fn) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.withTemporarySlots.call(this, ...arguments);
    }
        applySlotsJsonToContext(slotsJson, timeSlots, mergedFieldsMap) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.applySlotsJsonToContext.call(this, ...arguments);
    }
        buildSlotsJsonForContext(timeSlots, mergedFieldsMap) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.buildSlotsJsonForContext.call(this, ...arguments);
    }
        findMergeKeyInMap(mergedFieldsMap, type, index) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.findMergeKeyInMap.call(this, ...arguments);
    }
        routineIncludesHour(routine, hour) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.routineIncludesHour.call(this, ...arguments);
    }
        findRoutineForLabelAtIndex(label, index, date = null) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.findRoutineForLabelAtIndex.call(this, ...arguments);
    }
        findActiveRoutineForLabelAtIndex(label, index, date = null) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.findActiveRoutineForLabelAtIndex.call(this, ...arguments);
    }
        findRoutineForLabelAndWindow(label, startHour, durationHours) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.findRoutineForLabelAndWindow.call(this, ...arguments);
    }
        isRoutineActiveOnDate(routine, date) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.isRoutineActiveOnDate.call(this, ...arguments);
    }
        isRoutineStoppedAtSlot(routine, date, hour) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.isRoutineStoppedAtSlot.call(this, ...arguments);
    }
        isRoutineStoppedForDate(routine, date) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.isRoutineStoppedForDate.call(this, ...arguments);
    }
        isRoutineActiveAtSlot(routine, date, hour) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.isRoutineActiveAtSlot.call(this, ...arguments);
    }
        isRoutinePresentOnDate(routine) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.isRoutinePresentOnDate.call(this, ...arguments);
    }
        getRoutineForPlannedIndex(index, date = null) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.getRoutineForPlannedIndex.call(this, ...arguments);
    }
        isPlanSlotEmptyForRoutine(index) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.isPlanSlotEmptyForRoutine.call(this, ...arguments);
    }
        isPlanSlotEmptyForInline(index) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.isPlanSlotEmptyForInline.call(this, ...arguments);
    }
        applyRoutinesToDate(date, options = {}) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.applyRoutinesToDate.call(this, ...arguments);
    }
        updateRoutineItem(id, patch = {}) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.updateRoutineItem.call(this, ...arguments);
    }
        upsertRoutineByWindow(label, startHour, durationHours, patch = {}) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.upsertRoutineByWindow.call(this, ...arguments);
    }
        getInlineTargetRange() {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.getInlineTargetRange.call(this, ...arguments);
    }
        getRoutineWindowFromRange(startIndex, endIndex) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.getRoutineWindowFromRange.call(this, ...arguments);
    }
        passRoutineForDate(routineId, date) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.passRoutineForDate.call(this, ...arguments);
    }
        clearRoutinePassForDate(routineId, date) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.clearRoutinePassForDate.call(this, ...arguments);
    }
        clearRoutineRangeForDate(routine, date, options = {}) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.clearRoutineRangeForDate.call(this, ...arguments);
    }
        clearRoutineFromLocalStorageFutureDates(routine, fromDate) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.clearRoutineFromLocalStorageFutureDates.call(this, ...arguments);
    }
        async clearRoutineFromSupabaseFutureDates(routine, fromDate) {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.clearRoutineFromSupabaseFutureDates.call(this, ...arguments);
    }
        ensureRoutinesAvailableOrNotify() {
        return globalThis.TimeTrackerPlannedCatalogRoutineController.ensureRoutinesAvailableOrNotify.call(this, ...arguments);
    }

    normalizeActivityLog(slot) {
        const stateCore = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerStateCore)
            ? globalThis.TimeTrackerStateCore
            : null;
        if (slot && typeof slot === 'object' && stateCore && typeof stateCore.normalizeActivityLog === 'function') {
            slot.activityLog = stateCore.normalizeActivityLog(slot.activityLog, {
                normalizeActivitiesArray: (items) => this.normalizeActivitiesArray(items),
            });
            return slot;
        }
        try {
            if (!slot || typeof slot !== 'object') return slot;
            if (!slot.activityLog || typeof slot.activityLog !== 'object') {
                slot.activityLog = { title: '', details: '', subActivities: [], titleBandOn: false, actualGridUnits: [], actualExtraGridUnits: [], actualFailedGridUnits: [], actualOverride: false };
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
                if (!Array.isArray(slot.activityLog.actualFailedGridUnits)) {
                    slot.activityLog.actualFailedGridUnits = [];
                } else {
                    slot.activityLog.actualFailedGridUnits = slot.activityLog.actualFailedGridUnits.map(value => Boolean(value));
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
        return globalThis.TimeTrackerLifecycleController.changeDate.call(this, days);
    }

    transitionToDate(nextDate) {
        return globalThis.TimeTrackerLifecycleController.transitionToDate.call(this, nextDate);
    }

    attachPlannedFieldSelectionListeners(entryDiv, index, plannedField) {
        return globalThis.TimeTrackerFieldInteractionController.attachPlannedFieldSelectionListeners.call(this, entryDiv, index, plannedField);
    }

    attachFieldSelectionListeners(entryDiv, index) {
        const plannedField = entryDiv.querySelector('.planned-input');
        const actualField = entryDiv.querySelector('.actual-input');

        if (plannedField) {
            this.attachPlannedFieldSelectionListeners(entryDiv, index, plannedField);
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
                  const resolveSegmentPayload = (target) => {
                      const segment = target && target.closest
                          ? target.closest('.split-grid-segment')
                          : null;
                      if (!segment || !actualGrid.contains(segment)) return null;
                      const unitIndex = parseInt(segment.dataset.unitIndex, 10);
                      if (!Number.isFinite(unitIndex)) return null;
                      const extraLabel = segment.dataset.extraLabel || '';
                      const locked = segment.classList && segment.classList.contains('is-locked');
                      return { segment, unitIndex, extraLabel, locked };
                  };
                  const LONGPRESS_MS = 320;
                  const MOVE_THRESHOLD = 8;
                  const pressState = {
                      timer: null,
                      pointerId: null,
                      unitIndex: null,
                      active: false,
                      longPressed: false,
                      suppressClick: false,
                      x: 0,
                      y: 0,
                  };
                  const clearPressState = () => {
                      if (pressState.timer) {
                          clearTimeout(pressState.timer);
                      }
                      pressState.timer = null;
                      pressState.pointerId = null;
                      pressState.unitIndex = null;
                      pressState.active = false;
                      pressState.longPressed = false;
                  };
                  const cancelPressState = () => {
                      if (pressState.timer) {
                          clearTimeout(pressState.timer);
                      }
                      pressState.timer = null;
                      pressState.active = false;
                      pressState.longPressed = false;
                      pressState.pointerId = null;
                      pressState.unitIndex = null;
                  };
                  const beginLongPress = (payload, clientX, clientY) => {
                      if (!payload || !Number.isFinite(payload.unitIndex)) return;
                      clearPressState();
                      pressState.active = true;
                      pressState.unitIndex = payload.unitIndex;
                      pressState.x = clientX || 0;
                      pressState.y = clientY || 0;
                      pressState.suppressClick = false;
                      pressState.longPressed = false;
                      pressState.timer = setTimeout(() => {
                          if (!pressState.active || pressState.unitIndex == null) return;
                          pressState.longPressed = true;
                          pressState.suppressClick = true;
                          this.toggleActualGridLockedUnit(index, pressState.unitIndex);
                      }, LONGPRESS_MS);
                  };
                  const startPress = (payload, event) => {
                      if (!event || !payload) return;
                      if (event.pointerType === 'mouse' && event.button !== 0) return;
                      beginLongPress(payload, event.clientX, event.clientY);
                  };
                  const endPress = (event) => {
                      if (!pressState.active) return;
                      if (pressState.timer) {
                          clearTimeout(pressState.timer);
                          pressState.timer = null;
                      }
                      if (pressState.suppressClick) {
                          event.preventDefault();
                          event.stopPropagation();
                          pressState.suppressClick = false;
                      }
                      pressState.active = false;
                      pressState.pointerId = null;
                      pressState.unitIndex = null;
                      pressState.longPressed = false;
                  };
                  const moveCancelsPress = (clientX, clientY) => {
                      if (!pressState.active || pressState.unitIndex == null) return;
                      const dx = Math.abs(clientX - pressState.x);
                      const dy = Math.abs(clientY - pressState.y);
                      if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
                          cancelPressState();
                          return;
                      }
                  };
                  const handleGridClick = (event) => {
                      const payload = resolveSegmentPayload(event.target);
                      if (!payload) return;
                      const baseIndexForLockCheck = this.getSplitBaseIndex('actual', index);
                      const isActuallyLocked = this.isActualGridUnitLocked(
                          baseIndexForLockCheck,
                          payload.unitIndex
                      );
                      if (payload.locked || isActuallyLocked) {
                          event.preventDefault();
                          event.stopPropagation();
                          return;
                      }
                      if (pressState.suppressClick || pressState.longPressed) {
                          event.preventDefault();
                          event.stopPropagation();
                          pressState.suppressClick = false;
                          pressState.longPressed = false;
                          return;
                      }
                      event.preventDefault();
                      event.stopPropagation();
                      if (payload.segment && payload.segment.classList && payload.segment.classList.contains('is-failed')) {
                          this.toggleActualFailedGridUnit(index, payload.unitIndex);
                      } else {
                          this.clearActualFailedGridUnitOnNormalClick(index, payload.unitIndex);
                      }
                      if (payload.extraLabel) {
                          this.toggleExtraGridUnit(index, payload.extraLabel, payload.unitIndex);
                          return;
                      }
                      this.toggleActualGridUnit(index, payload.unitIndex);
                  };

                  actualGrid.addEventListener('click', handleGridClick);
                  actualGrid.addEventListener('pointerdown', (event) => {
                      const payload = resolveSegmentPayload(event.target);
                      if (!payload) return;
                      startPress(payload, event);
                      pressState.pointerId = event.pointerId;
                  }, { passive: true });
                  actualGrid.addEventListener('pointermove', (event) => {
                      if (!pressState.active) return;
                      if (pressState.pointerId != null && event.pointerId !== pressState.pointerId) return;
                      moveCancelsPress(event.clientX, event.clientY);
                  }, { passive: true });
                  actualGrid.addEventListener('pointerup', (event) => {
                      if (!pressState.active) return;
                      if (pressState.pointerId != null && event.pointerId !== pressState.pointerId) return;
                      endPress(event);
                  });
                  actualGrid.addEventListener('pointercancel', cancelPressState);
                  actualGrid.addEventListener('contextmenu', (event) => {
                      if (pressState.suppressClick || pressState.longPressed) {
                          event.preventDefault();
                          event.stopPropagation();
                          pressState.suppressClick = false;
                          pressState.longPressed = false;
                      }
                  });
                  actualGrid.addEventListener('touchstart', (event) => {
                      if (!event.touches || event.touches.length !== 1) return;
                      if (pressState.active) return;
                      const touch = event.touches[0];
                      const payload = resolveSegmentPayload(touch.target);
                      if (!payload) return;
                      beginLongPress(payload, touch.clientX, touch.clientY);
                      pressState.pointerId = null;
                  }, { passive: true });
                  actualGrid.addEventListener('touchmove', (event) => {
                      if (!event.touches || event.touches.length !== 1) {
                          cancelPressState();
                          return;
                      }
                      const touch = event.touches[0];
                      moveCancelsPress(touch.clientX, touch.clientY);
                  }, { passive: true });
                  actualGrid.addEventListener('touchend', (event) => {
                      if (!pressState.active) return;
                      endPress(event);
                  });
                  actualGrid.addEventListener('touchcancel', cancelPressState);
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
        return globalThis.TimeTrackerSelectionOverlayController.selectFieldRange.call(this, type, startIndex, endIndex);
    }

    clearSelection(type) {
        return globalThis.TimeTrackerSelectionOverlayController.clearSelection.call(this, type);
    }

    clearAllSelections() {
        return globalThis.TimeTrackerSelectionOverlayController.clearAllSelections.call(this);
    }

    showMergeButton(type) {
        return globalThis.TimeTrackerSelectionOverlayController.showMergeButton.call(this, type);
    }

    hideMergeButton() {
        return globalThis.TimeTrackerSelectionOverlayController.hideMergeButton.call(this);
    }

    showUndoButton(type, mergeKey) {
        return globalThis.TimeTrackerSelectionOverlayController.showUndoButton.call(this, type, mergeKey);
    }

    hideUndoButton() {
        return globalThis.TimeTrackerSelectionOverlayController.hideUndoButton.call(this);
    }

    undoMerge(type, mergeKey) {
        return globalThis.TimeTrackerSelectionOverlayController.undoMerge.call(this, type, mergeKey);
    }

    mergeSelectedFields(type) {
        const selectedSet = type === 'planned' ? this.selectedPlannedFields : this.selectedActualFields;

        if (selectedSet.size > 1) {
            const selectedIndices = Array.from(selectedSet).sort((a, b) => a - b);
            let startIndex = selectedIndices[0];
            let endIndex = selectedIndices[selectedIndices.length - 1];

            const collectOverlappingMergeKeys = (targetTypes, rangeStart, rangeEnd) => {
                const typeSet = new Set(Array.isArray(targetTypes) ? targetTypes : []);
                if (typeSet.size === 0) return [];
                const keys = [];
                for (const key of this.mergedFields.keys()) {
                    const parts = String(key || '').split('-');
                    if (parts.length !== 3) continue;
                    const keyType = parts[0];
                    if (!typeSet.has(keyType)) continue;
                    const keyStart = parseInt(parts[1], 10);
                    const keyEnd = parseInt(parts[2], 10);
                    if (!Number.isInteger(keyStart) || !Number.isInteger(keyEnd)) continue;
                    if (keyEnd < rangeStart || keyStart > rangeEnd) continue;
                    keys.push({ key, start: keyStart, end: keyEnd });
                }
                return keys;
            };

            const overlappingTypes = type === 'planned'
                ? ['planned', 'time', 'actual']
                : ['actual'];

            // 기존 병합과 일부만 겹치는 경우에도 전체 병합 블록 단위로 확장해 orphan 보조 슬롯을 방지한다.
            let overlappingEntries = [];
            while (true) {
                const found = collectOverlappingMergeKeys(overlappingTypes, startIndex, endIndex);
                if (found.length === 0) {
                    overlappingEntries = [];
                    break;
                }
                let nextStart = startIndex;
                let nextEnd = endIndex;
                for (const entry of found) {
                    if (entry.start < nextStart) nextStart = entry.start;
                    if (entry.end > nextEnd) nextEnd = entry.end;
                }
                overlappingEntries = found;
                if (nextStart === startIndex && nextEnd === endIndex) break;
                startIndex = nextStart;
                endIndex = nextEnd;
            }

            const firstField = document.querySelector(`[data-index="${startIndex}"] .${type}-input`);
            const mergedValue = firstField ? firstField.value : '';

            overlappingEntries.forEach((entry) => this.mergedFields.delete(entry.key));

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
                const baseSlot = this.timeSlots[startIndex] || {};
                const actualMergedValue = String(baseSlot.actual || '').trim();
                this.mergedFields.set(actualMergeKey, actualMergedValue);

                // 데이터 업데이트
                const basePlanTitle = (this.timeSlots[startIndex] && typeof this.timeSlots[startIndex].planTitle === 'string')
                    ? this.timeSlots[startIndex].planTitle
                    : '';
                for (let i = startIndex; i <= endIndex; i++) {
                    this.timeSlots[i].planned = i === startIndex ? mergedValue : '';
                    this.timeSlots[i].actual = i === startIndex ? actualMergedValue : '';
                    if (!this.timeSlots[i].activityLog || typeof this.timeSlots[i].activityLog !== 'object') {
                        this.timeSlots[i].activityLog = { title: '', details: '', subActivities: [], titleBandOn: false, actualGridUnits: [], actualExtraGridUnits: [], actualFailedGridUnits: [], actualOverride: false };
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
                    if (Array.isArray(this.timeSlots[i].activityLog.actualFailedGridUnits)) {
                        this.timeSlots[i].activityLog.actualFailedGridUnits = i === startIndex ? this.timeSlots[i].activityLog.actualFailedGridUnits : [];
                    } else if (i !== startIndex) {
                        this.timeSlots[i].activityLog.actualFailedGridUnits = [];
                    }
                }
            } else {
                // 우측 열만 병합하는 경우
                for (let i = startIndex; i <= endIndex; i++) {
                    this.timeSlots[i].actual = i === startIndex ? mergedValue : '';
                    if (!this.timeSlots[i].activityLog || typeof this.timeSlots[i].activityLog !== 'object') {
                        this.timeSlots[i].activityLog = { title: '', details: '', subActivities: [], titleBandOn: false, actualGridUnits: [], actualExtraGridUnits: [], actualFailedGridUnits: [], actualOverride: false };
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
                    if (Array.isArray(this.timeSlots[i].activityLog.actualFailedGridUnits)) {
                        this.timeSlots[i].activityLog.actualFailedGridUnits = i === startIndex ? this.timeSlots[i].activityLog.actualFailedGridUnits : [];
                    } else if (i !== startIndex) {
                        this.timeSlots[i].activityLog.actualFailedGridUnits = [];
                    }
                }
            }

            this.renderTimeEntries();
            this.clearAllSelections();
            if (type === 'planned') {
                this.showUndoButton('planned', mergeKey);
            }
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
        return globalThis.TimeEntryRenderController.wrapWithSplitVisualization.call(this, type, index, content);
    }

        buildSplitVisualization(type, index) {
        return globalThis.TimeEntryRenderController.buildSplitVisualization.call(this, type, index);
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
        let units = this.normalizeActualGridBooleanUnits(raw, totalUnits);
        const hasStoredGridUnits = raw.length > 0;

        if (!hasStoredGridUnits && Array.isArray(planUnits) && planUnits.length > 0) {
            const activities = this.normalizeActivitiesArray(slot && slot.activityLog && slot.activityLog.subActivities);
            if (activities.length > 0) {
                units = this.buildActualUnitsFromActivities(planUnits, activities);
                units = this.normalizeActualGridBooleanUnits(units, totalUnits);
            }
        }

        return units;
    }

    getRunningActualGridOutline(baseIndex, totalUnits) {
        if (!Number.isInteger(baseIndex) || !Number.isInteger(totalUnits) || totalUnits <= 0) return null;
        const slot = this.timeSlots[baseIndex];
        if (!slot || !slot.timer || !slot.timer.running) return null;

        const currentIndex = typeof this.getCurrentTimeIndex === 'function'
            ? this.getCurrentTimeIndex()
            : this.currentTimeSlotIndex;
        const range = typeof this.getSplitRange === 'function'
            ? this.getSplitRange('actual', baseIndex)
            : { start: baseIndex, end: baseIndex };
        const inCurrentRange = Number.isInteger(currentIndex)
            && range
            && currentIndex >= range.start
            && currentIndex <= range.end;
        if (!inCurrentRange) return null;

        const rawElapsed = typeof this.getTimerRawElapsed === 'function'
            ? this.getTimerRawElapsed(slot)
            : Math.max(Number(slot.timer.rawElapsed) || 0, Number(slot.timer.elapsed) || 0);
        const activeUnits = Math.max(1, Math.min(totalUnits, Math.ceil(Math.max(0, rawElapsed) / 600) || 1));
        const columns = (typeof window !== 'undefined' && window.innerWidth <= 480) ? 3 : 6;
        const outline = new Map();

        for (let unitIndex = 0; unitIndex < activeUnits; unitIndex++) {
            const col = unitIndex % columns;
            const topNeighbor = unitIndex - columns;
            const bottomNeighbor = unitIndex + columns;
            const leftNeighbor = col > 0 ? unitIndex - 1 : -1;
            const rightNeighbor = col < columns - 1 ? unitIndex + 1 : -1;
            outline.set(unitIndex, {
                runningOutline: true,
                runningEdgeTop: topNeighbor < 0 || topNeighbor >= activeUnits,
                runningEdgeRight: rightNeighbor < 0 || rightNeighbor >= activeUnits,
                runningEdgeBottom: bottomNeighbor >= activeUnits,
                runningEdgeLeft: leftNeighbor < 0 || leftNeighbor >= activeUnits,
            });
        }
        return outline;
    }

    isLockedActivityRow(item) {
        return Boolean(item && item.source === 'locked');
    }

    isManualLockedActivityRow(item) {
        if (!this.isLockedActivityRow(item)) return false;
        if (item.isAutoLocked === true) return false;
        if (item.isAutoLocked === false) return true;
        const hasManualUnits = Array.isArray(item.lockUnits) && item.lockUnits.some((value) => Number.isFinite(value));
        const hasManualRange = Number.isFinite(item.lockStart) || Number.isFinite(item.lockEnd);
        return hasManualUnits || hasManualRange;
    }

    normalizeLockedUnitsFromRow(item, totalUnits = 0) {
        const total = Math.max(0, Math.floor(totalUnits) || 0);
        if (!this.isLockedActivityRow(item)) return [];
        const seen = new Set();
        const units = [];
        const normalizeUnit = (value) => {
            const unit = Number.isFinite(value) ? Math.floor(value) : null;
            if (unit == null || unit < 0 || unit >= total) return null;
            if (seen.has(unit)) return null;
            seen.add(unit);
            return unit;
        };
        const lockUnits = Array.isArray(item.lockUnits) ? item.lockUnits : null;
        if (lockUnits) {
            lockUnits.forEach((value) => {
                const unit = normalizeUnit(Number(value));
                if (unit == null) return;
                units.push(unit);
            });
            return units.sort((a, b) => a - b);
        }

        if (Number.isFinite(item.lockStart) || Number.isFinite(item.lockEnd)) {
            const lockStart = Math.floor(Number(item.lockStart));
            const lockEnd = Math.floor(Number(item.lockEnd));
            if (Number.isFinite(lockStart) && Number.isFinite(lockEnd)) {
                const start = Math.max(0, Math.min(lockStart, lockEnd));
                const end = Math.min(total - 1, Math.max(lockStart, lockEnd));
                for (let unit = start; unit <= end; unit++) {
                    units.push(unit);
                    seen.add(unit);
                }
                return units;
            }
        }

        return [];
    }

    extractLockedRowsFromActivities(activities = [], totalUnits = 0) {
        const total = Math.max(0, Math.floor(totalUnits) || 0);
        const manualRows = [];
        const autoRows = [];
        const manualRowsByIndex = new Set();
        const autoRowsByIndex = new Set();
        const manualMask = new Array(total).fill(false);
        const autoMask = new Array(total).fill(false);
        const isManual = (item) => this.isManualLockedActivityRow
            ? this.isManualLockedActivityRow(item)
            : (item && item.source === 'locked' && item.isAutoLocked === false);

        const safeRows = Array.isArray(activities) ? activities : [];
        safeRows.forEach((item, sourceIndex) => {
            if (!this.isLockedActivityRow(item)) return;
            const rowUnits = this.normalizeLockedUnitsFromRow(item, total);
            const targetRows = isManual(item) ? manualRows : autoRows;
            const targetSet = isManual(item) ? manualRowsByIndex : autoRowsByIndex;
            const targetMask = isManual(item) ? manualMask : autoMask;
            const pushRow = {
                sourceIndex,
                sourceRow: item,
                unitList: rowUnits.slice(),
                lockStart: rowUnits.length > 0 ? rowUnits[0] : null,
                lockEnd: rowUnits.length > 0 ? rowUnits[rowUnits.length - 1] : null,
                hasUnits: rowUnits.length > 0,
            };
            targetRows.push(pushRow);
            targetSet.add(sourceIndex);
            rowUnits.forEach((unit) => {
                if (unit >= 0 && unit < total) {
                    targetMask[unit] = true;
                }
            });
        });

        return {
            manualRows,
            autoRows,
            manualRowsByIndex,
            autoRowsByIndex,
            manualMask,
            autoMask,
            manualCount: manualMask.reduce((sum, value) => sum + (value ? 1 : 0), 0),
            autoCount: autoMask.reduce((sum, value) => sum + (value ? 1 : 0), 0),
        };
    }

    insertLockedRowsAfterRelatedActivities(baseRows = [], lockedRows = [], planUnits = null) {
        return globalThis.TimeTrackerActualGridCore.insertLockedRowsAfterRelatedActivities.call(this, ...arguments);
    }

    rebuildLockedRowsFromUnitSet(unitMask = [], options = {}) {
        const units = Array.isArray(unitMask) ? unitMask.map(value => Boolean(value)) : [];
        const isAutoLocked = options.isAutoLocked === true;
        const allowSegments = options.allowSegments !== false;
        const step = Number.isFinite(this.getActualDurationStepSeconds())
            ? this.getActualDurationStepSeconds()
            : 600;
        const normalizeDurationStep = (value) => {
            const raw = Number.isFinite(value) ? Math.floor(value) : 0;
            return this.normalizeActualDurationStep(raw);
        };
        const rows = [];
        const activeUnits = [];
        for (let i = 0; i < units.length; i++) {
            if (units[i]) {
                activeUnits.push(i);
            }
        }
        if (activeUnits.length === 0) return rows;
        if (isAutoLocked && !allowSegments) {
            const first = activeUnits[0];
            const last = activeUnits[activeUnits.length - 1];
            const seconds = normalizeDurationStep(activeUnits.length * step);
            rows.push({
                label: '',
                seconds,
                recordedSeconds: seconds,
                source: 'locked',
                isAutoLocked,
                lockStart: first,
                lockEnd: last,
                lockUnits: activeUnits.slice(),
            });
            return rows;
        }
        for (let index = 0; index < units.length; index++) {
            if (!units[index]) continue;
            let end = index;
            while (end + 1 < units.length && units[end + 1]) {
                end += 1;
            }
            const length = end - index + 1;
            const seconds = normalizeDurationStep(length * step);
            const lockUnits = [];
            for (let unit = index; unit <= end; unit++) {
                lockUnits.push(unit);
            }
            rows.push({
                label: '',
                seconds,
                recordedSeconds: seconds,
                source: 'locked',
                isAutoLocked,
                lockStart: index,
                lockEnd: end,
                lockUnits,
            });
            index = end;
        }
        return rows;
    }

    getActualGridLockedUnitsForBase(baseIndex, planUnits = null, activities = null) {
        return globalThis.TimeTrackerActualGridCore.getActualGridLockedUnitsForBase.call(this, ...arguments);
    }

    getActualGridManualLockedUnitsForBase(baseIndex, planUnits = null, activities = null) {
        return globalThis.TimeTrackerActualGridCore.getActualGridManualLockedUnitsForBase.call(this, ...arguments);
    }

    isActualGridUnitLocked(baseIndex, unitIndex, planUnits = null, activities = null) {
        if (!Number.isFinite(unitIndex)) return false;
        const units = Array.isArray(planUnits)
            ? planUnits
            : (this.buildPlanUnitsForActualGrid(baseIndex).units || []);
        if (!Array.isArray(units) || units.length === 0) return false;
        if (unitIndex < 0 || unitIndex >= units.length) return false;
        const lockedUnits = this.getActualGridLockedUnitsForBase(baseIndex, units, activities);
        return Boolean(Array.isArray(lockedUnits) && lockedUnits[unitIndex]);
    }

    getActualExtraGridUnitsForBase(baseIndex, totalUnits) {
        const slot = this.timeSlots[baseIndex];
        const raw = (slot && slot.activityLog && Array.isArray(slot.activityLog.actualExtraGridUnits))
            ? slot.activityLog.actualExtraGridUnits.map(value => Boolean(value))
            : [];
        return this.normalizeActualGridBooleanUnits(raw, totalUnits);
    }

    getActualFailedGridUnitsForBase(baseIndex, totalUnits) {
        const slot = this.timeSlots[baseIndex];
        const raw = (slot && slot.activityLog && Array.isArray(slot.activityLog.actualFailedGridUnits))
            ? slot.activityLog.actualFailedGridUnits.map(value => Boolean(value))
            : [];
        return this.normalizeActualGridBooleanUnits(raw, totalUnits);
    }

    normalizeActualGridBooleanUnits(units, totalUnits) {
        if (!Number.isFinite(totalUnits) || totalUnits <= 0) return [];
        let safe = Array.isArray(units) ? units.map(value => Boolean(value)) : [];
        if (safe.length > totalUnits) safe = safe.slice(0, totalUnits);
        if (safe.length < totalUnits) safe = safe.concat(new Array(totalUnits - safe.length).fill(false));
        return safe;
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

    buildExtraSlotAllocation(planUnits, actualUnits, extraActivities, orderIndices = null, lockedUnits = null) {
        return globalThis.TimeTrackerActualGridCore.buildExtraSlotAllocation.call(this, ...arguments);
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
        const rawFailedUnits = (baseSlot && baseSlot.activityLog && Array.isArray(baseSlot.activityLog.actualFailedGridUnits))
            ? baseSlot.activityLog.actualFailedGridUnits.map(value => Boolean(value))
            : [];
        let safeExtraUnits = rawExtraUnits;
        let safeFailedUnits = rawFailedUnits;
        if (Array.isArray(planUnits) && planUnits.length > 0) {
            safeExtraUnits = this.normalizeActualGridBooleanUnits(safeExtraUnits, planUnits.length);
            safeFailedUnits = this.normalizeActualGridBooleanUnits(safeFailedUnits, planUnits.length);
        } else {
            safeExtraUnits = [];
            safeFailedUnits = [];
        }

        if (actualMergeKey) {
            const [, startStr, endStr] = actualMergeKey.split('-');
            const start = parseInt(startStr, 10);
            const end = parseInt(endStr, 10);
            this.mergedFields.set(actualMergeKey, summary);
            for (let i = start; i <= end; i++) {
                const slot = this.timeSlots[i];
                if (!slot.activityLog || typeof slot.activityLog !== 'object') {
                    slot.activityLog = { title: '', details: '', subActivities: [], titleBandOn: false, actualGridUnits: [], actualExtraGridUnits: [], actualFailedGridUnits: [], actualOverride: false };
                }
                slot.activityLog.actualOverride = (i === start) ? hasExtras : false;
                slot.actual = (i === start) ? summary : '';
                if (i === start) {
                    slot.activityLog.subActivities = mergedActivities.map(item => ({ ...item }));
                    slot.activityLog.actualGridUnits = safeUnits.slice();
                    slot.activityLog.actualExtraGridUnits = safeExtraUnits.slice();
                    slot.activityLog.actualFailedGridUnits = safeFailedUnits.slice();
                } else {
                    slot.activityLog.subActivities = [];
                    slot.activityLog.actualGridUnits = [];
                    slot.activityLog.actualExtraGridUnits = [];
                    slot.activityLog.actualFailedGridUnits = [];
                }
            }
            return;
        }

        const slot = this.timeSlots[baseIndex];
        if (!slot.activityLog || typeof slot.activityLog !== 'object') {
            slot.activityLog = { title: '', details: '', subActivities: [], titleBandOn: false, actualGridUnits: [], actualExtraGridUnits: [], actualFailedGridUnits: [], actualOverride: false };
        }
        slot.activityLog.actualOverride = hasExtras;
        slot.actual = summary;
        slot.activityLog.subActivities = mergedActivities.map(item => ({ ...item }));
        slot.activityLog.actualGridUnits = safeUnits.slice();
        slot.activityLog.actualExtraGridUnits = safeExtraUnits.slice();
        slot.activityLog.actualFailedGridUnits = safeFailedUnits.slice();
    }

    toggleActualGridUnit(index, unitIndex) {
        const baseIndex = this.getSplitBaseIndex('actual', index);
        const planContext = this.buildPlanUnitsForActualGrid(baseIndex);
        if (!planContext || !Array.isArray(planContext.units) || planContext.units.length === 0) return;
        if (!Number.isFinite(unitIndex) || unitIndex < 0 || unitIndex >= planContext.units.length) return;
        if (this.isActualGridUnitLocked(baseIndex, unitIndex, planContext.units)) return;
        this.clearActualFailedGridUnitOnNormalClick(index, unitIndex, planContext.units.length);
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

    toggleActualGridLockedUnit(index, unitIndex) {
        const baseIndex = this.getSplitBaseIndex('actual', index);
        const planContext = this.buildPlanUnitsForActualGrid(baseIndex);
        if (!planContext || !Array.isArray(planContext.units) || planContext.units.length === 0) return;
        if (!Number.isFinite(unitIndex) || unitIndex < 0 || unitIndex >= planContext.units.length) return;
        const preservedGridUnits = (typeof this.getActualGridUnitsForBase === 'function')
            ? this.getActualGridUnitsForBase(baseIndex, planContext.units.length, planContext.units)
            : null;

        const slot = this.timeSlots[baseIndex];
        if (!slot) return;
        if (!slot.activityLog || typeof slot.activityLog !== 'object') {
            slot.activityLog = {
                title: '',
                details: '',
                subActivities: [],
                titleBandOn: false,
                actualGridUnits: [],
                actualExtraGridUnits: [],
                actualFailedGridUnits: [],
                actualOverride: false,
            };
        }

        const rawSub = Array.isArray(slot.activityLog.subActivities) ? slot.activityLog.subActivities : [];
        const normalizeActivities = (raw) => {
            if (typeof this.normalizeActivitiesArray === 'function') {
                return this.normalizeActivitiesArray(raw);
            }
            return Array.isArray(raw) ? raw.map((item) => ({ ...item })) : [];
        };
        const isManualLocked = (item) => {
            if (typeof this.isManualLockedActivityRow === 'function') {
                return this.isManualLockedActivityRow(item);
            }
            return item && item.source === 'locked' && item.isAutoLocked === false;
        };
        const normalizeLabel = (value) => this.normalizeActivityText
            ? this.normalizeActivityText(value || '')
            : String(value || '').trim();
        const normalizeAssignedSeconds = (value) => {
            const raw = Number.isFinite(value) ? Math.floor(value) : 0;
            if (typeof this.normalizeActualDurationStep === 'function') {
                return this.normalizeActualDurationStep(raw);
            }
            return Math.max(0, raw);
        };
        const stepSeconds = Number.isFinite(this.getActualDurationStepSeconds())
            ? this.getActualDurationStepSeconds()
            : 600;
        const planLabelSet = new Set();
        planContext.units.forEach((label) => {
            const normalizedLabel = normalizeLabel(label || '');
            if (normalizedLabel) {
                planLabelSet.add(normalizedLabel);
            }
        });
        const normalized = normalizeActivities(rawSub).map((item) => ({ ...item }));
        if (!Array.isArray(normalized)) return;

        const lockData = this.extractLockedRowsFromActivities(normalized, planContext.units.length);
        const previousManualMask = Array.isArray(lockData.manualMask)
            ? lockData.manualMask.slice(0)
            : new Array(planContext.units.length).fill(false);
        const manualMask = previousManualMask.slice(0);
        manualMask[unitIndex] = !Boolean(manualMask[unitIndex]);

        const seedPlanRows = (rows, requiredLabels = []) => {
            const safeRows = Array.isArray(rows)
                ? rows
                    .filter((item) => item && typeof item === 'object')
                    .map((item) => ({ ...item }))
                : [];
            const pendingLabels = Array.from(new Set(
                (Array.isArray(requiredLabels) ? requiredLabels : [])
                    .map((label) => normalizeLabel(label || ''))
                    .filter(Boolean)
            )).filter((label) => !safeRows.some((item) => {
                if (!item || this.isLockedActivityRow(item)) return false;
                const rowLabel = normalizeLabel(item.label || '');
                if (!rowLabel || rowLabel !== label) return false;
                return item.source === 'grid' || planLabelSet.has(rowLabel);
            }));
            if (pendingLabels.length === 0) return safeRows;
            if (typeof this.getActualGridUnitsForBase === 'function'
                && typeof this.buildActualActivitiesFromGrid === 'function'
                && typeof this.mergeActualActivitiesWithGrid === 'function') {
                const currentUnits = this.getActualGridUnitsForBase(
                    baseIndex,
                    planContext.units.length,
                    planContext.units
                );
                const currentGridActivities = this.buildActualActivitiesFromGrid(
                    planContext.units,
                    Array.isArray(currentUnits) ? currentUnits : []
                );
                const seededRows = this.mergeActualActivitiesWithGrid(
                    baseIndex,
                    planContext.units,
                    currentGridActivities,
                    safeRows,
                    planContext.planLabel || ''
                );
                return (Array.isArray(seededRows) ? seededRows : [])
                    .filter((item) => !this.isLockedActivityRow(item))
                    .map((item) => ({ ...item }));
            }
            pendingLabels.forEach((label) => {
                safeRows.push({ label, seconds: 0, source: 'grid' });
            });
            return safeRows;
        };
        const applyManualLockAssignmentDelta = (rows) => {
            const deltaByLabel = new Map();
            for (let i = 0; i < planContext.units.length; i++) {
                const wasLocked = Boolean(previousManualMask[i]);
                const isLocked = Boolean(manualMask[i]);
                if (wasLocked === isLocked) continue;
                const label = normalizeLabel(planContext.units[i] || '');
                if (!label) continue;
                const delta = isLocked ? -stepSeconds : stepSeconds;
                deltaByLabel.set(label, (deltaByLabel.get(label) || 0) + delta);
            }
            if (deltaByLabel.size === 0) {
                return Array.isArray(rows) ? rows.map((item) => ({ ...item })) : [];
            }

            let nextRows = seedPlanRows(rows, Array.from(deltaByLabel.keys()));
            const isAdjustablePlanRow = (item) => {
                if (!item || this.isLockedActivityRow(item)) return false;
                const label = normalizeLabel(item.label || '');
                if (!label) return false;
                return item.source === 'grid' || planLabelSet.has(label);
            };

            deltaByLabel.forEach((secondsDelta, label) => {
                const matchingIndices = [];
                nextRows.forEach((item, idx) => {
                    if (!isAdjustablePlanRow(item)) return;
                    const rowLabel = normalizeLabel(item.label || '');
                    if (rowLabel === label) {
                        matchingIndices.push(idx);
                    }
                });
                if (matchingIndices.length === 0) return;

                if (secondsDelta < 0) {
                    let remaining = Math.abs(secondsDelta);
                    for (let i = matchingIndices.length - 1; i >= 0 && remaining > 0; i--) {
                        const rowIndex = matchingIndices[i];
                        const current = Number.isFinite(nextRows[rowIndex].seconds)
                            ? Math.max(0, Math.floor(nextRows[rowIndex].seconds))
                            : 0;
                        if (current <= 0) continue;
                        const reduce = Math.min(current, remaining);
                        nextRows[rowIndex].seconds = current - reduce;
                        remaining -= reduce;
                    }
                    return;
                }

                const targetIndex = matchingIndices[matchingIndices.length - 1];
                const current = Number.isFinite(nextRows[targetIndex].seconds)
                    ? Math.max(0, Math.floor(nextRows[targetIndex].seconds))
                    : 0;
                nextRows[targetIndex].seconds = current + secondsDelta;
            });

            return nextRows
                .map((item) => {
                    if (!item || typeof item !== 'object') return item;
                    const nextItem = { ...item };
                    nextItem.seconds = normalizeAssignedSeconds(nextItem.seconds);
                    if (Number.isFinite(nextItem.recordedSeconds)) {
                        nextItem.recordedSeconds = normalizeAssignedSeconds(nextItem.recordedSeconds);
                    }
                    return nextItem;
                })
                .filter((item) => item && (item.label || item.seconds > 0 || item.source === 'locked'));
        };

        let nonLockedRows = normalized.filter((item) => !this.isLockedActivityRow(item));
        if (nonLockedRows.length === 0
            && typeof this.getActualGridUnitsForBase === 'function'
            && typeof this.buildActualActivitiesFromGrid === 'function'
            && typeof this.mergeActualActivitiesWithGrid === 'function') {
            const currentUnits = this.getActualGridUnitsForBase(
                baseIndex,
                planContext.units.length,
                planContext.units
            );
            const currentGridActivities = this.buildActualActivitiesFromGrid(
                planContext.units,
                Array.isArray(currentUnits) ? currentUnits : []
            );
            const seededRows = this.mergeActualActivitiesWithGrid(
                baseIndex,
                planContext.units,
                currentGridActivities,
                [],
                planContext.planLabel || ''
            );
            nonLockedRows = (Array.isArray(seededRows) ? seededRows : []).filter((item) => !this.isLockedActivityRow(item));
        }
        nonLockedRows = applyManualLockAssignmentDelta(nonLockedRows);
        const existingAutoMask = Array.isArray(lockData.autoMask)
            ? lockData.autoMask
            : new Array(planContext.units.length).fill(false);
        const autoMask = existingAutoMask.map((value, idx) => Boolean(value && !manualMask[idx]));

        const manualRows = this.rebuildLockedRowsFromUnitSet(manualMask, { isAutoLocked: false });
        const autoRowsFromMask = this.rebuildLockedRowsFromUnitSet(autoMask, {
            isAutoLocked: true,
            allowSegments: false,
        });

        const withManualRows = (typeof this.insertLockedRowsAfterRelatedActivities === 'function')
            ? this.insertLockedRowsAfterRelatedActivities(nonLockedRows, manualRows, planContext.units)
            : nonLockedRows.concat(manualRows);
        const nextActivities = withManualRows.concat(autoRowsFromMask);
        nextActivities.forEach((item, idx) => {
            if (item && item.source === 'locked') {
                if (Number.isFinite(item.seconds)) {
                    item.seconds = this.normalizeActualDurationStep(item.seconds);
                }
                if (Number.isFinite(item.recordedSeconds)) {
                    item.recordedSeconds = this.normalizeActualDurationStep(item.recordedSeconds);
                }
            }
        });
        slot.activityLog.subActivities = nextActivities.map((item) => ({ ...item }));
        if (Array.isArray(preservedGridUnits)) {
            slot.activityLog.actualGridUnits = preservedGridUnits.map((value) => Boolean(value));
        }
        if (typeof this.syncActualGridToSlots === 'function' && Array.isArray(preservedGridUnits)) {
            this.syncActualGridToSlots(baseIndex, planContext.units, preservedGridUnits);
        }

        if (this.modalActualBaseIndex === baseIndex && this.modalActualHasPlanUnits) {
            this.modalActualActivities = slot.activityLog.subActivities.map((item) => ({ ...item }));
            if (Array.isArray(preservedGridUnits)) {
                this.modalActualGridUnits = preservedGridUnits.map((value) => Boolean(value));
            }
            this.modalActualDirty = true;
            this.clampActualGridToAssigned();
            this.renderActualActivitiesList();
        }

        this.renderTimeEntries(true);
        this.calculateTotals();
        this.autoSave();
    }

    clearActualFailedGridUnitOnNormalClick(index, unitIndex, totalUnits = null) {
        if (!Number.isFinite(unitIndex)) return false;
        const baseIndex = this.getSplitBaseIndex('actual', index);
        const fallbackContext = (!Number.isFinite(totalUnits) || totalUnits <= 0)
            ? this.buildPlanUnitsForActualGrid(baseIndex)
            : null;
        const unitsLength = Number.isFinite(totalUnits) && totalUnits > 0
            ? Math.floor(totalUnits)
            : ((fallbackContext && Array.isArray(fallbackContext.units)) ? fallbackContext.units.length : 0);
        if (!Number.isFinite(unitsLength) || unitsLength <= 0) return false;
        if (unitIndex < 0 || unitIndex >= unitsLength) return false;

        const failedUnits = this.getActualFailedGridUnitsForBase(baseIndex, unitsLength);
        if (!Array.isArray(failedUnits) || !failedUnits[unitIndex]) return false;
        failedUnits[unitIndex] = false;

        const actualMergeKey = this.findMergeKey('actual', baseIndex);
        if (actualMergeKey) {
            const [, startStr, endStr] = actualMergeKey.split('-');
            const start = parseInt(startStr, 10);
            const end = parseInt(endStr, 10);
            for (let i = start; i <= end; i++) {
                const slot = this.timeSlots[i];
                if (!slot) continue;
                if (!slot.activityLog || typeof slot.activityLog !== 'object') {
                    slot.activityLog = { title: '', details: '', subActivities: [], titleBandOn: false, actualGridUnits: [], actualExtraGridUnits: [], actualFailedGridUnits: [], actualOverride: false };
                }
                slot.activityLog.actualFailedGridUnits = (i === start) ? failedUnits.slice() : [];
            }
            return true;
        }

        const slot = this.timeSlots[baseIndex];
        if (!slot) return false;
        if (!slot.activityLog || typeof slot.activityLog !== 'object') {
            slot.activityLog = { title: '', details: '', subActivities: [], titleBandOn: false, actualGridUnits: [], actualExtraGridUnits: [], actualFailedGridUnits: [], actualOverride: false };
        }
        slot.activityLog.actualFailedGridUnits = failedUnits.slice();
        return true;
    }

    toggleActualFailedGridUnit(index, unitIndex) {
        const baseIndex = this.getSplitBaseIndex('actual', index);
        const planContext = this.buildPlanUnitsForActualGrid(baseIndex);
        if (!planContext || !Array.isArray(planContext.units) || planContext.units.length === 0) return;
        if (!Number.isFinite(unitIndex) || unitIndex < 0 || unitIndex >= planContext.units.length) return;
        if (this.isActualGridUnitLocked(baseIndex, unitIndex, planContext.units)) return;

        const failedUnits = this.getActualFailedGridUnitsForBase(baseIndex, planContext.units.length);
        failedUnits[unitIndex] = !failedUnits[unitIndex];
        const actualUnits = this.getActualGridUnitsForBase(baseIndex, planContext.units.length, planContext.units);

        const actualMergeKey = this.findMergeKey('actual', baseIndex);
        if (actualMergeKey) {
            const [, startStr, endStr] = actualMergeKey.split('-');
            const start = parseInt(startStr, 10);
            const end = parseInt(endStr, 10);
            for (let i = start; i <= end; i++) {
                const slot = this.timeSlots[i];
                if (!slot) continue;
                if (!slot.activityLog || typeof slot.activityLog !== 'object') {
                    slot.activityLog = { title: '', details: '', subActivities: [], titleBandOn: false, actualGridUnits: [], actualExtraGridUnits: [], actualFailedGridUnits: [], actualOverride: false };
                }
                slot.activityLog.actualFailedGridUnits = (i === start) ? failedUnits.slice() : [];
            }
        } else {
            const slot = this.timeSlots[baseIndex];
            if (!slot) return;
            if (!slot.activityLog || typeof slot.activityLog !== 'object') {
                slot.activityLog = { title: '', details: '', subActivities: [], titleBandOn: false, actualGridUnits: [], actualExtraGridUnits: [], actualFailedGridUnits: [], actualOverride: false };
            }
            slot.activityLog.actualFailedGridUnits = failedUnits.slice();
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
        this.clearActualFailedGridUnitOnNormalClick(index, unitIndex, planUnits.length);
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
        const lockedUnits = this.getActualGridLockedUnitsForBase(baseIndex, planUnits, orderedActual);
        const allocation = this.buildExtraSlotAllocation(
            planUnits,
            actualUnits,
            extras,
            displayOrder,
            lockedUnits,
            orderedActual,
            planLabelSet
        );
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
            slot.activityLog = { title: '', details: '', subActivities: [], titleBandOn: false, actualGridUnits: [], actualExtraGridUnits: [], actualFailedGridUnits: [], actualOverride: false };
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
                  const failedUnits = this.getActualFailedGridUnitsForBase(baseIndex, planUnits.length);
                  const rawSub = (slot && slot.activityLog && Array.isArray(slot.activityLog.subActivities))
                      ? slot.activityLog.subActivities
                      : [];
                  const normalizedSub = this.normalizeActivitiesArray(rawSub).map(item => ({ ...item }));
                  const orderedActual = this.sortActivitiesByOrder(normalizedSub);
                  const lockedUnits = this.getActualGridLockedUnitsForBase(baseIndex, planUnits, orderedActual);
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
                  const allocation = this.buildExtraSlotAllocation(
                      planUnits,
                      actualUnits,
                      extras,
                      displayOrder,
                      lockedUnits,
                      orderedActual,
                      planLabelSet
                  );
                  const extraActiveUnits = this.buildExtraActiveGridUnits(
                      planUnits.length,
                      allocation,
                      extras,
                      slot && slot.activityLog ? slot.activityLog.actualExtraGridUnits : null
                  );
                  const shownExtraLabels = new Set();
                  const runningOutline = typeof this.getRunningActualGridOutline === 'function'
                      ? this.getRunningActualGridOutline(baseIndex, planUnits.length)
                      : null;

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
                              locked: false,
                              failed: Boolean(failedUnits[unitIndex]),
                              isExtra: true,
                              reservedIndices,
                              extraLabel,
                              alwaysVisibleLabel,
                              suppressHoverLabel,
                              ...(runningOutline && runningOutline.get(unitIndex) ? runningOutline.get(unitIndex) : {})
                          };
                      }
                      return {
                          label,
                          span: 1,
                          unitIndex,
                          active: Boolean(actualUnits[unitIndex]) && !Boolean(lockedUnits[unitIndex]),
                          locked: Boolean(lockedUnits[unitIndex]),
                          failed: Boolean(failedUnits[unitIndex]),
                          isExtra: false,
                          reservedIndices,
                          ...(runningOutline && runningOutline.get(unitIndex) ? runningOutline.get(unitIndex) : {})
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
            const failedUnits = this.getActualFailedGridUnitsForBase(baseIndex, planUnits.length);
            const planLabelSet = new Set();
            planUnits.forEach((label) => {
                const normalized = this.normalizeActivityText
                    ? this.normalizeActivityText(label || '')
                    : String(label || '').trim();
                if (normalized) planLabelSet.add(normalized);
            });
            const orderedActual = this.sortActivitiesByOrder(actualActivities);
            const lockedUnits = this.getActualGridLockedUnitsForBase(baseIndex, planUnits, orderedActual);
            let displayOrder = this.getActualGridDisplayOrderIndices(planUnits, orderedActual, planLabelSet);
            if (displayOrder.length !== planUnits.length) {
                displayOrder = planUnits.map((_, idx) => idx);
            }
            const runningOutline = typeof this.getRunningActualGridOutline === 'function'
                ? this.getRunningActualGridOutline(baseIndex, planUnits.length)
                : null;
            const gridSegments = displayOrder.map((unitIndex) => ({
                label: planUnits[unitIndex],
                span: 1,
                unitIndex,
                active: Boolean(actualUnits[unitIndex]) && !Boolean(lockedUnits[unitIndex]),
                locked: Boolean(lockedUnits[unitIndex]),
                failed: Boolean(failedUnits[unitIndex]),
                ...(runningOutline && runningOutline.get(unitIndex) ? runningOutline.get(unitIndex) : {}),
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
            const planActivities = this.normalizePlanActivitiesArray(slot.planActivities).map(item => ({ ...item }));
            if (planActivities.length > 0) {
                return planActivities;
            }

            const planLabel = this.getPlannedLabelForIndex(baseIndex);
            if (planLabel) {
                const blockSeconds = Math.max(3600, this.getBlockLength('planned', baseIndex) * 3600);
                return [{ label: planLabel, seconds: blockSeconds, source: 'plan-template' }];
            }

            return [];
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
        if (typeof this.createActualSlotField === 'function') {
            return this.createActualSlotField(index, slot);
        }
        const safeValue = this.escapeHtml(slot && slot.actual);
        const safeAttr = this.escapeAttribute(slot && slot.actual);
        return `<div class="actual-field-container">
                    <div class="input-field actual-input timer-result-input"
                         data-index="${index}"
                         data-type="actual"
                         data-value="${safeAttr}"
                         title="${safeAttr}">${safeValue}</div>
                    <button class="activity-log-btn" data-index="${index}" aria-label="활동 상세 기록 열기" title="상세 기록 열기">기록</button>
                </div>`;
    }

    createActualSlotField(index, slot) {
        return this._buildActualSlotFieldMarkup(index, slot);
    }

    _buildActualSlotFieldMarkup(index, slot) {
        const safeValue = this.escapeHtml(slot && slot.actual);
        const safeAttr = this.escapeAttribute(slot && slot.actual);
        return `<div class="actual-field-container">
                    <div class="input-field actual-input timer-result-input"
                         data-index="${index}"
                         data-type="actual"
                         data-value="${safeAttr}"
                         title="${safeAttr}">${safeValue}</div>
                    <button class="activity-log-btn" data-index="${index}" aria-label="활동 상세 기록 열기" title="상세 기록 열기">기록</button>
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
        const rawElapsed = this.getTimerRawElapsed(slot);
        const hasElapsed = rawElapsed > 0;
        const eligibility = this.getTimerEligibility(index, slot);
        const timerStatus = this.normalizeTimerStatus(slot.timer && slot.timer.status, slot);

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
                buttonIcon = '정지';
                buttonAction = 'stop';
                buttonDisabled = false;
            } else if (hasElapsed) {
                buttonIcon = '재생';
                buttonAction = 'resume';
                buttonDisabled = eligibility.disabledByDate || !eligibility.hasPlannedActivity;
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

        const timerDisplayStyle = isRunning || hasElapsed ? 'display: block;' : 'display: none;';
        const timerDisplay = this.formatTime(Math.max(Number(slot.timer.elapsed) || 0, rawElapsed));
        const rawDisplayStyle = 'display: none;';
        const rawDisplay = '';
        const isCompactMobileTimeUi = this.isMobileTimeExpansionEnabled();
        const mobileStartIcon = buttonAction === 'stop' ? '■' : '▶';
        const startVisualLabel = isCompactMobileTimeUi ? mobileStartIcon : buttonIcon;
        const statusClasses = [
            isRunning ? 'timer-running' : '',
            timerStatus === 'paused' ? 'timer-paused' : '',
            timerStatus === 'completed' ? 'timer-completed' : '',
        ].filter(Boolean).join(' ');

        return `
            <div class="timer-controls-container ${statusClasses}" data-index="${index}">
                <div class="timer-controls">
                    <button class="timer-btn timer-start-pause"
                            data-index="${index}"
                            data-action="${buttonAction}" aria-label="타이머 ${buttonIcon}"${startButtonAttrString}>
                        <span class="timer-btn-mobile-icon" aria-hidden="true">${startVisualLabel}</span>
                        <span class="timer-btn-label">${buttonIcon}</span>
                    </button>
                </div>
                <div class="timer-display" style="${timerDisplayStyle}">${timerDisplay}</div>
                <div class="timer-raw-display" style="${rawDisplayStyle}">${rawDisplay}</div>
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

    normalizeActualRecordedTimerSeconds(seconds) {
        const rawSeconds = Number.isFinite(seconds) ? Math.floor(seconds) : 0;
        if (rawSeconds < 420) return 0;

        const totalMinutes = Math.floor(rawSeconds / 60);
        const roundedMinute = Math.floor(totalMinutes / 10) * 10 + (totalMinutes % 10 >= 5 ? 10 : 0);
        return Math.max(0, roundedMinute * 60);
    }

    normalizeActualTimerSeconds(seconds) {
        return this.normalizeActualDurationStep(Number.isFinite(seconds) ? Math.floor(seconds) : 0);
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
                if (item.isAutoLocked === false) {
                    normalized.isAutoLocked = false;
                } else if (item.isAutoLocked === true) {
                    normalized.isAutoLocked = true;
                }
                if (Array.isArray(item.lockUnits)) {
                    normalized.lockUnits = item.lockUnits
                        .filter((value) => Number.isFinite(value))
                        .map((value) => Math.floor(value));
                }
                const lockStart = Number.isFinite(item.lockStart) ? Math.floor(item.lockStart) : null;
                const lockEnd = Number.isFinite(item.lockEnd) ? Math.floor(item.lockEnd) : null;
                if (lockStart != null) {
                    normalized.lockStart = lockStart;
                }
                if (lockEnd != null) {
                    normalized.lockEnd = lockEnd;
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
                    if (Array.isArray(slot.activityLog.actualFailedGridUnits)) {
                        slot.activityLog.actualFailedGridUnits = [];
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
                if (Array.isArray(slot.activityLog.actualFailedGridUnits)) {
                    slot.activityLog.actualFailedGridUnits = [];
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
                        if (input) {
                            input.textContent = clamped;
                            input.setAttribute('data-value', clamped);
                        }
                    }
                } catch (_) {}
            this.showNotification('기록 시간은 한 칸당 최대 60분까지 입력할 수 있습니다.');
        }
    }

        getPlanActivitiesForIndex(index) {
        return globalThis.TimeTrackerPlannedEditorController.getPlanActivitiesForIndex.call(this, ...arguments);
    }

        updatePlanActivitiesAssignment(baseIndex, label, seconds) {
        return globalThis.TimeTrackerPlannedEditorController.updatePlanActivitiesAssignment.call(this, ...arguments);
    }

        getValidPlanActivitiesSeconds() {
        return globalThis.TimeTrackerPlannedEditorController.getValidPlanActivitiesSeconds.call(this, ...arguments);
    }

        getPlanUIElements() {
        return globalThis.TimeTrackerPlannedEditorController.getPlanUIElements.call(this, ...arguments);
    }

        updatePlanActivitiesToggleLabel() {
        return globalThis.TimeTrackerPlannedEditorController.updatePlanActivitiesToggleLabel.call(this, ...arguments);
    }

        updatePlanActivitiesSummary() {
        return globalThis.TimeTrackerPlannedEditorController.updatePlanActivitiesSummary.call(this, ...arguments);
    }

        syncPlanTitleBandToggleState() {
        return globalThis.TimeTrackerPlannedEditorController.syncPlanTitleBandToggleState.call(this, ...arguments);
    }

        renderPlanActivitiesList() {
        return globalThis.TimeTrackerPlannedEditorController.renderPlanActivitiesList.call(this, ...arguments);
    }

        isValidPlanRow(index) {
        return globalThis.TimeTrackerPlannedEditorController.isValidPlanRow.call(this, ...arguments);
    }

        updatePlanRowActiveStyles() {
        return globalThis.TimeTrackerPlannedEditorController.updatePlanRowActiveStyles.call(this, ...arguments);
    }

        setPlanActiveRow(index, options = {}) {
        return globalThis.TimeTrackerPlannedEditorController.setPlanActiveRow.call(this, ...arguments);
    }

        focusPlanRowLabel(index) {
        return globalThis.TimeTrackerPlannedEditorController.focusPlanRowLabel.call(this, ...arguments);
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
        return globalThis.TimeTrackerPlannedEditorController.resolveRecommendedPlanSeconds.call(this, ...arguments);
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
        return globalThis.TimeTrackerPlannedEditorController.adjustActivityDuration.call(this, ...arguments);
    }

        openPlanActivitiesSection() {
        return globalThis.TimeTrackerPlannedEditorController.openPlanActivitiesSection.call(this, ...arguments);
    }

        closePlanActivitiesSection() {
        return globalThis.TimeTrackerPlannedEditorController.closePlanActivitiesSection.call(this, ...arguments);
    }

        addPlanActivityRow(defaults = {}) {
        return globalThis.TimeTrackerPlannedEditorController.addPlanActivityRow.call(this, ...arguments);
    }

        handlePlanActivitiesInput(event) {
        return globalThis.TimeTrackerPlannedEditorController.handlePlanActivitiesInput.call(this, ...arguments);
    }

        applyPlanActivityLabelSelection(index, label) {
        return globalThis.TimeTrackerPlannedEditorController.applyPlanActivityLabelSelection.call(this, ...arguments);
    }

        openPlanActivityMenu(index, anchorEl) {
        return globalThis.TimeTrackerPlannedEditorController.openPlanActivityMenu.call(this, ...arguments);
    }

        positionPlanActivityMenu(anchorEl) {
        return globalThis.TimeTrackerPlannedEditorController.positionPlanActivityMenu.call(this, ...arguments);
    }

        closePlanActivityMenu() {
        return globalThis.TimeTrackerPlannedEditorController.closePlanActivityMenu.call(this, ...arguments);
    }

        openPlanTitleMenu(anchorEl, options = {}) {
        return globalThis.TimeTrackerPlannedEditorController.openPlanTitleMenu.call(this, ...arguments);
    }

        positionPlanTitleMenu(anchorEl) {
        return globalThis.TimeTrackerPlannedEditorController.positionPlanTitleMenu.call(this, ...arguments);
    }

        closePlanTitleMenu() {
        return globalThis.TimeTrackerPlannedEditorController.closePlanTitleMenu.call(this, ...arguments);
    }

        openInlinePriorityMenu(anchorEl, options = {}) {
        return globalThis.TimeTrackerPlannedEditorController.openInlinePriorityMenu.call(this, ...arguments);
    }

        positionInlinePriorityMenu(anchorEl) {
        return globalThis.TimeTrackerPlannedEditorController.positionInlinePriorityMenu.call(this, ...arguments);
    }

        closeInlinePriorityMenu() {
        return globalThis.TimeTrackerPlannedEditorController.closeInlinePriorityMenu.call(this, ...arguments);
    }

        handlePlanActivitiesRemoval(event) {
        return globalThis.TimeTrackerPlannedEditorController.handlePlanActivitiesRemoval.call(this, ...arguments);
    }

        insertPlanLabelToRow(label, meta = {}) {
        return globalThis.TimeTrackerPlannedEditorController.insertPlanLabelToRow.call(this, ...arguments);
    }

        removePlanActivitiesByLabel(label) {
        return globalThis.TimeTrackerPlannedEditorController.removePlanActivitiesByLabel.call(this, ...arguments);
    }

        syncInlinePlanToSlots() {
        return globalThis.TimeTrackerPlannedEditorController.syncInlinePlanToSlots.call(this, ...arguments);
    }

        fillRemainingPlanActivity() {
        return globalThis.TimeTrackerPlannedEditorController.fillRemainingPlanActivity.call(this, ...arguments);
    }

        ensurePlanTitleButton(inputEl) {
        return globalThis.TimeTrackerPlannedEditorController.ensurePlanTitleButton.call(this, ...arguments);
    }

        getPlanTitleInputValue(inputEl) {
        return globalThis.TimeTrackerPlannedEditorController.getPlanTitleInputValue.call(this, ...arguments);
    }

        setPlanTitleInputDisplay(inputEl, value) {
        return globalThis.TimeTrackerPlannedEditorController.setPlanTitleInputDisplay.call(this, ...arguments);
    }

        setPlanTitle(text) {
        return globalThis.TimeTrackerPlannedEditorController.setPlanTitle.call(this, ...arguments);
    }

        confirmPlanTitleSelection() {
        return globalThis.TimeTrackerPlannedEditorController.confirmPlanTitleSelection.call(this, ...arguments);
    }

        renderPlanTitleDropdown(options = {}) {
        return globalThis.TimeTrackerPlannedEditorController.renderPlanTitleDropdown.call(this, ...arguments);
    }

        preparePlanActivitiesSection(startIndex, endIndex) {
        return globalThis.TimeTrackerPlannedEditorController.preparePlanActivitiesSection.call(this, ...arguments);
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
        slot.timer.status = slot.timer.elapsed > 0 ? 'completed' : 'idle';

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
                slotPlanActivities: slot.planActivities,
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
                return this.createActualSlotField(index, { ...this.timeSlots[index], actual: value || '' });
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
                                <div class="input-field actual-input timer-result-input merged-field"
                                       data-index="${index}"
                                       data-type="actual"
                                       data-merge-key="${safeMergeKey}"
                                       data-value="${safeMergeValue}"
                                       title="${safeMergeValue}">${safeMergeValue}</div>
                                <button class="activity-log-btn" data-index="${index}" aria-label="활동 상세 기록 열기" title="상세 기록 열기">기록</button>
                            </div>
                        </div>`;
            } else {
                const isLast = index === end;
                return `<div class="actual-field-container merged-actual-secondary ${isLast ? 'merged-actual-last' : ''}"
                               data-merge-key="${safeMergeKey}"
                               data-merge-start="${start}"
                               data-merge-end="${end}">
                            <div class="input-field actual-input merged-secondary"
                                   data-index="${index}"
                                   data-type="actual"
                                   data-merge-key="${safeMergeKey}"
                                   data-value="${safeMergeValue}"
                                   title="${safeMergeValue}">${safeMergeValue}
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
        return globalThis.TimeTrackerSelectionOverlayController.selectMergedRange.call(this, type, mergeKey, opts);
    }

    ensureSelectionOverlay(type) {
        return globalThis.TimeTrackerSelectionOverlayController.ensureSelectionOverlay.call(this, type);
    }

    // 현재 좌표 위치에 있는 type 컬럼(.planned-input | .actual-input)의 인덱스를 반환
    getIndexAtClientPosition(type, clientX, clientY) {
        return globalThis.TimeTrackerSelectionOverlayController.getIndexAtClientPosition.call(this, type, clientX, clientY);
    }

    removeSelectionOverlay(type) {
        return globalThis.TimeTrackerSelectionOverlayController.removeSelectionOverlay.call(this, type);
    }

    updateSelectionOverlay(type) {
        return globalThis.TimeTrackerSelectionOverlayController.updateSelectionOverlay.call(this, type);
    }

    // 선택 박스의 기준 사각형을 컬럼/병합 상태에 맞춰 반환
    getSelectionCellRect(type, index) {
        return globalThis.TimeTrackerSelectionOverlayController.getSelectionCellRect.call(this, type, index);
    }

    ensureHoverSelectionOverlay(type) {
        return globalThis.TimeTrackerSelectionOverlayController.ensureHoverSelectionOverlay.call(this, type);
    }

    removeHoverSelectionOverlay(type) {
        return globalThis.TimeTrackerSelectionOverlayController.removeHoverSelectionOverlay.call(this, type);
    }

    updateHoverSelectionOverlay(type, startIndex, endIndex) {
        return globalThis.TimeTrackerSelectionOverlayController.updateHoverSelectionOverlay.call(this, type, startIndex, endIndex);
    }

    isMergeRangeSelected(type, mergeKey) {
        return globalThis.TimeTrackerSelectionOverlayController.isMergeRangeSelected.call(this, type, mergeKey);
    }

        attachRowWideClickTargets(entryDiv, index) {
        return globalThis.TimeTrackerFieldInteractionController.attachRowWideClickTargets.call(this, ...arguments);
    }

        attachCellClickListeners(entryDiv, index) {
        return globalThis.TimeTrackerFieldInteractionController.attachCellClickListeners.call(this, ...arguments);
    }

    hideScheduleButton() {
        return globalThis.TimeTrackerSelectionOverlayController.hideScheduleButton.call(this);
    }

    showScheduleButtonForSelection(type) {
        return globalThis.TimeTrackerSelectionOverlayController.showScheduleButtonForSelection.call(this, type);
    }

    // 좌측 열 셀에 마우스를 올렸을 때 단일/병합 대상의 스케줄 버튼을 표시
    showScheduleButtonOnHover(index) {
        return globalThis.TimeTrackerSelectionOverlayController.showScheduleButtonOnHover.call(this, index);
    }

        showActivityLogButtonOnHover(index) {
        return globalThis.TimeTrackerSchedulePreviewController.showActivityLogButtonOnHover.call(this, index);
    }

    hideHoverActivityLogButton() {
        if (this.activityHoverHideTimer) {
            clearTimeout(this.activityHoverHideTimer);
            this.activityHoverHideTimer = null;
        }
        if (this.activityHoverButton) {
            if (this.activityHoverButton.classList && this.activityHoverButton.classList.contains('activity-log-btn-floating')) {
                if (this.activityHoverButton.parentNode) {
                    this.activityHoverButton.parentNode.removeChild(this.activityHoverButton);
                }
            } else {
                this.activityHoverButton.style.opacity = '';
                this.activityHoverButton.style.pointerEvents = '';
            }
        }
        this.activityHoverButton = null;
    }

    hideHoverScheduleButton() {
        return globalThis.TimeTrackerSelectionOverlayController.hideHoverScheduleButton.call(this);
    }

    // 스케줄 버튼 우측으로 병합/되돌리기 버튼 정렬
    repositionButtonsNextToSchedule() {
        return globalThis.TimeTrackerSelectionOverlayController.repositionButtonsNextToSchedule.call(this);
    }

        getSchedulePreviewData() {
        return globalThis.TimeTrackerSchedulePreviewController.getSchedulePreviewData.call(this);
    }

        resetSchedulePreview() {
        return globalThis.TimeTrackerSchedulePreviewController.resetSchedulePreview.call(this);
    }

        updateSchedulePreview() {
        return globalThis.TimeTrackerSchedulePreviewController.updateSchedulePreview.call(this);
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
            const existing = this.plannedActivities[idx] || {};
            this.plannedActivities[idx] = {
                label,
                source: 'local',
                priorityRank: this.normalizePriorityRankValue(existing.priorityRank),
                recommendedSeconds: Number.isFinite(existing.recommendedSeconds) ? Math.max(0, Number(existing.recommendedSeconds)) : null
            };
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
            const existing = this.plannedActivities[i] || {};
            this.plannedActivities[i] = {
                label: newLabel,
                source: 'local',
                priorityRank: this.normalizePriorityRankValue(existing.priorityRank),
                recommendedSeconds: Number.isFinite(existing.recommendedSeconds) ? Math.max(0, Number(existing.recommendedSeconds)) : null
            };
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
    updatePlannedActivityPriority(label, value) {
        const normalizedLabel = this.normalizeActivityText(label || '');
        if (!normalizedLabel) return false;
        const idx = this.findPlannedActivityIndex(normalizedLabel);
        if (idx < 0) return false;
        const item = this.plannedActivities[idx];
        if (!item || item.source === 'notion') return false;
        const nextPriorityRank = this.normalizePriorityRankValue(value);
        const currentPriorityRank = this.normalizePriorityRankValue(item.priorityRank);
        if ((currentPriorityRank ?? null) === (nextPriorityRank ?? null)) {
            return false;
        }
        this.plannedActivities[idx] = {
            ...item,
            label: normalizedLabel,
            source: 'local',
            priorityRank: nextPriorityRank,
        };
        this.dedupeAndSortPlannedActivities();
        this.savePlannedActivities();
        this.renderPlannedActivityDropdown();
        this.refreshSubActivityOptions();
        return true;
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
            const priorityRank = this.normalizePriorityRankValue(it.priorityRank);
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
        const rank = match ? this.normalizePriorityRankValue(match.priorityRank) : null;
        return Number.isFinite(rank) ? rank : null;
    }
        buildPlannedActivityOptions(extraLabels = []) {
        return globalThis.TimeTrackerInlinePlanDropdownController.buildPlannedActivityOptions.call(this, extraLabels);
    }
        getHangulInitialSearchKey(text) {
        return globalThis.TimeTrackerInlinePlanDropdownController.getHangulInitialSearchKey.call(this, text);
    }
        scoreInlinePlanSearchMatch(label, query) {
        return globalThis.TimeTrackerInlinePlanDropdownController.scoreInlinePlanSearchMatch.call(this, label, query);
    }
        filterInlinePlanSearchItems(items, query) {
        return globalThis.TimeTrackerInlinePlanDropdownController.filterInlinePlanSearchItems.call(this, items, query);
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
        const activeSource = this.getActivePlanSource();
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
        return globalThis.TimeTrackerInlinePlanDropdownController.resolveInlinePlanAnchor.call(this, anchorEl, fallbackIndex);
    }
        canInlineWheelScroll(targetEl, boundaryEl, deltaY) {
        return globalThis.TimeTrackerInlinePlanDropdownController.canInlineWheelScroll.call(this, targetEl, boundaryEl, deltaY);
    }
        handleInlinePlanWheel(event) {
        return globalThis.TimeTrackerInlinePlanDropdownController.handleInlinePlanWheel.call(this, event);
    }
        isInlinePlanMobileInputContext() {
        return globalThis.TimeTrackerInlinePlanDropdownController.isInlinePlanMobileInputContext.call(this);
    }
        shouldAutofocusInlinePlanInput() {
        return globalThis.TimeTrackerInlinePlanDropdownController.shouldAutofocusInlinePlanInput.call(this);
    }
        setupInlinePlanSheetTouchDismiss(dropdown) {
        return globalThis.TimeTrackerInlinePlanDropdownController.setupInlinePlanSheetTouchDismiss.call(this, dropdown);
    }
        cleanupInlinePlanSheetTouchDismiss() {
        return globalThis.TimeTrackerInlinePlanDropdownController.cleanupInlinePlanSheetTouchDismiss.call(this);
    }
        scheduleInlinePlanInputVisibilitySync(inputEl) {
        return globalThis.TimeTrackerInlinePlanDropdownController.scheduleInlinePlanInputVisibilitySync.call(this, inputEl);
    }
        scheduleInlinePlanViewportSync() {
        return globalThis.TimeTrackerInlinePlanDropdownController.scheduleInlinePlanViewportSync.call(this);
    }
        getInlinePlanViewportMetrics() {
        return globalThis.TimeTrackerInlinePlanDropdownController.getInlinePlanViewportMetrics.call(this);
    }
        getInlinePlanMinimumInteractiveHeight(dropdown = this.inlinePlanDropdown) {
        return globalThis.TimeTrackerInlinePlanDropdownController.getInlinePlanMinimumInteractiveHeight.call(this, dropdown);
    }
        ensureInlinePlanInputVisible(inputEl) {
        return globalThis.TimeTrackerInlinePlanDropdownController.ensureInlinePlanInputVisible.call(this, inputEl);
    }
        isInlinePlanInputFocused() {
        return globalThis.TimeTrackerInlinePlanDropdownController.isInlinePlanInputFocused.call(this);
    }
        markInlinePlanInputIntent(durationMs = 420) {
        return globalThis.TimeTrackerInlinePlanDropdownController.markInlinePlanInputIntent.call(this, durationMs);
    }
        hasRecentInlinePlanInputIntent() {
        return globalThis.TimeTrackerInlinePlanDropdownController.hasRecentInlinePlanInputIntent.call(this);
    }
        positionInlinePlanDropdown(anchorEl) {
        return globalThis.TimeTrackerInlinePlanDropdownController.positionInlinePlanDropdown.call(this, anchorEl);
    }
        renderInlinePlanDropdownOptions() {
        return globalThis.TimeTrackerInlinePlanDropdownController.renderInlinePlanDropdownOptions.call(this);
    }

        openRoutineMenuFromInlinePlan(label, anchorEl) {
        return globalThis.TimeTrackerInlinePlanDropdownController.openRoutineMenuFromInlinePlan.call(this, label, anchorEl);
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
        isSameInlinePlanTarget(range, anchorEl = null) {
        return globalThis.TimeTrackerInlinePlanDropdownController.isSameInlinePlanTarget.call(this, range, anchorEl);
    }

        isEventWithinCurrentInlinePlanRange(targetEl) {
        return globalThis.TimeTrackerInlinePlanDropdownController.isEventWithinCurrentInlinePlanRange.call(this, targetEl);
    }

        openInlinePlanDropdown(index, anchorEl, endIndex = null) {
        return globalThis.TimeTrackerInlinePlanDropdownController.openInlinePlanDropdown.call(this, index, anchorEl, endIndex);
    }
        applyInlinePlanBackgroundContext() {
        return globalThis.TimeTrackerInlinePlanDropdownController.applyInlinePlanBackgroundContext.call(this);
    }
        closeInlinePlanDropdown() {
        return globalThis.TimeTrackerInlinePlanDropdownController.closeInlinePlanDropdown.call(this);
    }
        applyInlinePlanSelection(label, options = {}) {
        return globalThis.TimeTrackerInlinePlanDropdownController.applyInlinePlanSelection.call(this, label, options);
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

            const localPriorityRank = this.normalizePriorityRankValue(item.priorityRank);
            const localRecommended = Number.isFinite(item.recommendedSeconds) ? Math.max(0, Number(item.recommendedSeconds)) : null;
            next.push({ label, source: 'local', priorityRank: localPriorityRank, recommendedSeconds: localRecommended });
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
        return globalThis.TimerController.attachTimerListeners.call(this, entryDiv, index);
    }

        startTimer(index) {
        return globalThis.TimerController.startTimer.call(this, index);
    }

        pauseTimer(index) {
        return globalThis.TimerController.pauseTimer.call(this, index);
    }

        resumeTimer(index) {
        return globalThis.TimerController.resumeTimer.call(this, index);
    }

        stopTimer(index) {
        return globalThis.TimerController.stopTimer.call(this, index);
    }

    stopAllTimers() {
        this.commitRunningTimers({ render: false, calculate: false, autoSave: false });
    }

        commitRunningTimers(options = {}) {
        return globalThis.TimerController.commitRunningTimers.call(this, options);
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
        return globalThis.TimerController.updateRunningTimers.call(this);
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
                if (item.isAutoLocked === false) {
                    normalized.isAutoLocked = false;
                } else if (item.isAutoLocked === true) {
                    normalized.isAutoLocked = true;
                }
                const normalizedLockStart = Number.isFinite(item.lockStart)
                    ? Math.floor(item.lockStart)
                    : null;
                const normalizedLockEnd = Number.isFinite(item.lockEnd)
                    ? Math.floor(item.lockEnd)
                    : null;
                if (normalizedLockStart != null) {
                    normalized.lockStart = normalizedLockStart;
                }
                if (normalizedLockEnd != null) {
                    normalized.lockEnd = normalizedLockEnd;
                }
                if (Array.isArray(item.lockUnits)) {
                    normalized.lockUnits = item.lockUnits
                        .filter((value) => Number.isFinite(value))
                        .map((value) => Math.floor(value));
                }
                return normalized;
            })
            .filter(item => item.label || item.seconds > 0 || item.source === 'locked');
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
                aggregateDuplicates: true,
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
            map.set(label, (map.get(label) || 0) + seconds);
        });
        return map;
    }

    clampActualGridToAssigned() {
        if (!this.modalActualHasPlanUnits) return;
        const planUnits = Array.isArray(this.modalActualPlanUnits) ? this.modalActualPlanUnits : [];
        if (planUnits.length === 0) return;
        const isLockedRow = (item) => item && item.source === 'locked';
        const isManualLocked = (item) => {
            if (typeof this.isManualLockedActivityRow === 'function') {
                return this.isManualLockedActivityRow(item);
            }
            return isLockedRow(item) && item.isAutoLocked === false;
        };
        const normalizeActivities = (raw) => {
            if (typeof this.normalizeActivitiesArray === 'function') {
                return this.normalizeActivitiesArray(raw);
            }
            return Array.isArray(raw) ? raw.map((item) => ({ ...item })) : [];
        };
        const rawGridUnits = Array.isArray(this.modalActualGridUnits)
            ? this.modalActualGridUnits.map(value => Boolean(value))
            : [];
        let gridUnits = this.normalizeActualGridBooleanUnits
            ? this.normalizeActualGridBooleanUnits(rawGridUnits, planUnits.length)
            : rawGridUnits.slice(0, planUnits.length);
        if (gridUnits.length < planUnits.length) {
            gridUnits = gridUnits.concat(new Array(planUnits.length - gridUnits.length).fill(false));
        }
        let changed = rawGridUnits.length !== gridUnits.length
            || rawGridUnits.some((value, idx) => value !== gridUnits[idx]);

        const step = this.getActualDurationStepSeconds();
        const normalizedActivities = normalizeActivities(this.modalActualActivities);
        const normalizeDurationStep = (raw) => {
            const value = Number.isFinite(raw) ? Math.floor(raw) : 0;
            if (typeof this.normalizeActualDurationStep === 'function') {
                return this.normalizeActualDurationStep(value);
            }
            return Math.max(0, value);
        };
        const buildAutoLockRowsFromMask = (mask, options = {}) => {
            const safeMask = Array.isArray(mask) ? mask.map(value => Boolean(value)) : [];
            if (typeof this.rebuildLockedRowsFromUnitSet === 'function') {
                return this.rebuildLockedRowsFromUnitSet(safeMask, options);
            }
            const rows = [];
            const activeUnits = [];
            for (let i = 0; i < safeMask.length; i++) {
                if (safeMask[i]) {
                    activeUnits.push(i);
                }
            }
            if (activeUnits.length <= 0) return rows;
            const first = activeUnits[0];
            const last = activeUnits[activeUnits.length - 1];
            const seconds = normalizeDurationStep(activeUnits.length * step);
            if (options.isAutoLocked) {
                rows.push({
                    label: '',
                    seconds,
                    recordedSeconds: seconds,
                    source: 'locked',
                    isAutoLocked: true,
                    lockStart: first,
                    lockEnd: last,
                    lockUnits: activeUnits.slice(),
                });
            } else {
                let index = 0;
                while (index < safeMask.length) {
                    if (!safeMask[index]) {
                        index += 1;
                        continue;
                    }
                    let end = index;
                    while (end + 1 < safeMask.length && safeMask[end + 1]) {
                        end += 1;
                    }
                    const lockUnits = [];
                    for (let i = index; i <= end; i++) {
                        lockUnits.push(i);
                    }
                    rows.push({
                        label: '',
                        seconds: normalizeDurationStep(lockUnits.length * step),
                        recordedSeconds: normalizeDurationStep(lockUnits.length * step),
                        source: 'locked',
                        isAutoLocked: false,
                        lockStart: index,
                        lockEnd: end,
                        lockUnits,
                    });
                    index = end + 1;
                }
            }
            return rows;
        };
        const manualMask = (typeof this.extractLockedRowsFromActivities === 'function')
            ? this.extractLockedRowsFromActivities(normalizedActivities, planUnits.length).manualMask
            : new Array(planUnits.length).fill(false);
        const manualLockedCount = Array.isArray(manualMask)
            ? manualMask.reduce((sum, value) => sum + (value ? 1 : 0), 0)
            : 0;
        let assignedUnitsTotal = 0;
        (Array.isArray(normalizedActivities) ? normalizedActivities : []).forEach((item) => {
            if (!item || isLockedRow(item)) return;
            const seconds = Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
            if (seconds <= 0) return;
            assignedUnitsTotal += Math.floor(seconds / step);
        });

        const allowedUnitsTotal = Math.max(0, Math.min(planUnits.length, assignedUnitsTotal));
        const totalLockedCount = Math.max(0, planUnits.length - allowedUnitsTotal);
        const autoLockedCount = Math.max(0, totalLockedCount - manualLockedCount);
        let lockedMask = Array.isArray(manualMask)
            ? manualMask.slice(0)
            : new Array(planUnits.length).fill(false);
        if (typeof this.getActualGridLockedUnitsForBase === 'function') {
            lockedMask = this.getActualGridLockedUnitsForBase(
                this.modalActualBaseIndex,
                planUnits,
                normalizedActivities
            );
        } else if (autoLockedCount > 0) {
            let filled = 0;
            for (let i = planUnits.length - 1; i >= 0 && filled < autoLockedCount; i--) {
                if (lockedMask[i]) continue;
                lockedMask[i] = true;
                filled += 1;
            }
        }
        if (!Array.isArray(lockedMask) || lockedMask.length !== planUnits.length) {
            lockedMask = Array.isArray(manualMask)
                ? manualMask.slice(0)
                : new Array(planUnits.length).fill(false);
            let filled = 0;
            for (let i = planUnits.length - 1; i >= 0 && filled < autoLockedCount; i--) {
                if (lockedMask[i]) continue;
                lockedMask[i] = true;
                filled += 1;
            }
        }
        const autoMask = lockedMask.map((isLocked, idx) => Boolean(isLocked && !manualMask[idx]));

        lockedMask.forEach((isLocked, idx) => {
            if (!isLocked || !gridUnits[idx]) return;
            gridUnits[idx] = false;
            changed = true;
        });
        if (autoLockedCount > 0 && !autoMask.some(Boolean)) {
            let filled = 0;
            for (let i = planUnits.length - 1; i >= 0 && filled < autoLockedCount; i--) {
                if (manualMask[i]) continue;
                if (gridUnits[i]) {
                    gridUnits[i] = false;
                    changed = true;
                }
                filled += 1;
            }
        }

        if (changed) {
            this.modalActualGridUnits = gridUnits.slice();
        }

        if (Array.isArray(this.modalActualActivities)) {
            const nonLockedRows = (Array.isArray(normalizedActivities) ? normalizedActivities : []).filter((item) => !isLockedRow(item));
            const manualRows = (Array.isArray(normalizedActivities) ? normalizedActivities : []).filter((item) => isManualLocked(item));
            const autoRows = buildAutoLockRowsFromMask(autoMask, { isAutoLocked: true, allowSegments: false });
            const withManualRows = (typeof this.insertLockedRowsAfterRelatedActivities === 'function')
                ? this.insertLockedRowsAfterRelatedActivities(nonLockedRows, manualRows, planUnits)
                : nonLockedRows.concat(manualRows);
            const nextActivities = withManualRows.concat(autoRows);

            const before = (Array.isArray(this.modalActualActivities) ? this.modalActualActivities : []).length;
            const after = nextActivities.length;
            let activityRowsChanged = before !== after;
            if (!activityRowsChanged) {
                for (let i = 0; i < after; i++) {
                    const prev = this.modalActualActivities[i];
                    const next = nextActivities[i];
                    if (!prev || !next) {
                        activityRowsChanged = true;
                        break;
                    }
                    if (prev.source !== next.source) {
                        activityRowsChanged = true;
                        break;
                    }
                    if (prev.order !== i) {
                        activityRowsChanged = true;
                        break;
                    }
                }
            }

            const hasMissingOrder = nextActivities.some((item, idx) => {
                return !item || item.order !== idx;
            });

            this.modalActualActivities = nextActivities.map((item) => (item && typeof item === 'object' ? { ...item } : item));
            if (activityRowsChanged || hasMissingOrder) {
                this.modalActualActivities.forEach((item, idx) => {
                    if (!item || typeof item !== 'object') return;
                    item.order = idx;
                });
                this.modalActualDirty = true;
            }

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
        const isLockedRow = (item) => {
            if (typeof this.isLockedActivityRow === 'function') {
                return this.isLockedActivityRow(item);
            }
            return Boolean(item && item.source === 'locked');
        };
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
        const existingLockedRows = existing.filter((item) => isLockedRow(item));
        const existingNonLockedRows = existing.filter((item) => !isLockedRow(item));
        const hadExistingActivities = existingNonLockedRows.length > 0;

        let baseList = existingNonLockedRows;
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
            if (isPlanLabel) {
                seenPlanLabels.add(label);
                const plannedSeconds = planAssignedMap.get(label);
                // Keep previously saved assigned seconds; only backfill when empty.
                if (seconds <= 0 && Number.isFinite(plannedSeconds) && plannedSeconds > 0) {
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

        if (!hadExistingActivities) {
            planOrder.forEach((label) => {
                if (!label || seenPlanLabels.has(label)) return;
                const plannedSeconds = planAssignedMap.get(label);
                const seconds = Number.isFinite(plannedSeconds) && plannedSeconds > 0
                    ? plannedSeconds
                    : (gridSecondsMap.get(label) || 0);
                merged.push({ label, seconds, source: 'grid' });
                seenPlanLabels.add(label);
            });
        }

        const mergedWithLocked = (typeof this.insertLockedRowsAfterRelatedActivities === 'function')
            ? this.insertLockedRowsAfterRelatedActivities(merged, existingLockedRows, planUnits)
            : merged.concat(existingLockedRows.map((item) => ({ ...item })));
        return mergedWithLocked;
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
        return globalThis.TimeTrackerActualGridCore.mergeActualActivitiesWithGrid.call(this, ...arguments);
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
            const normalize = (value) => this.normalizeActivityText
                ? this.normalizeActivityText(value || '')
                : String(value || '').trim();
            const planLabelSet = (this.modalActualPlanLabelSet instanceof Set)
                ? this.modalActualPlanLabelSet
                : new Set();
            const gridSecondsMap = this.getActualGridSecondsMap();
            let recorded = 0;
            gridSecondsMap.forEach((seconds) => {
                const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
                recorded += safe;
            });
            (this.modalActualActivities || []).forEach((item) => {
                if (!item) return;
                const label = normalize(item.label || '');
                const isPlanLabel = Boolean(label)
                    && (planLabelSet.has(label) || item.source === 'grid');
                if (isPlanLabel) return;
                const assigned = Number.isFinite(item.seconds) ? Math.max(0, Math.floor(item.seconds)) : 0;
                let rowRecorded = Number.isFinite(item.recordedSeconds)
                    ? Math.max(0, Math.floor(item.recordedSeconds))
                    : assigned;
                if (assigned > 0 && rowRecorded > assigned) rowRecorded = assigned;
                recorded += rowRecorded;
            });
            const unassigned = Math.max(0, total - used);
            noticeEl.textContent = `Assigned ${this.formatDurationSummary(used)} | Recorded ${this.formatDurationSummary(recorded)} | Unassigned ${this.formatDurationSummary(unassigned)}`;
            noticeEl.classList.add('ok');
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
        return globalThis.TimeTrackerActualModalController.isValidActualRow.call(this, index);
    }

    updateActualRowActiveStyles() {
        return globalThis.TimeTrackerActualModalController.updateActualRowActiveStyles.call(this);
    }

    setActualActiveRow(index, options = {}) {
        return globalThis.TimeTrackerActualModalController.setActualActiveRow.call(this, index, options);
    }

    focusActualRowLabel(index) {
        return globalThis.TimeTrackerActualModalController.focusActualRowLabel.call(this, index);
    }

    renderActualActivitiesList() {
        return globalThis.TimeTrackerActualModalController.renderActualActivitiesList.call(this);
    }

    attachActualModalEventHandlers() {
        return globalThis.TimeTrackerActualModalController.attachActualModalEventHandlers.call(this);
    }

    handleActualModalListClick(event) {
        return globalThis.TimeTrackerActualModalController.handleActualModalListClick.call(this, event);
    }

    handleActualModalListChange(event) {
        return globalThis.TimeTrackerActualModalController.handleActualModalListChange.call(this, event);
    }

    handleActualModalListFocusIn(event) {
        return globalThis.TimeTrackerActualModalController.handleActualModalListFocusIn.call(this, event);
    }

    addActualActivityRow(defaults = {}) {
        return globalThis.TimeTrackerActualModalController.addActualActivityRow.call(this, defaults);
    }

    removeActualActivityRow(index) {
        return globalThis.TimeTrackerActualModalController.removeActualActivityRow.call(this, index);
    }

    moveActualActivityRow(index, direction) {
        return globalThis.TimeTrackerActualModalController.moveActualActivityRow.call(this, index, direction);
    }

    applyActualActivityLabelSelection(index, label) {
        return globalThis.TimeTrackerActualModalController.applyActualActivityLabelSelection.call(this, index, label);
    }

    getActualBalanceOrder(index, length) {
        return globalThis.TimeTrackerActualModalController.getActualBalanceOrder.call(this, index, length);
    }

    applyActualDurationChange(index, targetSeconds, options = {}) {
        return globalThis.TimeTrackerActualModalController.applyActualDurationChange.call(this, index, targetSeconds, options);
    }

    balanceActualAssignmentsToTotal(changedIndex = null) {
        return globalThis.TimeTrackerActualModalController.balanceActualAssignmentsToTotal.call(this, changedIndex);
    }

    applyActualGridDurationChange(index, targetSeconds) {
        return globalThis.TimeTrackerActualModalController.applyActualGridDurationChange.call(this, index, targetSeconds);
    }

    adjustActualActivityDuration(index, direction, options = {}) {
        return globalThis.TimeTrackerActualModalController.adjustActualActivityDuration.call(this, index, direction, options);
    }

    adjustActualGridDuration(index, direction) {
        return globalThis.TimeTrackerActualModalController.adjustActualGridDuration.call(this, index, direction);
    }

    updateActualSpinnerDisplays() {
        return globalThis.TimeTrackerActualModalController.updateActualSpinnerDisplays.call(this);
    }

    finalizeActualActivitiesForSave() {
        return globalThis.TimeTrackerActualModalController.finalizeActualActivitiesForSave.call(this);
    }

    openActualActivityMenu(index, anchorEl) {
        return globalThis.TimeTrackerActualModalController.openActualActivityMenu.call(this, index, anchorEl);
    }

    positionActualActivityMenu(anchorEl) {
        return globalThis.TimeTrackerActualModalController.positionActualActivityMenu.call(this, anchorEl);
    }

    closeActualActivityMenu() {
        return globalThis.TimeTrackerActualModalController.closeActualActivityMenu.call(this);
    }

        openActivityLogModal(index) {
        return globalThis.TimeTrackerActualModalController.openActivityLogModal.call(this, index);
    }

        closeActivityLogModal(options = {}) {
        return globalThis.TimeTrackerActualModalController.closeActivityLogModal.call(this, options);
    }

        saveActivityLogFromModal() {
        return globalThis.TimeTrackerActualModalController.saveActivityLogFromModal.call(this);
    }

        attachActivityModalEventListeners() {
        return globalThis.TimeTrackerActualModalController.attachActivityModalEventListeners.call(this);
    }
}

window.TimeTracker = TimeTracker;

window.__ttDebug = {
    ensureTracker() {
        if (!window.tracker && typeof window.TimeTracker === 'function') {
            window.tracker = new window.TimeTracker();
        }
        return window.tracker || null;
    },
    seedRunningTimer(index = 0) {
        const tracker = this.ensureTracker();
        if (!tracker) return null;
        tracker.currentTimeSlotIndex = index;
        tracker.timeSlots[index].planActivities = [{ label: '공부', seconds: 3600 }];
        tracker.timeSlots[index].planTitleBandOn = true;
        tracker.timeSlots[index].activityLog = {
            ...(tracker.timeSlots[index].activityLog || {}),
            title: '샘플', details: '', subActivities: [], titleBandOn: true,
            actualGridUnits: [true, true, false, true, false, true],
            actualExtraGridUnits: [], actualFailedGridUnits: [], actualOverride: false,
        };
        tracker.timeSlots[index].timer = {
            running: true,
            elapsed: 120,
            rawElapsed: 120,
            startTime: Date.now() - 30000,
            method: 'manual',
            status: 'running'
        };
        tracker.renderTimeEntries();
        return tracker.timeSlots[index].timer;
    },
    seedStoppedTimer(index = 0) {
        const tracker = this.ensureTracker();
        if (!tracker) return null;
        tracker.currentTimeSlotIndex = index;
        tracker.timeSlots[index].planActivities = [{ label: '공부', seconds: 3600 }];
        tracker.timeSlots[index].planTitleBandOn = true;
        tracker.timeSlots[index].activityLog = {
            ...(tracker.timeSlots[index].activityLog || {}),
            title: '샘플', details: '', subActivities: [], titleBandOn: true,
            actualGridUnits: [true, true, false, true, false, true],
            actualExtraGridUnits: [], actualFailedGridUnits: [], actualOverride: false,
        };
        tracker.timeSlots[index].timer = {
            running: false,
            elapsed: 180,
            rawElapsed: 180,
            startTime: null,
            method: 'manual',
            status: 'completed'
        };
        tracker.renderTimeEntries();
        return tracker.timeSlots[index].timer;
    }
};
