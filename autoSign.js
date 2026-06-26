// ==UserScript==
// @name         PMS系统自动签章助手
// @namespace    http://tampermonkey.net/
// @version      1.1.9-beta
// @description  PMS系统签章自动化助手 - 支持签字位置设置和优化的签名流程
// @author       kaler
// @match        *://*.chinamobile.com/*
// @match        *://cpms.hq.cmcc/*
// @match        *://*/pageseal/signature*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// ==/UserScript==

(function() {
    'use strict';

    const SIGN_POSITION_KEY = 'autoSignPosition';
    const QUERY_INTERVAL_KEY = 'autoSignQueryIntervalSeconds';
    const NEXT_FILE_TIMEOUT_KEY = 'autoSignNextFileTimeoutMinutes';
    const AUTO_SIGN_STATE_KEY = 'autoSignState';
    const MANUAL_STOP_KEY = 'autoSignManualStopped';
    const BATCH_SUBMITTED_KEY = 'autoSignBatchSubmittedOnce';
    const AUTO_SIGN_LOG_KEY = 'autoSignRecentLogs';
    const ENTRY_FLOW_READY_TIMEOUT = 120000;
    const AUTO_SIGN_STATES = Object.freeze({
        IDLE: 'idle',
        RUNNING: 'running',
        STOPPED: 'stopped',
        ERROR: 'error'
    });
    const SELECTORS = Object.freeze({
        batchSignIcon: 'i.icon.font_family.icon-piliangchuli',
        batchDialog: '.el-dialog',
        batchDialogBodyCheckbox: '.el-dialog__body .el-checkbox__input, .el-dialog__body .el-checkbox__original',
        batchBodyCheckboxInput: '.el-table__body-wrapper .el-checkbox__input',
        batchCheckedCheckboxInput: '.el-table__body-wrapper .el-checkbox__input.is-checked',
        batchBodyUncheckedCheckboxInput: '.el-table__body-wrapper .el-checkbox__input:not(.is-checked)',
        batchBodyWrapper: '.el-table__body-wrapper',
        batchHeaderCheckboxInput: '.el-dialog__body th.el-table-column--selection .el-checkbox__input, .el-dialog__body .el-table__header-wrapper th.el-table-column--selection .el-checkbox__input, th.el-table-column--selection .el-checkbox__input',
        batchHeaderCheckbox: '.el-dialog__body th.el-table-column--selection .el-checkbox__input, .el-dialog__body th.el-table-column--selection .el-checkbox, .el-dialog__body .el-table__header-wrapper th .el-checkbox, .el-dialog__body .el-table__header-wrapper .el-checkbox',
        batchPaginationTotal: '.el-pagination__total',
        dialogHeader: '.el-dialog__header',
        dialogFooterButton: '.el-dialog__footer .el-button',
        dialogDefaultFooterButton: '.el-dialog__footer .el-button--default',
        dialogPrimaryFooterButton: '.el-dialog__footer .dialog-footer button.el-button--primary',
        elementButton: 'button.el-button',
        signEntryButton: 'button.el-button.el-button--primary.is-plain',
        fileListItem: 'ul.tempList li.flex',
        pendingStatus: '.status-box.status-pending',
        fileTitle: '.tem-title',
        signatureCanvas: 'canvas.canvasstyle',
        signatureModule: 'div.carousel-i-New',
        primaryButton: 'button.el-button--primary',
        messageBox: '.el-message-box',
        loadingMask: '.el-loading-mask'
    });
    const SIGN_POSITION_OPTIONS = [
        { value: 'top-left', label: '左上' },
        { value: 'bottom-left', label: '左下' },
        { value: 'bottom-right', label: '右下' },
        { value: 'top-right', label: '右上' },
        { value: 'center', label: '中间' },
        { value: 'random', label: '随机位置' }
    ];

    function getControlToolbar() {
        let toolbar = document.querySelector('div[data-auto-sign-toolbar]');
        if (toolbar) {
            return toolbar;
        }

        toolbar = document.createElement('div');
        toolbar.setAttribute('data-auto-sign-toolbar', 'true');
        toolbar.style.position = 'fixed';
        toolbar.style.top = '10px';
        toolbar.style.left = '10px';
        toolbar.style.zIndex = '9999';
        toolbar.style.display = 'flex';
        toolbar.style.alignItems = 'center';
        toolbar.style.gap = '8px';
        toolbar.style.pointerEvents = 'auto';
        document.body.appendChild(toolbar);
        return toolbar;
    }

    // 创建控制按钮
    let statusBadge = null;
    function createControlButton() {
        // 检查是否已存在按钮
        let existingButton = document.querySelector('button[data-auto-sign-control]');
        if (existingButton) {
            return existingButton;
        }

        const button = document.createElement('button');
        button.setAttribute('data-auto-sign-control', 'true');
        const isRunning = isAutoSignRunningState();
        button.innerHTML = isRunning ? '停止运行' : '运行';
        button.style.padding = '8px 16px';
        button.style.cursor = 'pointer';
        button.style.backgroundColor = '#409EFF';
        button.style.color = 'white';
        button.style.border = 'none';
        button.style.borderRadius = '4px';
        button.style.fontSize = '14px';
        button.style.fontWeight = 'bold';
        
        button.onmouseover = function() {
            this.style.backgroundColor = '#66b1ff';
        };
        button.onmouseout = function() {
            this.style.backgroundColor = '#409EFF';
        };

        // 修改点击事件处理
        button.onclick = function() {
            const currentRunning = isAutoSignRunningState();
            console.log('按钮点击，当前运行状态:', currentRunning);
            
            if (currentRunning) {
                console.log('手动停止脚本运行');
                addAutoSignEvent('manual_stop_click', { running: currentRunning }, 'warn');
                stopProcess(true); // 传入true表示手动停止
            } else {
                console.log('启动脚本运行');
                addAutoSignEvent('manual_start_click', { running: currentRunning }, 'info');
                manualStopped = false; // 重置手动停止标记
                setAutoSignState(AUTO_SIGN_STATES.IDLE);
                resetBatchSubmitted();
                resetSignEntryClickedFlags();
                startProcess();
            }
        };
        
        const toolbar = getControlToolbar();
        toolbar.appendChild(button);
        createSettingsButton();
        if (!statusBadge) {
            statusBadge = document.createElement('span');
            statusBadge.setAttribute('data-auto-sign-status', 'true');
            statusBadge.setAttribute('data-auto-sign-status-type', 'idle');
            statusBadge.style.display = 'inline-flex';
            statusBadge.style.alignItems = 'center';
            statusBadge.style.gap = '6px';
            statusBadge.style.padding = '6px 10px';
            statusBadge.style.borderRadius = '999px';
            statusBadge.style.fontSize = '12px';
            statusBadge.style.fontWeight = '600';
            statusBadge.style.whiteSpace = 'nowrap';
            statusBadge.style.maxWidth = '280px';
            statusBadge.style.overflow = 'hidden';
            statusBadge.style.textOverflow = 'ellipsis';
            const statusDot = document.createElement('span');
            statusDot.setAttribute('data-auto-sign-status-dot', 'true');
            statusDot.style.width = '7px';
            statusDot.style.height = '7px';
            statusDot.style.borderRadius = '999px';
            statusDot.style.flex = '0 0 auto';
            const statusText = document.createElement('span');
            statusText.setAttribute('data-auto-sign-status-text', 'true');
            statusText.style.overflow = 'hidden';
            statusText.style.textOverflow = 'ellipsis';
            statusText.innerText = '就绪';
            statusBadge.appendChild(statusDot);
            statusBadge.appendChild(statusText);
            toolbar.appendChild(statusBadge);
            setStatus('就绪', 'idle', false);
        }
        return button;
    }

    function getSignPositionMode() {
        let mode = localStorage.getItem(SIGN_POSITION_KEY);
        try {
            mode = (GM_getValue && GM_getValue(SIGN_POSITION_KEY)) || mode;
        } catch (e) {}
        if (!SIGN_POSITION_OPTIONS.some(option => option.value === mode)) {
            mode = 'top-right';
        }
        return mode;
    }

    function getSignPositionLabel(mode) {
        const option = SIGN_POSITION_OPTIONS.find(item => item.value === mode);
        return option ? option.label : '右上';
    }

    function setSignPositionMode(mode) {
        if (!SIGN_POSITION_OPTIONS.some(option => option.value === mode)) {
            return;
        }
        try { GM_setValue && GM_setValue(SIGN_POSITION_KEY, mode); } catch (e) {}
        localStorage.setItem(SIGN_POSITION_KEY, mode);
    }

    function getQueryIntervalSeconds() {
        let rawSeconds = localStorage.getItem(QUERY_INTERVAL_KEY);
        try {
            const gmValue = GM_getValue && GM_getValue(QUERY_INTERVAL_KEY);
            if (gmValue !== undefined && gmValue !== null && gmValue !== '') {
                rawSeconds = gmValue;
            }
        } catch (e) {}
        const seconds = rawSeconds === null || rawSeconds === undefined || rawSeconds === ''
            ? 3
            : Number(rawSeconds);
        return Math.min(Math.max(Math.round(seconds), 3), 15);
    }

    function setQueryIntervalSeconds(seconds) {
        const normalizedSeconds = Math.min(Math.max(Math.round(Number(seconds) || 3), 3), 15);
        try { GM_setValue && GM_setValue(QUERY_INTERVAL_KEY, normalizedSeconds); } catch (e) {}
        localStorage.setItem(QUERY_INTERVAL_KEY, String(normalizedSeconds));
        return normalizedSeconds;
    }

    function getQueryIntervalMs() {
        return getQueryIntervalSeconds() * 1000;
    }

    function normalizeNextFileTimeoutMinutes(minutes) {
        if (!Number.isFinite(minutes)) {
            minutes = 5;
        }
        return Math.min(Math.max(Math.round(minutes), 1), 10);
    }

    function getNextFileTimeoutMinutes() {
        let rawMinutes = localStorage.getItem(NEXT_FILE_TIMEOUT_KEY);
        try {
            const gmValue = GM_getValue && GM_getValue(NEXT_FILE_TIMEOUT_KEY);
            if (gmValue !== undefined && gmValue !== null && gmValue !== '') {
                rawMinutes = gmValue;
            }
        } catch (e) {}
        const minutes = rawMinutes === null || rawMinutes === undefined || rawMinutes === ''
            ? 5
            : Number(rawMinutes);
        return normalizeNextFileTimeoutMinutes(minutes);
    }

    function setNextFileTimeoutMinutes(minutes) {
        const normalizedMinutes = normalizeNextFileTimeoutMinutes(Number(minutes));
        try { GM_setValue && GM_setValue(NEXT_FILE_TIMEOUT_KEY, normalizedMinutes); } catch (e) {}
        localStorage.setItem(NEXT_FILE_TIMEOUT_KEY, String(normalizedMinutes));
        return normalizedMinutes;
    }

    function getNextFileTimeoutMs() {
        return getNextFileTimeoutMinutes() * 60 * 1000;
    }

    function normalizeAutoSignState(state) {
        return Object.values(AUTO_SIGN_STATES).includes(state) ? state : AUTO_SIGN_STATES.IDLE;
    }

    function getAutoSignState() {
        let gmState = null;
        try { gmState = GM_getValue && GM_getValue(AUTO_SIGN_STATE_KEY); } catch (e) {}
        if (Object.values(AUTO_SIGN_STATES).includes(gmState)) {
            return gmState;
        }

        const localRawState = localStorage.getItem(AUTO_SIGN_STATE_KEY);
        if (Object.values(AUTO_SIGN_STATES).includes(localRawState)) {
            return localRawState;
        }

        return AUTO_SIGN_STATES.IDLE;
    }

    function setAutoSignState(state, syncGmState = true) {
        const normalizedState = normalizeAutoSignState(state);
        const running = normalizedState === AUTO_SIGN_STATES.RUNNING;
        const stopped = normalizedState === AUTO_SIGN_STATES.STOPPED;

        if (syncGmState) {
            try { GM_setValue && GM_setValue(AUTO_SIGN_STATE_KEY, normalizedState); } catch (e) {}
            try { GM_setValue && GM_setValue('autoSignRunning', running); } catch (e) {}
            try { GM_setValue && GM_setValue(MANUAL_STOP_KEY, stopped); } catch (e) {}
        }
        localStorage.setItem(AUTO_SIGN_STATE_KEY, normalizedState);
        sessionStorage.setItem(AUTO_SIGN_STATE_KEY, normalizedState);
        localStorage.setItem('autoSignRunning', String(running));
        sessionStorage.setItem('autoSignRunning', String(running));
        manualStopped = stopped;
        return normalizedState;
    }

    function isAutoSignRunningState() {
        return getAutoSignState() === AUTO_SIGN_STATES.RUNNING;
    }

    function isAutoSignManuallyStoppedState() {
        return getAutoSignState() === AUTO_SIGN_STATES.STOPPED;
    }

    function createSettingsButton() {
        if (document.querySelector('button[data-auto-sign-settings]')) {
            return;
        }

        const settingsButton = document.createElement('button');
        settingsButton.setAttribute('data-auto-sign-settings', 'true');
        settingsButton.innerHTML = '设置';
        settingsButton.style.padding = '8px 12px';
        settingsButton.style.cursor = 'pointer';
        settingsButton.style.backgroundColor = '#67C23A';
        settingsButton.style.color = 'white';
        settingsButton.style.border = 'none';
        settingsButton.style.borderRadius = '4px';
        settingsButton.style.fontSize = '14px';
        settingsButton.style.fontWeight = 'bold';

        settingsButton.onmouseover = function() {
            if (!isAutoSignRunningState()) {
                this.style.backgroundColor = '#85ce61';
            }
        };
        settingsButton.onmouseout = function() {
            this.style.backgroundColor = isAutoSignRunningState() ? '#A0CFFF' : '#67C23A';
        };
        settingsButton.onclick = function() {
            toggleSettingsPanel();
        };

        const toolbar = getControlToolbar();
        toolbar.appendChild(settingsButton);
        updateSettingsButtonState(isAutoSignRunningState());
    }

    function applySettingButtonStyle(button, active = false) {
        button.style.height = '30px';
        button.style.border = active ? '1px solid #409EFF' : '1px solid #dcdfe6';
        button.style.borderRadius = '6px';
        button.style.backgroundColor = active ? '#ecf5ff' : '#fff';
        button.style.color = active ? '#1677d2' : '#303133';
        button.style.fontSize = '12px';
        button.style.fontWeight = active ? '600' : '500';
        button.style.cursor = isAutoSignRunningState() ? 'not-allowed' : 'pointer';
    }

    function updateSignPositionButtons() {
        const currentMode = getSignPositionMode();
        document.querySelectorAll('button[data-auto-sign-position-option]').forEach(button => {
            applySettingButtonStyle(button, button.dataset.value === currentMode);
            button.disabled = isAutoSignRunningState();
            button.style.opacity = button.disabled ? '0.55' : '1';
        });
    }

    function setSettingsDisabledState(running) {
        const disabledHint = document.querySelector('div[data-auto-sign-settings-running-hint]');
        const queryIntervalDecrease = document.querySelector('button[data-auto-sign-query-interval-decrease]');
        const queryIntervalIncrease = document.querySelector('button[data-auto-sign-query-interval-increase]');
        const nextFileTimeoutDecrease = document.querySelector('button[data-auto-sign-next-file-timeout-decrease]');
        const nextFileTimeoutIncrease = document.querySelector('button[data-auto-sign-next-file-timeout-increase]');
        updateSignPositionButtons();
        if (queryIntervalDecrease) {
            queryIntervalDecrease.disabled = running === true;
            queryIntervalDecrease.style.opacity = running ? '0.55' : '1';
            queryIntervalDecrease.style.cursor = running ? 'not-allowed' : 'pointer';
        }
        if (queryIntervalIncrease) {
            queryIntervalIncrease.disabled = running === true;
            queryIntervalIncrease.style.opacity = running ? '0.55' : '1';
            queryIntervalIncrease.style.cursor = running ? 'not-allowed' : 'pointer';
        }
        if (nextFileTimeoutDecrease) {
            nextFileTimeoutDecrease.disabled = running === true;
            nextFileTimeoutDecrease.style.opacity = running ? '0.55' : '1';
            nextFileTimeoutDecrease.style.cursor = running ? 'not-allowed' : 'pointer';
        }
        if (nextFileTimeoutIncrease) {
            nextFileTimeoutIncrease.disabled = running === true;
            nextFileTimeoutIncrease.style.opacity = running ? '0.55' : '1';
            nextFileTimeoutIncrease.style.cursor = running ? 'not-allowed' : 'pointer';
        }
        if (disabledHint) {
            disabledHint.style.display = running ? 'block' : 'none';
        }
    }

    function closeSettingsPanel() {
        const panel = document.querySelector('div[data-auto-sign-settings-panel]');
        if (panel) {
            panel.remove();
        }
        document.removeEventListener('mousedown', handleSettingsOutsideClick, true);
        document.removeEventListener('keydown', handleSettingsEscapeKey, true);
    }

    function handleSettingsOutsideClick(event) {
        const panel = document.querySelector('div[data-auto-sign-settings-panel]');
        const settingsButton = document.querySelector('button[data-auto-sign-settings]');
        if (!panel) return;
        if (panel.contains(event.target) || settingsButton?.contains(event.target)) {
            return;
        }
        closeSettingsPanel();
    }

    function handleSettingsEscapeKey(event) {
        if (event.key === 'Escape') {
            closeSettingsPanel();
        }
    }

    function toggleSettingsPanel() {
        let panel = document.querySelector('div[data-auto-sign-settings-panel]');
        if (panel) {
            closeSettingsPanel();
            return;
        }

        panel = document.createElement('div');
        panel.setAttribute('data-auto-sign-settings-panel', 'true');
        panel.style.position = 'fixed';
        panel.style.top = '48px';
        panel.style.left = '10px';
        panel.style.zIndex = '9999';
        panel.style.width = '280px';
        panel.style.padding = '14px';
        panel.style.backgroundColor = '#fff';
        panel.style.border = '1px solid #e4e7ed';
        panel.style.borderRadius = '8px';
        panel.style.boxShadow = '0 12px 28px rgba(31,45,61,0.18)';
        panel.style.fontSize = '13px';
        panel.style.color = '#303133';
        panel.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

        const positionSection = document.createElement('div');
        positionSection.style.padding = '10px';
        positionSection.style.border = '1px solid #ebeef5';
        positionSection.style.borderRadius = '8px';
        positionSection.style.backgroundColor = '#fafafa';

        const label = document.createElement('div');
        label.innerText = '签章位置';
        label.style.marginBottom = '8px';
        label.style.fontWeight = '700';
        label.style.color = '#303133';

        const positionGrid = document.createElement('div');
        positionGrid.setAttribute('data-auto-sign-position-grid', 'true');
        positionGrid.style.display = 'grid';
        positionGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
        positionGrid.style.gap = '6px';

        SIGN_POSITION_OPTIONS.forEach(option => {
            const item = document.createElement('button');
            item.setAttribute('data-auto-sign-position-option', 'true');
            item.dataset.value = option.value;
            item.innerText = option.label;
            item.onclick = function() {
                if (isAutoSignRunningState()) {
                    setStatus('运行中：停止后才能修改签字位置');
                    return;
                }
                setSignPositionMode(option.value);
                updateSignPositionButtons();
                setStatus(`已选择签字位置：${option.label}`);
            };
            positionGrid.appendChild(item);
        });

        positionSection.appendChild(label);
        positionSection.appendChild(positionGrid);

        const querySection = document.createElement('div');
        querySection.style.marginTop = '10px';
        querySection.style.padding = '10px';
        querySection.style.border = '1px solid #ebeef5';
        querySection.style.borderRadius = '8px';
        querySection.style.backgroundColor = '#fff';
        
        const queryLabel = document.createElement('div');
        queryLabel.innerText = '查询间隔';
        queryLabel.style.marginBottom = '8px';
        queryLabel.style.fontWeight = '700';
        queryLabel.style.color = '#303133';

        const queryIntervalRow = document.createElement('div');
        queryIntervalRow.style.display = 'flex';
        queryIntervalRow.style.alignItems = 'center';
        queryIntervalRow.style.gap = '8px';

        const queryIntervalDecrease = document.createElement('button');
        queryIntervalDecrease.setAttribute('data-auto-sign-query-interval-decrease', 'true');
        queryIntervalDecrease.innerText = '-';
        queryIntervalDecrease.style.width = '32px';
        queryIntervalDecrease.style.height = '30px';
        queryIntervalDecrease.style.border = '1px solid #dcdfe6';
        queryIntervalDecrease.style.borderRadius = '6px';
        queryIntervalDecrease.style.backgroundColor = '#fff';
        queryIntervalDecrease.style.cursor = 'pointer';
        queryIntervalDecrease.style.fontWeight = '700';

        const queryIntervalValue = document.createElement('span');
        queryIntervalValue.setAttribute('data-auto-sign-query-interval-value', 'true');
        queryIntervalValue.style.display = 'inline-block';
        queryIntervalValue.style.minWidth = '64px';
        queryIntervalValue.style.height = '30px';
        queryIntervalValue.style.lineHeight = '30px';
        queryIntervalValue.style.textAlign = 'center';
        queryIntervalValue.style.border = '1px solid #dcdfe6';
        queryIntervalValue.style.borderRadius = '6px';
        queryIntervalValue.style.backgroundColor = '#f5f7fa';
        queryIntervalValue.style.fontWeight = '700';
        queryIntervalValue.style.color = '#1f2d3d';

        const queryIntervalIncrease = document.createElement('button');
        queryIntervalIncrease.setAttribute('data-auto-sign-query-interval-increase', 'true');
        queryIntervalIncrease.innerText = '+';
        queryIntervalIncrease.style.width = '32px';
        queryIntervalIncrease.style.height = '30px';
        queryIntervalIncrease.style.border = '1px solid #dcdfe6';
        queryIntervalIncrease.style.borderRadius = '6px';
        queryIntervalIncrease.style.backgroundColor = '#fff';
        queryIntervalIncrease.style.cursor = 'pointer';
        queryIntervalIncrease.style.fontWeight = '700';

        const updateQueryIntervalValue = () => {
            queryIntervalValue.innerText = `${getQueryIntervalSeconds()} 秒`;
        };
        const changeQueryInterval = step => {
            if (isAutoSignRunningState()) {
                setStatus('运行中：停止后才能修改查询间隔');
                return;
            }
            const seconds = setQueryIntervalSeconds(getQueryIntervalSeconds() + step);
            queryIntervalValue.innerText = `${seconds} 秒`;
            setStatus(`已设置查询间隔：${seconds} 秒`);
        };
        queryIntervalDecrease.onclick = () => changeQueryInterval(-1);
        queryIntervalIncrease.onclick = () => changeQueryInterval(1);
        updateQueryIntervalValue();

        queryIntervalRow.appendChild(queryIntervalDecrease);
        queryIntervalRow.appendChild(queryIntervalValue);
        queryIntervalRow.appendChild(queryIntervalIncrease);

        const queryHelp = document.createElement('div');
        queryHelp.innerText = '后续批次点“查询”的间隔；网速慢可调大。';
        queryHelp.style.marginTop = '8px';
        queryHelp.style.fontSize = '12px';
        queryHelp.style.color = '#606266';
        queryHelp.style.lineHeight = '1.4';

        querySection.appendChild(queryLabel);
        querySection.appendChild(queryIntervalRow);
        querySection.appendChild(queryHelp);

        const timeoutSection = document.createElement('div');
        timeoutSection.style.marginTop = '10px';
        timeoutSection.style.padding = '10px';
        timeoutSection.style.border = '1px solid #ebeef5';
        timeoutSection.style.borderRadius = '8px';
        timeoutSection.style.backgroundColor = '#fff';

        const timeoutLabel = document.createElement('div');
        timeoutLabel.innerText = '文件加载超时';
        timeoutLabel.style.marginBottom = '8px';
        timeoutLabel.style.fontWeight = '700';
        timeoutLabel.style.color = '#303133';

        const timeoutRow = document.createElement('div');
        timeoutRow.style.display = 'flex';
        timeoutRow.style.alignItems = 'center';
        timeoutRow.style.gap = '8px';

        const timeoutDecrease = document.createElement('button');
        timeoutDecrease.setAttribute('data-auto-sign-next-file-timeout-decrease', 'true');
        timeoutDecrease.innerText = '-';
        timeoutDecrease.style.width = '32px';
        timeoutDecrease.style.height = '30px';
        timeoutDecrease.style.border = '1px solid #dcdfe6';
        timeoutDecrease.style.borderRadius = '6px';
        timeoutDecrease.style.backgroundColor = '#fff';
        timeoutDecrease.style.cursor = 'pointer';
        timeoutDecrease.style.fontWeight = '700';

        const timeoutValue = document.createElement('span');
        timeoutValue.setAttribute('data-auto-sign-next-file-timeout-value', 'true');
        timeoutValue.style.display = 'inline-block';
        timeoutValue.style.minWidth = '64px';
        timeoutValue.style.height = '30px';
        timeoutValue.style.lineHeight = '30px';
        timeoutValue.style.textAlign = 'center';
        timeoutValue.style.border = '1px solid #dcdfe6';
        timeoutValue.style.borderRadius = '6px';
        timeoutValue.style.backgroundColor = '#f5f7fa';
        timeoutValue.style.fontWeight = '700';
        timeoutValue.style.color = '#1f2d3d';

        const timeoutIncrease = document.createElement('button');
        timeoutIncrease.setAttribute('data-auto-sign-next-file-timeout-increase', 'true');
        timeoutIncrease.innerText = '+';
        timeoutIncrease.style.width = '32px';
        timeoutIncrease.style.height = '30px';
        timeoutIncrease.style.border = '1px solid #dcdfe6';
        timeoutIncrease.style.borderRadius = '6px';
        timeoutIncrease.style.backgroundColor = '#fff';
        timeoutIncrease.style.cursor = 'pointer';
        timeoutIncrease.style.fontWeight = '700';

        const updateTimeoutValue = () => {
            timeoutValue.innerText = `${getNextFileTimeoutMinutes()} 分钟`;
        };
        const changeTimeout = step => {
            if (isAutoSignRunningState()) {
                setStatus('运行中：停止后才能修改文件加载超时');
                return;
            }
            const minutes = setNextFileTimeoutMinutes(getNextFileTimeoutMinutes() + step);
            timeoutValue.innerText = `${minutes} 分钟`;
            setStatus(`已设置文件加载超时：${minutes} 分钟`);
        };
        timeoutDecrease.onclick = () => changeTimeout(-1);
        timeoutIncrease.onclick = () => changeTimeout(1);
        updateTimeoutValue();

        timeoutRow.appendChild(timeoutDecrease);
        timeoutRow.appendChild(timeoutValue);
        timeoutRow.appendChild(timeoutIncrease);

        const timeoutHelp = document.createElement('div');
        timeoutHelp.innerText = '切换下一个文件后，等待画布和签名模块加载的最长时间；网速慢可调大。';
        timeoutHelp.style.marginTop = '8px';
        timeoutHelp.style.fontSize = '12px';
        timeoutHelp.style.color = '#606266';
        timeoutHelp.style.lineHeight = '1.4';

        timeoutSection.appendChild(timeoutLabel);
        timeoutSection.appendChild(timeoutRow);
        timeoutSection.appendChild(timeoutHelp);

        const disabledHint = document.createElement('div');
        disabledHint.setAttribute('data-auto-sign-settings-running-hint', 'true');
        disabledHint.innerText = '运行中请先停止再修改设置';
        disabledHint.style.marginTop = '10px';
        disabledHint.style.padding = '8px 10px';
        disabledHint.style.borderRadius = '6px';
        disabledHint.style.backgroundColor = '#fff7e6';
        disabledHint.style.color = '#ad6800';
        disabledHint.style.fontSize = '12px';
        disabledHint.style.lineHeight = '1.4';

        const feedbackSection = document.createElement('div');
        feedbackSection.style.marginTop = '10px';
        feedbackSection.style.padding = '10px';
        feedbackSection.style.border = '1px solid #ebeef5';
        feedbackSection.style.borderRadius = '8px';
        feedbackSection.style.backgroundColor = '#fff';

        const feedbackLabel = document.createElement('div');
        feedbackLabel.innerText = '问题反馈';
        feedbackLabel.style.marginBottom = '8px';
        feedbackLabel.style.fontWeight = '700';
        feedbackLabel.style.color = '#303133';

        const exportLogButton = document.createElement('button');
        exportLogButton.setAttribute('data-auto-sign-export-log', 'true');
        exportLogButton.innerText = '导出日志';
        exportLogButton.style.width = '100%';
        exportLogButton.style.height = '32px';
        exportLogButton.style.border = '1px solid #409EFF';
        exportLogButton.style.borderRadius = '6px';
        exportLogButton.style.backgroundColor = '#ecf5ff';
        exportLogButton.style.color = '#1677d2';
        exportLogButton.style.fontWeight = '700';
        exportLogButton.style.cursor = 'pointer';
        exportLogButton.onclick = exportAutoSignLogs;

        const feedbackHelp = document.createElement('div');
        feedbackHelp.innerText = '遇到问题时导出给维护人员排查。';
        feedbackHelp.style.marginTop = '8px';
        feedbackHelp.style.fontSize = '12px';
        feedbackHelp.style.color = '#606266';
        feedbackHelp.style.lineHeight = '1.4';

        feedbackSection.appendChild(feedbackLabel);
        feedbackSection.appendChild(exportLogButton);
        feedbackSection.appendChild(feedbackHelp);

        panel.appendChild(positionSection);
        panel.appendChild(querySection);
        panel.appendChild(timeoutSection);
        panel.appendChild(feedbackSection);
        panel.appendChild(disabledHint);
        document.body.appendChild(panel);
        updateSignPositionButtons();
        setSettingsDisabledState(isAutoSignRunningState());
        setTimeout(() => {
            document.addEventListener('mousedown', handleSettingsOutsideClick, true);
            document.addEventListener('keydown', handleSettingsEscapeKey, true);
        }, 0);
    }

    function updateSettingsButtonState(running) {
        const settingsButton = document.querySelector('button[data-auto-sign-settings]');
        if (settingsButton) {
            settingsButton.style.cursor = running ? 'not-allowed' : 'pointer';
            settingsButton.style.backgroundColor = running ? '#A0CFFF' : '#67C23A';
        }
        setSettingsDisabledState(running);
    }

    function addAutoSignLog(message, level = 'info') {
        try {
            const logs = JSON.parse(sessionStorage.getItem(AUTO_SIGN_LOG_KEY) || '[]');
            logs.push({
                time: new Date().toLocaleString(),
                level,
                message: String(message || '')
            });
            sessionStorage.setItem(AUTO_SIGN_LOG_KEY, JSON.stringify(logs.slice(-300)));
        } catch (e) {}
    }

    function getPageTypeForLog() {
        const currentUrl = window.location.href || '';
        if (currentUrl.includes('todoList')) return 'todoList';
        if (currentUrl.includes('librarySignature')) return 'librarySignature';
        if (currentUrl.includes('pageseal/signature')) return 'signature';
        return 'unknown';
    }

    function getSafeLogUrl() {
        const logUrlConfig = { redactedParams: ['ut', 'token', 'access_token', 'ticket'] };
        return String(window.location.href || '').replace(
            new RegExp(`([?&](?:${logUrlConfig.redactedParams.join('|')})=)[^&#]+`, 'gi'),
            '$1[已隐藏]'
        );
    }

    function getSafeLogDetail(detail) {
        try {
            return JSON.parse(JSON.stringify(detail || {}));
        } catch (e) {
            return { value: String(detail || '') };
        }
    }

    function addAutoSignEvent(event, detail = {}, level = 'info') {
        try {
            const logs = JSON.parse(sessionStorage.getItem(AUTO_SIGN_LOG_KEY) || '[]');
            logs.push({
                time: new Date().toLocaleString(),
                level,
                event: String(event || 'unknown_event'),
                detail: getSafeLogDetail(detail),
                context: {
                    pageType: getPageTypeForLog(),
                    url: getSafeLogUrl(),
                    state: getAutoSignState(),
                    isRunning,
                    processStarted,
                    manualStopped,
                    batchSubmitted: sessionStorage.getItem(BATCH_SUBMITTED_KEY) === 'true',
                    queryIntervalSeconds: getQueryIntervalSeconds(),
                    nextFileTimeoutMinutes: getNextFileTimeoutMinutes()
                }
            });
            sessionStorage.setItem(AUTO_SIGN_LOG_KEY, JSON.stringify(logs.slice(-300)));
        } catch (e) {}
    }

    function formatAutoSignLogItem(item) {
        if (!item) return '';
        if (item.event) {
            const detailText = item.detail && Object.keys(item.detail).length ? ` detail=${JSON.stringify(item.detail)}` : '';
            const contextText = item.context ? ` context=${JSON.stringify(item.context)}` : '';
            return `[${item.time}] [${item.level}] ${item.event}${detailText}${contextText}`;
        }
        return `[${item.time}] [${item.level}] ${item.message}`;
    }

    function getStatusStyle(type) {
        const styles = {
            idle: { background: '#f5f7fa', border: '#dcdfe6', color: '#606266', dot: '#909399' },
            running: { background: '#ecf5ff', border: '#b3d8ff', color: '#1677d2', dot: '#409EFF' },
            waiting: { background: '#fff7e6', border: '#ffd591', color: '#ad6800', dot: '#faad14' },
            success: { background: '#f0f9eb', border: '#b7eb8f', color: '#237804', dot: '#52c41a' },
            error: { background: '#fff1f0', border: '#ffa39e', color: '#a8071a', dot: '#f5222d' }
        };
        return styles[type] || styles.running;
    }

    function exportAutoSignLogs() {
        try {
            const logs = JSON.parse(sessionStorage.getItem(AUTO_SIGN_LOG_KEY) || '[]');
            const lines = [
                'Autosign 问题日志',
                `导出时间：${new Date().toLocaleString()}`,
                '脚本版本：1.1.9-beta',
                `当前页面：${getSafeLogUrl()}`,
                `页面类型：${getPageTypeForLog()}`,
                `浏览器：${navigator.userAgent}`,
                `运行状态：${getAutoSignState()}`,
                `签章位置：${getSignPositionLabel(getSignPositionMode())}`,
                `查询间隔：${getQueryIntervalSeconds()} 秒`,
                `文件加载超时：${getNextFileTimeoutMinutes()} 分钟`,
                `批次已提交标记：${hasSubmittedBatchOnce() ? '是' : '否'}`,
                '',
                '最近日志：',
                ...(logs.length ? logs.filter(item => !item.event).map(formatAutoSignLogItem) : ['暂无日志']),
                '',
                '最近事件：',
                ...(logs.some(item => item.event) ? logs.filter(item => item.event).map(formatAutoSignLogItem) : ['暂无事件'])
            ];
            const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
            link.href = url;
            link.download = `autosign-log-${stamp}.txt`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setStatus('日志已导出', 'success');
        } catch (e) {
            console.error('导出日志失败:', e);
            setStatus('日志导出失败', 'error');
        }
    }

    function setStatus(text, type = 'running', shouldLog = true) {
        try {
            const badge = document.querySelector('span[data-auto-sign-status]') || statusBadge;
            const normalizedText = text || '';
            if (badge) {
                const style = getStatusStyle(type);
                const dot = badge.querySelector('span[data-auto-sign-status-dot]');
                const textEl = badge.querySelector('span[data-auto-sign-status-text]');
                badge.setAttribute('data-auto-sign-status-type', type);
                badge.style.backgroundColor = style.background;
                badge.style.border = `1px solid ${style.border}`;
                badge.style.color = style.color;
                if (dot) dot.style.backgroundColor = style.dot;
                if (textEl) {
                    textEl.innerText = normalizedText;
                } else {
                    badge.innerText = normalizedText;
                }
            }
            if (shouldLog) {
                addAutoSignLog(normalizedText, type === 'error' ? 'error' : 'status');
            }
        } catch (e) {}
    }

    // 计算签名位置
    function calculateSignPosition(canvas) {
        const rect = canvas.getBoundingClientRect();
        const mode = getSignPositionMode();
        const marginX = rect.width * 0.1;
        const marginY = rect.height * 0.1;
        if (mode === 'top-left') {
            return { x: rect.left + marginX, y: rect.top + marginY };
        }
        if (mode === 'bottom-left') {
            return { x: rect.left + marginX, y: rect.bottom - marginY };
        }
        if (mode === 'bottom-right') {
            return { x: rect.right - marginX, y: rect.bottom - marginY };
        }
        if (mode === 'center') {
            return { x: rect.left + (rect.width * 0.5), y: rect.top + (rect.height * 0.25) };
        }
        if (mode === 'random') {
            return {
                x: rect.left + marginX + (Math.random() * (rect.width - marginX * 2)),
                y: rect.top + marginY + (Math.random() * (rect.height - marginY * 2))
            };
        }
        return {
            x: rect.right - (rect.width * 0.1), // 右上角，距离右边缘 10%
            y: rect.top + (rect.height * 0.1)   // 右上角，距离上边缘 10%
        };
    }

    // 模拟鼠标点击（不依赖 view; 依次派发 pointer/mouse 序列）
    function simulateClick(element, x, y) {
        const opts = { bubbles: true, cancelable: true, clientX: Math.round(x), clientY: Math.round(y) };
        try { element.dispatchEvent(new PointerEvent('pointerdown', { ...opts, pointerType: 'mouse' })); } catch (e) {}
        try { element.dispatchEvent(new MouseEvent('mousedown', opts)); } catch (e) {}
        try { element.dispatchEvent(new PointerEvent('pointerup', { ...opts, pointerType: 'mouse' })); } catch (e) {}
        try { element.dispatchEvent(new MouseEvent('mouseup', opts)); } catch (e) {}
        try { element.dispatchEvent(new MouseEvent('click', opts)); } catch (e) { try { element.click(); } catch (e2) {} }
    }

    // 等待元素加载的辅助函数
    async function waitForElement(selector, timeout = 10000, checkVisible = false) {
        console.log(`等待元素出现: ${selector}`);
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            const element = document.querySelector(selector);
            if (element) {
                if (!checkVisible) {
                    console.log(`找到元素: ${selector}`);
                    return element;
                }
                // 如果需要检查可见性
                const rect = element.getBoundingClientRect();
                const isVisible = rect.width > 0 && rect.height > 0;
                if (isVisible) {
                    console.log(`找到可见元素: ${selector}`);
                    return element;
                }
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        console.log(`等待超时: ${selector}`);
        return null;
    }

    // 判断元素是否可见
    function isElementVisible(element) {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    // 判断元素是否可点击（不可点击：disabled 或带有禁用类）
    function isElementClickable(element) {
        if (!element) return false;
        if (element.disabled) return false;
        const className = element.className || '';
        if (typeof className === 'string' && /is-disabled|disabled/.test(className)) return false;
        return isElementVisible(element);
    }

    // 通过文本等待目标元素（支持多个选择器）
    async function waitForElementByText(selectors, text, timeout = 10000) {
        const selectorList = Array.isArray(selectors) ? selectors : [selectors];
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            for (const selector of selectorList) {
                const nodes = Array.from(document.querySelectorAll(selector));
                const match = nodes.find(node => (node.textContent || '').trim().includes(text) && isElementVisible(node));
                if (match) return match;
            }
            await new Promise(r => setTimeout(r, 100));
        }
        return null;
    }

    async function waitForClickableElementByText(selectors, text, timeout = 10000) {
        const selectorList = Array.isArray(selectors) ? selectors : [selectors];
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            for (const selector of selectorList) {
                const nodes = Array.from(document.querySelectorAll(selector));
                const match = nodes.find(node => (node.textContent || '').trim().includes(text) && isElementClickable(node));
                if (match) return match;
            }
            await new Promise(r => setTimeout(r, 100));
        }
        return null;
    }

    function findClickableElementByText(container, selectors, text) {
        const selectorList = Array.isArray(selectors) ? selectors : [selectors];
        for (const selector of selectorList) {
            const nodes = Array.from((container || document).querySelectorAll(selector));
            const match = nodes.find(node => (node.textContent || '').trim().includes(text) && isElementClickable(node));
            if (match) return match;
        }
        return null;
    }

    async function waitForDialogButtonByText(dialogTitle, buttonText, timeout = 10000) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            const dialogs = Array.from(document.querySelectorAll(SELECTORS.batchDialog)).filter(dialog => {
                if (!isElementVisible(dialog)) return false;
                if (!dialogTitle) return true;
                const header = dialog.querySelector(SELECTORS.dialogHeader);
                return header && (header.textContent || '').includes(dialogTitle);
            });

            for (const dialog of dialogs) {
                const button = findClickableElementByText(dialog, [SELECTORS.dialogFooterButton, SELECTORS.elementButton], buttonText);
                if (button) return button;
            }

            await new Promise(r => setTimeout(r, 100));
        }
        return null;
    }

    async function waitForMessageBoxButtonByText(buttonTexts, timeout = 10000) {
        const textList = Array.isArray(buttonTexts) ? buttonTexts : [buttonTexts];
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            const boxes = Array.from(document.querySelectorAll('.el-message-box')).filter(isElementVisible);
            for (const box of boxes) {
                const buttons = Array.from(box.querySelectorAll('.el-message-box__btns .el-button, button.el-button'));
                const button = buttons.find(btn => {
                    const text = (btn.textContent || '').trim();
                    return textList.some(targetText => text.includes(targetText)) && isElementClickable(btn);
                });
                if (button) return button;
            }
            await new Promise(r => setTimeout(r, 100));
        }
        return null;
    }

    async function waitForStableProcessButton(timeout = 10000) {
        const selectors = ['button', '.el-button', 'a.el-button'];
        const startTime = Date.now();
        let lastButton = null;
        let stableSince = 0;

        while (Date.now() - startTime < timeout) {
            if (!isRunning || manualStopped) return null;
            if ((window.location.href || '').includes('librarySignature')) return null;

            await waitForLoadingGone(3000);
            const candidates = selectors.flatMap(selector => Array.from(document.querySelectorAll(selector)));
            const button = candidates.find(node => {
                const text = (node.textContent || '').trim();
                return text.includes('处理') && isElementClickable(node);
            });

            if (button) {
                if (button === lastButton) {
                    if (Date.now() - stableSince >= 300) {
                        return button;
                    }
                } else {
                    lastButton = button;
                    stableSince = Date.now();
                }
            } else {
                lastButton = null;
                stableSince = 0;
            }

            await new Promise(r => setTimeout(r, 100));
        }
        return null;
    }

    // 等待 URL 包含指定片段
    async function waitForUrlIncludes(fragment, timeout = 10000) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            if ((window.location.href || '').includes(fragment)) return true;
            await new Promise(r => setTimeout(r, 100));
        }
        return false;
    }

    // 无限等待：直到 selector 命中（可选需可见）或被停止
    async function waitForElementNoTimeout(selector, checkVisible = false) {
        while (true) {
            if (!isRunning || manualStopped) return null;
            const el = document.querySelector(selector);
            if (el) {
                if (!checkVisible) return el;
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) return el;
            }
            await new Promise(r => setTimeout(r, 100));
        }
    }

    function isEnabled(element) {
        if (!element) return false;
        if (element.disabled) return false;
        const className = element.className || '';
        return !(typeof className === 'string' && /is-disabled/.test(className));
    }

    // 同时等待多个选择器的可见元素全部就绪
    async function waitForAllVisible(selectors, timeout = 10000) {
        const list = Array.isArray(selectors) ? selectors : [selectors];
        const start = Date.now();
        while (Date.now() - start < timeout) {
            let allReady = true;
            for (const sel of list) {
                const el = document.querySelector(sel);
                if (!el) { allReady = false; break; }
                const rect = el.getBoundingClientRect();
                if (rect.width <= 0 || rect.height <= 0) { allReady = false; break; }
            }
            if (allReady) return true;
            await new Promise(r => setTimeout(r, 100));
        }
        return false;
    }

    // 无限等待：直到所有选择器对应元素都可见或运行被停止
    async function waitForAllVisibleNoTimeout(selectors) {
        const list = Array.isArray(selectors) ? selectors : [selectors];
        while (true) {
            if (!isRunning || manualStopped) return false;
            let allReady = true;
            for (const sel of list) {
                const el = document.querySelector(sel);
                if (!el) { allReady = false; break; }
                const rect = el.getBoundingClientRect();
                if (rect.width <= 0 || rect.height <= 0) { allReady = false; break; }
            }
            if (allReady) return true;
            await new Promise(r => setTimeout(r, 100));
        }
    }

    // 可靠点击：滚动到视图、校验可点击、失败则派发 MouseEvent
    async function performReliableClick(element) {
        if (!element) return false;
        try {
            element.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
            await new Promise(r => setTimeout(r, 50));
            // 尝试点击 element 或其可点击父级（label）
            let target = element;
            if (!isElementClickable(target)) {
                const clickableAncestor = element.closest('label, button, a, .el-checkbox, .el-button');
                if (clickableAncestor) target = clickableAncestor;
            }
            if (!isElementClickable(target)) {
                console.log('元素暂不可点击，尝试派发点击事件');
                try { target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })); } catch (e) {}
                try { target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true })); } catch (e) {}
                try { return target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); } catch (e) { return false; }
            }
            target.click();
            return true;
        } catch (e) {
            console.log('直接点击失败，改用事件派发');
            try { element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })); } catch (e2) {}
            try { element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true })); } catch (e3) {}
            try { return element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); } catch (e4) { return false; }
        }
    }

    // 等待加载遮罩消失（Element UI 的 .el-loading-mask）
    async function waitForLoadingGone(timeout = 15000) {
        const startTime = Date.now();
        const isAnyMaskVisible = () => Array.from(document.querySelectorAll(SELECTORS.loadingMask)).some(isElementVisible);
        while (Date.now() - startTime < timeout) {
            if (!isAnyMaskVisible()) return true;
            await new Promise(r => setTimeout(r, 100));
        }
        return false;
    }

    // 按对话框标题文本等待并返回对应对话框元素
    async function waitForDialogByHeaderText(text, timeout = 10000) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            const dialogs = Array.from(document.querySelectorAll(SELECTORS.batchDialog));
            const found = dialogs.find(dlg => {
                const header = dlg.querySelector(SELECTORS.dialogHeader);
                return header && (header.textContent || '').includes(text) && isElementVisible(dlg);
            });
            if (found) return found;
            await new Promise(r => setTimeout(r, 100));
        }
        return null;
    }

    function getVisibleBatchTotalElement(scope) {
        const root = scope || document;
        const totals = Array.from(root.querySelectorAll(SELECTORS.batchPaginationTotal));
        return totals.find(el => isElementVisible(el) && /共\s*\d+\s*条/.test(el.textContent || '')) || null;
    }

    function getBatchTotalCount(scope) {
        const totalEl = getVisibleBatchTotalElement(scope) || getVisibleBatchTotalElement(document);
        if (!totalEl) return null;
        const match = (totalEl.textContent || '').match(/共\s*(\d+)\s*条/);
        return match ? Number(match[1]) : null;
    }

    function getVisibleBatchRowCount(scope) {
        const root = scope || document;
        return Array.from(root.querySelectorAll(SELECTORS.batchBodyCheckboxInput))
            .filter(el => isElementVisible(el.closest('.el-checkbox') || el))
            .length;
    }

    function getCheckedBatchRowCount(scope) {
        const root = scope || document;
        return Array.from(root.querySelectorAll(SELECTORS.batchCheckedCheckboxInput))
            .filter(el => isElementVisible(el.closest('.el-checkbox') || el))
            .length;
    }

    async function waitForBatchTotalReady(dialog, timeout = 15000, zeroStableMs = 2000) {
        const start = Date.now();
        let zeroSince = null;

        while (Date.now() - start < timeout) {
            if (!isRunning || manualStopped) return null;

            await waitForLoadingGone(3000);
            const totalCount = getBatchTotalCount(dialog);
            const rowCount = getVisibleBatchRowCount(dialog);

            if (typeof totalCount === 'number' && totalCount > 0) {
                addAutoSignEvent('batch_total_ready', { totalCount, rowCount }, 'info');
                return totalCount;
            }
            if (rowCount > 0) {
                addAutoSignEvent('batch_total_ready_by_rows', { totalCount, rowCount }, 'info');
                return typeof totalCount === 'number' && totalCount > 0 ? totalCount : rowCount;
            }
            if (totalCount === 0) {
                if (zeroSince === null) {
                    zeroSince = Date.now();
                    setStatus('正在等待待签章列表加载完成...');
                    addAutoSignEvent('batch_total_zero_loading', { totalCount, rowCount }, 'info');
                }
                if (Date.now() - zeroSince >= zeroStableMs) {
                    addAutoSignEvent('batch_total_zero_stable', { totalCount, rowCount, zeroStableMs }, 'warn');
                    return 0;
                }
            } else {
                zeroSince = null;
            }

            await new Promise(r => setTimeout(r, 200));
        }

        return getBatchTotalCount(dialog);
    }

    function findBatchQueryButton(scope) {
        const roots = [scope, document].filter(Boolean);
        for (const root of roots) {
            const buttons = Array.from(root.querySelectorAll('button.el-button, button'));
            const button = buttons.find(btn => {
                const text = (btn.textContent || '').trim();
                return text.includes('查询') && isElementClickable(btn);
            });
            if (button) return button;
        }
        return null;
    }

    function hasSubmittedBatchOnce() {
        return sessionStorage.getItem(BATCH_SUBMITTED_KEY) === 'true';
    }

    function markBatchSubmitted(detail = {}) {
        sessionStorage.setItem(BATCH_SUBMITTED_KEY, 'true');
        addAutoSignEvent('batch_submit', detail, 'info');
    }

    function resetBatchSubmitted() {
        sessionStorage.removeItem(BATCH_SUBMITTED_KEY);
    }

    async function waitForBatchListReadyByTrend(dialog, interval = getQueryIntervalMs(), timeout = 60000) {
        const start = Date.now();
        let previousCount = null;
        let nonDecreasingCount = 0;

        while (Date.now() - start < timeout) {
            if (!isRunning || manualStopped) return false;

            const queryButton = findBatchQueryButton(dialog);
            if (queryButton) {
                setStatus('正在刷新待签章列表...');
                await performReliableClick(queryButton);
            } else {
                console.log('未找到查询按钮，使用当前列表数量进行稳定性判断');
            }

            const currentCount = await waitForBatchTotalReady(dialog);
            if (currentCount === null) {
                return false;
            }

            console.log('当前待签章数量:', currentCount);
            setStatus(`正在刷新待签章列表，当前待签 ${currentCount} 条`);
            addAutoSignEvent('batch_trend_count', {
                currentCount,
                previousCount,
                nonDecreasingCount,
                intervalMs: interval
            }, 'info');

            if (previousCount !== null) {
                if (currentCount < previousCount) {
                    console.log('待签章数量仍在减少，继续查询:', currentCount, '<', previousCount);
                    addAutoSignEvent('batch_trend_decreasing', {
                        currentCount,
                        previousCount,
                        intervalMs: interval
                    }, 'info');
                    previousCount = currentCount;
                    nonDecreasingCount = 0;
                    await new Promise(r => setTimeout(r, interval));
                    continue;
                }
                if (currentCount >= previousCount) {
                    nonDecreasingCount += 1;
                    console.log('待签章数量未下降:', currentCount, '>=', previousCount, `(${nonDecreasingCount}/2)`);
                    if (nonDecreasingCount >= 2) {
                        console.log('待签章数量连续两次未下降，可以继续:', currentCount);
                        addAutoSignEvent('batch_trend_ready', {
                            currentCount,
                            previousCount,
                            nonDecreasingCount,
                            intervalMs: interval
                        }, 'info');
                        return true;
                    }
                }
            }

            previousCount = currentCount;
            await new Promise(r => setTimeout(r, interval));
        }

        notifyAttention('待签章列表长时间仍在减少，请人工检查列表刷新状态。');
        return false;
    }

    // 点击表头选择列复选框以全选当前页
    async function selectAllCurrentPageInDialog() {
        try {
            // 等待遮罩消失，避免被 loading 覆盖导致不可点击
            await waitForLoadingGone(15000);
            // 兼容不同结构：优先在对话框作用域内查找表头选择列
            const headerInput = await waitForElement(
                SELECTORS.batchHeaderCheckboxInput,
                10000,
                true
            );
            if (!headerInput) return false;

            const headerLabel = headerInput.closest('.el-checkbox') || headerInput;
            const headerInner = headerLabel.querySelector('.el-checkbox__inner') || headerLabel;
            await performReliableClick(headerInner);

            // 最长 3s 轮询，等待表体行全部 is-checked
            const start = Date.now();
            while (Date.now() - start < 3000) {
                const bodyInputs = Array.from(document.querySelectorAll(`${SELECTORS.batchDialog} ${SELECTORS.batchBodyCheckboxInput}, ${SELECTORS.batchBodyCheckboxInput}`));
                if (bodyInputs.length > 0 && bodyInputs.every(i => i.classList.contains('is-checked'))) {
                    return true;
                }
                await new Promise(r => setTimeout(r, 100));
            }
            return false;
        } catch (e) {
            console.error('selectAllCurrentPageInDialog 出错:', e);
            return false;
        }
    }

    // 在容器内勾选所有复选框
    async function checkAllBoxesIn(container) {
        try {
            const scope = container || document;
            // 优先尝试表头“全选”（弹窗内表格）
            const headerCheck = scope.querySelector(SELECTORS.batchHeaderCheckbox);
            if (headerCheck) {
                const headerLabel = headerCheck.classList.contains('el-checkbox__input') ? (headerCheck.closest('.el-checkbox') || headerCheck) : headerCheck;
                const headerInput = headerLabel.querySelector('.el-checkbox__input') || headerCheck;
                if (!headerInput || !headerInput.classList.contains('is-checked') || headerInput.classList.contains('is-indeterminate')) {
                    await performReliableClick(headerLabel);
                    // 等待表体勾选状态同步
                    const startHeaderWait = Date.now();
                    while (Date.now() - startHeaderWait < 3000) {
                        const bodyInputs = Array.from(scope.querySelectorAll(SELECTORS.batchBodyCheckboxInput));
                        if (bodyInputs.length > 0 && bodyInputs.every(i => i.classList.contains('is-checked'))) {
                            return true;
                        }
                        await new Promise(r => setTimeout(r, 100));
                    }
                } else {
                    // 表头已经是选中状态，校验表体
                    const bodyInputs = Array.from(scope.querySelectorAll(SELECTORS.batchBodyCheckboxInput));
                    if (bodyInputs.length > 0 && bodyInputs.every(i => i.classList.contains('is-checked'))) {
                        return true;
                    }
                }
            }

            // 如果还有未勾选，遍历主体行
            let bodyUnchecked = Array.from(scope.querySelectorAll(SELECTORS.batchBodyUncheckedCheckboxInput));
            if (bodyUnchecked.length) {
                const body = scope.querySelector(SELECTORS.batchBodyWrapper);
                if (body && body.scrollHeight > body.clientHeight) {
                    body.scrollTop = 0;
                }
                const wrappers = scope.querySelectorAll(`${SELECTORS.batchBodyWrapper} .el-checkbox`);
                for (let wrapper of wrappers) {
                    const input = wrapper.querySelector('.el-checkbox__input');
                    if (input && !input.classList.contains('is-checked')) {
                        wrapper.scrollIntoView({ block: 'center' });
                        wrapper.click();
                        await new Promise(r => setTimeout(r, 100));
                    }
                }
            }

            // 二次确认（防异步渲染遗漏）：再次轮询直到全选或超时
            const start = Date.now();
            while (Date.now() - start < 3000) {
                const rest = scope.querySelectorAll(SELECTORS.batchBodyUncheckedCheckboxInput);
                if (rest.length === 0) break;
                for (let el of Array.from(rest)) {
                    const wrapper = el.closest('.el-checkbox');
                    if (wrapper) {
                        wrapper.scrollIntoView({ block: 'center' });
                        wrapper.click();
                        await new Promise(r => setTimeout(r, 80));
                    }
                }
            }

            const allChecked = Array.from(scope.querySelectorAll(SELECTORS.batchBodyCheckboxInput)).every(c => c.classList.contains('is-checked'));
            return allChecked || !!(scope.querySelector(SELECTORS.batchBodyWrapper)?.querySelectorAll('.el-checkbox__input').length);
        } catch (e) {
            console.error('checkAllBoxesIn 出错:', e);
            return false;
        }
    }

    // 选中所有复选框的函数
    async function checkAllBoxes() {
        try {
            console.log('开始选中所有复选框...');
            
            // 获取所有复选框的父元素
            const checkboxWrappers = document.querySelectorAll('.el-checkbox');
            console.log(`找到 ${checkboxWrappers.length} 个复选框`);

            for (let wrapper of checkboxWrappers) {
                // 获取实际的input元素
                const input = wrapper.querySelector('.el-checkbox__original');
                const label = wrapper.querySelector('.el-checkbox__input');
                
                if (input && !label.classList.contains('is-checked')) {
                    console.log('点击未选中的复选框');
                    wrapper.click(); // 点击整个wrapper而不是input
                    // 等待选中状态更新
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }

            // 验证所有复选框是否都已选中
            const allChecked = Array.from(document.querySelectorAll('.el-checkbox__input'))
                .every(checkbox => checkbox.classList.contains('is-checked'));
            
            console.log('复选框全部选中状态:', allChecked);
            return allChecked;
        } catch (error) {
            console.error('选择复选框时出错:', error);
            return false;
        }
    }

    // 查找电子签章按钮的函数
    async function findSignButton() {
        console.log('开始查找电子签章按钮...');
        
        // 方法1：通过文本内容查找
        const buttons = Array.from(document.querySelectorAll('button'));
        const signButton = buttons.find(button => 
            button.textContent.trim().includes('电子签章')
        );
        
        if (signButton) {
            console.log('通过文本内容找到电子签章按钮');
            return signButton;
        }

        // 方法2：通过常见按钮类名查找
        const signButton2 = findClickableElementByText(document, SELECTORS.signEntryButton, '电子签章');
        if (signButton2) {
            console.log('通过类名和属性找到电子签章按钮');
            return signButton2;
        }

        // 方法3：通过span内容查找
        const spans = Array.from(document.querySelectorAll('button span'));
        const targetSpan = spans.find(span => 
            span.textContent.trim().includes('电子签章')
        );
        if (targetSpan) {
            console.log('通过span内容找到电子签章按钮');
            return targetSpan.closest('button');
        }

        console.log('未找到电子签章按钮');
        return null;
    }

    function resetSignEntryClickedFlags() {
        try {
            document.querySelectorAll('[data-auto-sign-entry-clicked]').forEach(element => {
                delete element.dataset.autoSignEntryClicked;
            });
        } catch (e) {}
    }

    async function waitForEntryFlowReady(timeout = ENTRY_FLOW_READY_TIMEOUT) {
        const start = Date.now();
        addAutoSignEvent('entry_flow_wait_start', { timeout }, 'info');

        while (Date.now() - start < timeout) {
            if (!isRunning || manualStopped) return false;

            await waitForLoadingGone(3000);
            const currentUrl = window.location.href || '';
            if (currentUrl.includes('librarySignature')) {
                addAutoSignEvent('entry_flow_ready', {
                    reason: 'library_signature_url',
                    elapsedMs: Date.now() - start
                }, 'info');
                return true;
            }

            const processButton = await waitForStableProcessButton(800);
            if (processButton) {
                addAutoSignEvent('entry_flow_ready', {
                    reason: 'process_button_ready',
                    elapsedMs: Date.now() - start
                }, 'info');
                return true;
            }

            await new Promise(r => setTimeout(r, 200));
        }

        addAutoSignEvent('entry_flow_timeout', { timeout }, 'error');
        return false;
    }

    // 初始化流程
    async function initializeProcess() {
        try {
            console.log('开始初始化流程...');
            setStatus('正在启动自动签章流程...');
            
            // 1. 首先等待并点击电子签章按钮
            console.log('第一步：查找电子签章按钮');
            setStatus('正在查找电子签章入口...');
            const signButton = await findSignButton();
            if (!signButton) {
                console.log('未找到电子签章按钮，按无电子签章待办处理并停止流程');
                addAutoSignEvent('todo_no_sign_entry', {
                    pageType: getPageTypeForLog()
                }, 'info');
                stopProcess(true);
                setStatus('没有电子签章待办，已停止', 'idle');
                return true;
            }

            // 2. 点击电子签章按钮
            console.log('点击电子签章按钮');
            setStatus('正在进入电子签章流程...');
            // 添加防止重复点击的标记
            if (signButton.dataset.autoSignEntryClicked) {
                console.log('电子签章按钮已经被点击过，跳过');
                addAutoSignEvent('sign_entry_click_skipped', {
                    reason: 'entry_button_already_clicked'
                }, 'warn');
            } else {
                signButton.dataset.autoSignEntryClicked = 'true';
                try {
                    signButton.click();
                    console.log('电子签章按钮点击成功');
                    addAutoSignEvent('sign_entry_click', {
                        method: 'native_click'
                    }, 'info');
                } catch (e) {
                    console.log('常规点击失败，尝试模拟点击事件');
                    const clickEvent = new MouseEvent('click', {
                        view: window,
                        bubbles: true,
                        cancelable: true
                    });
                    signButton.dispatchEvent(clickEvent);
                    addAutoSignEvent('sign_entry_click', {
                        method: 'dispatch_event'
                    }, 'info');
                }
            }

            const entryReady = await waitForEntryFlowReady(ENTRY_FLOW_READY_TIMEOUT);
            if (!entryReady) {
                notifyAttention('进入电子签章流程超过 2 分钟仍未出现处理按钮或批量签章页面，请检查页面加载状态或浏览器弹窗权限。');
                stopProcess(true);
                return false;
            }

            console.log('等待列表刷新完成...');
            setStatus('正在等待待办列表刷新...');
            await waitForLoadingGone(15000);

            // 3. 等待并点击处理按钮（持续等待直到出现为止）
            console.log('第二步：等待处理按钮出现...');
            setStatus('正在查找处理按钮...');
            let processButton = null;
            while (true) {
                if (!isRunning || manualStopped) {
                    console.log('已停止或手动停止，终止等待处理按钮');
                    return false;
                }
                // 若已跳转至批量签章页，停止等待
                if ((window.location.href || '').includes('librarySignature')) {
                    break;
                }
                processButton = await waitForStableProcessButton(3000);
                if (processButton) break;
                await new Promise(r => setTimeout(r, 500));
            }
            if (processButton) {
                console.log('点击处理按钮');
                setStatus('正在打开待处理签章任务...');
                await performReliableClick(processButton);
            }
            // 等待跳转到批量签章页或批量签章按钮出现
            setStatus('正在等待进入批量签章页面...');
            const jumpedToList = await waitForUrlIncludes('librarySignature', 15000);
            if (!jumpedToList) {
                await waitForElement(SELECTORS.batchSignIcon, 15000, true);
            }
            if (!(window.location.href || '').includes('librarySignature')) {
                console.log('尚未真正进入批量签章页面，等待页面跳转后由运行状态续接流程');
                setStatus('正在等待页面进入批量签章流程...');
                addAutoSignEvent('todo_wait_library_signature', {
                    url: window.location.href
                }, 'info');
                return true;
            }

            // 待办页只负责进入批量签章环境；批量弹窗、首次快速勾选、
            // 后续列表刷新稳定判断统一交给新版批量流程处理。
            console.log('已进入批量签章环境，交给统一批量流程处理');
            setStatus('已进入批量签章页面，准备打开批量签章窗口...');
            return await handleBatchSignaturePage();

        } catch (error) {
            console.error('初始化流程出错:', error);
            return false;
        }
    }

    // 修改签名操作页面的处理流程
    async function handleSignaturePage() {
        try {
            console.log('开始签名页面处理流程');
            setStatus('正在等待签章页面加载...');

            while (isRunning && !manualStopped) {
                // 执行签名流程
                setStatus('正在执行签名操作...');
                let signedOk = false;
                for (let attempt = 1; attempt <= 2; attempt++) { // 失败可重签一次
                    const ok = await signProcess();
                    if (ok) {
                        signedOk = true;
                        setStatus('当前文件签名成功，准备处理下一个...');
                        break;
                    }
                    console.log('签名失败，准备重试第', attempt, '次');
                    setStatus('签名失败，正在重试...');
                }

                if (!signedOk) {
                    console.log('签名重试后仍失败，回到列表状态检测');
                    setStatus('签名失败，正在检测待签列表状态...');
                    const ok = await runDetectionFlow();
                    if (!ok) {
                        notifyAttention('当前文件签名失败，且列表仍存在待签署文件。请人工检查页面状态或弹窗权限。');
                        setStatus('签名失败，请检查浏览器是否拦截弹窗或刷新页面后重试');
                        stopProcess(true);
                    }
                    return;
                }

                // 每个文件处理后（成功或跳过）统一等待 2s 再切换
                await new Promise(resolve => setTimeout(resolve, 2000));

                if (!isRunning || manualStopped) {
                    return;
                }

                // 切换到下一个文件（仅以签名流程返回成功为依据，不再依赖列表图标类）
                setStatus('正在切换下一个待签文件...');
                const hasNextFile = await clickNextFile();

                if (hasNextFile) {
                    continue;
                }
                if (hasNextFile === null) {
                    return;
                }

                console.log('所有文件已签名完成，处理完成弹窗');
                setStatus('没有检测到待签文件，正在处理完成确认...');
                // 处理完成弹窗
                const finalConfirmButton = await waitForMessageBoxButtonByText(['确定', '确认'], 2000);
                if (finalConfirmButton) {
                    console.log('点击最终确认按钮');
                    setStatus('正在确认本批次签章完成...');
                    finalConfirmButton.click();
                }
                // 如果没有出现最终弹窗，说明可能有文件被跳过，启动检测流程
                const finalBox = await waitForElement('.el-message-box', 2000, true);
                if (!finalBox) {
                    console.log('未检测到最终完成弹窗，启动检测流程');
                    setStatus('正在复查待签文件列表...');
                    const ok = await runDetectionFlow();
                    if (!ok) {
                        notifyAttention('签章检测遍历完成，仍未出现完成确认弹窗，请人工检查可能被跳过的文件');
                        setStatus('复查后仍有异常，请人工检查页面状态');
                        stopProcess(true);
                    }
                }
                return;
            }
            
        } catch (error) {
            console.error('签名页面处理出错:', error);
            setStatus('签名页面处理失败，请刷新页面后重试');
        }
    }

    function isFileItemSelected(file) {
        if (!file) return false;
        const targetFile = file;
        if (targetFile.matches('.is-active, .active, .current, .selected')) {
            return true;
        }
        const selectedEl = file.querySelector(
            '.el-radio__input.is-checked, .el-checkbox__input.is-checked, .el-icon-check, .el-icon-circle-check, .el-icon-success, .is-checked, [aria-checked="true"], [aria-selected="true"]'
        );
        return !!selectedEl;
    }

    async function waitForNextFileReady(targetFile, previousCanvas = null, timeout = getNextFileTimeoutMs()) {
        const start = Date.now();
        let readySince = null;
        let lastSnapshotAt = 0;
        addAutoSignEvent('next_file_wait_start', {
            timeout,
            timeoutMinutes: getNextFileTimeoutMinutes()
        }, 'info');

        while (Date.now() - start < timeout) {
            if (!isRunning || manualStopped) return false;

            await waitForLoadingGone(3000);
            const canvas = document.querySelector(SELECTORS.signatureCanvas);
            const signatureModule = document.querySelector(SELECTORS.signatureModule);
            const canvasReady = !!canvas && isElementVisible(canvas);
            const signatureReady = !!signatureModule && isElementVisible(signatureModule);
            const canvasChangedOrStable = !previousCanvas || canvas !== previousCanvas || Date.now() - start >= 800;

            if (Date.now() - lastSnapshotAt >= 10000) {
                addAutoSignEvent('next_file_wait_snapshot', {
                    elapsedMs: Date.now() - start,
                    canvasReady,
                    signatureReady,
                    canvasChangedOrStable
                }, canvasReady && signatureReady ? 'info' : 'warn');
                lastSnapshotAt = Date.now();
            }

            if (canvasReady && signatureReady && canvasChangedOrStable) {
                if (readySince === null) {
                    readySince = Date.now();
                }
                if (Date.now() - readySince >= 300) {
                    addAutoSignEvent('next_file_ready', {
                        elapsedMs: Date.now() - start,
                        canvasChanged: !!previousCanvas && canvas !== previousCanvas
                    }, 'info');
                    return true;
                }
            } else {
                readySince = null;
            }

            await new Promise(r => setTimeout(r, 100));
        }

        addAutoSignEvent('next_file_timeout', {
            timeout,
            timeoutMinutes: getNextFileTimeoutMinutes()
        }, 'error');
        return false;
    }

    // 获取文件列表并点击第一个待签署的文件
    async function clickNextFile() {
        try {
            const fileList = document.querySelectorAll(SELECTORS.fileListItem);
            if (!fileList.length) {
                console.log('未找到文件列表');
                setStatus('未找到文件列表，请刷新页面后重试');
                return false;
            }

            // 查找第一个待签署的文件
            let targetFile = null;
            let targetFileName = '';
            
            for (let file of fileList) {
                const pendingStatus = file.querySelector(SELECTORS.pendingStatus);
                if (pendingStatus) {
                    targetFile = file;
                    targetFileName = file.querySelector(SELECTORS.fileTitle)?.textContent?.trim() || '未知文件';
                    break;
                }
            }

            if (targetFile) {
                console.log('找到第一个待签署文件:', targetFileName);
                setStatus(`正在处理待签文件：${targetFileName}`);
                const previousCanvas = document.querySelector(SELECTORS.signatureCanvas);
                targetFile.querySelector(SELECTORS.fileTitle)?.click();
                console.log('切换到待签署文件，等待页面就绪...');
                setStatus('正在切换下一个待签文件，等待页面就绪...');
                const ready = await waitForNextFileReady(targetFile, previousCanvas);
                if (!ready) {
                    notifyAttention(`切换待签文件超过 ${getNextFileTimeoutMinutes()} 分钟仍未加载完成，请检查网络、页面加载状态或浏览器弹窗权限。`);
                    stopProcess(true);
                    return null;
                }
                return true;
            }

            console.log('没有更多待签署的文件');
            setStatus('没有检测到待签文件');
            return false;
        } catch (error) {
            console.error('切换文件时出错:', error);
            setStatus('切换待签文件失败，请刷新页面后重试');
            return null;
        }
    }

    // 统一检测流程：优先处理待签署文件，直到出现完成确认弹窗
    async function runDetectionFlow() {
        try {
            console.log('%c进入检测流程：优先处理待签署文件', 'color: purple; font-weight: bold');
            setStatus('正在复查待签文件列表...');
            const fileList = document.querySelectorAll(SELECTORS.fileListItem);
            
            // 首先过滤出待签署的文件
            const pendingFiles = [];
            for (let file of fileList) {
                if (file.querySelector(SELECTORS.pendingStatus)) {
                    pendingFiles.push(file);
                }
            }
            
            // 先处理待签署文件
            if (pendingFiles.length > 0) {
                console.log(`检测到 ${pendingFiles.length} 个待签署文件，优先处理`);
                setStatus(`检测到 ${pendingFiles.length} 个待签文件，继续处理...`);
                for (let file of pendingFiles) {
                    const titleEl = file.querySelector(SELECTORS.fileTitle);
                    const name = titleEl?.textContent?.trim();
                    console.log('检测待签署文件:', name);
                    setStatus(`正在复查文件：${name}`);
                    const previousCanvas = document.querySelector(SELECTORS.signatureCanvas);
                    titleEl?.click();
                    const ready = await waitForNextFileReady(file, previousCanvas);
                    if (!ready) {
                        console.log('检测流程：切换待签文件超时');
                        setStatus('切换待签文件超时，请检查页面加载状态');
                        return false;
                    }

                    // 文件是否待签以列表 pending 状态为准；控件缺失视为异常，不再推断为已签。
                    const canvas = await waitForElement(SELECTORS.signatureCanvas, 5000, true);
                    if (!canvas) {
                        console.log('检测流程：待签文件画布未出现，判定为异常');
                        setStatus('待签文件画布未出现，请刷新页面后重试');
                        return false;
                    }
                    const sig = document.querySelector(SELECTORS.signatureModule);
                    if (!sig || !isElementVisible(sig)) {
                        console.log('检测流程：待签文件签名模块未出现，判定为异常');
                        setStatus('待签文件签名模块未出现，请检查浏览器是否拦截弹窗');
                        return false;
                    }

                    // 可签则执行签名流程（含失败重试一次）
                    setStatus('正在执行签名操作...');
                    let ok = await signProcess();
                    if (!ok) {
                        console.log('检测流程：首签失败，重试一次');
                        setStatus('签名失败，正在重试...');
                        ok = await signProcess();
                    }

                    // 每次签名后检查是否弹出完成确认弹窗（如出现则视为整批结束）
                    // 检测流程：若出现完成确认弹窗则点击并结束
                    const finalBox = await waitForElement('.el-message-box', 3000, true);
                    if (finalBox) {
                        const finalBtn = await waitForMessageBoxButtonByText(['确定', '确认'], 3000);
                        if (finalBtn) {
                            setStatus('正在确认本批次签章完成...');
                            await performReliableClick(finalBtn);
                            const startClose = Date.now();
                            while (document.querySelector('.el-message-box')) {
                                if (Date.now() - startClose > 5000) break;
                                await new Promise(r => setTimeout(r, 100));
                            }
                        }
                        console.log('检测流程：出现完成确认弹窗，结束检测');
                        setStatus('本批次签章完成，继续检查下一批...');
                        return true;
                    }
                }
            }
            
            // 列表中没有 pending 状态时，认为没有待签文件，不再通过画布/签名模块反推已签状态。
            console.log('检测流程：列表中没有待签署文件');
            setStatus('没有检测到待签文件');
            return true;
        } catch (e) {
            console.error('检测流程出错:', e);
            return false;
        }
    }

    function notifyAttention(message) {
        addAutoSignLog(message, 'error');
        addAutoSignEvent('attention_required', { message }, 'error');
        try {
            alert(message);
        } catch (e) {}
        try {
            const originalTitle = document.title;
            let flash = true;
            const id = setInterval(() => {
                document.title = flash ? '【需要处理】' + originalTitle : originalTitle;
                flash = !flash;
            }, 600);
            // 30 秒后停止闪烁
            setTimeout(() => { clearInterval(id); document.title = originalTitle; }, 30000);
        } catch (e) {}
        try {
            if (window.Notification && Notification.permission === 'granted') {
                new Notification('签章需要人工介入', { body: message });
            } else if (window.Notification && Notification.permission !== 'denied') {
                Notification.requestPermission();
            }
        } catch (e) {}
    }

    // 主要签署流程 - 移除 data-v 属性依赖
    async function signProcess() {
        try {
            console.log('开始签署流程...');
            setStatus('正在准备签署当前文件...');
            
            // 签名页只负责执行当前待签文件；是否待签以列表状态为准。
            console.log('等待画布可见 (无限等待)...');
            setStatus('正在等待签章页面加载...');
            const canvasNow = await waitForElementNoTimeout(SELECTORS.signatureCanvas, true);
            if (!canvasNow) {
                console.log('等待被中断（停止或手动停止）');
                setStatus('签章流程已停止');
                return false;
            }
            await new Promise(r => setTimeout(r, 500));
            
            let signatureModuleNow = document.querySelector(SELECTORS.signatureModule);
            if (!signatureModuleNow || !isElementVisible(signatureModuleNow)) {
                console.log('画布存在，但签名模块未出现，返回失败并交由列表状态判断');
                setStatus('签名模块未出现，请检查浏览器是否拦截弹窗');
                return false;
            }
            // 优先真实点击；如被拦截，再用事件模拟
            setStatus('正在执行签名操作...');
            try { signatureModuleNow.click(); } catch (e) { try { signatureModuleNow.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); } catch (e2) {} }
            const posNow = calculateSignPosition(canvasNow);
            simulateClick(canvasNow, posNow.x, posNow.y);

            // 点击确认签署（签章成功的唯一依据：确认签署后出现确认弹窗）
            console.log('查找确认签署按钮...');
            setStatus('正在查找确认签署按钮...');
            const confirmButton = await waitForClickableElementByText(SELECTORS.primaryButton, '确认签署', 10000);
            if (confirmButton) {
                console.log('找到确认签署按钮，点击中...');
                setStatus('正在提交当前文件签名...');
                confirmButton.click();
                
                // 处理确认弹窗
                console.log('等待确认弹窗...');
                setStatus('正在等待签名确认弹窗...');
                const confirmDialog = await waitForMessageBoxButtonByText(['确定', '确认'], 10000);
                if (confirmDialog) {
                    console.log('找到弹窗确认按钮，点击中...');
                    setStatus('正在确认当前文件签名...');
                    confirmDialog.click();
                } else {
                    console.log('未找到弹窗确认按钮，视为本次签名失败（需重试当前文件）');
                    setStatus('未找到确认弹窗按钮，请检查浏览器是否拦截弹窗');
                    return false;
                }
            } else {
                console.log('未找到确认签署按钮，返回失败并交由列表状态判断');
                setStatus('未找到确认签署按钮，请刷新页面后重试');
                return false;
            }

            setStatus('当前文件签名成功');
            return true;
        } catch (error) {
            console.error('签署过程出错:', error);
            setStatus('签署过程失败，请刷新页面后重试');
            return false;
        }
    }

    // 检查当前页面类型
    function getPageType() {
        const currentUrl = window.location.href;
        console.log('当前页面URL:', currentUrl);
        
        if (currentUrl.includes('todoList')) {
            return 'todoList';
        } else if (currentUrl.includes('librarySignature')) {
            return 'librarySignature';
        } else if (currentUrl.includes('pageseal/signature')) {
            return 'signature';
        }
        return 'unknown';
    }

    function isSupportedAutoSignPage() {
        return getPageType() !== 'unknown';
    }

    function isCurrentPageVisible() {
        return document.visibilityState === 'visible';
    }

    function removeControlUi() {
        const toolbar = document.querySelector('div[data-auto-sign-toolbar]');
        const button = document.querySelector('button[data-auto-sign-control]');
        const settingsButton = document.querySelector('button[data-auto-sign-settings]');
        const settingsPanel = document.querySelector('div[data-auto-sign-settings-panel]');
        const badge = document.querySelector('span[data-auto-sign-status]');
        if (toolbar) toolbar.remove();
        if (button) button.remove();
        if (settingsButton) settingsButton.remove();
        if (settingsPanel) closeSettingsPanel();
        if (badge) badge.remove();
        statusBadge = null;
    }

    function syncControlVisibility() {
        if (isSupportedAutoSignPage()) {
            createControlButton();
            return;
        }
        if (!isRunning && !processStarted) {
            removeControlUi();
        }
    }

    // 全局变量
    let isRunning = false;
    let processStarted = false;
    let controlButton = null;
    let manualStopped = false;
    let lastStopLogAt = 0;
    let lastStopLogManual = null;
    // 屏幕常亮 Wake Lock
    let screenWakeLock = null;
    // 自动关闭 Element 消息弹窗
    let messageBoxObserver = null;
    let messageBoxCloserTimer = null;

    async function acquireWakeLock() {
        try {
            if ('wakeLock' in navigator) {
                screenWakeLock = await navigator.wakeLock.request('screen');
                screenWakeLock.addEventListener('release', () => {
                    console.log('Wake Lock released');
                });
                console.log('Wake Lock acquired');
            } else {
                console.log('Wake Lock API not supported in this browser');
            }
        } catch (e) {
            console.warn('Wake Lock request failed:', e);
        }
    }

    async function releaseWakeLock() {
        try {
            if (screenWakeLock) {
                await screenWakeLock.release();
                screenWakeLock = null;
            }
        } catch (e) {
            console.warn('Wake Lock release failed:', e);
        }
    }

    function startAutoCloseMessageBox() {
        try {
            stopAutoCloseMessageBox();
            const tryClose = () => {
                const btn = document.querySelector('.el-message-box__btns .el-button--primary, .el-message-box .el-button--primary');
                if (btn && isElementVisible(btn)) {
                    btn.click();
                }
            };
            messageBoxObserver = new MutationObserver(() => tryClose());
            messageBoxObserver.observe(document.body, { childList: true, subtree: true });
            messageBoxCloserTimer = setInterval(tryClose, 300);
        } catch (e) {
            console.warn('startAutoCloseMessageBox failed:', e);
        }
    }

    function stopAutoCloseMessageBox() {
        try {
            if (messageBoxObserver) {
                messageBoxObserver.disconnect();
                messageBoxObserver = null;
            }
            if (messageBoxCloserTimer) {
                clearInterval(messageBoxCloserTimer);
                messageBoxCloserTimer = null;
            }
        } catch (e) {}
    }

    // 更新运行状态的函数
    function updateRunningState(running, syncGmRunning = true, stateOverride = null) {
        console.log('更新运行状态:', running);
        const targetState = stateOverride || (running ? AUTO_SIGN_STATES.RUNNING : AUTO_SIGN_STATES.IDLE);
        setAutoSignState(targetState, syncGmRunning);
        
        // 更新按钮文本
        const button = document.querySelector('button[data-auto-sign-control]');
        if (button) {
            button.innerHTML = running ? '停止运行' : '运行';
        }
        updateSettingsButtonState(running);
    }

    function runProcessHandler(handler, label) {
        Promise.resolve()
            .then(handler)
            .catch(error => {
                console.error(`${label}执行出错:`, error);
            })
            .finally(() => {
                processStarted = false;
            });
    }

    // 修改startProcess函数
    function startProcess() {
        if (manualStopped || isAutoSignManuallyStoppedState()) {
            console.log('检测到手动停止标记，禁止启动');
            return;
        }
        if (processStarted) {
            console.log('已有处理流程正在运行，忽略重复启动');
            return;
        }
        
        const wasAlreadyRunning = isAutoSignRunningState() || sessionStorage.getItem(AUTO_SIGN_STATE_KEY) === AUTO_SIGN_STATES.RUNNING;
        if (!wasAlreadyRunning) {
            resetBatchSubmitted();
        }
        const selectedPosition = getSignPositionMode();
        console.log('本次运行签字位置:', getSignPositionLabel(selectedPosition), selectedPosition);
        console.log('启动处理流程');
        processStarted = true;
        isRunning = true;
        addAutoSignEvent('start_process', {
            signPosition: selectedPosition,
            signPositionLabel: getSignPositionLabel(selectedPosition),
            wasAlreadyRunning
        }, 'info');
        setAutoSignState(AUTO_SIGN_STATES.RUNNING);
        updateRunningState(true);
        // 保持屏幕常亮，避免熄屏中断
        acquireWakeLock();
        // 开启自动关闭完成确认弹窗
        startAutoCloseMessageBox();
        setStatus(`运行中：签字位置 ${getSignPositionLabel(selectedPosition)}`);
        
        // 检查是否是签名页面
        if (window.location.href.includes('pageseal/signature')) {
            console.log('在签名页面启动流程');
            runProcessHandler(handleSignaturePage, '签名页面流程');
            return;
        }

        // 其他页面的处理逻辑
        const pageType = getPageType();
        switch (pageType) {
            case 'todoList':
                runProcessHandler(initializeProcess, '待办页面初始化流程');
                return; // 添加这一行，避免继续执行
            case 'librarySignature':
                runProcessHandler(handleBatchSignaturePage, '批量签章页面流程');
                break;
            default:
                console.log('未知页面类型');
                processStarted = false;
                break;
        }
    }

    function shouldIgnoreRepeatedStop(manual) {
        const now = Date.now();
        return lastStopLogManual === manual && now - lastStopLogAt < 1000;
    }

    function markStopLogged(manual) {
        lastStopLogManual = manual;
        lastStopLogAt = Date.now();
    }

    // 修改stopProcess函数
    function stopProcess(manual = false) {
        console.log('停止处理流程', manual ? '(手动停止)' : '(自动停止)');
        const repeatedStop = shouldIgnoreRepeatedStop(manual);
        if (!repeatedStop) {
            addAutoSignEvent('stop_process', {
                manual,
                batchSubmitted: hasSubmittedBatchOnce()
            }, manual ? 'warn' : 'info');
            markStopLogged(manual);
        }
        processStarted = false;
        isRunning = false;
        releaseWakeLock();
        stopAutoCloseMessageBox();
        resetSignEntryClickedFlags();
        setStatus('已停止', 'idle', !repeatedStop);
        
        if (manual) {
            resetBatchSubmitted();
            console.log('已标记为手动停止，将不会自动重启');
        }
        
        updateRunningState(false, true, manual ? AUTO_SIGN_STATES.STOPPED : AUTO_SIGN_STATES.IDLE);

        if (!manual) {
            addAutoSignEvent('auto_stop_without_reload', {
                pageType: getPageTypeForLog()
            }, 'info');
        }
    }

    // 批量签章页面的处理流程
    async function handleBatchSignaturePage() {
        try {
            // 仅重试一次：打开对话框 → 勾选 → 校验 → 确定（最多 2 次，否则提醒人工介入）
            for (let attempt = 1; attempt <= 2 && isRunning && !manualStopped; attempt++) {
                console.log(`%c开始处理批量签章页面（尝试 ${attempt}/2）`, 'color: blue; font-weight: bold');
                const batchSignLink = await waitForElement(SELECTORS.batchSignIcon, 15000, true);
                if (!batchSignLink) {
                    console.log('%c未找到批量签章按钮，1s 后重试', 'color: red');
                    await new Promise(r => setTimeout(r, 1000));
                    continue;
                }
                // 打开弹窗
                console.log('%c点击批量签章按钮', 'color: green');
                setStatus('正在打开批量签章窗口...');
                const linkElement = batchSignLink.closest('a') || batchSignLink.parentElement.closest('a');
                await performReliableClick(linkElement || batchSignLink);
                const dialog = await waitForDialogByHeaderText('批量签章', 15000);
                if (!dialog) {
                    console.log('%c未找到批量签章对话框，1s 后重试', 'color: red');
                    await new Promise(r => setTimeout(r, 1000));
                    continue;
                }

                await waitForLoadingGone(15000);
                if (hasSubmittedBatchOnce()) {
                    const stable = await waitForBatchListReadyByTrend(dialog);
                    if (!stable) {
                        stopProcess(true);
                        return false;
                    }
                }

                await waitForLoadingGone(15000);
                const totalCount = await waitForBatchTotalReady(dialog);
                if (totalCount === 0) {
                    console.log('批量签章弹窗显示没有待签章文件，停止流程');
                    setStatus('没有检测到待签文件');
                    const cancelBtn = dialog.querySelector(SELECTORS.dialogDefaultFooterButton) || Array.from(dialog.querySelectorAll('.el-button')).find(b => (b.textContent || '').includes('取消') || (b.textContent || '').includes('关闭'));
                    if (cancelBtn) await performReliableClick(cancelBtn);
                    stopProcess(true);
                    return true;
                }

                console.log('等待复选框加载...');
                setStatus('正在勾选待签章文件...');
                await waitForElement(SELECTORS.batchDialogBodyCheckbox, 15000, true);

                // 勾选逻辑：表头全选 → 回退逐一勾选 → 滚动补齐
                let okSelected = await selectAllCurrentPageInDialog();
                if (!okSelected) {
                    console.log('表头全选失败，回退逐一勾选');
                    okSelected = await checkAllBoxesIn(dialog);
                }
                if (!okSelected) {
                    // 滚动表体触发懒加载后再尝试一次
                    const body = dialog.querySelector(SELECTORS.batchBodyWrapper);
                    if (body) {
                        body.scrollTop = 0;
                        await new Promise(r => setTimeout(r, 150));
                        body.scrollTop = body.scrollHeight;
                        await new Promise(r => setTimeout(r, 150));
                    }
                    okSelected = await checkAllBoxesIn(dialog);
                }

                // 校验本页全选
                const bodyCheckboxes = dialog.querySelectorAll(SELECTORS.batchBodyCheckboxInput);
                const allCheckboxesChecked = Array.from(bodyCheckboxes).length > 0 && Array.from(bodyCheckboxes).every(cb => cb.classList.contains('is-checked'));
                if (!allCheckboxesChecked) {
                    console.log('还有复选框未选中，准备重试弹窗');
                    // 关闭弹窗后重试
                    const cancelBtn = dialog.querySelector(SELECTORS.dialogDefaultFooterButton) || Array.from(dialog.querySelectorAll('.el-button')).find(b => (b.textContent || '').includes('取消'));
                    if (cancelBtn) await performReliableClick(cancelBtn);
                    await new Promise(r => setTimeout(r, 300));
                    continue;
                }

                // 确定
                console.log('在对话框底部查找确定按钮...');
                const confirmButton = dialog.querySelector(SELECTORS.dialogPrimaryFooterButton);
                if (!confirmButton || /is-disabled/.test(confirmButton.className || '')) {
                    console.log('确定按钮不可用，重试弹窗');
                    const cancelBtn = dialog.querySelector(SELECTORS.dialogDefaultFooterButton) || Array.from(dialog.querySelectorAll('.el-button')).find(b => (b.textContent || '').includes('取消'));
                    if (cancelBtn) await performReliableClick(cancelBtn);
                    await new Promise(r => setTimeout(r, 300));
                    continue;
                }
                await waitForLoadingGone(8000);
                const selectedCount = getCheckedBatchRowCount(dialog);
                await performReliableClick(confirmButton);
                console.log('确定按钮点击成功');
                markBatchSubmitted({
                    totalCount,
                    selectedCount,
                    visibleRowCount: getVisibleBatchRowCount(dialog)
                });
                setStatus('正在提交本批次签章...');
                return true;
            }

            // 两次尝试仍失败，提醒用户人工介入并停止脚本
            notifyAttention('批量签章对话框勾选失败（已重试 1 次）。请人工检查对话框内容或页面状态。');
            stopProcess(true);
            return false;
        } catch (error) {
            console.error('批量签章页面处理出错:', error);
            return false;
        }
    }

    // 页面加载完成后的处理
    window.addEventListener('load', async () => {
        console.log('页面加载完成');
        console.log('当前URL:', window.location.href);
        
        // 仅在支持的页面显示控制按钮；脚本保持宽匹配以兼容前端路由。
        syncControlVisibility();

        let lastKnownUrl = window.location.href;
        setInterval(() => {
            const currentUrl = window.location.href;
            if (currentUrl !== lastKnownUrl) {
                lastKnownUrl = currentUrl;
                syncControlVisibility();
                if (isAutoSignRunningState() && !manualStopped && !processStarted && isCurrentPageVisible()) {
                    startProcess();
                }
            }
        }, 500);
        
        // 添加可见性变化监听（统一走首次入口逻辑）
        document.addEventListener('visibilitychange', () => {
            if (isCurrentPageVisible() && isAutoSignRunningState() && !manualStopped && !processStarted) {
                console.log('页面重新可见，检查页面类型并执行对应程序...');
                // 页面回到可见时尝试重新申请 Wake Lock
                acquireWakeLock();
                startProcess();
            }
        });

        // 监听 GM 值变化（跨子域同步，统一走首次入口逻辑）
        try {
            GM_addValueChangeListener && GM_addValueChangeListener(AUTO_SIGN_STATE_KEY, (name, oldVal, newVal) => {
                const nextState = normalizeAutoSignState(newVal);
                console.log('GM 主运行状态变化:', nextState);
                if (nextState === AUTO_SIGN_STATES.RUNNING) {
                    manualStopped = false;
                    updateRunningState(true, false, AUTO_SIGN_STATES.RUNNING);
                    if (isCurrentPageVisible() && !processStarted && !isRunning) {
                        resetBatchSubmitted();
                        startProcess();
                    } else {
                        setStatus('运行中：其他页面正在执行');
                    }
                    return;
                }
                if (nextState === AUTO_SIGN_STATES.STOPPED) {
                    stopProcess(true);
                    return;
                }
                if (isRunning || processStarted) {
                    processStarted = false;
                    isRunning = false;
                    releaseWakeLock();
                    stopAutoCloseMessageBox();
                    setStatus('已停止');
                    updateRunningState(false, false, nextState);
                }
            });
        } catch (e) {}

        // 检查是否需要自动启动
        const initialState = getAutoSignState();
        const shouldRun = initialState === AUTO_SIGN_STATES.RUNNING;
        const shouldManualStop = initialState === AUTO_SIGN_STATES.STOPPED;
        if (shouldManualStop) {
            manualStopped = true;
            updateRunningState(false, false, AUTO_SIGN_STATES.STOPPED);
        }
        if (shouldRun && !manualStopped && !shouldManualStop && isCurrentPageVisible()) {
            console.log('检测到自动运行状态，开始执行...');
            startProcess();
        } else if (shouldRun && !manualStopped && !shouldManualStop) {
            updateRunningState(true, false, AUTO_SIGN_STATES.RUNNING);
            setStatus('运行中：其他页面正在执行');
        }
    });
})(); 
