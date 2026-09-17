const assert = require('assert');

// Import under test
const {
    extractTopicAuthor,
    extractProfileUsername,
    injectHeaderButton,
    mutationNeedsScan,
    renderTopicItemBadges
} = require('../LinuxDo-User-Tagger.user.js');

let passed = 0;
let failed = 0;
const failures = [];

function test(description, fn) {
    try {
        fn();
        console.log(`  ✓ ${description}`);
        passed++;
    } catch (err) {
        console.error(`  ✗ ${description}`);
        console.error(`    Error: ${err.message}`);
        failed++;
        failures.push({ description, error: err });
    }
}

// Minimal DOM mock for testing
class MockElement {
    constructor({ tag = 'div', className = '', attrs = {}, textContent = '', children = [] } = {}) {
        this.tagName = tag.toUpperCase();
        this.tag = tag.toLowerCase();
        this.className = className;
        this.attrs = { ...attrs };
        this._textContent = textContent;
        this.children = [];
        this.parent = null;
        this.listeners = {};
        for (const child of children) {
            this.appendChild(child);
        }
    }

    addEventListener(event, fn) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(fn);
    }

    removeEventListener(event, fn) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(l => l !== fn);
    }

    remove() {
        if (this.parent) {
            const idx = this.parent.children.indexOf(this);
            if (idx !== -1) {
                this.parent.children.splice(idx, 1);
            }
            this.parent = null;
        }
    }

    set innerHTML(val) {
        if (val === '') {
            this.children = [];
            this._textContent = '';
        }
    }

    get ownerDocument() {
        return {
            createElement(tag) {
                return new MockElement({ tag });
            }
        };
    }

    dispatchEvent(event) {
        const list = this.listeners[event.type || event] || [];
        for (const fn of list) {
            fn(event);
        }
    }

    appendChild(child) {
        child.parent = this;
        this.children.push(child);
    }

    insertBefore(newNode, refNode) {
        newNode.parent = this;
        const idx = this.children.indexOf(refNode);
        if (idx === -1) {
            this.children.push(newNode);
        } else {
            this.children.splice(idx, 0, newNode);
        }
    }

    prepend(child) {
        child.parent = this;
        this.children.unshift(child);
    }

    getAttribute(name) {
        return this.attrs[name] !== undefined ? this.attrs[name] : null;
    }

    setAttribute(name, val) {
        this.attrs[name] = String(val);
    }

    removeAttribute(name) {
        delete this.attrs[name];
    }

    get firstChild() {
        return this.children[0] || null;
    }

    get innerText() {
        return this.textContent;
    }

    set innerText(val) {
        this.textContent = val;
    }

    get textContent() {
        if (this.children.length === 0) return this._textContent;
        return this.children.map(c => c.textContent).join('');
    }

    set textContent(val) {
        this._textContent = val;
        this.children = [];
    }

    matches(sel) {
        const selectors = sel.split(',').map(s => s.trim());
        const classes = (this.className || '').split(/\s+/).filter(Boolean);
        for (const s of selectors) {
            if (s.startsWith('.')) {
                const cls = s.slice(1);
                if (classes.includes(cls)) return true;
            }
            if (s.startsWith('#') && this.attrs.id === s.slice(1)) return true;
            if (s.toLowerCase() === this.tag) return true;
            if (s === '[data-user-card]' && this.getAttribute('data-user-card') !== null) return true;
        }
        return false;
    }

    closest(selector) {
        let curr = this;
        while (curr) {
            if (curr.matches && curr.matches(selector)) return curr;
            curr = curr.parent;
        }
        return null;
    }

    querySelector(selector) {
        return this.querySelectorAll(selector)[0] || null;
    }

    querySelectorAll(selector) {
        const results = [];
        const selectors = selector.split(',').map(s => s.trim());

        const matchSingle = (node, sel) => {
            if (sel.includes(' ')) {
                const parts = sel.split(/\s+/);
                if (!matchSingle(node, parts[parts.length - 1])) return false;
                let anc = node.parent;
                while (anc) {
                    if (matchSingle(anc, parts[0])) return true;
                    anc = anc.parent;
                }
                return false;
            }
            if (sel === ':first-child') {
                return node.parent && node.parent.children[0] === node;
            }
            if (sel.includes(':first-child')) {
                const baseSel = sel.replace(':first-child', '');
                const isFirst = node.parent && node.parent.children[0] === node;
                return isFirst && matchSingle(node, baseSel);
            }
            if (sel.includes('[')) {
                const tag = sel.split('[')[0];
                const attrMatch = sel.match(/\[([^=\]]+)(?:([*^$]?=)"?([^"\]]*)"?)?\]/);
                if (tag && tag !== node.tag && !tag.startsWith('.')) return false;
                if (attrMatch) {
                    const [, attrName, op, val] = attrMatch;
                    const attrVal = node.getAttribute(attrName);
                    if (attrVal === null) return false;
                    if (!op) return true;
                    if (op === '=' && attrVal === val) return true;
                    if (op === '*=' && attrVal.includes(val)) return true;
                    return false;
                }
            }
            if (sel.includes('.')) {
                const [tagPart, ...classParts] = sel.split('.');
                if (tagPart && tagPart !== node.tag) return false;
                const nodeClasses = (node.className || '').split(/\s+/);
                return classParts.every(c => nodeClasses.includes(c));
            }
            if (sel.startsWith('#') && node.getAttribute('id') === sel.slice(1)) return true;
            if (sel === node.tag) return true;
            return false;
        };

        const traverse = (node) => {
            for (const child of node.children) {
                for (const s of selectors) {
                    if (matchSingle(child, s)) {
                        results.push(child);
                        break;
                    }
                }
                traverse(child);
            }
        };

        traverse(this);
        return results;
    }
}

