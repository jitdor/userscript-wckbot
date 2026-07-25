// ==UserScript==
// @name         Wckbot Baidu Pan QuickLink
// @namespace    https://github.com/jitdor
// @version      1.0.0
// @description  Extract Baidu Pan links and access codes on Wckbot pages, then add a direct link and one-click filename copying.
// @author       jitdor
// @license      MIT
// @homepageURL  https://github.com/jitdor/wckbot-baidu-pan-quicklink
// @supportURL   https://github.com/jitdor/wckbot-baidu-pan-quicklink/issues
// @updateURL    https://raw.githubusercontent.com/jitdor/wckbot-baidu-pan-quicklink/main/wckbot-baidu-pan-quicklink.user.js
// @downloadURL  https://raw.githubusercontent.com/jitdor/wckbot-baidu-pan-quicklink/main/wckbot-baidu-pan-quicklink.user.js
// @include      *://wckbot*.com/*
// @run-at       document-end
// @grant        GM_setClipboard
// ==/UserScript==

(function() {
    'use strict';

    let injected = false;
    let observer = null;
    let debounceTimer = null;
    const DEBOUNCE_INTERVAL = 1000; // ms
    let injectionTimeout = null;

    function htmlDecode(str) {
        const textarea = document.createElement('textarea');
        textarea.innerHTML = str;
        return textarea.value;
    }

    function extractFromMeta() {
        const meta = document.querySelector('meta[name="description"]');
        if (!meta || !meta.content) return null;

        // HTML decode the content first
        const decodedContent = htmlDecode(meta.content);
        // Updated regex to allow more characters in the 4-char code (including symbols like ×)
        const match = decodedContent.match(
            /(https:\/\/pan\.baidu\.com\/s\/[A-Za-z0-9\-_]+)[\s\S]*?提取码[:：]?\s*([A-Za-z0-9×\-+*/.]{4})/i
        );
        if (match) {
            return { url: match[1], code: match[2] };
        }
        return null;
    }

    function extractFromCard() {
        const card = document.querySelector('.ripay-content .card-body');
        if (!card) return null;

        // HTML decode the innerHTML first
        const decodedHtml = htmlDecode(card.innerHTML);
        const match = decodedHtml.match(
            /(https:\/\/pan\.baidu\.com\/s\/[A-Za-z0-9\-_]+)[\s\S]*?提取码[:：]?\s*([A-Za-z0-9×\-+*/.]{4})/i
        );
        if (match) {
            return { url: match[1], code: match[2] };
        }
        return null;
    }

    function injectLink() {
        if (injected) return;

        let extracted = extractFromMeta();
        if (!extracted) {
            extracted = extractFromCard();
        }
        if (!extracted) return;

        injected = true;

        // Stop page loading now that we got the info
        if (typeof window.stop === 'function') {
            window.stop();
        }

        const panBase = extracted.url;
        const panUrl = `${panBase}?pwd=${extracted.code}`;

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
            borderRadius: '4px',
            zIndex: 9999,
            maxWidth: '640px',
            fontFamily: 'sans-serif',
            fontSize: '14px',
            cursor: 'default',
            pointerEvents: 'auto',
        });

        const titleDisplay = document.createElement('div');
        titleDisplay.textContent = pageTitle;
        titleDisplay.style.fontWeight = 'bold';
        titleDisplay.style.marginBottom = '4px';
        titleDisplay.title = 'Click to copy title.mp4';
        titleDisplay.style.cursor = 'pointer';
        titleDisplay.addEventListener('click', () => {
            const textToCopy = `${pageTitle}.mp4`;
            GM_setClipboard(textToCopy);
            const orig = titleDisplay.textContent;
            titleDisplay.textContent = 'Copied: ' + textToCopy;
            setTimeout(() => {
                titleDisplay.textContent = orig;
            }, 1000);
        });

        const link = document.createElement('a');
        link.href = panUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
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

        container.appendChild(titleDisplay);
        container.appendChild(link);
        document.body.appendChild(container);

        if (observer) {
            observer.disconnect();
            observer = null;
        }
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
        if (!injected && observer) {
            observer.disconnect();
            observer = null;
        }
    }, 10000);
})();
