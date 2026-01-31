export default class LogPanel {
    constructor(containerId, maxLogs = 50) {
        this.containerId = containerId;
        this.maxLogs = maxLogs;
        this.render();
        this.logContainer = document.getElementById('log');
    }

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        container.innerHTML = `
            <h3>📝 인식 로그</h3>
            <div id="log" class="log-container"></div>
            <button onclick="document.getElementById('log').innerHTML=''" 
                style="margin-top:5px;width:100%;padding:5px;background:#444;border:none;color:white;cursor:pointer">
                로그 지우기
            </button>
        `;
    }

    log(msg) {
        if (!this.logContainer) return;

        const div = document.createElement('div');
        const time = new Date().toLocaleTimeString();
        div.textContent = `[${time}] ${msg}`;
        div.style.borderBottom = '1px solid #333';
        div.style.padding = '2px 0';

        this.logContainer.insertBefore(div, this.logContainer.firstChild);

        if (this.logContainer.children.length > this.maxLogs) {
            this.logContainer.removeChild(this.logContainer.lastChild);
        }
    }

    clear() {
        if (this.logContainer) this.logContainer.innerHTML = '';
    }
}
