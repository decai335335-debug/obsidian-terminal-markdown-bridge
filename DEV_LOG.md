# Obsidian Terminal Markdown Bridge 开发日志

记录这个 Obsidian 本地插件从需求到可用版本的演进过程，包括原始需求、关键技术选择、踩坑记录和后续路线。

---

## 1. 项目起源

原始需求来自一个 Obsidian 工作流：用户希望在 Obsidian 左侧图标栏增加一个入口，点击后运行 `E:/Projects/ai/video-sub-md/main.py`。

这个 Python 项目用于视频字幕下载和 Markdown 生成，运行时会通过 `input()` 接收视频链接、Cookie、是否生成分析/翻译等选项。因此它不是单纯的后台脚本，而是一个需要真实终端交互的 CLI 工具。

核心目标：

- 从 Obsidian 左侧图标栏一键启动。
- 默认进入 `video-sub-md` 项目目录。
- 能和 Python 脚本交互，而不是只看一段后台输出。
- 保留可配置性，避免插件只绑定一台机器。

---

## 2. 迭代时间线

### v0.1 -- 内嵌输出面板原型

**功能：**

- 创建 Obsidian 本地插件 `video-sub-md-runner`。
- 注册右侧 view 面板，显示 Python 输出。
- 使用 `child_process.spawn()` 启动 Python 脚本。
- 底部输入框将文本写入 `stdin`。

**结论：** 能处理简单输入输出，但不是真正终端。对于 `rich` 输出、复杂交互、Ctrl+C、光标控制不够稳。

### v0.2 -- 借鉴 gnome-terminal-loader

用户提供了本地参考项目 `gnome-terminal-loader`。该项目在 Linux 上通过 Obsidian ribbon 图标调用 `gnome-terminal`，并可运行 vault 根目录下的 `main.py`。

借鉴点：

- 插件只做一件事：左侧图标启动终端。
- 终端交互交给系统终端处理，而不是自己模拟终端。
- 可以提供两个入口：打开终端、运行 Python 脚本。

Windows 适配：

- `gnome-terminal` 替换为 Windows 终端启动方案。
- `python3 main.py` 替换为可配置的 Python 路径 + 脚本路径。
- vault 根目录替换为用户指定项目目录。

### v0.3 -- PowerShell spawn 尝试

**方案：** 使用 `spawn('powershell.exe')`，设置 `detached: true` 和 `windowsHide: false`。

**问题：** Obsidian 显示“已打开终端”，但用户看不到任何窗口。原因是 GUI/Electron 进程中直接 spawn 控制台程序，不一定会创建可见控制台窗口。

### v0.4 -- cmd start 尝试

**方案：** 使用 `cmd.exe /c start powershell.exe -NoExit ...` 强制打开新窗口。

**问题：** 在用户环境里仍然只显示 Obsidian Notice，没有看到终端窗口。可能与 Obsidian/Electron 子进程启动方式、窗口权限或系统终端关联有关。

### v1.0 -- `.cmd + shell.openPath()` 稳定方案

**方案：**

- 插件生成临时 `.cmd` 文件。
- 使用 Electron `shell.openPath()` 打开该 `.cmd`。
- Windows 按文件关联执行，接近用户双击脚本文件的行为。

**结果：** 能弹出真实可见的命令行窗口，支持用户输入和脚本交互。


### v1.1 -- 内嵌输出路径可点击

**需求触发**：`video-sub-md` 下载字幕后会在结果中输出生成的 Markdown 文件路径。用户希望在 Obsidian 内嵌面板中点击该路径，直接打开生成的字幕笔记，而不是复制路径或依赖外部终端的 Ctrl+点击。

**实现方案**：
- 在输出渲染层解析 Rich/终端常用的 OSC 8 链接。
- 额外识别纯文本中的 `obsidian://open?...`、`file:///...` 和 Windows 绝对 `.md` 路径。
- 如果路径位于当前 vault 下，转换为 vault 相对路径并调用 `app.workspace.openLinkText()`。
- 如果不是 vault 内文件，则回退到 Electron `shell.openExternal()`。

**价值**：内嵌伪终端不只是显示日志，还能成为下载结果的操作面板，让“下载字幕 -> 打开 Markdown -> 继续编辑”闭环留在 Obsidian 内。


### v1.2 -- 生成文件结果区

**需求触发**：用户反馈只在终端输出中寻找可点击路径仍然不够明显，希望在终端之外留一块区域，集中展示本轮刚生成的字幕 Markdown 文件。

**实现方案**：
- 在内嵌面板的输出区和输入框之间新增 `Generated Markdown files` 区域。
- 输出解析到 Markdown 链接时，同时加入结果区。
- 结果区按本轮运行去重展示文件名和原始链接。
- 新增 **Open latest** 快捷入口，直接打开最近检测到的 Markdown 文件。
- 每次重新运行脚本时清空上一轮结果，避免新旧文件混在一起。

