#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');

const rootDir = path.join(__dirname, '..');

// Generate a fresh build ID before serving
try {
  console.log('Generating build ID...');
  execSync('node scripts/generate-build-id.js', {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true
  });
} catch (err) {
  console.warn('Warning: Could not generate build ID:', err.message);
}

const port = process.env.PORT || 4000;
execSync(`bundle exec jekyll serve --port ${port} --livereload --config _config.yml,_config.tauri.yml`, {
  cwd: rootDir,
  stdio: 'inherit',
  env: { ...process.env, JEKYLL_ENV: 'tauri' },
  shell: true
});
