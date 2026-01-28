import { Link, useLocation } from 'react-router-dom';
import { MessageCircle, Users, UserPlus, Upload, Heart, Copyright, Activity } from 'lucide-react';

export default function Sidebar() {
    const location = useLocation();

    const menuItems = [
        { path: '/add-patient', icon: UserPlus, label: 'Khám mới', color: 'amber' },
        { path: '/chat', icon: MessageCircle, label: 'Tư vấn AI', color: 'red' },
        { path: '/patients', icon: Users, label: 'Bệnh nhân', color: 'green' },
        { path: '/upload', icon: Upload, label: 'Tài liệu', color: 'orange' },
    ];

    return (
        <aside className="w-72 bg-gradient-to-b from-red-900 to-red-800 shadow-xl flex flex-col h-full">
            {/* Header với accent vàng */}
            <div className="p-6 border-b-2 border-yellow-500">
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2.5 bg-white/10 backdrop-blur rounded-xl">
                        <Heart className="w-8 h-8 text-yellow-400" strokeWidth={2.5} fill="currentColor" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white">
                            Đông Y Việt Nam
                        </h1>
                        <p className="text-sm text-yellow-300 font-medium">
                            Hệ thống quản lý
                        </p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex-grow overflow-y-auto p-4">
                <nav className="space-y-2">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path;

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`
                  flex items-center gap-3 px-4 py-3.5 rounded-lg transition-all duration-200
                  ${isActive
                                        ? 'bg-white text-red-900 shadow-lg font-semibold'
                                        : 'text-white/90 hover:bg-white/10 hover:text-white'
                                    }
                `}
                            >
                                <Icon className="w-5 h-5" strokeWidth={2.5} />
                                <span className="text-sm">{item.label}</span>
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 p-5 border-t-2 border-white/20 bg-red-950/50 text-center">
                <div className="flex items-center justify-center gap-1.5 text-yellow-300 mb-1.5">
                    <Copyright className="w-4 h-4" />
                    <span className="text-sm font-bold">Saonumi</span>
                </div>
                <p className="text-xs text-white/80">Đông Y Việt Nam</p>
                <p className="text-xs text-white/60 mt-1 flex items-center justify-center gap-1">
                    <Activity className="w-3 h-3" />
                    Nguyễn Ngọc Sáng
                </p>
            </div>
        </aside>
    );
}
