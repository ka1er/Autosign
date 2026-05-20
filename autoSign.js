// ==UserScript==
// @name         中国移动自动签署脚本 (重构版)
// @namespace    http://tampermonkey.net/
// @version      1.1.0
// @description  自动签署中国移动文件 - 重构版，基于状态元素选择
// @author       Zhangchenghe (Updated by AI)
// @match        *://*.chinamobile.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addValueChangeListener
// ==/UserScript==

(function() {
    'use strict';

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
                startProcess();
            }
        };
        
        document.body.appendChild(button);
        if (!statusBadge) {
            statusBadge = document.createElement('span');
            statusBadge.setAttribute('data-auto-sign-status', 'true');
            statusBadge.style.position = 'fixed';
            statusBadge.style.top = '10px';
            statusBadge.style.left = '110px';
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

    function setStatus(text) {
        try {
            const badge = document.querySelector('span[data-auto-sign-status]') || statusBadge;
            if (badge) badge.innerText = text || '';
        } catch (e) {}
    }

    // 计算签名位置（右上角）
    function calculateSignPosition(canvas) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: rect.right - (rect.width * 0.1), // 右上角，距离右边缘10%
            y: rect.top + (rect.height * 0.1)   // 右上角，距离上边缘10%
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

    // 检查是否有待签署的文件
    function hasPendingDocuments() {
        const pendingElements = document.querySelectorAll('.status-box.status-pending');
        return pendingElements.length > 0;
    }

    // 点击第一个待签署元素
    async function clickFirstPendingDocument() {
        console.log('查找并点击第一个待签署元素...');
        const pendingElements = document.querySelectorAll('.status-box.status-pending');
        if (pendingElements.length === 0) {
            console.log('未找到待签署元素');
            return false;
        }
        
        const firstPending = pendingElements[0];
        console.log('找到待签署元素，准备点击');
        await performReliableClick(firstPending);
        return true;
    }

    // 执行签名操作
    async function performSignature() {
        try {
            console.log('开始执行签名操作...');
            
            // 等待画布出现
            console.log('等待画布元素...');
            const canvas = await waitForElement('canvas.canvasstyle', 15000, true);
            if (!canvas) {
                console.log('未找到画布元素');
                return false;
            }
            
            // 等待签名模块出现
            console.log('等待签名模块...');
            const signatureModule = await waitForElement('div.carousel-i-New', 10000, true);
            if (!signatureModule) {
                console.log('未找到签名模块，可能已签');
                return true;
            }
            
            // 点击签名模块
            console.log('点击签名模块...');
            await performReliableClick(signatureModule);
            
            // 计算签名位置并模拟点击
            console.log('计算签名位置...');
            const signPosition = calculateSignPosition(canvas);
            console.log('签名位置:', signPosition);
            simulateClick(canvas, signPosition.x, signPosition.y);
            
            // 等待确认签署按钮
            console.log('等待确认签署按钮...');
            const confirmButton = await waitForElement('button.el-button--primary', 10000, true);
            if (!confirmButton) {
                console.log('未找到确认签署按钮');
                return false;
            }
            
            // 点击确认签署
            console.log('点击确认签署按钮...');
            await performReliableClick(confirmButton);
            
            // 等待确认对话框
            console.log('等待确认对话框...');
            const dialogConfirmButton = await waitForElement('button.el-button--default.el-button--small.el-button--primary', 10000, true);
            if (dialogConfirmButton) {
                console.log('点击对话框确认按钮...');
                await performReliableClick(dialogConfirmButton);
            }
            
            // 等待加载完成
            console.log('等待签名完成...');
            await waitForLoadingGone(15000);
            
            return true;
        } catch (error) {
            console.error('签名操作出错:', error);
            return false;
        }
    }

    // 检查签名状态
    function checkSignatureStatus() {
        // 检查是否还有待签署状态
        const pendingElements = document.querySelectorAll('.status-box.status-pending');
        return pendingElements.length === 0;
    }

    // 主签名流程
    async function mainSignatureProcess() {
        try {
            while (isRunning && !manualStopped) {
                // 检查是否有待签署的文件
                if (!hasPendingDocuments()) {
                    console.log('所有文件已签署完成');
                    break;
                }
                
                // 点击第一个待签署元素
                console.log('=== 开始处理新文件 ===');
                const clicked = await clickFirstPendingDocument();
                if (!clicked) {
                    console.log('无法找到待签署元素，结束流程');
                    break;
                }
                
                // 等待页面加载
                console.log('等待页面加载...');
                await new Promise(resolve => setTimeout(resolve, 3000));
                await waitForLoadingGone(15000);
                
                // 执行签名操作
                console.log('执行签名操作...');
                const signed = await performSignature();
                if (!signed) {
                    console.log('签名操作失败，尝试下一个文件');
                    // 等待一段时间后继续
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    continue;
                }
                
                // 等待页面更新
                console.log('等待页面更新...');
                await new Promise(resolve => setTimeout(resolve, 3000));
                await waitForLoadingGone(15000);
            }
            
            // 检查最终状态
            if (hasPendingDocuments()) {
                console.log('仍有待签署文件，但无法继续处理');
                notifyAttention('仍有待签署文件，但无法自动处理，请人工检查');
            } else {
                console.log('所有文件签署完成');
                setStatus('已完成');
            }
        } catch (error) {
            console.error('主流程出错:', error);
            notifyAttention('自动化签章过程中出现错误，请人工检查');
        }
    }

    // 全局变量
    let isRunning = false;
    let manualStopped = false;
    // 屏幕常亮 Wake Lock
    let screenWakeLock = null;

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

    // 更新运行状态的函数
    function updateRunningState(running) {
        console.log('更新运行状态:', running);
        try { GM_setValue && GM_setValue('autoSignRunning', running === true); } catch (e) {}
        localStorage.setItem('autoSignRunning', running.toString());
        sessionStorage.setItem('autoSignRunning', running.toString());
        
        // 更新按钮文本
        const button = document.querySelector('button[data-auto-sign-control]');
        if (button) {
            button.innerHTML = running ? '停止运行' : '运行';
        }
    }

    // 开始处理流程
    function startProcess() {
        if (manualStopped) {
            console.log('检测到手动停止标记，禁止启动');
            return;
        }
        
        console.log('启动处理流程');
        isRunning = true;
        updateRunningState(true);
        // 保持屏幕常亮，避免熄屏中断
        acquireWakeLock();
        setStatus('运行中：开始处理待签署文件...');
        
        // 开始主签名流程
        mainSignatureProcess();
    }

    // 停止处理流程
    function stopProcess(manual = false) {
        console.log('停止处理流程', manual ? '(手动停止)' : '(自动停止)');
        isRunning = false;
        releaseWakeLock();
        setStatus('已停止');
        
        if (manual) {
            manualStopped = true;
            console.log('已标记为手动停止，将不会自动重启');
        }
        
        updateRunningState(false);
        
        // 清除所有正在进行的定时器
        const highestTimeoutId = setTimeout(";");
        for (let i = 0; i < highestTimeoutId; i++) {
            clearTimeout(i);
        }
        
        // 中断所有正在进行的Promise
        window.stop();
        location.reload();
    }

    // 页面加载完成后的处理
    window.addEventListener('load', async () => {
        console.log('页面加载完成');
        console.log('当前URL:', window.location.href);
        
        // 创建控制按钮
        const controlButton = createControlButton();
        
        // 添加可见性变化监听
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && isRunning && !manualStopped) {
                console.log('页面重新可见，检查状态...');
                // 页面回到可见时尝试重新申请 Wake Lock
                acquireWakeLock();
            }
        });

        // 监听 GM 值变化（跨子域同步）
        try {
            GM_addValueChangeListener && GM_addValueChangeListener('autoSignRunning', (name, oldVal, newVal) => {
                console.log('GM 运行状态变化:', newVal);
                const shouldRun = !!newVal;
                if (shouldRun && !manualStopped) {
                    isRunning = true;
                    startProcess();
                } else {
                    isRunning = false;
                    stopProcess(false);
                }
            });
        } catch (e) {}

        // 检查是否需要自动启动
        let shouldRun = false;
        try { shouldRun = !!(GM_getValue && GM_getValue('autoSignRunning')); } catch (e) {}
        if (!shouldRun) {
            shouldRun = localStorage.getItem('autoSignRunning') === 'true';
        }
        if (shouldRun && !manualStopped) {
            console.log('检测到自动运行状态，开始执行...');
            startProcess();
        }
    });
})();
