import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Save, User, FileText, Calendar, Phone, MapPin, Heart, AlertCircle, Activity, Pill, Stethoscope, ClipboardList } from 'lucide-react';
import { api } from '../services/api';

// Helper function for date validation
const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
};

// InputField Component - MUST be outside to prevent re-creation
const InputField = ({ label, name, type = "text", required = false, placeholder, width = "full", value, onChange, error, disabled = false }) => (
    <div className={width === "half" ? "" : "col-span-full"}>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        {type === "textarea" ? (
            <textarea
                name={name}
                value={value || ''}
                onChange={onChange}
                rows="3"
                disabled={disabled}
                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all ${error ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-blue-400'
                    } ${disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                placeholder={placeholder}
            />
        ) : type === "select" ? (
            <select
                name={name}
                value={value || 'Nam'}
                onChange={onChange}
                disabled={disabled}
                className={`w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all hover:border-blue-400 ${disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
            >
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
            </select>
        ) : (
            <input
                type={type}
                name={name}
                value={value || ''}
                onChange={onChange}
                max={type === "date" ? getTodayDate() : undefined}
                disabled={disabled}
                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all ${error ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-blue-400'
                    } ${disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                placeholder={placeholder}
            />
        )}
        {error && <p className="text-red-500 text-xs mt-1 font-medium">{error}</p>}
    </div>
);

// SectionHeader Component
const SectionHeader = ({ icon: Icon, title }) => (
    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 pb-2 border-b-2 border-blue-100">
        <div className="p-1.5 bg-blue-100 rounded-lg">
            <Icon className="w-5 h-5 text-blue-600" />
        </div>
        {title}
    </h3>
);

export default function PatientForm() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(false);

    // Mode: 'create' (New Patient) or 'add_visit' (Existing Patient)
    const [mode, setMode] = useState('create');
    const [existingPatientId, setExistingPatientId] = useState(null);

    const [errors, setErrors] = useState({});
    const [formData, setFormData] = useState({
        // I. THÔNG TIN HÀNH CHÍNH
        MaBenhNhan: '', // Sẽ load khi check CCCD
        HoTen: '',
        NgaySinh: '',
        GioiTinh: 'Nam',
        CCCD: '',
        DiaChi: '',
        SDT: '',
        NgheNghiep: '',
        MaBHYT: '',
        LienHeKhanCap: '',

        // II. TIỀN SỬ
        TienSuBanThan: '',
        TienSuGiaDinh: '',

        // III. CHẨN ĐOÁN ĐÔNG Y
        TrieuChung: '',
        BenhDanh: '',
        ChungDanh: '',

        // IV. ĐIỀU TRỊ
        BaiThuoc: '',
        ChamCuuXoaBop: '',
        CheDoAnUongSinhHoat: '',

        // V. THEO DÕI
        LoiDanBacSi: ''
    });

    // Check CCCD
    const checkCCCD = async (cccd) => {
        if (!cccd || cccd.length < 9) return;
        setChecking(true);
        try {
            const response = await fetch(`http://localhost:8000/api/patients/check?cccd=${cccd}`);
            if (response.ok) {
                const data = await response.json();
                if (data) {
                    // Patient found -> Switch to Add Visit mode
                    setMode('add_visit');
                    setExistingPatientId(data.ID);
                    setFormData(prev => ({
                        ...prev,
                        ...data, // Fill patient info
                        // Clear visit info for new visit
                        TrieuChung: '',
                        BenhDanh: '',
                        ChungDanh: '',
                        BaiThuoc: '',
                        ChamCuuXoaBop: '',
                        CheDoAnUongSinhHoat: '',
                        LoiDanBacSi: ''
                    }));
                    alert(`Đã tìm thấy bệnh nhân: ${data.HoTen}`);
                } else {
                    // Not found -> Reset to Create mode if previously in add_visit
                    if (mode === 'add_visit') {
                        setMode('create');
                        setExistingPatientId(null);
                        // Reset patient info but keep CCCD
                        setFormData(prev => ({
                            ...prev,
                            HoTen: '',
                            NgaySinh: '',
                            DiaChi: '',
                            SDT: '',
                            NgheNghiep: '',
                            MaBHYT: '',
                            LienHeKhanCap: '',
                            TienSuBanThan: '',
                            TienSuGiaDinh: '',
                            TrieuChung: '',
                            BenhDanh: '',
                            ChungDanh: '',
                            BaiThuoc: '',
                            ChamCuuXoaBop: '',
                            CheDoAnUongSinhHoat: '',
                            LoiDanBacSi: ''
                        }));
                    }
                }
            }
        } catch (error) {
            console.error("Error checking CCCD:", error);
        } finally {
            setChecking(false);
        }
    };

    const handleChange = useCallback((e) => {
        const { name, value } = e.target;

        // If changing CCCD, trigger check logic (debounce needed in real app, here simple onBlur key)
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

        setErrors(prev => ({
            ...prev,
            [name]: ''
        }));
    }, []);

    // Handle CCCD Blur to trigger check
    const handleCCCDBlur = (e) => {
        checkCCCD(e.target.value);
    };

    const validate = () => {
        const newErrors = {};

        // COMMON FIELDS (Both modes need Visit Info)
        if (!formData.TrieuChung.trim()) newErrors.TrieuChung = 'Vui lòng nhập triệu chứng';

        // STRICT VALIDATION FOR ALL VISIT FIELDS AS REQUESTED
        if (!formData.BenhDanh.trim()) newErrors.BenhDanh = 'Vui lòng nhập bệnh danh';
        if (!formData.ChungDanh.trim()) newErrors.ChungDanh = 'Vui lòng nhập chứng danh';
        if (!formData.BaiThuoc.trim()) newErrors.BaiThuoc = 'Vui lòng nhập bài thuốc';
        if (!formData.ChamCuuXoaBop.trim()) newErrors.ChamCuuXoaBop = 'Vui lòng nhập liệu pháp';
        if (!formData.CheDoAnUongSinhHoat.trim()) newErrors.CheDoAnUongSinhHoat = 'Vui lòng nhập chế độ sinh hoạt';
        if (!formData.LoiDanBacSi.trim()) newErrors.LoiDanBacSi = 'Vui lòng nhập lời dặn';

        if (mode === 'create') {
            // PATIENT INFO STRICT VALIDATION
            if (!formData.HoTen.trim()) newErrors.HoTen = 'Vui lòng nhập họ tên';
            if (!formData.CCCD.trim()) newErrors.CCCD = 'Vui lòng nhập CCCD';
            if (!formData.NgaySinh) newErrors.NgaySinh = 'Vui lòng chọn ngày sinh';
            // GioiTinh always has value 'Nam'
            if (!formData.SDT.trim()) newErrors.SDT = 'Vui lòng nhập SĐT';
            if (!formData.NgheNghiep.trim()) newErrors.NgheNghiep = 'Vui lòng nhập nghề nghiệp';
            if (!formData.MaBHYT.trim()) newErrors.MaBHYT = 'Vui lòng nhập BHYT (hoặc Không)';
            if (!formData.DiaChi.trim()) newErrors.DiaChi = 'Vui lòng nhập địa chỉ';
            if (!formData.LienHeKhanCap.trim()) newErrors.LienHeKhanCap = 'Vui lòng nhập liên hệ khẩn cấp';

            if (!formData.TienSuBanThan.trim()) newErrors.TienSuBanThan = 'Vui lòng nhập tiền sử bản thân (hoặc Không)';
            if (!formData.TienSuGiaDinh.trim()) newErrors.TienSuGiaDinh = 'Vui lòng nhập tiền sử gia đình (hoặc Không)';
        }

        return newErrors;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const newErrors = validate();
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            alert('❌ Vui lòng điền đầy đủ tất cả các trường bắt buộc!');
            return;
        }

        setLoading(true);
        try {
            let url = '';
            let payload = {};

            if (mode === 'create') {
                url = 'http://localhost:8000/api/patients';
                payload = {
                    ...formData,
                    LuotKhamDau: {
                        TrieuChung: formData.TrieuChung,
                        BenhDanh: formData.BenhDanh,
                        ChungDanh: formData.ChungDanh,
                        BaiThuoc: formData.BaiThuoc,
                        ChamCuuXoaBop: formData.ChamCuuXoaBop,
                        CheDoAnUongSinhHoat: formData.CheDoAnUongSinhHoat,
                        LoiDanBacSi: formData.LoiDanBacSi
                    }
                };
            } else {
                url = `http://localhost:8000/api/visits?benh_nhan_id=${existingPatientId}`;
                payload = {
                    TrieuChung: formData.TrieuChung,
                    BenhDanh: formData.BenhDanh,
                    ChungDanh: formData.ChungDanh,
                    BaiThuoc: formData.BaiThuoc,
                    ChamCuuXoaBop: formData.ChamCuuXoaBop,
                    CheDoAnUongSinhHoat: formData.CheDoAnUongSinhHoat,
                    LoiDanBacSi: formData.LoiDanBacSi
                };
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                alert(mode === 'create' ? 'Đã tạo hồ sơ mới thành công!' : 'Đã thêm lượt khám mới thành công!');
                navigate('/patients');
            } else {
                const errData = await response.json();
                alert(`Lỗi: ${errData.detail || 'Không thể lưu'}`);
            }
        } catch (error) {
            console.error('Error saving:', error);
            alert('Lỗi kết nối server');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto pb-10">
            {/* Header */}
            <div className="mb-8 pb-6 border-b border-gray-200">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-lg shadow-blue-200">
                        {mode === 'create' ? <UserPlus className="w-8 h-8 text-white" /> : <ClipboardList className="w-8 h-8 text-white" />}
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                            {mode === 'create' ? 'Tiếp nhận Bệnh nhân mới' : 'Thêm lượt khám mới'}
                        </h1>
                        <p className="text-gray-500 mt-1 flex items-center gap-2 text-sm font-medium">
                            <Activity className="w-4 h-4" />
                            {mode === 'create' ? 'Nhập thông tin hành chính và khám bệnh' : `Bệnh nhân: ${formData.HoTen} - ${formData.MaBenhNhan || '...'}`}
                        </p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">

                {/* 1. THÔNG TIN HÀNH CHÍNH */}
                <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative overflow-hidden group hover:shadow-md transition-shadow ${mode === 'add_visit' ? 'opacity-80' : ''}`}>
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                    <SectionHeader icon={User} title="I. Thông tin Hành chính" />

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                        {/* CCCD SEARCH FIELD - ALWAYS ACTIVE */}
                        <div className="col-span-full md:col-span-2">
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                CCCD/CMND <span className="text-red-500">*</span> (Nhập để tìm bệnh nhân cũ)
                            </label>
                            <div className="relative">
                                <input
                                    name="CCCD"
                                    value={formData.CCCD}
                                    onChange={handleChange}
                                    onBlur={handleCCCDBlur}
                                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all ${errors.CCCD ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-blue-400'
                                        }`}
                                    placeholder="Nhập số CCCD và nhấn ra ngoài..."
                                    disabled={mode === 'add_visit'} // Disable if found (or allow clear to reset?)
                                />
                                {checking && <div className="absolute right-3 top-3 text-blue-500 text-xs">Đang tìm...</div>}
                            </div>
                            {errors.CCCD && <p className="text-red-500 text-xs mt-1 font-medium">{errors.CCCD}</p>}
                        </div>

                        {/* OTHER FIELDS - DISABLED IN ADD VISIT MODE */}
                        <InputField label="Họ và tên" name="HoTen" required width="half" placeholder="VD: Nguyễn Văn A" value={formData.HoTen} onChange={handleChange} error={errors.HoTen} disabled={mode === 'add_visit'} />

                        <div className="">
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                Mã bệnh nhân <span className="text-gray-400 text-xs">(Tự động)</span>
                            </label>
                            <input
                                type="text"
                                value={formData.MaBenhNhan || '(Tự động)'}
                                disabled
                                className="w-full px-4 py-2.5 border border-gray-200 bg-gray-50 rounded-lg text-gray-600 font-mono cursor-not-allowed"
                            />
                        </div>

                        <InputField label="Ngày sinh" name="NgaySinh" type="date" required width="half" value={formData.NgaySinh} onChange={handleChange} error={errors.NgaySinh} disabled={mode === 'add_visit'} />
                        <InputField label="Giới tính" name="GioiTinh" type="select" required width="half" value={formData.GioiTinh} onChange={handleChange} error={errors.GioiTinh} disabled={mode === 'add_visit'} />

                        <InputField label="Số điện thoại" name="SDT" type="tel" required width="half" placeholder="09xx..." value={formData.SDT} onChange={handleChange} error={errors.SDT} disabled={mode === 'add_visit'} />
                        <InputField label="Nghề nghiệp" name="NgheNghiep" required width="half" placeholder="Công việc hiện tại" value={formData.NgheNghiep} onChange={handleChange} error={errors.NgheNghiep} disabled={mode === 'add_visit'} />
                        <InputField label="Mã BHYT" name="MaBHYT" required width="half" placeholder="Mã số bảo hiểm y tế" value={formData.MaBHYT} onChange={handleChange} error={errors.MaBHYT} disabled={mode === 'add_visit'} />

                        <div className="col-span-full md:col-span-2">
                            <InputField label="Địa chỉ" name="DiaChi" required placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố" value={formData.DiaChi} onChange={handleChange} error={errors.DiaChi} disabled={mode === 'add_visit'} />
                        </div>
                        <div className="col-span-full md:col-span-2">
                            <InputField label="Liên hệ khẩn cấp" name="LienHeKhanCap" required placeholder="Tên + SĐT người thân" value={formData.LienHeKhanCap} onChange={handleChange} error={errors.LienHeKhanCap} disabled={mode === 'add_visit'} />
                        </div>
                    </div>
                </div>

                {/* 2. TIỀN SỬ */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative overflow-hidden hover:shadow-md transition-shadow">
                    <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                    <SectionHeader icon={Activity} title="II. Tiền sử Bệnh" />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <InputField label="Tiền sử bản thân" name="TienSuBanThan" required type="textarea" placeholder="Bệnh mạn tính, dị ứng, tiền sử phẫu thuật, thói quen..." value={formData.TienSuBanThan} onChange={handleChange} error={errors.TienSuBanThan} disabled={mode === 'add_visit'} />
                        <InputField label="Tiền sử gia đình" name="TienSuGiaDinh" required type="textarea" placeholder="Bệnh di truyền, bệnh lý của gia đình..." value={formData.TienSuGiaDinh} onChange={handleChange} error={errors.TienSuGiaDinh} disabled={mode === 'add_visit'} />
                    </div>
                </div>

                {/* 3. CHẨN ĐOÁN ĐÔNG Y */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative overflow-hidden hover:shadow-md transition-shadow">
                    <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                    <SectionHeader icon={Stethoscope} title="III. Chẩn đoán Đông Y" />

                    <div className="space-y-5">
                        <InputField label="Triệu chứng" name="TrieuChung" type="textarea" required placeholder="Mô tả các triệu chứng hiện tại của bệnh nhân..." value={formData.TrieuChung} onChange={handleChange} error={errors.TrieuChung} />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <InputField label="Bệnh danh" name="BenhDanh" required placeholder="Tên bệnh theo Y Học Cổ Truyền" value={formData.BenhDanh} onChange={handleChange} error={errors.BenhDanh} />
                            <InputField label="Chứng danh (Bát cương/Tạng phủ)" name="ChungDanh" required placeholder="VD: Phong hàn thấp tý, Can dương thượng cang..." value={formData.ChungDanh} onChange={handleChange} error={errors.ChungDanh} />
                        </div>

                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-3">
                            <div className="p-2 bg-white rounded-full shadow-sm text-blue-600">
                                <AlertCircle className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-bold text-blue-900 text-sm">Gợi ý từ AI Doctor</h4>
                                <p className="text-sm text-blue-700 mt-1">Sử dụng Chatbot ở menu bên trái để tra cứu bệnh danh và bài thuốc nếu bạn cần hỗ trợ chẩn đoán chính xác.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. ĐIỀU TRỊ */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative overflow-hidden hover:shadow-md transition-shadow">
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                    <SectionHeader icon={Pill} title="IV. Phác đồ Điều trị" />

                    <div className="space-y-5">
                        <InputField label="Bài thuốc" name="BaiThuoc" type="textarea" required placeholder="Tên bài thuốc + liều dùng..." value={formData.BaiThuoc} onChange={handleChange} error={errors.BaiThuoc} />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <InputField label="Chăm cứu - Xóa bóp - Vật lý trị liệu" name="ChamCuuXoaBop" required type="textarea" placeholder="Ghi rõ huyệt vị và phương pháp..." value={formData.ChamCuuXoaBop} onChange={handleChange} error={errors.ChamCuuXoaBop} />
                            <InputField label="Chế độ ăn uống và sinh hoạt" name="CheDoAnUongSinhHoat" required type="textarea" placeholder="Hướng dẫn chế độ ăn kiêng, luyện tập..." value={formData.CheDoAnUongSinhHoat} onChange={handleChange} error={errors.CheDoAnUongSinhHoat} />
                        </div>
                    </div>
                </div>

                {/* 5. THEO DÕI */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative overflow-hidden hover:shadow-md transition-shadow">
                    <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
                    <SectionHeader icon={Calendar} title="V. Theo dõi & Lời dặn" />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <InputField label="Lời dặn của Bác sĩ" name="LoiDanBacSi" required type="textarea" placeholder="Dặn dò thêm..." value={formData.LoiDanBacSi} onChange={handleChange} error={errors.LoiDanBacSi} />
                    </div>
                </div>

                {/* Buttons */}
                <div className="mt-8 pt-6 border-t border-gray-200 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/patients')}
                        className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                    >
                        Hủy bỏ
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-8 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold shadow-lg shadow-blue-200 hover:shadow-xl hover:translate-y-[-1px] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {loading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Đang lưu...
                            </>
                        ) : (
                            <>
                                <Save className="w-5 h-5" />
                                Lưu Hồ sơ
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
