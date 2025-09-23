class TimeTracker {
    constructor() {
        this.timeSlots = [];
        this.currentDate = new Date().toISOString().split('T')[0];
        this.selectedPlannedFields = new Set();
        this.selectedActualFields = new Set();
        this.isSelectingPlanned = false;
        this.isSelectingActual = false;
        this.dragStartIndex = -1;
        this.currentColumnType = null;
        this.mergeButton = null;
        this.undoButton = null;
        this.mergedFields = new Map(); // {type-startIndex-endIndex: mergedValue}
        this.selectionOverlay = { planned: null, actual: null };
        this.scheduleButton = null;
        this.plannedActivities = [];
        this.modalSelectedActivities = [];
        this.currentPlanSource = 'local';
        this.planTabsContainer = null;
        // Notion integration (optional)
        this.notionEndpoint = this.loadNotionActivitiesEndpoint ? this.loadNotionActivitiesEndpoint() : (function(){
            try { return window.NOTION_ACTIVITIES_ENDPOINT || localStorage.getItem('notion_activities_endpoint') || null; } catch(e){ return null; }
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
        this.supabaseChannels = { timesheet: null, planned: null };
        this.supabaseConfigured = false;
        this._sbSaveTimer = null;
        this.supabaseUser = null;
        this._lastSupabaseIdentity = null;
        this.PLANNED_SENTINEL_DAY = '1970-01-01';
        this._plannedSaveTimer = null;
        this._lastSupabasePlannedSignature = '';
        this.authStatusElement = null;
        this.authButton = null;
        this.deviceId = this.loadOrCreateDeviceId ? this.loadOrCreateDeviceId() : (function(){
            try { const k='device_id'; let v=localStorage.getItem(k); if(v) return v; const arr=crypto.getRandomValues(new Uint8Array(16)); arr[6]=(arr[6]&0x0f)|0x40; arr[8]=(arr[8]&0x3f)|0x80; const hex=Array.from(arr).map(b=>b.toString(16).padStart(2,'0')).join(''); v=`${hex.substring(0,8)}-${hex.substring(8,12)}-${hex.substring(12,16)}-${hex.substring(16,20)}-${hex.substring(20)}`; localStorage.setItem(k,v); return v; } catch(_) { return 'device-anon'; } })();
        this.init();
    }

    init() {
        this.cacheAuthElements();
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

    

    generateTimeSlots() {
        this.timeSlots = [];
        for (let hour = 4; hour <= 23; hour++) {
            this.timeSlots.push({
                time: `${hour}`,
                planned: '',
                actual: '',
                timer: { running: false, elapsed: 0, startTime: null, method: 'manual' },
                activityLog: { title: '', details: '' }
            });
        }
        this.timeSlots.push({
            time: '00',
            planned: '',
            actual: '',
            timer: { running: false, elapsed: 0, startTime: null, method: 'manual' },
            activityLog: { title: '', details: '' }
        });
        this.timeSlots.push({
            time: '1',
            planned: '',
            actual: '',
            timer: { running: false, elapsed: 0, startTime: null, method: 'manual' },
            activityLog: { title: '', details: '' }
        });
        this.timeSlots.push({
            time: '2',
            planned: '',
            actual: '',
            timer: { running: false, elapsed: 0, startTime: null, method: 'manual' },
            activityLog: { title: '', details: '' }
        });
        this.timeSlots.push({
            time: '3',
            planned: '',
            actual: '',
            timer: { running: false, elapsed: 0, startTime: null, method: 'manual' },
            activityLog: { title: '', details: '' }
        });
    }

    renderTimeEntries() {
        const container = document.getElementById('timeEntries');
        container.innerHTML = '';

        this.timeSlots.forEach((slot, index) => {
            const entryDiv = document.createElement('div');
            entryDiv.className = 'time-entry';
            
            const plannedMergeKey = this.findMergeKey('planned', index);
            const actualMergeKey = this.findMergeKey('actual', index);
            
            const plannedContent = plannedMergeKey ? 
                this.createMergedField(plannedMergeKey, 'planned', index, slot.planned) :
                `<input type="text" class="input-field planned-input" 
                        data-index="${index}" 
                        data-type="planned" 
                        value="${slot.planned}"
                        placeholder="" readonly tabindex="-1" style="cursor: default;">`;
                        
            const actualContent = actualMergeKey ? 
                this.createMergedField(actualMergeKey, 'actual', index, slot.actual) :
                this.createTimerField(index, slot);
            
            // 시간 열 병합 확인
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
            
            entryDiv.dataset.index = index;
            
            if (plannedMergeKey) {
                const plannedStart = parseInt(plannedMergeKey.split('-')[1]);
                const plannedEnd = parseInt(plannedMergeKey.split('-')[2]);
                if (index >= plannedStart && index < plannedEnd) {
                    entryDiv.classList.add('has-planned-merge');
                }
            }
            
            if (actualMergeKey) {
                const actualStart = parseInt(actualMergeKey.split('-')[1]);
                const actualEnd = parseInt(actualMergeKey.split('-')[2]);
                if (index >= actualStart && index < actualEnd) {
                    entryDiv.classList.add('has-actual-merge');
                }
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
        this.centerMergedTimeContent();
        // 병합된 실제/계획 입력의 시각적 높이를 병합 범위에 맞게 설정
        this.resizeMergedActualContent();
        this.resizeMergedPlannedContent();
    }

    attachEventListeners() {
        if (this.authButton) {
            this.authButton.addEventListener('click', () => {
                if (!this.supabaseConfigured || !this.supabase) {
                    this.showNotification('Supabase 설정을 먼저 확인해주세요.');
                    return;
                }
                if (this.supabaseUser) {
                    this.supabase.auth.signOut().catch((err) => {
                        console.warn('[auth] sign out failed', err);
                        this.showNotification('로그아웃 중 오류가 발생했습니다.');
                    });
                } else {
                    const options = {};
                    try {
                        if (location && location.protocol && location.protocol.startsWith('http')) {
                            options.redirectTo = location.origin;
                        }
                    } catch (_) {}
                    const params = { provider: 'google' };
                    if (Object.keys(options).length > 0) {
                        params.options = options;
                    }
                    try { localStorage.setItem('login_intent', 'google'); } catch(_) {}
                    this.supabase.auth.signInWithOAuth(params).catch((err) => {
                        console.warn('[auth] sign in failed', err);
                        this.showNotification('Google 로그인에 실패했습니다.');
                    });
                }
            });
        }
        document.getElementById('date').addEventListener('change', (e) => {
            this.currentDate = e.target.value;
            this.loadData();
        });
        // 창 크기 변경 시 병합된 블록들의 시각적 높이를 재계산
        window.addEventListener('resize', () => {
            this.centerMergedTimeContent();
            this.resizeMergedActualContent();
            this.resizeMergedPlannedContent();
        });

        document.getElementById('timeEntries').addEventListener('input', (e) => {
            if (e.target.classList.contains('input-field') && !e.target.classList.contains('timer-result-input')) {
                const index = parseInt(e.target.dataset.index);
                const type = e.target.dataset.type;
                this.timeSlots[index][type] = e.target.value;
                this.calculateTotals();
                this.autoSave();
                // 즉시 저장 한 번 더(큐로 직렬화)
                this.saveNow('actual-input/input').catch(() => {});
            }
        });

        // 수동 저장/불러오기 제거(완전 자동 저장)

        document.getElementById('clearBtn').addEventListener('click', () => {
            if (confirm('모든 데이터를 초기화하시겠습니까?')) {
                this.clearData();
                this.showNotification('데이터가 초기화되었습니다!');
            }
        });

        document.getElementById('prevDayBtn').addEventListener('click', () => {
            this.changeDate(-1);
        });

        document.getElementById('todayBtn').addEventListener('click', () => {
            this.currentDate = new Date().toISOString().split('T')[0];
            this.setCurrentDate();
            this.loadData();
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
                if (toEl && toEl.closest && toEl.closest('.schedule-button')) return;
                this.hideHoverScheduleButton && this.hideHoverScheduleButton();
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
                this.syncTimerElapsedFromActualInput(index, value);
                this.calculateTotals();
                this.autoSave();
                this.saveNow('actual-input/compositionend').catch(() => {});
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
                this.syncTimerElapsedFromActualInput(index, value);
                this.calculateTotals();
                this.autoSave();
                this.saveNow('actual-input/focusout').catch(() => {});
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
                    this.syncTimerElapsedFromActualInput(index, value);
                    this.calculateTotals();
                    this.autoSave();
                    this.saveNow('actual-input/change').catch(() => {});
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
                    this.syncTimerElapsedFromActualInput(index, value);
                    this.calculateTotals();
                    this.autoSave();
                    this.saveNow('actual-input/keyup').catch(() => {});
                } catch (err) {
                    console.error('[actual-input] keyup handler error:', err);
                }
            }
        });

        document.addEventListener('mouseup', () => {
            this.isSelectingPlanned = false;
            this.isSelectingActual = false;
            this.dragStartIndex = -1;
            this.currentColumnType = null;
        });

        window.addEventListener('resize', () => {
            this.updateSelectionOverlay('planned');
            this.updateSelectionOverlay('actual');
            this.hideUndoButton();
            this.centerMergedTimeContent();
            this.hideHoverScheduleButton && this.hideHoverScheduleButton();
        });
        window.addEventListener('scroll', () => {
            this.updateSelectionOverlay('planned');
            this.updateSelectionOverlay('actual');
            this.hideUndoButton();
            this.hideHoverScheduleButton && this.hideHoverScheduleButton();
            this.centerMergedTimeContent();
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
                this.clearAllSelections();
                this.selectMergedRange('planned', mergeKey);
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
                            else { this.clearAllSelections(); this.selectMergedRange('planned', mk); }
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
        let plannedTotal = 0;
        let actualTotal = 0;
        let timerTotal = 0;
        let executedPlans = 0;

        this.timeSlots.forEach(slot => {
            if (slot.planned && slot.planned.trim() !== '') {
                plannedTotal++;
                if (slot.actual && slot.actual.trim() !== '') {
                    executedPlans++;
                }
            }
            if (slot.actual && slot.actual.trim() !== '') {
                actualTotal++;
            }
            if (slot.timer && slot.timer.elapsed > 0) {
                timerTotal += slot.timer.elapsed;
            }
        });

        // 기본 합계 표시
        document.getElementById('totalPlanned').textContent = `${plannedTotal}시간`;
        document.getElementById('totalActual').textContent = `${actualTotal}시간`;

        // 분석 데이터 계산 및 표시
        this.updateAnalysis(plannedTotal, executedPlans, timerTotal);
    }

    updateAnalysis(plannedTotal, executedPlans, timerTotalSeconds) {
        // 실행율 계산
        const executionRate = plannedTotal > 0 ? Math.round((executedPlans / plannedTotal) * 100) : 0;
        const executionRateElement = document.getElementById('executionRate');
        executionRateElement.textContent = `${executionRate}%`;
        
        // 실행율에 따른 색상 변경
        executionRateElement.className = 'analysis-value';
        if (executionRate >= 80) {
            executionRateElement.classList.add('good');
        } else if (executionRate >= 60) {
            executionRateElement.classList.add('warning');
        } else if (executionRate > 0) {
            executionRateElement.classList.add('poor');
        }

        // 타이머 사용 시간 계산
        const timerHours = Math.floor(timerTotalSeconds / 3600);
        const timerMinutes = Math.floor((timerTotalSeconds % 3600) / 60);
        let timerDisplay = '';
        
        if (timerHours > 0) {
            timerDisplay = `${timerHours}시간 ${timerMinutes}분`;
        } else if (timerMinutes > 0) {
            timerDisplay = `${timerMinutes}분`;
        } else if (timerTotalSeconds > 0) {
            timerDisplay = `${timerTotalSeconds}초`;
        } else {
            timerDisplay = '0분';
        }
        
        const timerUsageElement = document.getElementById('timerUsage');
        timerUsageElement.textContent = timerDisplay;
        
        // 타이머 사용 시간에 따른 색상 변경
        timerUsageElement.className = 'analysis-value';
        if (timerTotalSeconds > 0) {
            timerUsageElement.classList.add('good');
        }
    }

    async saveData() {
        const data = {
            date: this.currentDate,
            timeSlots: this.timeSlots,
            mergedFields: Object.fromEntries(this.mergedFields)
        };
        // 로컬 저장
        try {
            localStorage.setItem(`timesheet_${this.currentDate}`, JSON.stringify(data));
        } catch (_) {}
        // 마지막 저장 스냅샷 업데이트(워처 중복 저장 방지)
        try {
            this._lastSavedSignature = JSON.stringify({
                date: this.currentDate,
                timeSlots: this.timeSlots,
                mergedFields: Object.fromEntries(this.mergedFields)
            });
        } catch (_) {}
        // Supabase 동기화 스케줄링(옵션)
        try { this.scheduleSupabaseSave && this.scheduleSupabaseSave(); } catch(_) {}
    }

    async loadData() {
        // 로컬에서 로드
        const savedData = localStorage.getItem(`timesheet_${this.currentDate}`);
        if (savedData) {
            const data = JSON.parse(savedData);
            this.timeSlots = (data.timeSlots || this.timeSlots).map((slot) => {
                // activityLog 구조 정규화 및 legacy 필드(outcome) 제거
                if (!slot.activityLog || typeof slot.activityLog !== 'object') {
                    slot.activityLog = { title: '', details: '' };
                } else {
                    if (typeof slot.activityLog.title !== 'string') {
                        slot.activityLog.title = String(slot.activityLog.title || '');
                    }
                    if (typeof slot.activityLog.details !== 'string') {
                        slot.activityLog.details = String(slot.activityLog.details || '');
                    }
                    if ('outcome' in slot.activityLog) {
                        try { delete slot.activityLog.outcome; } catch (_) { slot.activityLog.outcome = undefined; }
                    }
                }
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

        this.renderTimeEntries();
        this.calculateTotals();
        // Supabase에서 최신 데이터 가져오기(옵션)
        try { this.fetchFromSupabaseForDate && this.fetchFromSupabaseForDate(this.currentDate); } catch(_) {}
    }

    

    // 주기적으로 변경 사항을 감지해 저장 (이벤트 누락 대비)
    startChangeWatcher() {
        if (this._watcher) clearInterval(this._watcher);
        this._watcher = setInterval(() => {
            try {
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
                        }
                    }
                } catch (_) {}

                const sig = JSON.stringify({
                    date: this.currentDate,
                    timeSlots: this.timeSlots,
                    mergedFields: Object.fromEntries(this.mergedFields)
                });
                if (sig !== this._lastSavedSignature) {
                    // 저장 큐로 직렬화되므로 중복 호출은 안전
                    this.saveNow('watcher').catch(() => {});
                }
            } catch (_) {}
        }, 2000);
    }

    

    autoSave() {
        clearTimeout(this.autoSaveTimeout);
        this.autoSaveTimeout = setTimeout(() => {
            this.saveData();
        }, 2000);
    }

    clearData() {
        this.generateTimeSlots();
        this.mergedFields.clear();
        this.renderTimeEntries();
        this.calculateTotals();
        try { localStorage.removeItem(`timesheet_${this.currentDate}`); } catch (_) {}
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
            this._lastSupabaseIdentity = null;
            this.clearSupabaseChannels();
            clearTimeout(this._sbSaveTimer);
            clearTimeout(this._plannedSaveTimer);
            this._lastSupabasePlannedSignature = '';
            return;
        }
        if (force || this._lastSupabaseIdentity !== identity) {
            this._lastSupabaseIdentity = identity;
            this._lastSupabasePlannedSignature = '';
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
            try { startedByUser = !!localStorage.getItem('login_intent'); } catch(_) {}
            if (startedByUser) {
                this.showNotification('Google 로그인에 성공했습니다.');
            }
            try { localStorage.removeItem('login_intent'); } catch(_) {}
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

                    if (plannedValue === '' && actualValue === '' && detailsValue === '') {
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
                    return;
                }

                const hour = this.labelToHour(slot.time);
                const planned = String(slot.planned || '').trim();
                const actual = String(slot.actual || '').trim();
                const details = String((slot.activityLog && slot.activityLog.details) || '').trim();
                if (planned !== '' || actual !== '' || details !== '') {
                    slots[String(hour)] = { planned, actual, details };
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
                                    slot.activityLog = { title: '', details: '' };
                                }
                                const desiredDetails = (i === startIdx) ? detailsValue : '';
                                if (slot.activityLog.details !== desiredDetails) {
                                    slot.activityLog.details = desiredDetails;
                                    changed = true;
                                }
                            }
                            return;
                        }
                    }
                }

                const slot = this.timeSlots[idx];
                if (slot.planned !== plannedValue) { slot.planned = plannedValue; changed = true; }
                if (slot.actual !== actualValue) { slot.actual = actualValue; changed = true; }
                if (!slot.activityLog || typeof slot.activityLog !== 'object') slot.activityLog = { title: '', details: '' };
                if (slot.activityLog.details !== detailsValue) { slot.activityLog.details = detailsValue; changed = true; }
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
            const k = 'device_id';
            let id = localStorage.getItem(k);
            if (id) return id;
            const rnd = crypto && crypto.getRandomValues ? crypto.getRandomValues(new Uint8Array(16)) : Array.from({length:16},()=>Math.floor(Math.random()*256));
            rnd[6] = (rnd[6] & 0x0f) | 0x40;
            rnd[8] = (rnd[8] & 0x3f) | 0x80;
            const hex = Array.from(rnd).map(b=>b.toString(16).padStart(2,'0')).join('');
            id = `${hex.substring(0,8)}-${hex.substring(8,12)}-${hex.substring(12,16)}-${hex.substring(16,20)}-${hex.substring(20)}`;
            localStorage.setItem(k, id);
            return id;
        } catch(_) { return 'device-anon'; }
    }
    loadSupabaseConfig() {
        try {
            const url = (typeof window !== 'undefined' && window.SUPABASE_URL) || localStorage.getItem('supabase_url') || null;
            const anon = (typeof window !== 'undefined' && window.SUPABASE_ANON_KEY) || localStorage.getItem('supabase_anon_key') || null;
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
        this.supabaseChannels = { timesheet: null, planned: null };
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
    }
    async fetchFromSupabaseForDate(date) {
        if (!this.supabaseConfigured || !this.supabase) return false;
        const identity = this.getSupabaseIdentity();
        if (!identity) return false;
        try {
            const { data, error } = await this.supabase
                .from('timesheet_days')
                .select('slots')
                .eq('user_id', identity)
                .eq('day', date)
                .maybeSingle();
            if (error && error.code !== 'PGRST116') throw error; // PGRST116: No rows
            let changed = false;
            if (data && data.slots) {
                changed = this.applySlotsJson(data.slots);
            }
            if (changed) {
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
        const identity = this.getSupabaseIdentity();
        if (!identity) return;
        clearTimeout(this._sbSaveTimer);
        this._sbSaveTimer = setTimeout(() => { try { this.saveToSupabase && this.saveToSupabase(); } catch(_) {} }, 500);
    }
    async saveToSupabase() {
        if (!this.supabaseConfigured || !this.supabase) return false;
        const identity = this.getSupabaseIdentity();
        if (!identity) return false;
        try {
            const payload = {
                user_id: identity,
                day: this.currentDate,
                slots: this.buildSlotsJson(),
                updated_at: new Date().toISOString(),
            };
            const { error } = await this.supabase
                .from('timesheet_days')
                .upsert([payload], { onConflict: 'user_id,day' });
            if (error) throw error;
            return true;
        } catch(e) {
            console.warn('[supabase] upsert failed:', e);
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
            merged.push({ label, source: 'local', priorityRank: null });
        });

        (this.plannedActivities || []).forEach((item) => {
            if (!item) return;
            const label = this.normalizeActivityText(item.label || '');
            if (!label) return;
            if (item.source === 'notion') {
                merged.push({ label, source: 'notion', priorityRank: Number.isFinite(item.priorityRank) ? Number(item.priorityRank) : null });
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

    normalizeActivityLog(slot) {
        try {
            if (!slot || typeof slot !== 'object') return slot;
            if (!slot.activityLog || typeof slot.activityLog !== 'object') {
                slot.activityLog = { title: '', details: '' };
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
            }
        } catch (_) {}
        return slot;
    }

    // 저장소 전체 순회하여 기존 데이터에서 outcome 필드 제거
    purgeOutcomeFromAllStoredData() {
        try {
            const prefix = 'timesheet_';
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith(prefix)) keys.push(k);
            }
            keys.forEach((k) => {
                try {
                    const raw = localStorage.getItem(k);
                    if (!raw) return;
                    const obj = JSON.parse(raw);
                    if (!obj || !Array.isArray(obj.timeSlots)) return;
                    let changed = false;
                    obj.timeSlots = obj.timeSlots.map((slot) => {
                        const before = JSON.stringify(slot && slot.activityLog);
                        const afterSlot = this.normalizeActivityLog(slot);
                        const after = JSON.stringify(afterSlot && afterSlot.activityLog);
                        if (before !== after) changed = true;
                        return afterSlot;
                    });
                    if (changed) {
                        try { localStorage.setItem(k, JSON.stringify(obj)); } catch (_) {}
                    }
                } catch (_) {}
            });
        } catch (_) {}
    }

    changeDate(days) {
        const currentDate = new Date(this.currentDate);
        currentDate.setDate(currentDate.getDate() + days);
        this.currentDate = currentDate.toISOString().split('T')[0];
        this.setCurrentDate();
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
                    this.clearAllSelections();
                    this.selectMergedRange('planned', mergeKey);
                }
            });
        }
        // 우측(실제) 열은 개별 선택/드래그/병합 조작을 제공하지 않음

        let plannedMouseMoved = false;
        if (plannedField) {
            plannedField.addEventListener('mousedown', (e) => {
                if (this.findMergeKey('planned', index)) return;
                if (e.target === plannedField && !plannedField.matches(':focus')) {
                    e.preventDefault();
                    plannedMouseMoved = false;
                    this.dragStartIndex = index;
                    this.currentColumnType = 'planned';
                    this.isSelectingPlanned = true;
                }
            });
            plannedField.addEventListener('mousemove', (e) => {
                if (this.findMergeKey('planned', index)) return;
                if (this.isSelectingPlanned && this.currentColumnType === 'planned') {
                    plannedMouseMoved = true;
                }
            });
            plannedField.addEventListener('mouseup', (e) => {
                if (this.findMergeKey('planned', index)) return;
                if (e.target === plannedField && !plannedField.matches(':focus') && this.currentColumnType === 'planned') {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    if (!plannedMouseMoved) {
                        if (this.selectedPlannedFields.has(index) && this.selectedPlannedFields.size === 1) {
                            this.clearSelection('planned');
                        } else {
                            this.clearAllSelections();
                            this.selectFieldRange('planned', index, index);
                        }
                    } else {
                        if (!e.ctrlKey && !e.metaKey) {
                            this.clearSelection('planned');
                        }
                        this.selectFieldRange('planned', this.dragStartIndex, index);
                    }
                    this.isSelectingPlanned = false;
                    this.currentColumnType = null;
                }
            });
            plannedField.addEventListener('mouseenter', (e) => {
                // 드래그 중이 아닐 때는 선택 유무와 관계없이 (단, 멀티선택/자기 자신은 내부 가드) 호버 버튼 표시
                if (!this.isSelectingPlanned) {
                    this.showScheduleButtonOnHover(index);
                }
                // 병합 셀에서는 드래그 확장 업데이트만 생략
                if (this.findMergeKey('planned', index)) return;
                if (this.isSelectingPlanned && this.currentColumnType === 'planned' && this.dragStartIndex !== index) {
                    plannedMouseMoved = true;
                    if (!e.ctrlKey && !e.metaKey) {
                        this.clearSelection('planned');
                    }
                    this.selectFieldRange('planned', this.dragStartIndex, index);
                }
            });
            plannedField.addEventListener('mouseleave', (e) => {
                const toEl = e.relatedTarget;
                // 1) 스케줄 버튼으로 이동하는 경우 유지
                if (toEl && toEl.closest && toEl.closest('.schedule-button')) return;
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
                            toEl2.closest(`.planned-merged-main-container[data-merge-key="${mk2}"]`)
                        )) return;
                        this.hideHoverScheduleButton();
                    });
                }
            }
        }
        
        // actualField에 대해서는 어떤 드래그 선택 리스너도 추가하지 않음
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
            
            const centerX = startRect.left + (startRect.width / 2);
            const centerY = startRect.top + ((endRect.bottom - startRect.top) / 2);
            
            this.hideUndoButton();
            
            const scrollX = window.scrollX || document.documentElement.scrollLeft || 0;
            const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
            
            this.undoButton = document.createElement('button');
            this.undoButton.className = 'undo-button';
            // 기본 배치(중앙) 후, 스케줄 버튼이 있으면 우측으로 재배치
            this.undoButton.style.left = `${centerX + scrollX - 17}px`;
            this.undoButton.style.top = `${centerY + scrollY - 17}px`;
            
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
        
        this.mergedFields.delete(mergeKey);
        
        // 좌측 계획 열 병합 해제 시 모든 열 동기화 해제
        if (type === 'planned') {
            // 중앙 시간 열과 우측 실제 활동 열 병합도 함께 해제
            const timeRangeKey = `time-${start}-${end}`;
            const actualMergeKey = `actual-${start}-${end}`;
            this.mergedFields.delete(timeRangeKey);
            this.mergedFields.delete(actualMergeKey);
            
            for (let i = start; i <= end; i++) {
                this.timeSlots[i].planned = '';
                this.timeSlots[i].actual = '';
            }
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
                for (let i = startIndex; i <= endIndex; i++) {
                    this.timeSlots[i].planned = i === startIndex ? mergedValue : '';
                    this.timeSlots[i].actual = i === startIndex ? actualMergedValue : '';
                }
            } else {
                // 우측 열만 병합하는 경우
                for (let i = startIndex; i <= endIndex; i++) {
                    this.timeSlots[i].actual = i === startIndex ? mergedValue : '';
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
    
    createTimerField(index, slot) {
        return `<div class="actual-field-container">
                    <input type="text" class="input-field actual-input timer-result-input" 
                           data-index="${index}" 
                           data-type="actual" 
                           value="${slot.actual}"
                           placeholder="활동 기록">
                    <button class="activity-log-btn" data-index="${index}" title="상세 기록">📝</button>
                </div>`;
    }

    createMergedTimeField(mergeKey, index, slot) {
        const [, startStr, endStr] = mergeKey.split('-');
        const start = parseInt(startStr);
        const end = parseInt(endStr);
        
        if (index === start) {
            // 병합된 시간 필드의 주 셀 - 시간 범위 표시 및 단일 타이머 컨트롤
            const timerControls = this.createTimerControls(index, slot);
            
            // 시간 범위 생성 (예: 12 ~ 13 형태)
            const startTime = this.timeSlots[start].time;
            const endTime = this.timeSlots[end].time;
            const timeRangeDisplay = `${startTime} ~ ${endTime}`;
            
            return `<div class="time-slot-container merged-time-main" 
                           data-merge-key="${mergeKey}"
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
                           data-merge-key="${mergeKey}"
                           data-merge-start="${start}"
                           data-merge-end="${end}">
                        <div class="time-label merged-secondary-hidden"></div>
                    </div>`;
        } else {
            // 병합된 시간 필드의 중간 보조 셀 - 완전히 경계선 제거
            return `<div class="time-slot-container merged-time-secondary" 
                           data-merge-key="${mergeKey}"
                           data-merge-start="${start}"
                           data-merge-end="${end}">
                        <div class="time-label merged-secondary-hidden"></div>
                    </div>`;
        }
    }

    createTimerControls(index, slot) {
        // 허용 여부 계산: 병합된 계획/시간 범위 고려
        const currentIndex = this.getCurrentTimeIndex();
        // 시간 병합 범위 확인 (없으면 현재 인덱스 단일 셀 취급)
        let timeStart = index;
        let timeEnd = index;
        const timeMergeKey = this.findMergeKey('time', index);
        if (timeMergeKey) {
            const parts = timeMergeKey.split('-');
            timeStart = parseInt(parts[1], 10);
            timeEnd = parseInt(parts[2], 10);
        }

        // 계획 텍스트 존재 여부: 병합된 계획값을 우선 사용
        let plannedText = '';
        const plannedMergeKeyForIndex = this.findMergeKey('planned', index);
        const plannedMergeKeyForCurrent = (currentIndex >= 0) ? this.findMergeKey('planned', currentIndex) : null;
        if (plannedMergeKeyForIndex) {
            plannedText = (this.mergedFields.get(plannedMergeKeyForIndex) || '').trim();
        } else if (plannedMergeKeyForCurrent) {
            plannedText = (this.mergedFields.get(plannedMergeKeyForCurrent) || '').trim();
        } else {
            plannedText = (slot.planned || '').trim();
        }

        const hasPlannedActivity = plannedText !== '';
        const isCurrentTimeInRange = currentIndex >= timeStart && currentIndex <= timeEnd;
        const canStart = hasPlannedActivity && isCurrentTimeInRange;
        const isRunning = slot.timer.running;
        const hasElapsed = slot.timer.elapsed > 0;

        let buttonIcon = '▶️';
        let buttonAction = 'start';
        let buttonDisabled = !canStart && !isRunning;

        if (isRunning) {
            buttonIcon = '⏸️';
            buttonAction = 'pause';
            buttonDisabled = false;
        } else if (hasElapsed) {
            buttonIcon = '▶️';
            buttonAction = 'resume';
            buttonDisabled = !canStart;
        }

        const stopButtonStyle = isRunning || hasElapsed ? 'display: inline-block;' : 'display: none;';
        const timerDisplayStyle = isRunning || hasElapsed ? 'display: block;' : 'display: none;';
        const timerDisplay = this.formatTime(slot.timer.elapsed);

        return `
            <div class="timer-controls-container ${isRunning ? 'timer-running' : ''}" data-index="${index}">
                <div class="timer-controls">
                    <button class="timer-btn timer-start-pause" 
                            data-index="${index}" 
                            data-action="${buttonAction}"
                            ${buttonDisabled ? 'disabled' : ''}>
                        ${buttonIcon}
                    </button>
                    <button class="timer-btn timer-stop" 
                            data-index="${index}" 
                            data-action="stop"
                            style="${stopButtonStyle}">
                        ⏹️
                    </button>
                </div>
                <div class="timer-display" style="${timerDisplayStyle}">${timerDisplay}</div>
            </div>
        `;
    }
    
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // 텍스트에서 시간값(HH:MM(:SS) 또는 1h/분/초 표기)을 초로 파싱
    // 규칙: 문자열 어디에 있든 "마지막으로 등장한" 시간을 우선 사용
    parseDurationFromText(text) {
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
                if (mm < 60 && ss < 60) return h * 3600 + mm * 60 + ss;
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
            return hh * 3600 + mm * 60 + ss;
        }

        // 3) 단일 숫자 + 분/초 토큰 (문자열 내 어디든)
        const onlyMin = Array.from(t.matchAll(/(\d+)\s*(분|m|min)/gi)).pop();
        if (onlyMin) return parseInt(onlyMin[1], 10) * 60;
        const onlySec = Array.from(t.matchAll(/(\d+)\s*(초|s|sec)/gi)).pop();
        if (onlySec) return parseInt(onlySec[1], 10);

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
    
    canStartTimer(index) {
        const slot = this.timeSlots[index];
        const currentTimeIndex = this.getCurrentTimeIndex();
        if (currentTimeIndex < 0) return false;

        // 시간 병합 범위 고려
        let timeStart = index;
        let timeEnd = index;
        const timeMergeKey = this.findMergeKey('time', index);
        if (timeMergeKey) {
            const parts = timeMergeKey.split('-');
            timeStart = parseInt(parts[1], 10);
            timeEnd = parseInt(parts[2], 10);
        }

        // 계획 텍스트 존재 여부: 병합된 계획값 포함해서 판단
        let plannedText = '';
        const plannedMergeKeyForIndex = this.findMergeKey('planned', index);
        const plannedMergeKeyForCurrent = this.findMergeKey('planned', currentTimeIndex);
        if (plannedMergeKeyForIndex) {
            plannedText = (this.mergedFields.get(plannedMergeKeyForIndex) || '').trim();
        } else if (plannedMergeKeyForCurrent) {
            plannedText = (this.mergedFields.get(plannedMergeKeyForCurrent) || '').trim();
        } else {
            plannedText = (slot.planned || '').trim();
        }

        const hasPlannedActivity = plannedText !== '';
        const isCurrentInRange = currentTimeIndex >= timeStart && currentTimeIndex <= timeEnd;
        return hasPlannedActivity && isCurrentInRange;
    }
    
    createMergedField(mergeKey, type, index, value) {
        const [, startStr, endStr] = mergeKey.split('-');
        const start = parseInt(startStr);
        const end = parseInt(endStr);
        
        if (type === 'actual') {
            // 우측 실제 활동 열의 경우 입력 필드와 버튼을 포함하는 컨테이너로 처리
            if (index === start) {
                return `<div class="actual-field-container merged-actual-main" 
                               data-merge-key="${mergeKey}"
                               data-merge-start="${start}"
                               data-merge-end="${end}">
                            <div class="actual-merged-overlay">
                                <input type="text" class="input-field actual-input timer-result-input merged-field" 
                                       data-index="${index}" 
                                       data-type="actual" 
                                       data-merge-key="${mergeKey}"
                                       value="${this.mergedFields.get(mergeKey)}"
                                       placeholder="활동 기록">
                                <button class="activity-log-btn" data-index="${index}" title="상세 기록">📝</button>
                            </div>
                        </div>`;
            } else {
                const isLast = index === end;
                return `<div class="actual-field-container merged-actual-secondary ${isLast ? 'merged-actual-last' : ''}" 
                               data-merge-key="${mergeKey}"
                               data-merge-start="${start}"
                               data-merge-end="${end}">
                            <input type="text" class="input-field actual-input merged-secondary" 
                                   data-index="${index}" 
                                   data-type="actual" 
                                   data-merge-key="${mergeKey}"
                                   value="${this.mergedFields.get(mergeKey)}"
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
                               data-merge-key="${mergeKey}"
                               data-merge-start="${start}"
                               data-merge-end="${end}">
                            <div class="planned-merged-overlay">
                                <input type="text" class="input-field ${type}-input merged-field merged-main" 
                                       data-index="${index}" 
                                       data-type="${type}" 
                                       data-merge-key="${mergeKey}"
                                       data-merge-start="${start}"
                                       data-merge-end="${end}"
                                       value="${this.mergedFields.get(mergeKey)}"
                                       placeholder="" readonly tabindex="-1" style="cursor: default;">
                            </div>
                        </div>`;
            } else {
                const isLast = index === end;
                return `<input type="text" class="input-field ${type}-input merged-secondary ${isLast ? 'merged-planned-last' : ''}" 
                               data-index="${index}" 
                               data-type="${type}" 
                               data-merge-key="${mergeKey}"
                               data-merge-start="${start}"
                               data-merge-end="${end}"
                               value="${this.mergedFields.get(mergeKey)}"
                               readonly
                               tabindex="-1"
                               style="cursor: default;"
                               placeholder="">`;
            }
        }
    }

    // 병합된 시간열의 컨텐츠(레이블+버튼)를 병합 블록의 세로 중앙으로 이동
    centerMergedTimeContent() {
        try {
            const mains = document.querySelectorAll('.time-slot-container.merged-time-main');
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
                    const row = document.querySelector(`.time-entry[data-index="${i}"]`);
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

    resizeMergedActualContent() {
        try {
            const mains = document.querySelectorAll('.actual-field-container.merged-actual-main');
            mains.forEach((main) => {
                const input = main.querySelector('.timer-result-input');
                if (!input) return;

                const start = parseInt(main.getAttribute('data-merge-start'), 10);
                const end = parseInt(main.getAttribute('data-merge-end'), 10);
                // 각 행 높이의 합으로 블록 높이 계산
                let totalHeight = 0;
                for (let i = start; i <= end; i++) {
                    const row = document.querySelector(`.time-entry[data-index="${i}"]`);
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
            });
        } catch (e) {
            // ignore
        }
    }

    resizeMergedPlannedContent() {
        try {
            const mains = document.querySelectorAll('.planned-merged-main-container');
            if (!mains || mains.length === 0) return;

            mains.forEach((main) => {
                const start = parseInt(main.getAttribute('data-merge-start'), 10);
                const end = parseInt(main.getAttribute('data-merge-end'), 10);
                // 각 행 높이의 합으로 블록 높이 계산
                let totalHeight = 0;
                for (let i = start; i <= end; i++) {
                    const row = document.querySelector(`.time-entry[data-index="${i}"]`);
                    if (!row) continue;
                    const r = row.getBoundingClientRect();
                    totalHeight += (r.bottom - r.top);
                }
                if (totalHeight <= 0) return;
                main.style.setProperty('--merged-planned-block-height', `${totalHeight}px`);
            });
        } catch (e) {
            // ignore
        }
    }

    // (의도 변경) 좌측 계획 입력은 모달로만 편집하며
    // 인풋 필드는 표시/선택 용도로만 사용합니다.

    selectMergedRange(type, mergeKey) {
        if (type !== 'planned') return; // 우측 열 병합 범위 선택 금지
        const [, startStr, endStr] = mergeKey.split('-');
        const start = parseInt(startStr);
        const end = parseInt(endStr);
        
        this.clearSelection(type);
        
        const selectedSet = type === 'planned' ? this.selectedPlannedFields : this.selectedActualFields;
        
        for (let i = start; i <= end; i++) {
            selectedSet.add(i);
            // 선택 시각 효과는 공통 오버레이로 대체
        }
        
        this.updateSelectionOverlay(type);
        // Undo 버튼은 좌측(계획) 열에서만 제공
        if (type === 'planned') {
            this.showUndoButton(type, mergeKey);
        } else {
            this.hideUndoButton();
        }
        this.showScheduleButtonForSelection(type);
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
            
            this.openScheduleModal(type, firstIndex, lastIndex);
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
        // 멀티 선택 중(병합 후보)에는 스케줄 버튼을 표시하지 않음
        if (this.selectedPlannedFields && this.selectedPlannedFields.size > 1) {
            const indices = Array.from(this.selectedPlannedFields).sort((a,b)=>a-b);
            const firstIndex = indices[0];
            const mk = this.findMergeKey('planned', firstIndex);
            const isMergedSelection = mk ? this.isMergeRangeSelected('planned', mk) : false;
            if (!isMergedSelection) return; // 병합 후보(아직 병합 아님)일 때만 차단
        }
        // 선택 중인 셀 자체에는 오버레이 내부 버튼이 있으므로 중복 표시하지 않음
        if (this.selectedPlannedFields && this.selectedPlannedFields.size > 0 && this.selectedPlannedFields.has(index)) return;

        const field = document.querySelector(`[data-index="${index}"] .planned-input`);
        if (!field) return;
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
                this.openScheduleModal('planned', parseInt(s,10), parseInt(eIdx,10));
            } else {
                this.openScheduleModal('planned', index, index);
            }
        };

        // 호버 유지: 버튼 위로 올리면 유지, 버튼에서 벗어나면 숨김
        let hideTimer = null;
        const requestHide = () => {
            hideTimer = setTimeout(() => {
                this.hideHoverScheduleButton();
            }, 150);
        };
        btn.addEventListener('mouseleave', requestHide);
        btn.addEventListener('mouseenter', () => { if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; } });

        document.body.appendChild(btn);
        this.scheduleHoverButton = btn;
    }

    hideHoverScheduleButton() {
        if (this.scheduleHoverButton && this.scheduleHoverButton.parentNode) {
            this.scheduleHoverButton.parentNode.removeChild(this.scheduleHoverButton);
            this.scheduleHoverButton = null;
        }
    }

    // 스케줄 버튼 우측으로 병합/되돌리기 버튼 정렬
    repositionButtonsNextToSchedule() {
        if (!this.scheduleButton) return;
        const spacing = 8;
        const sbRect = this.scheduleButton.getBoundingClientRect();
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
    
    openScheduleModal(type, startIndex, endIndex = null) {
        const modal = document.getElementById('scheduleModal');
        const timeField = document.getElementById('scheduleTime');

        const actualEndIndex = endIndex !== null ? endIndex : startIndex;
        const mergeKey = this.findMergeKey(type, startIndex);
        const value = mergeKey ? this.mergedFields.get(mergeKey) : this.timeSlots[startIndex][type];

        // 시간 범위 표시
        const startTime = this.timeSlots[startIndex].time;
        if (actualEndIndex === startIndex) {
            timeField.value = startTime + '시';
        } else {
            const endTime = parseInt(this.timeSlots[actualEndIndex].time);
            const nextHour = endTime === 23 ? 0 : (endTime === 3 ? 4 : endTime + 1);
            timeField.value = `${startTime}시 ~ ${nextHour}시`;
        }

        // 활동 멀티셀렉트 초기화: 기존 값에서 선택 복원
        const parsed = (value || '')
            .split(/[,·]/)
            .map(v => this.normalizeActivityText(v))
            .filter(v => v);
        this.modalSelectedActivities = parsed;
        this.currentPlanSource = 'local';
        this.renderPlannedActivityDropdown();

        // Notion activities (optional): prefetch and merge, then re-render once
        if (this.prefetchNotionActivitiesIfConfigured) {
            this.prefetchNotionActivitiesIfConfigured()
                .then((added) => { if (added) this.renderPlannedActivityDropdown(); })
                .catch(() => {});
        }

        modal.style.display = 'flex';
        
        modal.dataset.type = type;
        modal.dataset.startIndex = startIndex;
        modal.dataset.endIndex = actualEndIndex;
        
        setTimeout(() => {
            const ai = document.getElementById('activityInput');
            if (ai) ai.focus();
        }, 100);
        
        this.hideScheduleButton();
        this.hideHoverScheduleButton && this.hideHoverScheduleButton();
    }
    
    closeScheduleModal() {
        const modal = document.getElementById('scheduleModal');
        modal.style.display = 'none';
        
        document.getElementById('scheduleTime').value = '';
        this.modalSelectedActivities = [];
        const chips = document.getElementById('activityChips');
        const list = document.getElementById('activityOptions');
        if (chips) chips.innerHTML = '';
        if (list) list.innerHTML = '';
        
        delete modal.dataset.type;
        delete modal.dataset.startIndex;
        delete modal.dataset.endIndex;
    }
    
    saveScheduleFromModal() {
        const modal = document.getElementById('scheduleModal');
        const type = modal.dataset.type;
        const startIndex = parseInt(modal.dataset.startIndex);
        const endIndex = parseInt(modal.dataset.endIndex);
        const activity = (this.modalSelectedActivities || []).join(', ').trim();

        if (type && startIndex !== undefined && endIndex !== undefined) {
            if (startIndex === endIndex) {
                // 단일 셀
                this.timeSlots[startIndex][type] = activity;
            } else {
                // 병합된 셀 - 병합 생성 또는 업데이트
                const mergeKey = `${type}-${startIndex}-${endIndex}`;
                this.mergedFields.set(mergeKey, activity);
                
                // 시간대별로 데이터 설정
                for (let i = startIndex; i <= endIndex; i++) {
                    this.timeSlots[i][type] = i === startIndex ? activity : '';
                }
            }
            
            this.renderTimeEntries();
            this.calculateTotals();
            this.autoSave();
        }
        
        this.closeScheduleModal();
    }
    
    attachModalEventListeners() {
        const modal = document.getElementById('scheduleModal');
        const closeBtn = document.getElementById('closeModal');
        const saveBtn = document.getElementById('saveSchedule');
        const cancelBtn = document.getElementById('cancelSchedule');
        const activityInput = document.getElementById('activityInput');
        const addOptionBtn = document.getElementById('addActivityOption');
        const syncBtn = document.getElementById('syncActivityOptions');
        const planTabs = document.getElementById('planTabs');
        this.planTabsContainer = planTabs || null;

        closeBtn.addEventListener('click', () => {
            this.closeScheduleModal();
        });
        
        saveBtn.addEventListener('click', () => {
            this.saveScheduleFromModal();
        });
        
        cancelBtn.addEventListener('click', () => {
            this.closeScheduleModal();
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeScheduleModal();
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display === 'flex') {
                this.closeScheduleModal();
            }
        });

        if (activityInput) {
            activityInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.isComposing) {
                    e.preventDefault();
                    const val = this.normalizeActivityText(activityInput.value);
                    if (val) {
                        this.addPlannedActivityOption(val, true);
                        activityInput.value = '';
                    }
                }
            });
        }
        if (addOptionBtn) {
            addOptionBtn.addEventListener('click', () => {
                const val = activityInput ? this.normalizeActivityText(activityInput.value) : '';
                if (val) {
                    this.addPlannedActivityOption(val, true);
                    activityInput.value = '';
                }
            });
        }
        if (syncBtn) {
            syncBtn.addEventListener('click', async () => {
                if (!this.prefetchNotionActivitiesIfConfigured) return;
                const prev = syncBtn.textContent;
                syncBtn.disabled = true;
                syncBtn.textContent = '동기화 중…';
                try {
                    const added = await this.prefetchNotionActivitiesIfConfigured();
                    if (added) this.renderPlannedActivityDropdown();
                } catch (e) {
                    console.warn('활동 동기화 실패:', e);
                } finally {
                    syncBtn.disabled = false;
                    syncBtn.textContent = prev || '동기화';
                }
            });
        }
        if (planTabs) {
            planTabs.addEventListener('click', (event) => {
                const target = event.target.closest('.plan-tab');
                if (!target || !planTabs.contains(target)) return;
                const source = target.dataset.source === 'notion' ? 'notion' : 'local';
                if (this.currentPlanSource === source) return;
                this.currentPlanSource = source;
                this.renderPlannedActivityDropdown();
            });
        }
    }

    // Planned activities: load/save and render dropdown
    loadPlannedActivities() {
        this.plannedActivities = [];
        try {
            const raw = localStorage.getItem('planned_activities');
            if (!raw) {
                this.dedupeAndSortPlannedActivities();
                return;
            }
            const arr = JSON.parse(raw);
            if (!Array.isArray(arr)) {
                this.dedupeAndSortPlannedActivities();
                return;
            }
            arr.forEach((item) => {
                if (typeof item === 'string') {
                    const label = this.normalizeActivityText(item);
                    if (label) this.plannedActivities.push({ label, source: 'local', priorityRank: null });
                    return;
                }
                if (item && typeof item === 'object') {
                    const label = this.normalizeActivityText(item.label || item.title || '');
                    if (!label) return;
                    const source = item.source === 'notion' ? 'notion' : 'local';
                    const priorityRank = Number.isFinite(item.priorityRank) ? Number(item.priorityRank) : null;
                    this.plannedActivities.push({ label, source, priorityRank });
                }
            });
        } catch (e) {}
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
        try {
            const locals = (this.plannedActivities || [])
                .filter(item => item && item.source !== 'notion')
                .map(item => this.normalizeActivityText(item.label || ''))
                .filter(Boolean);
            localStorage.setItem('planned_activities', JSON.stringify(locals));
            return locals;
        } catch (e) {
            return [];
        }
    }
    addPlannedActivityOption(text, selectAfter = false) {
        const label = this.normalizeActivityText(text);
        if (!label) return;
        const idx = this.findPlannedActivityIndex(label);
        if (idx >= 0) {
            this.plannedActivities[idx] = { label, source: 'local', priorityRank: null };
        } else {
            this.plannedActivities.push({ label, source: 'local', priorityRank: null });
        }
        this.dedupeAndSortPlannedActivities();
        this.savePlannedActivities();
        if (selectAfter) {
            if (!this.modalSelectedActivities.includes(label)) this.modalSelectedActivities.push(label);
        }
        this.renderPlannedActivityDropdown();
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
        }
    }
    toggleSelectActivity(text) {
        const label = this.normalizeActivityText(text);
        if (!label) return;
        const i = this.modalSelectedActivities.indexOf(label);
        if (i >= 0) this.modalSelectedActivities.splice(i, 1);
        else this.modalSelectedActivities.push(label);
        this.renderPlannedActivityDropdown();
    }
    editPlannedActivityOption(oldText, newText) {
        const oldLabel = this.normalizeActivityText(oldText);
        const newLabel = this.normalizeActivityText(newText);
        if (!newLabel || oldLabel === newLabel) return;
        const i = this.findPlannedActivityIndex(oldLabel);
        if (i >= 0) {
            // rename in list (편집 시에는 항상 로컬 항목으로 취급)
            this.plannedActivities[i] = { label: newLabel, source: 'local', priorityRank: null };
            // update selection
            const si = this.modalSelectedActivities.indexOf(oldLabel);
            if (si >= 0) this.modalSelectedActivities[si] = newLabel;
            this.dedupeAndSortPlannedActivities();
            this.savePlannedActivities();
            this.renderPlannedActivityDropdown();
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
            const entry = { label, source, priorityRank };
            const existing = byLabel.get(label);
            let replace = false;
            if (!existing) {
                replace = true;
            } else if (existing.source === 'local' && source !== 'local') {
                replace = false;
            } else if (source === 'local' && existing.source !== 'local') {
                replace = true;
            } else {
                replace = true;
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
            normalized.push({
                id: it.id,
                title: label,
                priorityRank,
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
                this.toggleSelectActivity(text);
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
        const grouped = { local: [], notion: [] };
        const seen = new Set();

        (this.plannedActivities || []).forEach((item) => {
            if (!item) return;
            const label = this.normalizeActivityText(item.label || '');
            if (!label || seen.has(label)) return;
            seen.add(label);
            const source = item.source === 'notion' ? 'notion' : 'local';
            const priorityRank = Number.isFinite(item.priorityRank) ? Number(item.priorityRank) : null;
            grouped[source].push({ label, source, priorityRank });
        });

        normalizedSelections.forEach((label) => {
            if (!label || seen.has(label)) return;
            grouped.local.push({ label, source: 'local', priorityRank: null });
        });

        this.updatePlanSourceTabs({
            local: grouped.local.length,
            notion: grouped.notion.length
        });

        const activeSource = this.currentPlanSource === 'notion' ? 'notion' : 'local';
        const visibleItems = grouped[activeSource] || [];

        if (visibleItems.length === 0) {
            const empty = document.createElement('li');
            empty.className = 'empty-option';
            empty.textContent = activeSource === 'notion'
                ? '노션에서 불러온 활동이 없습니다.'
                : '직접 추가한 활동이 없습니다.';
            empty.dataset.source = activeSource;
            list.appendChild(empty);
            return;
        }

        visibleItems.forEach((item) => {
            const { label, source, priorityRank } = item;
            const li = document.createElement('li');
            li.dataset.source = source;
            if (Number.isFinite(priorityRank)) {
                li.dataset.priorityRank = String(priorityRank);
            } else {
                delete li.dataset.priorityRank;
            }
            const left = document.createElement('div');
            left.style.display = 'flex';
            left.style.alignItems = 'center';
            left.style.gap = '6px';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = selectedSet.has(label);
            cb.onchange = () => this.toggleSelectActivity(label);
            const span = document.createElement('span');
            span.className = 'option-label';
            span.textContent = label;
            left.appendChild(cb);
            const badge = this.makePriorityBadge(priorityRank);
            if (badge) left.appendChild(badge);
            left.appendChild(span);
            li.appendChild(left);
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
    }

    updatePlanSourceTabs(counts = {}) {
        const container = this.planTabsContainer || document.getElementById('planTabs');
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

    // ===== Notion integration (optional) =====
    loadNotionActivitiesEndpoint() {
        try {
            if (typeof window !== 'undefined' && window.NOTION_ACTIVITIES_ENDPOINT) {
                return String(window.NOTION_ACTIVITIES_ENDPOINT);
            }
        } catch (e) {}
        try {
            const v = localStorage.getItem('notion_activities_endpoint');
            return v ? String(v) : null;
        } catch (e) { return null; }
    }
    async prefetchNotionActivitiesIfConfigured() {
        const url = this.notionEndpoint;
        if (!url) return false;

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
            return changed || fetchChanged;
        } catch (e) {
            console.warn('Notion activities fetch failed:', e);
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
            const existing = notionMap.get(label);
            if (!existing || (existing.priorityRank ?? Infinity) > (rank ?? Infinity)) {
                notionMap.set(label, { priorityRank: rank });
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
                    if ((item.priorityRank ?? null) !== rank) changed = true;
                    next.push({ label, source: 'notion', priorityRank: rank });
                    notionMap.delete(label);
                } else {
                    changed = true; // stale notion entry removed
                }
                return;
            }

            next.push({ label, source: 'local', priorityRank: null });
            if (notionMap.has(label)) notionMap.delete(label);
        });

        notionMap.forEach((info, label) => {
            next.push({ label, source: 'notion', priorityRank: info.priorityRank ?? null });
            changed = true;
        });

        this.plannedActivities = next;
        this.dedupeAndSortPlannedActivities();
        if (this.pruneSelectedActivitiesByAvailability()) {
            changed = true;
        }
        return changed;
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #27ae60;
            color: white;
            padding: 15px 20px;
            border-radius: 5px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
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
        if (!this.canStartTimer(index)) return;
        
        // 다른 모든 타이머 정지
        this.stopAllTimers();
        
        const slot = this.timeSlots[index];
        slot.timer.running = true;
        slot.timer.startTime = Date.now();
        slot.timer.method = 'timer';
        
        this.startTimerInterval();
        this.renderTimeEntries();
    }

    pauseTimer(index) {
        const slot = this.timeSlots[index];
        slot.timer.running = false;
        slot.timer.elapsed += Math.floor((Date.now() - slot.timer.startTime) / 1000);
        slot.timer.startTime = null;
        
        this.stopTimerInterval();
        this.renderTimeEntries();
    }

    resumeTimer(index) {
        if (!this.canStartTimer(index)) return;
        
        // 다른 모든 타이머 정지
        this.stopAllTimers();
        
        const slot = this.timeSlots[index];
        slot.timer.running = true;
        slot.timer.startTime = Date.now();
        
        this.startTimerInterval();
        this.renderTimeEntries();
    }

    stopTimer(index) {
        const slot = this.timeSlots[index];
        
        if (slot.timer.running) {
            slot.timer.elapsed += Math.floor((Date.now() - slot.timer.startTime) / 1000);
        }
        
        slot.timer.running = false;
        slot.timer.startTime = null;
        
        // 자동 기록: 타이머 시간을 actual 필드에 기록
        if (slot.timer.elapsed > 0) {
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
        this.timeSlots.forEach((slot, index) => {
            if (slot.timer.running) {
                slot.timer.elapsed += Math.floor((Date.now() - slot.timer.startTime) / 1000);
                slot.timer.running = false;
                slot.timer.startTime = null;
            }
        });
        this.stopTimerInterval();
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

    openActivityLogModal(index) {
        const modal = document.getElementById('activityLogModal');
        const slot = this.timeSlots[index];
        
        document.getElementById('activityTime').value = `${slot.time}시`;
        // '활동 제목' 입력은 이제 우측 실제 칸(시간 기록 표시)을 직접 편집하는 컨텍스트로 사용
        // 병합된 실제 칸인 경우 병합 값, 아니면 개별 slot.actual을 채운다
        const actualMergeKey = this.findMergeKey('actual', index);
        if (actualMergeKey) {
            document.getElementById('activityTitle').value = this.mergedFields.get(actualMergeKey) || '';
        } else {
            document.getElementById('activityTitle').value = slot.actual || '';
        }
        document.getElementById('activityDetails').value = slot.activityLog.details || '';
        
        modal.style.display = 'flex';
        modal.dataset.index = index;
        
        setTimeout(() => {
            document.getElementById('activityTitle').focus();
        }, 100);
    }

    closeActivityLogModal() {
        const modal = document.getElementById('activityLogModal');
        modal.style.display = 'none';
        
        document.getElementById('activityTitle').value = '';
        document.getElementById('activityDetails').value = '';
        
        delete modal.dataset.index;
    }

    saveActivityLogFromModal() {
        const modal = document.getElementById('activityLogModal');
        const index = parseInt(modal.dataset.index);
        
        if (index !== undefined && index >= 0) {
            const slot = this.timeSlots[index];
            // 제목 필드는 이제 실제 칸(우측) 표시 텍스트를 직접 수정하는 용도
            const actualText = document.getElementById('activityTitle').value.trim();
            slot.activityLog.title = actualText; // 기존 구조 유지(로그 용)
            slot.activityLog.details = document.getElementById('activityDetails').value.trim();

            // 실제 칸 업데이트: 병합 상태면 병합 키 전체 반영, 아니면 단일 칸만
            const actualMergeKey = this.findMergeKey('actual', index);
            if (actualMergeKey) {
                const [, startStr, endStr] = actualMergeKey.split('-');
                const start = parseInt(startStr, 10);
                const end = parseInt(endStr, 10);
                this.mergedFields.set(actualMergeKey, actualText);
                for (let i = start; i <= end; i++) {
                    this.timeSlots[i].actual = (i === start) ? actualText : '';
                }
                // 병합 시작 인덱스 기준으로 타이머 경과 동기화
                this.syncTimerElapsedFromActualInput(start, actualText);
            } else {
                slot.actual = actualText;
                // 단일 셀의 경우 해당 인덱스 동기화
                this.syncTimerElapsedFromActualInput(index, actualText);
            }
            
            this.renderTimeEntries();
            this.calculateTotals();
            this.autoSave();
        }
        
        this.closeActivityLogModal();
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
            if (e.key === 'Escape' && modal.style.display === 'flex') {
                this.closeActivityLogModal();
            }
        });
    }
}

const style = document.createElement('style');
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

document.addEventListener('DOMContentLoaded', () => {
    window.tracker = new TimeTracker();
});
