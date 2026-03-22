const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');

const TELEGRAM_SAFE_CHUNK = 3600;
const DEFAULT_JOB_TIMEOUT_MS = 10 * 60 * 1000;

function parseAllowlist(raw) {
    return String(raw || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
}

function isChatAllowed(chatId, allowlist) {
    if (!allowlist.length) return true;
    return allowlist.includes(String(chatId));
}

function truncateTelegramText(text, limit = TELEGRAM_SAFE_CHUNK) {
    const input = String(text || '').trim();
    if (input.length <= limit) return input;
    if (limit <= 1) return input.slice(0, limit);
    return `${input.slice(0, limit - 1)}…`;
}

function splitTelegramText(text, limit = TELEGRAM_SAFE_CHUNK) {
    const input = String(text || '').trim();
    if (!input) return [''];

    const chunks = [];
    let remaining = input;

    while (remaining.length > limit) {
        const slice = remaining.slice(0, limit);
        let breakAt = slice.lastIndexOf('\n');
        if (breakAt < Math.floor(limit * 0.5)) {
            breakAt = slice.lastIndexOf(' ');
        }
        if (breakAt <= 0) {
            breakAt = limit;
        }
        chunks.push(slice.slice(0, breakAt).trimEnd());
        remaining = remaining.slice(breakAt).trimStart();
    }

    if (remaining) {
        chunks.push(remaining);
    }

    return chunks;
}

function normalizeTelegramCommand(text) {
    const input = String(text || '').trim();
    if (!input) {
        return { command: 'ask', prompt: '' };
    }

    const firstLine = input.split(/\r?\n/, 1)[0];
    const match = /^\/([a-z0-9_]+)(?:@\w+)?(?:\s+([\s\S]*))?$/i.exec(firstLine);
    if (!match) {
        return { command: 'ask', prompt: input };
    }

    const command = match[1].toLowerCase();
    const firstPrompt = String(match[2] || '').trim();
    const rest = input.slice(firstLine.length).trim();
    const prompt = [firstPrompt, rest].filter(Boolean).join('\n').trim();

    return { command, prompt };
}

function buildTaskFromUpdate(update) {
    const message = update?.message || update?.edited_message || update?.channel_post || null;
    if (!message) return null;

    const rawText = String(message.text || message.caption || '').trim();
    if (!rawText) return null;

    const chatId = message?.chat?.id;
    const userId = message?.from?.id || message?.sender_chat?.id || null;
    const username = message?.from?.username || null;
    const displayName =
        [message?.from?.first_name, message?.from?.last_name].filter(Boolean).join(' ').trim() || null;
    const replyToText =
        String(message?.reply_to_message?.text || message?.reply_to_message?.caption || '').trim() || null;
    const chatType = message?.chat?.type || null;

    const normalized = normalizeTelegramCommand(rawText);
    let command = normalized.command;
    if (command === 'start') command = 'help';
    if (!['ask', 'help', 'status', 'cancel'].includes(command)) {
        command = rawText.startsWith('/') ? 'help' : 'ask';
    }

    const prompt = command === 'ask' ? normalized.prompt || rawText : normalized.prompt;

    return {
        chatId,
        userId,
        username,
        displayName,
        chatType,
        command,
        prompt,
        context: {
            messageId: message?.message_id || null,
            replyToMessageId: message?.reply_to_message?.message_id || null,
            replyToText,
            rawText,
        },
    };
}

function getBridgeMode(env) {
    if (String(env.CODEX_APP_URL || env.CODEX_BRIDGE_URL || '').trim()) return 'http';
    if (String(env.CODEX_APP_COMMAND || env.CODEX_BRIDGE_COMMAND || '').trim()) return 'command';
    return 'disabled';
}

function getBridgeTarget(env) {
    return String(env.CODEX_APP_URL || env.CODEX_BRIDGE_URL || '').trim();
}

function getBridgeCommand(env) {
    return String(env.CODEX_APP_COMMAND || env.CODEX_BRIDGE_COMMAND || '').trim();
}

function getJobTimeoutMs(env) {
    const raw = Number(env.CODEX_JOB_TIMEOUT_MS || env.CODEX_BRIDGE_TIMEOUT_MS || DEFAULT_JOB_TIMEOUT_MS);
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_JOB_TIMEOUT_MS;
}

function parseBridgePayload(rawText) {
    const text = String(rawText || '').trim();
    if (!text) return { text: '' };
    try {
        const parsed = JSON.parse(text);
        if (typeof parsed === 'string') {
            return { text: parsed, raw: parsed };
        }
        const derivedText =
            String(parsed.text || parsed.message || parsed.output || parsed.result || '').trim() || text;
        return {
            text: derivedText,
            raw: parsed,
        };
    } catch (_err) {
        return { text, raw: text };
    }
}

async function invokeHttpBridge({ env, fetchImpl, payload, signal }) {
    const url = getBridgeTarget(env);
    if (!url) {
        throw new Error('CODEX_APP_URL or CODEX_BRIDGE_URL is required for HTTP mode');
    }

    const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal,
    });

    const responseText = await response.text();
    if (!response.ok) {
        const detail = responseText ? `: ${truncateTelegramText(responseText, 400)}` : '';
        throw new Error(`Codex bridge HTTP ${response.status}${detail}`);
    }

    return parseBridgePayload(responseText);
}

