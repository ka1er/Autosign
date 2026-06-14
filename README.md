# Autosign

这是一个用于网页电子签章流程的 Tampermonkey 自动化脚本源码仓库。

本仓库为私有仓库，用于保存脚本源码历史、记录版本变化，并方便后续维护和回退。申报材料、演示视频、压缩包、真实业务文件和截图不放在本仓库。

## 当前版本

当前脚本版本：`v1.1.6`

版本号以 `autoSign.js` 文件头部的 UserScript 元数据为准：

```javascript
// @version      1.1.6
```

## 仓库内容

```text
Autosign/
├─ autoSign.js    # Tampermonkey 主脚本
├─ README.md      # 维护说明
├─ CHANGELOG.md   # 版本记录
└─ .gitignore     # Git 忽略规则
```

## 主要功能

- 在目标页面添加运行/停止控制按钮
- 记录脚本运行状态
- 自动识别签章相关页面
- 自动进入待处理流程
- 自动执行批量签章和确认操作
- 提供状态提示、等待和重试逻辑

## 使用方式

1. 安装 Tampermonkey 浏览器插件。
2. 打开 Tampermonkey 管理面板。
3. 新建脚本。
4. 将 `autoSign.js` 内容复制到 Tampermonkey 中并保存。
5. 打开目标业务页面后使用脚本提供的运行按钮。

## 版本规则

本仓库把历史脚本重新规范成以下版本：

- `v1.0`：原 `0.2`，初始归档版本
- `v1.0.1`：原 `0.3`，修复元素选择器
- `v1.1.0`：原 `0.4`，重构版，基于状态元素选择
- `v1.1.1`：支持实时状态栏更新和优化签名流程
- `v1.1.2`：支持签字位置设置，并优化处理按钮识别和状态反馈
- `v1.1.3`：限制脚本只在实际支持的签章相关页面加载
- `v1.1.4`：更新脚本名称、描述和作者信息
- `v1.1.5`：修复匹配范围过窄导致控制按钮不显示的问题
- `v1.1.6`：补充 CPMS 内网和通用签章页匹配范围，优化签字位置和流程运行状态处理

仓库中始终只保留一个主脚本文件：`autoSign.js`。

## 后续维护流程

```powershell
git clone https://github.com/ka1er/Autosign.git
cd Autosign
```

修改后提交：

```powershell
git status
git add autoSign.js README.md CHANGELOG.md
git commit -m "Update autosign script"
git push
```

发布明确版本：

```powershell
git tag v1.1.2
git push origin v1.1.2
```

## 不建议提交的内容

- 账号、Cookie、Token、密码
- 真实业务文件或文件清单
- 申报材料、证明材料、演示视频
- 浏览器缓存、日志、本地测试数据
- 本地专用配置

## 备注

本仓库只用于个人源码维护和备份。脚本依赖目标网页结构，如果页面调整，可能需要同步更新选择器、等待逻辑和流程判断。


