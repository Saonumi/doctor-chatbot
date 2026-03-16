import { useState, useEffect } from 'react';

/**
 * PipelineGraph - Visualize pipeline xử lý AI dạng graph (SVG).
 * Theme: trắng đục (off-white), dễ nhìn, full height.
 */

const NODES = [
    { id: 'input', label: 'Câu hỏi', icon: '💬', x: 160, y: 40 },
    { id: 'router', label: 'Intent Router', icon: '🔀', x: 160, y: 140 },
    { id: 'rag', label: 'Medical RAG', icon: '🏥', x: 60, y: 260 },
    { id: 'sql', label: 'Patient SQL', icon: '👤', x: 260, y: 260 },
    { id: 'llm', label: 'Gemini LLM', icon: '🤖', x: 160, y: 380 },
    { id: 'output', label: 'Trả lời', icon: '✅', x: 160, y: 490 },
];

const NODE_W = 130;
const NODE_H = 52;
const NODE_R = 14;

const EDGES = [
    { from: 'input', to: 'router' },
    { from: 'router', to: 'rag' },
    { from: 'router', to: 'sql' },
    { from: 'router', to: 'llm' },
    { from: 'rag', to: 'llm' },
    { from: 'sql', to: 'llm' },
    { from: 'llm', to: 'output' },
];

// Định nghĩa edges ĐÚNG cho từng intent
const ACTIVE_EDGES = {
    MEDICAL: new Set(['input->router', 'router->rag', 'rag->llm', 'llm->output']),
    PATIENT: new Set(['input->router', 'router->sql', 'sql->llm', 'llm->output']),
    GENERAL: new Set(['input->router', 'router->llm', 'llm->output']),
};

const STATUS_COLORS = {
    idle:      { fill: '#f8f8f6', stroke: '#c8c8c4', text: '#555550', dot: '#c8c8c4' },
    active:    { fill: '#eff6ff', stroke: '#3b82f6', text: '#1e40af', dot: '#3b82f6' },
    completed: { fill: '#f0fdf4', stroke: '#22c55e', text: '#166534', dot: '#22c55e' },
    skipped:   { fill: '#fafaf9', stroke: '#e7e5e4', text: '#a8a8a3', dot: '#e7e5e4' },
};

