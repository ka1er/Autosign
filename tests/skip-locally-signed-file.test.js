const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'autoSign.js'), 'utf8');

assert(source.includes("const LOCAL_SIGNED_FILE_ATTR = 'data-auto-sign-locally-signed';"), 'local signed marker attribute should exist');
assert(source.includes('function markSelectedFileSignedLocally()'), 'successful signing should mark the selected file locally');
assert(source.includes('let currentProcessingFile = null;'), 'script should remember the exact file row currently being processed');
assert(source.includes('function setCurrentProcessingFile(file, source)'), 'script should record the clicked file row before waiting/signing');
assert(source.includes('function getCurrentProcessingFile()'), 'script should prefer the current processing row when marking a file as signed');
assert(source.includes('document.documentElement.contains(currentProcessingFile)'), 'current processing row should only be reused while it is still in the page');
assert(source.includes('function isLocallySignedFile(file)'), 'next-file lookup should be able to skip locally signed files');
assert(source.includes('function clearLocalSignedFileMarkers()'), 'manual/fresh starts should clear local signed markers');
assert(source.includes("addAutoSignEvent('local_file_signed'"), 'local signed marker should be logged');
assert(source.includes("addAutoSignEvent('skip_locally_signed_file'"), 'skipping a stale pending file should be logged');

const clickStart = source.indexOf('async function clickNextFile()');
const clickEnd = source.indexOf('// 统一检测流程', clickStart);
assert(clickStart !== -1 && clickEnd !== -1, 'clickNextFile should exist');
const clickBody = source.slice(clickStart, clickEnd);

assert(clickBody.includes('isLocallySignedFile(file)'), 'clickNextFile should skip files already signed in this run');
assert(clickBody.includes("setCurrentProcessingFile(targetFile, 'click_next_file');"), 'clickNextFile should remember the exact target row');
assert(clickBody.includes('continue;'), 'clickNextFile should continue after skipping a locally signed pending file');

const detectionStart = source.indexOf('async function runDetectionFlow()');
const detectionEnd = source.indexOf('function notifyAttention', detectionStart);
assert(detectionStart !== -1 && detectionEnd !== -1, 'runDetectionFlow should exist');
const detectionBody = source.slice(detectionStart, detectionEnd);
assert(detectionBody.includes('isLocallySignedFile(file)'), 'runDetectionFlow should skip files already signed in this run');
assert(detectionBody.includes("setCurrentProcessingFile(file, 'detection_flow');"), 'runDetectionFlow should remember the exact target row');

const signStart = source.indexOf('async function signProcess()');
const signEnd = source.indexOf('// 检查当前页面类型', signStart);
assert(signStart !== -1 && signEnd !== -1, 'signProcess should exist');
const signBody = source.slice(signStart, signEnd);

assert(signBody.includes('markSelectedFileSignedLocally();'), 'signProcess should mark current file only after a successful confirmation flow');
