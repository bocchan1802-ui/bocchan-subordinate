// ぼっちゃんの部下管理UI - アプリケーション

class DashboardApp {
  constructor() {
    this.state = {
      isOnline: true,
      tasks: [],
      completedTasks: 0,
      ttsCount: 0,
      cpuUsage: 0,
      memUsage: 0,
      aivisConnected: false,
      settings: {
        autoVoice: true,
        debugMode: false,
        voiceSpeed: 1.0
      }
    };

    this.initElements();
    this.initEventListeners();
    this.startStatusUpdates();
    this.checkAivisConnection();
  }

  initElements() {
    this.statusDot = document.getElementById('statusDot');
    this.statusText = document.getElementById('statusText');
    this.taskLog = document.getElementById('taskLog');
    this.commandInput = document.getElementById('commandInput');
    this.sendBtn = document.getElementById('sendCommand');
    this.quickBtns = document.querySelectorAll('.quick-btn');
    this.cpuUsage = document.getElementById('cpuUsage');
    this.cpuValue = document.getElementById('cpuValue');
    this.memUsage = document.getElementById('memUsage');
    this.memValue = document.getElementById('memValue');
    this.aivisStatus = document.getElementById('aivisStatus');
    this.autoVoice = document.getElementById('autoVoice');
    this.debugMode = document.getElementById('debugMode');
    this.voiceSpeed = document.getElementById('voiceSpeed');
  }

