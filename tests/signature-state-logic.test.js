const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'autoSign.js'), 'utf8');

assert(!source.includes('return true;\\n            } else {\\n                // no confirm button'), 'missing confirm button must not be treated as signed');
assert(!source.includes("setStatus('签署流程：文件已签署，跳过')"), 'missing signature widget must not show signed/skip status');
assert(!source.includes("setStatus('签署流程：文件已签署，返回成功')"), 'missing confirm button must not show signed/success status');

assert(
  /if \(!signatureModuleNow \|\| !isElementVisible\(signatureModuleNow\)\) \{[\s\S]*?return false;[\s\S]*?\}/.test(source),
  'missing signature widget must return false'
);

assert(
  /未找到确认签署按钮[\s\S]*?return false;/.test(source),
  'missing confirm-sign button must return false'
);

assert(
  source.includes('file.querySelector(SELECTORS.pendingStatus)') &&
    source.includes('没有检测到待签文件'),
  'pending list state must drive whether files remain'
);
