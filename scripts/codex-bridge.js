const path = require('path');

function buildPrompt({ repoPath, task }) {
    const safeTask = task && typeof task === 'object' ? task : {};
    const context = safeTask.context && typeof safeTask.context === 'object' ? safeTask.context : {};
    const lines = [
        `Repository: ${repoPath || process.cwd()}`,
        `Command: ${safeTask.command || 'ask'}`,
        '',
        `User prompt: ${safeTask.prompt || ''}`,
    ];

    if (context.replyToText) {
        lines.push('', `Reply context: ${context.replyToText}`);
    }

    if (context.rawText) {
        lines.push('', `Raw Telegram text: ${context.rawText}`);
    }

    return lines.join('\n');
}

function buildCodexExecArgs(repoPath, outputLastMessagePath) {
    return [
        'exec',
        '--skip-git-repo-check',
        '--full-auto',
        '--cd',
        repoPath || process.cwd(),
        '--output-last-message',
        outputLastMessagePath || path.join(process.cwd(), 'codex-last-message.txt'),
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

module.exports = {
    buildPrompt,
    buildCodexExecArgs,
    getCodexInvocation,
};
