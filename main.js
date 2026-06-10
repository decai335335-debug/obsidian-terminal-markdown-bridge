
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
  getDisplayText() { return 'video-sub-md inline terminal'; }
  getIcon() { return 'panel-right'; }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('video-sub-md-view');

    const toolbar = container.createDiv({ cls: 'video-sub-md-toolbar' });
    toolbar.createEl('button', { text: 'Run inline' }, (btn) => btn.addEventListener('click', () => this.runScript()));
    toolbar.createEl('button', { text: 'Stop' }, (btn) => btn.addEventListener('click', () => this.stopScript()));
    toolbar.createEl('button', { text: 'Blank line' }, (btn) => btn.addEventListener('click', () => this.sendText('')));
    toolbar.createEl('button', { text: 'Clear' }, (btn) => btn.addEventListener('click', () => this.clearOutput()));

    this.statusEl = toolbar.createSpan({ cls: 'video-sub-md-status', text: 'Ready' });
    container.createDiv({
      cls: 'video-sub-md-hint',
      text: 'Inline pseudo terminal: type in the box below. Enter sends input, Shift+Enter inserts a new line. Use external terminal for full TTY behavior.'
    });

    this.outputEl = container.createEl('pre', { cls: 'video-sub-md-output' });
    this.outputEl.addEventListener('click', () => this.focusInput());

    const inputWrap = container.createDiv({ cls: 'video-sub-md-input-wrap' });
    this.inputEl = inputWrap.createEl('textarea', {
      cls: 'video-sub-md-input',
      attr: { placeholder: 'Paste a link or type an answer here, then press Enter to send...' }
    });
    inputWrap.createEl('button', { text: 'Send' }, (btn) => btn.addEventListener('click', () => this.sendInput()));

    this.inputEl.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.sendInput();
      }
    });

    this.focusInput();
  }

  async onClose() {
    this.stopScript();
  }

  focusInput() {
    if (!this.inputEl) return;
    window.setTimeout(() => this.inputEl.focus(), 0);
  }

  append(text, cls) {
    if (!this.outputEl) return;
    const chunks = this.parseOutputChunks(text);
    for (const chunk of chunks) {
      if (chunk.type === 'link') {
        const link = document.createElement('a');
        link.href = '#';
        link.className = cls ? `${cls} video-sub-md-link` : 'video-sub-md-link';
        link.textContent = this.plugin.settings.stripAnsi ? stripAnsi(chunk.label) : chunk.label;
        link.title = chunk.href;
        link.addEventListener('click', (event) => {
          event.preventDefault();
          this.plugin.openOutputTarget(chunk.href, chunk.label);
        });
        this.outputEl.appendChild(link);
      } else {
        const span = document.createElement('span');
        if (cls) span.className = cls;
        span.textContent = this.plugin.settings.stripAnsi ? stripAnsi(chunk.text) : chunk.text;
        this.outputEl.appendChild(span);
      }
    }
    this.outputEl.scrollTop = this.outputEl.scrollHeight;
  }

  parseOutputChunks(text) {
    const chunks = [];
    const osc8 = /\x1b\]8;;([^\x1b]+)\x1b\\([\s\S]*?)\x1b\]8;;\x1b\\/g;
    let last = 0;
    let match;
    while ((match = osc8.exec(text)) !== null) {
      if (match.index > last) {
        chunks.push(...this.parsePlainOutputLinks(text.slice(last, match.index)));
      }
      chunks.push({ type: 'link', href: match[1], label: match[2] || match[1] });
      last = match.index + match[0].length;
    }
    if (last < text.length) {
      chunks.push(...this.parsePlainOutputLinks(text.slice(last)));
    }
    return chunks;
  }

  parsePlainOutputLinks(text) {
    const chunks = [];
    const linkPattern = /(obsidian:\/\/open\?[^\s\]\)]+|file:\/\/\/[^\s\]\)]+|[A-Za-z]:[\\\/][^\r\n<>|?*"']+?\.md)/g;
    let last = 0;
    let match;
    while ((match = linkPattern.exec(text)) !== null) {
      if (match.index > last) chunks.push({ type: 'text', text: text.slice(last, match.index) });
      const raw = match[1].replace(/[.,;，。；]+$/, '');
      const trailing = match[1].slice(raw.length);
      chunks.push({ type: 'link', href: raw, label: raw });
      if (trailing) chunks.push({ type: 'text', text: trailing });
      last = match.index + match[1].length;
    }
    if (last < text.length) chunks.push({ type: 'text', text: text.slice(last) });
    return chunks;
  }

  setStatus(text) {
    if (this.statusEl) this.statusEl.setText(text);
  }

  clearOutput() {
    if (this.outputEl) this.outputEl.empty();
    this.focusInput();
  }

  runScript() {
    if (this.proc) {
      new Notice('video-sub-md is already running');
      this.focusInput();
      return;
    }

    const settings = this.plugin.settings;
    const args = ['-u', settings.scriptPath];
    this.append(`\n$ "${settings.pythonPath}" -u "${settings.scriptPath}"\n`, 'video-sub-md-command');
    this.setStatus('Running');

    try {
      this.proc = spawn(settings.pythonPath, args, {
        cwd: settings.projectDir || undefined,
        windowsHide: true,
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
          PYTHONUTF8: '1',
          PYTHONUNBUFFERED: '1'
        }
      });
      this.proc.stdin.setDefaultEncoding('utf8');
    } catch (error) {
      this.append(`[start failed] ${error.message}\n`, 'video-sub-md-error');
      this.proc = null;
      this.setStatus('Start failed');
      this.focusInput();
      return;
    }

    this.proc.stdout.on('data', (data) => this.append(data.toString('utf8')));
    this.proc.stderr.on('data', (data) => this.append(data.toString('utf8'), 'video-sub-md-error'));
    this.proc.on('error', (error) => {
      this.append(`[process error] ${error.message}\n`, 'video-sub-md-error');
      this.setStatus('Error');
      this.focusInput();
    });
    this.proc.on('close', (code) => {
      this.append(`\n[process exited] code ${code}\n`, code === 0 ? 'video-sub-md-ok' : 'video-sub-md-error');
      this.proc = null;
      this.setStatus('Exited');
      this.focusInput();
    });

    this.focusInput();
  }

  stopScript() {
    if (!this.proc) {
      this.focusInput();
      return;
    }
    this.proc.kill();
    this.proc = null;
    this.setStatus('Stopped');
    this.append('\n[stop signal sent]\n', 'video-sub-md-error');
    this.focusInput();
  }

  sendInput() {
    if (!this.inputEl) return;
    const text = this.inputEl.value;
    this.inputEl.value = '';
    this.sendText(text);
  }

  sendText(text) {
    if (!this.proc || !this.proc.stdin || this.proc.stdin.destroyed) {
      new Notice('Script is not running');
      this.focusInput();
      return;
    }
    const normalized = String(text).replace(/\r?\n/g, os.EOL);
    this.append(`> ${text || '[blank line]'}\n`, 'video-sub-md-user-input');
    this.proc.stdin.write(normalized + os.EOL);
    this.focusInput();
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
      .setName('Python path')
      .addText((text) => text
        .setValue(this.plugin.settings.pythonPath)
        .onChange(async (value) => {
          this.plugin.settings.pythonPath = value.trim();
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Project directory')
      .addText((text) => text
        .setValue(this.plugin.settings.projectDir)
        .onChange(async (value) => {
          this.plugin.settings.projectDir = value.trim();
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Script path')
      .addText((text) => text
        .setValue(this.plugin.settings.scriptPath)
        .onChange(async (value) => {
          this.plugin.settings.scriptPath = value.trim();
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Strip ANSI control codes')
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

    this.addRibbonIcon('terminal-square', 'Open video-sub-md terminal', () => this.openProjectTerminal());
    this.addRibbonIcon('file-terminal', 'Run video-sub-md main.py', () => this.runExternalTerminal());
    this.addRibbonIcon('panel-right', 'Run video-sub-md inline', async () => {
      const view = await this.activateView();
      view.runScript();
    });

    this.addCommand({
      id: 'open-video-sub-md-terminal',
      name: 'Open video-sub-md project terminal',
      callback: () => this.openProjectTerminal()
    });

    this.addCommand({
      id: 'run-video-sub-md-external',
      name: 'Run video-sub-md script (external terminal)',
      callback: () => this.runExternalTerminal()
    });

    this.addCommand({
      id: 'run-video-sub-md-inline',
      name: 'Run video-sub-md script (inline panel)',
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
    const cmd = `@echo off\r\nchcp 65001 > nul\r\ncd /d "${project}"\r\necho video-sub-md project terminal: ${project}\r\necho.\r\ncmd /k\r\n`;
    this.openCmdFile(cmd, 'video-sub-md-terminal.cmd', 'Opened interactive project terminal');
  }

  runExternalTerminal() {
    const project = this.settings.projectDir;
    const python = this.settings.pythonPath;
    const scriptPath = this.settings.scriptPath;
    const cmd = `@echo off\r\nchcp 65001 > nul\r\ncd /d "${project}"\r\n"${python}" "${scriptPath}"\r\necho.\r\npause\r\n`;
    this.openCmdFile(cmd, 'video-sub-md-run.cmd', 'Opened interactive terminal and started main.py');
  }

  async openCmdFile(cmdContent, fileName, successMessage) {
    try {
      const cmdFile = path.join(os.tmpdir(), fileName);
      fs.writeFileSync(cmdFile, cmdContent, 'utf8');
      const error = await shell.openPath(cmdFile);
      if (error) {
        new Notice(`Open terminal failed: ${error}`);
        console.error(error);
        return;
      }
      new Notice(successMessage);
    } catch (error) {
      new Notice(`Open terminal failed: ${error.message}`);
      console.error(error);
    }
  }

  async openOutputTarget(href, label) {
    try {
      if (href.startsWith('obsidian://open')) {
        const url = new URL(href);
        const file = url.searchParams.get('file');
        if (file) {
          await this.openVaultPath(decodeURIComponent(file));
          return;
        }
      }

      if (/^[A-Za-z]:[\\/]/.test(href)) {
        const opened = await this.openAbsoluteMarkdownPath(href);
        if (opened) return;
      }

      if (href.startsWith('file:///')) {
        const filePath = decodeURIComponent(href.replace(/^file:\/\/\//, '')).replace(/\//g, '\\');
        const opened = await this.openAbsoluteMarkdownPath(filePath);
        if (opened) return;
      }

      await shell.openExternal(href);
    } catch (error) {
      new Notice(`Open link failed: ${error.message}`);
      console.error(error);
    }
  }

  async openAbsoluteMarkdownPath(filePath) {
    const normalizedFile = filePath.replace(/\\/g, '/');
    const adapter = this.app.vault.adapter;
    const basePath = adapter && adapter.basePath ? adapter.basePath.replace(/\\/g, '/') : '';
    if (basePath && normalizedFile.toLowerCase().startsWith(basePath.toLowerCase() + '/')) {
      let relPath = normalizedFile.slice(basePath.length + 1);
      await this.openVaultPath(relPath);
      return true;
    }
    return false;
  }

  async openVaultPath(relPath) {
    let cleanPath = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!cleanPath.toLowerCase().endsWith('.md')) cleanPath += '.md';
    await this.app.workspace.openLinkText(cleanPath, '', false);
    new Notice(`Opened ${cleanPath}`);
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
