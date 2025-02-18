import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';


interface ChatMessage {
    role: 'user' | 'assistant' | 'transcript';
    content: string;
    isFinal?: boolean;
}

interface Props {
    messages: ChatMessage[];
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

const AIChatHistory: React.FC<Props> = ({ messages }) => {
    // 只显示最新的消息
    const latestMessage = messages[messages.length - 1];

    if (!latestMessage) return null;

    return (
        <div className="h-full flex items-center justify-center">
            <div
                className="max-w-[80%] rounded-lg px-6 py-4 bg-muted text-center text-lg"
            >
                {latestMessage.content.replace('图片分析结果：', '')}
            </div>
        </div>
    );
};

export default AIChatHistory; 