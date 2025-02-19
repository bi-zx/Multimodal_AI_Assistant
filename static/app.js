let video = document.getElementById('videoElement');
let canvas = document.getElementById('canvasElement');
let captionText = document.getElementById('captionText');
let responseContainer = document.getElementById('responseContainer');
let speechText = document.getElementById('speechText');
let startButton = document.getElementById('startButton');
let statusContainer = document.getElementById('statusContainer');

// 添加API调用状态标志
let isProcessing = false;

// 初始化摄像头和图像捕获
async function initCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
    } catch (err) {
        console.error("摄像头访问失败:", err);
    }
}

// 定期捕获图像并发送到服务器
function startImageCapture() {
    setInterval(() => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);

        canvas.toBlob(blob => {
            const reader = new FileReader();
            reader.onloadend = () => {
                fetch('/save_image', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        image: reader.result
                    })
                })
                    .then(response => response.json())
                    .then(data => {
                        captionText.textContent = data.caption;
                    });
            };
            reader.readAsDataURL(blob);
        }, 'image/jpeg');
    }, 1000);
}

// 语音识别相关
let recognition;
let microphoneEnabled = true;

function initSpeechRecognition() {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    // recognition.lang = 'zh-CN,en-US';
    recognition.lang = 'zh-CN';

    recognition.onresult = (event) => {
        if (microphoneEnabled) {
            const text = event.results[event.results.length - 1][0].transcript.trim();
            speechText.textContent = `语音输入: ${text}`;

            if (text && event.results[event.results.length - 1].isFinal && !isProcessing) {
                isProcessing = true;
                updateStatus('正在思考中...');

                fetch('/process_speech', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        speech_text: text
                    })
                })
                    .then(response => response.json())
                    .then(data => {
                        appendResponse(data.response);
                        updateStatus('等待语音输入...');
                        isProcessing = false;
                    })
                    .catch(error => {
                        console.error('API调用错误:', error);
                        updateStatus('处理失败，请重试');
                        isProcessing = false;
                    });
            }
        }
    };

    recognition.onend = () => {
        if (microphoneEnabled) {
            recognition.start();
        }
    };

    recognition.onerror = (event) => {
        console.error('语音识别错误:', event.error);
        if (microphoneEnabled) {
            recognition.abort();
            recognition.start();
        }
    };

    // 自动开始识别
    recognition.start();
}

// 更新状态显示
function updateStatus(text) {
    statusContainer.innerHTML = `<div class="text-center text-muted">${text}</div>`;
}

let currentUtterance = null;

function speakText(text) {
    // Cancel any ongoing speech
    if (currentUtterance) {
        window.speechSynthesis.cancel();
    }

    // Create a new utterance for the new text
    currentUtterance = new SpeechSynthesisUtterance(text);
    currentUtterance.lang = 'zh-CN'; // Set language to Chinese

    // Set pitch and rate for more natural sound
    currentUtterance.pitch = 1.0; // Adjust pitch (0.0 to 2.0)
    currentUtterance.rate = 1.5;  // Increase rate for faster speech

    // Select a more human-like voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(voice => voice.name.includes('Natural') || voice.name.includes('Human'));
    if (preferredVoice) {
        currentUtterance.voice = preferredVoice;
    }

    // Speak the new utterance
    window.speechSynthesis.speak(currentUtterance);
}

// Modify appendResponse function to read the text aloud
function appendResponse(text) {
    const responseDiv = document.createElement('div');
    responseDiv.className = 'text-center';
    responseDiv.textContent = text;
    responseContainer.appendChild(responseDiv);
    responseContainer.scrollTop = responseContainer.scrollHeight;

    // 调用 speakText 函数朗读文本
    speakText(text);
}

// 初始化基本功能
initCamera();
startImageCapture();
initSpeechRecognition();

// 设置麦克风按钮
startButton.onclick = () => {
    microphoneEnabled = !microphoneEnabled;
    startButton.textContent = microphoneEnabled ? '关闭麦克风' : '开启麦克风';
    startButton.className = microphoneEnabled ? 'btn btn-primary' : 'btn btn-danger';
    speechText.textContent = microphoneEnabled ? '等待语音输入...' : '麦克风已关闭';
    updateStatus(microphoneEnabled ? '等待语音输入...' : '麦克风已关闭');

    if (microphoneEnabled) {
        recognition.start();
    } else {
        recognition.stop();
    }
}; 