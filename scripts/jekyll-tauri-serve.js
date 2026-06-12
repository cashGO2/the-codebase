#!/usr/bin/env node
const { execSync } = require('child_process');
const path = require('path');

const port = process.env.PORT || 4000;
execSync(`bundle exec jekyll serve --port ${port} --livereload --config _config.yml,_config.tauri.yml`, {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
  env: { ...process.env, JEKYLL_ENV: 'tauri' },
  shell: true
});
