// Minimal Express server to bridge Notion API to the SPA
// - Serves static files (index.html, script.js, styles.css)
// - Provides GET /api/notion/activities to return { activities: [{ id, title }] }

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const { Client } = require('@notionhq/client');
const Database = require('better-sqlite3');

const app = express();
app.use(express.json());

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;
// Prefer SDK default Notion-Version to avoid bad header values from env
const notion = new Client({
    auth: NOTION_API_KEY,
});

// Simple rate-limit aware wrapper (handles 429 Retry-After)
async function withRateLimitRetry(fn, attempt = 0) {
    try {
        return await fn();
    } catch (err) {
        const status = err?.status || err?.code;
        if (status === 429 && attempt < 5) {
            const retryAfterHeader =
                (err?.headers && (err.headers['retry-after'] || err.headers['Retry-After'])) ||
                (typeof err?.headers?.get === 'function' && err.headers.get('retry-after')) ||
                '1';
            const delaySec = Math.max(1, parseInt(retryAfterHeader, 10) || 1);
            await new Promise((r) => setTimeout(r, delaySec * 1000));
            return withRateLimitRetry(fn, attempt + 1);
        }
        throw err;
    }
}

async function fetchAllDatabasePages(database_id) {
    const pages = [];
    let start_cursor;
    do {
        const res = await withRateLimitRetry(() =>
            notion.databases.query({
                database_id,
                start_cursor,
                page_size: 100,
            })
        );
        pages.push(...res.results);
        start_cursor = res.has_more ? res.next_cursor : undefined;
    } while (start_cursor);
    return pages;
}

function extractTitleFromPage(page) {
    const props = page?.properties || {};
    for (const key of Object.keys(props)) {
        const p = props[key];
        if (p?.type === 'title') {
            const arr = p.title || [];
            const title = arr.map((t) => t?.plain_text || '').join('').trim();
            return title;
        }
    }
    return '';
}

// Health check (useful for front-end detection if needed)
app.get('/api/notion/ping', (_req, res) => {
    res.json({ ok: true });
});

