const crypto = require('crypto');

const TELEGRAM_MESSAGE_LIMIT = 4096;

function truncateTelegramText(text, maxLength = TELEGRAM_MESSAGE_LIMIT) {
    const value = String(text || '');
    const limit = Math.max(1, Math.floor(Number(maxLength) || TELEGRAM_MESSAGE_LIMIT));
    if (value.length <= limit) return value;
    if (limit === 1) return '…';
    return `${value.slice(0, limit - 1)}…`;
}

function splitTelegramText(text, maxLength = TELEGRAM_MESSAGE_LIMIT) {
    const value = String(text || '');
    const limit = Math.max(1, Math.floor(Number(maxLength) || TELEGRAM_MESSAGE_LIMIT));
    if (value.length <= limit) return [value];

    const chunks = [];
    let remaining = value;
    while (remaining.length > limit) {
        let cut = remaining.lastIndexOf(' ', limit);
        if (cut <= 0) cut = limit;
        chunks.push(remaining.slice(0, cut));
        remaining = remaining.slice(cut).trimStart();
    }
    if (remaining) chunks.push(remaining);
    return chunks;
}

function parseCommandText(text) {
    const rawText = String(text || '').trim();
    if (!rawText) return null;

    const commandMatch = /^\/([a-zA-Z0-9_]+)(?:@\S+)?(?:\s+([\s\S]*))?$/.exec(rawText);
    if (!commandMatch) {
        return {
            command: 'ask',
            prompt: rawText,
        };
    }

    const command = commandMatch[1].toLowerCase();
    if (command !== 'ask') return null;
    return {
        command,
        prompt: String(commandMatch[2] || '').trim(),
    };
}

function buildTaskFromUpdate(update) {
    const message = update?.message || update?.edited_message;
    if (!message || typeof message !== 'object') return null;

    const parsed = parseCommandText(message.text || message.caption || '');
    if (!parsed || !parsed.prompt) return null;

    return {
        command: parsed.command,
        prompt: parsed.prompt,
        chatId: message.chat?.id,
        userId: message.from?.id,
        messageId: message.message_id,
        username: message.from?.username || null,
        firstName: message.from?.first_name || null,
        context: {
            rawText: message.text || message.caption || '',
            replyToText: message.reply_to_message?.text || message.reply_to_message?.caption || '',
            chatType: message.chat?.type || null,
        },
    };
}

function getBridgeMode(env = process.env) {
    if (String(env.CODEX_APP_URL || '').trim()) return 'http';
    if (String(env.CODEX_LOCAL_ENABLED || '').trim() === '1') return 'local';
    return 'disabled';
}

function normalizeBridgeResponseText(rawText) {
    const text = String(rawText || '').trim();
    if (!text) return '';
    try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed.text === 'string') return parsed.text;
        if (parsed && typeof parsed.message === 'string') return parsed.message;
        return JSON.stringify(parsed);
    } catch (_err) {
        return text;
    }
}

function createTelegramCodexBridge(options = {}) {
    const env = options.env || process.env;
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    const replyImpl = options.replyImpl || createTelegramReplyImpl({ env, fetchImpl });
    const jobs = new Map();

    function isConfigured() {
        return Boolean(String(env.TELEGRAM_BOT_TOKEN || '').trim()) && getBridgeMode(env) !== 'disabled';
    }

    function getJob(jobId) {
        return jobs.get(jobId) || null;
    }

    async function reply(chatId, text, extra = {}) {
        const chunks = splitTelegramText(text);
        for (const chunk of chunks) {
            await replyImpl({
                chat_id: chatId,
                text: chunk,
                ...extra,
            });
        }
    }

    async function runHttpBridge(job) {
        const bridgeUrl = String(env.CODEX_APP_URL || '').trim();
        if (!bridgeUrl) throw new Error('CODEX_APP_URL is not configured');
        if (typeof fetchImpl !== 'function') throw new Error('fetch implementation is not available');

        const response = await fetchImpl(bridgeUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                repoPath: options.repoPath || process.cwd(),
                task: job.task,
                prompt: job.task.prompt,
            }),
        });

        const responseText = await response.text();
        if (!response.ok) {
            throw new Error(`Codex bridge failed with HTTP ${response.status}: ${truncateTelegramText(responseText, 800)}`);
        }
        return { text: normalizeBridgeResponseText(responseText) || 'done' };
    }

    async function processJob(job) {
        try {
            job.status = 'running';
            const result = await runHttpBridge(job);
            job.status = 'completed';
            job.result = result;
            job.finishedAt = new Date().toISOString();
            await reply(job.chatId, result.text || 'done');
        } catch (error) {
            job.status = 'failed';
            job.error = error && error.message ? error.message : String(error);
            job.finishedAt = new Date().toISOString();
            await reply(job.chatId, `failed: ${job.error}`);
        }
    }

    async function processUpdate(update) {
        const task = buildTaskFromUpdate(update);
        if (!task) return { handled: false, reason: 'no_task' };

        const jobId = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
        const job = {
            id: jobId,
            chatId: task.chatId,
            task,
            status: 'queued',
            startedAt: new Date().toISOString(),
            finishedAt: null,
            result: null,
            error: null,
        };
        jobs.set(jobId, job);

        await reply(task.chatId, `queued: ${jobId}`);
        setTimeout(() => {
            processJob(job);
        }, 0);

        return {
            handled: true,
            kind: task.command,
            jobId,
        };
    }

    return {
        isConfigured,
        getJob,
        processUpdate,
    };
}

function createTelegramReplyImpl({ env, fetchImpl }) {
    return async function replyTelegram(payload) {
        const token = String(env.TELEGRAM_BOT_TOKEN || '').trim();
        if (!token) return;
        if (typeof fetchImpl !== 'function') throw new Error('fetch implementation is not available');

        const response = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const body = await response.text();
            throw new Error(`Telegram reply failed with HTTP ${response.status}: ${truncateTelegramText(body, 800)}`);
        }
    };
}

module.exports = {
    buildTaskFromUpdate,
    truncateTelegramText,
    splitTelegramText,
    createTelegramCodexBridge,
    getBridgeMode,
};
