import { useState, useEffect } from 'react';
import { Search, Eye, Calendar, User, Phone, FileText, Activity, AlertCircle, Pill, Stethoscope, Pencil, Trash2, X, Save } from 'lucide-react';
import { api } from '../services/api';

// Render Helpers
const DetailSection = ({ title, icon: Icon, color = "blue", children }) => (
    <div className={`mb-6 bg-white rounded-xl shadow-sm border border-${color}-100 overflow-hidden`}>
        <div className={`px-5 py-3 bg-${color}-50 border-b border-${color}-100 flex items-center gap-2`}>
            <Icon className={`w-5 h-5 text-${color}-600`} />
            <h4 className={`font-bold text-${color}-900`}>{title}</h4>
        </div>
        <div className="p-5">
            {children}
        </div>
    </div>
);

const InfoRow = ({ label, value, fullWidth = false }) => (
    <div className={`${fullWidth ? 'col-span-full' : ''}`}>
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">{label}</span>
        <span className="text-gray-900 font-medium text-sm block break-words whitespace-pre-wrap">
            {value || <span className="text-gray-400 italic">Chưa có thông tin</span>}
        </span>
    </div>
);

const EditInput = ({ label, name, value, onChange, type = "text", required = false, width = "" }) => (
    <div className={width}>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        {type === 'textarea' ? (
            <textarea
                name={name}
                value={value}
                onChange={onChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
        ) : type === 'select' ? (
            <select
                name={name}
                value={value}
                onChange={onChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
            </select>
        ) : (
            <input
                type={type}
                name={name}
                value={value}
                onChange={onChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
        )}
    </div>
);

export default function PatientList() {
    const [patients, setPatients] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState(null); // For View Details
    const [editingPatient, setEditingPatient] = useState(null);   // For Edit Modal

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;

    const [error, setError] = useState(null);

    useEffect(() => {
        loadPatients();
    }, []);

    const loadPatients = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await api.getPatients();
            setPatients(data);
        } catch (err) {
            console.error('Error loading patients:', err);
            setError(err.message || 'Lỗi không xác định');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            loadPatients();
            return;
        }

        setLoading(true);
        setCurrentPage(1);
        try {
            const data = await api.search(searchQuery);
            setPatients(data);
        } catch (error) {
            console.error('Error searching:', error);
        } finally {
            setLoading(false);
        }
    };

    const viewHistory = async (id) => {
        try {
            const patient = await api.getPatientById(id);
            if (patient.luot_khams) {
                patient.luot_khams.sort((a, b) => new Date(b.NgayKham) - new Date(a.NgayKham));
            }
            setSelectedPatient(patient);
        } catch (error) {
            console.error('Error loading history:', error);
            alert('Không thể tải chi tiết bệnh nhân');
        }
    };

    // --- EDIT HANDLERS ---
    const handleEditClick = (patient) => {
        // Clone patient object for editing to avoid mutating list directly
        // Ensure all fields are present to control inputs
        setEditingPatient({
            ID: patient.ID,
            HoTen: patient.HoTen || '',
            NgaySinh: patient.NgaySinh || '',
            GioiTinh: patient.GioiTinh || 'Nam',
            CCCD: patient.CCCD || '',
            SDT: patient.SDT || '',
            DiaChi: patient.DiaChi || '',
            NgheNghiep: patient.NgheNghiep || '',
            MaBHYT: patient.MaBHYT || '',
            LienHeKhanCap: patient.LienHeKhanCap || '',
            TienSuBanThan: patient.TienSuBanThan || '',
            TienSuGiaDinh: patient.TienSuGiaDinh || ''
        });
    };

    const handleEditChange = (e) => {
        const { name, value } = e.target;
        setEditingPatient(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveEdit = async () => {
        if (!editingPatient.HoTen || !editingPatient.CCCD) {
            alert('Vui lòng điền Họ tên và CCCD');
            return;
        }

        try {
            setLoading(true);
            await api.updatePatient(editingPatient.ID, editingPatient);
            await loadPatients(); // Refresh list
            setEditingPatient(null); // Close modal
            alert('Cập nhật thành công!');
        } catch (error) {
            console.error('Error updating patient:', error);
            alert('Lỗi cập nhật: ' + (error.response?.data?.detail || error.message));
        } finally {
            setLoading(false);
        }
    };

    // --- DELETE HANDLER ---
    const handleDeleteClick = async (id, name) => {
        if (window.confirm(`Bạn có chắc muốn XÓA bệnh nhân "${name}"?\nThao tác này sẽ xóa cả lịch sử khám và không thể hoàn tác!`)) {
            try {
                setLoading(true);
                await api.deletePatient(id);
                // Remove from local list to avoid full reload if possible, but loadPatients is safer
                await loadPatients();
            } catch (error) {
                console.error('Error deleting patient:', error);
                alert('Lỗi xóa bệnh nhân: ' + (error.response?.data?.detail || error.message));
            } finally {
                setLoading(false);
            }
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const formatDateOnly = (dateStr) => {
        if (!dateStr) return '---';
        const date = new Date(dateStr);
        return date.toLocaleDateString('vi-VN');
    };

    // Helper to get latest visit info for List View
    const getLatestVisit = (patient) => {
        if (patient.luot_khams && patient.luot_khams.length > 0) {
            const visits = [...patient.luot_khams].sort((a, b) => new Date(b.NgayKham) - new Date(a.NgayKham));
            return visits[0];
        }
        return {};
    };

    // Pagination
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentPatients = patients.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(patients.length / itemsPerPage);



    return (
        <div className="h-full flex flex-col max-w-full mx-auto px-4 py-6">
            {/* Header */}
            <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Danh sách Bệnh nhân</h1>
                    <p className="text-gray-500 mt-1">
                        Quản lý hồ sơ và lịch sử khám bệnh
                    </p>
                </div>
                <div className="bg-white px-4 py-2 rounded-full shadow-sm border border-gray-200 text-sm font-medium text-gray-600">
                    Tổng số: <span className="text-blue-600 font-bold text-lg ml-1">{patients.length}</span> hồ sơ
                </div>
            </div>

            {/* Search */}
            <div className="bg-white p-2 rounded-2xl shadow-sm border border-gray-200 mb-6 flex gap-2">
                <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Tìm kiếm theo tên, CCCD, SĐT, bệnh danh..."
                        className="w-full pl-12 pr-4 py-3 rounded-xl border-none focus:ring-2 focus:ring-blue-100 outline-none text-gray-700 placeholder-gray-400"
                    />
                </div>
                <button
                    onClick={handleSearch}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors shadow-lg shadow-blue-200"
                >
                    Tìm kiếm
                </button>
            </div>

            {/* Table */}
            <div className="flex-1 bg-white rounded-2xl shadow-lg shadow-gray-100 border border-gray-100 overflow-hidden flex flex-col">
                {loading && !patients.length ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center py-16">
                            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
                            <p className="text-gray-500 font-medium">Đang tải dữ liệu...</p>
                        </div>
                    </div>
                ) : patients.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center py-16">
                            <div className="bg-gray-50 p-6 rounded-full inline-block mb-4">
                                <User className="w-12 h-12 text-gray-300" />
                            </div>
                            <p className="text-gray-900 text-lg font-medium">Không tìm thấy bệnh nhân nào</p>
                            <p className="text-gray-500">Thử tìm kiếm với từ khóa khác</p>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto flex-1">
                            <table className="w-full table-auto">
                                <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Họ tên / Mã BN</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Thông tin</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Triệu chứng (Mới nhất)</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Chẩn đoán (Mới nhất)</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Số lần khám</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {currentPatients.map((patient, index) => {
                                        const latestVisit = getLatestVisit(patient);
                                        return (
                                            <tr key={patient.ID || index} className="hover:bg-blue-50/50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div>
                                                            <div className="font-bold text-gray-900 text-base">{patient.HoTen}</div>
                                                            <div className="text-xs text-blue-600 font-mono mt-0.5 bg-blue-50 px-2 py-0.5 rounded inline-block">
                                                                {patient.MaBenhNhan || '...'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="space-y-1">
                                                        <div className="text-sm text-gray-700 flex items-center gap-1.5">
                                                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                                            {formatDateOnly(patient.NgaySinh)}
                                                        </div>
                                                        <div className="text-sm text-gray-700 flex items-center gap-1.5">
                                                            <Phone className="w-3.5 h-3.5 text-gray-400" />
                                                            {patient.SDT || '---'}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <p className="text-sm text-gray-600 line-clamp-2 max-w-[250px]">{latestVisit.TrieuChung || '---'}</p>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="space-y-1">
                                                        {latestVisit.BenhDanh && (
                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                                {latestVisit.BenhDanh}
                                                            </span>
                                                        )}
                                                        {latestVisit.ChungDanh && (
                                                            <div className="text-sm text-gray-700 font-medium">{latestVisit.ChungDanh}</div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-700 font-bold text-sm">
                                                        {patient.luot_khams ? patient.luot_khams.length : 0}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => viewHistory(patient.ID)}
                                                            title="Xem chi tiết"
                                                            className="p-2 bg-white border border-blue-200 hover:border-blue-500 hover:text-blue-600 text-gray-600 rounded-lg transition-all shadow-sm"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleEditClick(patient)}
                                                            title="Chỉnh sửa"
                                                            className="p-2 bg-white border border-amber-200 hover:border-amber-500 hover:text-amber-600 text-gray-600 rounded-lg transition-all shadow-sm"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteClick(patient.ID, patient.HoTen)}
                                                            title="Xóa bệnh nhân"
                                                            className="p-2 bg-white border border-red-200 hover:border-red-500 hover:text-red-600 text-gray-600 rounded-lg transition-all shadow-sm"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="border-t border-gray-100 px-6 py-4 bg-gray-50 flex items-center justify-between flex-shrink-0">
                                <div className="text-sm text-gray-500">
                                    Đang hiển thị {indexOfFirstItem + 1} - {Math.min(indexOfLastItem, patients.length)} trên tổng số {patients.length}
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                                    >
                                        Trước
                                    </button>
                                    <span className="px-4 py-2 text-sm font-medium bg-white border border-gray-200 rounded-lg">
                                        {currentPage} / {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                                    >
                                        Sau
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* View Detail Modal - Keeping as is */ selectedPatient && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-gray-50 rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
                        {/* Header */}
                        <div className="bg-white px-8 py-5 border-b border-gray-200 flex justify-between items-start shrink-0">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                                    <FileText className="w-7 h-7 text-blue-600" />
                                    Hồ sơ Bệnh án
                                </h2>
                                <p className="text-gray-500 mt-1 pl-10">Mã BN: <span className="font-mono font-medium text-gray-900">{selectedPatient.MaBenhNhan}</span></p>
                            </div>
                            <button onClick={() => setSelectedPatient(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <span className="text-2xl text-gray-500 leading-none">&times;</span>
                            </button>
                        </div>

                        {/* Body */}
                        <div className="overflow-y-auto p-8 bg-gray-50/50 space-y-8">
                            {/* 1. THÔNG TIN HÀNH CHÍNH */}
                            {selectedPatient && (
                                <DetailSection title="I. Thông tin Hành chính" icon={User} color="blue">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-8">
                                        <InfoRow label="Họ và tên" value={selectedPatient.HoTen} />
                                        <InfoRow label="Ngày sinh" value={formatDateOnly(selectedPatient.NgaySinh)} />
                                        <InfoRow label="Giới tính" value={selectedPatient.GioiTinh} />
                                        <InfoRow label="CCCD" value={selectedPatient.CCCD} />

                                        <InfoRow label="SĐT" value={selectedPatient.SDT} />
                                        <InfoRow label="Nghề nghiệp" value={selectedPatient.NgheNghiep} />
                                        <InfoRow label="BHYT" value={selectedPatient.MaBHYT} />
                                        <InfoRow label="Liên hệ khẩn cấp" value={selectedPatient.LienHeKhanCap} />

                                        <InfoRow label="Địa chỉ" value={selectedPatient.DiaChi} fullWidth />
                                    </div>
                                </DetailSection>
                            )}

                            {/* 2. TIỀN SỬ */}
                            <DetailSection title="II. Tiền sử Bệnh" icon={Activity} color="amber">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <InfoRow label="Tiền sử bản thân" value={selectedPatient.TienSuBanThan} />
                                    <InfoRow label="Tiền sử gia đình" value={selectedPatient.TienSuGiaDinh} />
                                </div>
                            </DetailSection>

                            {/* Lịch sử khám */}
                            <div>
                                <h3 className="text-xl font-bold text-gray-800 mb-5 flex items-center gap-2">
                                    <Activity className="w-6 h-6 text-red-600" />
                                    Lịch sử khám bệnh ({selectedPatient.luot_khams ? selectedPatient.luot_khams.length : 0} lần)
                                </h3>

                                <div className="space-y-8">
                                    {selectedPatient.luot_khams && selectedPatient.luot_khams.map((record, idx) => (
                                        <div key={idx} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                                            <div className="bg-gray-800 text-white px-6 py-3 flex justify-between items-center">
                                                <div className="font-bold flex items-center gap-2">
                                                    <span className="px-2 py-0.5 bg-white/20 rounded text-sm">Lần khám {selectedPatient.luot_khams.length - idx}</span>
                                                    <span>- {formatDate(record.NgayKham)}</span>
                                                </div>
                                            </div>

                                            <div className="p-6 grid gap-6">
                                                <div className="border-l-4 border-red-500 pl-4 py-1 space-y-4">
                                                    <h5 className="font-bold text-red-900 flex items-center gap-2">
                                                        <Stethoscope className="w-4 h-4" /> Chẩn đoán Đông Y
                                                    </h5>
                                                    <InfoRow label="Triệu chứng" value={record.TrieuChung} fullWidth />
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <InfoRow label="Bệnh danh" value={record.BenhDanh} />
                                                        <InfoRow label="Chứng danh" value={record.ChungDanh} />
                                                    </div>
                                                </div>

                                                <div className="border-l-4 border-emerald-500 pl-4 py-1 space-y-4">
                                                    <h5 className="font-bold text-emerald-900 flex items-center gap-2">
                                                        <Pill className="w-4 h-4" /> Điều trị
                                                    </h5>
                                                    <InfoRow label="Bài thuốc" value={record.BaiThuoc} fullWidth />
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <InfoRow label="Châm cứu - Xoa bóp" value={record.ChamCuuXoaBop} />
                                                        <InfoRow label="Chế độ ăn uống" value={record.CheDoAnUongSinhHoat} />
                                                    </div>
                                                </div>

                                                <div className="border-t border-gray-100 pt-4 grid grid-cols-1 md:grid-cols-1 gap-6">
                                                    <InfoRow label="Lời dặn bác sĩ" value={record.LoiDanBacSi} />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="bg-white p-4 border-t border-gray-200 flex justify-end shrink-0">
                            <button
                                onClick={() => setSelectedPatient(null)}
                                className="px-6 py-2 bg-gray-800 text-white font-medium rounded-lg hover:bg-gray-900 transition-colors"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* EDIT MODAL */}
            {editingPatient && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
                        <div className="bg-white px-8 py-5 border-b border-gray-200 flex justify-between items-start shrink-0">
                            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                                <Pencil className="w-7 h-7 text-amber-600" />
                                Chỉnh sửa thông tin
                            </h2>
                            <button onClick={() => setEditingPatient(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <span className="text-2xl text-gray-500 leading-none">&times;</span>
                            </button>
                        </div>

                        <div className="overflow-y-auto p-8 bg-gray-50/50">
                            <div className="space-y-6">
                                <h3 className="text-lg font-bold text-gray-800 border-b pb-2">Thông tin Hành chính</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <EditInput label="Họ và tên" name="HoTen" value={editingPatient.HoTen} onChange={handleEditChange} required />
                                    <EditInput label="CCCD" name="CCCD" value={editingPatient.CCCD} onChange={handleEditChange} required />
                                    <EditInput label="Ngày sinh" name="NgaySinh" type="date" value={editingPatient.NgaySinh} onChange={handleEditChange} />
                                    <EditInput label="Giới tính" name="GioiTinh" type="select" value={editingPatient.GioiTinh} onChange={handleEditChange} />
                                    <EditInput label="SĐT" name="SDT" value={editingPatient.SDT} onChange={handleEditChange} />
                                    <EditInput label="Nghề nghiệp" name="NgheNghiep" value={editingPatient.NgheNghiep} onChange={handleEditChange} />
                                    <EditInput label="Mã BHYT" name="MaBHYT" value={editingPatient.MaBHYT} onChange={handleEditChange} />
                                    <EditInput label="Liên hệ khẩn cấp" name="LienHeKhanCap" value={editingPatient.LienHeKhanCap} onChange={handleEditChange} />
                                    <EditInput label="Địa chỉ" name="DiaChi" value={editingPatient.DiaChi} onChange={handleEditChange} width="col-span-full" />
                                </div>

                                <h3 className="text-lg font-bold text-gray-800 border-b pb-2 pt-4">Tiền sử Bệnh</h3>
                                <div className="grid grid-cols-1 gap-6">
                                    <EditInput label="Tiền sử bản thân" name="TienSuBanThan" type="textarea" value={editingPatient.TienSuBanThan} onChange={handleEditChange} />
                                    <EditInput label="Tiền sử gia đình" name="TienSuGiaDinh" type="textarea" value={editingPatient.TienSuGiaDinh} onChange={handleEditChange} />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-4 border-t border-gray-200 flex justify-end gap-3 shrink-0">
                            <button
                                onClick={() => setEditingPatient(null)}
                                className="px-6 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={loading}
                                className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                            >
                                {loading ? 'Đang lưu...' : <><Save className="w-4 h-4" /> Lưu thay đổi</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
