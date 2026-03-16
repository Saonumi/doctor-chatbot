/**
 * API Service - Frontend ↔ Backend communication.
 * Sử dụng:
 * - fetch + ReadableStream cho SSE streaming (chat)
 * - axios cho REST API (patients, upload)
 */
import axios from 'axios';

const API_BASE_URL = '/api';

// ═══════════════════════════════════════════════════════════════
// AXIOS INSTANCE (cho REST APIs)
// ═══════════════════════════════════════════════════════════════

const axiosInstance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
});


// ═══════════════════════════════════════════════════════════════
// API FUNCTIONS
// ═══════════════════════════════════════════════════════════════

export const api = {

    // ── CHAT (SSE Streaming) ──────────────────────────────────
    /**
     * Chat với AI qua SSE streaming.
     * Mỗi SSE event gọi callback onStep(event).
     *
     * @param {string} question - Câu hỏi user
     * @param {Array} chatHistory - Lịch sử chat gần nhất
     * @param {Function} onStep - Callback nhận mỗi SSE event
     */
    chatStream: async (question, chatHistory = [], onStep = () => { }) => {
        const response = await fetch(`${API_BASE_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question: question,
                chat_history: chatHistory
            }),
        });

        if (!response.ok) {
            throw new Error(`Chat API error: ${response.status}`);
        }

        // Đọc SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Parse SSE events (format: "data: {...}\n\n")
            const lines = buffer.split('\n\n');
            buffer = lines.pop(); // Giữ lại phần chưa hoàn chỉnh

            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith('data: ')) {
                    try {
                        const eventData = JSON.parse(trimmed.slice(6));
                        onStep(eventData);
                    } catch (e) {
                        console.warn('Failed to parse SSE event:', trimmed);
                    }
                }
            }
        }

        // Parse remaining buffer
        if (buffer.trim().startsWith('data: ')) {
            try {
                const eventData = JSON.parse(buffer.trim().slice(6));
                onStep(eventData);
            } catch (e) {
                // Ignore incomplete data
            }
        }
    },

    // ── UPLOAD PDF ────────────────────────────────────────────
    uploadPDF: async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await axiosInstance.post('/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 300000, // 5 phút cho PDF lớn (vision processing)
        });
        return response.data;
    },

    // ── QUẢN LÝ BỆNH NHÂN ───────────────────────────────────

    checkPatient: async (cccd) => {
        try {
            const response = await axiosInstance.get(`/patients/check?cccd=${cccd}`);
            return response.data;
        } catch (error) {
            if (error.response?.status === 404) return null;
            throw error;
        }
    },

    createPatient: async (data) => {
        const response = await axiosInstance.post('/patients', data);
        return response.data;
    },

    updatePatient: async (id, data) => {
        const response = await axiosInstance.put(`/patients/${id}`, data);
        return response.data;
    },

    deletePatient: async (id) => {
        const response = await axiosInstance.delete(`/patients/${id}`);
        return response.data;
    },

    addVisit: async (patientId, data) => {
        const response = await axiosInstance.post(`/visits?benh_nhan_id=${patientId}`, data);
        return response.data;
    },

    getPatients: async () => {
        const response = await axiosInstance.get('/patients');
        return response.data;
    },

    getPatientDetail: async (id) => {
        const response = await axiosInstance.get(`/patients/${id}`);
        return response.data;
    },

    searchPatients: async (query) => {
        const response = await axiosInstance.get(`/search?q=${encodeURIComponent(query)}`);
        return response.data;
    },
};
