import assert from 'node:assert/strict';
import test from 'node:test';

const LINK_CODE_RE =
    /(https:\/\/pan\.baidu\.com\/s\/[A-Za-z0-9_\-\u2013]+)[\s\S]*?提取码[:：]?\s*([A-Za-z0-9]{4})/i;

function htmlDecode(text) {
    return text.replace(/&#(\d+);/g, (_, value) =>
        String.fromCodePoint(Number(value)));
}

function normalizePanUrl(url) {
    return url.replace(/\u2013/g, '-');
}

function extractFromText(text) {
    if (!text) return null;
    const match = htmlDecode(text).match(LINK_CODE_RE);
    return match
        ? { url: normalizePanUrl(match[1]), code: match[2] }
        : null;
}

const expected = {
    url: 'https://pan.baidu.com/s/1uy-Ck0oRL-GprGAV-vi9w',
    code: 'x9ud',
};

test('normalizes the HTML-encoded en dash found in metadata', () => {
    const metadata =
        '链接：https://pan.baidu.com/s/1uy-Ck0oRL&#8211;GprGAV-vi9w 提取码: x9ud';
    assert.deepEqual(extractFromText(metadata), expected);
});

test('normalizes the decoded en dash returned by meta.content', () => {
    const metadata =
        '链接：https://pan.baidu.com/s/1uy-Ck0oRL–GprGAV-vi9w 提取码: x9ud';
    assert.deepEqual(extractFromText(metadata), expected);
});

test('preserves ordinary ASCII-hyphen share IDs', () => {
    const card =
        '链接：https://pan.baidu.com/s/1uy-Ck0oRL-GprGAV-vi9w 提取码: x9ud';
    assert.deepEqual(extractFromText(card), expected);
});

test('builds the complete direct link', () => {
    const extracted = extractFromText(
        '链接：https://pan.baidu.com/s/1uy-Ck0oRL&#8211;GprGAV-vi9w 提取码: x9ud');
    const directUrl =
        `${extracted.url}?pwd=${encodeURIComponent(extracted.code)}`;

    assert.equal(
        directUrl,
        'https://pan.baidu.com/s/1uy-Ck0oRL-GprGAV-vi9w?pwd=x9ud');
});
