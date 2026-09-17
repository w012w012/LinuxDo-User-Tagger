const assert = require('assert');
const {
    calculateDashboardStats
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

console.log('\n--- Running Unit Tests: calculateDashboardStats ---\n');

console.log('Suite 1: Empty and Edge Cases');

test('handles null, undefined, and empty object/array gracefully', () => {
    const expected = {
        totalUsers: 0,
        totalRecords: 0,
        goodCount: 0,
        badCount: 0,
        neutralCount: 0,
        goodRatio: '0.0%',
        badRatio: '0.0%',
        topTags: []
    };

    assert.deepStrictEqual(calculateDashboardStats(null), expected);
    assert.deepStrictEqual(calculateDashboardStats(undefined), expected);
    assert.deepStrictEqual(calculateDashboardStats({}), expected);
    assert.deepStrictEqual(calculateDashboardStats([]), expected);
});

test('ignores completely empty user objects without tags, note, or records', () => {
    const input = {
        user1: { username: 'user1', tags: [], note: '', records: [] },
        user2: { username: 'user2', tags: null, note: '   ' }
    };
    const res = calculateDashboardStats(input);
    assert.strictEqual(res.totalUsers, 0);
    assert.strictEqual(res.totalRecords, 0);
});

console.log('\nSuite 2: totalUsers and totalRecords Calculation');

test('calculates totalUsers and totalRecords correctly with records and fallback', () => {
    const input = [
        // User 1: 3 records
        {
            username: 'alice',
            tags: [{ name: '💡 技术大佬', category: 'good' }],
            records: [
                { id: '1', time: 100 },
                { id: '2', time: 200 },
                { id: '3', time: 300 }
            ]
        },
        // User 2: legacy user with tags but no records -> fallback 1
        {
            username: 'bob',
            tags: [{ name: '🚫 纯杠精', category: 'bad' }],
            records: []
        },
        // User 3: legacy user with only note -> fallback 1
        {
            username: 'charlie',
            note: '普通观察名单'
        }
    ];

    const res = calculateDashboardStats(input);
    assert.strictEqual(res.totalUsers, 3);
    assert.strictEqual(res.totalRecords, 5); // 3 + 1 + 1
});

console.log('\nSuite 3: Category Counts and Ratios');

test('categorizes good, bad, and neutral users accurately', () => {
    const input = {
        u1: { username: 'u1', tags: [{ name: '💡 技术大佬', category: 'good' }] },
        u2: { username: 'u2', tags: [{ name: '🧠 逻辑缜密', category: 'good' }] },
        u3: { username: 'u3', tags: [{ name: '🚫 纯杠精', category: 'bad' }] },
        u4: {
            username: 'u4',
            tags: [
                { name: '💡 技术大佬', category: 'good' },
                { name: '🚫 纯杠精', category: 'bad' }
            ]
        },
        u5: { username: 'u5', tags: [{ name: '🏷️ 观察', category: 'other' }] },
        u6: { username: 'u6', note: '仅有备注' }
    };

    const res = calculateDashboardStats(input);
    assert.strictEqual(res.totalUsers, 6);
    assert.strictEqual(res.goodCount, 3); // u1, u2, u4
    assert.strictEqual(res.badCount, 2);  // u3, u4
    assert.strictEqual(res.neutralCount, 2); // u5, u6
});

test('calculates goodRatio and badRatio with one decimal place', () => {
    // 65 good, 35 bad
    const users = [];
    for (let i = 0; i < 65; i++) {
        users.push({ tags: [{ name: 'GoodTag', category: 'good' }] });
    }
    for (let i = 0; i < 35; i++) {
        users.push({ tags: [{ name: 'BadTag', category: 'bad' }] });
    }

    const res = calculateDashboardStats(users);
    assert.strictEqual(res.goodRatio, '65.0%');
    assert.strictEqual(res.badRatio, '35.0%');
});

test('calculates ratio when counts result in recurring decimals', () => {
    // 1 good, 2 bad -> 33.3%, 66.7%
    const users = [
        { tags: [{ name: 'G', category: 'good' }] },
        { tags: [{ name: 'B1', category: 'bad' }] },
        { tags: [{ name: 'B2', category: 'bad' }] }
    ];

    const res = calculateDashboardStats(users);
    assert.strictEqual(res.goodRatio, '33.3%');
    assert.strictEqual(res.badRatio, '66.7%');
});

test('handles 0 good and 0 bad with neutral users gracefully', () => {
    const users = [
        { note: 'Only note 1' },
        { note: 'Only note 2' }
    ];

    const res = calculateDashboardStats(users);
    assert.strictEqual(res.goodCount, 0);
    assert.strictEqual(res.badCount, 0);
    assert.strictEqual(res.neutralCount, 2);
    assert.strictEqual(res.goodRatio, '0.0%');
    assert.strictEqual(res.badRatio, '0.0%');
});

console.log('\nSuite 4: Top 5 Tags Aggregation');

test('ranks top 5 tags by frequency and preserves styling attributes', () => {
    const tagA = { name: '💡 技术大佬', color: '#0e6251', bg: '#d1f2eb', border: '#76d7c4', category: 'good' };
    const tagB = { name: '🧠 逻辑缜密', color: '#154360', bg: '#d4e6f1', border: '#7fb3d5', category: 'good' };
    const tagC = { name: '🚫 纯杠精', color: '#922b21', bg: '#fadbd8', border: '#f1948a', category: 'bad' };
    const tagD = { name: '✨ 妙语连珠', color: '#117a65', bg: '#d5f5e3', border: '#58d68d', category: 'good' };
    const tagE = { name: '📦 优质资源', color: '#0b5345', bg: '#e8f6f3', border: '#73c6b6', category: 'good' };
    const tagF = { name: '⚠️ 极端粉', color: '#6c3483', bg: '#f4ecf7', border: '#bb8fce', category: 'bad' };

    const users = [
        { tags: [tagA, tagB, tagC] },
        { tags: [tagA, tagB] },
        { tags: [tagA, tagD] },
        { tags: [tagA, tagE] },
        { tags: [tagA, tagF] },
        { tags: [tagB, tagC] },
        { tags: [tagD] }
    ];
    // Frequencies:
    // tagA: 5
    // tagB: 3
    // tagC: 2
    // tagD: 2
    // tagE: 1
    // tagF: 1

    const res = calculateDashboardStats(users);
    assert.strictEqual(res.topTags.length, 5, 'should limit to top 5 tags');
    assert.strictEqual(res.topTags[0].name, '💡 技术大佬');
    assert.strictEqual(res.topTags[0].count, 5);
    assert.strictEqual(res.topTags[0].color, '#0e6251');
    assert.strictEqual(res.topTags[0].bg, '#d1f2eb');
    assert.strictEqual(res.topTags[0].border, '#76d7c4');
    assert.strictEqual(res.topTags[0].category, 'good');

    assert.strictEqual(res.topTags[1].name, '🧠 逻辑缜密');
    assert.strictEqual(res.topTags[1].count, 3);

    // Total counts for remaining top 5
    const topTagNames = res.topTags.map(t => t.name);
    assert(topTagNames.includes('💡 技术大佬'));
    assert(topTagNames.includes('🧠 逻辑缜密'));
    assert(topTagNames.includes('🚫 纯杠精'));
    assert(topTagNames.includes('✨ 妙语连珠'));
});

console.log('\n----------------------------------------');
console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log('----------------------------------------\n');

if (failed > 0) {
    process.exit(1);
}
