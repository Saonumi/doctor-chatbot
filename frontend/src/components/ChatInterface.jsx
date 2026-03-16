import { useState, useRef, useEffect } from 'react';
import { Send, Trash2, Bot, User, Sparkles, Activity, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PipelineGraph from './PipelineGraph';
import { api } from '../services/api';

/**
 * ChatInterface - Giao diện chat AI với Pipeline Visualization.
 * Layout: Chat (60%) + PipelineGraph (40%)
 * Streaming: SSE events từ backend → pipeline graph sáng lên real-time
 */

const INTENT_BADGES = {
    MEDICAL: { label: '🏥 Y học', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    PATIENT: { label: '👤 Bệnh nhân', color: 'bg-purple-100 text-purple-700 border-purple-200' },
    GENERAL: { label: '💬 Chung', color: 'bg-gray-100 text-gray-600 border-gray-200' },
};

/**
 * CitationsPanel — Hiển thị trích dẫn nguồn (NotebookLM-style).
 * Mỗi citation có badge số, tên file, số trang, và snippet nội dung.
 */
function CitationsPanel({ citations }) {
    const [expanded, setExpanded] = useState(false);

    if (!citations || citations.length === 0) return null;

    const visibleCitations = expanded ? citations : citations.slice(0, 2);

    return (
        <div className="mt-3 pt-3 border-t border-gray-100">
            <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 transition mb-2"
            >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Trích dẫn nguồn ({citations.length})</span>
                {citations.length > 2 && (
                    expanded
                        ? <ChevronUp className="w-3 h-3" />
                        : <ChevronDown className="w-3 h-3" />
                )}
            </button>

            <div className="space-y-2">
                {visibleCitations.map((cite) => (
                    <div
                        key={cite.id}
                        className="group flex gap-2.5 p-2.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 rounded-lg hover:border-amber-300 hover:shadow-sm transition text-xs cursor-pointer"
                        onClick={() => {
                            const pdfUrl = `/pdfs/${encodeURIComponent(cite.source)}#page=${cite.page}`;
                            window.open(pdfUrl, '_blank');
                        }}
                        title={`Mở ${cite.source} — Trang ${cite.page}`}
                    >
                        {/* Badge số */}
                        <div className="flex-shrink-0 w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center font-bold text-xs shadow-sm">
                            {cite.id}
                        </div>

                        <div className="flex-1 min-w-0">
                            {/* Source + Page */}
                            <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-amber-800 truncate group-hover:underline">
                                    📄 {cite.source}
                                </span>
                                <span className="flex-shrink-0 text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded text-[10px] font-medium">
                                    Trang {cite.page}
                                </span>
                            </div>

                            {/* Snippet */}
                            <p className="text-gray-600 leading-relaxed line-clamp-2">
                                {cite.snippet}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {!expanded && citations.length > 2 && (
                <button
                    onClick={() => setExpanded(true)}
                    className="mt-1.5 text-xs text-amber-600 hover:text-amber-800 font-medium transition"
                >
                    + {citations.length - 2} trích dẫn khác
                </button>
            )}
        </div>
    );
}

export default function ChatInterface() {
    const [messages, setMessages] = useState(() => {
        const saved = localStorage.getItem('tcm_chat_history');
        return saved ? JSON.parse(saved) : [];
    });
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);

    // Pipeline graph state
    const [activeStep, setActiveStep] = useState(null);
    const [currentIntent, setCurrentIntent] = useState(null);
    const [pipelineStats, setPipelineStats] = useState(null);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Save to localStorage
    useEffect(() => {
        localStorage.setItem('tcm_chat_history', JSON.stringify(messages));
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;
        const question = input.trim();
        setInput('');
        setLoading(true);

        // Reset pipeline graph
        setActiveStep(null);
        setCurrentIntent(null);
        setPipelineStats(null);

        // Add user message
        const userMsg = { role: 'user', content: question };
        setMessages(prev => [...prev, userMsg]);

        // Prepare chat history (5 turn gần nhất)
        const chatHistory = messages.slice(-10); // 10 messages = 5 turns (user+assistant)

        try {
            // SSE streaming chat
            let finalAnswer = '';
            let finalSources = [];
            let finalCitations = [];
            let finalIntent = 'GENERAL';

            await api.chatStream(
                question,
                chatHistory,
                // onStep callback — mỗi SSE event gọi hàm này
                (event) => {
                    setActiveStep(event.step);

                    if (event.intent) {
                        setCurrentIntent(event.intent);
                        finalIntent = event.intent;
                    }

                    if (event.chunks) {
                        setPipelineStats(prev => ({ ...prev, chunks: event.chunks }));
                    }

                    if (event.row_count !== undefined) {
                        setPipelineStats(prev => ({ ...prev, rowCount: event.row_count }));
                    }

                    if (event.step === 'complete') {
                        finalAnswer = event.answer || '';
                        finalSources = event.sources || [];
                        finalCitations = event.citations || [];
                    }
                }
            );

            // Add assistant message
            const assistantMsg = {
                role: 'assistant',
                content: finalAnswer,
                sources: finalSources,
                citations: finalCitations,
                intent: finalIntent,
            };
            setMessages(prev => [...prev, assistantMsg]);

        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Xin lỗi, đã xảy ra lỗi. Vui lòng thử lại.',
                intent: 'ERROR',
            }]);
            setActiveStep(null);
        } finally {
            setLoading(false);
        }
    };

    const clearChat = () => {
        setMessages([]);
        setActiveStep(null);
        setCurrentIntent(null);
        setPipelineStats(null);
        localStorage.removeItem('tcm_chat_history');
    };

    return (
        <div className="flex gap-4 h-full max-w-full mx-auto">
            {/* ═══ CHAT AREA (60%) ═══ */}
            <div className="flex-1 min-w-0 flex flex-col" style={{ flex: '3' }}>
                {/* Header */}
                <div className="mb-4 pb-4 border-b-2 border-red-200 flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-gradient-to-br from-red-600 to-red-700 rounded-xl shadow-lg">
                                <Bot className="w-7 h-7 text-white" strokeWidth={2.5} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-red-900">Trợ Lý Đông Y</h1>
                                <p className="text-sm text-gray-600 flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-yellow-500" />
                                    Agentic RAG + Text-to-SQL
                                </p>
                            </div>
                        </div>
                        {messages.length > 0 && (
                            <button onClick={clearChat} className="flex items-center gap-2 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition">
                                <Trash2 className="w-4 h-4" />
                                <span className="text-sm">Xóa chat</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4">
                    {messages.length === 0 && (
                        <div className="text-center py-16">
                            <div className="inline-block p-6 bg-gradient-to-br from-red-500 to-orange-500 rounded-3xl shadow-xl mb-6">
                                <Bot className="w-16 h-16 text-white" strokeWidth={1.5} />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-3">Xin chào!</h2>
                            <p className="text-gray-600 max-w-md mx-auto mb-6">
                                Tôi là trợ lý AI Đông Y. Bạn có thể hỏi tôi về y học hoặc tra cứu bệnh nhân.
                            </p>
                            <div className="flex flex-col gap-2 max-w-sm mx-auto">
                                {['Bệnh đau đầu, chóng mặt là bệnh gì?', 'Triệu chứng của chứng Phong Hàn?', 'Mất ngủ, tim hồi hộp?'].map((q, i) => (
                                    <button
                                        key={i}
                                        onClick={() => { setInput(q); }}
                                        className="text-left text-sm px-4 py-2.5 bg-white border border-red-200 rounded-lg hover:bg-red-50 hover:border-red-300 transition text-gray-700"
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'assistant' && (
                                <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center">
                                    <Bot className="w-5 h-5 text-white" strokeWidth={2.5} />
                                </div>
                            )}
                            <div className={`max-w-[85%] ${msg.role === 'user'
                                ? 'bg-gradient-to-br from-red-600 to-red-700 text-white rounded-2xl rounded-br-md px-4 py-3'
                                : 'bg-white border border-gray-200 shadow-sm rounded-2xl rounded-bl-md px-4 py-3'
                                }`}>
                                {/* Intent badge */}
                                {msg.role === 'assistant' && msg.intent && INTENT_BADGES[msg.intent] && (
                                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full border font-medium mb-2 ${INTENT_BADGES[msg.intent].color}`}>
                                        {INTENT_BADGES[msg.intent].label}
                                    </span>
                                )}

                                <div className={`prose prose-sm max-w-none ${msg.role === 'user' ? 'prose-invert' : ''}`}>
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {msg.content}
                                    </ReactMarkdown>
                                </div>

                                {/* Citations Panel */}
                                {msg.citations && msg.citations.length > 0 && (
                                    <CitationsPanel citations={msg.citations} />
                                )}

                                {/* Sources (fallback if no citations) */}
                                {(!msg.citations || msg.citations.length === 0) && msg.sources && msg.sources.length > 0 && (
                                    <div className="mt-3 pt-2 border-t border-gray-100">
                                        <p className="text-xs text-gray-500 font-medium mb-1">📚 Nguồn tham khảo:</p>
                                        <div className="flex flex-wrap gap-1">
                                            {msg.sources.map((src, j) => (
                                                <span key={j} className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full border border-orange-200">
                                                    {src}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            {msg.role === 'user' && (
                                <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center">
                                    <User className="w-5 h-5 text-white" strokeWidth={2.5} />
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Loading indicator */}
                    {loading && (
                        <div className="flex gap-3 justify-start">
                            <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center">
                                <Bot className="w-5 h-5 text-white animate-pulse" strokeWidth={2.5} />
                            </div>
                            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                                <div className="flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-blue-500 animate-pulse" />
                                    <span className="text-sm text-gray-500">Đang xử lý...</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="flex-shrink-0 bg-white border border-gray-200 rounded-xl shadow-md p-3">
                    <div className="flex items-center gap-3">
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSend()}
                            placeholder="Hỏi về y học Đông Y hoặc tra cứu bệnh nhân..."
                            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm"
                            disabled={loading}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || loading}
                            className="p-2.5 bg-gradient-to-br from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 disabled:opacity-50 transition shadow-md"
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* ═══ PIPELINE GRAPH (right panel) ═══ */}
            <div className="flex-shrink-0 hidden lg:block" style={{ flex: '2', maxWidth: '380px' }}>
                <div className="sticky top-4 h-[calc(100vh-6rem)]">
                    <PipelineGraph
                        activeStep={activeStep}
                        intent={currentIntent}
                        stats={pipelineStats}
                    />
                </div>
            </div>
        </div>
    );
}