function invokeCommandBridge({ env, spawnImpl, payload, signal, cwd }) {
    const command = getBridgeCommand(env);
    if (!command) {
        throw new Error('CODEX_APP_COMMAND or CODEX_BRIDGE_COMMAND is required for command mode');
    }

    const timeoutMs = getJobTimeoutMs(env);
    return new Promise((resolve, reject) => {
        const child = spawnImpl(command, {
            cwd,
            env: {
                ...process.env,
                ...env,
            },
            shell: true,
            stdio: ['pipe', 'pipe', 'pipe'],
            signal,
        });

        let stdout = '';
        let stderr = '';
        const timeoutHandle = setTimeout(() => {
            child.kill('SIGTERM');
        }, timeoutMs);

        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString('utf8');
        });

        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString('utf8');
        });

        child.on('error', (err) => {
            clearTimeout(timeoutHandle);
            reject(err);
        });

        child.on('close', (code) => {
            clearTimeout(timeoutHandle);
            if (code !== 0) {
                const detail = stderr ? `: ${truncateTelegramText(stderr, 400)}` : '';
                reject(new Error(`Codex bridge command exited with code ${code}${detail}`));
                return;
            }
            const output = parseBridgePayload(stdout);
            if (!output.text && stderr) {
                output.text = stderr.trim();
            }
            resolve(output);
        });

        child.stdin.end(`${JSON.stringify(payload)}\n`);
    });
}

async function invokeCodexBridge(task, options) {
    const env = options.env || process.env;
    const mode = options.mode || getBridgeMode(env);
    const payload = {
        source: 'telegram',
        task: {
            jobId: task.jobId,
            command: task.command,
            prompt: task.prompt,
            chatId: task.chatId,
            userId: task.userId,
            username: task.username,
            displayName: task.displayName,
            chatType: task.chatType,
            context: task.context,
        },
        repoPath: options.repoPath || env.CODEX_APP_WORKDIR || process.cwd(),
    };

    if (mode === 'http') {
        return invokeHttpBridge({
            env,
            fetchImpl: options.fetchImpl || globalThis.fetch,
            payload,
            signal: options.signal,
        });
    }

    if (mode === 'command') {
        return invokeCommandBridge({
            env,
            spawnImpl: options.spawnImpl || spawn,
            payload,
            signal: options.signal,
            cwd: options.repoPath || env.CODEX_APP_WORKDIR || process.cwd(),
        });
    }

    throw new Error('Codex bridge is not configured');
}

function formatHelpMessage() {
    return [
        'Telegram Codex Bridge',
        '',
        'Commands:',
        '/ask <prompt> - send a task to Codex',
        '/status - show the active or last job',
        '/cancel - stop the active job for this chat',
        '/help - show this help',
        '',
        'Plain text is treated as /ask.',
    ].join('\n');
}

