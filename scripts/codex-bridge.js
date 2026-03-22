const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');

async function readStdin() {
    return new Promise((resolve, reject) => {
        let data = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (chunk) => {
            data += chunk;
        });
        process.stdin.on('end', () => resolve(data));
        process.stdin.on('error', reject);
    });
}

function stripOuterQuotes(value) {
    const text = String(value || '').trim();
    if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
        return text.slice(1, -1);
    }
    return text;
}

function buildPrompt(payload) {
    const task = payload?.task || {};
    const command = String(task.command || 'ask').trim();
    const prompt = String(task.prompt || '').trim();
    const context = task.context || {};
    const repoPath = String(payload?.repoPath || process.cwd()).trim();

    return [
        'You are handling a Telegram bot request for the Codex app.',
        'Return only the final answer for the user. Do not mention internal implementation details unless asked.',
        `Repository: ${repoPath}`,
        `Command: ${command}`,
        `User prompt: ${prompt || '(empty)'}`,
        context.replyToText ? `Reply context: ${context.replyToText}` : null,
        context.rawText && context.rawText !== prompt ? `Raw Telegram text: ${context.rawText}` : null,
    ]
        .filter(Boolean)
        .join('\n');
}

function buildCodexExecArgs(repoPath, lastMessagePath) {
    return [
        'exec',
        '--skip-git-repo-check',
        '--full-auto',
        '--cd',
        repoPath,
        '--output-last-message',
        lastMessagePath,
        '-',
    ];
}

function getCodexInvocation() {
    if (process.platform === 'win32') {
        return {
            command: 'cmd.exe',
            argsPrefix: ['/d', '/s', '/c', 'codex.cmd'],
        };
    }

    return {
        command: 'codex',
        argsPrefix: [],
    };
}

async function runCodex(prompt, repoPath) {
    const lastMessagePath = path.join(os.tmpdir(), `codex-last-message-${randomUUID()}.txt`);
    const invocation = getCodexInvocation();
    const args = [...invocation.argsPrefix, ...buildCodexExecArgs(repoPath, lastMessagePath)];

    await new Promise((resolve, reject) => {
        const child = spawn(invocation.command, args, {
            shell: false,
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        let stderr = '';
        child.stdout.on('data', (chunk) => {
            process.stderr.write(chunk);
        });
        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString('utf8');
            process.stderr.write(chunk);
        });
        child.on('error', reject);
        child.on('close', async (code) => {
            try {
                const lastMessage = await fs.readFile(lastMessagePath, 'utf8').catch(() => '');
                await fs.unlink(lastMessagePath).catch(() => {});
                if (code !== 0) {
                    const error = new Error(`codex exec exited with code ${code}`);
                    error.stderr = stderr.trim();
                    error.lastMessage = lastMessage.trim();
                    reject(error);
                    return;
                }
                resolve(lastMessage.trim() || stderr.trim());
            } catch (err) {
                reject(err);
            }
        });

        child.stdin.end(`${prompt}\n`);
    });
}

async function main() {
    const raw = await readStdin();
    const payload = raw.trim() ? JSON.parse(raw) : {};
    const repoPath = stripOuterQuotes(payload?.repoPath || process.cwd());
    const prompt = buildPrompt(payload);

    try {
        const output = await runCodex(prompt, repoPath);
        process.stdout.write(JSON.stringify({ text: output || 'Codex completed.' }));
    } catch (error) {
        process.stdout.write(
            JSON.stringify({
                text: error?.lastMessage || error?.stderr || error?.message || 'Codex execution failed.',
            })
        );
        process.exitCode = 1;
    }
}

module.exports = {
    buildPrompt,
    buildCodexExecArgs,
    getCodexInvocation,
    runCodex,
    stripOuterQuotes,
};

if (require.main === module) {
    main().catch((error) => {
        process.stdout.write(JSON.stringify({ text: error?.message || 'Unexpected bridge failure.' }));
        process.exit(1);
    });
}
