// ==UserScript==
// @name         Wckbot Baidu Pan QuickLink
// @namespace    https://github.com/jitdor
// @version      1.0.4
// @description  Extract Baidu Pan links and access codes on Wckbot pages, then add a direct link and one-click filename copying.
// @author       jitdor
// @license      MIT
// @icon         https://pan.baidu.com/favicon.ico
// @homepageURL  https://github.com/jitdor/userscript-wckbot
// @supportURL   https://github.com/jitdor/userscript-wckbot/issues
// @updateURL    https://raw.githubusercontent.com/jitdor/userscript-wckbot/main/wckbot-baidu-pan-quicklink.user.js
// @downloadURL  https://raw.githubusercontent.com/jitdor/userscript-wckbot/main/wckbot-baidu-pan-quicklink.user.js
// @include      /^https?:\/\/wckbot\d+\.com\//
// @run-at       document-end
// @noframes
// @grant        GM_setClipboard
// ==/UserScript==

(function() {
    'use strict';

    let injectedKey = null;
    let panel = null;
    let observer = null;
    let debounceTimer = null;
    const DEBOUNCE_INTERVAL = 1000; // ms
    let injectionTimeout = null;

    // Reused across calls instead of creating a new element each time.
    const decoderEl = document.createElement('textarea');
    function htmlDecode(str) {
        decoderEl.innerHTML = str;
        return decoderEl.value;
    }

    // Wckbot can replace an ASCII hyphen inside a Baidu share ID with the
    // typographic en dash U+2013 (for example, by rendering &#8211;).
    const LINK_CODE_RE =
        /(https:\/\/pan\.baidu\.com\/s\/[A-Za-z0-9_\-\u2013]+)[\s\S]*?提取码[:：]?\s*([A-Za-z0-9]{4})/i;

    function normalizePanUrl(url) {
        return url.replace(/\u2013/g, '-');
    }

    function extractFromText(text) {
        if (!text) return null;
        const match = htmlDecode(text).match(LINK_CODE_RE);
        return match ? { url: normalizePanUrl(match[1]), code: match[2] } : null;
    }

    function extractFromMeta() {
        const meta = document.querySelector('meta[name="description"]');
        return meta ? extractFromText(meta.content) : null;
    }

    function extractFromCard() {
        const card = document.querySelector('.ripay-content .card-body');
        return card ? extractFromText(card.innerHTML) : null;
    }

    function injectLink() {
        const extracted = extractFromMeta() || extractFromCard();
        if (!extracted) return;

        // Re-arm: only rebuild the panel when the extracted link/code actually
        // changes (e.g. the page swaps content client-side without a reload).
        const key = `${extracted.url}|${extracted.code}`;
        if (key === injectedKey) return;
        injectedKey = key;

        // Stop page loading now that we got the info
        if (typeof window.stop === 'function') {
            window.stop();
        }

        if (panel) {
            panel.remove();
            panel = null;
        }

        const panBase = extracted.url;
        const panUrl = `${panBase}?pwd=${encodeURIComponent(extracted.code)}`;

        const titleEl = document.querySelector('h1.entry-title');
        const pageTitle = titleEl
            ? titleEl.textContent.trim()
            : document.title.trim();

        const container = document.createElement('div');
        Object.assign(container.style, {
            position: 'fixed',
            top: '10px',
            left: '10px',
            background: 'rgba(0,0,0,0.7)',
            color: '#fff',
            padding: '10px',
            paddingRight: '24px',
            borderRadius: '4px',
            zIndex: 2147483647,
            maxWidth: 'calc(100vw - 20px)',
            fontFamily: 'sans-serif',
            fontSize: '14px',
            cursor: 'default',
            pointerEvents: 'auto',
        });

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.textContent = '×';
        closeBtn.setAttribute('aria-label', 'Close');
        Object.assign(closeBtn.style, {
            position: 'absolute',
            top: '2px',
            right: '6px',
            background: 'transparent',
            border: 'none',
            color: '#fff',
            fontSize: '16px',
            lineHeight: '1',
            cursor: 'pointer',
            padding: '0 4px',
        });
        closeBtn.addEventListener('click', () => {
            container.remove();
            if (panel === container) panel = null;
        });

        const titleDisplay = document.createElement('div');
        titleDisplay.textContent = pageTitle;
        titleDisplay.style.fontWeight = 'bold';
        titleDisplay.style.marginBottom = '4px';
        titleDisplay.style.cursor = 'pointer';
        titleDisplay.setAttribute('role', 'button');
        titleDisplay.setAttribute('tabindex', '0');
        titleDisplay.setAttribute('aria-label', `Copy filename ${pageTitle}.mp4`);

        const statusEl = document.createElement('span');
        Object.assign(statusEl.style, {
            position: 'absolute',
            width: '1px',
            height: '1px',
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
        });
        statusEl.setAttribute('aria-live', 'polite');

        function copyTitle() {
            const textToCopy = `${pageTitle}.mp4`;
            GM_setClipboard(textToCopy);
            const orig = titleDisplay.textContent;
            titleDisplay.textContent = 'Copied: ' + textToCopy;
            statusEl.textContent = `Copied ${textToCopy} to clipboard`;
            setTimeout(() => {
                titleDisplay.textContent = orig;
            }, 1000);
        }

        titleDisplay.addEventListener('click', copyTitle);
        titleDisplay.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                copyTitle();
            }
        });

        const link = document.createElement('a');
        link.href = panUrl;
        link.target = '_blank';
        // noreferrer (not just noopener) strips the Referer header entirely,
        // which can read as bot-like traffic to Baidu's anti-hotlink checks.
        link.rel = 'noopener';
        link.style.color = '#0af';
        link.style.wordBreak = 'break-all';
        link.style.pointerEvents = 'auto';
        link.textContent = panBase;

        link.addEventListener('click', () => {
            if (!container.dataset.clicked) {
                container.dataset.clicked = 'true';
                link.textContent = '✓ ' + panBase;
                document.title = `✓ ${pageTitle}`;
                // Also stop page loading once user clicks link
                if (typeof window.stop === 'function') {
                    window.stop();
                }
            }
        });

        container.appendChild(closeBtn);
        container.appendChild(titleDisplay);
        container.appendChild(statusEl);
        container.appendChild(link);
        document.body.appendChild(container);
        panel = container;

        if (injectionTimeout) {
            clearTimeout(injectionTimeout);
            injectionTimeout = null;
        }
    }

    function scheduleInjection() {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
            injectLink();
        }, DEBOUNCE_INTERVAL);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            injectLink();
        });
    } else {
        injectLink();
    }

    observer = new MutationObserver(scheduleInjection);
    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });

    injectionTimeout = setTimeout(() => {
        if (!injectedKey && observer) {
            observer.disconnect();
            observer = null;
        }
    }, 10000);
})();