export default function PipelineGraph({ activeStep, intent, stats }) {
    const [nodeStates, setNodeStates] = useState({});

    useEffect(() => {
        if (!activeStep) {
            setNodeStates({});
            return;
        }

        const newStates = { ...nodeStates };

        switch (activeStep) {
            case 'intent_start':
                newStates['input'] = 'completed';
                newStates['router'] = 'active';
                break;
            case 'intent_done':
                newStates['router'] = 'completed';
                if (intent === 'MEDICAL') newStates['sql'] = 'skipped';
                else if (intent === 'PATIENT') newStates['rag'] = 'skipped';
                else { newStates['rag'] = 'skipped'; newStates['sql'] = 'skipped'; }
                break;
            case 'retrieval_start': newStates['rag'] = 'active'; break;
            case 'retrieval_done': newStates['rag'] = 'completed'; break;
            case 'sql_start': newStates['sql'] = 'active'; break;
            case 'sql_done': newStates['sql'] = 'completed'; break;
            case 'llm_start': newStates['llm'] = 'active'; break;
            case 'llm_done': newStates['llm'] = 'completed'; break;
            case 'complete': newStates['output'] = 'completed'; break;
        }
        setNodeStates(newStates);
    }, [activeStep, intent]);

    const getState = (id) => nodeStates[id] || 'idle';

    const center = (node) => ({ x: node.x + NODE_W / 2, y: node.y + NODE_H / 2 });

    const edgeKey = (from, to) => `${from}->${to}`;

    const isEdgeOnPath = (from, to) => {
        if (!intent) return true; // chưa biết intent → show tất cả
        const activeSet = ACTIVE_EDGES[intent];
        return activeSet ? activeSet.has(edgeKey(from, to)) : true;
    };

    const edgeColor = (from, to) => {
        // Nếu edge KHÔNG nằm trên path hiện tại → skipped
        if (intent && !isEdgeOnPath(from, to)) return STATUS_COLORS.skipped.stroke;
        const fs = getState(from), ts = getState(to);
        if (ts === 'skipped' || fs === 'skipped') return STATUS_COLORS.skipped.stroke;
        if (fs === 'completed' && (ts === 'active' || ts === 'completed')) return STATUS_COLORS.completed.stroke;
        if (fs === 'active') return STATUS_COLORS.active.stroke;
        return STATUS_COLORS.idle.stroke;
    };

    return (
        <div
            className="rounded-2xl shadow-lg border border-stone-200 overflow-hidden flex flex-col h-full"
            style={{ background: 'linear-gradient(180deg, #faf9f7 0%, #f5f4f1 100%)' }}
        >
            {/* Header */}
            <div className="px-5 py-4 border-b border-stone-200 bg-white/60 backdrop-blur-sm flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2.5">
                    <span className="text-lg">⚡</span>
                    <span className="text-sm font-bold text-stone-700 tracking-wide">AI Pipeline</span>
                </div>
                {intent && (
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold border ${
                        intent === 'MEDICAL' ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : intent === 'PATIENT' ? 'bg-purple-50 text-purple-700 border-purple-200'
                        : 'bg-stone-50 text-stone-600 border-stone-200'
                    }`}>
                        {intent === 'MEDICAL' ? '🏥 Y học' : intent === 'PATIENT' ? '👤 Bệnh nhân' : '💬 Chung'}
                    </span>
                )}
            </div>

            {/* SVG Graph — takes remaining space */}
            <div className="flex-1 flex items-center justify-center px-3 py-4 min-h-0">
                <svg viewBox="0 0 400 560" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                    <defs>
                        <filter id="glow-blue" x="-30%" y="-30%" width="160%" height="160%">
                            <feGaussianBlur stdDeviation="4" result="blur" />
                            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                        </filter>
                        <filter id="node-shadow" x="-10%" y="-10%" width="120%" height="130%">
                            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#00000012" />
                        </filter>
                    </defs>

                    {/* Edges */}
                    {EDGES.map((edge, i) => {
                        const from = NODES.find(n => n.id === edge.from);
                        const to = NODES.find(n => n.id === edge.to);
                        const fc = center(from), tc = center(to);
                        const color = edgeColor(edge.from, edge.to);
                        const onPath = isEdgeOnPath(edge.from, edge.to);
                        const isSkipped = !onPath || getState(edge.to) === 'skipped';

                        // Start/end points (bottom of from, top of to)
                        const x1 = fc.x, y1 = fc.y + NODE_H / 2;
                        const x2 = tc.x, y2 = tc.y - NODE_H / 2;

                        // Tính góc xoay mũi tên theo hướng đường thẳng
                        const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);

                        return (
                            <g key={i}>
                                {/* Straight line */}
                                <line
                                    x1={x1} y1={y1}
                                    x2={x2} y2={y2}
                                    stroke={color}
                                    strokeWidth="2.5"
                                    strokeDasharray={isSkipped ? '6,4' : 'none'}
                                    className="transition-all duration-500"
                                />
                                {/* Arrow — xoay theo hướng line */}
                                <polygon
                                    points="0,5 -5,-5 5,-5"
                                    fill={color}
                                    transform={`translate(${x2},${y2}) rotate(${angle - 90})`}
                                    className="transition-all duration-500"
                                />
                            </g>
                        );
                    })}

                    {/* Nodes */}
                    {NODES.map((node) => {
                        const state = getState(node.id);
                        const colors = STATUS_COLORS[state];
                        const isActive = state === 'active';

                        return (
                            <g key={node.id} className="transition-all duration-300" filter="url(#node-shadow)">
                                {/* Background rect */}
                                <rect
                                    x={node.x} y={node.y}
                                    width={NODE_W} height={NODE_H}
                                    rx={NODE_R}
                                    fill={colors.fill}
                                    stroke={colors.stroke}
                                    strokeWidth={isActive ? 2.5 : 1.5}
                                    filter={isActive ? 'url(#glow-blue)' : undefined}
                                    className={isActive ? 'animate-pulse' : ''}
                                />

                                {/* Label — centered, no icon */}
                                <text
                                    x={node.x + NODE_W / 2} y={node.y + NODE_H / 2 + 5}
                                    fontSize="14" fill={colors.text} textAnchor="middle"
                                    fontWeight={isActive || state === 'completed' ? '800' : '600'}
                                    fontFamily="Inter, system-ui, sans-serif"
                                    className={state === 'skipped' ? 'opacity-50' : ''}
                                >
                                    {node.label}
                                </text>

                                {/* Completed checkmark */}
                                {state === 'completed' && (
                                    <circle cx={node.x + NODE_W - 10} cy={node.y + 10} r="7" fill="#22c55e" />
                                )}
                                {state === 'completed' && (
                                    <text x={node.x + NODE_W - 10} y={node.y + 14} fontSize="9" fill="white" textAnchor="middle" fontWeight="bold">✓</text>
                                )}
                            </g>
                        );
                    })}
                </svg>
            </div>

            {/* Stats */}
            {stats && (stats.chunks > 0 || stats.rowCount > 0) && (
                <div className="px-5 py-3 border-t border-stone-200 bg-white/50 flex-shrink-0">
                    <div className="flex gap-6">
                        {stats.chunks > 0 && (
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-stone-400">📄 Chunks:</span>
                                <span className="font-bold text-blue-600">{stats.chunks}</span>
                            </div>
                        )}
                        {stats.rowCount > 0 && (
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-stone-400">🗃️ SQL:</span>
                                <span className="font-bold text-purple-600">{stats.rowCount} bản ghi</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Legend */}
            <div className="px-5 py-3 border-t border-stone-200 bg-white/40 flex-shrink-0">
                <div className="grid grid-cols-2 gap-y-1.5 gap-x-4">
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-stone-300"></div>
                        <span className="text-xs text-stone-400">Chờ</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                        <span className="text-xs text-stone-400">Đang chạy</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                        <span className="text-xs text-stone-400">Hoàn thành</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-stone-200 border border-dashed border-stone-300"></div>
                        <span className="text-xs text-stone-400">Bỏ qua</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
