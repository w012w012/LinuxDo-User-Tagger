const assert = require('assert');
const {
    formatDateTime,
    filterUsers,
    removeRecordFromUser
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

console.log('\n--- Running Unit Tests: User Cards, Filter & Record Removal ---\n');

console.log('Suite 1: formatDateTime Helper');

test('returns empty string for null, undefined, or invalid inputs', () => {
    assert.strictEqual(formatDateTime(null), '');
    assert.strictEqual(formatDateTime(undefined), '');
    assert.strictEqual(formatDateTime('invalid-date'), '');
    assert.strictEqual(formatDateTime(0), '');
    assert.strictEqual(formatDateTime(NaN), '');
});

test('formats timestamp into YYYY-MM-DD HH:mm format', () => {
    const d = new Date(2026, 8, 17, 14, 30); // Month is 0-indexed: 8 = Sep
    const formatted = formatDateTime(d.getTime());
    assert.strictEqual(formatted, '2026-09-17 14:30');
});

test('pads single digit months, days, hours, and minutes with leading zero', () => {
    const d = new Date(2026, 0, 5, 8, 7); // 2026-01-05 08:07
    const formatted = formatDateTime(d.getTime());
    assert.strictEqual(formatted, '2026-01-05 08:07');
});

console.log('\nSuite 2: filterUsers Logic');

const sampleUsers = [
    {
        username: 'alice',
        tags: [{ name: '💡 技术大佬', category: 'good' }],
        note: '前端专家',
        records: [
            { id: 'r1', time: 1000, quote: '这是关于Vue响应式的讨论', note: '前端专家' }
        ]
    },
    {
        username: 'bob',
        tags: [{ name: '🚫 纯杠精', category: 'bad' }],
        note: '无理取闹',
        records: [
            { id: 'r2', time: 2000, quote: '你说的都是错的完全没道理', note: '无理取闹' }
        ]
    },
    {
        username: 'charlie',
        tags: [
            { name: '💡 技术大佬', category: 'good' },
            { name: '🚫 纯杠精', category: 'bad' }
        ],
        note: '双重身份',
        records: [
            { id: 'r3', time: 3000, quote: '算法实现很优雅', note: '积极' },
            { id: 'r4', time: 2500, quote: '吵架记录在这里', note: '消极' }
        ]
    },
    {
        username: 'david',
        tags: [{ name: '🏷️ 观察', category: 'other' }],
        note: '吃瓜群众',
        records: []
    }
];

test('filters by username keyword', () => {
    const res = filterUsers(sampleUsers, { kw: 'ali' });
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].username, 'alice');
});

test('filters by tag name keyword', () => {
    const res = filterUsers(sampleUsers, { kw: '技术大佬' });
    assert.strictEqual(res.length, 2);
    assert.deepStrictEqual(res.map(u => u.username).sort(), ['alice', 'charlie']);
});

test('filters by user note keyword', () => {
    const res = filterUsers(sampleUsers, { kw: '吃瓜' });
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].username, 'david');
});

test('filters by record quote text keyword', () => {
    const res = filterUsers(sampleUsers, { kw: '响应式' });
    assert.strictEqual(res.length, 1);
    assert.strictEqual(res[0].username, 'alice');

    const res2 = filterUsers(sampleUsers, { kw: '吵架记录' });
    assert.strictEqual(res2.length, 1);
    assert.strictEqual(res2[0].username, 'charlie');
});

test('categoryFilter "all" returns all matching keyword users', () => {
    const res = filterUsers(sampleUsers, { kw: '', categoryFilter: 'all' });
    assert.strictEqual(res.length, 4);
});

test('categoryFilter "good" returns only users with at least one good tag', () => {
    const res = filterUsers(sampleUsers, { kw: '', categoryFilter: 'good' });
    assert.strictEqual(res.length, 2);
    assert.deepStrictEqual(res.map(u => u.username).sort(), ['alice', 'charlie']);
});

