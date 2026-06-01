// For compatibility with both Node.js versions and Netlify
const fetch = globalThis.fetch || require('node-fetch');
const path = require('path');
const Fuse = require('fuse.js');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const API_KEY = process.env.OPENROUTER_API_KEY;
const MCP_BASE_URL = process.env.MCP_BASE_URL || 'https://mcp.getmaterio.app';
const MCP_SNAP_SEARCH_PATH = process.env.MCP_SNAP_SEARCH_PATH;
const MCP_JSONRPC_PATH = process.env.MCP_JSONRPC_PATH || MCP_SNAP_SEARCH_PATH || '/mcp';
const MCP_AI_SEARCH_ONLY = process.env.MCP_AI_SEARCH_ONLY === 'true';
const MCP_TIMEOUT_MS = Number(process.env.MCP_TIMEOUT_MS || 8000);
// Self-hosted HF Spaces endpoints (optional, used in parallel with OpenRouter)
const HF_TOKEN = process.env.HF_TOKEN || '';
const HF_LLM_URL = process.env.HF_LLM_URL || '';
const HF_RERANKER_URL = process.env.HF_RERANKER_URL || '';

// ============= CONTENT SAFETY FILTER =============

/**
 * Content-neutral safety filter using pattern detection
 * Detects: profanity, hate terms, sexual content, abusive language, extreme gibberish
 * WITHOUT storing or exposing actual word lists
 */
