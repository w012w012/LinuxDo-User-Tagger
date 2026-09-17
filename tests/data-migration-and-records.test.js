const assert = require('assert');
const {
    normalizeUserData,
    mergeUserData,
    validateImportShape,
    DEFAULT_CATEGORIES
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

console.log('\n--- Running Unit Tests: Data Migration & Records ---\n');

console.log('Suite 1: Legacy Data Auto-Migration (升维) in normalizeUserData');

test('legacy user with tags and note auto-migrates to 1 record in records', () => {
    const rawUser = {
        username: 'neo',
        tags: [{ name: '🌱 始皇', category: 'good' }],
        note: 'LinuxDo 创始人',
        sourceUrl: 'https://linux.do/t/topic/1/1',
        sourceTitle: '关于社区规范',
        updatedAt: 1726550000000
    };

    const user = normalizeUserData('neo', rawUser, DEFAULT_CATEGORIES);

    assert(user !== null, 'user should not be null');
    assert(Array.isArray(user.records), 'user.records must be an array');
    assert.strictEqual(user.records.length, 1, 'records should have exactly 1 synthesized record');

    const record = user.records[0];
    assert(typeof record.id === 'string' && record.id.length > 0, 'record.id must be a non-empty string');
    assert.strictEqual(record.time, 1726550000000, 'record.time should equal updatedAt');
    assert.strictEqual(record.sourceUrl, 'https://linux.do/t/topic/1/1', 'record.sourceUrl should match');
    assert.strictEqual(record.sourceTitle, '关于社区规范', 'record.sourceTitle should match');
    assert.strictEqual(record.note, 'LinuxDo 创始人', 'record.note should match');
    assert.strictEqual(typeof record.quote, 'string', 'record.quote should be a string');
    assert(Array.isArray(record.tags), 'record.tags should be an array');
    assert.strictEqual(record.tags.length, 1, 'record.tags should contain 1 tag');
    assert.strictEqual(record.tags[0].name, '🌱 始皇', 'record tag name should match');
});

test('legacy user with only note and no tags auto-migrates to 1 record', () => {
    const rawUser = {
        username: 'observer',
        note: '仅有备注的用户',
        sourceUrl: 'https://linux.do/t/topic/99',
        sourceTitle: '讨论帖',
        updatedAt: 1726560000000
    };

    const user = normalizeUserData('observer', rawUser, DEFAULT_CATEGORIES);

    assert(user !== null, 'user should not be null');
    assert(Array.isArray(user.records), 'user.records must be an array');
    assert.strictEqual(user.records.length, 1, 'records should have 1 record');
    assert.strictEqual(user.records[0].note, '仅有备注的用户');
    assert.strictEqual(user.records[0].tags.length, 0, 'record.tags should be empty array');
});

test('user without tags and note produces empty records array', () => {
    const rawUser = {
        username: 'empty_user'
    };

    const user = normalizeUserData('empty_user', rawUser, DEFAULT_CATEGORIES);

    assert(user !== null, 'user should not be null');
    assert(Array.isArray(user.records), 'user.records must be an array');
    assert.strictEqual(user.records.length, 0, 'records should be empty');
});

console.log('\nSuite 2: Existing Records Handling and Validation in normalizeUserData');

test('existing records are preserved, validated and sorted descending by time', () => {
    const rawUser = {
        username: 'active_member',
        tags: [{ name: '💡 智囊', category: 'good' }],
        note: '最新备注',
        records: [
            {
                id: 'rec_1',
                time: 1000,
                sourceUrl: 'https://linux.do/t/topic/1',
                sourceTitle: '旧帖子',
                quote: '旧言论',
                note: '旧备注',
                tags: [{ name: '💡 智囊', category: 'good' }]
            },
            {
                id: 'rec_2',
                time: 2000,
                sourceUrl: 'https://linux.do/t/topic/2',
                sourceTitle: '新帖子',
                quote: '新言论',
                note: '新备注',
                tags: [{ name: '💡 智囊', category: 'good' }]
            }
        ]
    };

    const user = normalizeUserData('active_member', rawUser, DEFAULT_CATEGORIES);

    assert(user !== null, 'user should not be null');
    assert.strictEqual(user.records.length, 2, 'should keep 2 records');
    assert.strictEqual(user.records[0].id, 'rec_2', 'first record should be the newer one (time 2000)');
    assert.strictEqual(user.records[1].id, 'rec_1', 'second record should be the older one (time 1000)');
    assert.strictEqual(user.updatedAt, 2000, 'outer updatedAt should sync with latest record time');
});

test('record quote exceeding 200 chars is sanitized and truncated', () => {
    const longQuote = '言论'.repeat(150); // 300 chars
    const rawUser = {
        username: 'talkative',
        records: [
            {
                id: 'rec_long',
                time: 3000,
                sourceUrl: 'https://linux.do/t/topic/3',
                sourceTitle: '长文帖',
                quote: longQuote,
                note: '备注',
                tags: []
            }
        ]
    };

    const user = normalizeUserData('talkative', rawUser, DEFAULT_CATEGORIES);

    assert(user !== null, 'user should not be null');
    assert.strictEqual(user.records.length, 1);
    assert(user.records[0].quote.length <= 200, `quote length ${user.records[0].quote.length} should be <= 200`);
    assert.strictEqual(user.records[0].quote, longQuote.slice(0, 200));
});

test('invalid records are filtered out during normalization', () => {
    const rawUser = {
        username: 'mixed_records',
        records: [
            null,
            'not an object',
            {
                id: 'valid_rec',
                time: 5000,
                sourceUrl: 'https://linux.do/t/topic/5',
                sourceTitle: '有效帖子',
                quote: '有效言论',
                note: '有效备注',
                tags: []
            }
        ]
    };

    const user = normalizeUserData('mixed_records', rawUser, DEFAULT_CATEGORIES);

    assert(user !== null, 'user should not be null');
    assert.strictEqual(user.records.length, 1, 'invalid records should be filtered out');
    assert.strictEqual(user.records[0].id, 'valid_rec');
});

console.log('\nSuite 3: Record Merging in mergeUserData');

test('merges non-overlapping records from both existing and incoming without loss', () => {
    const existing = {
        username: 'mergeme',
        tags: [{ name: '🌱 新手', category: 'good' }],
        note: '备注1',
        records: [
            {
                id: 'rec_old',
                time: 1000,
                sourceUrl: 'https://linux.do/t/topic/10',
                sourceTitle: '帖子10',
                quote: '言论10',
                note: '备注1',
                tags: [{ name: '🌱 新手', category: 'good' }]
            }
        ]
    };

    const incoming = {
        username: 'mergeme',
        tags: [{ name: '🌱 新手', category: 'good' }, { name: '💻 极客', category: 'good' }],
        note: '备注2',
        records: [
            {
                id: 'rec_new',
                time: 2000,
                sourceUrl: 'https://linux.do/t/topic/20',
                sourceTitle: '帖子20',
                quote: '言论20',
                note: '备注2',
                tags: [{ name: '💻 极客', category: 'good' }]
            }
        ]
    };

    const merged = mergeUserData(existing, incoming, DEFAULT_CATEGORIES);

    assert(Array.isArray(merged.records), 'merged.records must be an array');
    assert.strictEqual(merged.records.length, 2, 'both records must be preserved');
    assert.strictEqual(merged.records[0].id, 'rec_new', 'sorted descending by time');
    assert.strictEqual(merged.records[1].id, 'rec_old');
});

test('deduplicates records with identical id', () => {
    const existing = {
        username: 'dedup_user',
        records: [
            {
                id: 'rec_same_id',
                time: 1000,
                sourceUrl: 'https://linux.do/t/topic/1',
                sourceTitle: '标题1',
                quote: '旧言论',
                note: '旧备注',
                tags: []
            }
        ]
    };

    const incoming = {
        username: 'dedup_user',
        records: [
            {
                id: 'rec_same_id',
                time: 1000,
                sourceUrl: 'https://linux.do/t/topic/1',
                sourceTitle: '标题1',
                quote: '更新后言论',
                note: '更新后备注',
                tags: []
            }
        ]
    };

    const merged = mergeUserData(existing, incoming, DEFAULT_CATEGORIES);

    assert.strictEqual(merged.records.length, 1, 'records with duplicate id must be deduplicated to 1');
});

test('deduplicates records with identical time + sourceUrl even if id differs', () => {
    const existing = {
        username: 'dedup_url_time',
        records: [
            {
                id: 'rec_local',
                time: 1726550000000,
                sourceUrl: 'https://linux.do/t/topic/42/3',
                sourceTitle: '问题讨论',
                quote: '引用发言',
                note: '本地批注',
                tags: []
            }
        ]
    };

    const incoming = {
        username: 'dedup_url_time',
        records: [
            {
                id: 'rec_remote_sync',
                time: 1726550000000,
                sourceUrl: 'https://linux.do/t/topic/42/3',
                sourceTitle: '问题讨论',
                quote: '引用发言',
                note: '远端批注',
                tags: []
            }
        ]
    };

    const merged = mergeUserData(existing, incoming, DEFAULT_CATEGORIES);

    assert.strictEqual(merged.records.length, 1, 'records with identical time and sourceUrl must be deduplicated to 1');
});

test('merged records maintain descending order of time', () => {
    const existing = {
        username: 'sort_user',
        records: [
            { id: 'r1', time: 1000, sourceUrl: 'https://linux.do/1', sourceTitle: 't1', quote: '', note: '', tags: [] },
            { id: 'r3', time: 3000, sourceUrl: 'https://linux.do/3', sourceTitle: 't3', quote: '', note: '', tags: [] }
        ]
    };

    const incoming = {
        username: 'sort_user',
        records: [
            { id: 'r2', time: 2000, sourceUrl: 'https://linux.do/2', sourceTitle: 't2', quote: '', note: '', tags: [] }
        ]
    };

    const merged = mergeUserData(existing, incoming, DEFAULT_CATEGORIES);

    assert.strictEqual(merged.records.length, 3);
    assert.deepStrictEqual(
        merged.records.map(r => r.time),
        [3000, 2000, 1000],
        'records should be sorted descending by time'
    );
});

test('outer snapshot fields remain in sync with the latest record state', () => {
    const existing = {
        username: 'sync_user',
        tags: [{ name: '🌱 新手', category: 'good' }],
        note: '旧状态',
        sourceUrl: 'https://linux.do/old',
        sourceTitle: '旧标题',
        updatedAt: 1000,
        records: [
            { id: 'r_old', time: 1000, sourceUrl: 'https://linux.do/old', sourceTitle: '旧标题', quote: '旧', note: '旧状态', tags: [{ name: '🌱 新手', category: 'good' }] }
        ]
    };

    const incoming = {
        username: 'sync_user',
        tags: [{ name: '💻 极客', category: 'good' }],
        note: '最新状态',
        sourceUrl: 'https://linux.do/new',
        sourceTitle: '最新标题',
        updatedAt: 5000,
        records: [
            { id: 'r_new', time: 5000, sourceUrl: 'https://linux.do/new', sourceTitle: '最新标题', quote: '新', note: '最新状态', tags: [{ name: '💻 极客', category: 'good' }] }
        ]
    };

    const merged = mergeUserData(existing, incoming, DEFAULT_CATEGORIES);

    assert.strictEqual(merged.updatedAt, 5000);
    assert.strictEqual(merged.sourceUrl, 'https://linux.do/new');
    assert.strictEqual(merged.sourceTitle, '最新标题');
});

console.log('\nSuite 4: Schema Validation in validateImportShape');

test('accepts valid import data with records array', () => {
    const validData = {
        users: {
            testuser: {
                username: 'testuser',
                tags: [{ name: '🌱 达人', category: 'good' }],
                note: '备注',
                records: [
                    {
                        id: 'rec_1',
                        time: 1726550000000,
                        sourceUrl: 'https://linux.do/t/topic/10',
                        sourceTitle: '标题',
                        quote: '言论',
                        note: '记录备注',
                        tags: [{ name: '🌱 达人', category: 'good' }]
                    }
                ]
            }
        }
    };

    assert.doesNotThrow(() => {
        validateImportShape(validData);
    });
});

test('rejects import when records is not an array', () => {
    const invalidData = {
        users: {
            bad_user: {
                username: 'bad_user',
                records: 'not an array'
            }
        }
    };

    assert.throws(() => {
        validateImportShape(invalidData);
    }, /records 必须是数组/);
});

test('rejects import when records contains invalid record structure', () => {
    const invalidRecordData = {
        users: {
            bad_user: {
                username: 'bad_user',
                records: [
                    'string instead of object'
                ]
            }
        }
    };

    assert.throws(() => {
        validateImportShape(invalidRecordData);
    }, /records.*无效/);
});

console.log(`\n----------------------------------------`);
console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log(`----------------------------------------\n`);

if (failed > 0) {
    process.exitCode = 1;
}
