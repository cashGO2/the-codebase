const fs = require('fs/promises');
const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env') });

const DEFAULT_API = 'https://room.getmaterio.app/api/posts';
const OUTPUT_FILE = path.join(process.cwd(), '_data', 'insightroom_fallback.json');

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date).replace(/\//g, '-');
}

function normalizePost(post) {
  return {
    title: post.title || '',
    excerpt: (post.excerpt || '').replace(/\s+/g, ' ').trim(),
    date: formatDate(post.date),
    url: post.link || post.url || '',
    image: post.imgUrl || post.image || ''
  };
}

async function fetchInsightroomPosts() {
  const apiUrl = new URL(process.env.INSIGHTROOM_API || DEFAULT_API);
  if (!apiUrl.searchParams.has('num')) {
    apiUrl.searchParams.set('num', '5');
  }

  const response = await fetch(apiUrl, {
    headers: {
      'accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Insightroom API returned ${response.status}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

async function main() {
  let posts = [];

  try {
    posts = await fetchInsightroomPosts();
  } catch (error) {
    console.warn('[insightroom-fallback] fetch failed, writing empty fallback:', error.message);
  }

  const publicPosts = posts
    .filter((post) => post && post.visibility !== 'private' && !post.hidden && !post.draft)
    .slice(0, 5)
    .map(normalizePost)
    .filter((post) => post.title && post.url);

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(OUTPUT_FILE, `${JSON.stringify(publicPosts, null, 2)}\n`, 'utf8');

  console.log(`[insightroom-fallback] wrote ${publicPosts.length} post(s) to ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error('[insightroom-fallback] fatal error:', error);
  process.exitCode = 1;
});