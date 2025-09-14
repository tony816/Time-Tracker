// Minimal Express server to bridge Notion API to the SPA
// - Serves static files (index.html, script.js, styles.css)
// - Provides GET /api/notion/activities to return { activities: [{ id, title }] }

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const { Client } = require('@notionhq/client');

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
// Runtime config injection removed

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