// Main API to surface activities to the SPA
app.get('/api/notion/activities', async (_req, res) => {
    try {
        if (!NOTION_API_KEY || !NOTION_DATABASE_ID) {
            return res.status(500).json({ error: 'Notion is not configured on the server' });
        }
        // Basic validation for database id shape (32 hex or UUID with hyphens)
        const dbId = String(NOTION_DATABASE_ID).trim();
        const looksValid = /^(?:[0-9a-fA-F]{32}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/.test(dbId);
        if (!looksValid) {
            return res.status(400).json({ error: 'Invalid NOTION_DATABASE_ID format. Use a 32-hex or hyphenated UUID from the database link.' });
        }
        const pages = await fetchAllDatabasePages(dbId);
        const activities = pages
            .map((p) => ({ id: p.id, title: extractTitleFromPage(p) }))
            .filter((a) => a.title);
        res.json({ activities });
    } catch (e) {
        console.error('[notion] failed to fetch activities:', e);
        // Add a more actionable hint for common 400s
        if (e?.status === 400) {
            return res.status(400).json({ error: 'Failed to load activities (400). Check NOTION_DATABASE_ID and share the DB with the integration.' });
        }
        res.status(500).json({ error: 'Failed to load activities' });
    }
});

// Serve the static SPA from repo root
const staticDir = path.resolve(__dirname);
// Inject runtime config for the SPA (must come before static middleware)
app.get('/config.js', (_req, res) => {
    res
        .type('application/javascript')
        .send(
            `window.SUPABASE_URL=${JSON.stringify(process.env.SUPABASE_URL || '')};\n` +
            `window.SUPABASE_ANON_KEY=${JSON.stringify(process.env.SUPABASE_KEY || '')};\n`
        );
});

app.use(express.static(staticDir));

// Fallback to index.html
app.get('*', (_req, res) => {
    res.sendFile(path.join(staticDir, 'index.html'));
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
    console.log(`[server] Listening on http://localhost:${port}`);
    console.log(`[server] Notion configured: key=${Boolean(NOTION_API_KEY)} db=${NOTION_DATABASE_ID ? '(set)' : '(missing)'}`);
});

// =========================
// SQLite setup (local DB)
// =========================
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
const db = new Database(path.join(dataDir, 'app.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT
);

-- 날짜별 문서를 현재 포맷 그대로 저장: { date, timeSlots, mergedFields }
CREATE TABLE IF NOT EXISTS timesheets (
  id TEXT PRIMARY KEY,          -- user_id||':'||date
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,           -- 'YYYY-MM-DD'
  doc_json TEXT NOT NULL,       -- JSON string (원본 그대로)
  exec_rate REAL,               -- 캐시(선택)
  total_seconds INTEGER,        -- 캐시(선택)
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_timesheets_user_date ON timesheets(user_id, date);

-- 계획 활동 카탈로그(로컬 소스만 저장; Notion은 원천으로 유지)
CREATE TABLE IF NOT EXISTS activity_catalog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'local',   -- 'local' | 'notion'
  external_id TEXT DEFAULT '',            -- Notion page id 등(없으면 빈문자열)
  UNIQUE(title, source, external_id)
);
`);

const DEFAULT_USER = 'default';

function computeStats(doc) {
    try {
        const slots = Array.isArray(doc?.timeSlots) ? doc.timeSlots : [];
        const planned = slots.filter((s) => (s?.planned || '').trim()).length;
        const actual = slots.filter((s) => (s?.actual || '').trim()).length;
        const totalSeconds = slots.reduce((sum, s) => sum + (Number(s?.timer?.elapsed) || 0), 0);
        const execRate = planned > 0 ? Math.round((actual / planned) * 1000) / 10 : null;
        return { execRate, totalSeconds };
    } catch (e) {
        return { execRate: null, totalSeconds: null };
    }
}

// 날짜 문서 저장(업서트)
app.put('/api/timesheets/:date', (req, res) => {
    try {
        const { date } = req.params;
        const doc = req.body; // { date, timeSlots, mergedFields }
        if (!doc || doc.date !== date || !Array.isArray(doc.timeSlots)) {
            return res.status(400).json({ error: 'invalid payload' });
        }
        const { execRate, totalSeconds } = computeStats(doc);
        const id = `${DEFAULT_USER}:${date}`;
        const now = new Date().toISOString();
        const upsert = db.prepare(`
          INSERT INTO timesheets (id, user_id, date, doc_json, exec_rate, total_seconds, created_at, updated_at)
          VALUES (@id, @user_id, @date, @doc_json, @exec_rate, @total_seconds, @now, @now)
          ON CONFLICT(id) DO UPDATE SET
            doc_json=excluded.doc_json,
            exec_rate=excluded.exec_rate,
            total_seconds=excluded.total_seconds,
            updated_at=excluded.updated_at;
        `);
        upsert.run({
            id,
            user_id: DEFAULT_USER,
            date,
            doc_json: JSON.stringify(doc),
            exec_rate: execRate,
            total_seconds: totalSeconds,
            now,
        });
        return res.json({ ok: true });
    } catch (e) {
        console.error('[db] save failed:', e);
        res.status(500).json({ error: 'save failed' });
    }
});

// 날짜 문서 조회
app.get('/api/timesheets/:date', (req, res) => {
    try {
        const { date } = req.params;
        const row = db.prepare(`SELECT doc_json FROM timesheets WHERE user_id=? AND date=?`).get(DEFAULT_USER, date);
        if (!row) return res.status(404).json({ error: 'not found' });
        return res.json(JSON.parse(row.doc_json));
    } catch (e) {
        console.error('[db] load failed:', e);
        res.status(500).json({ error: 'load failed' });
    }
});

// 활동 카탈로그 조회(로컬 소스만)
app.get('/api/activities', (req, res) => {
    try {
        const q = String(req.query?.q || '').trim();
        const stmt = q
            ? db.prepare(`SELECT id,title,source,external_id FROM activity_catalog WHERE source='local' AND title LIKE ? ORDER BY title`)
            : db.prepare(`SELECT id,title,source,external_id FROM activity_catalog WHERE source='local' ORDER BY title`);
        const rows = q ? stmt.all(`%${q}%`) : stmt.all();
        res.json({ activities: rows });
    } catch (e) {
        console.error('[db] list activities failed:', e);
        res.status(500).json({ error: 'list failed' });
    }
});

// 활동 추가(로컬)
app.post('/api/activities', (req, res) => {
    try {
        const title = String(req.body?.title || '').trim();
        if (!title) return res.status(400).json({ error: 'title required' });
        db.prepare(`INSERT OR IGNORE INTO activity_catalog (title, source, external_id) VALUES (?, 'local', '')`).run(title);
        const row = db.prepare(`SELECT id,title,source,external_id FROM activity_catalog WHERE title=? AND source='local'`).get(title);
        res.status(201).json({ activity: row });
    } catch (e) {
        console.error('[db] create activity failed:', e);
        res.status(500).json({ error: 'create failed' });
    }
});

// LocalStorage → DB 일괄 마이그레이션
app.post('/api/migrate', (req, res) => {
    const items = Array.isArray(req.body?.timesheets) ? req.body.timesheets : [];
    const acts = Array.isArray(req.body?.activities) ? req.body.activities : [];
    const tx = db.transaction(() => {
        for (const doc of items) {
            if (!doc?.date || !doc?.timeSlots) continue;
            const { execRate, totalSeconds } = computeStats(doc);
            const id = `${DEFAULT_USER}:${doc.date}`;
            const now = new Date().toISOString();
            db.prepare(`
              INSERT INTO timesheets (id, user_id, date, doc_json, exec_rate, total_seconds, created_at, updated_at)
              VALUES (@id, @user_id, @date, @doc_json, @exec_rate, @total_seconds, @now, @now)
              ON CONFLICT(id) DO UPDATE SET
                doc_json=excluded.doc_json,
                exec_rate=excluded.exec_rate,
                total_seconds=excluded.total_seconds,
                updated_at=excluded.updated_at;
            `).run({
                id,
                user_id: DEFAULT_USER,
                date: doc.date,
                doc_json: JSON.stringify(doc),
                exec_rate: execRate,
                total_seconds: totalSeconds,
                now,
            });
        }
        for (const t of acts) {
            const title = String(t || '').trim();
            if (!title) continue;
            db.prepare(`INSERT OR IGNORE INTO activity_catalog (title, source, external_id) VALUES (?, 'local', '')`).run(title);
        }
    });
    try {
        tx();
        res.json({ ok: true, imported: items.length, activities: acts.length });
    } catch (e) {
        console.error('[db] migration failed:', e);
        res.status(500).json({ error: 'migration failed' });
    }
});
