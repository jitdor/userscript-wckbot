// ==UserScript==
// @name         Wckbot Baidu Pan QuickLink
// @namespace    https://github.com/jitdor
// @version      1.0.10
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
    let purchasePanel = null;
    let purchaseButtonRef = null;
    let observer = null;
    let debounceTimer = null;
    const DEBOUNCE_INTERVAL = 1000; // ms
    let injectionTimeout = null;
    let cancelBalancePayment = null;

    // Shared chrome for the fixed, always-visible panels this script injects
    // (the extracted Baidu Pan link, and the pinned purchase button).
    function createPanel(onClose) {
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
        closeBtn.addEventListener('click', onClose);

        container.appendChild(closeBtn);
        return container;
    }

    // Reused across calls instead of creating a new element each time.
    const decoderEl = document.createElement('textarea');
    function htmlDecode(str) {
        decoderEl.innerHTML = str;
        return decoderEl.value;
    }

    // Wckbot can replace an ASCII hyphen inside a Baidu share ID with the
    // typographic en dash U+2013 (for example, by rendering &#8211;),
    // and an "x" between digits in an access code with the
    // multiplication sign U+00D7 (for example, 28x4 rendered as
    // 28&#215;4). Older posts label the code 密码 instead of 提取码 and
    // link to plain-HTTP pan.baidu.com.
    const LINK_CODE_RE =
        /(https?:\/\/pan\.baidu\.com\/s\/[A-Za-z0-9_\-\u2013]+)[\s\S]*?(?:提取码|密码)[:：]?\s*([A-Za-z0-9×✕✖]{4})/i;

    // Baidu access codes are always plain alphanumeric, so map
    // substituted symbols back before the code is used.
    const CODE_HOMOGLYPHS = {
        '×': 'x',
        '✕': 'x',
        '✖': 'x',
    };

    function normalizeCode(code) {
        return code.replace(/./g, (ch) => CODE_HOMOGLYPHS[ch] || ch);
    }

    function normalizePanUrl(url) {
        return url
            .replace(/^http:/i, 'https:')
            .replace(/\u2013/g, '-');
    }

    function extractFromText(text) {
        if (!text) return null;
        const match = htmlDecode(text).match(LINK_CODE_RE);
        return match
            ? { url: normalizePanUrl(match[1]), code: normalizeCode(match[2]) }
            : null;
    }

    function extractFromMeta() {
        const meta = document.querySelector('meta[name="description"]');
        return meta ? extractFromText(meta.content) : null;
    }

    function getCanonicalPanUrl(card) {
        const anchor = card.querySelector(
            'a[href^="https://pan.baidu.com/s/"], ' +
            'a[href^="http://pan.baidu.com/s/"]');
        if (!anchor) return null;

        try {
            const url = new URL(anchor.href, window.location.href);
            if (
                (url.protocol !== 'https:' && url.protocol !== 'http:') ||
                url.hostname !== 'pan.baidu.com' ||
                !/^\/s\/[A-Za-z0-9_-]+$/.test(url.pathname)
            ) {
                return null;
            }
            return `https://pan.baidu.com${url.pathname}`;
        } catch {
            return null;
        }
    }

    function extractFromCard() {
        const card = document.querySelector('.ripay-content .card-body');
        if (!card) return null;

        const extracted = extractFromText(card.innerHTML);
        if (!extracted) return null;

        // The rendered text may replace one or more ASCII hyphens with a
        // single en dash. Prefer the anchor target, which keeps the real ID.
        const canonicalUrl = getCanonicalPanUrl(card);
        return canonicalUrl
            ? { url: canonicalUrl, code: extracted.code }
            : extracted;
    }

    function injectLink() {
        const extracted = extractFromCard() || extractFromMeta();
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

        if (cancelBalancePayment) cancelBalancePayment();

        // The pan link panel supersedes the pinned purchase button: content
        // is unlocked, so there's nothing left to buy.
        if (purchasePanel) {
            purchasePanel.remove();
            purchasePanel = null;
            purchaseButtonRef = null;
        }

        const container = createPanel(() => {
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
        // Navigate this tab rather than opening a new one. No rel=noreferrer
        // either: stripping the Referer header entirely can read as bot-like
        // traffic to Baidu's anti-hotlink checks.
        link.style.color = '#0af';
        link.style.wordBreak = 'break-all';
        link.style.pointerEvents = 'auto';
        link.textContent = panBase;

        // Mark the page before navigating away so the tick is still there if
        // the user comes back to this page from Baidu Pan.
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
        container.appendChild(statusEl);
        container.appendChild(link);
        document.body.appendChild(container);
        panel = container;

        if (injectionTimeout) {
            clearTimeout(injectionTimeout);
            injectionTimeout = null;
        }
    }

    // Locked posts bury the "购买本内容" (purchase) button below a long
    // block of purchase instructions. Pin a copy of it in the same spot the
    // extracted Baidu Pan link uses, so it stays reachable without scrolling.
    function findPayButton() {
        return document.querySelector('.ripay-content .click-pay-post');
    }

    // Only arm balance payment after the user activates the pinned purchase
    // button. The site's popup may be inserted asynchronously or revealed by
    // changing an existing element's class/style.
    function purchaseWithBalance(payButton) {
        if (cancelBalancePayment) return;

        function stopWaiting() {
            paymentObserver.disconnect();
            clearTimeout(paymentTimeout);
            cancelBalancePayment = null;
        }

        function clickBalancePayment() {
            if (cancelBalancePayment !== stopWaiting) return;
            const balanceOption = Array.from(document.querySelectorAll(
                '#iconpay.pay-item[data-type="99"]')).find((option) => {
                const visibility = window.getComputedStyle(option).visibility;
                return option.textContent.trim() === '余额支付' &&
                    option.getClientRects().length > 0 &&
                    visibility !== 'hidden' && visibility !== 'collapse';
            });
            if (!balanceOption) return;

            // Disconnect before clicking: the site's handler may mutate the
            // popup, and must never cause another automatic payment click.
            stopWaiting();
            balanceOption.click();
        }

        const paymentObserver = new MutationObserver(clickBalancePayment);
        const paymentTimeout = setTimeout(stopWaiting, 10000);
        cancelBalancePayment = stopWaiting;
        paymentObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'hidden'],
        });

        try {
            payButton.click();
            clickBalancePayment();
        } catch (error) {
            stopWaiting();
            throw error;
        }
    }

    function removePurchasePanel() {
        if (purchasePanel) {
            purchasePanel.remove();
            purchasePanel = null;
        }
        purchaseButtonRef = null;
    }

    function injectPurchaseButton() {
        // The content is already unlocked; nothing left to buy.
        if (panel) {
            removePurchasePanel();
            return;
        }

        const payButton = findPayButton();
        if (!payButton) {
            removePurchasePanel();
            return;
        }

        // Already pinned for this exact button; leave the panel as-is
        // (e.g. don't reset it on every unrelated DOM mutation).
        if (payButton === purchaseButtonRef && purchasePanel && purchasePanel.isConnected) {
            return;
        }
        purchaseButtonRef = payButton;

        if (purchasePanel) {
            purchasePanel.remove();
            purchasePanel = null;
        }

        const container = createPanel(() => {
            if (cancelBalancePayment) cancelBalancePayment();
            container.remove();
            if (purchasePanel === container) purchasePanel = null;
        });

        const pinnedButton = document.createElement('button');
        pinnedButton.type = 'button';
        pinnedButton.innerHTML = payButton.innerHTML;
        // Drop the "click-pay-post" class so the site's own delegated click
        // handler doesn't also fire directly on this pinned copy; forwarding
        // a real click to the original button below covers that instead.
        pinnedButton.className = payButton.className
            .split(/\s+/)
            .filter((cls) => cls && cls !== 'click-pay-post')
            .join(' ');
        pinnedButton.style.pointerEvents = 'auto';
        pinnedButton.addEventListener('click', () => {
            purchaseWithBalance(payButton);
        });

        container.appendChild(pinnedButton);
        document.body.appendChild(container);
        purchasePanel = container;
    }

    function scheduleInjection() {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
            injectLink();
            injectPurchaseButton();
        }, DEBOUNCE_INTERVAL);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            injectLink();
            injectPurchaseButton();
        });
    } else {
        injectLink();
        injectPurchaseButton();
    }

    observer = new MutationObserver(scheduleInjection);
    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });

    injectionTimeout = setTimeout(() => {
        // Keep watching if a purchase button is pinned: buying can swap the
        // hidden content in via AJAX without a full page reload.
        if (!injectedKey && !purchaseButtonRef && observer) {
            observer.disconnect();
            observer = null;
        }
    }, 10000);
})();