console.log('\n--- Running Unit Tests: Scene Extensions (Header, Topic List, Profile) ---\n');

console.log('Suite 1: extractTopicAuthor Function');

test('extracts author from .posters a:first-child with data-user-card', () => {
    const topicItem = new MockElement({
        className: 'topic-list-item',
        children: [
            new MockElement({
                className: 'main-link',
                children: [
                    new MockElement({ tag: 'a', className: 'title raw-topic-link', textContent: 'Hello World' })
                ]
            }),
            new MockElement({
                className: 'posters',
                children: [
                    new MockElement({ tag: 'a', attrs: { 'data-user-card': 'linus_torvalds' } }),
                    new MockElement({ tag: 'a', attrs: { 'data-user-card': 'someone_else' } })
                ]
            })
        ]
    });

    const author = extractTopicAuthor(topicItem);
    assert.strictEqual(author, 'linus_torvalds');
});

test('extracts author from .posters a:first-child with href /u/username', () => {
    const topicItem = new MockElement({
        className: 'topic-list-item',
        children: [
            new MockElement({
                className: 'posters',
                children: [
                    new MockElement({ tag: 'a', attrs: { href: '/u/guido_van_rossum' } })
                ]
            })
        ]
    });

    const author = extractTopicAuthor(topicItem);
    assert.strictEqual(author, 'guido_van_rossum');
});

test('extracts author and strips leading @ symbol', () => {
    const topicItem = new MockElement({
        className: 'topic-list-item',
        children: [
            new MockElement({
                className: 'posters',
                children: [
                    new MockElement({ tag: 'a', attrs: { 'data-user-card': '@neo_matrix' } })
                ]
            })
        ]
    });

    const author = extractTopicAuthor(topicItem);
    assert.strictEqual(author, 'neo_matrix');
});

test('extracts author with URL-encoded characters in href', () => {
    const topicItem = new MockElement({
        className: 'topic-list-item',
        children: [
            new MockElement({
                className: 'posters',
                children: [
                    new MockElement({ tag: 'a', attrs: { href: '/u/%E6%9D%8E%E5%9B%9B/summary' } })
                ]
            })
        ]
    });

    const author = extractTopicAuthor(topicItem);
    assert.strictEqual(author, '李四');
});

test('extracts author from .creator a fallback', () => {
    const topicItem = new MockElement({
        className: 'topic-list-item',
        children: [
            new MockElement({
                className: 'creator',
                children: [
                    new MockElement({ tag: 'a', attrs: { 'data-user-card': 'creator_user' } })
                ]
            })
        ]
    });

    const author = extractTopicAuthor(topicItem);
    assert.strictEqual(author, 'creator_user');
});

test('extracts author from generic [data-user-card]', () => {
    const topicItem = new MockElement({
        className: 'topic-list-item',
        children: [
            new MockElement({ tag: 'span', attrs: { 'data-user-card': 'card_user' } })
        ]
    });

    const author = extractTopicAuthor(topicItem);
    assert.strictEqual(author, 'card_user');
});

