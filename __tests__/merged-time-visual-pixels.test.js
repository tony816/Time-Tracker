const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const zlib = require('node:zlib');
const { chromium } = require('@playwright/test');
const { app } = require('../server');

function parsePng(buffer) {
    let offset = 8;
    let width = 0;
    let height = 0;
    let bytesPerPixel = 4;
    const idat = [];
    while (offset < buffer.length) {
        const len = buffer.readUInt32BE(offset);
        const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
        const data = buffer.subarray(offset + 8, offset + 8 + len);
        offset += len + 12;
        if (type === 'IHDR') {
            width = data.readUInt32BE(0);
            height = data.readUInt32BE(4);
            const bitDepth = data[8];
            const colorType = data[9];
            assert.equal(bitDepth, 8);
            assert.ok(colorType === 2 || colorType === 6);
            bytesPerPixel = colorType === 6 ? 4 : 3;
        } else if (type === 'IDAT') {
            idat.push(data);
        } else if (type === 'IEND') {
            break;
        }
    }

    const raw = zlib.inflateSync(Buffer.concat(idat));
    const inputStride = width * bytesPerPixel;
    const outputStride = width * 4;
    const pixels = Buffer.alloc(width * height * 4);
    let inputOffset = 0;
    for (let y = 0; y < height; y += 1) {
        const filter = raw[inputOffset];
        inputOffset += 1;
        for (let x = 0; x < inputStride; x += 1) {
            const outputX = Math.floor(x / bytesPerPixel) * 4 + (x % bytesPerPixel);
            const left = x >= bytesPerPixel ? pixels[y * outputStride + outputX - 4] : 0;
            const up = y > 0 ? pixels[(y - 1) * outputStride + outputX] : 0;
            const upLeft = y > 0 && x >= bytesPerPixel ? pixels[(y - 1) * outputStride + outputX - 4] : 0;
            let value = raw[inputOffset + x];
            if (filter === 1) value = (value + left) & 255;
            else if (filter === 2) value = (value + up) & 255;
            else if (filter === 3) value = (value + Math.floor((left + up) / 2)) & 255;
            else if (filter === 4) {
                const p = left + up - upLeft;
                const pa = Math.abs(p - left);
                const pb = Math.abs(p - up);
                const pc = Math.abs(p - upLeft);
                value = (value + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft)) & 255;
            } else {
                assert.equal(filter, 0);
            }
            pixels[y * outputStride + outputX] = value;
            if (bytesPerPixel === 3 && x % 3 === 2) pixels[y * outputStride + outputX + 1] = 255;
        }
        inputOffset += inputStride;
    }
    return { width, height, pixels };
}

function rgbaAt(image, x, y) {
    const offset = (Math.round(y) * image.width + Math.round(x)) * 4;
    return [image.pixels[offset], image.pixels[offset + 1], image.pixels[offset + 2], image.pixels[offset + 3]];
}

function isNearWhite(pixel) {
    return pixel[0] >= 245 && pixel[1] >= 245 && pixel[2] >= 245 && pixel[3] >= 245;
}

function maxNearWhiteRun(image, rect) {
    let maxRun = 0;
    const left = Math.ceil(rect.left + 4);
    const right = Math.floor(rect.right - 6);
    for (let y = Math.ceil(rect.top + 4); y <= Math.floor(rect.bottom - 4); y += 1) {
        let run = 0;
        for (let x = left; x <= right; x += 1) {
            run = isNearWhite(rgbaAt(image, x, y)) ? run + 1 : 0;
            maxRun = Math.max(maxRun, run);
        }
    }
    return maxRun;
}

function borderThickness(image, rect, side) {
    const y = Math.round((rect.top + rect.bottom) / 2);
    const start = side === 'left' ? Math.floor(rect.left) - 5 : Math.floor(rect.right) - 6;
    const end = side === 'left' ? Math.floor(rect.left) + 8 : Math.floor(rect.right) + 8;
    let maxRun = 0;
    let run = 0;
    for (let x = start; x <= end; x += 1) {
        const pixel = rgbaAt(image, x, y);
        const isBorder = Math.abs(pixel[0] - 221) <= 8 && Math.abs(pixel[1] - 221) <= 8 && Math.abs(pixel[2] - 221) <= 8;
        run = isBorder ? run + 1 : 0;
        maxRun = Math.max(maxRun, run);
    }
    return maxRun;
}

async function withServer(fn) {
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    try {
        await fn(`http://127.0.0.1:${port}/`);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

async function renderMergedTimeCase(page, url, viewport, plannedMerge) {
    await page.setViewportSize(viewport);
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForSelector('.time-entry[data-index="5"] .time-slot-container');
    await page.evaluate((includePlannedMerge) => {
        tracker.mergedFields = new Map();
        tracker.mergedFields.set('time-5-7', { type: 'time', start: 5, end: 7 });
        if (includePlannedMerge) tracker.mergedFields.set('planned-5-7', { type: 'planned', start: 5, end: 7 });
        tracker.renderTimeEntries();
        tracker.centerMergedTimeContent();
        document.querySelectorAll('.time-entry[data-index="5"], .time-entry[data-index="6"], .time-entry[data-index="7"]').forEach((row) => {
            row.classList.add('existing-merged-range');
        });
    }, plannedMerge);
    return page.evaluate(() => {
        const first = document.querySelector('.time-entry[data-index="5"] .time-slot-container');
        const last = document.querySelector('.time-entry[data-index="7"] .time-slot-container');
        const a = first.getBoundingClientRect();
        const b = last.getBoundingClientRect();
        return { left: a.left, top: a.top, right: a.right, bottom: b.bottom };
    });
}

test('merged time slot paints continuous gray interior with balanced vertical edges', async () => {
    await withServer(async (url) => {
        const browser = await chromium.launch();
        const page = await browser.newPage({ deviceScaleFactor: 1 });
        try {
            for (const viewport of [{ width: 1000, height: 900 }, { width: 390, height: 900 }]) {
                for (const plannedMerge of [false, true]) {
                    const rect = await renderMergedTimeCase(page, url, viewport, plannedMerge);
                    const image = parsePng(await page.screenshot({ fullPage: true }));
                    assert.equal(maxNearWhiteRun(image, rect), 0, `near-white run inside merged time slot at ${viewport.width}px`);
                    const left = borderThickness(image, rect, 'left');
                    const right = borderThickness(image, rect, 'right');
                    assert.ok(Math.abs(left - right) <= 1, `left/right border mismatch at ${viewport.width}px: ${left}/${right}`);
                }
            }
        } finally {
            await browser.close();
        }
    });
});
