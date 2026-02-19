function isValidNotionDatabaseId(raw) {
  const dbId = String(raw || '').trim();
  return /^(?:[0-9a-fA-F]{32}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/.test(dbId);
}

function parsePriorityValue(value) {
  if (!value) return null;
  const match = /^Pr\.(\d+)$/.exec(String(value).trim());
  if (!match) return null;
  const rank = Number(match[1]);
  return Number.isFinite(rank) ? rank : null;
}

function extractTitleFromPage(page) {
  const props = page?.properties || {};
  for (const key of Object.keys(props)) {
    const p = props[key];
    if (p?.type === 'title') {
      const arr = p.title || [];
      return arr.map((t) => t?.plain_text || '').join('').trim();
    }
  }
  return '';
}

function extractPriorityRank(page, propertyName = 'Pr') {
  const prop = page?.properties?.[propertyName];
  if (!prop || prop.type !== 'select') return null;
  return parsePriorityValue(prop.select?.name);
}

async function notionQueryDatabase({ apiKey, databaseId, startCursor }) {
  const resp = await fetch('https://api.notion.com/v1/databases/' + databaseId + '/query', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      start_cursor: startCursor,
      page_size: 100,
    }),
  });

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const message = json?.message || `Notion API error (${resp.status})`;
    const err = new Error(message);
    err.status = resp.status;
    err.body = json;
    throw err;
  }
  return json;
}

export async function onRequestGet({ env }) {
  try {
    const apiKey = env.NOTION_API_KEY;
    const databaseId = String(env.NOTION_DATABASE_ID || '').trim();

    if (!apiKey || !databaseId) {
      return new Response(JSON.stringify({ error: 'Notion is not configured on the server' }), {
        status: 500,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      });
    }

    if (!isValidNotionDatabaseId(databaseId)) {
      return new Response(JSON.stringify({ error: 'Invalid NOTION_DATABASE_ID format. Use a 32-hex or UUID value.' }), {
        status: 400,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
      });
    }

    const pages = [];
    let startCursor = undefined;

    do {
      const data = await notionQueryDatabase({ apiKey, databaseId, startCursor });
      pages.push(...(data.results || []));
      startCursor = data.has_more ? data.next_cursor : undefined;
    } while (startCursor);

    const activities = pages
      .map((p) => ({
        id: p.id,
        title: extractTitleFromPage(p),
        priorityRank: extractPriorityRank(p),
      }))
      .filter((a) => a.title);

    return new Response(JSON.stringify({ activities }), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  } catch (e) {
    const status = e?.status || 500;
    const msg = status === 400
      ? 'Failed to load activities (400). Check NOTION_DATABASE_ID and database sharing.'
      : 'Failed to load activities';

    return new Response(JSON.stringify({ error: msg, detail: String(e?.message || e) }), {
      status,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  }
}
