const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'autoSign.js'), 'utf8');

assert(source.includes('function getControlToolbar()'), '控制按钮应统一放进工具条容器');
assert(source.includes("data-auto-sign-toolbar"), '工具条容器应有稳定标识');
assert(source.includes("toolbar.style.display = 'flex'"), '工具条应使用 flex 布局');
assert(source.includes("toolbar.style.gap = '8px'"), '工具条子元素应保持固定间距');
assert(source.includes('toolbar.appendChild(button);'), '运行按钮应放入工具条');
assert(source.includes('toolbar.appendChild(settingsButton);'), '设置按钮应放入工具条');
assert(source.includes('toolbar.appendChild(statusBadge);'), '状态栏应放入工具条');
assert(
  !source.includes("settingsButton.style.left = '100px'") &&
    !source.includes("statusBadge.style.left = '150px'"),
  '设置按钮和状态栏不能再使用固定 left 偏移'
);