test('returns null when no author found or topicItem invalid', () => {
    assert.strictEqual(extractTopicAuthor(null), null);
    assert.strictEqual(extractTopicAuthor(undefined), null);
    const emptyItem = new MockElement({ className: 'topic-list-item' });
    assert.strictEqual(extractTopicAuthor(emptyItem), null);
});

console.log('\nSuite 2: extractProfileUsername Function');

test('extracts username from simple /u/:username URL pathname', () => {
    assert.strictEqual(extractProfileUsername('/u/linux_fan'), 'linux_fan');
});

test('extracts username from nested /u/:username/summary URL pathname', () => {
    assert.strictEqual(extractProfileUsername('/u/linux_fan/summary'), 'linux_fan');
    assert.strictEqual(extractProfileUsername('/u/alice/activity/topics?page=2'), 'alice');
});

test('extracts and decodes URL-encoded username from URL pathname', () => {
    assert.strictEqual(extractProfileUsername('/u/%E5%BC%A0%E4%B8%89/summary'), '张三');
});

test('strips leading @ from username in URL pathname', () => {
    assert.strictEqual(extractProfileUsername('/u/@neo'), 'neo');
});

test('falls back to profileEl when pathname does not match /u/', () => {
    const profileEl = new MockElement({
        className: 'user-profile-names',
        children: [
            new MockElement({ tag: 'h1', className: 'username', textContent: '@profile_hero' })
        ]
    });

    assert.strictEqual(extractProfileUsername('/', profileEl), 'profile_hero');
});

test('returns null when pathname does not match and profileEl is null or empty', () => {
    assert.strictEqual(extractProfileUsername('/t/some-topic/123', null), null);
});

console.log('\nSuite 3: injectHeaderButton Function');

test('injects li.ld-header-btn-wrap with button when container is ul', () => {
    const ul = new MockElement({ tag: 'ul', className: 'd-header-icons' });
    const fakeDoc = {
        querySelector(sel) {
            if (sel.includes('.d-header-icons')) return ul;
            return null;
        },
        createElement(tag) {
            return new MockElement({ tag });
        }
    };

    let opened = false;
    injectHeaderButton(fakeDoc, () => { opened = true; });

    const wrap = ul.querySelector('.ld-header-btn-wrap');
    assert.ok(wrap, 'Expected .ld-header-btn-wrap to be injected into ul');
    assert.strictEqual(wrap.tagName, 'LI');

    const btn = wrap.querySelector('.ld-header-icon-btn');
    assert.ok(btn, 'Expected .ld-header-icon-btn inside wrap');
    assert.strictEqual(btn.getAttribute('title'), '标签与数据管理中心');
    assert.strictEqual(btn.getAttribute('aria-label'), '标签与数据管理中心');
    assert.strictEqual(btn.textContent, '🏷️');
});

test('injects div.ld-header-btn-wrap when container is not ul', () => {
    const div = new MockElement({ tag: 'div', className: 'd-header panel' });
    const fakeDoc = {
        querySelector(sel) {
            if (sel.includes('.d-header .panel')) return div;
            return null;
        },
        createElement(tag) {
            return new MockElement({ tag });
        }
    };

    injectHeaderButton(fakeDoc, () => {});

    const wrap = div.querySelector('.ld-header-btn-wrap');
    assert.ok(wrap, 'Expected .ld-header-btn-wrap to be injected into div');
    assert.strictEqual(wrap.tagName, 'DIV');
});

test('is idempotent and does not inject duplicate button if wrap already exists', () => {
    const ul = new MockElement({ tag: 'ul', className: 'd-header-icons' });
    const fakeDoc = {
        querySelector(sel) {
            if (sel.includes('.d-header-icons')) return ul;
            return null;
        },
        createElement(tag) {
            return new MockElement({ tag });
        }
    };

    injectHeaderButton(fakeDoc, () => {});
    assert.strictEqual(ul.children.length, 1);

    injectHeaderButton(fakeDoc, () => {});
    assert.strictEqual(ul.children.length, 1);
});

test('clicking injected button triggers onOpen callback', () => {
    const ul = new MockElement({ tag: 'ul', className: 'd-header-icons' });
    const fakeDoc = {
        querySelector(sel) {
            if (sel.includes('.d-header-icons')) return ul;
            return null;
        },
        createElement(tag) {
            return new MockElement({ tag });
        }
    };

    let opened = false;
    injectHeaderButton(fakeDoc, () => { opened = true; });

    const btn = ul.querySelector('.ld-header-icon-btn');
    assert.ok(btn);
    btn.dispatchEvent({ type: 'click', preventDefault() {}, stopPropagation() {} });
    assert.strictEqual(opened, true);
});

