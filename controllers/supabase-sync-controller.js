(function attachTimeTrackerSupabaseSyncController(root, factory) {
    const api = factory(root);

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        const existing = (root.TimeTrackerSupabaseSyncController && typeof root.TimeTrackerSupabaseSyncController === 'object')
            ? root.TimeTrackerSupabaseSyncController
            : {};
        root.TimeTrackerSupabaseSyncController = Object.assign(existing, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildTimeTrackerSupabaseSyncController(root) {

function getSupabaseRedirectTo() {
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

function getSupabaseIdentity() {
        const userId = (this.supabaseUser && this.supabaseUser.id) ? String(this.supabaseUser.id).trim() : '';
        return userId || null;
    }

function handleSupabaseIdentityChange(force = false) {
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

function applySupabaseSession(session, opts = {}) {
        const user = session && session.user ? session.user : null;
        const previousId = this.supabaseUser && this.supabaseUser.id;
        const pendingAuthAnalytics = this.getPendingAuthAnalytics();
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
        if ((ev === 'SIGNED_IN' || opts.fromGetSession) && hasUser) {
            let startedByUser = false;
            startedByUser = this.loginIntent === 'google' || (pendingAuthAnalytics && pendingAuthAnalytics.provider === 'google');
            if (startedByUser) {
                this.trackAnalyticsEvent('login_success', {
                    method: 'google',
                    auth_provider: 'google'
                });
                this.showNotification('Google 로그인에 성공했습니다.');
                this.clearPendingAuthAnalytics();
            }
            this.loginIntent = null;
        }
        // 로그아웃 알림: 명시적 SIGNED_OUT 이벤트일 때만
        if (ev === 'SIGNED_OUT' && hadPrev) {
            this.showNotification('로그아웃되었습니다.');
        }
    }

function initSupabaseAuthHandlers() {
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

function loadSupabaseConfig() {
        try {
            const url = (typeof window !== 'undefined' && window.SUPABASE_URL) || null;
            const anon = (typeof window !== 'undefined' && window.SUPABASE_ANON_KEY) || null;
            if (url && anon) return { url: String(url), anonKey: String(anon) };
        } catch(_) {}
        return null;
    }

function getSupabaseAuthStorage() {
        if (this._supabaseAuthStorage) return this._supabaseAuthStorage;
        const bag = new Map();
        this._supabaseAuthStorage = {
            getItem(key) {
                const k = String(key || '');
                return bag.has(k) ? bag.get(k) : null;
            },
            setItem(key, value) {
                bag.set(String(key || ''), String(value || ''));
            },
            removeItem(key) {
                bag.delete(String(key || ''));
            }
        };
        return this._supabaseAuthStorage;
    }

function initSupabaseIntegration() {
        try { if (!(window && window.supabase)) return; } catch(_) { return; }
        const cfg = this.loadSupabaseConfig();
        if (!cfg) return;
        try {
            this.supabase = window.supabase.createClient(cfg.url, cfg.anonKey, {
                auth: {
                    persistSession: false,
                    autoRefreshToken: true,
                    detectSessionInUrl: true,
                    storage: this.getSupabaseAuthStorage()
                }
            });
            this.supabaseConfigured = true;
            this.handleSupabaseIdentityChange(true);
            this.initSupabaseAuthHandlers();
        } catch(e) {
            console.warn('[supabase] init failed:', e);
            this.supabase = null;
            this.supabaseConfigured = false;
        }
    }

function clearSupabaseChannels() {
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

function resubscribeSupabaseRealtime() {
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

async function fetchFromSupabaseForDate(date) {
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

function scheduleSupabaseSave() {
        if (!this.supabaseConfigured || !this.supabase) return;
        if (!navigator.onLine) return;
        const identity = this.getSupabaseIdentity();
        if (!identity) return;
        clearTimeout(this._sbSaveTimer);
        this._sbSaveTimer = setTimeout(() => { try { this.saveToSupabase && this.saveToSupabase(); } catch(_) {} }, 500);
    }

function scheduleSupabaseRetry() {
        clearTimeout(this._sbRetryTimer);
        if (!this._hasPendingRemoteSync || !navigator.onLine) return;
        const nextDelay = Number.isFinite(this._sbRetryDelayMs) ? this._sbRetryDelayMs : 2000;
        this._sbRetryTimer = setTimeout(() => {
            this.scheduleSupabaseSave && this.scheduleSupabaseSave();
        }, nextDelay);
        this._sbRetryDelayMs = Math.min(nextDelay * 2, 30000);
    }

function getTimesheetClearPendingKey(date) {
        return String(date || '');
    }

function isTimesheetClearPending(date) {
        const key = this.getTimesheetClearPendingKey(date);
        return key ? this._timesheetClearPending.has(key) : false;
    }

function markTimesheetClearPending(date) {
        const key = this.getTimesheetClearPendingKey(date);
        if (key) this._timesheetClearPending.add(key);
    }

function clearTimesheetClearPending(date) {
        const key = this.getTimesheetClearPendingKey(date);
        if (key) this._timesheetClearPending.delete(key);
    }

async function deleteFromSupabaseForDate(date) {
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

async function saveToSupabase() {
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

async function persistSnapshotForDate(date, snapshotSlots, snapshotMergedObj) {
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
    return Object.freeze({
        getSupabaseRedirectTo,
        getSupabaseIdentity,
        handleSupabaseIdentityChange,
        applySupabaseSession,
        initSupabaseAuthHandlers,
        loadSupabaseConfig,
        getSupabaseAuthStorage,
        initSupabaseIntegration,
        clearSupabaseChannels,
        resubscribeSupabaseRealtime,
        fetchFromSupabaseForDate,
        scheduleSupabaseSave,
        scheduleSupabaseRetry,
        getTimesheetClearPendingKey,
        isTimesheetClearPending,
        markTimesheetClearPending,
        clearTimesheetClearPending,
        deleteFromSupabaseForDate,
        saveToSupabase,
        persistSnapshotForDate
    });
});
