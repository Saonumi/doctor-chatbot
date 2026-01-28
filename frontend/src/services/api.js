import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

export const api = {
    // Chat với AI
    chat: async (question) => {
        const formData = new FormData();
        formData.append('question', question);
        const response = await axios.post(`${API_BASE_URL}/api/chat`, formData);
        return response.data;
    },

    // Upload PDF
    uploadPDF: async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await axios.post(`${API_BASE_URL}/api/upload`, formData);
        return response.data;
    },

    // Lấy danh sách bệnh nhân
    getRecords: async (skip = 0, limit = 100) => {
        const response = await axios.get(`${API_BASE_URL}/api/records`, {
            params: { skip, limit }
        });
        return response.data;
    },

    // Tìm kiếm bệnh nhân
    searchPatients: async (query) => {
        const response = await axios.get(`${API_BASE_URL}/api/search`, {
            params: { q: query }
        });
        return response.data;
    },

    // Lấy lịch sử khám theo CCCD
    getHistory: async (cccd) => {
        const response = await axios.get(`${API_BASE_URL}/api/history/${cccd}`);
        return response.data;
    },

    // Thêm bệnh nhân và chẩn đoán
    diagnose: async (patientData) => {
        const response = await axios.post(`${API_BASE_URL}/api/diagnose`, patientData);
        return response.data;
    },
};
