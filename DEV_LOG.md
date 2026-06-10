# Video Sub MD Runner 开发日志

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

---

## 3. 踩坑记录

| 问题 | 根因 | 解决方案 | 涉及版本 |
|------|------|----------|----------|
| 内嵌面板不是真终端 | `spawn` + textarea 只能模拟 stdin/stdout，不支持完整 TTY 行为 | 保留内嵌面板作为备用，默认使用外部终端 | v0.1 |
| `spawn('powershell.exe')` 后看不到窗口 | Obsidian 是 GUI/Electron 进程，直接启动控制台程序不一定分配可见窗口 | 尝试 `cmd /c start` | v0.3 |
| `cmd /c start powershell.exe` 仍不弹窗 | 子进程窗口创建在用户环境中不稳定 | 改用 `shell.openPath()` 打开 `.cmd` 文件 | v0.4 -> v1.0 |
| 本机路径不适合公开上传 | `data.json` 和默认设置包含用户机器路径 | 将 `data.json` 加入 `.gitignore`，提供 `data.example.json` | v1.0 |
| 内嵌输出里的 Markdown 路径不能点击 | 原来输出区只创建纯文本 `span`，OSC 8 链接会被当成 ANSI 控制符清掉 | 解析 OSC 8 / Obsidian URI / `.md` 路径，渲染成可点击链接并用 `openLinkText()` 打开 | v1.1 |
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
