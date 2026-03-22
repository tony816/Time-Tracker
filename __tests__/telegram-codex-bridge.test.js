const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildTaskFromUpdate,
    truncateTelegramText,
    splitTelegramText,
    createTelegramCodexBridge,
} = require('../infra/telegram-codex-bridge');
const { buildPrompt, buildCodexExecArgs, getCodexInvocation } = require('../scripts/codex-bridge');

test('buildTaskFromUpdate treats plain text as ask prompt', () => {
    const task = buildTaskFromUpdate({
        message: {
            message_id: 11,
            chat: { id: 77, type: 'private' },
            from: { id: 55, username: 'alice', first_name: 'Alice' },
            text: 'Summarize this repo',
        },
    });

    assert.equal(task.command, 'ask');
    assert.equal(task.prompt, 'Summarize this repo');
    assert.equal(task.chatId, 77);
    assert.equal(task.userId, 55);
});

test('buildTaskFromUpdate parses /ask command and multiline prompt', () => {
    const task = buildTaskFromUpdate({
        message: {
            message_id: 12,
            chat: { id: 88, type: 'private' },
            from: { id: 66, username: 'bob', first_name: 'Bob' },
            text: '/ask refactor the integration\nkeep the webhook route small',
        },
    });

    assert.equal(task.command, 'ask');
    assert.equal(task.prompt, 'refactor the integration\nkeep the webhook route small');
});

test('truncateTelegramText shortens long messages', () => {
    const text = 'x'.repeat(20);
    assert.equal(truncateTelegramText(text, 10), 'xxxxxxxxx…');
});

test('splitTelegramText chunks long messages', () => {
    const chunks = splitTelegramText('alpha beta gamma delta', 10);
    assert.ok(chunks.length >= 2);
    assert.equal(chunks.join(' '), 'alpha beta gamma delta');
});

test('createTelegramCodexBridge forwards ask prompts to HTTP bridge and replies with result', async () => {
    const replies = [];
    const fetchCalls = [];
    const bridgeUrl = 'https://codex.example/api/run';

    const bridge = createTelegramCodexBridge({
        env: {
            TELEGRAM_BOT_TOKEN: 'token',
            CODEX_APP_URL: bridgeUrl,
        },
        fetchImpl: async (url, options) => {
            fetchCalls.push({ url, options });
            if (url === bridgeUrl) {
                return {
                    ok: true,
                    status: 200,
                    text: async () => JSON.stringify({ text: 'done' }),
                };
            }
            throw new Error(`unexpected fetch url: ${url}`);
        },
        replyImpl: async (payload) => {
            replies.push(payload);
        },
    });

    const result = await bridge.processUpdate({
        message: {
            message_id: 13,
            chat: { id: 99, type: 'private' },
            from: { id: 77, username: 'carol', first_name: 'Carol' },
            text: '/ask please run Codex',
        },
    });

    assert.equal(result.handled, true);
    assert.equal(result.kind, 'ask');

    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.ok(fetchCalls.length >= 1);
    assert.equal(fetchCalls[0].url, bridgeUrl);
    assert.ok(replies.length >= 2);
    assert.match(replies[0].text, /queued/);
    assert.match(replies.at(-1).text, /done/);
});

test('codex bridge builds stdin-based exec args', () => {
    const args = buildCodexExecArgs('C:\\Time-Tracker', 'C:\\Temp\\last-message.txt');
    assert.deepEqual(args, [
        'exec',
        '--skip-git-repo-check',
        '--full-auto',
        '--cd',
        'C:\\Time-Tracker',
        '--output-last-message',
        'C:\\Temp\\last-message.txt',
        '-',
    ]);
});

test('codex bridge selects the correct invocation shape', () => {
    const invocation = getCodexInvocation();
    if (process.platform === 'win32') {
        assert.equal(invocation.command, 'cmd.exe');
        assert.deepEqual(invocation.argsPrefix, ['/d', '/s', '/c', 'codex.cmd']);
    } else {
        assert.equal(invocation.command, 'codex');
        assert.deepEqual(invocation.argsPrefix, []);
    }
});

test('codex bridge prompt includes Telegram context and request text', () => {
    const prompt = buildPrompt({
        repoPath: 'C:\\Time-Tracker',
        task: {
            command: 'ask',
            prompt: '테스트',
            context: {
                replyToText: 'previous message',
                rawText: '/ask 테스트',
            },
        },
    });

    assert.match(prompt, /Repository: C:\\Time-Tracker/);
    assert.match(prompt, /Command: ask/);
    assert.match(prompt, /User prompt: 테스트/);
    assert.match(prompt, /Reply context: previous message/);
});
