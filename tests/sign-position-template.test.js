const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'autoSign.js'), 'utf8');

assert(source.includes("const SIGN_PLACEMENT_MODES = Object.freeze"), 'sign placement modes should be explicit');
assert(source.includes("FIXED: 'fixed'"), 'fixed position mode should remain available');
assert(source.includes("TEMPLATE: 'template'"), 'template position mode should be available');
assert(source.includes('function resolveTemplatePageNumber('), 'template page resolver should exist');
assert(source.includes("anchor === 'from-end'"), 'template should support counting pages from the end');
assert(source.includes('normalizedTotal - normalizedOffset + 1'), 'from-end page calculation should use total pages');
const resolverSource = source.match(/function resolveTemplatePageNumber\([\s\S]*?\n    \}/)?.[0];
assert(resolverSource, 'template page resolver should be readable for behavior checks');
const resolveTemplatePageNumber = new Function(`${resolverSource}; return resolveTemplatePageNumber;`)();
assert.strictEqual(resolveTemplatePageNumber(19, 'from-end', 6), 14, '19 pages from-end 6 should resolve to page 14');
assert.strictEqual(resolveTemplatePageNumber(16, 'from-end', 6), 11, 'from-end anchor should adapt to shorter files');
assert.strictEqual(resolveTemplatePageNumber(22, 'from-end', 6), 17, 'from-end anchor should adapt to longer files');
assert.strictEqual(resolveTemplatePageNumber(19, 'from-start', 6), 6, 'from-start anchor should keep the absolute leading offset');
assert.strictEqual(resolveTemplatePageNumber(4, 'from-end', 6), null, 'missing target page should fail safely');
assert(source.includes('xRatio'), 'template should store a horizontal ratio');
assert(source.includes('yRatio'), 'template should store a vertical ratio');
assert(source.includes("signatureCanvasBox: '.canvasbox'"), 'canvas box selector should be centralized');
assert(source.includes("signatureOverlay: '.myDragArea'"), 'signature overlay selector should be centralized');
assert(source.includes("signaturePage: '.cans'"), 'signature page selector should be centralized');
assert(source.includes("data-auto-sign-learning-save"), 'learning mode should expose a save command');
assert(source.includes("data-auto-sign-learning-cancel"), 'learning mode should expose a cancel command');
assert(source.includes('页面比例与模板不一致'), 'template mismatch should stop instead of guessing');
assert(source.includes('位置模板仅记录落点'), 'settings should explain the beta scope');