test('categoryFilter "bad" returns only users with at least one bad tag', () => {
    const res = filterUsers(sampleUsers, { kw: '', categoryFilter: 'bad' });
    assert.strictEqual(res.length, 2);
    assert.deepStrictEqual(res.map(u => u.username).sort(), ['bob', 'charlie']);
});

test('combines kw and categoryFilter simultaneously', () => {
    const res = filterUsers(sampleUsers, { kw: '技术大佬', categoryFilter: 'good' });
    assert.strictEqual(res.length, 2);

    const res2 = filterUsers(sampleUsers, { kw: 'alice', categoryFilter: 'bad' });
    assert.strictEqual(res2.length, 0);

    const res3 = filterUsers(sampleUsers, { kw: 'charlie', categoryFilter: 'bad' });
    assert.strictEqual(res3.length, 1);
    assert.strictEqual(res3[0].username, 'charlie');
});

console.log('\nSuite 3: removeRecordFromUser Logic');

test('removes target record from user records array', () => {
    const user = {
        username: 'testuser',
        tags: [{ name: 'tag1' }],
        note: 'note1',
        records: [
            { id: 'rec1', time: 2000, note: 'new note' },
            { id: 'rec2', time: 1000, note: 'old note' }
        ]
    };
    const updated = removeRecordFromUser(user, 'rec2');
    assert.strictEqual(updated.records.length, 1);
    assert.strictEqual(updated.records[0].id, 'rec1');
});

test('updates snapshot note and updatedAt when latest record is removed', () => {
    const user = {
        username: 'testuser',
        tags: [{ name: 'tag1' }],
        note: 'top note',
        updatedAt: 3000,
        records: [
            { id: 'rec1', time: 3000, note: 'top note' },
            { id: 'rec2', time: 1000, note: 'earlier note' }
        ]
    };
    const updated = removeRecordFromUser(user, 'rec1');
    assert.strictEqual(updated.records.length, 1);
    assert.strictEqual(updated.records[0].id, 'rec2');
    assert.strictEqual(updated.note, 'earlier note');
    assert.strictEqual(updated.updatedAt, 1000);
});

test('updates snapshot sourceUrl and sourceTitle when latest record is removed', () => {
    const user = {
        username: 'testuser',
        tags: [{ name: 'tag1' }],
        note: 'note 1',
        sourceUrl: 'https://linux.do/t/1/1',
        sourceTitle: 'Topic 1',
        updatedAt: 2000,
        records: [
            { id: 'rec2', time: 2000, note: 'note 2', sourceUrl: 'https://linux.do/t/2/2', sourceTitle: 'Topic 2' },
            { id: 'rec1', time: 1000, note: 'note 1', sourceUrl: 'https://linux.do/t/1/1', sourceTitle: 'Topic 1' }
        ]
    };
    const updated = removeRecordFromUser(user, 'rec2');
    assert.strictEqual(updated.records.length, 1);
    assert.strictEqual(updated.sourceUrl, 'https://linux.do/t/1/1');
    assert.strictEqual(updated.sourceTitle, 'Topic 1');
    assert.strictEqual(updated.note, 'note 1');
    assert.strictEqual(updated.updatedAt, 1000);
});

test('returns user with empty records when last record removed but tags still exist', () => {
    const user = {
        username: 'testuser',
        tags: [{ name: 'tag1' }],
        note: '',
        records: [{ id: 'rec1', time: 1000, note: 'only record' }]
    };
    const updated = removeRecordFromUser(user, 'rec1');
    assert.notStrictEqual(updated, null);
    assert.strictEqual(updated.records.length, 0);
    assert.strictEqual(updated.tags.length, 1);
});

test('returns null when last record removed and no tags or note remain', () => {
    const user = {
        username: 'testuser',
        tags: [],
        note: '',
        records: [{ id: 'rec1', time: 1000, note: 'only record' }]
    };
    const updated = removeRecordFromUser(user, 'rec1');
    assert.strictEqual(updated, null);
});

console.log('\n----------------------------------------');
console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log('----------------------------------------\n');

if (failed > 0) {
    process.exit(1);
}
