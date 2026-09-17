// ==UserScript==
// @name         LinuxDo User Tagger (Linux.do 用户打标与分类工具)
// @namespace    https://github.com/w012w012/LinuxDo-User-Tagger
// @version      0.0.2
// @description  为 Linux.do 论坛用户添加自定义标签与备注，支持【有营养】与【没营养】分类、超全语义 Emoji 智能字典、自主增删标签库、已有标签与备注展示、防冲动回帖警示、本地持久化与导入导出。
// @author       w012w012
// @homepageURL  https://github.com/w012w012/LinuxDo-User-Tagger
// @supportURL   https://github.com/w012w012/LinuxDo-User-Tagger/issues
// @updateURL    https://raw.githubusercontent.com/w012w012/LinuxDo-User-Tagger/main/LinuxDo-User-Tagger.user.js
// @downloadURL  https://raw.githubusercontent.com/w012w012/LinuxDo-User-Tagger/main/LinuxDo-User-Tagger.user.js
// @match        https://linux.do/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addValueChangeListener
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @connect      api.github.com
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
    'use strict';

    // ==========================================
    // 1. 常量与默认分类配置
    // ==========================================
    const STORAGE_KEY = 'ld_user_tagger_data';
    const GIST_CONFIG_KEY = 'ld_user_tagger_gist_config';
    const GIST_FILENAME = 'linuxdo_user_tags.json';

    // 默认预设分类库
    const DEFAULT_CATEGORIES = [
        {
            id: "good",
            title: "🌱 有营养 (优质 / 理性 / 提效)",
            defaultEmoji: "🌱",
            candidateEmojis: ["💡", "🧠", "✨", "👍", "📦", "💻", "🎯", "🔥", "🌱"],
            colorScheme: { color: "#0e6251", bg: "#d1f2eb", border: "#76d7c4" },
            tags: [
                { name: "💡 技术大佬", color: "#0e6251", bg: "#d1f2eb", border: "#76d7c4", category: "good" },
                { name: "🧠 逻辑缜密", color: "#154360", bg: "#d4e6f1", border: "#7fb3d5", category: "good" },
                { name: "✨ 妙语连珠", color: "#117a65", bg: "#d5f5e3", border: "#58d68d", category: "good" },
                { name: "👍 理性讨论", color: "#1a5276", bg: "#eaf2f8", border: "#a9cce3", category: "good" },
                { name: "📦 优质资源", color: "#0b5345", bg: "#e8f6f3", border: "#73c6b6", category: "good" }
            ]
        },
        {
            id: "bad",
            title: "🚨 没营养 (避坑 / 警示 / 防杠)",
            defaultEmoji: "🚨",
            candidateEmojis: ["🚫", "🧩", "⚠️", "🤡", "💣", "🌿", "📱", "🤖", "🚨"],
            colorScheme: { color: "#922b21", bg: "#fadbd8", border: "#f1948a" },
            tags: [
                { name: "🚫 纯杠精", color: "#922b21", bg: "#fadbd8", border: "#f1948a", category: "bad" },
                { name: "🧩 逻辑感人", color: "#a04000", bg: "#fdebd0", border: "#f8c471", category: "bad" },
                { name: "⚠️ 极端粉", color: "#6c3483", bg: "#f4ecf7", border: "#bb8fce", category: "bad" },
                { name: "🤡 跳梁小丑", color: "#78281f", bg: "#fadbd8", border: "#e6b0aa", category: "bad" }
            ]
        }
    ];

    // 超全智能语义关键词与 Emoji 自动映射字典
    const KEYWORD_EMOJI_RULES = [
        // 技术开发 / 极客
        { keywords: ["技术", "代码", "开发", "前端", "后端", "算法", "大佬", "架构", "全栈", "程序", "极客", "geek", "dev", "运维", "安全", "逆向", "工程师"], emoji: "💻" },
        { keywords: ["思路", "灵感", "点子", "教程", "技巧", "方案", "妙招"], emoji: "💡" },
        // 逻辑思维 / 深度
        { keywords: ["逻辑", "思维", "缜密", "硬核", "分析", "深思", "透彻", "哲理", "辩证", "洞察", "专业"], emoji: "🧠" },
        // 资源分享 / 工具
        { keywords: ["资源", "网盘", "工具", "分享", "整理", "福利", "合集", "软件", "应用", "仓库", "下载", "神器", "白嫖"], emoji: "📦" },
        // 文采斐然 / 幽默
        { keywords: ["妙语", "幽默", "风趣", "文采", "神评", "金句", "乐子", "段子", "搞笑", "机智", "妙啊", "有才"], emoji: "✨" },
        // 理性客观 / 友善
        { keywords: ["理性", "客观", "中立", "温和", "善意", "热心", "靠谱", "老实人", "好人", "正能量", "文明", "包容"], emoji: "👍" },
        // 专注效率 / 精准
        { keywords: ["目标", "专注", "效率", "干货", "精准", "命中", "核心", "要点"], emoji: "🎯" },
        // 活跃精华 / 热情
        { keywords: ["精华", "热心", "活跃", "高产", "给力", "强无敌", "牛逼", "带劲", "猛"], emoji: "🔥" },

        // 杠精 / 戾气对线
        { keywords: ["杠", "喷", "吵", "撕", "反驳", "逆天", "恶心", "对线", "挑刺", "戾气", "不依不饶", "键盘侠", "找茬", "杠宝"], emoji: "🚫" },
        // 逻辑混乱 / 抽象
        { keywords: ["逻辑差", "逻辑感人", "无脑", "弱智", "感人", "抽象", "反智", "胡搅蛮缠", "偷换概念", "答非所问", "认知低下", "睿智"], emoji: "🧩" },
        // 极端狂热 / 魔怔 (注意排除“粉色”等单纯颜色词)
        { keywords: ["脑残粉", "死忠粉", "极端粉", "饭圈粉", "魔怔粉", "极端", "魔怔", "饭圈", "无脑吹", "崇拜", "狂热", "战狼", "圣母", "二极管", "非黑即白", "盲目"], emoji: "⚠️" },
        // 小丑作态 / 闹剧
        { keywords: ["小丑", "跳梁", "闹剧", "滑稽", "丢人", "现眼", "哗众取宠", "自导自演", "搞笑男", "搞笑女", "装逼", "装神弄鬼"], emoji: "🤡" },
        // 中医玄学 / 迷信
        { keywords: ["中医", "传武", "神棍", "迷信", "伪科学", "气功", "算命", "大师", "秘方", "偏方", "玄学"], emoji: "🌿" },
        // 数码品牌狂热
        { keywords: ["手机", "华为", "小米", "苹果", "数码", "花粉", "果粉", "米粉", "品牌粉"], emoji: "📱" },
        // 机器人 / 水军钓鱼
        { keywords: ["串子", "水军", "小号", "机器人", "发帖机", "引战", "钓鱼", "刷屏", "带节奏", "推销", "广告哥", "营销号"], emoji: "🤖" },
        // 危险雷区 / 避坑
        { keywords: ["炸弹", "避坑", "危险", "拉黑", "黑名单", "骗子", "骗术", "小心", "防雷", "垃圾", "有毒", "剧毒"], emoji: "💣" }
    ];

    // ==========================================
    // 2. 辅助工具函数 (安全转义与格式化)
    // ==========================================
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function isPlainObject(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    function cloneData(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function normalizeText(value, maxLength) {
        if (value === null || value === undefined) return '';
        return String(value).trim().slice(0, maxLength);
    }

    function normalizeUsername(username) {
        return normalizeText(username, 100).replace(/^@/, '');
    }

    function normalizeCategoryId(categoryId) {
        const value = normalizeText(categoryId, 32);
        return /^[A-Za-z0-9_-]{1,32}$/.test(value) ? value : null;
    }

    // Imported colors are data, not trusted CSS. Accept only hexadecimal colors.
    function sanitizeColor(value, fallback) {
        const color = normalizeText(value, 20);
        return /^#[0-9a-f]{3,8}$/i.test(color) ? color : fallback;
    }

    function getTagKey(tagOrCategory, tagName) {
        if (isPlainObject(tagOrCategory)) {
            return `${tagOrCategory.category || 'unknown'}\u0000${tagOrCategory.name || ''}`;
        }
        return `${tagOrCategory || 'unknown'}\u0000${tagName || ''}`;
    }

    function makeKeyboardActivatable(element) {
        if (!element) return;
        element.setAttribute('role', 'button');
        element.setAttribute('tabindex', '0');
        element.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            element.click();
        });
    }

    function findPresetTag(categories, categoryId, tagName) {
        const category = (categories || []).find(cat => cat.id === categoryId);
        return category && Array.isArray(category.tags)
            ? category.tags.find(tag => tag.name === tagName)
            : null;
    }

    function inferTagCategory(categories, tagName) {
        const category = (categories || []).find(cat =>
            Array.isArray(cat.tags) && cat.tags.some(tag => tag.name === tagName)
        );
        return category ? category.id : 'unknown';
    }

    function normalizeCategories(rawCategories) {
        const source = Array.isArray(rawCategories) && rawCategories.length > 0
            ? rawCategories
            : cloneData(DEFAULT_CATEGORIES);
        const categories = [];
        const categoryIds = new Set();

        source.forEach(rawCategory => {
            if (!isPlainObject(rawCategory)) return;
            const id = normalizeCategoryId(rawCategory.id);
            if (!id || categoryIds.has(id)) return;

            const fallbackScheme = id === 'good'
                ? { color: '#0e6251', bg: '#d1f2eb', border: '#76d7c4' }
                : { color: '#922b21', bg: '#fadbd8', border: '#f1948a' };
            const rawScheme = isPlainObject(rawCategory.colorScheme) ? rawCategory.colorScheme : {};
            const tags = [];
            const tagNames = new Set();

            (Array.isArray(rawCategory.tags) ? rawCategory.tags : []).forEach(rawTag => {
                if (!isPlainObject(rawTag)) return;
                const name = normalizeText(rawTag.name, 100);
                if (!name || tagNames.has(name)) return;
                tagNames.add(name);
                tags.push({
                    name,
                    color: sanitizeColor(rawTag.color, sanitizeColor(rawScheme.color, fallbackScheme.color)),
                    bg: sanitizeColor(rawTag.bg, sanitizeColor(rawScheme.bg, fallbackScheme.bg)),
                    border: sanitizeColor(rawTag.border, sanitizeColor(rawScheme.border, fallbackScheme.border)),
                    category: id
                });
            });

            categories.push({
                id,
                title: normalizeText(rawCategory.title, 120) || id,
                defaultEmoji: normalizeText(rawCategory.defaultEmoji, 16) || '🏷️',
                candidateEmojis: Array.isArray(rawCategory.candidateEmojis)
                    ? rawCategory.candidateEmojis.map(emoji => normalizeText(emoji, 16)).filter(Boolean).slice(0, 50)
                    : [],
                colorScheme: {
                    color: sanitizeColor(rawScheme.color, fallbackScheme.color),
                    bg: sanitizeColor(rawScheme.bg, fallbackScheme.bg),
                    border: sanitizeColor(rawScheme.border, fallbackScheme.border)
                },
                tags
            });
            categoryIds.add(id);
        });

        return categories.length > 0 ? categories : cloneData(DEFAULT_CATEGORIES);
    }

    function normalizeUserTags(rawTags, categories) {
        const tags = [];
        const tagKeys = new Set();
        (Array.isArray(rawTags) ? rawTags : []).forEach(rawTag => {
            if (!isPlainObject(rawTag)) return;
            const name = normalizeText(rawTag.name, 100);
            if (!name) return;
            const requestedCategory = normalizeCategoryId(rawTag.category);
            const knownCategory = requestedCategory && (categories || []).some(cat => cat.id === requestedCategory)
                ? requestedCategory
                : null;
            const category = knownCategory || inferTagCategory(categories || [], name);
            const preset = findPresetTag(categories || [], category, name);
            const fallback = preset || { color: '#333333', bg: '#eeeeee', border: '#cccccc' };
            const tag = {
                name,
                color: sanitizeColor(rawTag.color, fallback.color),
                bg: sanitizeColor(rawTag.bg, fallback.bg),
                border: sanitizeColor(rawTag.border, fallback.border),
                category
            };
            const key = getTagKey(tag);
            if (!tagKeys.has(key)) {
                tagKeys.add(key);
                tags.push(tag);
            }
        });
        return tags;
    }

    function normalizeUserData(username, rawUser, categories) {
        if (!isPlainObject(rawUser)) return null;
        const displayName = normalizeUsername(rawUser.username || username);
        if (!displayName) return null;

        const tags = normalizeUserTags(rawUser.tags, categories);
        const note = normalizeText(rawUser.note, 1000);
        const sourceUrl = normalizeText(rawUser.sourceUrl, 2048);
        const sourceTitle = normalizeText(rawUser.sourceTitle, 200);
        const rawUpdatedAt = Number(rawUser.updatedAt);
        const updatedAt = Number.isFinite(rawUpdatedAt) && rawUpdatedAt > 0 ? rawUpdatedAt : 0;

        let records = [];
        if (Array.isArray(rawUser.records)) {
            rawUser.records.forEach(record => {
                if (!isPlainObject(record)) return;
                const timeNum = Number(record.time);
                const time = Number.isFinite(timeNum) && timeNum > 0 ? timeNum : 0;
                const id = typeof record.id === 'string' && record.id.trim()
                    ? record.id.trim()
                    : `rec_${time || Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                records.push({
                    id,
                    time,
                    sourceUrl: normalizeText(record.sourceUrl, 2048),
                    sourceTitle: normalizeText(record.sourceTitle, 200),
                    quote: normalizeText(record.quote, 200),
                    note: normalizeText(record.note, 1000),
                    tags: normalizeUserTags(record.tags, categories)
                });
            });
            records.sort((a, b) => b.time - a.time);
        } else if (tags.length > 0 || note !== '') {
            const legacyTime = updatedAt || Date.now();
            records = [{
                id: `rec_${legacyTime}_legacy`,
                time: legacyTime,
                sourceUrl: sourceUrl || '',
                sourceTitle: sourceTitle || '',
                quote: '',
                note: note || '',
                tags: cloneData(tags)
            }];
        }

        const outerUpdatedAt = records.length > 0
            ? Math.max(updatedAt, records[0]?.time || 0)
            : updatedAt;
        const outerSourceUrl = records.length > 0
            ? (records[0]?.sourceUrl || sourceUrl)
            : sourceUrl;
        const outerSourceTitle = records.length > 0
            ? (records[0]?.sourceTitle || sourceTitle)
            : sourceTitle;
        const outerNote = note || (records.length > 0 ? records[0]?.note || '' : '');
        const outerTags = tags.length > 0
            ? tags
            : (records.length > 0 ? cloneData(records[0]?.tags || []) : []);

        return {
            username: displayName,
            tags: outerTags,
            note: outerNote,
            sourceUrl: outerSourceUrl,
            sourceTitle: outerSourceTitle,
            updatedAt: outerUpdatedAt,
            records
        };
    }

    function normalizeUsers(rawUsers, categories) {
        const users = Object.create(null);
        if (!isPlainObject(rawUsers)) return users;

        Object.entries(rawUsers).forEach(([key, rawUser]) => {
            const user = normalizeUserData(key, rawUser, categories);
            if (user) users[user.username.toLowerCase()] = user;
        });
        return users;
    }

    function validateImportShape(imported) {
        if (!isPlainObject(imported)) throw new Error('顶层数据必须是 JSON 对象');
        const hasUsers = Object.prototype.hasOwnProperty.call(imported, 'users');
        const hasCategories = Object.prototype.hasOwnProperty.call(imported, 'categories');
        if (!hasUsers && !hasCategories) throw new Error('缺少 users 或 categories 字段');
        if (hasUsers && !isPlainObject(imported.users)) throw new Error('users 必须是对象');
        if (hasCategories && !Array.isArray(imported.categories)) throw new Error('categories 必须是数组');

        if (hasCategories) {
            imported.categories.forEach(category => {
                if (!isPlainObject(category) || !normalizeCategoryId(category.id)) {
                    throw new Error('categories 中包含无效分类');
                }
                if (category.tags !== undefined && !Array.isArray(category.tags)) {
                    throw new Error('分类 tags 必须是数组');
                }
                (category.tags || []).forEach(tag => {
                    if (!isPlainObject(tag) || typeof tag.name !== 'string' || !normalizeText(tag.name, 100)) {
                        throw new Error('分类中包含无效标签');
                    }
                });
            });
        }

        if (hasUsers) {
            Object.entries(imported.users).forEach(([key, user]) => {
                if (!isPlainObject(user)) throw new Error(`用户 ${key} 的数据无效`);
                if (user.username !== undefined && typeof user.username !== 'string') {
                    throw new Error(`用户 ${key} 的 username 无效`);
                }
                if (user.tags !== undefined && !Array.isArray(user.tags)) {
                    throw new Error(`用户 ${key} 的 tags 必须是数组`);
                }
                if (user.note !== undefined && typeof user.note !== 'string') {
                    throw new Error(`用户 ${key} 的 note 必须是字符串`);
                }
                (user.tags || []).forEach(tag => {
                    if (!isPlainObject(tag) || typeof tag.name !== 'string' || !normalizeText(tag.name, 100)) {
                        throw new Error(`用户 ${key} 包含无效标签`);
                    }
                    if (tag.category !== undefined && typeof tag.category !== 'string') {
                        throw new Error(`用户 ${key} 的标签分类无效`);
                    }
                });
                if (user.records !== undefined) {
                    if (!Array.isArray(user.records)) {
                        throw new Error(`用户 ${key} 的 records 必须是数组`);
                    }
                    user.records.forEach((record, recIdx) => {
                        if (!isPlainObject(record)) {
                            throw new Error(`用户 ${key} 的 records[${recIdx}] 无效，必须是对象`);
                        }
                        if (record.id !== undefined && typeof record.id !== 'string') {
                            throw new Error(`用户 ${key} 的 records[${recIdx}] id 无效`);
                        }
                        if (record.time !== undefined && typeof record.time !== 'number') {
                            throw new Error(`用户 ${key} 的 records[${recIdx}] time 无效`);
                        }
                        if (record.sourceUrl !== undefined && typeof record.sourceUrl !== 'string') {
                            throw new Error(`用户 ${key} 的 records[${recIdx}] sourceUrl 无效`);
                        }
                        if (record.sourceTitle !== undefined && typeof record.sourceTitle !== 'string') {
                            throw new Error(`用户 ${key} 的 records[${recIdx}] sourceTitle 无效`);
                        }
                        if (record.quote !== undefined && typeof record.quote !== 'string') {
                            throw new Error(`用户 ${key} 的 records[${recIdx}] quote 无效`);
                        }
                        if (record.note !== undefined && typeof record.note !== 'string') {
                            throw new Error(`用户 ${key} 的 records[${recIdx}] note 无效`);
                        }
                        if (record.tags !== undefined) {
                            if (!Array.isArray(record.tags)) {
                                throw new Error(`用户 ${key} 的 records[${recIdx}] tags 必须是数组`);
                            }
                            record.tags.forEach(tag => {
                                if (!isPlainObject(tag) || typeof tag.name !== 'string' || !normalizeText(tag.name, 100)) {
                                    throw new Error(`用户 ${key} 的 records[${recIdx}] 包含无效标签`);
                                }
                                if (tag.category !== undefined && typeof tag.category !== 'string') {
                                    throw new Error(`用户 ${key} 的 records[${recIdx}] 标签分类无效`);
                                }
                            });
                        }
                    });
                }
            });
        }
    }

    function mergeCategories(baseCategories, incomingCategories) {
        const merged = cloneData(baseCategories);
        incomingCategories.forEach(incoming => {
            const existing = merged.find(category => category.id === incoming.id);
            if (!existing) {
                merged.push(cloneData(incoming));
                return;
            }

            existing.title = incoming.title || existing.title;
            existing.defaultEmoji = incoming.defaultEmoji || existing.defaultEmoji;
            existing.candidateEmojis = incoming.candidateEmojis.length > 0
                ? cloneData(incoming.candidateEmojis)
                : existing.candidateEmojis;
            existing.colorScheme = cloneData(incoming.colorScheme);
            const tagIndexes = new Map((existing.tags || []).map((tag, index) => [tag.name, index]));
            (incoming.tags || []).forEach(tag => {
                const index = tagIndexes.get(tag.name);
                if (index === undefined) {
                    tagIndexes.set(tag.name, existing.tags.length);
                    existing.tags.push(cloneData(tag));
                } else {
                    existing.tags[index] = cloneData(tag);
                }
            });
        });
        return normalizeCategories(merged);
    }

    function mergeUserData(existing, incoming, categories) {
        if (!isPlainObject(existing) && !isPlainObject(incoming)) return null;

        const defaultCategories = categories || DEFAULT_CATEGORIES;
        const usernameHint = (incoming && incoming.username) || (existing && existing.username) || '';
        const normExisting = isPlainObject(existing)
            ? normalizeUserData(existing.username || usernameHint, existing, defaultCategories)
            : null;
        const normIncoming = isPlainObject(incoming)
            ? normalizeUserData(incoming.username || usernameHint, incoming, defaultCategories)
            : null;

        if (!normExisting && !normIncoming) return null;
        if (!normExisting) return normIncoming;
        if (!normIncoming) return normExisting;

        const tags = [...(normExisting.tags || []).map(cloneData)];
        const tagIndexes = new Map(tags.map((tag, index) => [getTagKey(tag), index]));
        (normIncoming.tags || []).forEach(tag => {
            const key = getTagKey(tag);
            const index = tagIndexes.get(key);
            if (index === undefined) {
                tagIndexes.set(key, tags.length);
                tags.push(cloneData(tag));
            } else {
                tags[index] = cloneData(tag);
            }
        });

        const mergedRecords = [];
        const getCompKey = (r) => (r && r.time > 0 && r.sourceUrl) ? `${r.time}\u0000${r.sourceUrl}` : null;

        function addRecord(record, isIncoming) {
            const compKey = getCompKey(record);
            const existingIdx = mergedRecords.findIndex(item => {
                if (record.id && item.id && record.id === item.id) return true;
                if (compKey && getCompKey(item) === compKey) return true;
                return false;
            });

            if (existingIdx === -1) {
                mergedRecords.push(cloneData(record));
            } else if (isIncoming) {
                mergedRecords[existingIdx] = cloneData(record);
            }
        }

        (normExisting.records || []).forEach(r => addRecord(r, false));
        (normIncoming.records || []).forEach(r => addRecord(r, true));

        mergedRecords.sort((a, b) => b.time - a.time);

        const updatedAt = Math.max(
            normExisting.updatedAt || 0,
            normIncoming.updatedAt || 0,
            mergedRecords[0]?.time || 0
        );
        const sourceUrl = mergedRecords[0]?.sourceUrl || normIncoming.sourceUrl || normExisting.sourceUrl || '';
        const sourceTitle = mergedRecords[0]?.sourceTitle || normIncoming.sourceTitle || normExisting.sourceTitle || '';
        const note = normIncoming.note || normExisting.note || mergedRecords[0]?.note || '';
        const username = normIncoming.username || normExisting.username;

        return {
            username,
            tags,
            note,
            sourceUrl,
            sourceTitle,
            updatedAt,
            records: mergedRecords
        };
    }

    function startsWithEmoji(str) {
        if (!str) return false;
        const emojiRegex = /^(\p{Extended_Pictographic}|\p{Emoji_Presentation})/u;
        return emojiRegex.test(str.trim());
    }

    function smartFormatTagName(categoryId, rawName, selectedEmoji = null) {
        let name = rawName.trim();
        if (!name) return "";

        if (selectedEmoji) {
            if (startsWithEmoji(name)) {
                name = name.replace(/^(\p{Extended_Pictographic}|\p{Emoji_Presentation})\s*/u, '');
            }
            return `${selectedEmoji} ${name}`;
        }

        if (startsWithEmoji(name)) {
            return name;
        }

        for (const rule of KEYWORD_EMOJI_RULES) {
            if (rule.keywords.some(kw => name.toLowerCase().includes(kw))) {
                return `${rule.emoji} ${name}`;
            }
        }

        const categories = (typeof storage !== 'undefined' && storage && typeof storage.getCategories === 'function')
            ? storage.getCategories()
            : DEFAULT_CATEGORIES;
        const cat = categories.find(c => c.id === categoryId);
        const fallback = cat ? cat.defaultEmoji : "🏷️";
        return `${fallback} ${name}`;
    }

    // ==========================================
    // 3. 存储管理模块 (Storage Manager)
    // ==========================================
    class StorageManager {
        constructor() {
            this.cache = this.load();
            this.initSync();
        }

        initSync() {
            if (typeof GM_addValueChangeListener === 'function') {
                try {
                    GM_addValueChangeListener(STORAGE_KEY, (name, oldValue, newValue, remote) => {
                        if (remote === false || newValue == null) return;
                        try {
                            const data = typeof newValue === 'string' ? JSON.parse(newValue) : newValue;
                            if (isPlainObject(data)) {
                                const categories = normalizeCategories(data.categories);
                                this.cache = {
                                    users: normalizeUsers(data.users, categories),
                                    categories
                                };
                                renderAllTags();
                            }
                        } catch (e) {
                            console.error('[LD Tagger] 多页面同步解析失败', e);
                        }
                    });
                } catch (e) {
                    console.warn('[LD Tagger] GM_addValueChangeListener 注册失败', e);
                }
            }
        }

        load() {
            if (typeof GM_getValue !== 'function') {
                return {
                    users: Object.create(null),
                    categories: normalizeCategories(DEFAULT_CATEGORIES)
                };
            }
            const raw = GM_getValue(STORAGE_KEY, null);
            if (!raw) {
                const initData = {
                    users: Object.create(null),
                    categories: normalizeCategories(DEFAULT_CATEGORIES)
                };
                this.save(initData);
                return initData;
            }
            try {
                const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
                if (!isPlainObject(data)) throw new Error('存储数据不是对象');
                const categories = normalizeCategories(data.categories);
                return {
                    users: normalizeUsers(data.users, categories),
                    categories
                };
            } catch (e) {
                console.error('[LD Tagger] 数据解析失败，重置为默认', e);
                return { users: Object.create(null), categories: normalizeCategories(DEFAULT_CATEGORIES) };
            }
        }

        save(data = this.cache, syncToCloud = true) {
            if (typeof GM_setValue === 'function') {
                GM_setValue(STORAGE_KEY, JSON.stringify(data));
            }
            this.cache = data;
            if (syncToCloud && typeof GistSync !== 'undefined' && GistSync && typeof GistSync.triggerAutoSync === 'function') {
                GistSync.triggerAutoSync();
            }
        }

        getUser(username) {
            const normalizedUsername = normalizeUsername(username);
            if (!normalizedUsername) return null;
            return this.cache.users[normalizedUsername.toLowerCase()] || null;
        }

        setUser(username, userData) {
            const normalizedUsername = normalizeUsername(username);
            if (!normalizedUsername) return;
            const key = normalizedUsername.toLowerCase();
            const normalizedUser = userData
                ? normalizeUserData(normalizedUsername, userData, this.cache.categories)
                : null;
            if (!normalizedUser || (normalizedUser.tags.length === 0 && !normalizedUser.note)) {
                delete this.cache.users[key];
            } else {
                this.cache.users[key] = {
                    ...normalizedUser,
                    updatedAt: Date.now()
                };
            }
            this.save();
        }

        getAllUsers() {
            return this.cache.users;
        }

        getCategories() {
            return this.cache.categories || DEFAULT_CATEGORIES;
        }

        addPresetTag(categoryId, formattedName) {
            const cat = this.getCategories().find(c => c.id === categoryId);
            if (!cat) return;
            if (!Array.isArray(cat.tags)) cat.tags = [];
            if (cat.tags.some(t => getTagKey(t) === getTagKey(categoryId, formattedName))) return;

            const scheme = cat.colorScheme || (categoryId === 'good' 
                ? { color: "#0e6251", bg: "#d1f2eb", border: "#76d7c4" } 
                : { color: "#922b21", bg: "#fadbd8", border: "#f1948a" });

            cat.tags.push({
                name: formattedName,
                color: scheme.color,
                bg: scheme.bg,
                border: scheme.border,
                category: categoryId
            });
            this.save();
        }

        deletePresetTag(categoryId, tagName) {
            const cat = this.getCategories().find(c => c.id === categoryId);
            if (!cat) return;
            cat.tags = (cat.tags || []).filter(t => getTagKey(t) !== getTagKey(categoryId, tagName));
            this.save();
        }

        exportJSON() {
            return JSON.stringify(this.cache, null, 2);
        }

        importJSON(jsonStr, shouldAutoSync = true) {
            try {
                const imported = JSON.parse(jsonStr);
                validateImportShape(imported);
                const incomingCategories = Array.isArray(imported.categories) && imported.categories.length > 0
                    ? normalizeCategories(imported.categories)
                    : null;
                const categories = incomingCategories
                    ? mergeCategories(this.cache.categories, incomingCategories)
                    : normalizeCategories(this.cache.categories);
                const importedUsers = normalizeUsers(imported.users || {}, categories);
                const mergedUsers = normalizeUsers(this.cache.users, categories);

                Object.values(importedUsers).forEach(incomingUser => {
                    const key = incomingUser.username.toLowerCase();
                    mergedUsers[key] = mergedUsers[key]
                        ? mergeUserData(mergedUsers[key], incomingUser, categories)
                        : incomingUser;
                });

                this.cache = { users: mergedUsers, categories };
                this.save(this.cache, shouldAutoSync);
                return { success: true, count: Object.keys(importedUsers).length };
            } catch (e) {
                return { success: false, error: e.message };
            }
        }
    }

    // ==========================================
    // 4. GitHub Gist 云同步模块 (GistSync)
    // ==========================================
    const GistSync = {
        autoSyncTimer: null,

        getConfig() {
            const raw = GM_getValue(GIST_CONFIG_KEY, null);
            if (!raw) {
                return { token: '', gistId: '', autoSync: false, lastSyncTime: 0, lastStatus: '' };
            }
            try {
                const conf = typeof raw === 'string' ? JSON.parse(raw) : raw;
                return {
                    token: typeof conf.token === 'string' ? conf.token.trim() : '',
                    gistId: typeof conf.gistId === 'string' ? conf.gistId.trim() : '',
                    autoSync: Boolean(conf.autoSync),
                    lastSyncTime: Number(conf.lastSyncTime) || 0,
                    lastStatus: typeof conf.lastStatus === 'string' ? conf.lastStatus : ''
                };
            } catch (e) {
                return { token: '', gistId: '', autoSync: false, lastSyncTime: 0, lastStatus: '' };
            }
        },

        saveConfig(conf) {
            GM_setValue(GIST_CONFIG_KEY, JSON.stringify(conf));
        },

        triggerAutoSync() {
            const conf = this.getConfig();
            if (!conf.token || !conf.autoSync) return;

            if (this.autoSyncTimer) clearTimeout(this.autoSyncTimer);
            this.autoSyncTimer = setTimeout(() => {
                this.uploadToGist((res) => {
                    if (res.success) {
                        console.log('[LD Tagger] 云端自动同步成功');
                    } else {
                        console.warn('[LD Tagger] 云端自动同步失败:', res.error);
                    }
                });
            }, 3000);
        },

        uploadToGist(callback) {
            const conf = this.getConfig();
            if (!conf.token) {
                return callback({ success: false, error: '请先填写 GitHub Personal Access Token (PAT)' });
            }
            if (typeof GM_xmlhttpRequest !== 'function') {
                return callback({ success: false, error: '当前环境不支持 GM_xmlhttpRequest，无法进行网络同步' });
            }

            const dataStr = storage.exportJSON();
            const payload = {
                description: 'LinuxDo User Tagger 数据云端备份',
                public: false,
                files: {
                    [GIST_FILENAME]: {
                        content: dataStr
                    }
                }
            };

            const isUpdate = Boolean(conf.gistId);
            const url = isUpdate ? `https://api.github.com/gists/${conf.gistId}` : 'https://api.github.com/gists';
            const method = isUpdate ? 'PATCH' : 'POST';

            GM_xmlhttpRequest({
                method: method,
                url: url,
                headers: {
                    'Authorization': `Bearer ${conf.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'LinuxDo-User-Tagger-Script'
                },
                data: JSON.stringify(payload),
                timeout: 15000,
                onload: (response) => {
                    try {
                        const resData = JSON.parse(response.responseText || '{}');
                        if (response.status >= 200 && response.status < 300) {
                            const newGistId = resData.id || conf.gistId;
                            conf.gistId = newGistId;
                            conf.lastSyncTime = Date.now();
                            conf.lastStatus = '上传成功';
                            this.saveConfig(conf);
                            callback({ success: true, gistId: newGistId });
                        } else {
                            const errMsg = resData.message || `HTTP ${response.status}`;
                            conf.lastStatus = `上传失败: ${errMsg}`;
                            this.saveConfig(conf);
                            callback({ success: false, error: errMsg });
                        }
                    } catch (err) {
                        callback({ success: false, error: '解析 GitHub 响应失败' });
                    }
                },
                onerror: () => {
                    callback({ success: false, error: '网络请求失败，请检查网络或代理' });
                },
                ontimeout: () => {
                    callback({ success: false, error: '请求超时，请检查 GitHub 连通性' });
                }
            });
        },

        downloadFromGist(callback) {
            const conf = this.getConfig();
            if (!conf.token) {
                return callback({ success: false, error: '请先填写 GitHub Personal Access Token (PAT)' });
            }
            if (!conf.gistId) {
                return callback({ success: false, error: '请先填写 Gist ID 或先点击一次“上传”自动创建' });
            }
            if (typeof GM_xmlhttpRequest !== 'function') {
                return callback({ success: false, error: '当前环境不支持 GM_xmlhttpRequest，无法进行网络同步' });
            }

            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://api.github.com/gists/${conf.gistId}`,
                headers: {
                    'Authorization': `Bearer ${conf.token}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'LinuxDo-User-Tagger-Script'
                },
                timeout: 15000,
                onload: (response) => {
                    try {
                        const resData = JSON.parse(response.responseText || '{}');
                        if (response.status >= 200 && response.status < 300) {
                            const fileObj = resData.files && resData.files[GIST_FILENAME];
                            if (!fileObj || !fileObj.content) {
                                return callback({ success: false, error: `Gist 中未找到备份文件 ${GIST_FILENAME}` });
                            }
                            const importRes = storage.importJSON(fileObj.content, false);
                            if (importRes.success) {
                                conf.lastSyncTime = Date.now();
                                conf.lastStatus = '拉取成功';
                                this.saveConfig(conf);
                                callback({ success: true, count: importRes.count });
                            } else {
                                callback({ success: false, error: `合并失败: ${importRes.error}` });
                            }
                        } else {
                            const errMsg = resData.message || `HTTP ${response.status}`;
                            callback({ success: false, error: errMsg });
                        }
                    } catch (err) {
                        callback({ success: false, error: '解析 Gist 内容失败' });
                    }
                },
                onerror: () => {
                    callback({ success: false, error: '网络请求失败，请检查网络或代理' });
                },
                ontimeout: () => {
                    callback({ success: false, error: '请求超时，请检查 GitHub 连通性' });
                }
            });
        }
    };

    const storage = new StorageManager();

    // ==========================================
    // 5. UI 样式注入 (CSS)
    // ==========================================
    const CSS_STYLES = `
        /* 标签栏容器：强制独占一行，置于用户名正下方 */
        .ld-tagger-bar {
            display: flex !important;
            align-items: center !important;
            flex-wrap: wrap !important;
            gap: 5px !important;
            margin-top: 4px !important;
            margin-bottom: 2px !important;
            font-size: 12px !important;
            line-height: 1.4 !important;
            user-select: none !important;
            flex-basis: 100% !important;
            width: 100% !important;
            order: 999 !important;
            clear: both !important;
        }

        /* 标签徽章 */
        .ld-tag-badge {
            display: inline-flex !important;
            align-items: center !important;
            padding: 2px 8px !important;
            border-radius: 12px !important;
            font-weight: 600 !important;
            font-size: 11px !important;
            border: 1px solid transparent !important;
            cursor: pointer !important;
            transition: all 0.15s ease !important;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08) !important;
        }
        .ld-tag-badge:hover {
            opacity: 0.9;
            transform: translateY(-1px);
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15) !important;
        }

        /* 添加标签按钮 */
        .ld-tag-add-btn {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 1px 7px !important;
            border-radius: 8px !important;
            font-size: 11px !important;
            color: var(--primary-medium, #888) !important;
            background: var(--primary-very-low, rgba(120, 120, 120, 0.1)) !important;
            border: 1px dashed var(--primary-low, #ccc) !important;
            cursor: pointer !important;
            opacity: 0.65 !important;
            transition: all 0.2s ease !important;
        }
        .ld-tag-add-btn:hover {
            opacity: 1 !important;
            color: var(--tertiary, #0088cc) !important;
            border-color: var(--tertiary, #0088cc) !important;
            background: var(--tertiary-low, rgba(0, 136, 204, 0.12)) !important;
        }

        /* 备注 Hover Tooltip */
        .ld-tooltip {
            position: fixed;
            z-index: 100010;
            max-width: 320px;
            padding: 8px 12px;
            background: #1f2937;
            color: #f3f4f6;
            border-radius: 6px;
            font-size: 12px;
            line-height: 1.5;
            box-shadow: 0 8px 20px rgba(0,0,0,0.35);
            pointer-events: none;
            display: none;
            opacity: 0;
            transition: opacity 0.15s ease;
        }
        .ld-tooltip.show {
            display: block;
            opacity: 1;
        }

        /* 打标浮动弹窗 Popover */
        .ld-popover-mask {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            z-index: 100000;
            background: rgba(0, 0, 0, 0.35);
            backdrop-filter: blur(1.5px);
        }
        .ld-popover {
            position: fixed;
            z-index: 100005;
            width: 390px;
            max-width: calc(100vw - 20px);
            max-height: calc(100vh - 20px);
            background: var(--secondary, #ffffff);
            color: var(--primary, #222222);
            border: 1px solid var(--primary-low, #d0d0d0);
            border-radius: 12px;
            box-shadow: 0 12px 35px rgba(0, 0, 0, 0.28);
            padding: 16px;
            font-size: 13px;
            box-sizing: border-box;
            overflow-y: auto;
            animation: ldFadeIn 0.15s ease-out;
        }
        @keyframes ldFadeIn {
            from { opacity: 0; transform: scale(0.96); }
            to { opacity: 1; transform: scale(1); }
        }

        .ld-popover-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--primary-low, #eee);
            font-weight: bold;
        }
        .ld-popover-title {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 14px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .ld-popover-close {
            cursor: pointer;
            color: var(--primary-medium, #888);
            font-size: 18px;
            line-height: 1;
            padding: 0 4px;
        }
        .ld-popover-close:hover {
            color: var(--danger, #e74c3c);
        }

        /* 当前已有标签与备注面板 */
        .ld-current-section {
            background: var(--primary-very-low, rgba(0,0,0,0.03));
            border: 1px solid var(--primary-low, #e5e7eb);
            border-radius: 8px;
            padding: 10px;
            margin-bottom: 12px;
        }
        .ld-current-tags-wrapper {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-top: 5px;
            margin-bottom: 8px;
            min-height: 24px;
            align-items: center;
        }
        .ld-current-tag-pill {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            box-shadow: 0 1px 2px rgba(0,0,0,0.06);
        }
        .ld-current-tag-del {
            cursor: pointer;
            font-size: 13px;
            line-height: 1;
            opacity: 0.7;
        }
        .ld-current-tag-del:hover {
            opacity: 1;
            font-weight: bold;
        }

        /* 标签分类卡片 */
        .ld-category-box {
            margin-bottom: 10px;
            padding: 10px;
            border-radius: 8px;
            border: 1px solid var(--primary-low, #eee);
        }
        .ld-category-box.box-good {
            background: rgba(46, 204, 113, 0.05);
            border-color: rgba(46, 204, 113, 0.25);
        }
        .ld-category-box.box-bad {
            background: rgba(231, 76, 60, 0.05);
            border-color: rgba(231, 76, 60, 0.25);
        }
        .ld-category-header {
            font-size: 12px;
            font-weight: bold;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .box-good .ld-category-header { color: #16a085; }
        .box-bad .ld-category-header { color: #c0392b; }

        .ld-cat-actions {
            display: flex;
            gap: 6px;
        }
        .ld-cat-btn {
            font-size: 10px;
            padding: 1px 6px;
            border-radius: 4px;
            cursor: pointer;
            border: 1px solid var(--primary-low, #ccc);
            background: var(--secondary, #fff);
            color: var(--primary, #555);
            transition: all 0.15s ease;
        }
        .ld-cat-btn:hover {
            border-color: var(--tertiary, #0088cc);
            color: var(--tertiary, #0088cc);
        }
        .ld-cat-btn.active-del {
            background: #e74c3c;
            color: #fff;
            border-color: #c0392b;
        }

        .ld-preset-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            align-items: center;
        }
        .ld-preset-chip {
            position: relative;
            padding: 3px 9px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 500;
            cursor: pointer;
            border: 1px solid transparent;
            transition: all 0.15s ease;
            user-select: none;
            display: inline-flex;
            align-items: center;
        }
        .ld-preset-chip:hover {
            transform: scale(1.05);
            box-shadow: 0 2px 5px rgba(0,0,0,0.12);
        }
        .ld-preset-chip.active {
            box-shadow: 0 0 0 2px var(--tertiary, #0088cc);
            font-weight: bold;
        }

        /* 删除模式下的右上角小叉叉 */
        .ld-preset-chip .ld-chip-remove-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 13px;
            height: 13px;
            border-radius: 50%;
            background: #e74c3c;
            color: #ffffff;
            font-size: 10px;
            margin-left: 4px;
            line-height: 1;
            font-weight: bold;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            transition: transform 0.15s ease;
        }
        .ld-preset-chip .ld-chip-remove-btn:hover {
            transform: scale(1.25);
            background: #c0392b;
        }

        /* 新增标签区域与 Emoji 快捷池 */
        .ld-add-panel {
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px dashed var(--primary-low, #ccc);
        }
        .ld-emoji-pool {
            display: flex;
            gap: 5px;
            margin-bottom: 6px;
            align-items: center;
            flex-wrap: wrap;
        }
        .ld-emoji-chip {
            cursor: pointer;
            padding: 1px 5px;
            border-radius: 4px;
            font-size: 13px;
            background: var(--secondary, #fff);
            border: 1px solid var(--primary-low, #ddd);
            transition: all 0.15s ease;
            user-select: none;
        }
        .ld-emoji-chip:hover {
            transform: scale(1.15);
            border-color: var(--tertiary, #0088cc);
        }
        .ld-emoji-chip.active {
            border-color: var(--tertiary, #0088cc);
            background: var(--tertiary-low, rgba(0,136,204,0.15));
            font-weight: bold;
        }

        .ld-add-tag-inline {
            display: flex;
            gap: 4px;
            width: 100%;
        }
        .ld-add-tag-input {
            flex: 1;
            padding: 4px 8px;
            border-radius: 4px;
            border: 1px solid var(--primary-low, #ccc);
            background: var(--secondary, #fff);
            color: var(--primary, #333);
            font-size: 11px;
        }
        .ld-add-tag-input:focus {
            outline: none;
            border-color: var(--tertiary, #0088cc);
        }

        /* 备注输入框 */
        .ld-note-input {
            width: 100%;
            padding: 5px 8px;
            border-radius: 5px;
            border: 1px solid var(--primary-low, #ccc);
            background: var(--secondary, #fff);
            color: var(--primary, #333);
            font-size: 12px;
            box-sizing: border-box;
            font-family: inherit;
        }
        .ld-note-input:focus {
            outline: none;
            border-color: var(--tertiary, #0088cc);
        }

        /* 底部操作按钮 */
        .ld-popover-footer {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid var(--primary-low, #eee);
        }
        .ld-btn {
            padding: 5px 12px;
            border-radius: 5px;
            font-size: 12px;
            cursor: pointer;
            border: none;
            transition: opacity 0.2s;
        }
        .ld-btn:hover { opacity: 0.85; }
        .ld-btn-primary { background: var(--tertiary, #0088cc); color: #fff; }
        .ld-btn-danger { background: #e74c3c; color: #fff; }
        .ld-btn-secondary { background: var(--primary-low, #eee); color: var(--primary, #333); }

        /* 防冲动回帖警示气泡 */
        .ld-anti-impulse-warning {
            position: fixed;
            z-index: 100020;
            padding: 8px 14px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: bold;
            color: #ffffff;
            background: linear-gradient(135deg, #e74c3c, #c0392b);
            box-shadow: 0 8px 24px rgba(192, 57, 43, 0.45);
            border: 1px solid #f1948a;
            display: flex;
            align-items: center;
            gap: 6px;
            animation: ldPulseWarning 0.4s ease-in-out infinite alternate;
            pointer-events: none;
            transition: opacity 0.4s ease;
        }
        @keyframes ldPulseWarning {
            0% { transform: translateY(0) scale(1); box-shadow: 0 6px 20px rgba(192, 57, 43, 0.4); }
            100% { transform: translateY(-3px) scale(1.03); box-shadow: 0 10px 28px rgba(192, 57, 43, 0.65); }
        }

        /* 全局管理 Modal */
        .ld-modal {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 620px;
            max-width: 92vw;
            max-height: 85vh;
            background: var(--secondary, #ffffff);
            color: var(--primary, #222222);
            border-radius: 12px;
            box-shadow: 0 12px 35px rgba(0,0,0,0.3);
            z-index: 100005;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        .ld-modal-body {
            padding: 16px;
            overflow-y: auto;
            flex: 1;
        }
        .ld-user-list-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 12px;
            border-bottom: 1px solid var(--primary-low, #eee);
        }
        .ld-user-list-item:hover {
            background: var(--primary-very-low, rgba(0,0,0,0.03));
        }

        /* GitHub 云同步面板 */
        .ld-gist-section {
            background: var(--primary-very-low, rgba(0,0,0,0.02));
            border: 1px solid var(--primary-low, #e5e7eb);
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 14px;
        }
        .ld-gist-title {
            font-size: 13px;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 8px;
        }
        .ld-gist-row {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
        }
        .ld-gist-label {
            font-size: 11px;
            font-weight: 500;
            width: 95px;
            color: var(--primary-medium, #666);
            flex-shrink: 0;
        }
        .ld-gist-input {
            flex: 1;
            padding: 5px 8px;
            border-radius: 4px;
            border: 1px solid var(--primary-low, #ccc);
            background: var(--secondary, #fff);
            color: var(--primary, #333);
            font-size: 11px;
            font-family: monospace;
        }
        .ld-gist-input:focus {
            outline: none;
            border-color: var(--tertiary, #0088cc);
        }
        .ld-gist-actions {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-top: 10px;
            padding-top: 8px;
            border-top: 1px dashed var(--primary-low, #ddd);
            flex-wrap: wrap;
            gap: 8px;
        }
        .ld-gist-status {
            font-size: 11px;
            color: var(--primary-medium, #777);
        }

        @media (max-width: 600px) {
            .ld-popover-footer {
                flex-wrap: wrap;
                gap: 8px;
            }
            .ld-modal > div:nth-child(2) {
                flex-wrap: wrap;
            }
            .ld-modal > div:nth-child(2) > div {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
            }
        }
    `;

    if (typeof GM_addStyle === 'function') {
        GM_addStyle(CSS_STYLES);
    }

    // ==========================================
    // 5. 单例 Tooltip 模块 (安全转义)
    // ==========================================
    const tooltip = {
        el: null,
        init() {
            if (this.el) return;
            this.el = document.createElement('div');
            this.el.className = 'ld-tooltip';
            document.body.appendChild(this.el);
        },
        show(e, html) {
            this.init();
            this.el.innerHTML = html;
            this.el.classList.add('show');
            const rect = e.target.getBoundingClientRect();
            const left = Math.min(rect.left, window.innerWidth - 330);
            const top = rect.bottom + 6;
            this.el.style.left = `${Math.max(8, left)}px`;
            this.el.style.top = `${top}px`;
        },
        hide() {
            if (this.el) {
                this.el.classList.remove('show');
            }
        }
    };

    // ==========================================
    // 6. Popover 编辑弹窗模块 (全响应式 + 安全转义)
    // ==========================================
    const popover = {
        maskEl: null,
        popEl: null,
        currentUser: null,
        userData: null,
        deleteModeMap: { good: false, bad: false },
        addingCategory: null,
        selectedEmojiMap: {},

        open(username, triggerElement) {
            this.close();
            this.currentUser = username;
            this.deleteModeMap = { good: false, bad: false };
            this.addingCategory = null;
            this.selectedEmojiMap = {};
            
            const rawUser = storage.getUser(username);
            this.userData = rawUser ? JSON.parse(JSON.stringify(rawUser)) : {
                username: username,
                tags: [],
                note: "",
                sourceUrl: window.location.href,
                sourceTitle: document.title.replace(' - LINUX DO', '').trim()
            };

            this.maskEl = document.createElement('div');
            this.maskEl.className = 'ld-popover-mask';
            this.maskEl.addEventListener('click', () => this.close());

            this.popEl = document.createElement('div');
            this.popEl.className = 'ld-popover';

            const rect = triggerElement.getBoundingClientRect();
            const popWidth = Math.min(390, window.innerWidth - 20);
            const popHeight = 490;

            let posX = rect.left;
            if (posX + popWidth > window.innerWidth - 10) {
                posX = window.innerWidth - popWidth - 10;
            }
            posX = Math.max(8, posX);

            let posY = rect.bottom + 6;
            if (posY + popHeight > window.innerHeight - 15) {
                posY = Math.max(10, rect.top - popHeight - 6);
            }

            this.popEl.style.left = `${posX}px`;
            this.popEl.style.top = `${posY}px`;

            this.render();
            document.body.appendChild(this.maskEl);
            document.body.appendChild(this.popEl);
        },

        render() {
            const categories = storage.getCategories();
            const currentTagKeys = new Set((this.userData.tags || []).map(getTagKey));

            // 1. 已有标签区 HTML
            let currentTagsHtml = '<span style="font-size: 11px; color: var(--primary-medium, #999);">暂未打标签</span>';
            if (this.userData.tags && this.userData.tags.length > 0) {
                currentTagsHtml = this.userData.tags.map((t, idx) => `
                    <span class="ld-current-tag-pill" style="color: ${escapeHtml(t.color)}; background: ${escapeHtml(t.bg)}; border: 1px solid ${escapeHtml(t.border)};">
                        ${escapeHtml(t.name)}
                        <span class="ld-current-tag-del" data-idx="${idx}" title="移除此标签">&times;</span>
                    </span>
                `).join('');
            }

            // 2. 分类标签池 HTML
            const categoriesHtml = categories.map(cat => {
                const boxClass = cat.id === 'good' ? 'box-good' : 'box-bad';
                const isDelMode = this.deleteModeMap[cat.id];
                const isAdding = this.addingCategory === cat.id;
                const candidateEmojis = cat.candidateEmojis || DEFAULT_CATEGORIES.find(c => c.id === cat.id)?.candidateEmojis || ["✨", "💡", "🎯"];
                const activeSelectedEmoji = this.selectedEmojiMap[cat.id] || null;

                const chipsHtml = cat.tags.map(p => {
                    const active = currentTagKeys.has(getTagKey(cat.id, p.name)) ? 'active' : '';
                    return `
                        <div class="ld-preset-chip ${active}" 
                             data-cat="${escapeHtml(cat.id)}" 
                             data-name="${escapeHtml(p.name)}" 
                             style="color: ${escapeHtml(p.color)}; background: ${escapeHtml(p.bg)}; border-color: ${escapeHtml(p.border)};">
                            <span>${escapeHtml(p.name)}</span>
                            ${isDelMode ? `<span class="ld-chip-remove-btn" title="删除该预设标签">&times;</span>` : ''}
                        </div>
                    `;
                }).join('');

                return `
                    <div class="ld-category-box ${boxClass}">
                        <div class="ld-category-header">
                            <span>${escapeHtml(cat.title)}</span>
                            <div class="ld-cat-actions">
                                <button class="ld-cat-btn ld-btn-add-tag" data-cat="${escapeHtml(cat.id)}">➕ 新增</button>
                                <button class="ld-cat-btn ${isDelMode ? 'active-del' : ''} ld-btn-toggle-del" data-cat="${escapeHtml(cat.id)}">
                                    ${isDelMode ? '✓ 完成' : '🗑️ 管理'}
                                </button>
                            </div>
                        </div>

                        <div class="ld-preset-grid">
                            ${chipsHtml}
                        </div>

                        ${isAdding ? `
                            <div class="ld-add-panel">
                                <div style="font-size: 10px; color: var(--primary-medium, #888); margin-bottom: 4px;">
                                    🎨 选择图标 (可选，或直接输入纯文字自动智能匹配):
                                </div>
                                <div class="ld-emoji-pool">
                                    ${candidateEmojis.map(em => `
                                        <span class="ld-emoji-chip ${activeSelectedEmoji === em ? 'active' : ''}" data-cat="${escapeHtml(cat.id)}" data-emoji="${escapeHtml(em)}">${escapeHtml(em)}</span>
                                    `).join('')}
                                </div>
                                <div class="ld-add-tag-inline">
                                    <input type="text" class="ld-add-tag-input" id="ld-input-new-${escapeHtml(cat.id)}" maxlength="100" placeholder="输入新标签名 (例: 代码洁癖 / 无脑吹 / 串子)..." />
                                    <button class="ld-btn ld-btn-primary ld-btn-confirm-add" data-cat="${escapeHtml(cat.id)}" style="padding: 2px 8px; font-size: 11px;">添加</button>
                                    <button class="ld-btn ld-btn-secondary ld-btn-cancel-add" style="padding: 2px 6px; font-size: 11px;">取消</button>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');

            this.popEl.innerHTML = `
                <div class="ld-popover-header">
                    <div class="ld-popover-title">
                        <span>🏷️ 标记用户: <strong>@${escapeHtml(this.userData.username)}</strong></span>
                    </div>
                    <span class="ld-popover-close">&times;</span>
                </div>

                <!-- 📌 已有标签与备注区域 -->
                <div class="ld-current-section">
                    <div style="font-size: 11px; font-weight: bold; color: var(--primary, #333);">📌 该用户已有标签:</div>
                    <div class="ld-current-tags-wrapper">
                        ${currentTagsHtml}
                    </div>
                    <div style="font-size: 11px; font-weight: bold; color: var(--primary, #333); margin-bottom: 4px;">💬 备注说明:</div>
                    <input type="text" class="ld-note-input" id="ld-note-input" maxlength="1000" value="${escapeHtml(this.userData.note || '')}" placeholder="简短备注 (选填，如：某帖抬杠 / 某领域大佬)..." />
                </div>

                <!-- 分类选择区 -->
                ${categoriesHtml}

                <div class="ld-popover-footer">
                    <button class="ld-btn ld-btn-danger" id="ld-btn-delete-all">清除打标</button>
                    <div>
                        <button class="ld-btn ld-btn-secondary" id="ld-btn-cancel" style="margin-right: 6px;">取消</button>
                        <button class="ld-btn ld-btn-primary" id="ld-btn-save">保存</button>
                    </div>
                </div>
            `;

            this.bindEvents();
        },

        bindEvents() {
            this.popEl.querySelector('.ld-popover-close').addEventListener('click', () => this.close());
            this.popEl.querySelector('#ld-btn-cancel').addEventListener('click', () => this.close());

            const noteInput = this.popEl.querySelector('#ld-note-input');
            if (noteInput) {
                noteInput.addEventListener('input', (e) => {
                    this.userData.note = e.target.value;
                });
            }

            this.popEl.querySelectorAll('.ld-current-tag-del').forEach(btn => {
                makeKeyboardActivatable(btn);
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const idx = parseInt(btn.getAttribute('data-idx'), 10);
                    this.userData.tags.splice(idx, 1);
                    this.render();
                });
            });

            this.popEl.querySelectorAll('.ld-preset-chip').forEach(chip => {
                makeKeyboardActivatable(chip);
                chip.addEventListener('click', (e) => {
                    const catId = chip.getAttribute('data-cat');
                    const tagName = chip.getAttribute('data-name');
                    const isDelMode = this.deleteModeMap[catId];

                    if (isDelMode) {
                        if (confirm(`确定要从分类中删除预设标签「${tagName}」吗？`)) {
                            storage.deletePresetTag(catId, tagName);
                            this.userData.tags = (this.userData.tags || []).filter(t => getTagKey(t) !== getTagKey(catId, tagName));
                            this.render();
                        }
                    } else {
                        if (!this.userData.tags) this.userData.tags = [];
                        const existingIdx = this.userData.tags.findIndex(t => getTagKey(t) === getTagKey(catId, tagName));
                        if (existingIdx >= 0) {
                            this.userData.tags.splice(existingIdx, 1);
                        } else {
                            const cat = storage.getCategories().find(c => c.id === catId);
                            const preset = cat ? cat.tags.find(t => t.name === tagName) : null;
                            if (preset) {
                                this.userData.tags.push({ ...preset });
                            }
                        }
                        this.render();
                    }
                });
            });

            this.popEl.querySelectorAll('.ld-btn-toggle-del').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const catId = btn.getAttribute('data-cat');
                    this.deleteModeMap[catId] = !this.deleteModeMap[catId];
                    this.render();
                });
            });

            this.popEl.querySelectorAll('.ld-btn-add-tag').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const catId = btn.getAttribute('data-cat');
                    this.addingCategory = catId;
                    this.render();
                    setTimeout(() => {
                        const input = this.popEl.querySelector(`#ld-input-new-${catId}`);
                        if (input) input.focus();
                    }, 50);
                });
            });

            this.popEl.querySelectorAll('.ld-emoji-chip').forEach(emojiBtn => {
                makeKeyboardActivatable(emojiBtn);
                emojiBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const catId = emojiBtn.getAttribute('data-cat');
                    const em = emojiBtn.getAttribute('data-emoji');
                    if (this.selectedEmojiMap[catId] === em) {
                        delete this.selectedEmojiMap[catId];
                    } else {
                        this.selectedEmojiMap[catId] = em;
                    }
                    this.render();
                    setTimeout(() => {
                        const input = this.popEl.querySelector(`#ld-input-new-${catId}`);
                        if (input) input.focus();
                    }, 30);
                });
            });

            const cancelAddBtn = this.popEl.querySelector('.ld-btn-cancel-add');
            if (cancelAddBtn) {
                cancelAddBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.addingCategory = null;
                    this.render();
                });
            }

            const handleConfirmAdd = (catId) => {
                const input = this.popEl.querySelector(`#ld-input-new-${catId}`);
                if (!input) return;
                const rawVal = input.value.trim();
                if (rawVal) {
                    const chosenEmoji = this.selectedEmojiMap[catId] || null;
                    const formattedName = smartFormatTagName(catId, rawVal, chosenEmoji);

                    storage.addPresetTag(catId, formattedName);
                    const cat = storage.getCategories().find(c => c.id === catId);
                    const newTag = cat ? cat.tags.find(t => t.name === formattedName) : null;
                    if (newTag) {
                        if (!this.userData.tags) this.userData.tags = [];
                        if (!this.userData.tags.some(t => getTagKey(t) === getTagKey(catId, formattedName))) {
                            this.userData.tags.push({ ...newTag });
                        }
                    }
                }
                this.addingCategory = null;
                delete this.selectedEmojiMap[catId];
                this.render();
            };

            const confirmAddBtn = this.popEl.querySelector('.ld-btn-confirm-add');
            if (confirmAddBtn) {
                confirmAddBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const catId = confirmAddBtn.getAttribute('data-cat');
                    handleConfirmAdd(catId);
                });
            }

            if (this.addingCategory) {
                const input = this.popEl.querySelector(`#ld-input-new-${this.addingCategory}`);
                if (input) {
                    input.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            handleConfirmAdd(this.addingCategory);
                        } else if (e.key === 'Escape') {
                            this.addingCategory = null;
                            this.render();
                        }
                    });
                }
            }

            this.popEl.querySelector('#ld-btn-save').addEventListener('click', () => {
                const noteVal = this.popEl.querySelector('#ld-note-input')?.value?.trim() || '';
                this.userData.note = noteVal;
                if (!this.userData.sourceUrl) {
                    this.userData.sourceUrl = window.location.href;
                    this.userData.sourceTitle = document.title.replace(' - LINUX DO', '').trim();
                }
                storage.setUser(this.currentUser, this.userData);
                this.close();
                renderAllTags();
            });

            this.popEl.querySelector('#ld-btn-delete-all').addEventListener('click', () => {
                storage.setUser(this.currentUser, null);
                this.close();
                renderAllTags();
            });
        },

        close() {
            if (this.popEl) {
                this.popEl.remove();
                this.popEl = null;
            }
            if (this.maskEl) {
                this.maskEl.remove();
                this.maskEl = null;
            }
        }
    };

    // 全局 Esc 键快速关闭弹窗
    if (typeof document !== 'undefined') {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (popover.popEl) popover.close();
                tooltip.hide();
            }
        });
    }

    // ==========================================
    // 7. 防冲动回帖警示模块 (Anti-Impulse Warning)
    // ==========================================
    function triggerAntiImpulseWarning(triggerBtn, badTagNames) {
        document.querySelectorAll('.ld-anti-impulse-warning').forEach(el => el.remove());

        const warningEl = document.createElement('div');
        warningEl.className = 'ld-anti-impulse-warning';
        warningEl.innerHTML = `<span>⚠️ 已标记为【${escapeHtml(badTagNames.join(' / '))}】，理性交流，谨防被坑！</span>`;

        const rect = triggerBtn.getBoundingClientRect();
        const top = Math.max(10, rect.top - 42);
        const left = Math.max(10, Math.min(rect.left - 20, window.innerWidth - 360));

        warningEl.style.top = `${top}px`;
        warningEl.style.left = `${left}px`;

        document.body.appendChild(warningEl);

        setTimeout(() => {
            warningEl.style.opacity = '0';
            setTimeout(() => warningEl.remove(), 400);
        }, 3200);
    }

    // 监听点击“回复”按钮
    if (typeof document !== 'undefined' && document.body) {
        document.body.addEventListener('click', (e) => {
            const replyBtn = e.target.closest('button.reply, button.reply-to-post, .post-controls .reply, .reply-action');
            if (!replyBtn) return;

            const postArticle = replyBtn.closest('.topic-post, article.boxed, article');
            if (!postArticle) return;

            // 严格限定在帖头 meta 信息中提取作者，绝不回退至包含 .cooked 正文的整个帖子容器
            const namesTarget = postArticle.querySelector('.topic-meta-data .names') || postArticle.querySelector('.topic-meta-data');
            if (!namesTarget) return;

            const username = extractUsername(namesTarget);
            if (!username) return;

            const userData = storage.getUser(username);
            if (!userData || !userData.tags || userData.tags.length === 0) return;

            const badTags = userData.tags.filter(t => t.category === 'bad');
            if (badTags.length > 0) {
                const badNames = badTags.map(t => t.name.replace(/^[^\u4e00-\u9fa5a-zA-Z0-9]+/, ''));
                triggerAntiImpulseWarning(replyBtn, badNames);
            }
        }, true);
    }

    // ==========================================
    // 8. 核心渲染器 (Discourse DOM 注入与提取)
    // ==========================================
    function extractUsername(container) {
        if (!container) return null;

        const cardEl = container.querySelector('[data-user-card]');
        if (cardEl) {
            const cardAttr = cardEl.getAttribute('data-user-card');
            if (cardAttr && cardAttr.trim()) return cardAttr.trim().replace(/^@/, '');
            const cardText = cardEl.textContent.trim();
            if (cardText) return cardText.replace(/^@/, '');
        }

        const linkEl = container.querySelector('.username a, a.username, .user-profile-link');
        if (linkEl) {
            const u = linkEl.textContent.trim().replace(/^@/, '');
            if (u) return u;
        }

        const anyUlink = container.querySelector('a[href*="/u/"]');
        if (anyUlink) {
            const href = anyUlink.getAttribute('href') || '';
            const match = href.match(/\/u\/([^/?#]+)/);
            if (match && match[1]) {
                try {
                    return decodeURIComponent(match[1]).trim().replace(/^@/, '');
                } catch {
                    return match[1].trim().replace(/^@/, '');
                }
            }
        }

        const uEl = container.querySelector('.username');
        if (uEl) {
            const u = uEl.textContent.trim().replace(/^@/, '');
            if (u) return u;
        }

        return null;
    }

    function renderUserTags(container, username) {
        if (!container || !username) return;
        
        container.innerHTML = '';
        const userData = storage.getUser(username);
        const tags = (userData && userData.tags) ? userData.tags : [];

        // 渲染已有的标签徽章
        tags.forEach(tag => {
            const badge = document.createElement('span');
            badge.className = 'ld-tag-badge';
            badge.style.color = tag.color || '#333';
            badge.style.backgroundColor = tag.bg || '#eee';
            badge.style.borderColor = tag.border || 'transparent';
            badge.innerText = tag.name;
            makeKeyboardActivatable(badge);

            badge.addEventListener('mouseenter', (e) => {
                let tipHtml = `<strong>@${escapeHtml(username)}</strong>: ${escapeHtml(tag.name)}`;
                if (userData.note) {
                    tipHtml += `<div style="margin-top:4px;color:#ddd;">💬 ${escapeHtml(userData.note)}</div>`;
                }
                if (userData.sourceTitle) {
                    tipHtml += `<div style="margin-top:4px;font-size:10px;color:#bbb;">🔗 来源: ${escapeHtml(userData.sourceTitle)}</div>`;
                }
                if (userData.updatedAt) {
                    const dateStr = new Date(userData.updatedAt).toLocaleDateString();
                    tipHtml += `<div style="margin-top:2px;font-size:9px;color:#999;">🕒 标记时间: ${escapeHtml(dateStr)}</div>`;
                }
                tooltip.show(e, tipHtml);
            });
            badge.addEventListener('mouseleave', () => tooltip.hide());

            badge.addEventListener('click', (e) => {
                e.stopPropagation();
                tooltip.hide();
                popover.open(username, badge);
            });

            container.appendChild(badge);
        });

        // 渲染 [+] 快捷打标按钮
        const addBtn = document.createElement('span');
        addBtn.className = 'ld-tag-add-btn';
        addBtn.innerHTML = tags.length > 0 ? '+ 标签' : '🏷️ 打标';
        addBtn.title = `为 @${username} 添加或修改标签与备注`;
        makeKeyboardActivatable(addBtn);
        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            popover.open(username, addBtn);
        });

        container.appendChild(addBtn);
    }

    function scanAndInject() {
        const postHeaders = document.querySelectorAll('.topic-post .topic-meta-data, .post-stream .topic-meta-data');
        postHeaders.forEach(metaEl => {
            const namesEl = metaEl.querySelector('.names') || metaEl;
            const username = extractUsername(namesEl);
            if (!username) return;

            const normalizedKey = username.toLowerCase();
            let tagBar = namesEl.querySelector('.ld-tagger-bar');
            if (!tagBar) {
                tagBar = document.createElement('div');
                tagBar.className = 'ld-tagger-bar';
                namesEl.appendChild(tagBar);
            }

            if (tagBar.getAttribute('data-ld-user') !== normalizedKey || tagBar.getAttribute('data-ld-dirty') === 'true') {
                tagBar.setAttribute('data-ld-user', normalizedKey);
                tagBar.removeAttribute('data-ld-dirty');
                renderUserTags(tagBar, username);
            }
        });

        const userCards = document.querySelectorAll('#user-card.show-user, .user-card.show-user');
        userCards.forEach(userCard => {
            const cardNames = userCard.querySelector('.names');
            if (!cardNames) return;
            const username = extractUsername(cardNames) || extractUsername(userCard);
            if (!username) return;

            const normalizedKey = username.toLowerCase();
            let tagBar = cardNames.querySelector('.ld-tagger-bar');
            if (!tagBar) {
                tagBar = document.createElement('div');
                tagBar.className = 'ld-tagger-bar';
                cardNames.appendChild(tagBar);
            }
            if (tagBar.getAttribute('data-ld-user') !== normalizedKey || tagBar.getAttribute('data-ld-dirty') === 'true') {
                tagBar.setAttribute('data-ld-user', normalizedKey);
                tagBar.removeAttribute('data-ld-dirty');
                renderUserTags(tagBar, username);
            }
        });
    }

    function renderAllTags() {
        document.querySelectorAll('.ld-tagger-bar').forEach(bar => {
            bar.setAttribute('data-ld-dirty', 'true');
        });
        scanAndInject();
    }

    // ==========================================
    // 9. 管理后台与导入导出 Modal
    // ==========================================
    let activeManagerClose = null;

    function openManagerModal() {
        if (popover && typeof popover.close === 'function') popover.close();
        const existing = document.querySelector('.ld-modal');
        if (existing) existing.remove();
        if (activeManagerClose) activeManagerClose();

        function closeManager() {
            mask.remove();
            modal.remove();
            document.removeEventListener('keydown', closeOnEscape);
            if (activeManagerClose === closeManager) activeManagerClose = null;
        }

        function closeOnEscape(event) {
            if (event.key === 'Escape') closeManager();
        }

        const mask = document.createElement('div');
        mask.className = 'ld-popover-mask ld-manager-mask';
        mask.addEventListener('click', closeManager);

        const modal = document.createElement('div');
        modal.className = 'ld-modal';

        const gistConf = GistSync.getConfig();
        const lastSyncStr = gistConf.lastSyncTime
            ? new Date(gistConf.lastSyncTime).toLocaleString()
            : '从未同步';

        modal.innerHTML = `
            <div class="ld-popover-header" style="padding: 16px; margin-bottom: 0;">
                <div class="ld-popover-title">
                    <span>⚙️ LinuxDo User Tagger - 标签与数据管理中心</span>
                </div>
                <span class="ld-popover-close" id="ld-modal-close">&times;</span>
            </div>

            <!-- ☁️ GitHub Gist 云同步设置面板 -->
            <div style="padding: 12px 16px 0 16px;">
                <div class="ld-gist-section">
                    <div class="ld-gist-title">
                        <span>☁️ GitHub Gist 云端跨设备同步</span>
                        <label style="font-size: 11px; font-weight: normal; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                            <input type="checkbox" id="ld-gist-autosync" ${gistConf.autoSync ? 'checked' : ''} />
                            本地修改后自动同步到云端
                        </label>
                    </div>
                    <div class="ld-gist-row">
                        <span class="ld-gist-label">GitHub Token:</span>
                        <input type="password" class="ld-gist-input" id="ld-gist-token" value="${escapeHtml(gistConf.token)}" placeholder="ghp_xxx (需勾选 gist 权限)" />
                    </div>
                    <div class="ld-gist-row">
                        <span class="ld-gist-label">Gist ID (选填):</span>
                        <input type="text" class="ld-gist-input" id="ld-gist-id" value="${escapeHtml(gistConf.gistId)}" placeholder="留空时点击上传将自动新建 Private Gist" />
                    </div>
                    <div class="ld-gist-actions">
                        <div class="ld-gist-status" id="ld-gist-status-text">
                            🕒 上次同步: <strong>${escapeHtml(lastSyncStr)}</strong> ${gistConf.lastStatus ? `(${escapeHtml(gistConf.lastStatus)})` : ''}
                        </div>
                        <div style="display: flex; gap: 6px;">
                            <button class="ld-btn ld-btn-secondary" id="ld-btn-gist-download">📥 从云端拉取合并</button>
                            <button class="ld-btn ld-btn-primary" id="ld-btn-gist-upload">🚀 立即上传备份</button>
                        </div>
                    </div>
                </div>
            </div>

            <div style="padding: 10px 16px; background: var(--primary-very-low, #f9f9f9); border-bottom: 1px solid var(--primary-low, #eee); display: flex; gap: 8px; align-items: center; justify-content: space-between;">
                <input type="text" id="ld-search-user" class="ld-input" style="max-width: 240px;" placeholder="🔍 搜索用户名或标签..." />
                <div>
                    <button class="ld-btn ld-btn-secondary" id="ld-btn-export">📥 导出备份 (JSON)</button>
                    <button class="ld-btn ld-btn-secondary" id="ld-btn-import">📤 导入数据</button>
                    <input type="file" id="ld-file-input" style="display: none;" accept=".json" />
                </div>
            </div>

            <div class="ld-modal-body" id="ld-user-list-container">
                <!-- 动态填充 -->
            </div>
        `;

        document.body.appendChild(mask);
        document.body.appendChild(modal);

        const listContainer = modal.querySelector('#ld-user-list-container');
        const searchInput = modal.querySelector('#ld-search-user');
        const tokenInput = modal.querySelector('#ld-gist-token');
        const gistIdInput = modal.querySelector('#ld-gist-id');
        const autoSyncCheckbox = modal.querySelector('#ld-gist-autosync');
        const statusText = modal.querySelector('#ld-gist-status-text');

        function updateGistConfigFromUI() {
            const currentConf = GistSync.getConfig();
            currentConf.token = tokenInput.value.trim();
            currentConf.gistId = gistIdInput.value.trim();
            currentConf.autoSync = autoSyncCheckbox.checked;
            GistSync.saveConfig(currentConf);
            return currentConf;
        }

        tokenInput.addEventListener('change', updateGistConfigFromUI);
        gistIdInput.addEventListener('change', updateGistConfigFromUI);
        autoSyncCheckbox.addEventListener('change', updateGistConfigFromUI);

        // GitHub Gist 上传
        const btnGistUpload = modal.querySelector('#ld-btn-gist-upload');
        btnGistUpload.addEventListener('click', () => {
            updateGistConfigFromUI();
            btnGistUpload.disabled = true;
            btnGistUpload.innerText = '⏳ 上传中...';
            statusText.innerText = '正在上传到 GitHub Gist...';

            GistSync.uploadToGist((res) => {
                btnGistUpload.disabled = false;
                btnGistUpload.innerText = '🚀 立即上传备份';
                if (res.success) {
                    gistIdInput.value = res.gistId;
                    statusText.innerHTML = `🕒 上次同步: <strong>刚刚</strong> (上传成功)`;
                    alert('🎉 成功备份到 GitHub Private Gist！');
                } else {
                    statusText.innerText = `上传失败: ${res.error}`;
                    alert(`❌ 上传失败: ${res.error}`);
                }
            });
        });

        // GitHub Gist 下载拉取
        const btnGistDownload = modal.querySelector('#ld-btn-gist-download');
        btnGistDownload.addEventListener('click', () => {
            updateGistConfigFromUI();
            btnGistDownload.disabled = true;
            btnGistDownload.innerText = '⏳ 拉取中...';
            statusText.innerText = '正在从 GitHub Gist 拉取数据...';

            GistSync.downloadFromGist((res) => {
                btnGistDownload.disabled = false;
                btnGistDownload.innerText = '📥 从云端拉取合并';
                if (res.success) {
                    statusText.innerHTML = `🕒 上次同步: <strong>刚刚</strong> (拉取成功)`;
                    alert(`🎉 成功从云端拉取并合并了 ${res.count} 位用户的标签数据！`);
                    renderList(searchInput.value);
                    renderAllTags();
                } else {
                    statusText.innerText = `拉取失败: ${res.error}`;
                    alert(`❌ 拉取失败: ${res.error}`);
                }
            });
        });

        function renderList(filterText = '') {
            listContainer.innerHTML = '';
            const userList = Object.values(storage.getAllUsers());
            const filtered = userList.filter(u => {
                const kw = filterText.trim().toLowerCase();
                const uNameMatch = String(u.username || '').toLowerCase().includes(kw);
                const tagMatch = (u.tags || []).some(t => String(t.name || '').toLowerCase().includes(kw));
                const noteMatch = String(u.note || '').toLowerCase().includes(kw);
                return uNameMatch || tagMatch || noteMatch;
            });

            if (filtered.length === 0) {
                listContainer.innerHTML = `<div style="text-align: center; color: var(--primary-medium, #999); padding: 30px;">暂无匹配的已打标用户</div>`;
                return;
            }

            filtered.forEach(u => {
                const item = document.createElement('div');
                item.className = 'ld-user-list-item';
                item.innerHTML = `
                    <div>
                        <div style="font-weight: bold; font-size: 13px;">@${escapeHtml(u.username)}</div>
                        <div style="display: flex; gap: 4px; margin-top: 4px; flex-wrap: wrap;">
                            ${(u.tags || []).map(t => `<span class="ld-tag-badge" style="color:${escapeHtml(t.color)}; background:${escapeHtml(t.bg)}; border-color:${escapeHtml(t.border)}">${escapeHtml(t.name)}</span>`).join('')}
                        </div>
                        ${u.note ? `<div style="font-size: 11px; color: var(--primary-medium, #888); margin-top: 3px;">💬 ${escapeHtml(u.note)}</div>` : ''}
                    </div>
                    <div>
                        <button class="ld-btn ld-btn-danger ld-btn-del-user" style="padding: 2px 8px; font-size: 11px;">删除</button>
                    </div>
                `;

                item.querySelector('.ld-btn-del-user').addEventListener('click', () => {
                    if (confirm(`确定删除针对 @${u.username} 的所有标签与备注吗？`)) {
                        storage.setUser(u.username, null);
                        renderList(searchInput.value);
                        renderAllTags();
                    }
                });

                listContainer.appendChild(item);
            });
        }

        renderList();

        searchInput.addEventListener('input', (e) => renderList(e.target.value));
        modal.querySelector('#ld-modal-close').addEventListener('click', closeManager);

        // 导出功能 (改用 Blob 避免 URL 长度超限)
        modal.querySelector('#ld-btn-export').addEventListener('click', () => {
            const blob = new Blob([storage.exportJSON()], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", url);
            downloadAnchor.setAttribute("download", `linuxdo_user_tags_${new Date().toISOString().slice(0,10)}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        });

        // 导入功能 (重置 input 允许二次选择同名文件)
        const fileInput = modal.querySelector('#ld-file-input');
        modal.querySelector('#ld-btn-import').addEventListener('click', () => {
            fileInput.value = '';
            fileInput.click();
        });
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                const res = storage.importJSON(event.target.result);
                fileInput.value = '';
                if (res.success) {
                    alert(`🎉 成功导入并合并了 ${res.count} 位用户标签数据！`);
                    closeManager();
                    renderAllTags();
                } else {
                    alert(`❌ 导入失败: ${res.error}`);
                }
            };
            reader.readAsText(file);
        });
        document.addEventListener('keydown', closeOnEscape);
        activeManagerClose = closeManager;
    }

    // ==========================================
    // 10. 菜单注册与 DOM 监听启动
    // ==========================================
    if (typeof GM_registerMenuCommand === 'function') {
        try {
            GM_registerMenuCommand("⚙️ 打开标签管理与数据中心", openManagerModal);
        } catch (e) {
            console.warn('[LD Tagger] GM_registerMenuCommand 注册失败', e);
        }
    }

    let debounceTimer = null;
    function mutationNeedsScan(records) {
        const relevantSelector = '.topic-post, .topic-meta-data, .names, .user-card, #user-card, [data-user-card]';
        return records.some(record => {
            const candidates = [record.target, ...record.addedNodes];
            return candidates.some(node => {
                if (!node) return false;
                const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
                return element && (
                    element.matches(relevantSelector) || 
                    Boolean(element.closest(relevantSelector)) || 
                    Boolean(element.querySelector(relevantSelector))
                );
            });
        });
    }

    if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined' && document.body) {
        const observer = new MutationObserver((records) => {
            if (!mutationNeedsScan(records)) return;
            if (debounceTimer) cancelAnimationFrame(debounceTimer);
            debounceTimer = requestAnimationFrame(() => {
                scanAndInject();
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        scanAndInject();

        console.log('[LinuxDo User Tagger] v0.0.1 运行就绪！');
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            normalizeUserData,
            mergeUserData,
            validateImportShape,
            smartFormatTagName,
            normalizeCategories,
            normalizeUsers,
            DEFAULT_CATEGORIES
        };
    }
})();
