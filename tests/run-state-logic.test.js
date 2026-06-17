const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'autoSign.js'), 'utf8');

assert(source.includes("const AUTO_SIGN_STATE_KEY = 'autoSignState';"), '必须有统一运行状态 key');
assert(source.includes("const AUTO_SIGN_STATES = Object.freeze"), '必须定义统一状态枚举');
assert(source.includes('function getAutoSignState()'), '必须通过 getAutoSignState 读取主状态');
assert(source.includes('function setAutoSignState(state, syncGmState = true)'), '必须通过 setAutoSignState 写入主状态');
assert(source.includes('function isAutoSignRunningState()'), '必须通过统一状态判断是否运行中');
assert(source.includes('function isAutoSignManuallyStoppedState()'), '必须通过统一状态判断是否手动停止');
assert(source.includes("setAutoSignState(AUTO_SIGN_STATES.RUNNING);"), '启动流程必须写 running 状态');
assert(
  source.includes("updateRunningState(false, true, manual ? AUTO_SIGN_STATES.STOPPED : AUTO_SIGN_STATES.IDLE);"),
  '停止流程必须区分手动 stopped 和自动 idle'
);
assert(
  !source.includes("GM_addValueChangeListener && GM_addValueChangeListener('autoSignRunning'"),
  'GM 监听应切换到 autoSignState，不再监听旧 autoSignRunning'
);
assert(
  !source.includes('legacyRunning') && !source.includes('legacyManualStopped'),
  '新状态不存在时必须默认 idle，不能从旧字段推断运行或停止'
);
assert(
  !source.includes("GM_addValueChangeListener && GM_addValueChangeListener(MANUAL_STOP_KEY"),
  '不再监听旧 manual stop 字段，避免旧状态残留影响新脚本'
);
