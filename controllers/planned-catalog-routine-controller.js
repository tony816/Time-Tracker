(function attachTimeTrackerPlannedCatalogRoutineController(root, factory) {
    const api = factory(root);

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        const existing = (root.TimeTrackerPlannedCatalogRoutineController && typeof root.TimeTrackerPlannedCatalogRoutineController === 'object')
            ? root.TimeTrackerPlannedCatalogRoutineController
            : {};
        root.TimeTrackerPlannedCatalogRoutineController = Object.assign(existing, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildTimeTrackerPlannedCatalogRoutineController(root) {
    function applyPlannedCatalogJson(slotsJson) {
            if (!slotsJson || typeof slotsJson !== 'object') return false;
            const catalog = (slotsJson && typeof slotsJson.catalog === 'object') ? slotsJson.catalog : null;
            const locals = Array.isArray(catalog && catalog.locals) ? catalog.locals : [];
            const normalizedLocals = this.normalizeLocalPlannedCatalogEntries(locals);
            const remoteSignature = this.computePlannedSignature(normalizedLocals);
            if (remoteSignature && remoteSignature === this._lastSupabasePlannedSignature) {
                return false;
            }
    
            const before = JSON.stringify(this.plannedActivities || []);
            const merged = [];
            const seen = new Set();
    
            normalizedLocals.forEach(({ label, priorityRank }) => {
                if (seen.has(label)) return;
                seen.add(label);
                merged.push({ label, source: 'local', priorityRank, recommendedSeconds: null });
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

    async function fetchPlannedCatalogFromSupabase() {
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
                const localEntries = this.getLocalPlannedEntries();
                if (localEntries.length > 0) {
                    this.scheduleSupabasePlannedSave(true);
                }
                return true;
            } catch (e) {
                console.warn('[supabase] planned catalog fetch failed:', e);
                return false;
            }
        }

    function scheduleSupabasePlannedSave(force = false) {
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

    async function savePlannedCatalogToSupabase(force = false) {
            if (!this.supabaseConfigured || !this.supabase) return false;
            const identity = this.getSupabaseIdentity();
            if (!identity) return false;
            const locals = this.getLocalPlannedEntries();
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

    function normalizeRoutinePattern(pattern) {
            const p = String(pattern || '').trim().toLowerCase();
            if (p === 'weekday' || p === 'weekdays') return 'weekday';
            if (p === 'weekend' || p === 'weekends') return 'weekend';
            return 'daily';
        }

    function getRoutinePatternLabel(pattern) {
            const p = this.normalizeRoutinePattern(pattern);
            if (p === 'weekday') return '평일';
            if (p === 'weekend') return '주말';
            return '매일';
        }

    function createRoutineId() {
            try {
                if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                    return crypto.randomUUID();
                }
            } catch (_) {}
            return `routine_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        }

    function normalizeRoutineItems(items) {
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

    function computeRoutineSignature(items) {
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

    function applyRoutinesJson(slotsJson) {
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

    function applyRoutinesFromRow(row) {
            if (!row || typeof row !== 'object') return false;
            const slots = row.slots || {};
            return this.applyRoutinesJson(slots);
        }

    async function fetchRoutinesFromSupabase() {
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

    function scheduleSupabaseRoutineSave(force = false) {
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

    async function saveRoutinesToSupabase(force = false) {
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

    function getLocalDateParts(date) {
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

    function getDateValue(date) {
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

    function compareDateStrings(a, b) {
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

    function formatDateFromMsLocal(ms) {
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

    function getTodayLocalDateString() {
            const dateCore = (typeof globalThis !== 'undefined' && globalThis.TimeTrackerDateCore)
                ? globalThis.TimeTrackerDateCore
                : null;
            if (dateCore && typeof dateCore.getTodayLocalDateString === 'function') {
                return dateCore.getTodayLocalDateString();
            }
            return this.formatDateFromMsLocal(Date.now());
        }

    function getLocalSlotStartMs(date, hour) {
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

    function getDayOfWeek(date) {
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

    function withTemporarySlots(timeSlots, mergedFieldsMap, fn) {
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

    function applySlotsJsonToContext(slotsJson, timeSlots, mergedFieldsMap) {
            return this.withTemporarySlots(timeSlots, mergedFieldsMap, () => this.applySlotsJson(slotsJson));
        }

    function buildSlotsJsonForContext(timeSlots, mergedFieldsMap) {
            return this.withTemporarySlots(timeSlots, mergedFieldsMap, () => this.buildSlotsJson());
        }

    function findMergeKeyInMap(mergedFieldsMap, type, index) {
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

    function routineIncludesHour(routine, hour) {
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

    function findRoutineForLabelAtIndex(label, index, date = null) {
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

    function findActiveRoutineForLabelAtIndex(label, index, date = null) {
            const targetDate = date || this.currentDate;
            const routine = this.findRoutineForLabelAtIndex(label, index, targetDate);
            if (!routine) return null;
            if (!this.isRoutineActiveOnDate(routine, targetDate)) return null;
            return routine;
        }

    function findRoutineForLabelAndWindow(label, startHour, durationHours) {
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

    function isRoutineActiveOnDate(routine, date) {
            if (!routine || typeof routine !== 'object') return false;
            const passes = Array.isArray(routine.passDates) ? routine.passDates : [];
            if (passes.includes(date)) return false;
            const dow = this.getDayOfWeek(date);
            const pattern = this.normalizeRoutinePattern(routine.pattern);
            if (pattern === 'weekday') return dow >= 1 && dow <= 5;
            if (pattern === 'weekend') return dow === 0 || dow === 6;
            return true;
        }

    function isRoutineStoppedAtSlot(routine, date, hour) {
            if (!Number.isFinite(routine && routine.stoppedAtMs)) return false;
            const slotStartMs = this.getLocalSlotStartMs(date, hour);
            return slotStartMs != null && slotStartMs >= routine.stoppedAtMs;
        }

    function isRoutineStoppedForDate(routine, date) {
            if (!Number.isFinite(routine && routine.stoppedAtMs)) return false;
            const stopDate = this.formatDateFromMsLocal(routine.stoppedAtMs);
            if (!stopDate) return false;
            return this.compareDateStrings(date, stopDate) >= 0;
        }

    function isRoutineActiveAtSlot(routine, date, hour) {
            if (this.isRoutineStoppedForDate(routine, date)) return false;
            if (!this.isRoutineActiveOnDate(routine, date)) return false;
            return !this.isRoutineStoppedAtSlot(routine, date, hour);
        }

    function isRoutinePresentOnDate(routine) {
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

    function getRoutineForPlannedIndex(index, date = null) {
            if (!Number.isInteger(index) || index < 0 || index >= this.timeSlots.length) return null;
            const plannedLabel = this.getPlannedValueForIndex(index);
            if (!plannedLabel) return null;
            const targetDate = date || this.currentDate;
            return this.findActiveRoutineForLabelAtIndex(plannedLabel, index, targetDate);
        }

    function isPlanSlotEmptyForRoutine(index) {
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

    function isPlanSlotEmptyForInline(index) {
            if (!Number.isInteger(index) || index < 0 || index >= this.timeSlots.length) return false;
            const planned = this.getPlannedValueForIndex(index);
            const slot = this.timeSlots[index];
            const planTitle = this.normalizeActivityText
                ? this.normalizeActivityText((slot && slot.planTitle) || '')
                : String((slot && slot.planTitle) || '').trim();
            const planActivities = this.normalizePlanActivitiesArray(slot && slot.planActivities);
            return !planned && !planTitle && planActivities.length === 0;
        }

    function applyRoutinesToDate(date, options = {}) {
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

    function updateRoutineItem(id, patch = {}) {
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

    function upsertRoutineByWindow(label, startHour, durationHours, patch = {}) {
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

    function getInlineTargetRange() {
            if (!this.inlinePlanTarget) return null;
            const safeStart = Number.isInteger(this.inlinePlanTarget.startIndex) ? this.inlinePlanTarget.startIndex : 0;
            const safeEnd = Number.isInteger(this.inlinePlanTarget.endIndex) ? this.inlinePlanTarget.endIndex : safeStart;
            const startIndex = Math.min(safeStart, safeEnd);
            const endIndex = Math.max(safeStart, safeEnd);
            return { startIndex, endIndex };
        }

    function getRoutineWindowFromRange(startIndex, endIndex) {
            if (!Number.isInteger(startIndex) || !Number.isInteger(endIndex)) return null;
            const startSlot = this.timeSlots[startIndex];
            const endSlot = this.timeSlots[endIndex];
            if (!startSlot || !endSlot) return null;
            const startHour = this.labelToHour(startSlot.time);
            const durationHours = Math.max(1, endIndex - startIndex + 1);
            return { startHour, durationHours };
        }

    function passRoutineForDate(routineId, date) {
            const d = String(date || '').trim();
            if (!d) return false;
            const routine = (this.routines || []).find(r => r && r.id === routineId);
            if (!routine) return false;
            const passes = Array.isArray(routine.passDates) ? routine.passDates.slice() : [];
            if (!passes.includes(d)) passes.push(d);
            passes.sort((a, b) => a.localeCompare(b));
            return this.updateRoutineItem(routineId, { passDates: passes });
        }

    function clearRoutinePassForDate(routineId, date) {
            const d = String(date || '').trim();
            if (!d) return false;
            const routine = (this.routines || []).find(r => r && r.id === routineId);
            if (!routine) return false;
            const passes = Array.isArray(routine.passDates) ? routine.passDates.filter(x => x !== d) : [];
            return this.updateRoutineItem(routineId, { passDates: passes });
        }

    function clearRoutineRangeForDate(routine, date, options = {}) {
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

    function clearRoutineFromLocalStorageFutureDates(routine, fromDate) {
            // local storage disabled
        }

    async function clearRoutineFromSupabaseFutureDates(routine, fromDate) {
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

    function ensureRoutinesAvailableOrNotify() {
            if (this.supabaseConfigured && this.supabase && this.getSupabaseIdentity()) return true;
            this.showNotification('루틴 기능은 Google 로그인 후 사용할 수 있습니다.');
            return false;
        }

    return {
        applyPlannedCatalogJson,
        fetchPlannedCatalogFromSupabase,
        scheduleSupabasePlannedSave,
        savePlannedCatalogToSupabase,
        normalizeRoutinePattern,
        getRoutinePatternLabel,
        createRoutineId,
        normalizeRoutineItems,
        computeRoutineSignature,
        applyRoutinesJson,
        applyRoutinesFromRow,
        fetchRoutinesFromSupabase,
        scheduleSupabaseRoutineSave,
        saveRoutinesToSupabase,
        getLocalDateParts,
        getDateValue,
        compareDateStrings,
        formatDateFromMsLocal,
        getTodayLocalDateString,
        getLocalSlotStartMs,
        getDayOfWeek,
        withTemporarySlots,
        applySlotsJsonToContext,
        buildSlotsJsonForContext,
        findMergeKeyInMap,
        routineIncludesHour,
        findRoutineForLabelAtIndex,
        findActiveRoutineForLabelAtIndex,
        findRoutineForLabelAndWindow,
        isRoutineActiveOnDate,
        isRoutineStoppedAtSlot,
        isRoutineStoppedForDate,
        isRoutineActiveAtSlot,
        isRoutinePresentOnDate,
        getRoutineForPlannedIndex,
        isPlanSlotEmptyForRoutine,
        isPlanSlotEmptyForInline,
        applyRoutinesToDate,
        updateRoutineItem,
        upsertRoutineByWindow,
        getInlineTargetRange,
        getRoutineWindowFromRange,
        passRoutineForDate,
        clearRoutinePassForDate,
        clearRoutineRangeForDate,
        clearRoutineFromLocalStorageFutureDates,
        clearRoutineFromSupabaseFutureDates,
        ensureRoutinesAvailableOrNotify,
    };
});
