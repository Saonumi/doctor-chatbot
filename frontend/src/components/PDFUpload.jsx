import { useState } from 'react';
import { Upload, FileText, CheckCircle, Book, Sparkles, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

export default function PDFUpload() {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile && selectedFile.type === 'application/pdf') {
            setFile(selectedFile);
            setResult(null);
        } else {
            alert('⚠️ Vui lòng chọn file PDF!');
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setLoading(true);
        try {
            const response = await api.uploadPDF(file);
            setResult(response);
            setFile(null);
        } catch (error) {
            alert('❌ Lỗi upload: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header với decorative */}
            <div className="mb-6 pb-5 border-b-2 border-red-200">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-gradient-to-br from-orange-600 to-orange-700 rounded-xl shadow-lg">
                        <Book className="w-7 h-7 text-white" strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-red-900">Kho Tài liệu Y học</h1>
                        <p className="text-sm text-gray-600 mt-1 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-orange-600" />
                            Upload sách Đông Y để AI học và tư vấn chính xác hơn
                        </p>
                    </div>
                </div>
            </div>

            <div className="space-y-5">
                {/* Upload Area */}
                <div className="bg-white rounded-xl shadow-md border-l-4 border-purple-600 p-8">
                    <div className="border-3 border-dashed border-orange-300 rounded-xl p-12 text-center hover:border-red-400 hover:bg-orange-50/30 transition-all cursor-pointer">
                        <input
                            type="file"
                            accept=".pdf"
                            onChange={handleFileChange}
                            className="hidden"
                            id="pdf-upload"
                        />

                        <label htmlFor="pdf-upload" className="cursor-pointer">
                            <div className="flex flex-col items-center">
                                <div className="p-4 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl shadow-xl mb-5">
                                    <FileText className="w-14 h-14 text-white" strokeWidth={2} />
                                </div>

                                <p className="text-xl font-bold text-gray-900 mb-2">
                                    Click để chọn file PDF
                                </p>
                                <p className="text-sm text-gray-600 mb-3">
                                    Hỗ trợ file PDF có ảnh và bảng biểu
                                </p>

                                <div className="flex items-center gap-2 text-xs text-orange-700 bg-orange-100 px-3 py-1.5 rounded-full">
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>Tài liệu Y học cổ truyền</span>
                                </div>
                            </div>
                        </label>
                    </div>
                </div>

                {/* Selected File */}
                {file && (
                    <div className="bg-white rounded-xl shadow-md border-l-4 border-blue-600 p-5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-lg">
                                    <FileText className="w-8 h-8 text-white" strokeWidth={2.5} />
                                </div>
                                <div>
                                    <p className="font-bold text-gray-900 text-lg">{file.name}</p>
                                    <p className="text-sm text-gray-600 mt-0.5">
                                        Kích thước: {(file.size / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={handleUpload}
                                disabled={loading}
                                className="btn-primary px-8 disabled:opacity-50"
                            >
                                {loading ? 'Đang xử lý...' : 'Upload ngay'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Result */}
                {result && (
                    <div className="bg-white rounded-xl shadow-md border-l-4 border-green-600 p-6">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-green-600 rounded-xl">
                                <CheckCircle className="w-8 h-8 text-white" strokeWidth={2.5} />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-xl text-green-900 mb-2">{result.status}</h3>
                                <p className="text-sm text-green-700 mb-3">{result.message}</p>
                                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                                    <p className="text-sm text-green-800">
                                        📄 File đã lưu: <span className="font-semibold">{result.filename}</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Instructions */}
                <div className="bg-white rounded-xl shadow-md border-l-4 border-amber-600 p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Book className="w-6 h-6 text-amber-700" strokeWidth={2.5} />
                        <h4 className="font-bold text-lg text-gray-900">Hướng dẫn sử dụng</h4>
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                            <span className="flex-shrink-0 w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">1</span>
                            <p className="text-sm text-gray-700 pt-1">Upload sách Y học Đông Y dạng PDF (có thể có ảnh, bảng biểu)</p>
                        </div>

                        <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-lg">
                            <span className="flex-shrink-0 w-7 h-7 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold text-sm">2</span>
                            <p className="text-sm text-gray-700 pt-1">Hệ thống tự động trích xuất văn bản, hình ảnh và bảng biểu</p>
                        </div>

                        <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                            <span className="flex-shrink-0 w-7 h-7 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-sm">3</span>
                            <p className="text-sm text-gray-700 pt-1">AI sẽ học từ tài liệu để tư vấn chính xác hơn</p>
                        </div>

                        <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg">
                            <span className="flex-shrink-0 w-7 h-7 bg-amber-600 text-white rounded-full flex items-center justify-center font-bold text-sm">4</span>
                            <p className="text-sm text-gray-700 pt-1">Có thể upload nhiều file - kiến thức sẽ được tích lũy</p>
                        </div>
                    </div>

                    {/* Extra tip */}
                    <div className="mt-4 p-4 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg border-l-4 border-red-500">
                        <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="w-5 h-5 text-red-700" />
                            <span className="font-bold text-red-900">Lưu ý quan trọng:</span>
                        </div>
                        <p className="text-sm text-red-800">
                            Upload các sách về <strong>bệnh lý, phương thuốc, châm cứu, bấm huyệt</strong> để AI tư vấn toàn diện!
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