**价值**：用户不用在终端表格里找路径，下载完成后直接看结果区，点击文件名即可进入生成的字幕笔记。


### v1.3 -- CSV 报告兜底识别

**需求触发**：实际运行时，Rich 终端表格可能只把“文件名”显示出来，真实 Obsidian 链接藏在终端超链接协议里；内嵌面板不一定能完整拿到这段协议，导致结果区没有识别到生成文件。

**实现方案**：
- 运行脚本时记录开始时间。
- 脚本结束后扫描当前 vault 的 `11-subtitles/_download_report_*.csv`。
- 只读取本轮运行后生成的报告，解析 CSV 表头中的 `filepath` 列。
- 将 `status=success` 且以 `.md` 结尾的文件路径加入 `Generated Markdown files`。
- 新增 **Refresh current** 按钮，但只读取当前运行对应的最新报告；没有运行上下文时，只读取最新一个报告。

**价值**：即使终端输出没有完整 Markdown 地址，只要脚本生成了下载报告，插件仍然能实例化出真实的 Markdown 文件入口。


### v1.4 -- 报告识别范围收紧

**需求触发**：Refresh 兜底读取最近 24 小时报告时，会把其他批次 CSV 里的 Markdown 文件也加入结果区，超出了当前这次聊天/运行范围。

**修复方案**：
- 自动识别只读取本轮运行开始后生成的最新一个 `_download_report_*.csv`。
- 如果用户手动点击 **Refresh current** 且当前有运行上下文，仍只读取当前运行对应的最新报告。
- 如果没有运行上下文，手动刷新只读取最新一个报告，不再扫描最近 24 小时所有报告。

**价值**：Generated Markdown files 只展示当前批次真正生成的文件，避免历史报告污染结果区。


### v1.5 -- 项目命名升级

**需求触发**：插件已经从 `video-sub-md` 的专用启动器，演进为连接 Obsidian、交互终端和生成 Markdown 文件的通用桥接工具。原名 `Video Sub MD Runner` 过于绑定单一项目，无法准确表达当前能力。

**命名决策**：采用 **Obsidian Terminal Markdown Bridge**。

| 关键词 | 含义 |
|------|------|
| Obsidian | 插件入口、结果打开和最终编辑都发生在 Obsidian 内 |
| Terminal | 保留外部终端和内嵌伪终端两种脚本交互方式 |
| Markdown Bridge | 将脚本生成的 Markdown 文件识别并带回 vault 结果区 |

**兼容性处理**：保留插件 `id` 为 `video-sub-md-runner`，避免本地 Obsidian 启用状态和 `data.json` 配置失效；只更新展示名称、README、DEV_LOG 和 GitHub 仓库名。


### v1.6 -- Single Ribbon Icon And Dual Refresh Scopes

**Request**: Keep only one Obsidian ribbon entry for the inline terminal, and add an explicit 24-hour report scan without polluting the default current-run result list.

**Changes**:
- Removed the extra ribbon icons and kept one custom terminal-style icon.
- The ribbon entry opens the inline terminal panel and starts the script.
- Kept **Refresh current** for the current run/latest report scope.
- Added **Refresh 24h** to scan all `_download_report_*.csv` files modified in the last 24 hours.
- Manual refresh clears the result panel before loading the selected scope, so current and 24-hour results do not silently mix.

**Value**: The default result panel stays focused on the current conversation/run, while still giving the user a deliberate recovery path for recent Markdown files.


### v1.7 -- Visible Ribbon Terminal Icon

**Request**: The custom terminal SVG looked too small in Obsidian's left ribbon and was hard to see.

**Changes**:
- Replaced the custom `terminal-markdown-bridge` SVG with Obsidian's built-in `terminal-square` icon.
- Kept a single ribbon entry, but now it uses the same visual scale and stroke weight as the other Obsidian sidebar icons.

**Value**: The entry remains terminal-shaped while matching the size and readability of the rest of the left sidebar.

---

## 3. 踩坑记录

