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

    // Lấy danh sách bệnh nhân (MỚI)
    getPatients: async (skip = 0, limit = 100) => {
        const response = await axios.get(`${API_BASE_URL}/api/patients`, {
            params: { skip, limit }
        });
        return response.data;
    },

    // Kiểm tra bệnh nhân (MỚI)
    checkPatient: async (cccd) => {
        const response = await axios.get(`${API_BASE_URL}/api/patients/check`, {
            params: { cccd }
        });
        return response.data;
    },

    // Tạo bệnh nhân mới (MỚI)
    createPatient: async (data) => {
        const response = await axios.post(`${API_BASE_URL}/api/patients`, data);
        return response.data;
    },

    // Cập nhật bệnh nhân (MỚI)
    updatePatient: async (id, data) => {
        const response = await axios.put(`${API_BASE_URL}/api/patients/${id}`, data);
        return response.data;
    },

    // Xóa bệnh nhân (MỚI)
    deletePatient: async (id) => {
        const response = await axios.delete(`${API_BASE_URL}/api/patients/${id}`);
        return response.data;
    },

    // Thêm lượt khám (MỚI)
    createVisit: async (patientId, data) => {
        const response = await axios.post(`${API_BASE_URL}/api/visits`, data, {
            params: { benh_nhan_id: patientId }
        });
        return response.data;
    },

    // Tìm kiếm (MỚI)
    search: async (query) => {
        const response = await axios.get(`${API_BASE_URL}/api/search`, {
            params: { q: query }
        });
        return response.data;
    },

    // Lấy chi tiết bệnh nhân (MỚI)
    getPatientById: async (id) => {
        const response = await axios.get(`${API_BASE_URL}/api/patients/${id}`);
        return response.data;
    },
};

