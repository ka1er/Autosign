const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'autoSign.js'), 'utf8');

assert(source.includes('let rawSeconds = localStorage.getItem(QUERY_INTERVAL_KEY);'), 'query interval getter should read raw storage before converting to number');
assert(source.includes("rawSeconds === null || rawSeconds === undefined || rawSeconds === ''"), 'missing query interval setting should use default value');
assert(source.includes("const NEXT_FILE_TIMEOUT_KEY = 'autoSignNextFileTimeoutMinutes';"), 'file load timeout setting key should exist');
assert(source.includes('function getNextFileTimeoutMinutes()'), 'file load timeout getter should exist');
assert(source.includes('function setNextFileTimeoutMinutes(minutes)'), 'file load timeout setter should exist');
assert(source.includes('let rawMinutes = localStorage.getItem(NEXT_FILE_TIMEOUT_KEY);'), 'file load timeout getter should read raw storage before converting to number');
assert(source.includes("rawMinutes === null || rawMinutes === undefined || rawMinutes === ''"), 'missing file load timeout setting should use default value');
assert(source.includes('return Math.min(Math.max(Math.round(minutes), 1), 10);'), 'file load timeout should allow at least 1 minute and cap the upper range');
assert(source.includes('return getNextFileTimeoutMinutes() * 60 * 1000;'), 'file load timeout milliseconds should derive from minutes');
assert(source.includes('文件加载超时'), 'settings UI or logs should describe file load timeout clearly');
assert(source.includes('文件加载超时：${getNextFileTimeoutMinutes()} 分钟'), 'exported logs should include file load timeout');
assert(source.includes('nextFileTimeoutMinutes: getNextFileTimeoutMinutes()'), 'structured event logs should include file load timeout');

const waitStart = source.indexOf('async function waitForNextFileReady');
const waitEnd = source.indexOf('// 获取文件列表并点击第一个待签署的文件', waitStart);
assert(waitStart !== -1 && waitEnd !== -1, 'waitForNextFileReady should exist');
const waitBody = source.slice(waitStart, waitEnd);

assert(!waitBody.includes('const selected = isFileItemSelected(targetFile);'), 'next file readiness should not depend on stale selected DOM state');
assert(!waitBody.includes('selected && canvasReady && signatureReady'), 'ready condition should only require page content and signature module');
assert(waitBody.includes('canvasReady && signatureReady && canvasChangedOrStable'), 'ready condition should wait for canvas and signature module');
