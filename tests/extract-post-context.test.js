const assert = require('assert');

// Mock DOM environment for Node.js
class MockNode {
    constructor({ tag = 'div', className = '', attrs = {}, textContent = '', children = [] } = {}) {
        this.tag = tag;
        this.className = className;
        this.attrs = attrs;
        this._textContent = textContent;
        this.children = [];
        this.parent = null;
        for (const child of children) {
            this.appendChild(child);
        }
    }

    appendChild(child) {
        child.parent = this;
        this.children.push(child);
    }

    getAttribute(name) {
        return this.attrs[name] !== undefined ? this.attrs[name] : null;
    }

    setAttribute(name, val) {
        this.attrs[name] = String(val);
    }

    get textContent() {
        if (this.children.length === 0) return this._textContent;
        return this.children.map(c => c.textContent).join('');
    }

    set textContent(val) {
        this._textContent = val;
        this.children = [];
    }

    closest(selector) {
        const matches = (node) => {
            const selectors = selector.split(',').map(s => s.trim());
            for (const s of selectors) {
                if (s.startsWith('.') && node.className.split(/\s+/).includes(s.slice(1))) return true;
                if (s === node.tag) return true;
                if (s === 'article.boxed' && node.tag === 'article' && node.className.split(/\s+/).includes('boxed')) return true;
            }
            return false;
        };
        let curr = this;
        while (curr) {
            if (matches(curr)) return curr;
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

    cloneNode(deep = true) {
        const cloned = new MockNode({
            tag: this.tag,
            className: this.className,
            attrs: { ...this.attrs },
            textContent: this._textContent
        });
        if (deep) {
            for (const child of this.children) {
                cloned.appendChild(child.cloneNode(true));
            }
        }
        return cloned;
    }

    replaceWith(newNode) {
        if (!this.parent) return;
        const idx = this.parent.children.indexOf(this);
        if (idx !== -1) {
            newNode.parent = this.parent;
            this.parent.children.splice(idx, 1, newNode);
        }
    }

    remove() {
        if (!this.parent) return;
        const idx = this.parent.children.indexOf(this);
        if (idx !== -1) {
            this.parent.children.splice(idx, 1);
            this.parent = null;
        }
    }
}

// Setup global mock document and window
global.window = {
    location: {
        origin: 'https://linux.do',
        pathname: '/t/topic-title/12345',
        href: 'https://linux.do/t/topic-title/12345'
    }
};
global.document = {
    title: '测试话题标题 - LINUX DO',
    addEventListener: () => {},
    querySelector: (sel) => {
        if (sel === '.fancy-title') return global.mockFancyTitleNode || null;
        return null;
    },
    createTextNode: (text) => new MockNode({ textContent: text })
};

const { extractPostContext } = require('../LinuxDo-User-Tagger.user.js');

let passed = 0;
let failed = 0;

function test(description, fn) {
    try {
        fn();
        console.log(`  ✓ ${description}`);
        passed++;
    } catch (err) {
        console.error(`  ✗ ${description}`);
        console.error(`    Error: ${err.message}`);
        failed++;
    }
}

console.log('\n--- Running Unit Tests: extractPostContext ---\n');

test('extractPostContext returns fallback context when triggerElement is null or undefined', () => {
    assert(typeof extractPostContext === 'function', 'extractPostContext must be exported and defined');
    const ctx = extractPostContext(null);
    assert.strictEqual(ctx.sourceUrl, 'https://linux.do/t/topic-title/12345');
    assert.strictEqual(ctx.sourceTitle, '测试话题标题');
    assert.strictEqual(ctx.quote, '');
});

test('extractPostContext returns fallback context when triggerElement has no post container', () => {
    const trigger = new MockNode({ tag: 'button', className: 'user-card-btn' });
    const ctx = extractPostContext(trigger);
    assert.strictEqual(ctx.sourceUrl, 'https://linux.do/t/topic-title/12345');
    assert.strictEqual(ctx.sourceTitle, '测试话题标题');
    assert.strictEqual(ctx.quote, '');
});

test('extractPostContext extracts floor url from a.post-date when available', () => {
    const postArticle = new MockNode({
        tag: 'article',
        className: 'topic-post',
        attrs: { 'data-post-number': '5' }
    });
    const postDateLink = new MockNode({
        tag: 'a',
        className: 'post-date',
        attrs: { href: '/t/topic-title/12345/5' }
    });
    const cooked = new MockNode({
        tag: 'div',
        className: 'cooked',
        textContent: '这是第5楼的发言内容。'
    });
    const trigger = new MockNode({ tag: 'span', className: 'ld-tag-badge' });

    postArticle.appendChild(postDateLink);
    postArticle.appendChild(cooked);
    postArticle.appendChild(trigger);

    const ctx = extractPostContext(trigger);
    assert.strictEqual(ctx.sourceUrl, 'https://linux.do/t/topic-title/12345/5');
    assert.strictEqual(ctx.quote, '这是第5楼的发言内容。');
    assert.strictEqual(ctx.sourceTitle, '测试话题标题');
});

test('extractPostContext builds floor url from data-post-number if post-date link missing', () => {
    const postArticle = new MockNode({
        tag: 'article',
        className: 'topic-post',
        attrs: { 'data-post-number': '8' }
    });
    const cooked = new MockNode({
        tag: 'div',
        className: 'cooked',
        textContent: '第8楼言论'
    });
    const trigger = new MockNode({ tag: 'span', className: 'ld-tag-add-btn' });

    postArticle.appendChild(cooked);
    postArticle.appendChild(trigger);

    const ctx = extractPostContext(trigger);
    assert.strictEqual(ctx.sourceUrl, 'https://linux.do/t/topic-title/12345/8');
    assert.strictEqual(ctx.quote, '第8楼言论');
});

test('extractPostContext filters quotes, code blocks, system badges, and replaces emojis with alt text', () => {
    const postArticle = new MockNode({
        tag: 'article',
        className: 'topic-post',
        attrs: { 'data-post-number': '2' }
    });
    const cooked = new MockNode({
        tag: 'div',
        className: 'cooked'
    });

    const quoteBlock = new MockNode({
        tag: 'aside',
        className: 'quote',
        textContent: '这是别人的引用：不要回复！'
    });
    const codeBlock = new MockNode({
        tag: 'pre',
        className: 'code',
        textContent: 'console.log("hello");'
    });
    const badge = new MockNode({
        tag: 'span',
        className: 'badge',
        textContent: '系统徽章'
    });
    const textBefore = new MockNode({ textContent: '我认为方案很不错 ' });
    const emojiImg = new MockNode({
        tag: 'img',
        className: 'emoji',
        attrs: { alt: '👍' }
    });
    const textAfter = new MockNode({ textContent: ' 赞同楼上观点！' });

    cooked.appendChild(quoteBlock);
    cooked.appendChild(codeBlock);
    cooked.appendChild(badge);
    cooked.appendChild(textBefore);
    cooked.appendChild(emojiImg);
    cooked.appendChild(textAfter);

    const trigger = new MockNode({ tag: 'span', className: 'user-trigger' });
    postArticle.appendChild(cooked);
    postArticle.appendChild(trigger);

    const ctx = extractPostContext(trigger);
    assert.strictEqual(ctx.quote, '我认为方案很不错 👍 赞同楼上观点！');
});

test('extractPostContext truncates quote to 150 characters and collapses whitespace', () => {
    const postArticle = new MockNode({
        tag: 'article',
        className: 'topic-post',
        attrs: { 'data-post-number': '3' }
    });
    const longText = '   这 是一段   很长的\n\n文字。' + 'ABCDE'.repeat(35); // length > 175
    const cooked = new MockNode({
        tag: 'div',
        className: 'cooked',
        textContent: longText
    });
    const trigger = new MockNode({ tag: 'span' });
    postArticle.appendChild(cooked);
    postArticle.appendChild(trigger);

    const ctx = extractPostContext(trigger);
    assert(ctx.quote.length <= 150, `quote length ${ctx.quote.length} should be <= 150`);
    assert(!ctx.quote.includes('\n'), 'newlines should be collapsed into single spaces');
    assert(!ctx.quote.includes('  '), 'consecutive spaces should be collapsed');
});

test('extractPostContext prioritizes .fancy-title when present', () => {
    global.mockFancyTitleNode = new MockNode({
        tag: 'span',
        className: 'fancy-title',
        textContent: '✨ 高级话题标题'
    });

    const trigger = new MockNode({ tag: 'button' });
    const ctx = extractPostContext(trigger);
    assert.strictEqual(ctx.sourceTitle, '✨ 高级话题标题');

    global.mockFancyTitleNode = null;
});

console.log(`\n----------------------------------------`);
console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log(`----------------------------------------\n`);

if (failed > 0) {
    process.exitCode = 1;
}