  initEventListeners() {
    // 送信ボタン
    this.sendBtn.addEventListener('click', () => this.sendCommand());

    // エンターキー
    this.commandInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.sendCommand();
      }
    });

    // クイックコマンド
    this.quickBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const cmd = btn.dataset.cmd;
        this.executeQuickCommand(cmd);
      });
    });

    // 設定変更
    this.autoVoice.addEventListener('change', (e) => {
      this.state.settings.autoVoice = e.target.checked;
      this.addLog('info', `音声応答: ${e.target.checked ? '有効' : '無効'}`);
    });

    this.debugMode.addEventListener('change', (e) => {
      this.state.settings.debugMode = e.target.checked;
      this.addLog('info', `デバッグモード: ${e.target.checked ? '有効' : '無効'}`);
    });

    this.voiceSpeed.addEventListener('change', (e) => {
      this.state.settings.voiceSpeed = parseFloat(e.target.value);
      this.addLog('info', `音声速度: ${e.target.value}`);
    });
  }

  async sendCommand() {
    const command = this.commandInput.value.trim();
    if (!command) return;

    this.commandInput.value = '';
    this.addLog('info', `命令受信: ${command}`);

    // コマンド実行
    await this.executeCommand(command);
  }

  async executeCommand(command) {
    this.setProcessing(true);

    try {
      if (command.startsWith('/')) {
        // スラッシュコマンド
        const response = await this.handleSlashCommand(command);
        this.addLog('success', response);
      } else {
        // 自然言語コマンド
        const response = await this.handleNaturalCommand(command);
        this.addLog('success', response);
      }

      // 音声応答
      if (this.state.settings.autoVoice && this.state.aivisConnected) {
        await this.speakResponse(command);
      }
    } catch (error) {
      this.addLog('error', `エラー: ${error.message}`);
    } finally {
      this.setProcessing(false);
    }
  }

  async handleSlashCommand(command) {
    const parts = command.split(' ');
    const cmd = parts[0];

    switch (cmd) {
      case '/status':
        return `ステータス: オンライン | タスク: ${this.state.tasks.length} | 音声合成: ${this.state.ttsCount}`;

      case '/tasks':
        return this.state.tasks.length > 0
          ? `タスク一覧: ${this.state.tasks.map(t => t.name).join(', ')}`
          : '現在実行中のタスクはありません';

      case '/clear':
        this.taskLog.innerHTML = '';
        return 'ログを消去しました';

      case '/voice':
        if (parts[1] === 'test') {
          await this.speakResponse('テストメッセージです。マスター、聞こえますか？');
          return '音声テストを実行しました';
        }
        return 'Usage: /voice test';

      default:
        return `未知のコマンド: ${cmd}`;
    }
  }

  async handleNaturalCommand(command) {
    // タスクを追加
    const task = {
      id: Date.now(),
      name: command,
      status: 'processing'
    };
    this.state.tasks.push(task);
    this.updateStats();

    // コマンドに応じた応答
    const response = await this.generateResponse(command);

    // タスク完了
    task.status = 'completed';
    this.state.completedTasks++;
    this.state.tasks = this.state.tasks.filter(t => t.id !== task.id);
    this.updateStats();

    return response;
  }

  async generateResponse(command) {
    // 簡易的な応答生成（実際はco-vibeと連携）
    const responses = [
      `了解しました、マスター！「${command}」を実行します`,
      `仰せのままに、マスター！`,
      `かしこまりました！すぐに着手します`,
      `わかりました！パロスケがやりますよ！`
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  }

  async speakResponse(text) {
    try {
      this.state.ttsCount++;
      document.getElementById('korosukeTtsCount').textContent = this.state.ttsCount;

      // Aivis Speech API呼び出し
      const encoded = encodeURIComponent(text);
      const queryResponse = await fetch(`http://localhost:10101/audio_query?text=${encoded}&speaker=488039072`, {
        method: 'POST'
      });

      if (!queryResponse.ok) throw new Error('Aivis Speech query failed');

      const query = await queryResponse.json();
      query.speedScale = this.state.settings.voiceSpeed;

      const synthResponse = await fetch('http://localhost:10101/synthesis?speaker=488039072', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query)
      });

      if (!synthResponse.ok) throw new Error('Aivis Speech synthesis failed');

      const blob = await synthResponse.blob();
      const audio = new Audio(URL.createObjectURL(blob));
      audio.play();

      this.addLog('info', `音声合成: "${text}"`);
    } catch (error) {
      this.addLog('error', `音声合成エラー: ${error.message}`);
    }
  }

  executeQuickCommand(cmd) {
    this.commandInput.value = cmd;
    this.sendCommand();
  }

  addLog(type, message) {
    const now = new Date();
    const time = now.toLocaleTimeString('ja-JP', { hour12: false });

    const logItem = document.createElement('div');
    logItem.className = `log-item ${type}`;
    logItem.innerHTML = `
      <span class="log-time">${time}</span>
      <span class="log-message">${this.escapeHtml(message)}</span>
    `;

    this.taskLog.appendChild(logItem);
    this.taskLog.scrollTop = this.taskLog.scrollHeight;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  setProcessing(processing) {
    if (processing) {
      this.sendBtn.disabled = true;
      this.statusText.textContent = '処理中...';
      this.statusDot.classList.add('standby');
    } else {
      this.sendBtn.disabled = false;
      this.statusText.textContent = '待機中';
      this.statusDot.classList.remove('standby');
    }
  }

  updateStats() {
    document.getElementById('korosukeTasks').textContent = this.state.tasks.length;
    document.getElementById('korosukeCompleted').textContent = this.state.completedTasks;
    document.getElementById('totalTasks').textContent = this.state.completedTasks;
  }

  async checkAivisConnection() {
    try {
      const response = await fetch('http://localhost:10101/speakers');
      if (response.ok) {
        this.state.aivisConnected = true;
        this.aivisStatus.querySelector('.status-dot').style.background = 'var(--success)';
        this.aivisStatus.querySelector('.status-text').textContent = '接続中';
        this.addLog('success', 'Aivis Speechに接続しました');
      }
    } catch (error) {
      this.state.aivisConnected = false;
      this.aivisStatus.querySelector('.status-dot').style.background = 'var(--danger)';
      this.aivisStatus.querySelector('.status-text').textContent = '切断';
      this.addLog('error', 'Aivis Speechに接続できません');
    }
  }

  startStatusUpdates() {
    // システムステータス更新（ダミー）
    setInterval(() => {
      this.cpuUsage = Math.min(100, this.cpuUsage + Math.random() * 20 - 10);
      this.memUsage = Math.min(100, this.memUsage + Math.random() * 10 - 5);

      this.cpuUsage = Math.max(0, Math.min(100, this.cpuUsage));
      this.memUsage = Math.max(0, Math.min(100, this.memUsage));

      this.cpuUsage.style.width = `${this.cpuUsage}%`;
      this.cpuValue.textContent = `${Math.round(this.cpuUsage)}%`;
      this.memUsage.style.width = `${this.memUsage}%`;
      this.memValue.textContent = `${Math.round(this.memUsage)}%`;
    }, 2000);
  }
}

// アプリ起動
document.addEventListener('DOMContentLoaded', () => {
  new DashboardApp();
});
