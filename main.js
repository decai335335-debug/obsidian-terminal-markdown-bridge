
const { Plugin, ItemView, Notice, PluginSettingTab, Setting } = require('obsidian');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { shell } = require('electron');

const VIEW_TYPE = 'video-sub-md-runner-view';

const DEFAULT_SETTINGS = {
  pythonPath: 'python',
  projectDir: '',
  scriptPath: 'main.py',
  stripAnsi: true
};

function stripAnsi(text) {
  return text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
}

function psQuote(value) {
  return String(value).replace(/'/g, "''");
}

class VideoSubMdView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.proc = null;
    this.outputEl = null;
    this.inputEl = null;
    this.statusEl = null;
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return 'video-sub-md 终端'; }
  getIcon() { return 'file-terminal'; }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('video-sub-md-view');

    const toolbar = container.createDiv({ cls: 'video-sub-md-toolbar' });
    toolbar.createEl('button', { text: '内嵌运行' }, (btn) => btn.addEventListener('click', () => this.runScript()));
    toolbar.createEl('button', { text: '停止' }, (btn) => btn.addEventListener('click', () => this.stopScript()));
    toolbar.createEl('button', { text: '清空' }, (btn) => btn.addEventListener('click', () => this.clearOutput()));

    this.statusEl = toolbar.createSpan({ cls: 'video-sub-md-status', text: '就绪' });
    this.outputEl = container.createEl('pre', { cls: 'video-sub-md-output' });

    const inputRow = container.createDiv({ cls: 'video-sub-md-input-row' });
    this.inputEl = inputRow.createEl('textarea', {
      cls: 'video-sub-md-input',
      attr: { placeholder: '输入内容；Enter 发送，Shift+Enter 换行' }
    });
    inputRow.createEl('button', { text: '发送' }, (btn) => btn.addEventListener('click', () => this.sendInput()));

    this.inputEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.sendInput();
      }
    });
  }

  async onClose() {
    this.stopScript();
  }

  append(text, cls) {
    if (!this.outputEl) return;
    const value = this.plugin.settings.stripAnsi ? stripAnsi(text) : text;
    const span = document.createElement('span');
    if (cls) span.className = cls;
    span.textContent = value;
    this.outputEl.appendChild(span);
    this.outputEl.scrollTop = this.outputEl.scrollHeight;
  }

  setStatus(text) {
    if (this.statusEl) this.statusEl.setText(text);
  }

  clearOutput() {
    if (this.outputEl) this.outputEl.empty();
  }

  runScript() {
    if (this.proc) {
      new Notice('video-sub-md 正在运行');
      return;
    }

    const settings = this.plugin.settings;
    this.append(`\n$ "${settings.pythonPath}" "${settings.scriptPath}"\n`, 'video-sub-md-command');
    this.setStatus('运行中');

    try {
      this.proc = spawn(settings.pythonPath, [settings.scriptPath], {
        cwd: settings.projectDir,
        windowsHide: true,
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1'
        }
      });
    } catch (error) {
      this.append(`[启动失败] ${error.message}\n`, 'video-sub-md-error');
      this.proc = null;
      this.setStatus('启动失败');
      return;
    }

    this.proc.stdout.on('data', (data) => this.append(data.toString('utf8')));
    this.proc.stderr.on('data', (data) => this.append(data.toString('utf8'), 'video-sub-md-error'));
    this.proc.on('error', (error) => {
      this.append(`[进程错误] ${error.message}\n`, 'video-sub-md-error');
      this.setStatus('错误');
    });
    this.proc.on('close', (code) => {
      this.append(`\n[进程结束] exit code ${code}\n`, code === 0 ? 'video-sub-md-ok' : 'video-sub-md-error');
      this.proc = null;
      this.setStatus('已结束');
    });
  }

  stopScript() {
    if (!this.proc) return;
    this.proc.kill();
    this.proc = null;
    this.setStatus('已停止');
    this.append('\n[已发送停止信号]\n', 'video-sub-md-error');
  }

  sendInput() {
    if (!this.proc || !this.proc.stdin || this.proc.stdin.destroyed) {
      new Notice('脚本未运行');
      return;
    }
    const text = this.inputEl.value;
    this.inputEl.value = '';
    this.append(`> ${text}\n`, 'video-sub-md-user-input');
    this.proc.stdin.write(text + os.EOL);
  }
}

class VideoSubMdSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Video Sub MD Runner' });

    new Setting(containerEl)
      .setName('Python 路径')
      .addText((text) => text
        .setValue(this.plugin.settings.pythonPath)
        .onChange(async (value) => {
          this.plugin.settings.pythonPath = value.trim();
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('项目目录')
      .addText((text) => text
        .setValue(this.plugin.settings.projectDir)
        .onChange(async (value) => {
          this.plugin.settings.projectDir = value.trim();
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('脚本路径')
      .addText((text) => text
        .setValue(this.plugin.settings.scriptPath)
        .onChange(async (value) => {
          this.plugin.settings.scriptPath = value.trim();
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('隐藏 ANSI 控制符')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.stripAnsi)
        .onChange(async (value) => {
          this.plugin.settings.stripAnsi = value;
          await this.plugin.saveSettings();
        }));
  }
}

module.exports = class VideoSubMdRunnerPlugin extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

    this.registerView(VIEW_TYPE, (leaf) => new VideoSubMdView(leaf, this));

    this.addRibbonIcon('terminal-square', '打开 video-sub-md 终端', () => this.openProjectTerminal());
    this.addRibbonIcon('file-terminal', '运行 video-sub-md main.py', () => this.runExternalTerminal());

    this.addCommand({
      id: 'open-video-sub-md-terminal',
      name: '打开 video-sub-md 项目终端',
      callback: () => this.openProjectTerminal()
    });

    this.addCommand({
      id: 'run-video-sub-md-external',
      name: '运行 video-sub-md 脚本（外部终端）',
      callback: () => this.runExternalTerminal()
    });

    this.addCommand({
      id: 'run-video-sub-md-inline',
      name: '运行 video-sub-md 脚本（内嵌面板）',
      callback: async () => {
        const view = await this.activateView();
        view.runScript();
      }
    });

    this.addSettingTab(new VideoSubMdSettingTab(this.app, this));
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  openProjectTerminal() {
    const project = this.settings.projectDir;
    const cmd = `@echo off\r\nchcp 65001 > nul\r\ncd /d "${project}"\r\necho video-sub-md 项目终端已打开：${project}\r\necho.\r\ncmd /k\r\n`;
    this.openCmdFile(cmd, 'video-sub-md-terminal.cmd', '已打开可交互项目终端');
  }

  runExternalTerminal() {
    const project = this.settings.projectDir;
    const python = this.settings.pythonPath;
    const scriptPath = this.settings.scriptPath;
    const cmd = `@echo off\r\nchcp 65001 > nul\r\ncd /d "${project}"\r\n"${python}" "${scriptPath}"\r\necho.\r\npause\r\n`;
    this.openCmdFile(cmd, 'video-sub-md-run.cmd', '已打开可交互终端并启动 main.py');
  }

  async openCmdFile(cmdContent, fileName, successMessage) {
    try {
      const cmdFile = path.join(os.tmpdir(), fileName);
      fs.writeFileSync(cmdFile, cmdContent, 'utf8');
      const error = await shell.openPath(cmdFile);
      if (error) {
        new Notice(`打开终端失败：${error}`);
        console.error(error);
        return;
      }
      new Notice(successMessage);
    } catch (error) {
      new Notice(`打开终端失败：${error.message}`);
      console.error(error);
    }
  }

  async activateView() {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false);
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    this.app.workspace.revealLeaf(leaf);
    return leaf.view;
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
};