console.log('\nSuite 4: mutationNeedsScan Selectors');

test('returns true for relevant selectors including new ones', () => {
    const checkTarget = (className) => {
        const el = new MockElement({ className });
        return mutationNeedsScan([{
            target: el,
            addedNodes: []
        }]);
    };

    assert.ok(checkTarget('topic-list-item'), 'should match .topic-list-item');
    assert.ok(checkTarget('topic-list'), 'should match .topic-list');
    assert.ok(checkTarget('d-header'), 'should match .d-header');
    assert.ok(checkTarget('user-profile-names'), 'should match .user-profile-names');
    assert.ok(checkTarget('user-main'), 'should match .user-main');
});

test('returns false for unrelated elements', () => {
    const el = new MockElement({ className: 'footer-nav uninteresting-class' });
    const res = mutationNeedsScan([{
        target: el,
        addedNodes: []
    }]);
    assert.strictEqual(res, false);
});

console.log('\nSuite 5: renderTopicItemBadges Function');

test('injects compact badges into title container when author has tags', () => {
    const topicItem = new MockElement({
        className: 'topic-list-item',
        children: [
            new MockElement({
                className: 'main-link',
                children: [
                    new MockElement({ tag: 'a', className: 'title raw-topic-link', textContent: 'Interesting Post' })
                ]
            }),
            new MockElement({
                className: 'posters',
                children: [
                    new MockElement({ tag: 'a', attrs: { 'data-user-card': 'awesome_coder' } })
                ]
            })
        ]
    });

    const fakeStorage = {
        getUser(username) {
            if (username === 'awesome_coder') {
                return {
                    tags: [
                        { name: '💻 技术大佬', color: '#fff', bg: '#000', border: '#333' },
                        { name: '✨ 妙语连珠', color: '#111', bg: '#eee', border: '#ddd' }
                    ],
                    note: 'Very helpful developer',
                    updatedAt: 1700000000000
                };
            }
            return null;
        }
    };

    let shownTip = null;
    const fakeTooltip = {
        show(e, html) { shownTip = html; },
        hide() {}
    };

    let openedPopover = null;
    const fakePopover = {
        open(user, trigger) { openedPopover = { user, trigger }; }
    };

    renderTopicItemBadges(topicItem, fakeStorage, fakeTooltip, fakePopover);

    const wrap = topicItem.querySelector('.ld-topic-tag-wrap');
    assert.ok(wrap, 'Should inject .ld-topic-tag-wrap');

    const badges = wrap.querySelectorAll('.ld-tag-badge-compact');
    assert.strictEqual(badges.length, 2);
    assert.strictEqual(badges[0].textContent, '💻 技术大佬');
    assert.strictEqual(badges[1].textContent, '✨ 妙语连珠');

    // Test hover tooltip
    badges[0].dispatchEvent('mouseenter');
    assert.ok(shownTip.includes('@awesome_coder'));
    assert.ok(shownTip.includes('Very helpful developer'));

    // Test click popover
    badges[0].dispatchEvent({ type: 'click', stopPropagation() {}, preventDefault() {} });
    assert.ok(openedPopover);
    assert.strictEqual(openedPopover.user, 'awesome_coder');
});

test('removes .ld-topic-tag-wrap if author has no tags', () => {
    const existingWrap = new MockElement({ className: 'ld-topic-tag-wrap' });
    const titleLink = new MockElement({
        tag: 'a',
        className: 'title raw-topic-link',
        textContent: 'Another Post',
        children: [existingWrap]
    });
    const topicItem = new MockElement({
        className: 'topic-list-item',
        children: [
            new MockElement({
                className: 'main-link',
                children: [titleLink]
            }),
            new MockElement({
                className: 'posters',
                children: [
                    new MockElement({ tag: 'a', attrs: { 'data-user-card': 'ordinary_user' } })
                ]
            })
        ]
    });

    const fakeStorage = {
        getUser() { return null; }
    };

    renderTopicItemBadges(topicItem, fakeStorage, null, null);
    assert.strictEqual(topicItem.querySelector('.ld-topic-tag-wrap'), null);
});

console.log('\n----------------------------------------');
console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log('----------------------------------------\n');

if (failed > 0) {
    process.exit(1);
}
