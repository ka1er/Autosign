# Autosign Agent Notes

## Release asset naming

Keep the repository source filenames stable:

- `autoSign.js`
- `README.md`
- `CHANGELOG.md`

When publishing GitHub Release assets, use versioned filenames so downloaded files are easy to identify:

- `autosign-vX.Y.Z.js`
- `autosign-vX.Y.Z-readme.md`
- `autosign-vX.Y.Z-changelog.md`

For pre-release versions, keep the full tag in the filename:

- `autosign-v1.1.8-beta.js`

Do not commit these versioned release files back into the source tree unless explicitly requested. Generate them from the release tag or release commit during publishing.

## User guide image for v1.1.8 and later

Starting with `v1.1.8`, each recommended release should include a user guide image asset:

- `autosign-vX.Y.Z-guide.png`

The image must be generated with Codex image generation / img2.0 capability, not hand-built with local drawing scripts. The image should be a user-facing Chinese infographic that covers:

- main script features
- changes in the current version
- common problems and troubleshooting
- installation and update guidance

Use clear, non-sensitive visuals. Do not include real account data, business documents, internal URLs, cookies, tokens, or screenshots that expose private information.

Use the approved fixed guide framework for `v1.1.8` and later releases:

1. `安装 / 更新脚本`
   - 推荐使用 Edge 浏览器。
   - 说明 Tampermonkey 安装后要打开 `允许用户脚本`。
   - 在线安装路径：GreasyFork 搜索 `PMS系统自动签章助手`，打开脚本页并安装。
   - 手动安装路径：打开 Tampermonkey 管理面板，拖入 `.js` 脚本并保存。
   - 手动更新建议：先删除旧脚本，再拖入新脚本安装。
2. `运行使用`
   - 打开 PMS 业务页面。
   - 点击 `更多`，进入 `待办` 页面。
   - 在待办页面看到运行按钮后点击运行，并按状态提示等待。
3. `功能设置`
   - 可自定义签章位置。
   - 可调整查询间隔。
   - 可导出运行日志。
   - 支持运行、停止、重新运行。
4. `常见问题`
   - 没有运行按钮：先确认已进入待办页面。
   - 脚本不运行：右击 Tampermonkey 图标，进入管理扩展，打开允许用户脚本。
   - 卡在批量签章页：点击地址栏弹窗拦截图标，选择允许。
   - 仍无法运行：刷新页面后重试，必要时导出日志反馈。
5. `vX.Y.Z 变化`
   - Only this section should change between releases unless the install, run, settings, or troubleshooting workflow actually changes.

The footer should keep the update advice concise: can connect to the internet -> prefer GreasyFork; when receiving a new script file -> delete the old version first, then drag in and install the new file.

For `v1.1.8`, the guide image should highlight:

- more reliable batch signature list refresh
- safer file switching on the signature page
- clearer running status messages
- log export for troubleshooting
- Tampermonkey update advice: delete the old manually installed script before adding the new one, or use Tampermonkey update when installed through GreasyFork
