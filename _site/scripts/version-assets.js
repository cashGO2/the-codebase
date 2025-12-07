const fs = require('fs');
const path = require('path');
const { globSync } = require('glob');
const crypto = require('crypto');

const buildDir = '_site';

console.log(`Versioning assets in ${buildDir} using content hashing...`);

// Cache for file hashes to avoid re-reading/re-hashing the same file multiple times
const fileHashCache = new Map();

function getFileHash(filePath) {
  if (fileHashCache.has(filePath)) {
    return fileHashCache.get(filePath);
  }

  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(filePath);
    const hash = crypto.createHash('md5').update(content).digest('hex').substring(0, 10);
    fileHashCache.set(filePath, hash);
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

    // Regex to match href="..." or src="..." where the value ends in .css or .js
    // We want to capture the URL to resolve it and hash the file
    const regex = /(href|src)=("|')([^"']+\.(css|js))("|')/gi;

    const newContent = content.replace(regex, (match, attr, quote1, url, ext, quote2) => {
      // Skip external links
      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) {
        return match;
      }

      // Skip if already has a version query param
      if (url.includes('?v=') || url.includes('&v=')) {
        return match;
      }

      // Resolve file path
      let assetPath;
      if (url.startsWith('/')) {
        // Root relative
        assetPath = path.join(buildDir, url);
      } else {
        // Relative to current HTML file
        assetPath = path.join(path.dirname(file), url);
      }

      // Get content hash
      const hash = getFileHash(assetPath);

      if (!hash) {
        // File not found or error, return original match
        return match;
      }

      const separator = url.includes('?') ? '&' : '?';
      const newUrl = `${url}${separator}v=${hash}`;
      
      fileChanged = true;
      return `${attr}=${quote1}${newUrl}${quote2}`;
    });

    if (fileChanged) {
      fs.writeFileSync(file, newContent);
      updatedCount++;
    }
  });

  console.log(`Successfully updated ${updatedCount} HTML files with content hashes.`);

} catch (error) {
  console.error('Error versioning assets:', error);
  process.exit(1);
}
