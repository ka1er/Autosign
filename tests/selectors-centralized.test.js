const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'autoSign.js'), 'utf8');

[
  'batchSignIcon',
  'batchDialog',
  'batchBodyCheckboxInput',
  'fileListItem',
  'pendingStatus',
  'fileTitle',
  'signatureCanvas',
  'signatureModule',
  'primaryButton'
].forEach(key => {
  assert(source.includes(`${key}:`), `SELECTORS missing ${key}`);
});

assert(source.includes('const SELECTORS = Object.freeze'), 'selectors must be centralized in SELECTORS');
assert(source.includes('SELECTORS.batchSignIcon'), 'batch sign icon selector should use SELECTORS');
assert(source.includes('SELECTORS.signatureCanvas'), 'signature canvas selector should use SELECTORS');
assert(source.includes('SELECTORS.signatureModule'), 'signature module selector should use SELECTORS');
assert(source.includes('SELECTORS.pendingStatus'), 'pending status selector should use SELECTORS');
assert(source.includes('SELECTORS.fileListItem'), 'file list selector should use SELECTORS');