function isInappropriateContent(text) {
    if (!text || typeof text !== 'string') return false;

    const normalized = text.toLowerCase().trim();

    // Check for extreme gibberish (random character spam)
    const gibberishPattern = /(.)\1{4,}|[^a-z0-9\s]{5,}|^[bcdfghjklmnpqrstvwxyz]{8,}$/i;
    if (gibberishPattern.test(normalized)) {
        return true;
    }

    // Check character diversity for gibberish (too many consonants, no vowels)
    const words = normalized.split(/\s+/).filter(w => w.length > 3);
    for (const word of words) {
        if (word.length > 6) {
            const vowelCount = (word.match(/[aeiou]/g) || []).length;
            if (vowelCount === 0) return true; // No vowels in long word = gibberish
        }
    }

    // Pattern-based detection using character combinations (not actual words)
    // These patterns detect common letter sequences in inappropriate terms
    const suspiciousPatterns = [
        /\bf+[uo]+c*k+\b/i,         // Common profanity pattern
        /\bf+c+k+\b/i,              // Common profanity variant
        /\bs+[h!1]+[i!1]+t+\b/i,    // Common profanity pattern
        /\bb+[i!1]+t+c+h+\b/i,      // Common profanity pattern
        /\bd+[a@]+m+n+\b/i,         // Common profanity pattern
        /\bs+[e3]+x+[yu]/i,         // Sexual content pattern
        /\bp+[o0]+r+n+/i,           // Sexual content pattern
        /\bn+[i!1]+g+[a@e]+r+/i,   // Hate term pattern
        /\bf+[a@]+g+[go0]+t+/i,    // Hate term pattern
        /\br+[a@]+p+[e3]+\b/i,      // Violent/sexual pattern
        /\bk+[i!1]+l+l+\s*(you|yourself|me|him|her)/i, // Violent/threatening
        /\bd+[i!1]+e+\s*(you|yourself|bitch|motherfucker)/i, // Threatening
        /\bs+t+u+p+[i!1]+d+\s+(bitch|ass|fuck|person|people)/i, // Abusive term with target
        /\b[i!1]+d+[i!1]+[o0]+t+\s+(bitch|ass|fuck|person|people)/i, // Abusive term with target
        /\bm+[o0]+r+[o0]+n+\b/i,    // Abusive term
        /\bl+[o0]+s+[e3]+r+\s+(bitch|ass|fuck|you)/i, // Abusive term with target
        /\ba+s+s+h+[o0]+l+e+/i,     // Profanity
        /\bc+u+n+t+\b/i,            // Profanity
        /\bp+u+s+s+y+\b/i           // Sexual content
    ];

    for (const pattern of suspiciousPatterns) {
        if (pattern.test(normalized)) {
            return true;
        }
    }

    // Check for excessive special character substitution (l33t speak abuse)
    const specialCharCount = (normalized.match(/[!@#$%^&*()_+=\[\]{};:'",.<>?\/\\|`~]/g) || []).length;
    if (specialCharCount > normalized.length * 0.3) {
        return true; // More than 30% special chars
    }

    return false;
}

/**
 * Validates and sanitizes search query
 * Returns: { valid: boolean, reason?: string }
 */
function validateSearchQuery(query) {
    if (!query || typeof query !== 'string') {
        return { valid: false, reason: 'invalid' };
    }

    const trimmed = query.trim();

    // Basic length checks
    if (trimmed.length < 1) {
        return { valid: false, reason: 'too_short' };
    }

    if (trimmed.length > 200) {
        return { valid: false, reason: 'too_long' };
    }

    // Check for inappropriate content
    if (isInappropriateContent(trimmed)) {
        return { valid: false, reason: 'inappropriate' };
    }

    return { valid: true };
}

function extractCoreQuery(query) {
    if (!query || typeof query !== 'string') return '';

    const original = query.trim();
    if (!original) return '';

    const normalized = original
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (!normalized) return original;

    let cleaned = normalized;
    const phrasePatterns = [
        /\bthat one\b/g,
        /\bthis one\b/g,
        /\bthat pdf\b/g,
        /\bthis pdf\b/g,
        /\bthe pdf\b/g,
        /\bpdf with\b/g,
        /\bpdf about\b/g,
        /\bcontent about\b/g,
        /\bcontent on\b/g,
        /\bnotes on\b/g,
        /\bnotes about\b/g,
        /\blooking for\b/g,
        /\bi want\b/g,
        /\bi need\b/g,
        /\bcan you\b/g,
        /\bplease\b/g,
        /\bpls\b/g,
        /\bshow me\b/g,
        /\bgive me\b/g,
        /\bfind me\b/g,
        /\bneed help with\b/g
    ];

    for (const pattern of phrasePatterns) {
        cleaned = cleaned.replace(pattern, ' ');
    }

    cleaned = cleaned.replace(
        /\b(pdf|notes|note|material|materials|content|chapter|unit|module|topic|document|file|with|on|about|for|of|the|a|an|one|that|this|please|pls|show|give|find|need|want|looking|help|info|information)\b/g,
        ' '
    );

    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    if (!cleaned) return original;

    const keepShort = new Set([
        'ai', 'os', 'db', 'cn', 'ml', 'dl', 'nlp', 'svm', 'da', 'ds', 'mad', 'ctsd', 'coa', 'cd', 'cns', 'ip', 'se', 'cnip', 'daa', 'dsa', 'iot', 'ui', 'ux', 'qa', 'api', 'dt', 'es', 'eee', 'bee', 'de', 'oopj', 'oop', 'epj', 'daa', 'dwdm', 'gcf', 'cc', 'hpc', 'qr'
    ]);

    const tokens = cleaned
        .split(' ')
        .filter(token => token.length >= 3 || keepShort.has(token));

    const core = tokens.join(' ').trim();
    return core || original;
}

// Import models from chat.js
const chatModule = require('./chat.js');
// Extract MODELS if it's exported, otherwise fallback to hardcoded list
const GENERAL_MODELS = [
    'openai/gpt-oss-120b:free',
    'google/gemma-4-31b-it:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'z-ai/glm-4.5-air:free',
    'deepseek/deepseek-v4-flash:free',
    'minimax/minimax-m2.5:free',
    'nvidia/nemotron-3-nano-30b-a3b:free',
    'openrouter/free'
];

// CDN URLs for resource library
const RESOURCE_LIB_URLS = {
    production: `https://cdn.getmaterio.app/databases/beta/resource.lib.json`,
    local: 'http://localhost:8080/databases/beta/resource.lib.json'
};

// Cache for resource library
let resourceLibCache = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch resource library from CDN
 */
async function fetchResourceLibrary() {
    // Return cached version if available and fresh
    if (resourceLibCache && (Date.now() - lastFetchTime) < CACHE_DURATION) {
        return resourceLibCache;
    }

    // Check if local resources mode is explicitly enabled (via local-cdn.js)
    const useLocalResources = process.env.USE_LOCAL_RESOURCES === 'true' ||
        (typeof window !== 'undefined' && window.localStorage?.getItem('useLocalResources') === 'true');

    const url = useLocalResources ? RESOURCE_LIB_URLS.local : RESOURCE_LIB_URLS.production;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch resource library: ${response.status}`);
        }

        resourceLibCache = await response.json();
        lastFetchTime = Date.now();
        return resourceLibCache;
    } catch (error) {
        console.error('Error fetching resource library:', error);

        // Return cached version if available, even if stale
        if (resourceLibCache) {
            console.warn('Using stale cache due to fetch failure');
            return resourceLibCache;
        }

        throw new Error('Unable to load resource library from any source');
    }
}

// ============= SEARCH ALGORITHMS =============

// ---------------------------------------------------------------------------
// STATIC ABBREVIATION MAP
// Highest-confidence signal. Maps short codes → full names used in the lib.
// Keys: lowercase. Values: canonical form to match against subject/category.
// ---------------------------------------------------------------------------
const SUBJECT_ABBR_MAP = {
    'os': 'Operating System',
    'cn': 'Computer Networks',
    'cnip': 'Computer Networks and Internet Protocol',
    'se': 'Software Engineering',
    'de': 'Digital Electronics',
    'bee': 'Basic Electrical Engineering',
    'eee': 'Electrical and Electronic Engineering',
    'gcf': 'Global Cloud Fundamentals',
    'ctsd': 'Computational Thinking and Structure Design',
    'pp': 'Principles of Programming',
    'dm': 'Discrete Mathematics',
    'be': 'Business Economics',
    'dwdm': 'Distributed and Wide Area Network',
    'ppfsd': 'Programming in Python with Full Stack',
    'ml': 'Machine Learning',
    'dl': 'Deep Learning',
    'daa': 'Design and Analysis of Algorithms',
    'dsa': 'Data Structures and Algorithms',
    'ds': 'Data Structures',
    'da': 'Data Analytics',
    'dadv': 'Data Analytics and Data Visualization',
    'dbms': 'Database Management System',
    'db': 'Database',
    'ai': 'Artificial Intelligence',
    'nlp': 'Natural Language Processing',
    'iot': 'Internet of Things',
    'epj': 'Enterprise Java Programming',
    'toc': 'Theory of Computation',
    'cd': 'Compiler Design',
    'ppl': 'Principles of Programming Languages',
    'flat': 'Formal Languages and Automata Theory',
    'cg': 'Computer Graphics',
    'is': 'Information Security',
    'cc': 'Cloud Computing',
    'hpc': 'High Performance Computing',
    'mswd': 'MEAN Stack Web Development',
    'cs': 'Cyber Security'
};

const CATEGORY_ABBR_MAP = {
    'qb': 'Question Bank',
    'qp': ['Previous Year Questions', 'Question Paper'],
    'pyq': 'Previous Year Questions',
    'lab': 'Lab Manual',
    'ppt': 'Presentations',
    'ch': 'Chapters',
    'chap': 'Chapters',
    'unit': 'Chapters',  // many libs use "unit" as chapter equivalent
    'asgn': 'Assignments',
    'asn': 'Assignments',
    'assign': 'Assignments',
    'notes': 'Chapters',
};

// Discovery query detection: these signal zero-topic intent
const DISCOVERY_PHRASES = [
    'random', 'suggest', 'surprise me', 'anything',
    'where do i start', 'where to start', 'get started',
    'what should i', 'what to study', 'what next',
    'recommend', 'pick for me', "don't know", 'dont know',
    "i don't know", 'no idea', 'help me choose', 'something new',
];

/**
 * Detect if a query is a discovery / zero-keyword request.
 * Returns true when the query carries no extractable topic.
 */
function isDiscoveryQuery(query) {
    if (!query) return false;
    const q = query.toLowerCase().trim();
    return DISCOVERY_PHRASES.some(phrase => q.includes(phrase));
}

/**
 * Pick a random topic from the user's selected semester.
 * Falls back to a random semester if the provided one isn't in the library.
 * Prefers Chapter/unit categories over QP/Lab.
 */
function pickDiscoveryResult(resourceLib, preferredSemester) {
    if (!resourceLib || typeof resourceLib !== 'object') return null;

    const semKeys = Object.keys(resourceLib);
    if (semKeys.length === 0) return null;

    // Use preferred semester if valid, else pick first available
    const semester = (preferredSemester && resourceLib[preferredSemester])
        ? preferredSemester
        : semKeys[0];

    const subjects = resourceLib[semester];
    const subjectNames = Object.keys(subjects || {});
    if (subjectNames.length === 0) return null;

    // Shuffle subjects and pick the first that has chapter-like content
    const shuffled = [...subjectNames].sort(() => Math.random() - 0.5);

    for (const subjectName of shuffled) {
        const categories = subjects[subjectName];
        if (!Array.isArray(categories)) continue;

        // Prefer chapter/unit categories
        const preferred = categories.find(c =>
            c && c.type && /chapter|unit|module/i.test(c.type) && Array.isArray(c.content) && c.content.length > 0
        );
        const fallback = categories.find(c =>
            c && Array.isArray(c.content) && c.content.length > 0
        );

        const category = preferred || fallback;
        if (!category) continue;

        const items = category.content.filter(Boolean);
        if (items.length === 0) continue;

        const topic = items[Math.floor(Math.random() * items.length)];

        return {
            semester,
            subject: subjectName,
            category: category.type,
            topic,
            score: 100,
            matchType: 'discovery',
            isDiscovery: true,
        };
    }

    return null;
}

// ---------------------------------------------------------------------------
// BM25 SCORER
// Pure in-memory text ranking. No network, no external deps.
// Replaces Fuse.js as the primary scorer for keyword queries.
// ---------------------------------------------------------------------------

function tokenize(text) {
    if (!text) return [];
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length >= 2);
}

/**
 * Build BM25 corpus statistics from the search index.
 * Call once after building the index; cache the result.
 */
function buildBm25Corpus(searchIndex) {
    const N = searchIndex.length;
    const df = {}; // document frequency per term
    let totalLen = 0;

    const docs = searchIndex.map(item => {
        // Combine all searchable text for this document, weighted
        const text = [
            item.subject, item.subject, item.subject,   // weight ×3
            item.subjectAbbr, item.subjectAbbr,         // weight ×2
            item.category, item.category,               // weight ×2
            item.item, item.item, item.item,             // weight ×3
            item.itemAbbr,
            item.searchText
        ].join(' ');

        const tokens = tokenize(text);
        const termFreq = {};
        for (const t of tokens) {
            termFreq[t] = (termFreq[t] || 0) + 1;
        }
        totalLen += tokens.length;

        // Update document frequency
        for (const t of Object.keys(termFreq)) {
            df[t] = (df[t] || 0) + 1;
        }

        return { item, termFreq, length: tokens.length };
    });

    const avgLen = N > 0 ? totalLen / N : 1;
    return { docs, df, N, avgLen };
}

/**
 * Score a single document against a query using BM25.
 * k1=1.5, b=0.75 are standard values.
 */
function bm25Score(queryTokens, doc, corpus, k1 = 1.5, b = 0.75) {
    let score = 0;
    for (const term of queryTokens) {
        const tf = doc.termFreq[term] || 0;
        if (tf === 0) continue;
        const df = corpus.df[term] || 0;
        const idf = Math.log((corpus.N - df + 0.5) / (df + 0.5) + 1);
        const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * doc.length / corpus.avgLen));
        score += idf * tfNorm;
    }
    return score;
}

/**
 * Run BM25 search over the index.
 * Returns results sorted by score, with scores normalized to 0-100.
 */
function searchBm25(queryTokens, corpus, expandedSubject, expandedCategory, limit = 20) {
    if (queryTokens.length === 0) return [];

    const scored = corpus.docs.map(doc => {
        let score = bm25Score(queryTokens, doc, corpus);

        // Hard boost: if the static abbreviation map resolved to a subject,
        // items from that subject get a strong multiplier.
        if (expandedSubject) {
            const subjectLower = doc.item.subject?.toLowerCase() || '';
            const expandedLower = expandedSubject.toLowerCase();
            if (subjectLower.includes(expandedLower) || expandedLower.includes(subjectLower)) {
                score *= 3.5;
            }
        }

        // Category boost
        if (expandedCategory) {
            const catLower = doc.item.category?.toLowerCase() || '';
            const expCatLower = expandedCategory.toLowerCase();
            if (catLower.includes(expCatLower) || expCatLower.includes(catLower)) {
                score *= 2.5;
            }
        }

        return { item: doc.item, rawScore: score };
    });

    // Sort and normalize
    scored.sort((a, b) => b.rawScore - a.rawScore);

    const maxScore = scored[0]?.rawScore || 1;
    if (maxScore <= 0) return [];

    return scored
        .filter(r => r.rawScore > 0)
        .slice(0, limit)
        .map(r => ({
            semester: r.item.semester,
            subject: r.item.subject,
            category: r.item.category,
            topic: r.item.item,
            score: Math.min(100, Math.round((r.rawScore / maxScore) * 100)),
            matchType: 'bm25'
        }));
}

/**
 * Expand query tokens using the static abbreviation maps.
 * Returns { expandedTokens, expandedSubject, expandedCategory }
 */
function expandQueryWithAbbr(queryTokens) {
    const expandedTokens = [];
    let expandedSubject = null;
    let expandedCategory = null;

    for (const token of queryTokens) {
        const subjectExpansion = SUBJECT_ABBR_MAP[token];
        const categoryExpansion = CATEGORY_ABBR_MAP[token];

        if (subjectExpansion) {
            expandedSubject = subjectExpansion;
            // Add all tokens from the expanded name for BM25
            expandedTokens.push(...tokenize(subjectExpansion));
        } else if (categoryExpansion) {
            expandedCategory = categoryExpansion;
            expandedTokens.push(...tokenize(categoryExpansion));
        } else {
            expandedTokens.push(token);
        }
    }

    // Deduplicate
    return {
        expandedTokens: [...new Set(expandedTokens)],
        expandedSubject,
        expandedCategory
    };
}

/**
 * Generate common abbreviations for a text
 */
function generateAbbreviations(text) {
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    const abbreviations = [];

    // Full acronym (e.g., "Operating System" -> "os")
    if (words.length > 1) {
        abbreviations.push(words.map(w => w[0]).join(''));
    }

    // Partial acronyms
    if (words.length >= 2) {
        abbreviations.push(words.slice(0, 2).map(w => w[0]).join(''));
    }
    if (words.length >= 3) {
        abbreviations.push(words.slice(0, 3).map(w => w[0]).join(''));
    }
    if (words.length >= 4) {
        abbreviations.push(words.slice(0, 4).map(w => w[0]).join(''));
    }

    return abbreviations;
}

/**
 * Jaro-Winkler distance implementation for better fuzzy matching
 * Returns similarity score between 0 and 1 (1 = identical)
 */
function jaroWinkler(s1, s2) {
    if (s1 === s2) return 1.0;

    const len1 = s1.length;
    const len2 = s2.length;

    if (len1 === 0 || len2 === 0) return 0.0;

    const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
    const s1Matches = new Array(len1).fill(false);
    const s2Matches = new Array(len2).fill(false);

    let matches = 0;
    let transpositions = 0;

    // Find matches
    for (let i = 0; i < len1; i++) {
        const start = Math.max(0, i - matchWindow);
        const end = Math.min(i + matchWindow + 1, len2);

        for (let j = start; j < end; j++) {
            if (s2Matches[j] || s1[i] !== s2[j]) continue;
            s1Matches[i] = true;
            s2Matches[j] = true;
            matches++;
            break;
        }
    }

    if (matches === 0) return 0.0;

    // Find transpositions
    let k = 0;
    for (let i = 0; i < len1; i++) {
        if (!s1Matches[i]) continue;
        while (!s2Matches[k]) k++;
        if (s1[i] !== s2[k]) transpositions++;
        k++;
    }

    // Calculate Jaro similarity
    const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;

    // Calculate common prefix for Winkler bonus
    let prefix = 0;
    for (let i = 0; i < Math.min(len1, len2, 4); i++) {
        if (s1[i] === s2[i]) prefix++;
        else break;
    }

    // Winkler modification
    return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Calculate match score between query and target text
 */
function calculateMatchScore(query, target, targetAbbreviations = []) {
    const queryLower = query.toLowerCase().trim();
    const targetLower = target.toLowerCase().trim();

    // Exact match
    if (queryLower === targetLower) return 100;

    // Exact abbreviation match
    if (targetAbbreviations.includes(queryLower)) return 95;

    // Contains match
    if (targetLower.includes(queryLower)) return 85;

    // Jaro-Winkler similarity
    const similarity = jaroWinkler(queryLower, targetLower);
    const similarityScore = Math.round(similarity * 70);

    // Word-based matching
    const queryWords = queryLower.split(/\s+/);
    const targetWords = targetLower.split(/\s+/);

    const matchingWords = queryWords.filter(qw =>
        targetWords.some(tw => tw.includes(qw) || qw.includes(tw))
    );
    const wordScore = (matchingWords.length / queryWords.length) * 60;

    return Math.max(similarityScore, wordScore);
}

/**
 * Generate short forms and variations of text
 */
function generateVariations(text) {
    const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    const variations = [text.toLowerCase()];

    // Add individual words
    variations.push(...words);

    // Add abbreviations
    variations.push(...generateAbbreviations(text));

    return variations.join(' ');
}

/**
 * Build searchable index from resource library
 */
function buildSearchIndex(resourceLib) {
    const index = [];

    if (!resourceLib || typeof resourceLib !== 'object') {
        console.error('Invalid resource library:', resourceLib);
        return index;
    }

    Object.entries(resourceLib).forEach(([semester, subjects]) => {
        if (!subjects || typeof subjects !== 'object') {
            console.warn(`Invalid subjects for semester ${semester}`);
            return;
        }

        Object.entries(subjects).forEach(([subjectName, categories]) => {
            // Ensure categories is an array
            if (!Array.isArray(categories)) {
                console.warn(`Categories for ${subjectName} is not an array:`, typeof categories);
                return;
            }

            const subjectAbbr = generateAbbreviations(subjectName);

            categories.forEach(category => {
                if (!category || !category.type || !Array.isArray(category.content)) {
                    console.warn(`Invalid category structure in ${subjectName}:`, category);
                    return;
                }

                const categoryType = category.type;
                const categoryAbbr = generateAbbreviations(categoryType);

                category.content.forEach(contentItem => {
                    if (!contentItem) return;

                    const itemAbbr = generateAbbreviations(contentItem);

                    index.push({
                        semester,
                        subject: subjectName,
                        subjectLower: subjectName.toLowerCase(),
                        subjectAbbr: subjectAbbr.join(' '),
                        subjectVariations: generateVariations(subjectName),
                        category: categoryType,
                        categoryLower: categoryType.toLowerCase(),
                        categoryAbbr: categoryAbbr.join(' '),
                        item: contentItem,
                        itemLower: contentItem.toLowerCase(),
                        itemAbbr: itemAbbr.join(' '),
                        itemVariations: generateVariations(contentItem),
                        // Combined search field with all variations
                        searchText: `${subjectName} ${generateVariations(subjectName)} ${categoryType} ${generateVariations(categoryType)} ${contentItem} ${generateVariations(contentItem)}`
                    });
                });
            });
        });
    });

    return index;
}

/**
 * Handle direct chapter/unit navigation queries (e.g., "ml ch3", "os unit 1")
 * Returns a high-priority result object if a match is found
 */
function handleDirectNavigation(query, resourceLib) {
    if (!query || typeof query !== 'string') return null;

    const normalized = query.toLowerCase().trim();
    // Match patterns like: "ml ch3", "chapter 3 os", "unit 4 cnip", "qp 2023"
    // Captures regex: look for ch/chapter/unit/qp/pyq/qb followed by number
    const navMatch = normalized.match(/\b(?:ch|chapter|unit|module|lab|qp|pyq|qb|question|paper)\s*(\d+)\b/i);

    if (!navMatch) return null;

    const targetNum = parseInt(navMatch[1]);
    if (isNaN(targetNum) || targetNum < 1) return null;

    // Extract subject part by removing the nav match pattern
    const subjectPart = normalized.replace(navMatch[0], '').trim();
    if (subjectPart.length < 1) return null;

    let bestMatch = null;

    // Iterate through library to find matching subject
    Object.entries(resourceLib).forEach(([semester, subjects]) => {
        if (!subjects) return;

        Object.entries(subjects).forEach(([subjectName, categories]) => {
            if (!Array.isArray(categories)) return;

            // Check for subject match
            const subjectLower = subjectName.toLowerCase();
            const abbrs = generateAbbreviations(subjectName);

            const isAbbrMatch = abbrs.includes(subjectPart);
            const isExactMatch = subjectLower === subjectPart;
            const isPartialMatch = subjectLower.includes(subjectPart);

            if (isAbbrMatch || isExactMatch || isPartialMatch) {
                // Determine category type to look for based on query keyword, defaults to Chapters
                let targetCategoryType = 'chapter';
                const lowerNav = navMatch[0].toLowerCase();

                if (lowerNav.includes('unit')) targetCategoryType = 'unit';
                else if (lowerNav.includes('module')) targetCategoryType = 'module';
                else if (lowerNav.includes('lab')) targetCategoryType = 'lab';
                else if (['qp', 'pyq', 'qb', 'question', 'paper'].some(s => lowerNav.includes(s))) targetCategoryType = 'question';

                // Find matching category in subject

                // Find matching category in subject
                const category = categories.find(c => {
                    const type = c.type.toLowerCase();
                    // If target is chapter (default), look for chapter or unit
                    if (targetCategoryType === 'chapter') {
                        return type.includes('chapter') || type.includes('unit');
                    }
                    return type.includes(targetCategoryType);
                });

                if (category && Array.isArray(category.content)) {
                    // Check if index exists (1-based -> 0-based)
                    const itemIndex = targetNum - 1;
                    if (itemIndex >= 0 && itemIndex < category.content.length) {
                        const topic = category.content[itemIndex];

                        // Priority: Abbr > Exact > Partial
                        const priority = isAbbrMatch ? 3 : isExactMatch ? 2 : 1;

                        if (!bestMatch || priority > bestMatch.priority) {
                            bestMatch = {
                                priority, // internal use only
                                semester,
                                subject: subjectName,
                                category: category.type,
                                topic: topic,
                                score: 100,
                                matchType: 'direct_nav',
                                directMatch: true
                            };
                        }
                    }
                }
            }
        });
    });

    if (bestMatch) {
        const { priority, ...result } = bestMatch;
        return result;
    }
    return null;
}

/**
 * 4-layer search pipeline:
 * 1. Direct navigation  (ml ch3, os unit 1)   — regex match, score=100
 * 2. BM25 with abbreviation expansion         — primary keyword scorer
 * 3. Fuse.js                                  — typo / fuzzy fallback
 * Results are merged, deduped, and sorted.
 */
async function searchResources(query, threshold = 0.4, limit = 20) {
    try {
        const resourceLib = await fetchResourceLibrary();

        if (!resourceLib || Object.keys(resourceLib).length === 0) {
            console.error('Resource library is empty or invalid');
            return [];
        }

        // Layer 1: Direct navigation (e.g. "ml ch3")
        const directResult = handleDirectNavigation(query, resourceLib);

        const searchIndex = buildSearchIndex(resourceLib);
        if (searchIndex.length === 0) {
            console.error('Search index is empty');
            return directResult ? [directResult] : [];
        }

        console.log(`Search index built with ${searchIndex.length} items`);

        // ---- Layer 2: BM25 with static abbreviation expansion ----
        const rawTokens = tokenize(query);
        const { expandedTokens, expandedSubject, expandedCategory } = expandQueryWithAbbr(rawTokens);

        const corpus = buildBm25Corpus(searchIndex);
        const bm25Results = searchBm25(expandedTokens, corpus, expandedSubject, expandedCategory, limit * 2);

        // ---- Layer 3: Fuse.js fallback (for typos when BM25 is weak) ----
        // Only run Fuse if the top BM25 score is below a confidence threshold
        const bm25Confident = bm25Results.length > 0 && bm25Results[0].score >= 60;

        let fuseResults = [];
        if (!bm25Confident) {
            const fuseOptions = {
                keys: [
                    { name: 'subjectLower', weight: 0.25 },
                    { name: 'subjectAbbr', weight: 0.35 },
                    { name: 'subjectVariations', weight: 0.2 },
                    { name: 'itemLower', weight: 0.25 },
                    { name: 'itemAbbr', weight: 0.2 },
                    { name: 'itemVariations', weight: 0.15 },
                    { name: 'categoryLower', weight: 0.1 },
                    { name: 'categoryAbbr', weight: 0.05 },
                    { name: 'searchText', weight: 0.1 }
                ],
                threshold: threshold || 0.5,
                distance: 100,
                minMatchCharLength: 2,
                ignoreLocation: true,
                includeScore: true,
                useExtendedSearch: true,
                shouldSort: true,
                findAllMatches: true
            };

            const fuse = new Fuse(searchIndex, fuseOptions);
            const raw = fuse.search(query);

            fuseResults = raw.map(result => {
                const item = result.item;
                const score = Math.round((1 - result.score) * 70); // cap Fuse at 70 — it's a fallback
                return {
                    semester: item.semester,
                    subject: item.subject,
                    category: item.category,
                    topic: item.item,
                    score: Math.min(70, score),
                    matchType: 'fuzzy'
                };
            });
        }

        // ---- Merge BM25 + Fuse, dedup, sort ----
        const seen = new Set();
        const merged = [];

        for (const r of [...bm25Results, ...fuseResults]) {
            const key = `${r.semester}|${r.subject}|${r.category}|${r.topic}`;
            if (seen.has(key)) continue;
            seen.add(key);

            // Re-label matchType based on final score
            merged.push({
                ...r,
                matchType: r.score >= 90 ? 'exact' : r.score >= 75 ? 'high' : r.score >= 60 ? 'medium' : 'low'
            });
        }

        merged.sort((a, b) => b.score - a.score);

        // Insert direct nav result at the top (remove any duplicate)
        if (directResult) {
            const dedupedMerged = merged.filter(r =>
                !(r.subject === directResult.subject &&
                    r.topic === directResult.topic &&
                    r.category === directResult.category)
            );
            dedupedMerged.unshift(directResult);
            return dedupedMerged.slice(0, limit);
        }

        return merged.slice(0, limit);
    } catch (error) {
        console.error('Error in searchResources:', error);
        throw error;
    }
}

function normalizeSearchText(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function topicMatches(a, b) {
    const left = normalizeSearchText(a);
    const right = normalizeSearchText(b);
    if (!left || !right) return false;
    return left === right || left.includes(right) || right.includes(left);
}

function relevanceFromSimilarity(similarity) {
    if (typeof similarity !== 'number' || Number.isNaN(similarity)) return 'low';
    if (similarity >= 0.75) return 'high';
    if (similarity >= 0.6) return 'medium';
    return 'low';
}

function topicScoreFromContent(content, topic) {
    const contentText = normalizeSearchText(content);
    const topicText = normalizeSearchText(topic);

    if (!contentText || !topicText) return 0;

    const topicTokens = topicText.split(' ').filter(token => token.length >= 3);
    if (topicTokens.length === 0) return 0;

    let matched = 0;
    for (const token of topicTokens) {
        if (contentText.includes(token)) {
            matched += 1;
        }
    }

    return matched / topicTokens.length;
}

async function queryMcpSnapSearch(query, semester, subject) {
    if (!MCP_BASE_URL) {
        throw new Error('MCP base URL not configured');
    }

    const base = MCP_BASE_URL.replace(/\/$/, '');
    const url = new URL(`${base}${MCP_JSONRPC_PATH}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), MCP_TIMEOUT_MS);

    try {
        const payload = {
            jsonrpc: '2.0',
            id: `snapsearch-${Date.now()}`,
            method: 'tools/call',
            params: {
                name: 'SnapSearch',
                arguments: {
                    query,
                    ...(semester ? { semester } : {}),
                    ...(subject ? { subject } : {}),
                    results_per_page: 20
                }
            }
        };

        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/event-stream'
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(`MCP JSON-RPC error: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        if (data?.error) {
            const code = data.error.code ?? 'unknown';
            const message = data.error.message ?? 'Unknown error';
            throw new Error(`MCP JSON-RPC error: ${code} ${message}`);
        }

        const text = data?.result?.content?.find(item => item?.type === 'text')?.text
            ?? data?.result?.content?.[0]?.text;
        if (!text || typeof text !== 'string') {
            throw new Error('Invalid MCP snap-search response');
        }

        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch {
            if (/no results found/i.test(text)) {
                return [];
            }
            throw new Error('Invalid MCP snap-search response');
        }

        const items = Array.isArray(parsed?.items)
            ? parsed.items
            : Array.isArray(parsed?.results)
                ? parsed.results
                : Array.isArray(parsed)
                    ? parsed
                    : null;

        if (!items) {
            throw new Error('Invalid MCP snap-search response');
        }

        return items.map(item => ({
            topic: item.topic,
            subject: item.subject,
            similarity: item.similarity,
            content: item.content ?? item.excerpt ?? ''
        }));
    } finally {
        clearTimeout(timeoutId);
    }
}

function flattenResourceLibrary(resourceLib) {
    if (!resourceLib || typeof resourceLib !== 'object') return [];

    const items = [];
    Object.entries(resourceLib).forEach(([semester, subjects]) => {
        if (!subjects || typeof subjects !== 'object') return;

        Object.entries(subjects).forEach(([subjectName, categories]) => {
            if (!Array.isArray(categories)) return;

            categories.forEach(category => {
                if (!category || !category.type || !Array.isArray(category.content)) return;

                category.content.forEach(topic => {
                    if (!topic) return;

                    items.push({
                        semester,
                        subject: subjectName,
                        category: category.type,
                        topic
                    });
                });
            });
        });
    });

    return items;
}

function buildMcpRankings(query, searchResults, snapResults, resourceLib, limit = 10) {
    if (!Array.isArray(snapResults)) return [];

    const baseResults = Array.isArray(searchResults) && searchResults.length > 0
        ? searchResults
        : flattenResourceLibrary(resourceLib);

    if (!Array.isArray(baseResults) || baseResults.length === 0) return [];

    const ranked = [];
    const seen = new Set();

    const sortedSnap = [...snapResults].sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

    for (const snap of sortedSnap) {
        if (!snap || !snap.subject || !snap.topic) continue;

        let matches = baseResults.filter(result =>
            topicMatches(result.subject, snap.subject) &&
            topicMatches(result.topic, snap.topic)
        );

        if (matches.length === 0 && snap.content) {
            const subjectMatches = baseResults.filter(result =>
                topicMatches(result.subject, snap.subject)
            );

            const scored = subjectMatches
                .map(result => {
                    const contentScore = topicScoreFromContent(snap.content, result.topic);
                    const topicScore = snap.topic
                        ? jaroWinkler(normalizeSearchText(snap.topic), normalizeSearchText(result.topic))
                        : 0;
                    const combined = Math.max(contentScore, topicScore);

                    return {
                        result,
                        score: combined
                    };
                })
                .filter(item => item.score >= 0.35)
                .sort((a, b) => b.score - a.score)
                .slice(0, 2)
                .map(item => item.result);

            matches = scored;
        }

        for (const match of matches) {
            const key = `${match.semester}|${match.subject}|${match.category}|${match.topic}`;
            if (seen.has(key)) continue;
            seen.add(key);

            ranked.push({
                semester: match.semester,
                subject: match.subject,
                category: match.category,
                topic: match.topic,
                relevance: relevanceFromSimilarity(snap.similarity),
                explanation: `Text match for "${query}" in ${match.subject} -> ${match.topic}`
            });

            if (ranked.length >= limit) return ranked;
        }
    }

    return ranked;
}

// ---------------------------------------------------------------------------
// INTENT EXTRACTOR
// Converts garbled / conversational queries into clean keyword(s) for MCP.
// Rule-based pass runs first (free, ~0ms). LLM pass runs only for vague
// queries that the rules can't resolve.
// ---------------------------------------------------------------------------

/**
 * Rule-based intent extraction.
 * Returns { keywords: string[], subject: string|null, category: string|null, isVague: boolean }
 */
function extractIntent(query) {
    if (!query) return { keywords: [query], subject: null, category: null, isVague: false };

    const lower = query.toLowerCase().trim();

    // Strip filler phrases
    let cleaned = lower
        .replace(/\b(that one|this one|the one|that pdf|this pdf|the pdf|pdf with|pdf about|content about|content on|notes on|notes about|looking for|i want|i need|can you|please|pls|show me|give me|find me|need help with|help with|tell me about|give me|find)\b/g, ' ')
        .replace(/\b(material|materials|document|file|with|about|for|of|the|a|an|one|that|this|please|pls|show|give|find|help|info|information)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const tokens = cleaned.split(' ').filter(t => t.length >= 2);

    // Check abbreviation map for each token
    let subject = null;
    let category = null;
    const keywords = [];

    for (const token of tokens) {
        if (SUBJECT_ABBR_MAP[token]) {
            subject = SUBJECT_ABBR_MAP[token];
            // Add both short and long form as keywords
            keywords.push(token, ...tokenize(SUBJECT_ABBR_MAP[token]));
        } else if (CATEGORY_ABBR_MAP[token]) {
            category = CATEGORY_ABBR_MAP[token];
        } else if (token.length >= 3) {
            keywords.push(token);
        }
    }

    // Deduplicate keywords
    const uniqueKeywords = [...new Set(keywords)];

    // A query is "vague" if we couldn't extract at least 1 meaningful keyword
    const isVague = uniqueKeywords.length === 0 && !subject;

    // Best MCP query = subject expansion + remaining keywords
    const mcpKeywords = subject
        ? [subject, ...uniqueKeywords.filter(k => !tokenize(subject).includes(k))]
        : uniqueKeywords;

    return {
        keywords: mcpKeywords.length > 0 ? mcpKeywords : [query],
        subject,
        category,
        isVague
    };
}

/**
 * Call a self-hosted HF Spaces LLM endpoint (OpenAI-compatible API).
 * Throws if HF_LLM_URL is not set or call fails.
 */
async function callHfLlm(systemPrompt, userMessage, timeoutMs = 18000) {
    if (!HF_LLM_URL) throw new Error('HF_LLM_URL not configured');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const url = HF_LLM_URL.endsWith('/chat') || HF_LLM_URL.endsWith('/v1/chat/completions')
            ? HF_LLM_URL
            : `${HF_LLM_URL.replace(/\/$/, '')}/v1/chat/completions`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(HF_TOKEN ? { 'Authorization': `Bearer ${HF_TOKEN}` } : {})
            },
            body: JSON.stringify({
                model: 'local',  // HF Spaces ignores this but requires the field
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage }
                ],
                max_tokens: 512,
                temperature: 0.2
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`HF LLM error: ${response.status}`);

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;
        if (!content) throw new Error('Empty HF LLM response');

        const parsed = JSON.parse(content);
        if (!parsed || typeof parsed !== 'object') throw new Error('HF LLM returned non-object');
        if (!parsed.rankings || !Array.isArray(parsed.rankings)) throw new Error('HF LLM missing rankings');
        return parsed;
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Call OpenRouter with a single model attempt.
 * Returns the parsed AI response or throws.
 */
async function callOpenRouterLlm(model, systemPrompt, userMessage, timeoutMs = 20000) {
    if (!API_KEY) throw new Error('OpenRouter API key not configured');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://getmaterio.app',
                'X-Title': 'Materio Search'
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage }
                ],
                response_format: { type: 'json_object' }
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.status === 429) throw new Error(`Rate limit: ${model}`);
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const msg = errData.error?.message || 'Unknown error';
            if (response.status === 404 && msg.includes('No endpoints found')) {
                throw new Error(`Model unavailable: ${model}`);
            }
            throw new Error(`OpenRouter ${response.status}: ${msg}`);
        }

        const data = await response.json();
        if (!data.choices?.[0]?.message) throw new Error('Invalid OpenRouter response structure');

        const parsed = JSON.parse(data.choices[0].message.content);
        if (!parsed || typeof parsed !== 'object') throw new Error('OpenRouter returned non-object');
        if (!parsed.rankings || !Array.isArray(parsed.rankings)) throw new Error('OpenRouter missing rankings');
        return parsed;
    } finally {
        clearTimeout(timeoutId);
    }
}

/**
 * Race self-hosted HF LLM against OpenRouter — use whichever responds first.
 * Falls back gracefully if HF_LLM_URL is not configured.
 */
async function callLlmRace(systemPrompt, userMessage) {
    const promises = [];

    // Self-hosted HF LLM (if configured)
    if (HF_LLM_URL) {
        promises.push(
            callHfLlm(systemPrompt, userMessage).then(r => ({ source: 'hf', result: r }))
        );
    }

    // OpenRouter — try first model only (within race; sequential fallback runs after)
    if (API_KEY && GENERAL_MODELS.length > 0) {
        promises.push(
            callOpenRouterLlm(GENERAL_MODELS[0], systemPrompt, userMessage).then(r => ({ source: 'openrouter', result: r }))
        );
    }

    if (promises.length === 0) throw new Error('No LLM providers configured');

    // Promise.any: resolves with first success, ignores individual failures
    try {
        const { source, result } = await Promise.any(promises);
        console.log(`LLM response from: ${source}`);
        return result;
    } catch {
        // Promise.any rejects with AggregateError only if ALL promises rejected
        // Try remaining OpenRouter models sequentially as final fallback
        if (API_KEY) {
            let lastErr;
            for (const model of GENERAL_MODELS.slice(1)) {
                try {
                    const result = await callOpenRouterLlm(model, systemPrompt, userMessage);
                    console.log(`LLM fallback succeeded with model: ${model}`);
                    return result;
                } catch (e) {
                    lastErr = e;
                    if (!e.message.includes('Rate limit') && !e.message.includes('unavailable') && !e.message.includes('AbortError')) {
                        throw e; // Non-retryable
                    }
                }
            }
            throw lastErr || new Error('All OpenRouter models failed');
        }
        throw new Error('All LLM providers failed');
    }
}

/**
 * Call HF Spaces Reranker.
 */
async function callHfReranker(query, documents, topK = 10) {
    if (!HF_RERANKER_URL) return null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
        const response = await fetch(HF_RERANKER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(HF_TOKEN ? { 'Authorization': `Bearer ${HF_TOKEN}` } : {})
            },
            body: JSON.stringify({
                query,
                documents,
                top_k: topK
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`Reranker error: ${response.status}`);

        const data = await response.json();
        return data; // Array of { index, score, text }
    } catch (error) {
        clearTimeout(timeoutId);
        console.warn('Reranker failed:', error.message);
        return null;
    }
}

/**
 * AI-powered search using MCP snap-search, Reranker, and dual-host LLM fallback.
 * Flow: intent extraction → HF Reranker (if configured) → MCP SnapSearch → (if weak) LLM race
 */
async function aiSearch(query, searchResults, resourceLib) {
    // Step 1: Extract intent to get clean keyword
    const intent = extractIntent(query);
    const cleanQuery = intent.keywords.slice(0, 3).join(' ');

    console.log(`Intent extracted: keywords=[${intent.keywords.join(', ')}] subject=${intent.subject} category=${intent.category} vague=${intent.isVague}`);

    // Step 2: Reranker phase (if we have a URL and algorithmic results)
    if (HF_RERANKER_URL && searchResults && searchResults.length > 0) {
        try {
            // Build document strings for reranker
            const docsToRerank = searchResults.slice(0, 20).map(r =>
                `${r.subject} ${r.category} ${r.topic}`
            );

            const rerankerQuery = intent.subject ? `${intent.subject} ${cleanQuery}` : query;
            console.log(`Calling Reranker with query: "${rerankerQuery}"`);

            const reranked = await callHfReranker(rerankerQuery, docsToRerank, 10);

            if (reranked && Array.isArray(reranked) && reranked.length > 0) {
                // Map back to our search result objects
                const finalRankings = reranked.map(item => {
                    const originalResult = searchResults[item.index];
                    return {
                        semester: originalResult.semester,
                        subject: originalResult.subject,
                        category: originalResult.category,
                        topic: originalResult.topic,
                        relevance: item.score > 0.8 ? 'high' : item.score > 0.4 ? 'medium' : 'low',
                        explanation: `Reranker score: ${(item.score * 100).toFixed(1)}%`
                    };
                }).filter(r => r.relevance !== 'low'); // Filter out low relevance

                if (finalRankings.length > 0) {
                    return {
                        intent: `Reranked semantic match for "${query}"`,
                        rankings: finalRankings,
                        suggestions: []
                    };
                }
            }
        } catch (err) {
            console.warn('Reranker step failed, falling back to MCP:', err.message);
        }
    }

    // Step 3: MCP SnapSearch fallback
    try {
        let snapQuery = cleanQuery || query;
        let snapResults = await queryMcpSnapSearch(snapQuery, undefined, intent.subject || undefined);

        // Retry with raw query if clean query returned nothing
        if ((!snapResults || snapResults.length === 0) && snapQuery !== query) {
            snapQuery = query;
            snapResults = await queryMcpSnapSearch(snapQuery);
        }

        const rankings = buildMcpRankings(snapQuery, searchResults, snapResults, resourceLib);

        // If MCP returned useful rankings, skip LLM entirely
        if (rankings.length > 0) {
            return {
                intent: intent.subject
                    ? `Searching ${intent.subject}${intent.category ? ' → ' + intent.category : ''}`
                    : `Semantic match for "${snapQuery}"`,
                rankings,
                suggestions: []
            };
        }
    } catch (error) {
        if (MCP_AI_SEARCH_ONLY) throw error;
        console.warn('MCP SnapSearch failed, falling back to LLM:', error.message);
    }

    // Step 3: LLM race (HF self-hosted vs OpenRouter) for vague/unresolved queries
    if (!API_KEY && !HF_LLM_URL) {
        throw new Error('No LLM provider configured (set OPENROUTER_API_KEY or HF_LLM_URL)');
    }

    const allSubjects = Object.values(resourceLib)
        .flatMap(sem => Object.keys(sem))
        .filter((v, i, a) => a.indexOf(v) === i)
        .join(', ');

    const systemPrompt = `You are an intelligent, conversational search assistant for an educational resource library. You understand natural language queries, vague descriptions, and can suggest topics.

**Library Structure:**
- Semesters: 1-7
- Subjects: ${allSubjects}
- Categories: Chapters, Question Banks, Assignments, Lab Manual, Presentations, Other
- Each subject has multiple content items (chapters, topics, assignments)

**Your Capabilities:**
1. **Understand conversational queries:**
   - "that one topic that has things about turing machine" → Find Turing Machine content
   - "what should i start with?" → Suggest introductory/Chapter 1 topics
   - "i need help with java" → Find Java/EPJ resources
   - "show me assignments" → Filter Assignment category

2. **Interpret vague descriptions:**
   - Match partial keywords to full subject names
   - Understand context (e.g., "automata stuff" → Theory of Computation)
   - Recognize abbreviations (OS, DADV, EPJ, TOC, DAA, SE, CNIP)

3. **Provide smart suggestions:**
   - If query is too vague: Suggest related subjects/topics
   - If asking "where to start": Prioritize introductory chapters
   - If no good matches: Suggest similar topics from available subjects

4. **Analyze algorithmic results and:**
   - Rank by true relevance (not just keyword match)
   - Explain WHY each result matches the user's intent
   - Filter out irrelevant results
   - Add context to help users understand the content

**Response Format (JSON):**
{
    "intent": "Conversational description of what user wants",
    "rankings": [
        {
            "semester": "semester number",
            "subject": "full subject name",
            "category": "category type",
            "topic": "exact content item name",
            "relevance": "high|medium|low",
            "explanation": "Natural, helpful explanation of why this matches"
        }
    ],
    "suggestions": ["helpful suggestions if results are poor or query is vague"]
}

**Important:** 
- Rankings should ONLY include items from the algorithmic search results provided
- Use exact semester/subject/category/topic values from the search results
- Relevance: "high" = perfect match, "medium" = related/helpful, "low" = tangentially relevant
- If query is vague (e.g., "what to start with"), suggest introductory topics from multiple subjects
- Empty rankings array is OK if no results match the intent`;

    const userMessage = `User Query: "${query}"

${searchResults.length > 0
            ? `Algorithmic Search Results (${searchResults.length} found):
${searchResults.slice(0, 10).map((r, i) => `${i + 1}. Semester ${r.semester} | ${r.subject} | ${r.category} | ${r.topic}`).join('\n')}`
            : `Algorithmic Search Results: No matches found

Available subjects to suggest from:
${allSubjects}`}

**Query Analysis Hints:**
- Vague queries like "what to start with", "where do i begin": Suggest Chapter 1 / Introduction topics from multiple subjects
- Phrases like "that one topic about X": Find all content containing X
- Just subject names: Show all available categories/chapters for that subject
- Category requests ("show assignments", "need question banks"): Filter by category

**Task:**
1. Understand what the user is really asking for (handle vague/conversational language)
2. Rank the most relevant results from the list above
3. Provide helpful explanations for each ranking
4. If query is vague or results are poor, provide suggestions

Remember: Only rank items from the search results above. Use exact values for semester/subject/category/topic.`;

    // Race HF self-hosted LLM vs OpenRouter — fastest response wins
    return await callLlmRace(systemPrompt, userMessage);
}

/**
 * Merge AI rankings with algorithmic results
 * Applies AI relevance scores to boost/reorder algorithmic results
 */
function mergeAIRankings(algorithmicResults, aiRankings) {
    if (!aiRankings || !Array.isArray(aiRankings)) {
        return algorithmicResults;
    }

    // Create a map of AI rankings for quick lookup
    const aiRankingMap = new Map();
    aiRankings.forEach((ranking, index) => {
        const key = `${ranking.semester}|${ranking.subject}|${ranking.category}|${ranking.topic}`;
        aiRankingMap.set(key, {
            relevance: ranking.relevance,
            explanation: ranking.explanation,
            aiRank: index + 1 // Position in AI ranking (1-based)
        });
    });

    // Apply AI scores to algorithmic results
    const mergedResults = algorithmicResults.map(result => {
        const key = `${result.semester}|${result.subject}|${result.category}|${result.topic}`;
        const aiData = aiRankingMap.get(key);

        if (aiData) {
            // AI found this result relevant - boost score based on relevance
            let aiBoost = 0;
            if (aiData.relevance === 'high') {
                aiBoost = 40; // Strong boost
            } else if (aiData.relevance === 'medium') {
                aiBoost = 20; // Moderate boost
            } else if (aiData.relevance === 'low') {
                aiBoost = 5; // Small boost
            }

            // Also boost based on AI ranking position (earlier = better)
            const positionBoost = Math.max(0, 15 - (aiData.aiRank * 2)); // Top result gets +15, decreases by 2 per position

            const newScore = Math.min(100, result.score + aiBoost + positionBoost);

            return {
                ...result,
                score: newScore,
                matchType: newScore >= 90 ? 'exact' :
                    newScore >= 75 ? 'high' :
                        newScore >= 60 ? 'medium' : 'low',
                aiRelevance: aiData.relevance,
                aiExplanation: aiData.explanation,
                aiRanked: true
            };
        }

        // Not in AI rankings - slightly penalize to prioritize AI-ranked results
        return {
            ...result,
            score: Math.round(result.score * 0.9), // 10% penalty
            aiRanked: false
        };
    });

    // Re-sort by new scores
    mergedResults.sort((a, b) => {
        // Prioritize AI-ranked results first
        if (a.aiRanked && !b.aiRanked) return -1;
        if (!a.aiRanked && b.aiRanked) return 1;
        // Then by score
        return b.score - a.score;
    });

    return mergedResults;
}

// ============= API HANDLERS =============

function getCorsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };
}

module.exports = async (req, res) => {
    const headers = getCorsHeaders();

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Handle GET /search?q=query&useAI=true&aiMode=pure
        if (req.method === 'GET') {
            const query = req.query.q || req.query.query;
            const useAI = req.query.useAI === 'true';
            const aiMode = req.query.aiMode || 'hybrid'; // 'hybrid' or 'pure'
            const threshold = parseFloat(req.query.threshold) || 0.4;

            if (!query) {
                return res.status(400).json({
                    success: false,
                    error: 'Query parameter "q" or "query" is required'
                });
            }

            // Validate query for inappropriate content
            const validation = validateSearchQuery(query);
            if (!validation.valid) {
                if (validation.reason === 'inappropriate') {
                    // Return empty results for inappropriate content (no details exposed)
                    return res.status(200).json({
                        success: true,
                        query,
                        results: [],
                        count: 0,
                        method: useAI ? 'blocked_ai' : 'blocked_algo',
                        blocked: true,
                        message: useAI
                            ? 'Your search query contains inappropriate content and cannot be processed.'
                            : undefined
                    });
                } else if (validation.reason === 'too_long') {
                    return res.status(400).json({
                        success: false,
                        error: 'Query is too long (max 200 characters)'
                    });
                }
            }

            // Discovery mode: handle zero-keyword queries ("suggest random", "where to start")
            const semester = req.query.semester || null; // frontend passes selected semester
            if (isDiscoveryQuery(query)) {
                const resourceLib = await fetchResourceLibrary();
                const discoveryResult = pickDiscoveryResult(resourceLib, semester);
                if (discoveryResult) {
                    return res.status(200).json({
                        success: true,
                        query,
                        results: [discoveryResult],
                        count: 1,
                        method: 'discovery',
                        aiUsed: false,
                        isDiscovery: true
                    });
                }
            }

            // Run algorithmic search (BM25 primary + Fuse fallback)
            const searchThreshold = useAI ? 0.6 : threshold;
            const searchLimit = useAI ? 30 : 20;
            let algorithmicResults = await searchResources(query, searchThreshold, searchLimit);

            // If AI is requested and API key is available
            if (useAI && API_KEY) {
                try {
                    const resourceLib = await fetchResourceLibrary();
                    const aiResults = await aiSearch(query, algorithmicResults, resourceLib);

                    // Validate AI results
                    if (!aiResults || !aiResults.rankings || !Array.isArray(aiResults.rankings)) {
                        console.warn('AI returned invalid results structure, falling back to algorithmic');
                        throw new Error('Invalid AI response structure');
                    }

                    // Pure AI mode - return only AI-ranked results
                    if (aiMode === 'pure' && aiResults.rankings.length > 0) {
                        const pureAIResults = aiResults.rankings.map((ranking, index) => ({
                            semester: ranking.semester,
                            subject: ranking.subject,
                            category: ranking.category,
                            topic: ranking.topic,
                            score: ranking.relevance === 'high' ? 95 :
                                ranking.relevance === 'medium' ? 75 : 50,
                            matchType: ranking.relevance,
                            aiExplanation: ranking.explanation,
                            aiRank: index + 1
                        }));

                        return res.status(200).json({
                            success: true,
                            query,
                            results: pureAIResults,
                            count: pureAIResults.length,
                            ai: aiResults,
                            method: 'ai',
                            aiUsed: true
                        });
                    }

                    // Pure AI mode but no rankings - return empty AI result
                    if (aiMode === 'pure' && aiResults.rankings.length === 0) {
                        return res.status(200).json({
                            success: true,
                            query,
                            results: [],
                            count: 0,
                            ai: aiResults,
                            method: 'ai',
                            aiUsed: true
                        });
                    }

                    // Hybrid mode (default) - merge AI rankings with algorithmic results
                    if (!aiResults.rankings || aiResults.rankings.length === 0) {
                        return res.status(200).json({
                            success: true,
                            query,
                            results: algorithmicResults,
                            count: algorithmicResults.length,
                            algorithmic: {
                                results: algorithmicResults,
                                count: algorithmicResults.length
                            },
                            ai: aiResults,
                            method: 'hybrid',
                            aiUsed: true
                        });
                    }

                    const mergedResults = mergeAIRankings(algorithmicResults, aiResults.rankings);

                    return res.status(200).json({
                        success: true,
                        query,
                        results: mergedResults,
                        count: mergedResults.length,
                        algorithmic: {
                            results: algorithmicResults,
                            count: algorithmicResults.length
                        },
                        ai: aiResults,
                        method: 'hybrid',
                        aiUsed: true
                    });
                } catch (aiError) {
                    console.error('AI search failed in GET request:', aiError);
                    // Fallback to algorithmic if AI fails
                    return res.status(200).json({
                        success: true,
                        query,
                        results: algorithmicResults,
                        count: algorithmicResults.length,
                        method: 'algorithmic',
                        aiUsed: false,
                        aiError: aiError.message
                    });
                }
            }

            // Return algorithmic-only results
            return res.status(200).json({
                success: true,
                query,
                results: algorithmicResults,
                count: algorithmicResults.length,
                method: 'algorithmic',
                aiUsed: false
            });
        }

        // Handle POST /search (with AI fallback option)
        if (req.method === 'POST') {
            const { query, useAI = false, aiMode = 'hybrid', threshold = 0.4 } = req.body || {};

            if (!query) {
                return res.status(400).json({
                    success: false,
                    error: 'Query is required'
                });
            }

            // Validate query for inappropriate content
            const validation = validateSearchQuery(query);
            if (!validation.valid) {
                if (validation.reason === 'inappropriate') {
                    // Return empty results for inappropriate content (no details exposed)
                    return res.status(200).json({
                        success: true,
                        query,
                        results: [],
                        count: 0,
                        method: useAI ? 'blocked_ai' : 'blocked_algo',
                        blocked: true,
                        message: useAI
                            ? 'Your search query contains inappropriate content and cannot be processed.'
                            : undefined
                    });
                } else if (validation.reason === 'too_long') {
                    return res.status(400).json({
                        success: false,
                        error: 'Query is too long (max 200 characters)'
                    });
                }
            }

            // Discovery mode for POST
            const semester = req.body.semester || null;
            if (isDiscoveryQuery(query)) {
                const resourceLib = await fetchResourceLibrary();
                const discoveryResult = pickDiscoveryResult(resourceLib, semester);
                if (discoveryResult) {
                    return res.status(200).json({
                        success: true,
                        query,
                        results: [discoveryResult],
                        count: 1,
                        method: 'discovery',
                        aiUsed: false,
                        isDiscovery: true
                    });
                }
            }

            // Run algorithmic search (BM25 primary + Fuse fallback)
            const searchThreshold = useAI ? 0.6 : threshold;
            const searchLimit = useAI ? 30 : 20;
            let algorithmicResults = await searchResources(query, searchThreshold, searchLimit);

            // If AI is requested and we have poor results (or user explicitly wants AI)
            if (useAI && API_KEY) {
                try {
                    const resourceLib = await fetchResourceLibrary();
                    const aiResults = await aiSearch(query, algorithmicResults, resourceLib);

                    // Validate AI results
                    if (!aiResults || !aiResults.rankings || !Array.isArray(aiResults.rankings)) {
                        console.warn('AI returned invalid results structure, falling back to algorithmic');
                        throw new Error('Invalid AI response structure');
                    }

                    // Pure AI mode - return only AI-ranked results
                    if (aiMode === 'pure' && aiResults.rankings.length > 0) {
                        const pureAIResults = aiResults.rankings.map((ranking, index) => ({
                            semester: ranking.semester,
                            subject: ranking.subject,
                            category: ranking.category,
                            topic: ranking.topic,
                            score: ranking.relevance === 'high' ? 95 :
                                ranking.relevance === 'medium' ? 75 : 50,
                            matchType: ranking.relevance,
                            aiExplanation: ranking.explanation,
                            aiRank: index + 1
                        }));

                        return res.status(200).json({
                            success: true,
                            query,
                            results: pureAIResults,
                            count: pureAIResults.length,
                            ai: aiResults,
                            method: 'ai',
                            aiUsed: true
                        });
                    }

                    // Pure AI mode but no rankings - return empty AI result
                    if (aiMode === 'pure' && aiResults.rankings.length === 0) {
                        return res.status(200).json({
                            success: true,
                            query,
                            results: [],
                            count: 0,
                            ai: aiResults,
                            method: 'ai',
                            aiUsed: true
                        });
                    }

                    // Hybrid mode (default) - merge AI rankings with algorithmic results
                    if (!aiResults.rankings || aiResults.rankings.length === 0) {
                        return res.status(200).json({
                            success: true,
                            query,
                            results: algorithmicResults,
                            count: algorithmicResults.length,
                            algorithmic: {
                                results: algorithmicResults,
                                count: algorithmicResults.length
                            },
                            ai: aiResults,
                            method: 'hybrid',
                            aiUsed: true
                        });
                    }

                    const mergedResults = mergeAIRankings(algorithmicResults, aiResults.rankings);

                    return res.status(200).json({
                        success: true,
                        query,
                        results: mergedResults,
                        count: mergedResults.length,
                        algorithmic: {
                            results: algorithmicResults,
                            count: algorithmicResults.length
                        },
                        ai: aiResults,
                        method: 'hybrid',
                        aiUsed: true
                    });
                } catch (aiError) {
                    // Fallback to algorithmic if AI fails
                    return res.status(200).json({
                        success: true,
                        query,
                        results: algorithmicResults,
                        count: algorithmicResults.length,
                        method: 'algorithmic',
                        aiUsed: false,
                        aiError: aiError.message
                    });
                }
            }

            // Return algorithmic results only
            return res.status(200).json({
                success: true,
                query,
                results: algorithmicResults,
                count: algorithmicResults.length,
                method: 'algorithmic',
                aiUsed: false
            });
        }

        return res.status(405).json({
            success: false,
            error: 'Method not allowed'
        });

    } catch (error) {
        console.error('Search Error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// ============= STANDALONE TESTING =============
// For local testing
if (require.main === module) {
    const testQueries = [
        'os introduction',
        'intro os',
        'dadv qb',
        'EPJ servlets',
        'data analytics question bank',
        'operating system chapter 1',
        'java enterprise programming',
        'cnip week 5',
        'python flask'
    ];

    console.log('Testing Search Algorithm:\n');

    (async () => {
        for (const query of testQueries) {
            console.log(`\nQuery: "${query}"`);
            console.log('Results:');
            try {
                const results = await searchResources(query);
                results.slice(0, 5).forEach((r, i) => {
                    console.log(`  ${i + 1}. [${r.score}%] Sem ${r.semester} - ${r.subject} > ${r.category} > ${r.topic}`);
                });
            } catch (error) {
                console.error(`  Error: ${error.message}`);
            }
        }
    })();
}
