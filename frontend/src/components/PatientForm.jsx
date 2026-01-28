import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Save, User, FileText, Calendar, Phone, MapPin, Heart, AlertCircle, Activity, Pill, Stethoscope, ClipboardList } from 'lucide-react';
import { api } from '../services/api';

export default function PatientForm() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [formData, setFormData] = useState({
        // I. THÔNG TIN HÀNH CHÍNH
        MaBenhNhan: 'Đang tải...',
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

    // Fetch next patient ID on mount
    useEffect(() => {
        const fetchNextId = async () => {
            try {
                const response = await fetch('http://localhost:8000/api/next-patient-id');
                const data = await response.json();
                setFormData(prev => ({ ...prev, MaBenhNhan: data.next_patient_id }));
            } catch (error) {
                console.error('Error fetching patient ID:', error);
                setFormData(prev => ({ ...prev, MaBenhNhan: 'BN00001' }));
            }
        };
        fetchNextId();
    }, []);

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        if (errors[e.target.name]) {
            setErrors({
                ...errors,
                [e.target.name]: ''
            });
        }
    };

    const validate = () => {
        const newErrors = {};
        if (!formData.HoTen.trim()) newErrors.HoTen = 'Vui lòng nhập họ tên';
        if (!formData.CCCD.trim()) newErrors.CCCD = 'Vui lòng nhập CCCD';
        if (!formData.TrieuChung.trim()) newErrors.TrieuChung = 'Vui lòng nhập triệu chứng';

        if (formData.NgaySinh) {
            const birthDate = new Date(formData.NgaySinh);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (birthDate > today) {
                newErrors.NgaySinh = 'Ngày sinh không được vượt quá ngày hiện tại';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) {
            alert('❌ Vui lòng điền đầy đủ các trường bắt buộc (*)');
            return;
        }

        setLoading(true);
        try {
            await api.diagnose(formData);
            alert('✅ Đã lưu hồ sơ bệnh nhân thành công!');
            navigate('/patients');
        } catch (error) {
            alert('❌ Lỗi: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const getTodayDate = () => {
        return new Date().toISOString().split('T')[0];
    };

    const SectionHeader = ({ icon: Icon, title, color = "blue" }) => (
        <h3 className={`text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 pb-2 border-b border-${color}-100`}>
            <div className={`p-1.5 bg-${color}-100 rounded-lg`}>
                <Icon className={`w-5 h-5 text-${color}-600`} />
            </div>
            {title}
        </h3>
    );

    const InputField = ({ label, name, type = "text", required = false, placeholder, width = "full" }) => (
        <div className={width === "half" ? "" : "col-span-full"}>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            {type === "textarea" ? (
                <textarea
                    name={name}
                    value={formData[name]}
                    onChange={handleChange}
                    rows="3"
                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all ${errors[name] ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-blue-400'
                        }`}
                    placeholder={placeholder}
                />
            ) : type === "select" ? (
                <select
                    name={name}
                    value={formData[name]}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all hover:border-blue-400"
                >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                </select>
            ) : (
                <input
                    type={type}
                    name={name}
                    value={formData[name]}
                    onChange={handleChange}
                    max={type === "date" ? getTodayDate() : undefined}
                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all ${errors[name] ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-blue-400'
                        }`}
                    placeholder={placeholder}
                />
            )}
            {errors[name] && <p className="text-red-500 text-xs mt-1 font-medium">{errors[name]}</p>}
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto pb-10">
            {/* Header */}
            <div className="mb-8 pb-6 border-b border-gray-200">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-lg shadow-blue-200">
                        <UserPlus className="w-8 h-8 text-white" strokeWidth={2} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Tiếp nhận Bệnh nhân mới</h1>
                        <p className="text-gray-500 mt-1 flex items-center gap-2 text-sm font-medium">
                            <ClipboardList className="w-4 h-4" />
                            Nhập đầy đủ thông tin hành chính và chuyên môn
                        </p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">

                {/* 1. THÔNG TIN HÀNH CHÍNH */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                    <SectionHeader icon={User} title="I. Thông tin Hành chính" color="blue" />

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                        <InputField label="Họ và tên" name="HoTen" required width="half" placeholder="VD: Nguyễn Văn A" />
                        <div className="">
                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                Mã bệnh nhân <span className="text-gray-400 text-xs">(Tự động)</span>
                            </label>
                            <input
                                type="text"
                                value={formData.MaBenhNhan}
                                disabled
                                className="w-full px-4 py-2.5 border border-gray-200 bg-gray-50 rounded-lg text-gray-600 font-mono cursor-not-allowed"
                            />
                        </div>
                        <InputField label="Ngày sinh" name="NgaySinh" type="date" width="half" />
                        <InputField label="Giới tính" name="GioiTinh" type="select" width="half" />

                        <InputField label="CCCD/CMND" name="CCCD" required width="half" placeholder="Số định danh cá nhân" />
                        <InputField label="Số điện thoại" name="SDT" type="tel" width="half" placeholder="09xx..." />
                        <InputField label="Nghề nghiệp" name="NgheNghiep" width="half" placeholder="Công việc hiện tại" />
                        <InputField label="Mã BHYT" name="MaBHYT" width="half" placeholder="Mã số bảo hiểm y tế" />

                        <div className="col-span-full md:col-span-2">
                            <InputField label="Địa chỉ" name="DiaChi" placeholder="Số nhà, đường, phường/xã..." />
                        </div>
                        <div className="col-span-full md:col-span-2">
                            <InputField label="Liên hệ khẩn cấp" name="LienHeKhanCap" placeholder="Tên và SĐT người thân" />
                        </div>
                    </div>
                </div>

                {/* 2. TIỀN SỬ */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative overflow-hidden hover:shadow-md transition-shadow">
                    <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                    <SectionHeader icon={Activity} title="II. Tiền sử Bệnh" color="amber" />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <InputField label="Tiền sử bản thân" name="TienSuBanThan" type="textarea" placeholder="Bệnh mạn tính, dị ứng, phẫu thuật, thói quen..." />
                        <InputField label="Tiền sử gia đình" name="TienSuGiaDinh" type="textarea" placeholder="Bệnh di truyền, bệnh lý của người thân..." />
                    </div>
                </div>

                {/* 3. CHẨN ĐOÁN ĐÔNG Y */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative overflow-hidden hover:shadow-md transition-shadow">
                    <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                    <SectionHeader icon={Stethoscope} title="III. Chẩn đoán Đông Y" color="red" />

                    <div className="space-y-5">
                        <InputField label="Triệu chứng (Vọng - Văn - Vấn - Thiết)" name="TrieuChung" type="textarea" required placeholder="Mô tả kỹ các triệu chứng hiện tại..." />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <InputField label="Bệnh danh" name="BenhDanh" placeholder="VD: Chứng Tý, Đầu thống, Hư lao..." />
                            <InputField label="Chứng danh (Bát cương/Tạng phủ)" name="ChungDanh" placeholder="VD: Phong hàn thấp tý, Can dương thượng cang..." />
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
                    <SectionHeader icon={Pill} title="IV. Phác đồ Điều trị" color="emerald" />

                    <div className="space-y-5">
                        <InputField label="Bài thuốc & Gia giảm" name="BaiThuoc" type="textarea" placeholder="Tên bài thuốc và các vị thuốc gia giảm..." />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <InputField label="Châm cứu - Xoa bóp" name="ChamCuuXoaBop" type="textarea" placeholder="Huyệt vị châm cứu, thủ thuật xoa bóp..." />
                            <InputField label="Chế độ ăn uống & Sinh hoạt" name="CheDoAnUongSinhHoat" type="textarea" placeholder="Kiêng khem, tập luyện..." />
                        </div>
                    </div>
                </div>

                {/* 5. THEO DÕI */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative overflow-hidden hover:shadow-md transition-shadow">
                    <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
                    <SectionHeader icon={Calendar} title="V. Theo dõi & Lời dặn" color="purple" />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <InputField label="Lời dặn của Bác sĩ" name="LoiDanBacSi" type="textarea" placeholder="Dặn dò thêm..." />
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
