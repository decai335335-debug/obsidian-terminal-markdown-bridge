# Obsidian Terminal Markdown Bridge

在 Obsidian 左侧图标栏一键打开交互终端、运行本地脚本，并把脚本生成的 Markdown 文件自动收集成可点击入口。适合把 `video-sub-md` 这类 CLI 工具接进笔记工作流。

---

## 1. 一句话定位

这是一个 Obsidian 桌面端本地插件：在左侧 ribbon 增加终端和 Markdown 结果入口，一键运行可配置的本地脚本，并把生成的 Markdown 文件带回 Obsidian。


### 关于名称

项目名 **Obsidian Terminal Markdown Bridge** 表达三个核心能力：

- **Obsidian**：入口和最终阅读/编辑都发生在 Obsidian 内。
- **Terminal**：脚本仍然可以保留命令行交互能力，复杂交互可走外部终端，简单交互可走内嵌伪终端。
- **Markdown Bridge**：脚本生成的 Markdown 会被识别、收集，并以可点击结果区带回当前 vault。

---

## 2. 解决什么痛点

**以前是这样的：**

- 要先离开 Obsidian，打开 PowerShell 或 Windows Terminal。
- 要手动 `cd` 到项目目录，再输入 Python 命令。
- Python 脚本如果需要 `input()` 交互，普通后台进程看不到输入输出。
- 每次处理视频字幕、下载链接、生成 Markdown，都要在笔记和终端之间来回切换。

**现在是这样的：**

- 在 Obsidian 左侧点一个图标，直接打开项目目录终端。
- 点另一个图标，直接运行配置好的 `main.py`。
- 终端是真正可见、可交互的 Windows 命令行窗口，可以粘贴链接、输入选项、查看输出。
- Obsidian 里仍保留内嵌输出面板命令，适合简单输入输出场景。

**适合谁用：**

- **视频字幕整理者** —— 在 Obsidian 里管理视频笔记，同时运行字幕下载/解析脚本。
- **Python 自动化用户** —— 常用某个 CLI 脚本，希望从笔记软件一键启动。
- **Obsidian 工作流玩家** —— 想把外部工具、项目目录、笔记库连接成一个操作入口。

---

## 3. 核心功能

| 功能 | 解决什么问题 |
|------|-------------|
| 左侧图标打开项目终端 | 不用手动打开 PowerShell 再 `cd` 到项目目录 |
| 左侧图标运行 Python 脚本 | 一键启动 `main.py`，适合 `video-sub-md` 这类 CLI 工具 |
| 可见外部终端 | 支持 `input()`、粘贴链接、选择菜单等真实交互 |
| 内嵌面板运行 | 简单场景下可在 Obsidian 面板里查看输出并发送输入 |
| 输出路径可点击 | 识别脚本输出中的 `obsidian://`、`file:///`、vault 内 `.md` 路径，点击后直接在 Obsidian 打开笔记 |
| 生成文件结果区 | 在内嵌终端下方单独列出本轮生成的 Markdown 文件，点击文件名或 **Open latest** 即可进入笔记 |
| CSV report fallback | `Refresh current` reads the current run/latest report; `Refresh 24h` scans reports from the last 24 hours when you need to recover recent results |
| 插件设置页 | 可修改 Python 路径、项目目录、脚本路径，不需要改源码 |
| 本地配置排除提交 | `data.json` 保存个人路径，但默认不上传到 GitHub |

---

## 4. 安装方法

### 前提条件

- Obsidian 桌面版。
- 已关闭或允许社区插件安全限制。
- Windows 环境推荐使用 PowerShell。
- 已安装 Python，并能运行目标脚本。

### 手动安装

1. 下载或克隆本项目。
2. 将项目文件夹放到你的 vault 插件目录：

```text
<你的 vault>/.obsidian/plugins/obsidian-terminal-markdown-bridge/
```
> 兼容说明：插件内部 `id` 仍保留为 `video-sub-md-runner`，已有本地安装可以继续使用旧文件夹名；新安装时使用仓库名文件夹更直观。


3. 确认目录里至少包含：

```text
manifest.json
main.js
styles.css
```

4. 打开 Obsidian，进入 **设置 → 社区插件**。
5. 点击 **重新加载插件**，启用 **Obsidian Terminal Markdown Bridge**。
6. 进入插件设置，填写：
   - **Python 路径**：例如 `C:\Path\To\Python\python.exe`
   - **项目目录**：例如 `E:/Projects/ai/video-sub-md`
   - **脚本路径**：例如 `E:/Projects/ai/video-sub-md/main.py`

---

## 5. 使用方法

### 场景一：打开项目终端

**什么时候用：** 想进入项目目录，手动运行命令、查看文件、调试脚本。

1. 打开 Obsidian。
2. 点击左侧图标栏里的终端图标。
3. 插件会打开一个可交互命令行窗口，并自动进入配置的项目目录。

### 场景二：一键运行 `main.py`

**什么时候用：** 已经确定要运行配置好的视频字幕下载脚本。

1. 点击左侧图标栏里的脚本终端图标。
2. 插件会打开命令行窗口并自动执行 Python 脚本。
3. 按脚本提示粘贴视频链接、输入选项。
4. 脚本结束后，窗口会保留，方便查看结果。

### 场景三：使用内嵌面板运行

