#!/usr/bin/env node

/**
 * Version bump script for GitHub Actions
 * Updates version directly in index.html based on branch and commit count
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get branch name and commit count
const branch = process.env.GITHUB_REF_NAME || 'main';
const commitCount = parseInt(execSync('git rev-list --count HEAD').toString().trim());
const shortSha = execSync('git rev-parse --short HEAD').toString().trim();

// Read index.html
const indexPath = path.join(process.cwd(), 'index.html');
let indexContent = fs.readFileSync(indexPath, 'utf8');

// Find current version
const versionMatch = indexContent.match(/<strong[^>]*>v(\d+)\.(\d+)\.(\d+)-beta[^<]*<\/strong>/);
if (!versionMatch) {
    console.error('Could not find version in index.html');
    process.exit(1);
}

// Calculate version based on commit count
// Start from 2.0.0 and increment patch for each commit
const baseVersion = { major: 2, minor: 0, patch: 0 };
let patch = (baseVersion.patch + commitCount) % 100;
let minor = baseVersion.minor + Math.floor((baseVersion.patch + commitCount) / 100);
let major = baseVersion.major + Math.floor(minor / 100);
minor = minor % 100;

// Add branch suffix
const branchSuffix = branch === 'stable' ? 'stable' : 'beta';
const newVersion = `${major}.${minor}.${patch}-${branchSuffix}`;

// Replace all version occurrences
const versionRegex = /<strong([^>]*)>v\d+\.\d+\.\d+-[^<]*<\/strong>/g;
indexContent = indexContent.replace(versionRegex, `<strong$1>v${newVersion}</strong>`);

// Write updated HTML
fs.writeFileSync(indexPath, indexContent);

console.log(`✅ Version updated to v${newVersion} (commit #${commitCount}, sha: ${shortSha})`);
console.log(`📝 Branch: ${branch}`);