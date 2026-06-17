const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'autoSign.js'), 'utf8');

[
  '正在打开批量签章窗口',
  '正在刷新待签章列表',
  '正在勾选待签章文件',
  '正在提交本批次签章',
  '正在等待签章页面加载',
  '正在执行签名操作',
  '正在切换下一个待签文件',
  '没有检测到待签文件',
  '请检查浏览器是否拦截弹窗',
  '请刷新页面后重试'
].forEach(text => {
  assert(source.includes(text), `缺少用户可见状态提示：${text}`);
});
