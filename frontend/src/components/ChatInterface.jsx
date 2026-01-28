import { useState, useRef, useEffect } from 'react';
import { Send, User, Stethoscope, FileText, BookOpen, Sparkles, Bot, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function ChatInterface() {
    // Initialize messages from localStorage or default
    const [messages, setMessages] = useState(() => {
        const saved = localStorage.getItem('chatHistory_v2');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error('Failed to load chat history:', e);
            }
        }
        return [{
            role: 'assistant',
            content: `Xin chào! Tôi là trợ lý AI chuyên về Y học Đông Y.

Bạn có thể hỏi tôi về:

• Triệu chứng bệnh lý
• Phác đồ điều trị, bài thuốc
• Tra cứu huyệt vị, châm cứu

Hãy mô tả triệu chứng, tôi sẽ hỗ trợ bạn!`
        }];
    });
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    // Save chat history to localStorage whenever messages change
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem('chatHistory_v2', JSON.stringify(messages));
        }
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, loading]);

    const clearChat = () => {
        if (window.confirm('Bạn có chắc muốn xóa toàn bộ lịch sử chat?')) {
            const initialMsg = {
                role: 'assistant',
                content: `Xin chào! Tôi là trợ lý AI chuyên về Y học Đông Y.

Bạn có thể hỏi tôi về:

• Triệu chứng bệnh lý
• Phác đồ điều trị, bài thuốc
• Tra cứu huyệt vị, châm cứu

Hãy mô tả triệu chứng, tôi sẽ hỗ trợ bạn!`
            };
            setMessages([initialMsg]);
            localStorage.removeItem('chatHistory_v2');
        }
    };

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMessage = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        try {
            const response = await api.chat(input);

            // Format response with sources
            let formattedContent = response.answer;

            // Sources are handled separately in the UI now, but keep text appending just in case
            // actually let's keep it separate in the object

            const aiMessage = {
                role: 'assistant',
                content: formattedContent,
                sources: response.sources || []
            };
            setMessages(prev => [...prev, aiMessage]);
        } catch (error) {
            const errorMessage = {
                role: 'assistant',
                content: '❌ Xin lỗi, hệ thống đang gặp sự cố. Vui lòng thử lại sau!'
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="h-full flex flex-col max-w-6xl mx-auto rounded-3xl overflow-hidden shadow-2xl bg-gray-50 border border-gray-100 relative">

            {/* Header */}
            <div className="bg-white/80 backdrop-blur-md border-b border-gray-100 p-4 absolute top-0 w-full z-10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-200">
                        <Bot className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold text-gray-800 text-lg leading-tight">AI Đông Y Doctor</h1>
                        <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            Online Sẵn sàng hỗ trợ
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={clearChat}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Xóa lịch sử chat"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="text-xs text-gray-400 font-medium px-3 py-1 bg-gray-100 rounded-full">
                        v1.0.0
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto pt-24 pb-4 px-4 md:px-8 space-y-6">
                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`flex items-end gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                        {/* Avatar */}
                        <div className={`
                            w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-md transform transition-transform hover:scale-110
                            ${msg.role === 'user'
                                ? 'bg-indigo-600'
                                : 'bg-white border border-gray-100 text-blue-600'
                            }
                        `}>
                            {msg.role === 'user' ? (
                                <User className="w-4 h-4 text-white" />
                            ) : (
                                <Stethoscope className="w-4 h-4" />
                            )}
                        </div>

                        {/* Bubble */}
                        <div className={`
                            max-w-[85%] md:max-w-[75%] px-5 py-3.5 shadow-sm text-sm md:text-base leading-relaxed
                            ${msg.role === 'user'
                                ? 'bg-gradient-to-br from-indigo-600 to-blue-600 text-white rounded-2xl rounded-br-none'
                                : 'bg-white text-gray-800 border border-gray-100 rounded-2xl rounded-bl-none'
                            }
                        `}>
                            {msg.role === 'user' ? (
                                <div className="whitespace-pre-wrap">{msg.content}</div>
                            ) : (
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        p: ({ children }) => <p className="mb-2">{children}</p>,
                                        strong: ({ children }) => <strong className="font-bold text-gray-900">{children}</strong>,
                                        ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
                                        ol: ({ children }) => <ol className="list-decimal ml-4 mb-2">{children}</ol>,
                                        li: ({ children }) => <li className="mb-1">{children}</li>,
                                        h1: ({ children }) => <h1 className="text-xl font-bold mb-2">{children}</h1>,
                                        h2: ({ children }) => <h2 className="text-lg font-bold mb-2">{children}</h2>,
                                        h3: ({ children }) => <h3 className="text-base font-bold mb-2">{children}</h3>,
                                    }}
                                >
                                    {msg.content}
                                </ReactMarkdown>
                            )}

                            {/* Sources Section */}
                            {msg.sources && msg.sources.length > 0 && (
                                <div className="mt-4 pt-3 border-t border-gray-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <BookOpen className="w-4 h-4 text-blue-600" />
                                        <span className="text-xs font-bold text-gray-500 uppercase">Tài liệu tham khảo</span>
                                    </div>
                                    <div className="space-y-2">
                                        {msg.sources.map((source, sidx) => (
                                            <div key={sidx} className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer group">
                                                <div className="p-1 bg-white rounded shadow-sm group-hover:bg-blue-200 transition-colors">
                                                    <FileText className="w-3 h-3 text-blue-600" />
                                                </div>
                                                <span className="text-xs text-gray-600 font-medium truncate">{source}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {/* Loading Indicator */}
                {loading && (
                    <div className="flex items-end gap-3">
                        <div className="w-8 h-8 rounded-full bg-white border border-gray-100 flex items-center justify-center shadow-md">
                            <Stethoscope className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl rounded-bl-none shadow-sm flex gap-1.5 items-center">
                            <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                            <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                            <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></span>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-gray-100">
                <div className="max-w-4xl mx-auto relative flex items-end gap-2 bg-gray-50 p-2 rounded-3xl border border-gray-200 focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-300 transition-all shadow-inner">
                    <button className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors">
                        <Sparkles className="w-5 h-5" />
                    </button>

                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Mô tả triệu chứng bệnh..."
                        className="flex-1 bg-transparent border-none outline-none resize-none py-3 text-gray-700 placeholder-gray-400 max-h-32"
                        rows="1"
                        style={{ minHeight: '44px' }}
                    />

                    <button
                        onClick={handleSend}
                        disabled={loading || !input.trim()}
                        className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg shadow-blue-200 disabled:opacity-50 disabled:shadow-none transition-all transform hover:scale-105 active:scale-95"
                    >
                        <Send className="w-5 h-5 ml-0.5" />
                    </button>
                </div>
                <div className="text-center mt-2">
                    <p className="text-[10px] text-gray-400">
                        AI có thể mắc lỗi. Vui lòng kiểm tra lại thông tin với bác sĩ chuyên khoa.
                    </p>
                </div>
            </div>
        </div>
    );
}