| 问题 | 根因 | 解决方案 | 涉及版本 |
|------|------|----------|----------|
| 内嵌面板不是真终端 | `spawn` + textarea 只能模拟 stdin/stdout，不支持完整 TTY 行为 | 保留内嵌面板作为备用，默认使用外部终端 | v0.1 |
| `spawn('powershell.exe')` 后看不到窗口 | Obsidian 是 GUI/Electron 进程，直接启动控制台程序不一定分配可见窗口 | 尝试 `cmd /c start` | v0.3 |
| `cmd /c start powershell.exe` 仍不弹窗 | 子进程窗口创建在用户环境中不稳定 | 改用 `shell.openPath()` 打开 `.cmd` 文件 | v0.4 -> v1.0 |
| 本机路径不适合公开上传 | `data.json` 和默认设置包含用户机器路径 | 将 `data.json` 加入 `.gitignore`，提供 `data.example.json` | v1.0 |
| 内嵌输出里的 Markdown 路径不能点击 | 原来输出区只创建纯文本 `span`，OSC 8 链接会被当成 ANSI 控制符清掉 | 解析 OSC 8 / Obsidian URI / `.md` 路径，渲染成可点击链接并用 `openLinkText()` 打开 | v1.1 |
| 可点击路径在终端输出里不够明显 | 用户需要从表格/日志里找链接，发现成本高 | 新增 `Generated Markdown files` 结果区，集中展示本轮生成的 Markdown 文件并支持 Open latest | v1.2 |
| 终端只显示文件名，结果区没有文件 | Rich 表格的真实链接可能藏在终端超链接协议里，内嵌面板拿不到完整地址 | 脚本结束后读取 `_download_report_*.csv` 的 `filepath` 列，并提供 Refresh current 兜底 | v1.3 |
| Refresh current 混入历史 CSV 结果 | 兜底逻辑读取最近 24 小时的多个报告 | 改为只读取当前运行后的最新一个报告；无运行上下文时只读最新报告 | v1.4 |
| 项目名过于绑定 video-sub-md | 插件能力已扩展到终端脚本和 Markdown 结果桥接 | 展示名和仓库名改为 Obsidian Terminal Markdown Bridge，保留插件 ID 保证兼容 | v1.5 |
| Need to recover recent Markdown files | Current-scope refresh is intentionally strict | Added Refresh 24h to scan CSV reports from the last 24 hours | v1.6 |
| Three ribbon icons appeared | Earlier versions kept external terminal, external script, and inline panel entries at once | Kept one terminal-style ribbon icon for a cleaner sidebar | v1.6 |
| Ribbon icon was too small | Custom SVG used a conservative 24px drawing that looked tiny in Obsidian ribbon rendering | Switched to built-in `terminal-square` for native scale and stroke weight | v1.7 |
| Linux 插件不能直接复用 | `gnome-terminal-loader` 依赖 Linux/GNOME | 只借鉴 ribbon + terminal launcher 思路，终端实现换成 Windows 方案 | v0.2 |

---

## 4. 设计决策

### 为什么默认使用外部终端，而不是内嵌终端？

| 方案 | 优点 | 缺点 | 决策 |
|------|------|------|------|
| 外部 PowerShell/cmd | 原生交互稳定，支持 `input()`、粘贴、Ctrl+C | 窗口不在 Obsidian 内部 | 当前默认 |
| 内嵌伪终端 | 视觉上在 Obsidian 里，零原生依赖 | 不是真 TTY，复杂交互不稳 | 作为备用 |
| `xterm.js + node-pty` | 真正内嵌终端体验最好 | `node-pty` 原生模块分发复杂，Obsidian/Electron ABI 风险高 | 未来可探索 |

### 为什么用 `.cmd + shell.openPath()`？

- 用户反馈 `spawn` 和 `cmd start` 都只显示 Notice，不出现终端。
- `shell.openPath()` 更接近系统层面的“打开这个文件”。
- `.cmd` 可以天然保持窗口、执行 `cd /d`、运行 Python、最后 `pause`。
- 这条路径最接近普通用户双击脚本，稳定性优先。

### 为什么排除 `data.json`？

`data.json` 是 Obsidian 插件的本地配置文件，会保存个人 Python 路径、项目路径、脚本路径。上传公开仓库会泄露本机目录结构，也会让其他用户拿到不可用配置。因此仓库只保留 `data.example.json`。

---

## 5. 实际测试数据

| 测试项 | 结果 | 说明 |
|--------|------|------|
| 插件文件生成 | 通过 | `manifest.json`、`main.js`、`styles.css` 已创建 |
| 社区插件启用列表 | 通过 | `community-plugins.json` 已包含插件 ID |
| 外部终端打开 | 通过 | `.cmd + shell.openPath()` 能弹出可交互窗口 |
| Python 脚本路径 | 通过 | 本地配置指向 `video-sub-md/main.py` |
| 内嵌面板 | 可用但有限 | 适合简单 stdin/stdout，不作为默认交互方式 |

---

## 6. 文件位置

```text
video-sub-md-runner/
├── manifest.json       # Obsidian 插件元数据
├── main.js             # 插件主逻辑
├── styles.css          # 内嵌面板样式
├── data.example.json   # 可复制的配置示例
├── README.md           # 面向用户和开发者的说明
├── DEV_LOG.md          # 需求、迭代、踩坑、设计决策
└── .gitignore          # 排除本地 data.json
```

本地安装位置示例：

```text
<你的 vault>/.obsidian/plugins/video-sub-md-runner
```