function formatStatusMessage(job) {
    if (!job) {
        return 'No Codex job has run in this chat yet.';
    }

    const started = job.startedAt ? new Date(job.startedAt).toLocaleString() : 'unknown';
    const finished = job.finishedAt ? new Date(job.finishedAt).toLocaleString() : null;
    const durationMs =
        job.startedAt && job.finishedAt ? Math.max(0, job.finishedAt - job.startedAt) : null;
    const durationText = durationMs === null ? 'unknown' : `${Math.round(durationMs / 1000)}s`;

    return [
        `Job: ${job.id}`,
        `Status: ${job.status}`,
        `Command: ${job.task?.command || 'ask'}`,
        `Started: ${started}`,
        finished ? `Finished: ${finished}` : null,
        `Duration: ${durationText}`,
        job.error ? `Error: ${truncateTelegramText(job.error, 400)}` : null,
    ]
        .filter(Boolean)
        .join('\n');
}

function formatSuccessMessage(job, result) {
    const body = String(result?.text || '').trim() || 'Codex job completed with no text output.';
    const duration = job.finishedAt && job.startedAt ? Math.round((job.finishedAt - job.startedAt) / 1000) : 0;
    const header = `Job ${job.id} completed in ${duration}s.`;
    return `${header}\n\n${body}`;
}

function formatFailureMessage(job) {
    const header = `Job ${job.id} failed (${job.status}).`;
    const body = job.error ? truncateTelegramText(job.error, 1000) : 'Unknown error.';
    return `${header}\n\n${body}`;
}

function formatCancelMessage(job, requested = false) {
    if (!job) {
        return 'No active Codex job to cancel.';
    }
    return requested ? `Cancellation requested for job ${job.id}.` : `Cancelled job ${job.id}.`;
}

async function defaultReplyImpl({ env, fetchImpl, chatId, text, replyToMessageId }) {
    const token = String(env.TELEGRAM_BOT_TOKEN || '').trim();
    if (!token) {
        throw new Error('TELEGRAM_BOT_TOKEN is required to send Telegram replies');
    }

    const chunks = splitTelegramText(text, TELEGRAM_SAFE_CHUNK);
    for (const chunk of chunks) {
        const response = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: chunk,
                reply_to_message_id: replyToMessageId || undefined,
            }),
        });

        if (!response.ok) {
            const responseText = await response.text();
            const detail = responseText ? `: ${truncateTelegramText(responseText, 400)}` : '';
            throw new Error(`Telegram sendMessage failed with ${response.status}${detail}`);
        }
    }
}

