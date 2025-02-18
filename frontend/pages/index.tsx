import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Mic, MicOff, Trash2, Square, Upload } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import AIChatHistory from '../components/AIChatHistory';

interface LogEntry {
  timestamp: number;
  message: string;
  type: 'info' | 'error' | 'latency' | 'llm';
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'transcript';
  content: string;
  isFinal?: boolean;
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const CodeBlock = ({ node, inline, className, children, ...props }) => {
  const match = /language-(\w+)/.exec(className || '');
  const lang = match ? match[1] : '';

  if (!inline && lang) {
    return (
      <SyntaxHighlighter
        language={lang}
        style={oneDark}
        customStyle={{
          margin: '0.5em 0',
          borderRadius: '0.375rem',
          fontSize: '0.875rem',
        }}
        {...props}
      >
        {String(children).replace(/\n$/, '')}
      </SyntaxHighlighter>
    );
  }

  return <code className={className} {...props}>{children}</code>;
};

const TabButton: React.FC<TabButtonProps> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`flex-1 py-2 text-sm font-medium border-b-2 ${active
      ? 'border-blue-500 text-blue-600'
      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
  >
    {children}
  </button>
);

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const websocketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const echoNodeRef = useRef<AudioWorkletNode | null>(null);
  const audioFormatRef = useRef<any>(null);
  const speechEndTimeRef = useRef<number | null>(null);
  const llmStartTimeRef = useRef<number | null>(null);
  const vadEndTimeRef = useRef<number | null>(null);
  const hasPlaybackLatencyRef = useRef<boolean>(false);
  const vadStartTimeRef = useRef<number | null>(null);
  const audioQueueRef = useRef<Float32Array[]>([]);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const playbackStartTimeRef = useRef<number | null>(null);
  const [finalTranscripts, setFinalTranscripts] = useState<string>('');
  const currentValidMessageIdRef = useRef<string | null>(null);
  const isPlayingRef = useRef<boolean>(false);
  const chatHistoryRef = useRef<HTMLDivElement>(null);
  const logsRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollChatRef = useRef(true);
  const shouldAutoScrollLogsRef = useRef(true);
  const [activeTab, setActiveTab] = useState<'chat' | 'logs'>('chat');
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [vadText, setVadText] = useState<string>('');

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, {
      timestamp: Date.now(),
      message,
      type
    }]);
  };

  const setupWebSocket = () => {
    if (websocketRef.current?.readyState === WebSocket.OPEN) return;

    const wsUrl = `ws://localhost:8848`;
    console.log('Connecting to WebSocket:', wsUrl);

    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      console.log('WebSocket connected');
      websocketRef.current = ws;
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      websocketRef.current = null;
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      websocketRef.current = null;
    };

    ws.onmessage = async (event) => {
      try {
        if (typeof event.data === 'string') {
          const jsonData = JSON.parse(event.data);
          console.log('Received message:', jsonData);

          if (jsonData.type === 'image_caption') {
            setChatHistory(prev => [{
              role: 'assistant',
              content: jsonData.content,
              isFinal: true,
              messageId: jsonData.messageId
            }]);
          } else if (jsonData.type === 'vad_text') {
            console.log('VAD Text:', jsonData.content);
            setVadText(jsonData.content);
          }
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    };

    return ws;
  };

  useEffect(() => {
    const initAudioContext = async () => {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const context = new AudioContextClass({ sampleRate: 16000 });

        // 等待用户交互
        const resumeAudioContext = async () => {
          if (context.state === 'suspended') {
            await context.resume();
          }
          // 移除事件监听器
          document.removeEventListener('click', resumeAudioContext);
          // 初始化 AudioWorklet
          await context.audioWorklet.addModule('/audioWorklet.js');
        };

        document.addEventListener('click', resumeAudioContext);
        audioContextRef.current = context;
      } catch (error) {
        console.error('Failed to initialize audio context:', error);
      }
    };

    initAudioContext();
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      setupWebSocket();

      if (!audioContextRef.current) {
        throw new Error('Audio context not initialized');
      }

      // 确保 AudioContext 已经恢复
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      // 等待一小段时间确保上下文完全恢复
      await new Promise(resolve => setTimeout(resolve, 100));

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const source = audioContextRef.current.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      try {
        const workletNode = new AudioWorkletNode(audioContextRef.current, 'audio-processor');
        workletNodeRef.current = workletNode;

        workletNode.port.onmessage = (event) => {
          if (event.data.type === 'vad') {
            console.log('VAD event:', event.data.status);
            if (event.data.status === 'speech_start') {
              console.log('Speech started');
            } else if (event.data.status === 'speech_end') {
              console.log('Speech ended');
              if (event.data.audioData) {
                console.log('Audio data length:', event.data.audioData.length);
                if (websocketRef.current?.readyState === WebSocket.OPEN) {
                  websocketRef.current.send(JSON.stringify({
                    type: 'vad_data',
                    audioData: Array.from(event.data.audioData)
                  }));
                }
              }
            }
          }
        };

        source.connect(workletNode);
        workletNode.connect(audioContextRef.current.destination);
        setIsRecording(true);
      } catch (error) {
        console.error('Error creating AudioWorkletNode:', error);
        throw new Error('Failed to initialize audio processing');
      }

    } catch (error) {
      console.error('Error starting recording:', error);
      addLog(`Error starting recording: ${error.message}`, 'error');
    }
  };

  const stopRecording = () => {
    setVadText('');
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    hasPlaybackLatencyRef.current = false;
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
    }
    if (echoNodeRef.current) {
      echoNodeRef.current.disconnect();
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }
    setIsRecording(false);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const formatLatencyLog = (message: string) => {
    const splitChar = message.includes(':') ? ':' : message.includes('-') ? '-' : null;
    if (!splitChar) return message;

    const [label, values] = message.split(splitChar);
    return (
      <div className="grid grid-cols-[1fr,auto] gap-2">
        <span>{label}{splitChar}</span>
        <span className="font-mono">{values}</span>
      </div>
    );
  };

  const handleInterrupt = () => {
    if (echoNodeRef.current) {
      echoNodeRef.current.port.postMessage({ type: 'clear' });
      echoNodeRef.current.port.postMessage({ type: 'mute' });
      echoNodeRef.current.disconnect();
      echoNodeRef.current.connect(audioContextRef.current!.destination);
    }
    audioQueueRef.current = [];

    playbackStartTimeRef.current = null;
    hasPlaybackLatencyRef.current = false;
    isPlayingRef.current = false;
  };

  const handleChatScroll = () => {
    if (!chatHistoryRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatHistoryRef.current;
    shouldAutoScrollChatRef.current = scrollHeight - (scrollTop + clientHeight) < 100;
  };

  const handleLogsScroll = () => {
    if (!logsRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logsRef.current;
    shouldAutoScrollLogsRef.current = scrollHeight - (scrollTop + clientHeight) < 100;
  };

  const scrollChatToBottom = () => {
    if (chatHistoryRef.current && shouldAutoScrollChatRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  };

  const scrollLogsToBottom = () => {
    if (logsRef.current && shouldAutoScrollLogsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollChatToBottom();
  }, [chatHistory]);

  useEffect(() => {
    scrollLogsToBottom();
  }, [logs]);

  useEffect(() => {
    // 当聊天记录更新时，滚动到底部
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const uploadImage = async (file: File) => {
    if (!websocketRef.current) {
      setupWebSocket();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    try {
      const imageUrl = URL.createObjectURL(file);
      setCurrentImage(imageUrl);

      const reader = new FileReader();
      reader.onload = async (e) => {
        const buffer = e.target?.result;
        if (buffer instanceof ArrayBuffer && websocketRef.current?.readyState === WebSocket.OPEN) {
          websocketRef.current.send(JSON.stringify({
            type: 'image_upload_start'
          }));
          websocketRef.current.send(buffer);

          setChatHistory(prev => [...prev, {
            role: 'user',
            content: '正在分析图片...',
            isFinal: true,
            messageId: Date.now().toString()
          }]);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Error uploading image:', error);
      addLog(`Error uploading image: ${error.message}`, 'error');
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 640,
          height: 480
        }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsStreaming(true);

        // 每2秒截取一张图片
        streamIntervalRef.current = setInterval(() => {
          captureAndSendImage();
        }, 2000);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      addLog(`Error accessing camera: ${error.message}`, 'error');
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
    }
    setIsStreaming(false);
  };

  const captureAndSendImage = () => {
    if (!videoRef.current?.srcObject) {
      console.log('No video stream available');
      return;
    }

    if (!websocketRef.current || websocketRef.current.readyState !== WebSocket.OPEN) {
      console.log('WebSocket not ready, reconnecting...');
      setupWebSocket();
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        canvas.toBlob(async (blob) => {
          if (!blob) {
            console.error('Failed to create blob from canvas');
            return;
          }

          try {
            const buffer = await blob.arrayBuffer();
            websocketRef.current?.send(buffer);
            console.log('Image sent, size:', buffer.byteLength);
          } catch (error) {
            console.error('Error sending image:', error);
          }
        }, 'image/jpeg', 0.8);
      }
    } catch (error) {
      console.error('Error capturing image:', error);
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-4 sm:p-8 lg:p-12">
      <div className="z-10 w-full max-w-7xl items-center justify-between text-sm lg:flex">
        <Card className="w-full h-[90vh] flex flex-col">
          <CardHeader className="pb-0">
            <CardTitle>多模态AI助手</CardTitle>
          </CardHeader>
          <div className="flex-1 flex gap-4 p-6 pt-0">
            <div className="w-[640px] flex flex-col">
              <div className="flex-1 overflow-hidden rounded-lg border bg-background p-4 flex flex-col">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            <div className="flex-1 flex flex-col">
              <div
                ref={chatHistoryRef}
                className="flex-1 rounded-lg border bg-background p-4"
              >
                <AIChatHistory messages={chatHistory} />
              </div>
              {isRecording && vadText && (
                <div className="mt-4 p-4 rounded-lg border bg-muted">
                  <p className="text-center text-lg">{vadText}</p>
                </div>
              )}
              <div className="flex gap-4 mt-4">
                <Button
                  onClick={isRecording ? stopRecording : startRecording}
                  variant={isRecording ? "destructive" : "default"}
                  className="px-4 sm:px-8 py-4 sm:py-6 text-base sm:text-lg font-semibold flex items-center justify-center gap-2"
                >
                  {isRecording ? (
                    <>
                      <Square className="w-5 h-5 sm:w-6 sm:h-6" />
                      停止录音
                    </>
                  ) : (
                    <>
                      <Mic className="w-5 h-5 sm:w-6 sm:h-6" />
                      开始录音
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
