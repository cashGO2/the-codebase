#!/usr/bin/env node
/**
 * Build static frontend for Tauri (bundled in app). APIs stay on Vercel.
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');

function run(command, extraEnv) {
  execSync(command, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
    shell: true
  });
}

function postProcessFiles(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      postProcessFiles(fullPath);
    } else {
      const ext = path.extname(file).toLowerCase();
      if (ext === '.html' || ext === '.js' || ext === '.css') {
        let content = fs.readFileSync(fullPath, 'utf8');
        let original = content;

        // Replace getmaterio.app domains
        content = content.replace(/https:\/\/getmaterio\.app\/(?!api\/)/g, '/');
        content = content.replace(/https:\/\/getmaterio\.app(?![\w/:\-?=&%.#]*\/api)/g, '/');

        // Replace materioa.vercel.app domains
        content = content.replace(/https:\/\/materioa\.vercel\.app\/(?!api\/)/g, '/');
        content = content.replace(/https:\/\/materioa\.vercel\.app(?![\w/:\-?=&%.#]*\/api)/g, '/');

        if (content !== original) {
          fs.writeFileSync(fullPath, content, 'utf8');
        }
      }
    }
  }
}

console.log('[tauri] Generating build metadata…');
run('node scripts/generate-build-id.js');
run('node scripts/generate-insightroom-fallback.js');

console.log('[tauri] Jekyll build (JEKYLL_ENV=tauri)…');
run('bundle exec jekyll build --config _config.yml,_config.tauri.yml', { JEKYLL_ENV: 'tauri' });

console.log('[tauri] Rewriting full URLs to relative...');
postProcessFiles(path.join(root, '_site'));

console.log('[tauri] Minifying and versioning assets…');
run('node scripts/minify-assets.js');
run('node scripts/version-assets.js');

console.log('[tauri] Frontend ready at _site/');
