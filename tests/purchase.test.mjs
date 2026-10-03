import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(
    new URL('../wckbot-baidu-pan-quicklink.user.js', import.meta.url), 'utf8');

// Execute the actual userscript with a small DOM/timer fixture. No website
// requests or real payments are made by these tests.
function setup() {
    class Element {
        constructor(tagName) {
            this.tagName = tagName;
            this.children = [];
            this.style = {};
            this.dataset = {};
            this.attributes = {};
            this.listeners = new Map();
            this.innerHTML = '';
            this.className = '';
            this.rendered = true;
            this.visibility = 'visible';
            this.clicks = 0;
        }
        get textContent() {
            return this.text ?? (this.innerHTML +
                this.children.map((child) => child.textContent).join(''));
        }
        set textContent(value) { this.text = value; }
        get value() { return this.innerHTML; }
        get isConnected() { return this === body || !!this.parent?.isConnected; }
        setAttribute(name, value) { this.attributes[name] = value; }
        appendChild(child) { child.parent = this; this.children.push(child); }
        remove() {
            if (this.parent) {
                this.parent.children = this.parent.children.filter((child) => child !== this);
                this.parent = null;
            }
        }
        addEventListener(name, listener) {
            const listeners = this.listeners.get(name) ?? [];
            listeners.push(listener);
            this.listeners.set(name, listeners);
        }
        click() {
            this.clicks++;
            for (const listener of this.listeners.get('click') ?? []) listener();
        }
        getClientRects() { return this.rendered && this.isConnected ? [{}] : []; }
    }

    const body = new Element('body');
    const original = new Element('button');
    original.className = 'btn click-pay-post';
    original.innerHTML = '购买本内容';
    const timers = new Map();
    const observers = [];
    let timerId = 0;
    let meta = null;

    function descendants(element) {
        return element.children.flatMap((child) => [child, ...descendants(child)]);
    }
    const document = {
        body,
        readyState: 'complete',
        title: 'Test post',
        createElement: (tag) => new Element(tag),
        querySelector(selector) {
            if (selector === '.ripay-content .click-pay-post') return original;
            if (selector === 'meta[name="description"]') return meta;
            return null;
        },
        querySelectorAll(selector) {
            assert.equal(selector, '#iconpay.pay-item[data-type="99"]');
            return descendants(body).filter((element) =>
                element.id === 'iconpay' && element.className.split(/\s+/).includes('pay-item') &&
                element.attributes['data-type'] === '99');
        },
    };
    class MutationObserver {
        constructor(callback) { this.callback = callback; observers.push(this); }
        observe(target, options) { this.active = true; this.options = options; }
        disconnect() { this.active = false; }
    }
    vm.runInNewContext(source, {
        document,
        window: {
            location: { href: 'https://wckbot14.com/post' },
            getComputedStyle: (element) => ({ visibility: element.visibility }),
            stop() {},
        },
        URL,
        MutationObserver,
        setTimeout(callback, delay) {
            timers.set(++timerId, { callback, delay });
            return timerId;
        },
        clearTimeout(id) { timers.delete(id); },
        GM_setClipboard() {},
    });

    const panel = body.children[0];
    const pinned = panel.children.find((child) => child.innerHTML === '购买本内容');
    const close = panel.children.find((child) => child.attributes['aria-label'] === 'Close');
    assert.ok(pinned, 'The actual userscript must inject a pinned purchase button');

    return {
        original, pinned, close,
        option({ type = '99', label = '余额支付', rendered = true, visibility = 'visible' } = {}) {
            const element = new Element('div');
            element.id = 'iconpay';
            element.className = 'pay-item';
            element.setAttribute('data-type', type);
            element.textContent = label;
            element.rendered = rendered;
            element.visibility = visibility;
            body.appendChild(element);
            return element;
        },
        mutate(kind = 'childList', attributeName = null) {
            for (const observer of [...observers]) {
                if (!observer.active || !observer.options[kind]) continue;
                if (kind === 'attributes' && observer.options.attributeFilter &&
                    !observer.options.attributeFilter.includes(attributeName)) continue;
                observer.callback();
            }
        },
        advance(delay) {
            for (const [id, timer] of [...timers]) {
                if (timer.delay !== delay || !timers.has(id)) continue;
                timers.delete(id);
                timer.callback();
            }
        },
        unlock() {
            meta = { content: 'https://pan.baidu.com/s/1test 提取码: ab12' };
            this.mutate();
            this.advance(1000);
        },
    };
}

test('does not select balance payment before the pinned button is clicked', () => {
    const page = setup();
    const option = page.option();
    page.mutate();
    assert.equal(option.clicks, 0);
    assert.equal(page.original.clicks, 0);
});

test('forwards the purchase click and selects a synchronously opened balance popup once', () => {
    const page = setup();
    let option;
    page.original.addEventListener('click', () => { option = page.option(); });
    page.pinned.click();
    assert.equal(page.original.clicks, 1);
    assert.equal(option.clicks, 1);
    page.mutate();
    assert.equal(option.clicks, 1);
});

test('waits for an asynchronously inserted popup and stops before payment mutations', () => {
    const page = setup();
    page.pinned.click();
    const option = page.option();
    option.addEventListener('click', () => page.mutate());
    page.mutate();
    page.mutate();
    assert.equal(option.clicks, 1);
});

test('waits for a hidden balance option to become visible through attribute changes', () => {
    const page = setup();
    const option = page.option({ rendered: false, visibility: 'hidden' });
    page.pinned.click();
    assert.equal(option.clicks, 0);
    option.rendered = true;
    page.mutate('attributes', 'class');
    assert.equal(option.clicks, 0);
    option.visibility = 'visible';
    page.mutate('attributes', 'style');
    assert.equal(option.clicks, 1);
});

test('ignores other payment types and mismatched labels', () => {
    const page = setup();
    const otherType = page.option({ type: '1' });
    const otherLabel = page.option({ label: '其他支付' });
    page.pinned.click();
    page.mutate();
    assert.equal(otherType.clicks, 0);
    assert.equal(otherLabel.clicks, 0);
    const balance = page.option();
    page.mutate();
    assert.equal(balance.clicks, 1);
});

test('ignores repeated pinned clicks while waiting for the same popup', () => {
    const page = setup();
    page.pinned.click();
    page.pinned.click();
    assert.equal(page.original.clicks, 1);
    const option = page.option();
    page.mutate();
    assert.equal(option.clicks, 1);
});

test('expires after ten seconds and allows a new explicit purchase attempt', () => {
    const page = setup();
    page.pinned.click();
    page.advance(10000);
    const option = page.option();
    page.mutate();
    assert.equal(option.clicks, 0);
    page.pinned.click();
    assert.equal(page.original.clicks, 2);
    assert.equal(option.clicks, 1);
});

test('closing the floating panel cancels pending balance payment', () => {
    const page = setup();
    page.pinned.click();
    page.close.click();
    const option = page.option();
    page.mutate();
    assert.equal(option.clicks, 0);
});

test('unlocking the content cancels pending balance payment', () => {
    const page = setup();
    page.pinned.click();
    page.unlock();
    const option = page.option();
    page.mutate();
    assert.equal(option.clicks, 0);
});
