const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');
const crypto = require('crypto');

const buildDir = '_site';
const cacheFile = '.asset-hash-cache.json';

console.log(`Versioning assets in ${buildDir} using content hashing...`);

// Load persistent cache
let assetCache = {};
if (fs.existsSync(cacheFile)) {
  try {
    assetCache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  } catch (e) {
    console.warn('Failed to load asset cache, starting fresh.');
  }
}

// In-memory cache for this run (to handle multiple references to same file)
const fileHashCache = new Map();
let cacheHits = 0;
let cacheMisses = 0;

function getFileHash(filePath) {
  // 1. Check in-memory cache first
  if (fileHashCache.has(filePath)) {
    return fileHashCache.get(filePath);
  }

  // 2. Try to map to source file to use persistent cache
  // filePath is like '_site/assets/style/style.css'
  // sourcePath should be 'assets/style/style.css'
  let relativePath = path.relative(buildDir, filePath);
  let sourcePath = relativePath; // Assuming 1:1 mapping for assets
  
  // Normalize key to forward slashes for consistency across OS
  const cacheKey = sourcePath.split(path.sep).join('/');
  
  // Check if source file exists
  if (fs.existsSync(sourcePath)) {
      const stats = fs.statSync(sourcePath);
      const mtime = stats.mtimeMs;
      
      if (assetCache[cacheKey] && assetCache[cacheKey].mtime === mtime) {
          // Cache hit!
          cacheHits++;
          const hash = assetCache[cacheKey].hash;
          fileHashCache.set(filePath, hash);
          return hash;
      }
  }

  // 3. Calculate hash from build file
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    cacheMisses++;
    const content = fs.readFileSync(filePath);
    const hash = crypto.createHash('md5').update(content).digest('hex').substring(0, 10);
    
    fileHashCache.set(filePath, hash);
    
    // Update persistent cache if source exists
    if (fs.existsSync(sourcePath)) {
        const stats = fs.statSync(sourcePath);
        assetCache[cacheKey] = {
            mtime: stats.mtimeMs,
            hash: hash
        };
    }
    
    return hash;
  } catch (e) {
    console.warn(`Warning: Could not hash file ${filePath}: ${e.message}`);
    return null;
  }
}

try {
  // Find all HTML files in the build directory
  const htmlFiles = globSync(`${buildDir}/**/*.html`);

  if (htmlFiles.length === 0) {
    console.log('No HTML files found to update.');
    process.exit(0);
  }

  let updatedCount = 0;

  htmlFiles.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let fileChanged = false;

    // Regex to match href="..." or src="..."
    // We capture the URL to check extension and hash
    const regex = /(href|src)=("|')([^"']+)("|')/gi;

    const newContent = content.replace(regex, (match, attr, quote1, url, quote2) => {
      // 1. Extract clean path (remove query and hash)
      const cleanUrl = url.split('?')[0].split('#')[0];
      
      // 2. Check extension
      if (!cleanUrl.match(/\.(css|js)$/i)) {
          return match;
      }

      // 3. Skip external links
      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) {
        return match;
      }

      // 4. Resolve file path
      let assetPath;
      if (cleanUrl.startsWith('/')) {
        // Root relative
        assetPath = path.join(buildDir, cleanUrl);
      } else {
        // Relative to current HTML file
        assetPath = path.join(path.dirname(file), cleanUrl);
      }

      // 5. Get content hash
      const hash = getFileHash(assetPath);

      if (!hash) {
        // File not found or error, return original match
        return match;
      }

      // 6. Construct new URL
      let newUrl;
      if (url.match(/(\?|&)v=[^&]*/)) {
          // Replace existing v
          newUrl = url.replace(/(\?|&)v=[^&]*/, `$1v=${hash}`);
      } else {
          // Append v
          const separator = url.includes('?') ? '&' : '?';
          newUrl = `${url}${separator}v=${hash}`;
      }
      
      // 7. Check if changed
      if (newUrl === url) {
          return match;
      }
      
      fileChanged = true;
      return `${attr}=${quote1}${newUrl}${quote2}`;
    });

    if (fileChanged) {
      fs.writeFileSync(file, newContent);
      updatedCount++;
    }
  });

  // Save persistent cache
  try {
    fs.writeFileSync(cacheFile, JSON.stringify(assetCache, null, 2));
  } catch (e) {
    console.warn('Failed to save asset cache:', e.message);
  }

  console.log(`Asset hashing complete: ${cacheHits} cache hits, ${cacheMisses} cache misses.`);
  console.log(`Injected content hashes into ${updatedCount} HTML files.`);

} catch (error) {
  console.error('Error versioning assets:', error);
  process.exit(1);
}