**什么时候用：** 脚本交互很简单，只需要输入少量文本。

1. 打开 Obsidian 命令面板。
2. 搜索 **运行 video-sub-md 脚本（内嵌面板）**。
3. 在右侧面板查看输出，并在底部输入框发送内容。


### 场景四：从下载结果一键打开生成的 Markdown

**什么时候用：** 字幕下载完成后，终端输出了生成的 `.md` 文件路径或 Obsidian 链接。

1. 使用内嵌面板运行脚本。
2. 等脚本输出下载结果。
3. 如果输出中包含 `obsidian://open?...`、`file:///...` 或 vault 内的 `.md` 路径，面板会显示为可点击链接。
4. 同时，路径会被收集到 **Generated Markdown files** 结果区。
5. 如果终端输出只显示文件名，插件会在脚本结束后读取 `11-subtitles/_download_report_*.csv` 的 `filepath` 列，把真实 Markdown 文件补进结果区。
6. 点击结果区里的文件名，或点击 **Open latest**，插件会优先调用 Obsidian 的 `openLinkText()` 在当前 vault 中打开对应笔记。
7. If the result panel is empty, click **Refresh current** to read the current run/latest report; click **Refresh 24h** to scan CSV reports from the last 24 hours.

---

## 6. 技术栈 / 工具链 / 依赖库

| 层级 | 技术 |
|------|------|
| 插件平台 | Obsidian Community Plugin API |
| 运行环境 | Obsidian Desktop / Electron / Node.js |
| 脚本语言 | JavaScript |
| 终端启动 | Windows `.cmd` + Electron `shell.openPath()` |
| 进程交互 | Node `child_process.spawn`（内嵌面板备用） |

| 工具 | 用途 |
|------|------|
| PowerShell / cmd | 打开真实可交互终端窗口 |
| Python | 运行目标脚本 |
| Obsidian 设置页 | 保存用户自定义路径 |

| 依赖库 | 说明 |
|--------|------|
| 无第三方 npm 依赖 | 当前版本使用 Obsidian/Electron/Node 内置能力 |

---

## 7. 文件结构

```text
obsidian-terminal-markdown-bridge/
├── manifest.json       # Obsidian 插件清单
├── main.js             # 插件主逻辑：图标、命令、终端启动、设置页
├── styles.css          # 内嵌面板样式
├── data.example.json   # 本地配置示例
├── README.md           # 使用说明
├── DEV_LOG.md          # 开发日志与设计决策
└── .gitignore          # 排除本机 data.json 等私有配置
```

---

## 8. 常见问题

### Q: 点击后提示“已打开终端”，但没有窗口？

**A:** 早期版本直接用 `spawn('powershell.exe')`，在 Obsidian/Electron 里可能不会弹出可见窗口。当前版本改为生成 `.cmd` 文件，再用 `shell.openPath()` 打开，等价于双击启动脚本，稳定性更好。

### Q: 为什么不用完全内嵌终端？

**A:** 真正内嵌终端通常需要 `xterm.js + node-pty`。`node-pty` 是原生模块，Windows 和 Obsidian Electron 版本会带来编译、ABI、分发问题。当前项目优先保证真实交互可用，所以默认使用外部终端。

### Q: 内嵌面板能不能用？

**A:** 可以，但它更像“伪终端”：能显示输出、发送输入，不保证完整支持方向键、Ctrl+C、全屏 TUI、动态刷新等终端特性。

### Q: 我的 Python 路径和项目路径会上传到 GitHub 吗？

**A:** 不会。个人配置保存在 `data.json`，已被 `.gitignore` 排除。仓库里只提供 `data.example.json`。

---

## 9. 未来开发路线图 (Roadmap)

**当前状态：** 稳定可用的本地插件，适合 Windows + Obsidian + Python CLI 工作流。

### 近期（下个版本）

- 增加终端类型选择 —— 支持 PowerShell、cmd、Windows Terminal，解决不同用户默认终端不一致的问题。
- 增加运行前路径检查 —— 如果 Python 或脚本不存在，提前弹出清晰错误，而不是等终端报错。
- 增加快速配置向导 —— 第一次启用插件时引导填写 Python 路径、项目目录、脚本路径。

### 中期（未来 3-6 个月）

- 支持多个脚本配置 —— 一个插件管理多个常用 Python 工具，避免为每个脚本复制插件。
- 增加运行历史 —— 记录最近运行的命令、退出码、时间，方便排查自动化任务。
- 优化内嵌面板 —— 改进输入发送、输出滚动、ANSI 颜色显示，让轻量交互更舒服。

### 长期愿景

成为 Obsidian 和本地自动化脚本之间的通用桥接器：不只服务 `video-sub-md`，也能用于任何需要从笔记工作流中启动的 CLI 工具。

### 如何参与

- 有需求：提交 Issue，并说明你的系统、Obsidian 版本、希望运行的命令。
- 想贡献：优先从终端类型选择、路径校验、设置页体验改进入手。

---

## 10. 更新日志

### v1.0.0

- 新增左侧 ribbon 图标：打开项目终端。
- 新增左侧 ribbon 图标：运行配置好的 Python 脚本。
- 新增内嵌输出面板作为备用运行方式。
- 新增设置页：配置 Python 路径、项目目录、脚本路径。
- 使用 `.cmd + shell.openPath()` 打开真实可见的交互终端。
