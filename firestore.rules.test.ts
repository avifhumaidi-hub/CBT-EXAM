import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const rulesText = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
const blueprint = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'firebase-blueprint.json'), 'utf8'));

// Verify Phase 0–6 invariants in firestore.rules
assert.match(rulesText, /rules_version\s*=\s*'2';/, 'Must use rules_version = 2');
assert.match(rulesText, /match \/\{document=\*\*\} \{\s*allow read, write: if false;/, 'Must start with global deny');
assert.match(rulesText, /request\.auth\.token\.email_verified == true/, 'Must mandate verified email');
assert.match(rulesText, /kipaskoplak@gmail\.com/, 'Must include bootstrapped runtime admin');
assert.doesNotMatch(rulesText, /allow\s+(?:read|list)\s*:\s*if\s+(?:true|isSignedIn\(\))\s*;/, 'Must not contain blanket open/isSignedIn list reads');

// Verify every collection in firebase-blueprint.json has a matching match block in firestore.rules
const collections = Object.keys(blueprint.firestore || {});
for (const colPath of collections) {
  const colName = colPath.split('/')[1];
  assert.match(
    rulesText,
    new RegExp(`match \\/${colName}\\/\\{`),
    `Missing match block for blueprint collection: ${colName}`
  );
}

// Dirty Dozen payload validation helper checks
const dirtyDozenAssertions: Array<[string, RegExp]> = [
  ['Unverified Email Spoof', /request\.auth\.token\.email_verified == true/],
  ['Ghost Field Injection', /keys\(\)\.hasOnly\(/],
  ['Self-Assigned Admin', /match \/admins\/\{adminUid\}[\s\S]*?allow create:[^;]*isAdmin\(\)/],
  ['Wrong Password Session Claim', /get\(\/databases\/\$\(database\)\/documents\/students\/\$\(incoming\(\)\.nis\)\)\.data\.passHash == incoming\(\)\.passHash/],
  ['Cross-Student Session Hijack', /isStudentForNis\(nis\)/],
  ['Terminal State Replay', /existing\(\)\.status != 'Selesai'/],
  ['ID Poisoning Guard', /isValidId\(/],
  ['Timestamp Forgery', /incoming\(\)\.createdAt == request\.time/],
  ['Blanket Scraping Guard', /match \/students\/\{nis\}[\s\S]*?allow list:\s*if isAdmin\(\) \|\| isProctor\(\);/],
  ['Secret Exfiltration Guard', /match \/app_secrets\/\{docId\}[\s\S]*?allow get:[^;]*isAdmin\(\) \|\| isProctor\(\)/],
  ['Value Poisoning String Size', /\.size\(\) <=/],
  ['Immutable Ownership Tampering', /incoming\(\)\.nis == existing\(\)\.nis/]
];

for (const [label, pattern] of dirtyDozenAssertions) {
  assert.match(rulesText, pattern, `Dirty Dozen check failed: ${label}`);
}

console.log(`All ${collections.length} collections and ${dirtyDozenAssertions.length} Dirty Dozen invariants verified.`);
