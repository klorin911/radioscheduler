/* eslint-env node */
/* eslint-disable @typescript-eslint/no-require-imports */
'use strict';

const fs = require('fs');
const path = require('path');

function getTagFromEnv() {
  const name = process.env.GITHUB_REF_NAME || '';
  if (name) return name;
  const ref = process.env.GITHUB_REF || '';
  const m = ref.match(/^refs\/tags\/(.+)$/);
  return m ? m[1] : '';
}

try {
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const version = pkg.version;

  if (!version) {
    console.error('package.json is missing version');
    process.exit(1);
  }

  const tag = getTagFromEnv();

  if (!tag) {
    console.error('GITHUB_REF_NAME not set and could not infer tag from GITHUB_REF');
    process.exit(1);
  }

  if (tag !== `v${version}`) {
    console.error(`Tag ${tag} does not match package.json version v${version}`);
    process.exit(1);
  }

  console.log(`Tag ${tag} matches package.json version v${version}`);
} catch (err) {
  console.error('Error while validating tag/version:', err && err.message ? err.message : err);
  process.exit(1);
}