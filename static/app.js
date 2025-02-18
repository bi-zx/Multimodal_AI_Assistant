let video = document.getElementById('videoElement');
let canvas = document.getElementById('canvasElement');
let captionText = document.getElementById('captionText');
let responseContainer = document.getElementById('responseContainer');
let startButton = document.getElementById('startButton');
let stopButton = document.getElementById('stopButton');
let speechText = document.getElementById('speechText');

// 初始化摄像头
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
                fetch('/process_image', {
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

function initSpeechRecognition() {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'zh-CN';

    recognition.onresult = (event) => {
        const text = event.results[event.results.length - 1][0].transcript;
        speechText.textContent = `语音输入: ${text}`;

        // 只在语音识别结果为最终结果时发送到后端
        if (event.results[event.results.length - 1].isFinal) {
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
                    responseContainer.innerHTML = '';
                    const responseDiv = document.createElement('div');
                    responseDiv.className = 'text-center';
                    responseDiv.textContent = data.response;
                    responseContainer.appendChild(responseDiv);
                });
        }
    };

    recognition.onend = () => {
        // 自动重新开始识别
        recognition.start();
    };

    recognition.onerror = (event) => {
        console.error('语音识别错误:', event.error);
        // 错误发生时重新启动识别
        recognition.abort();
        recognition.start();
    };
}

// 修改开始/停止按钮功能
startButton.onclick = () => {
    recognition.start();
    startButton.disabled = true;
    stopButton.disabled = false;
};

stopButton.onclick = () => {
    recognition.abort();
    startButton.disabled = false;
    stopButton.disabled = true;
    speechText.textContent = '语音识别已停止';
};

// 初始化
initCamera();
startImageCapture();
initSpeechRecognition(); 