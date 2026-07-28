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

function getCanonicalPanUrl(card) {
    const anchor = card.querySelector(
        'a[href^="https://pan.baidu.com/s/"]');
    if (!anchor) return null;

    try {
        const url = new URL(anchor.href);
        if (
            url.protocol !== 'https:' ||
            url.hostname !== 'pan.baidu.com' ||
            !/^\/s\/[A-Za-z0-9_-]+$/.test(url.pathname)
        ) {
            return null;
        }
        return `${url.origin}${url.pathname}`;
    } catch {
        return null;
    }
}

function extractFromCard(card) {
    const extracted = extractFromText(card.innerHTML);
    if (!extracted) return null;

    const canonicalUrl = getCanonicalPanUrl(card);
    return canonicalUrl
        ? { url: canonicalUrl, code: extracted.code }
        : extracted;
}

function makeCard(innerHTML, href = null) {
    return {
        innerHTML,
        querySelector() {
            return href ? { href } : null;
        },
    };
}

test('uses the canonical href when displayed en dash represents two hyphens', () => {
    const card = makeCard(
        '链接：https://pan.baidu.com/s/1eIsTu&#8211;PrIN5H5v1SMSMJQ 提取码: crvf',
        'https://pan.baidu.com/s/1eIsTu--PrIN5H5v1SMSMJQ');

    assert.deepEqual(extractFromCard(card), {
        url: 'https://pan.baidu.com/s/1eIsTu--PrIN5H5v1SMSMJQ',
        code: 'crvf',
    });
});

test('retains the single-hyphen fallback when no anchor exists', () => {
    const card = makeCard(
        '链接：https://pan.baidu.com/s/1uy-Ck0oRL&#8211;GprGAV-vi9w 提取码: x9ud');

    assert.deepEqual(extractFromCard(card), {
        url: 'https://pan.baidu.com/s/1uy-Ck0oRL-GprGAV-vi9w',
        code: 'x9ud',
    });
});

test('rejects a canonical href outside the Baidu share path', () => {
    const card = makeCard(
        '链接：https://pan.baidu.com/s/1uy-Ck0oRL&#8211;GprGAV-vi9w 提取码: x9ud',
        'https://example.com/s/attacker');

    assert.deepEqual(extractFromCard(card), {
        url: 'https://pan.baidu.com/s/1uy-Ck0oRL-GprGAV-vi9w',
        code: 'x9ud',
    });
});

test('builds the complete double-hyphen direct link', () => {
    const extracted = extractFromCard(makeCard(
        '链接：https://pan.baidu.com/s/1eIsTu&#8211;PrIN5H5v1SMSMJQ 提取码: crvf',
        'https://pan.baidu.com/s/1eIsTu--PrIN5H5v1SMSMJQ'));
    const directUrl =
        `${extracted.url}?pwd=${encodeURIComponent(extracted.code)}`;

    assert.equal(
        directUrl,
        'https://pan.baidu.com/s/1eIsTu--PrIN5H5v1SMSMJQ?pwd=crvf');
});
