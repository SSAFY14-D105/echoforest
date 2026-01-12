// Web Speech API Configuration
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = 'ko-KR'; // 한국어 설정
recognition.continuous = true; // 계속 듣기 모드
recognition.interimResults = true; // [중요] 중간 결과도 받기 (반응 속도 향상 핵심)
recognition.maxAlternatives = 1;

// DOM Elements
const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const statusIndicator = document.getElementById('status-indicator');
const vadIndicator = document.getElementById('vad-indicator');
const logOutput = document.getElementById('log-output');

let isListening = false;
let lastTriggerTime = 0; // 중복 실행 방지용 (Debounce)

// Initialize
function init() {
    statusIndicator.innerText = "✅ Web Speech API 준비 완료 (Chrome)";
    vadIndicator.innerText = "대기 중";
}

// Event Handlers
recognition.onstart = () => {
    isListening = true;
    statusIndicator.innerText = "🗣️ 듣는 중... (Web Speech API)";
    vadIndicator.classList.remove('vad-idle');
    vadIndicator.classList.add('vad-active');
    vadIndicator.innerText = "ON AIR";
    btnStart.disabled = true;
    btnStop.disabled = false;
};

// VAD: 말이 끝났을 때 브라우저가 이벤트를 발생시킴
recognition.onspeechend = () => {
    // speechEndTime = performance.now(); // interimResults 사용 시 이 값은 정확도가 떨어지므로 사용하지 않음
    vadIndicator.innerText = "⏳ 처리 중...";
    // 주의: continuous 모드에서는 이 이벤트가 발화 "중간"마다 안 찍힐 수도 있음 (브라우저 구현 따름)
    console.log("Speech End Detected");
};

recognition.onend = () => {
    isListening = false;
    statusIndicator.innerText = "🛑 중지됨";
    vadIndicator.classList.remove('vad-active');
    vadIndicator.classList.add('vad-idle');
    vadIndicator.innerText = "OFF";
    btnStart.disabled = false;
    btnStop.disabled = true;

    // 의도치 않게 꺼지면 자동 재시작 (옵션)
    // recognition.start(); 
};

recognition.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
        } else {
            interimTranscript += event.results[i][0].transcript;
        }
    }

    // [핵심] 완성되지 않은 문장(interim)이라도 키워드가 있으면 즉시 실행!
    // 이것이 "말하자마자 반응하는" 게임의 비결입니다.
    const combinedText = finalTranscript + interimTranscript;

    // 로그에는 계속 업데이트 (디버깅용)
    if (combinedText.trim().length > 0) {
        // 너무 자주 찍히면 정신없으니 console.log만 하거나, 마지막 결과만 UI 업데이트
        // 여기선 키워드 체크가 우선
        // addLog(combinedText, `Interim: ${interimTranscript.length > 0 ? 'Yes' : 'No'}`); // 디버깅용
    }

    checkKeywords(combinedText);

    // 최종 결과만 로그에 추가 (UI 업데이트는 최종 결과로)
    if (finalTranscript.length > 0) {
        addLog(finalTranscript, `Conf: ${(event.results[event.resultIndex][0].confidence * 100).toFixed(0)}%`);
    }
};

recognition.onerror = (event) => {
    console.error("Speech Error:", event.error);
    statusIndicator.innerText = "❌ 에러: " + event.error;
    if (event.error === 'not-allowed') {
        alert("마이크 권한이 거부되었습니다.");
    }
};

// Keyword Detection
function checkKeywords(text) {
    const t = text.trim();
    const now = Date.now();

    // 중복 실행 방지 (1초 쿨타임)
    if (now - lastTriggerTime < 1000) return;

    if (t.includes("뽀뽀") || t.includes("최고")) {
        highlightEffect("BUFF ACTIVATED! 💖 (Instant)");
        lastTriggerTime = now;
    } else if (t.includes("사랑")) {
        highlightEffect("DOUBLE JUMP! ❤️ (Instant)");
        lastTriggerTime = now;
    } else if (t.includes("바보") || t.includes("멍청") || t.includes("망해")) {
        highlightEffect("PENALTY! 😈 (Instant)");
        lastTriggerTime = now;
    }
}

function highlightEffect(msg) {
    console.log(msg);
    // 시각적 효과 (임시)
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.top = '20%';
    toast.style.left = '50%';
    toast.style.transform = 'translate(-50%, -50%)';
    toast.style.padding = '1rem 2rem';
    toast.style.background = 'rgba(0,0,0,0.8)';
    toast.style.color = '#fff';
    toast.style.borderRadius = '10px';
    toast.style.fontSize = '2rem';
    toast.style.zIndex = '9999';
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1000); // 1초 뒤 사라짐
}

function addLog(text, subInfo) {
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.innerHTML = `
        <span class="log-time">[${new Date().toLocaleTimeString()}]</span>
        <span class="log-latency">${subInfo}</span><br>
        <span class="log-text">"${text}"</span>
    `;
    logOutput.prepend(div);
}

// Button Events
btnStart.addEventListener('click', () => recognition.start());
btnStop.addEventListener('click', () => recognition.stop());

init();
