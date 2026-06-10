// ==UserScript==
// @name         中国移动自动签署脚本
// @namespace    http://tampermonkey.net/
// @version      1.1.3
// @description  自动签署中国移动文件 - 支持签字位置设置和优化的签名流程
// @author       Zhangchenghe
// @match        *://*.chinamobile.com/*todoList*
// @match        *://*.chinamobile.com/*librarySignature*
// @match        *://*.chinamobile.com/*pageseal/signature*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// ==/UserScript==

(function() {
    'use strict';

    const SIGN_POSITION_KEY = 'autoSignPosition';
    const MANUAL_STOP_KEY = 'autoSignManualStopped';
    const SIGN_POSITION_OPTIONS = [
        { value: 'top-left', label: '左上' },
        { value: 'bottom-left', label: '左下' },
        { value: 'bottom-right', label: '右下' },
        { value: 'top-right', label: '右上' },
        { value: 'center', label: '中间' },
        { value: 'random', label: '随机位置' }
    ];

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
        const isRunning = localStorage.getItem('autoSignRunning') === 'true';
        button.innerHTML = isRunning ? '停止运行' : '运行';
        button.style.position = 'fixed';
        button.style.top = '10px';
        button.style.left = '10px';
        button.style.zIndex = '9999';
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
            const currentRunning = localStorage.getItem('autoSignRunning') === 'true';
            console.log('按钮点击，当前运行状态:', currentRunning);
            
            if (currentRunning) {
                console.log('手动停止脚本运行');
                stopProcess(true); // 传入true表示手动停止
            } else {
                console.log('启动脚本运行');
                manualStopped = false; // 重置手动停止标记
                try { GM_setValue && GM_setValue(MANUAL_STOP_KEY, false); } catch (e) {}
                startProcess();
            }
        };
        
        document.body.appendChild(button);
        createSettingsButton();
        if (!statusBadge) {
            statusBadge = document.createElement('span');
            statusBadge.setAttribute('data-auto-sign-status', 'true');
            statusBadge.style.position = 'fixed';
            statusBadge.style.top = '10px';
            statusBadge.style.left = '150px';
            statusBadge.style.zIndex = '9999';
            statusBadge.style.padding = '6px 10px';
            statusBadge.style.backgroundColor = '#303133';
            statusBadge.style.color = '#fff';
            statusBadge.style.borderRadius = '4px';
            statusBadge.style.fontSize = '12px';
            statusBadge.style.opacity = '0.9';
            statusBadge.innerText = '就绪';
            document.body.appendChild(statusBadge);
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

    function createSettingsButton() {
        if (document.querySelector('button[data-auto-sign-settings]')) {
            return;
        }

        const settingsButton = document.createElement('button');
        settingsButton.setAttribute('data-auto-sign-settings', 'true');
        settingsButton.innerHTML = '设置';
        settingsButton.style.position = 'fixed';
        settingsButton.style.top = '10px';
        settingsButton.style.left = '100px';
        settingsButton.style.zIndex = '9999';
        settingsButton.style.padding = '8px 12px';
        settingsButton.style.cursor = 'pointer';
        settingsButton.style.backgroundColor = '#67C23A';
        settingsButton.style.color = 'white';
        settingsButton.style.border = 'none';
        settingsButton.style.borderRadius = '4px';
        settingsButton.style.fontSize = '14px';
        settingsButton.style.fontWeight = 'bold';

        settingsButton.onmouseover = function() {
            if (localStorage.getItem('autoSignRunning') !== 'true') {
                this.style.backgroundColor = '#85ce61';
            }
        };
        settingsButton.onmouseout = function() {
            this.style.backgroundColor = localStorage.getItem('autoSignRunning') === 'true' ? '#A0CFFF' : '#67C23A';
        };
        settingsButton.onclick = function() {
            if (localStorage.getItem('autoSignRunning') === 'true') {
                setStatus('运行中：停止后才能修改签字位置');
                return;
            }
            toggleSettingsPanel();
        };

        document.body.appendChild(settingsButton);
        updateSettingsButtonState(localStorage.getItem('autoSignRunning') === 'true');
    }

    function toggleSettingsPanel() {
        let panel = document.querySelector('div[data-auto-sign-settings-panel]');
        if (panel) {
            panel.remove();
            return;
        }

        panel = document.createElement('div');
        panel.setAttribute('data-auto-sign-settings-panel', 'true');
        panel.style.position = 'fixed';
        panel.style.top = '50px';
        panel.style.left = '10px';
        panel.style.zIndex = '9999';
        panel.style.padding = '10px';
        panel.style.backgroundColor = '#fff';
        panel.style.border = '1px solid #dcdfe6';
        panel.style.borderRadius = '4px';
        panel.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
        panel.style.fontSize = '13px';
        panel.style.color = '#303133';

        const label = document.createElement('div');
        label.innerText = '签字位置';
        label.style.marginBottom = '6px';
        label.style.fontWeight = 'bold';

        const select = document.createElement('select');
        select.setAttribute('data-auto-sign-position-select', 'true');
        select.style.width = '120px';
        select.style.padding = '4px 6px';
        select.style.border = '1px solid #dcdfe6';
        select.style.borderRadius = '4px';
        select.style.backgroundColor = '#fff';
        select.disabled = localStorage.getItem('autoSignRunning') === 'true';

        const currentMode = getSignPositionMode();
        SIGN_POSITION_OPTIONS.forEach(option => {
            const item = document.createElement('option');
            item.value = option.value;
            item.innerText = option.label;
            item.selected = option.value === currentMode;
            select.appendChild(item);
        });
        select.onchange = function() {
            if (localStorage.getItem('autoSignRunning') === 'true') {
                this.value = getSignPositionMode();
                setStatus('运行中：停止后才能修改签字位置');
                return;
            }
            setSignPositionMode(this.value);
            setStatus(`已选择签字位置：${getSignPositionLabel(this.value)}`);
        };

        panel.appendChild(label);
        panel.appendChild(select);
        document.body.appendChild(panel);
    }

    function updateSettingsButtonState(running) {
        const settingsButton = document.querySelector('button[data-auto-sign-settings]');
        if (settingsButton) {
            settingsButton.style.cursor = running ? 'not-allowed' : 'pointer';
            settingsButton.style.backgroundColor = running ? '#A0CFFF' : '#67C23A';
        }
        const panel = document.querySelector('div[data-auto-sign-settings-panel]');
        const select = document.querySelector('select[data-auto-sign-position-select]');
        if (select) {
            select.disabled = running === true;
        }
        if (running && panel) {
            panel.remove();
        }
    }

    function setStatus(text) {
        try {
            const badge = document.querySelector('span[data-auto-sign-status]') || statusBadge;
            if (badge) badge.innerText = text || '';
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
            return { x: rect.left + (rect.width * 0.5), y: rect.top + (rect.height * 0.5) };
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
            const dialogs = Array.from(document.querySelectorAll('.el-dialog')).filter(dialog => {
                if (!isElementVisible(dialog)) return false;
                if (!dialogTitle) return true;
                const header = dialog.querySelector('.el-dialog__header');
                return header && (header.textContent || '').includes(dialogTitle);
            });

            for (const dialog of dialogs) {
                const button = findClickableElementByText(dialog, ['.el-dialog__footer .el-button', 'button.el-button'], buttonText);
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
        const isAnyMaskVisible = () => Array.from(document.querySelectorAll('.el-loading-mask')).some(isElementVisible);
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
            const dialogs = Array.from(document.querySelectorAll('.el-dialog'));
            const found = dialogs.find(dlg => {
                const header = dlg.querySelector('.el-dialog__header');
                return header && (header.textContent || '').includes(text) && isElementVisible(dlg);
            });
            if (found) return found;
            await new Promise(r => setTimeout(r, 100));
        }
        return null;
    }

    // 点击表头选择列复选框以全选当前页
    async function selectAllCurrentPageInDialog() {
        try {
            // 等待遮罩消失，避免被 loading 覆盖导致不可点击
            await waitForLoadingGone(15000);
            // 兼容不同结构：优先在对话框作用域内查找表头选择列
            const headerInput = await waitForElement(
                '.el-dialog__body th.el-table-column--selection .el-checkbox__input, ' +
                '.el-dialog__body .el-table__header-wrapper th.el-table-column--selection .el-checkbox__input, ' +
                'th.el-table-column--selection .el-checkbox__input',
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
                const bodyInputs = Array.from(document.querySelectorAll('.el-dialog__body .el-table__body-wrapper .el-checkbox__input, .el-table__body-wrapper .el-checkbox__input'));
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
            const headerCheck = scope.querySelector('.el-dialog__body th.el-table-column--selection .el-checkbox__input, .el-dialog__body th.el-table-column--selection .el-checkbox, .el-dialog__body .el-table__header-wrapper th .el-checkbox, .el-dialog__body .el-table__header-wrapper .el-checkbox');
            if (headerCheck) {
                const headerLabel = headerCheck.classList.contains('el-checkbox__input') ? (headerCheck.closest('.el-checkbox') || headerCheck) : headerCheck;
                const headerInput = headerLabel.querySelector('.el-checkbox__input') || headerCheck;
                if (!headerInput || !headerInput.classList.contains('is-checked') || headerInput.classList.contains('is-indeterminate')) {
                    await performReliableClick(headerLabel);
                    // 等待表体勾选状态同步
                    const startHeaderWait = Date.now();
                    while (Date.now() - startHeaderWait < 3000) {
                        const bodyInputs = Array.from(scope.querySelectorAll('.el-table__body-wrapper .el-checkbox__input'));
                        if (bodyInputs.length > 0 && bodyInputs.every(i => i.classList.contains('is-checked'))) {
                            return true;
                        }
                        await new Promise(r => setTimeout(r, 100));
                    }
                } else {
                    // 表头已经是选中状态，校验表体
                    const bodyInputs = Array.from(scope.querySelectorAll('.el-table__body-wrapper .el-checkbox__input'));
                    if (bodyInputs.length > 0 && bodyInputs.every(i => i.classList.contains('is-checked'))) {
                        return true;
                    }
                }
            }

            // 如果还有未勾选，遍历主体行
            let bodyUnchecked = Array.from(scope.querySelectorAll('.el-table__body-wrapper .el-checkbox__input:not(.is-checked)'));
            if (bodyUnchecked.length) {
                const body = scope.querySelector('.el-table__body-wrapper');
                if (body && body.scrollHeight > body.clientHeight) {
                    body.scrollTop = 0;
                }
                const wrappers = scope.querySelectorAll('.el-table__body-wrapper .el-checkbox');
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
                const rest = scope.querySelectorAll('.el-table__body-wrapper .el-checkbox__input:not(.is-checked)');
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

            const allChecked = Array.from(scope.querySelectorAll('.el-table__body-wrapper .el-checkbox__input')).every(c => c.classList.contains('is-checked'));
            return allChecked || !!(scope.querySelector('.el-table__body-wrapper')?.querySelectorAll('.el-checkbox__input').length);
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
        const signButton2 = findClickableElementByText(document, 'button.el-button.el-button--primary.is-plain', '电子签章');
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

    // 初始化流程
    async function initializeProcess() {
        try {
            console.log('开始初始化流程...');
            setStatus('初始化流程：开始处理');
            
            // 1. 首先等待并点击电子签章按钮
            console.log('第一步：查找电子签章按钮');
            setStatus('初始化流程：查找电子签章按钮');
            const signButton = await findSignButton();
            if (!signButton) {
                console.log('未找到电子签章按钮，停止流程');
                setStatus('错误：未找到电子签章按钮');
                return false;
            }

            // 2. 点击电子签章按钮
            console.log('点击电子签章按钮');
            setStatus('初始化流程：点击电子签章按钮');
            // 添加防止重复点击的标记
            if (signButton.dataset.clicked) {
                console.log('电子签章按钮已经被点击过，跳过');
                return false;
            }
            signButton.dataset.clicked = 'true';
            
            try {
                signButton.click();
                console.log('电子签章按钮点击成功');
                // 添加足够的等待时间，确保点击生效
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (e) {
                console.log('常规点击失败，尝试模拟点击事件');
                const clickEvent = new MouseEvent('click', {
                    view: window,
                    bubbles: true,
                    cancelable: true
                });
                signButton.dispatchEvent(clickEvent);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            console.log('等待列表刷新完成...');
            setStatus('初始化流程：等待列表刷新完成');
            await waitForLoadingGone(15000);

            // 3. 等待并点击处理按钮（持续等待直到出现为止）
            console.log('第二步：等待处理按钮出现...');
            setStatus('初始化流程：等待处理按钮');
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
                setStatus('初始化流程：点击处理按钮');
                await performReliableClick(processButton);
            }
            // 等待跳转到批量签章页或批量签章按钮出现
            setStatus('初始化流程：等待跳转到批量签章页面');
            const jumpedToList = await waitForUrlIncludes('librarySignature', 15000);
            if (!jumpedToList) {
                await waitForElement('i.icon.font_family.icon-piliangchuli', 15000, true);
            }
            
            // 4. 点击“批量签章”并在弹窗内操作
            console.log('第三步：等待批量签章按钮出现...');
            setStatus('初始化流程：等待批量签章按钮');
            const batchSignLink = await waitForElement('i.icon.font_family.icon-piliangchuli', 15000, true);
            if (!batchSignLink) {
                console.log('未找到批量签章按钮');
                setStatus('错误：未找到批量签章按钮');
                return false;
            }

            console.log('点击批量签章按钮');
            setStatus('初始化流程：点击批量签章按钮');
            const linkElement = batchSignLink.closest('a') || batchSignLink.parentElement.closest('a');
            await performReliableClick(linkElement || batchSignLink);

            // 等待“批量签章”对话框（回退一开始的方式：直接等复选框并全选）
            await new Promise(resolve => setTimeout(resolve, 1000));
            console.log('第四步：优先尝试表头全选');
            setStatus('初始化流程：选择待签章文件');
            const headerSelected2 = await selectAllCurrentPageInDialog();
            if (!headerSelected2) {
                console.log('表头全选未成功，回退到原始逐一勾选');
                const checkbox = await waitForElement('.el-checkbox__original', 10000, true);
                if (!checkbox) {
                    console.log('未找到复选框');
                    setStatus('错误：未找到复选框');
                    return false;
                }
                console.log('选中复选框...');
                await checkAllBoxes();
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // 点击确定按钮（原始逻辑）
            console.log('第五步：等待确定按钮出现...');
            const confirmButton_v1 = await waitForDialogButtonByText('批量签章', '确定', 10000);
            if (!confirmButton_v1) {
                console.log('未找到确定按钮');
                return false;
            }
            await performReliableClick(confirmButton_v1);
            return true;

        } catch (error) {
            console.error('初始化流程出错:', error);
            return false;
        }
    }

    // 修改检查页面状态的函数
    async function checkAndContinueProcess() {
        // 检查当前页面是否是批量签章页面
        if (!window.location.href.includes('librarySignature')) {
            return;
        }

        console.log('检查页面状态...');
        
        // 等待页面完全加载
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 查找批量签章按钮
        console.log('查找批量签章按钮...');
        const batchSignLink = await waitForElement('i.icon.font_family.icon-piliangchuli', 10000, true);
        if (batchSignLink && isRunning && !manualStopped) {
            console.log('找到批量签章按钮，准备点击');
            // 从图标元素找到最近的a标签父元素并点击
            const linkElement = batchSignLink.closest('a') || batchSignLink.parentElement.closest('a');
            if (linkElement) {
                linkElement.click();
            } else {
                // 如果找不到链接元素，尝试点击图标本身或其父元素
                const clickTarget = batchSignLink.parentElement || batchSignLink;
                clickTarget.click();
            }
            
            // 等待弹窗出现
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // 选中所有复选框
            await checkAllBoxes();
            
            // 查找并点击确定按钮
            const confirmButton = await waitForDialogButtonByText('批量签章', '确定', 5000);
            if (confirmButton) {
                console.log('点击确定按钮，开始新一轮签名');
                confirmButton.click();
            }
        }
    }

    // 签署完成后的处理
    async function handleSignatureCompletion() {
        try {
            console.log('处理签署完成后的流程...');
            
            // 循环处理批量签章
            while (isRunning) {
                // 在每个重要步骤前检查运行状态
                if (!isRunning) {
                    console.log('检测到停止信号，终止处理');
                    return false;
                }

                // 确保页面完全加载
                console.log('等待页面加载...');
                await new Promise(resolve => setTimeout(resolve, 3000));

                // 查找批量签章按钮
                console.log('查找批量签章按钮...');
                const batchSignLink = await waitForElement('i.icon.font_family.icon-piliangchuli', 10000, true);
                if (!batchSignLink || !isRunning) {
                    console.log('未找到批量签章按钮或收到停止信号');
                    return false;
                }

                console.log('找到批量签章按钮，准备点击');
                // 从图标元素找到最近的a标签父元素并点击
                const linkElement = batchSignLink.closest('a') || batchSignLink.parentElement.closest('a');
                if (linkElement) {
                    linkElement.click();
                } else {
                    // 如果找不到链接元素，尝试点击图标本身或其父元素
                    const clickTarget = batchSignLink.parentElement || batchSignLink;
                    clickTarget.click();
                }
                
                // 等待弹窗出现
                await new Promise(resolve => setTimeout(resolve, 1500));

                // 检查是否有可选择的文件
                const checkboxes = document.querySelectorAll('.el-table__body-wrapper .el-checkbox__input:not(.is-checked)');
                if (!checkboxes.length) {
                    console.log('没有可选择的文件，关闭对话框');
                    // 查找并点击取消按钮
                    const cancelButton = await waitForDialogButtonByText('批量签章', '取消', 5000);
                    if (cancelButton) {
                        cancelButton.click();
                    }
                    // 结束循环
                    break;
                }

                // 选中所有复选框
                const allChecked = await checkAllBoxes();
                if (!allChecked) {
                    console.log('复选框选中失败');
                    continue; // 失败后继续下一次循环
                }

                // 查找并点击确定按钮
                const confirmButton = await waitForDialogButtonByText('批量签章', '确定', 10000);
                if (!confirmButton) {
                    console.log('未找到确定按钮');
                    continue; // 失败后继续下一次循环
                }

                if (!isRunning) return false;

                console.log('点击确定按钮，进入签名流程');
                confirmButton.click();

                // 设置一个定时器在原页面中定期检查状态
                const checkInterval = setInterval(() => {
                    if (document.visibilityState === 'visible') {
                        console.log('页面变为可见，检查状态...');
                        clearInterval(checkInterval);
                        checkAndContinueProcess();
                    }
                }, 1000);

                // 等待足够长的时间确保签名流程完成
                await new Promise(resolve => setTimeout(resolve, 8000));
                
                // 清除定时器
                clearInterval(checkInterval);
                
                // 继续下一次循环
                continue;
            }

            // 所有文件处理完成后
            if (!manualStopped) {
                console.log('所有文件处理完成，准备重新启动流程...');
                stopProcess(false);
                
                setTimeout(() => {
                    if (!manualStopped) {
                        console.log('重新启动流程...');
                        startProcess();
                    } else {
                        console.log('检测到手动停止标记，取消自动重启');
                    }
                }, 3000);
            } else {
                console.log('检测到手动停止标记，不再重新启动');
            }

            return true;
        } catch (error) {
            console.error('完成处理流程出错:', error);
            return false;
        }
    }

    // 修改签名操作页面的处理流程
    async function handleSignaturePage() {
        try {
            console.log('开始签名页面处理流程');
            setStatus('签名页面：开始处理');

            while (isRunning && !manualStopped) {
                // 执行签名流程
                setStatus('签名页面：执行签名操作');
                let signedOk = false;
                for (let attempt = 1; attempt <= 2; attempt++) { // 失败可重签一次
                    const ok = await signProcess();
                    if (ok) {
                        signedOk = true;
                        setStatus('签名页面：签名成功');
                        break;
                    }
                    console.log('签名失败，准备重试第', attempt, '次');
                    setStatus('签名页面：签名失败，准备重试');
                }

                if (!signedOk) {
                    console.log('签名重试后仍失败，进入下一个文件检测');
                }

                // 每个文件处理后（成功或跳过）统一等待 2s 再切换
                await new Promise(resolve => setTimeout(resolve, 2000));

                if (!isRunning || manualStopped) {
                    return;
                }

                // 切换到下一个文件（仅以签名流程返回成功为依据，不再依赖列表图标类）
                setStatus('签名页面：寻找下一个待签署文件');
                const hasNextFile = await clickNextFile();

                if (hasNextFile) {
                    continue;
                }

                console.log('所有文件已签名完成，处理完成弹窗');
                setStatus('签名页面：所有文件签名完成');
                // 处理完成弹窗
                const finalConfirmButton = await waitForMessageBoxButtonByText(['确定', '确认'], 2000);
                if (finalConfirmButton) {
                    console.log('点击最终确认按钮');
                    setStatus('签名页面：点击最终确认按钮');
                    finalConfirmButton.click();
                }
                // 如果没有出现最终弹窗，说明可能有文件被跳过，启动检测流程
                const finalBox = await waitForElement('.el-message-box', 2000, true);
                if (!finalBox) {
                    console.log('未检测到最终完成弹窗，启动检测流程');
                    setStatus('签名页面：启动检测流程');
                    const ok = await runDetectionFlow();
                    if (!ok) {
                        notifyAttention('签章检测遍历完成，仍未出现完成确认弹窗，请人工检查可能被跳过的文件');
                        setStatus('错误：检测流程未完成');
                        stopProcess(true);
                    }
                }
                return;
            }
            
        } catch (error) {
            console.error('签名页面处理出错:', error);
            setStatus('错误：签名页面处理失败');
        }
    }

    // 获取文件列表并点击第一个待签署的文件
    async function clickNextFile() {
        try {
            const fileList = document.querySelectorAll('ul.tempList li.flex');
            if (!fileList.length) {
                console.log('未找到文件列表');
                setStatus('错误：未找到文件列表');
                return false;
            }

            // 查找第一个待签署的文件
            let targetFile = null;
            let targetFileName = '';
            
            for (let file of fileList) {
                const pendingStatus = file.querySelector('.status-box.status-pending');
                if (pendingStatus) {
                    targetFile = file;
                    targetFileName = file.querySelector('.tem-title')?.textContent?.trim() || '未知文件';
                    break;
                }
            }

            if (targetFile) {
                console.log('找到第一个待签署文件:', targetFileName);
                setStatus(`找到待签署文件：${targetFileName}`);
                targetFile.querySelector('.tem-title')?.click();
                console.log('切换到待签署文件，等待3秒...');
                setStatus('切换到待签署文件，等待加载');
                // 延长等待时间，确保页面完全加载
                await new Promise(resolve => setTimeout(resolve, 3000));
                return true;
            }

            console.log('没有更多待签署的文件');
            setStatus('没有更多待签署文件');
            return false;
        } catch (error) {
            console.error('切换文件时出错:', error);
            setStatus('错误：切换文件失败');
            return false;
        }
    }

    // 统一检测流程：优先处理待签署文件，直到出现完成确认弹窗
    async function runDetectionFlow() {
        try {
            console.log('%c进入检测流程：优先处理待签署文件', 'color: purple; font-weight: bold');
            setStatus('检测流程：开始处理');
            const fileList = document.querySelectorAll('ul.tempList li.flex');
            
            // 首先过滤出待签署的文件
            const pendingFiles = [];
            for (let file of fileList) {
                if (file.querySelector('.status-box.status-pending')) {
                    pendingFiles.push(file);
                }
            }
            
            // 先处理待签署文件
            if (pendingFiles.length > 0) {
                console.log(`检测到 ${pendingFiles.length} 个待签署文件，优先处理`);
                setStatus(`检测到 ${pendingFiles.length} 个待签署文件`);
                for (let file of pendingFiles) {
                    const titleEl = file.querySelector('.tem-title');
                    const name = titleEl?.textContent?.trim();
                    console.log('检测待签署文件:', name);
                    setStatus(`检测文件：${name}`);
                    titleEl?.click();
                    await new Promise(r => setTimeout(r, 1500)); // 延长等待时间

                    // 以画布为准：如果画布出现但签名模块不存在/不可见，则跳过；否则执行签名
                    const canvas = await waitForElement('canvas.canvasstyle', 5000, true);
                    if (canvas) {
                        const sig = document.querySelector('div.carousel-i-New');
                        if (!sig || !isElementVisible(sig)) {
                            console.log('检测流程：画布存在但无签名模块，跳过');
                            setStatus('检测流程：文件已签署，跳过');
                            continue;
                        }
                    } else {
                        console.log('检测流程：画布未出现，跳过');
                        setStatus('检测流程：画布未出现，跳过');
                        continue;
                    }

                    // 可签则执行签名流程（含失败重试一次）
                    setStatus('检测流程：执行签名操作');
                    let ok = await signProcess();
                    if (!ok) {
                        console.log('检测流程：首签失败，重试一次');
                        setStatus('检测流程：签名失败，准备重试');
                        ok = await signProcess();
                    }

                    // 每次签名后检查是否弹出完成确认弹窗（如出现则视为整批结束）
                    // 检测流程：若出现完成确认弹窗则点击并结束
                    const finalBox = await waitForElement('.el-message-box', 3000, true);
                    if (finalBox) {
                        const finalBtn = await waitForMessageBoxButtonByText(['确定', '确认'], 3000);
                        if (finalBtn) {
                            setStatus('检测流程：点击完成确认按钮');
                            await performReliableClick(finalBtn);
                            const startClose = Date.now();
                            while (document.querySelector('.el-message-box')) {
                                if (Date.now() - startClose > 5000) break;
                                await new Promise(r => setTimeout(r, 100));
                            }
                        }
                        console.log('检测流程：出现完成确认弹窗，结束检测');
                        setStatus('检测流程：完成确认弹窗已处理');
                        return true;
                    }
                }
            }
            
            // 如果没有待签署文件，遍历所有文件进行检查
            console.log('没有待签署文件，遍历所有文件进行检查');
            setStatus('检测流程：遍历所有文件检查');
            for (let i = 0; i < fileList.length; i++) {
                const file = fileList[i];
                const titleEl = file.querySelector('.tem-title');
                const name = titleEl?.textContent?.trim();
                console.log('检测文件:', name);
                setStatus(`检测文件：${name}`);
                titleEl?.click();
                await new Promise(r => setTimeout(r, 1000)); // 延长等待时间

                // 以画布为准：如果画布出现但签名模块不存在/不可见，则跳过；否则执行签名
                const canvas = await waitForElement('canvas.canvasstyle', 5000, true);
                if (canvas) {
                    const sig = document.querySelector('div.carousel-i-New');
                    if (!sig || !isElementVisible(sig)) {
                        console.log('检测流程：画布存在但无签名模块，跳过');
                        setStatus('检测流程：文件已签署，跳过');
                        continue;
                    }
                } else {
                    console.log('检测流程：画布未出现，跳过');
                    setStatus('检测流程：画布未出现，跳过');
                    continue;
                }

                // 可签则执行签名流程（含失败重试一次）
                setStatus('检测流程：执行签名操作');
                let ok = await signProcess();
                if (!ok) {
                    console.log('检测流程：首签失败，重试一次');
                    setStatus('检测流程：签名失败，准备重试');
                    ok = await signProcess();
                }

                // 每次签名后检查是否弹出完成确认弹窗（如出现则视为整批结束）
                // 检测流程：若出现完成确认弹窗则点击并结束
                const finalBox = await waitForElement('.el-message-box', 3000, true);
                if (finalBox) {
                    const finalBtn = await waitForMessageBoxButtonByText(['确定', '确认'], 3000);
                    if (finalBtn) {
                        setStatus('检测流程：点击完成确认按钮');
                        await performReliableClick(finalBtn);
                        const startClose = Date.now();
                        while (document.querySelector('.el-message-box')) {
                            if (Date.now() - startClose > 5000) break;
                            await new Promise(r => setTimeout(r, 100));
                        }
                    }
                    console.log('检测流程：出现完成确认弹窗，结束检测');
                    setStatus('检测流程：完成确认弹窗已处理');
                    return true;
                }
            }
            console.log('检测流程：遍历完所有文件仍未出现完成确认弹窗');
            return false;
        } catch (e) {
            console.error('检测流程出错:', e);
            return false;
        }
    }

    function notifyAttention(message) {
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
            setStatus('签署流程：开始处理');
            
            // 以画布为准：先等待画布，再在 0.5s 后校验签名模块；若无签名模块，视为已签，跳过
            console.log('等待画布可见 (无限等待)...');
            setStatus('签署流程：等待画布出现');
            const canvasNow = await waitForElementNoTimeout('canvas.canvasstyle', true);
            if (!canvasNow) {
                console.log('等待被中断（停止或手动停止）');
                setStatus('签署流程：等待被中断');
                return false;
            }
            await new Promise(r => setTimeout(r, 500));
            
            // 移除 data-v 属性依赖
            let signatureModuleNow = document.querySelector('div.carousel-i-New');
            if (!signatureModuleNow || !isElementVisible(signatureModuleNow)) {
                console.log('画布存在，但签名模块未出现，判定为已签状态，跳过当前文件');
                setStatus('签署流程：文件已签署，跳过');
                return true;
            }
            // 优先真实点击；如被拦截，再用事件模拟
            setStatus('签署流程：执行签名操作');
            try { signatureModuleNow.click(); } catch (e) { try { signatureModuleNow.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); } catch (e2) {} }
            const posNow = calculateSignPosition(canvasNow);
            simulateClick(canvasNow, posNow.x, posNow.y);

            // 点击确认签署（签章成功的唯一依据：确认签署后出现确认弹窗）
            console.log('查找确认签署按钮...');
            setStatus('签署流程：寻找确认签署按钮');
            const confirmButton = await waitForClickableElementByText('button.el-button--primary', '确认签署', 10000);
            if (confirmButton) {
                console.log('找到确认签署按钮，点击中...');
                setStatus('签署流程：点击确认签署按钮');
                confirmButton.click();
                
                // 处理确认弹窗
                console.log('等待确认弹窗...');
                setStatus('签署流程：等待确认弹窗');
                const confirmDialog = await waitForMessageBoxButtonByText(['确定', '确认'], 10000);
                if (confirmDialog) {
                    console.log('找到弹窗确认按钮，点击中...');
                    setStatus('签署流程：点击弹窗确认按钮');
                    confirmDialog.click();
                } else {
                    console.log('未找到弹窗确认按钮，视为本次签名失败（需重试当前文件）');
                    setStatus('签署流程：未找到弹窗确认按钮');
                    return false;
                }
            } else {
                // 没有确认签署按钮但有画布，视为已签状态（直接返回成功）
                const stillHasCanvas = !!document.querySelector('canvas.canvasstyle');
                if (stillHasCanvas) {
                    console.log('未找到确认签署按钮，但画布存在，推断为已签状态，返回成功');
                    setStatus('签署流程：文件已签署，返回成功');
                    return true;
                }
                console.log('未找到确认签署按钮且画布不存在，返回失败');
                setStatus('签署流程：未找到确认签署按钮');
                return false;
            }

            setStatus('签署流程：签名成功');
            return true;
        } catch (error) {
            console.error('签署过程出错:', error);
            setStatus('错误：签署过程失败');
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

    // 全局变量
    let isRunning = false;
    let processStarted = false;
    let controlButton = null;
    let manualStopped = false;
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
    function updateRunningState(running, syncGmRunning = true) {
        console.log('更新运行状态:', running);
        if (syncGmRunning) {
            try { GM_setValue && GM_setValue('autoSignRunning', running === true); } catch (e) {}
        }
        localStorage.setItem('autoSignRunning', running.toString());
        sessionStorage.setItem('autoSignRunning', running.toString());
        
        // 更新按钮文本
        const button = document.querySelector('button[data-auto-sign-control]');
        if (button) {
            button.innerHTML = running ? '停止运行' : '运行';
        }
        updateSettingsButtonState(running);
    }

    // 修改startProcess函数
    function startProcess() {
        if (manualStopped) {
            console.log('检测到手动停止标记，禁止启动');
            return;
        }
        if (processStarted) {
            console.log('已有处理流程正在运行，忽略重复启动');
            return;
        }
        
        const selectedPosition = getSignPositionMode();
        console.log('本次运行签字位置:', getSignPositionLabel(selectedPosition), selectedPosition);
        console.log('启动处理流程');
        try { GM_setValue && GM_setValue(MANUAL_STOP_KEY, false); } catch (e) {}
        processStarted = true;
        isRunning = true;
        updateRunningState(true);
        // 保持屏幕常亮，避免熄屏中断
        acquireWakeLock();
        // 开启自动关闭完成确认弹窗
        startAutoCloseMessageBox();
        setStatus(`运行中：签字位置 ${getSignPositionLabel(selectedPosition)}`);
        
        // 检查是否是签名页面
        if (window.location.href.includes('esign.hl.chinamobile.com/pageseal/signature')) {
            console.log('在签名页面启动流程');
            handleSignaturePage();
            return;
        }

        // 其他页面的处理逻辑
        const pageType = getPageType();
        switch (pageType) {
            case 'todoList':
                initializeProcess();
                return; // 添加这一行，避免继续执行
            case 'librarySignature':
                handleBatchSignaturePage();
                break;
            default:
                console.log('未知页面类型');
                break;
        }
    }

    // 修改stopProcess函数
    function stopProcess(manual = false) {
        console.log('停止处理流程', manual ? '(手动停止)' : '(自动停止)');
        processStarted = false;
        isRunning = false;
        releaseWakeLock();
        stopAutoCloseMessageBox();
        setStatus('已停止');
        
        if (manual) {
            manualStopped = true;
            try { GM_setValue && GM_setValue(MANUAL_STOP_KEY, true); } catch (e) {}
            console.log('已标记为手动停止，将不会自动重启');
        }
        
        updateRunningState(false, !manual);
    }

    // 批量签章页面的处理流程
    async function handleBatchSignaturePage() {
        try {
            // 仅重试一次：打开对话框 → 勾选 → 校验 → 确定（最多 2 次，否则提醒人工介入）
            for (let attempt = 1; attempt <= 2 && isRunning && !manualStopped; attempt++) {
                console.log(`%c开始处理批量签章页面（尝试 ${attempt}/2）`, 'color: blue; font-weight: bold');
                const batchSignLink = await waitForElement('i.icon.font_family.icon-piliangchuli', 15000, true);
                if (!batchSignLink) {
                    console.log('%c未找到批量签章按钮，1s 后重试', 'color: red');
                    await new Promise(r => setTimeout(r, 1000));
                    continue;
                }
                // 打开弹窗
                console.log('%c点击批量签章按钮', 'color: green');
                setStatus('批量签章：等待列表更新 10s...');
                const linkElement = batchSignLink.closest('a') || batchSignLink.parentElement.closest('a');
                await performReliableClick(linkElement || batchSignLink);
                await new Promise(r => setTimeout(r, 10000));
                const dialog = await waitForDialogByHeaderText('批量签章', 15000);
                if (!dialog) {
                    console.log('%c未找到批量签章对话框，1s 后重试', 'color: red');
                    await new Promise(r => setTimeout(r, 1000));
                    continue;
                }
                console.log('等待复选框加载...');
                setStatus('批量签章：加载列表与勾选...');
                await waitForElement('.el-dialog__body .el-checkbox__input, .el-dialog__body .el-checkbox__original', 15000, true);
                await waitForLoadingGone(15000);

                // 勾选逻辑：表头全选 → 回退逐一勾选 → 滚动补齐
                let okSelected = await selectAllCurrentPageInDialog();
                if (!okSelected) {
                    console.log('表头全选失败，回退逐一勾选');
                    okSelected = await checkAllBoxesIn(dialog);
                }
                if (!okSelected) {
                    // 滚动表体触发懒加载后再尝试一次
                    const body = dialog.querySelector('.el-table__body-wrapper');
                    if (body) {
                        body.scrollTop = 0;
                        await new Promise(r => setTimeout(r, 150));
                        body.scrollTop = body.scrollHeight;
                        await new Promise(r => setTimeout(r, 150));
                    }
                    okSelected = await checkAllBoxesIn(dialog);
                }

                // 校验本页全选
                const bodyCheckboxes = dialog.querySelectorAll('.el-table__body-wrapper .el-checkbox__input');
                const allCheckboxesChecked = Array.from(bodyCheckboxes).length > 0 && Array.from(bodyCheckboxes).every(cb => cb.classList.contains('is-checked'));
                if (!allCheckboxesChecked) {
                    console.log('还有复选框未选中，准备重试弹窗');
                    // 关闭弹窗后重试
                    const cancelBtn = dialog.querySelector('.el-dialog__footer .el-button--default') || Array.from(dialog.querySelectorAll('.el-button')).find(b => (b.textContent || '').includes('取消'));
                    if (cancelBtn) await performReliableClick(cancelBtn);
                    await new Promise(r => setTimeout(r, 300));
                    continue;
                }

                // 确定
                console.log('在对话框底部查找确定按钮...');
                const confirmButton = dialog.querySelector('.el-dialog__footer .dialog-footer button.el-button--primary');
                if (!confirmButton || /is-disabled/.test(confirmButton.className || '')) {
                    console.log('确定按钮不可用，重试弹窗');
                    const cancelBtn = dialog.querySelector('.el-dialog__footer .el-button--default') || Array.from(dialog.querySelectorAll('.el-button')).find(b => (b.textContent || '').includes('取消'));
                    if (cancelBtn) await performReliableClick(cancelBtn);
                    await new Promise(r => setTimeout(r, 300));
                    continue;
                }
                await waitForLoadingGone(8000);
                await performReliableClick(confirmButton);
                console.log('确定按钮点击成功');
                setStatus('批量签章：已提交签名');
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
        
        // 创建控制按钮
        const controlButton = createControlButton();
        
        // 添加可见性变化监听（统一走首次入口逻辑）
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && isRunning && !manualStopped) {
                console.log('页面重新可见，检查页面类型并执行对应程序...');
                // 页面回到可见时尝试重新申请 Wake Lock
                acquireWakeLock();
                handleVisibilityChange();
            }
        });

        // 监听 GM 值变化（跨子域同步，统一走首次入口逻辑）
        try {
            GM_addValueChangeListener && GM_addValueChangeListener('autoSignRunning', (name, oldVal, newVal) => {
                console.log('GM 运行状态变化:', newVal);
                const shouldRun = !!newVal;
                if (shouldRun && !manualStopped) {
                    startProcess();
                } else if (isRunning || processStarted) {
                    stopProcess(false);
                }
            });
            GM_addValueChangeListener && GM_addValueChangeListener(MANUAL_STOP_KEY, (name, oldVal, newVal) => {
                console.log('GM 手动停止状态变化:', newVal);
                if (newVal) {
                    stopProcess(true);
                }
            });
        } catch (e) {}

        // 检查是否需要自动启动
        let shouldRun = false;
        let shouldManualStop = false;
        try { shouldManualStop = !!(GM_getValue && GM_getValue(MANUAL_STOP_KEY)); } catch (e) {}
        try { shouldRun = !!(GM_getValue && GM_getValue('autoSignRunning')); } catch (e) {}
        if (!shouldRun) {
            shouldRun = localStorage.getItem('autoSignRunning') === 'true';
        }
        if (shouldManualStop) {
            manualStopped = true;
            updateRunningState(false, false);
        }
        if (shouldRun && !manualStopped && !shouldManualStop) {
            console.log('检测到自动运行状态，开始执行...');
            startProcess();
        }
    });

    // 修改页面可见性变化处理函数
    async function handleVisibilityChange() {
        try {
            // 等待页面完全加载
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // 获取当前页面类型
            const pageType = getPageType();
            console.log('当前页面类型:', pageType);

            // 直接调用startProcess，复用第一遍的逻辑
            if (isRunning && !manualStopped) {
                console.log('页面重新可见，开始执行处理流程...');
                startProcess();
            }
        } catch (error) {
            console.error('页面可见性变化处理出错:', error);
        }
    }
})(); 
