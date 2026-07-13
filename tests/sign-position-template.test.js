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
assert(source.includes('附近表格画布特征'), 'settings should explain the visual anchor scope');
assert(source.includes('function calculateVisualAnchorRect('), 'visual anchor rectangle should be derived from the learned sign position');
assert(source.includes('function createVisualAnchorFromCanvas('), 'learning should capture a local visual anchor from the PDF canvas');
assert(source.includes('function findVisualAnchorAcrossPages('), 'template signing should scan all pages for the learned visual anchor');
assert(source.includes('function getVisualAnchorMatchDecision('), 'visual anchor matching should have an explicit safety decision');
assert(source.includes("reason: 'ambiguous'"), 'ambiguous visual matches should be rejected');
assert(source.includes("targetSource = 'visual-anchor'"), 'matching should record when a visual anchor selected the target');
assert(source.includes('表格锚点已学习'), 'settings should show whether a template has a learned visual anchor');

const rectHelpersStart = source.indexOf('function clampNumber(');
const rectHelpersEnd = source.indexOf('function normalizeVisualAnchor(', rectHelpersStart);
assert(rectHelpersStart !== -1 && rectHelpersEnd !== -1, 'visual anchor rectangle helpers should be readable');
const { calculateVisualAnchorRect } = new Function(`${source.slice(rectHelpersStart, rectHelpersEnd)}; return { calculateVisualAnchorRect };`)();
const anchorRect = calculateVisualAnchorRect(0.3, 0.86);
assert(anchorRect.x < 0.3, 'visual anchor should preserve context to the left of the learned sign position');
assert(anchorRect.targetOffsetX > anchorRect.width, 'learned target should remain to the right of the sampled table context');
assert(anchorRect.y >= 0 && anchorRect.y + anchorRect.height <= 1, 'visual anchor rectangle should stay within the page');

const decisionStart = source.indexOf('function getVisualAnchorMatchDecision(');
const decisionEnd = source.indexOf('function findVisualAnchorMatchesOnThumbnail(', decisionStart);
assert(decisionStart !== -1 && decisionEnd !== -1, 'visual anchor decision helper should be readable');
const getVisualAnchorMatchDecision = new Function(
  'VISUAL_ANCHOR_MAX_SCORE',
  'VISUAL_ANCHOR_MIN_SCORE_GAP',
  `${source.slice(decisionStart, decisionEnd)}; return getVisualAnchorMatchDecision;`
)(0.16, 0.018);
assert.strictEqual(getVisualAnchorMatchDecision(0.1, 0.14).matched, true, 'a strong and distinct match should be accepted');
assert.strictEqual(getVisualAnchorMatchDecision(0.1, 0.11).reason, 'ambiguous', 'nearby candidate scores should require manual handling');
assert.strictEqual(getVisualAnchorMatchDecision(0.2, Infinity).reason, 'low-score', 'weak image matches should be rejected');
assert(source.includes('function formatTemplatePageLabel('), 'template page rule should have a user-facing summary');
assert(source.includes('data-auto-sign-template-summary'), 'selected template should display its page rule');
assert(source.includes('data-auto-sign-template-review'), 'learning should show a review editor before saving');
assert(source.includes('修改名称和页码'), 'saved templates should support metadata editing');
assert(source.includes('重新学习位置'), 'saved templates should support position relearning');
assert(source.includes('editingTemplateId'), 'relearning should update the existing template');
assert(source.includes("badge.title = normalizedText"), 'full status text should remain available as a tooltip');
assert(source.includes("statusBadge.style.whiteSpace = 'normal'"), 'status text should wrap instead of being truncated');
