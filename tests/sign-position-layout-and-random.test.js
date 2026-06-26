const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'autoSign.js'), 'utf8');

const optionsStart = source.indexOf('const SIGN_POSITION_OPTIONS = [');
const optionsEnd = source.indexOf('];', optionsStart);
assert(optionsStart !== -1 && optionsEnd !== -1, 'SIGN_POSITION_OPTIONS should exist');
const optionsBlock = source.slice(optionsStart, optionsEnd);

const expectedOrder = [
  "{ value: 'top-left', label: '左上' }",
  "{ value: 'top-center', label: '上中' }",
  "{ value: 'top-right', label: '右上' }",
  "{ value: 'middle-left', label: '左中' }",
  "{ value: 'center', label: '居中' }",
  "{ value: 'middle-right', label: '右中' }",
  "{ value: 'bottom-left', label: '左下' }",
  "{ value: 'bottom-center', label: '下中' }",
  "{ value: 'bottom-right', label: '右下' }"
];

let lastIndex = -1;
for (const item of expectedOrder) {
  const nextIndex = optionsBlock.indexOf(item);
  assert(nextIndex > lastIndex, `position option order should include ${item}`);
  lastIndex = nextIndex;
}

assert(source.includes("const RANDOM_SIGN_POSITION_MODES = SIGN_POSITION_OPTIONS.map(option => option.value);"), 'random should pick from all fixed 3x3 position modes');
assert(source.includes("const RANDOM_SIGN_POSITION_OPTION = { value: 'random', label: '随机' };"), 'random should be a separate button outside the 3x3 grid');
assert(!source.includes('Math.random() * (rect.width - marginX * 2)'), 'random should not pick arbitrary x inside the canvas');
assert(!source.includes('Math.random() * (rect.height - marginY * 2)'), 'random should not pick arbitrary y inside the canvas');
assert(source.includes('const marginX = rect.width * 0.05;'), 'horizontal edge margin should be 5 percent');
assert(source.includes('const marginY = rect.height * 0.05;'), 'vertical edge margin should be 5 percent');
assert(source.includes("randomPositionButton.style.width = '100%'"), 'random button should sit below the 3x3 grid');
assert(source.includes('randomSignPositionSelected'), 'random signing should record the actual selected fixed position');
assert(source.includes("addAutoSignEvent('random_sign_position'"), 'random signing should add a structured event with the selected position');
assert(source.includes("panel.style.maxHeight = 'calc(100vh - 70px)'"), 'settings panel should be height-limited for small screens');
assert(source.includes("panel.style.overflowY = 'auto'"), 'settings panel should scroll when content is taller than the viewport');
assert(source.includes("queryIntervalRow.style.justifyContent = 'center'"), 'query interval row should be centered');
assert(source.includes("timeoutRow.style.justifyContent = 'center'"), 'file timeout row should be centered');