function createTelegramCodexBridge(options = {}) {
    const env = options.env || process.env;
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    const spawnImpl = options.spawnImpl || spawn;
    const replyImpl = options.replyImpl || defaultReplyImpl;
    const repoPath = options.repoPath || env.CODEX_APP_WORKDIR || process.cwd();
    const allowlist = parseAllowlist(env.TELEGRAM_ALLOWED_CHAT_IDS || env.TELEGRAM_ALLOWED_CHAT_ID);
    const timeoutMs = getJobTimeoutMs(env);

    const jobs = new Map();
    const chatState = new Map();

    function getChatState(chatId) {
        return chatState.get(String(chatId)) || { activeJobId: null, lastJobId: null };
    }

    function getJob(jobId) {
        return jobs.get(String(jobId)) || null;
    }

    function listJobs() {
        return Array.from(jobs.values());
    }

    function getVisibleJob(chatId) {
        const state = getChatState(chatId);
        const activeJob = state.activeJobId ? getJob(state.activeJobId) : null;
        if (activeJob) return activeJob;
        return state.lastJobId ? getJob(state.lastJobId) : null;
    }

    async function sendReply(chatId, text, extra = {}) {
        return replyImpl({
            env,
            fetchImpl,
            chatId,
            text,
            replyToMessageId: extra.replyToMessageId || null,
        });
    }

    function markJobComplete(job, status) {
        job.status = status;
        job.finishedAt = Date.now();
        const state = getChatState(job.chatId);
        if (state.activeJobId === job.id) {
            state.activeJobId = null;
        }
        state.lastJobId = job.id;
        chatState.set(String(job.chatId), state);
    }

    function cancelActiveJob(chatId) {
        const state = getChatState(chatId);
        if (!state.activeJobId) return null;
        const job = getJob(state.activeJobId);
        if (!job || job.status !== 'running') return job || null;

        job.status = 'cancelling';
        job.updatedAt = Date.now();
        job.suppressTerminalReply = true;
        job.controller.abort(new Error('cancelled by Telegram user'));
        return job;
    }

    async function runJob(job) {
        job.status = 'running';
        job.updatedAt = Date.now();

        try {
            const result = await invokeCodexBridge(job.task, {
                env,
                fetchImpl,
                spawnImpl,
                signal: job.controller.signal,
                repoPath,
                mode: options.mode,
            });
            markJobComplete(job, 'succeeded');
            job.result = result;
            await sendReply(job.chatId, formatSuccessMessage(job, result), {
                replyToMessageId: job.task.context.replyToMessageId,
            });
        } catch (error) {
            const cancelled = job.controller.signal.aborted || job.status === 'cancelling';
            markJobComplete(job, cancelled ? 'cancelled' : 'failed');
            job.error = error?.message || String(error);
            if (cancelled && job.suppressTerminalReply) {
                return;
            }
            await sendReply(job.chatId, cancelled ? formatCancelMessage(job) : formatFailureMessage(job), {
                replyToMessageId: job.task.context.replyToMessageId,
            });
        } finally {
            job.updatedAt = Date.now();
        }
    }

    async function processUpdate(update) {
        const task = buildTaskFromUpdate(update);
        if (!task || task.chatId === undefined || task.chatId === null) {
            return { handled: false, reason: 'no_task' };
        }

        if (!isChatAllowed(task.chatId, allowlist)) {
            return { handled: false, reason: 'chat_not_allowed' };
        }

        if (task.command === 'help') {
            await sendReply(task.chatId, formatHelpMessage(), {
                replyToMessageId: task.context.replyToMessageId,
            });
            return { handled: true, kind: 'help' };
        }

        if (task.command === 'status') {
            await sendReply(task.chatId, formatStatusMessage(getVisibleJob(task.chatId)), {
                replyToMessageId: task.context.replyToMessageId,
            });
            return { handled: true, kind: 'status' };
        }

        if (task.command === 'cancel') {
            const job = cancelActiveJob(task.chatId);
            await sendReply(task.chatId, formatCancelMessage(job, true), {
                replyToMessageId: task.context.replyToMessageId,
            });
            return { handled: true, kind: 'cancel', jobId: job?.id || null };
        }

        const jobId = randomUUID();
        const job = {
            id: jobId,
            chatId: task.chatId,
            userId: task.userId,
            username: task.username,
            displayName: task.displayName,
            task: {
                ...task,
                jobId,
                repoPath,
            },
            status: 'queued',
            startedAt: Date.now(),
            updatedAt: Date.now(),
            finishedAt: null,
            controller: new AbortController(),
            result: null,
            error: null,
            timeoutMs,
        };

        jobs.set(jobId, job);
        chatState.set(String(task.chatId), {
            activeJobId: jobId,
            lastJobId: jobId,
        });

        await sendReply(
            task.chatId,
            [
                `Job ${jobId.slice(0, 8)} queued.`,
                task.prompt ? truncateTelegramText(task.prompt, 1000) : '(empty prompt)',
            ].join('\n\n'),
            {
                replyToMessageId: task.context.replyToMessageId,
            }
        );

        void runJob(job).catch(async (error) => {
            job.error = error?.message || String(error);
            markJobComplete(job, job.controller.signal.aborted ? 'cancelled' : 'failed');
            await sendReply(task.chatId, formatFailureMessage(job), {
                replyToMessageId: task.context.replyToMessageId,
            });
        });

        return { handled: true, kind: 'ask', jobId };
    }

    return {
        allowlist,
        getBridgeMode: () => getBridgeMode(env),
        getJob,
        getVisibleJob,
        getChatState,
        listJobs,
        cancelActiveJob,
        processUpdate,
        sendReply,
        isConfigured: () =>
            getBridgeMode(env) !== 'disabled' && Boolean(String(env.TELEGRAM_BOT_TOKEN || '').trim()),
    };
}

module.exports = {
    TELEGRAM_SAFE_CHUNK,
    parseAllowlist,
    isChatAllowed,
    truncateTelegramText,
    splitTelegramText,
    normalizeTelegramCommand,
    buildTaskFromUpdate,
    getBridgeMode,
    getBridgeTarget,
    getBridgeCommand,
    getJobTimeoutMs,
    parseBridgePayload,
    invokeCodexBridge,
    formatHelpMessage,
    formatStatusMessage,
    formatSuccessMessage,
    formatFailureMessage,
    formatCancelMessage,
    createTelegramCodexBridge,
};
