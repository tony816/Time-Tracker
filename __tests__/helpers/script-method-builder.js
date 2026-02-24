const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const scriptPath = path.join(__dirname, '..', '..', 'script.js');
const source = fs.readFileSync(scriptPath, 'utf8');

function extractMethodSource(signature) {
    const escapedSignature = signature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const declPattern = new RegExp(`(^|\\n)\\s*${escapedSignature}\\s*\\{`, 'm');
    const match = declPattern.exec(source);
    assert.ok(match, `method signature not found: ${signature}`);

    const start = match.index + match[0].lastIndexOf(signature);
    const openBrace = source.indexOf('{', start + signature.length);
    assert.ok(openBrace >= 0, `method body open brace not found: ${signature}`);

    let i = openBrace + 1;
    let depth = 1;
    let inSingle = false;
    let inDouble = false;
    let inTemplate = false;
    let inLineComment = false;
    let inBlockComment = false;
    let escaped = false;

    while (i < source.length && depth > 0) {
        const ch = source[i];
        const next = source[i + 1];

        if (inLineComment) {
            if (ch === '\n') inLineComment = false;
            i += 1;
            continue;
        }

        if (inBlockComment) {
            if (ch === '*' && next === '/') {
                inBlockComment = false;
                i += 2;
                continue;
            }
            i += 1;
            continue;
        }

        if (inSingle) {
            if (!escaped && ch === "'") inSingle = false;
            escaped = !escaped && ch === '\\';
            i += 1;
            continue;
        }

        if (inDouble) {
            if (!escaped && ch === '"') inDouble = false;
            escaped = !escaped && ch === '\\';
            i += 1;
            continue;
        }

        if (inTemplate) {
            if (!escaped && ch === '`') {
                inTemplate = false;
                i += 1;
                continue;
            }
            escaped = !escaped && ch === '\\';
            if (ch === '{') depth += 1;
            if (ch === '}') depth -= 1;
            i += 1;
            continue;
        }

        if (ch === '/' && next === '/') {
            inLineComment = true;
            i += 2;
            continue;
        }

        if (ch === '/' && next === '*') {
            inBlockComment = true;
            i += 2;
            continue;
        }

        if (ch === "'") {
            inSingle = true;
            escaped = false;
            i += 1;
            continue;
        }

        if (ch === '"') {
            inDouble = true;
            escaped = false;
            i += 1;
            continue;
        }

        if (ch === '`') {
            inTemplate = true;
            escaped = false;
            i += 1;
            continue;
        }

        if (ch === '{') depth += 1;
        if (ch === '}') depth -= 1;
        i += 1;
    }

    assert.equal(depth, 0, `method body parsing failed: ${signature}`);
    return source.slice(start, i);
}

function buildMethod(signature, args) {
    const methodSource = extractMethodSource(signature);
    const signatureStart = methodSource.indexOf(signature);
    const searchFrom = signatureStart >= 0 ? signatureStart + signature.length : 0;
    const bodyStart = methodSource.indexOf('{', searchFrom);
    assert.ok(bodyStart >= 0, `method body start not found: ${signature}`);
    return new Function(`return (function ${args} ${methodSource.slice(bodyStart)});`)();
}

module.exports = {
    buildMethod,
};
