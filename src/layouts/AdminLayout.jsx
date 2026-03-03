import { useMemo, useState } from 'react';
import { Building2, Home } from 'lucide-react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/shared/Sidebar';
import Topbar from '../components/shared/Topbar';

const pageTitles = {
  '/admin/dashboard': 'الرئيسية',
  '/admin/stores': 'المتاجر',
};

export default function AdminLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  const items = useMemo(
    () => [
      { label: 'الرئيسية', icon: Home, path: '/admin/dashboard' },
      { label: 'المتاجر', icon: Building2, path: '/admin/stores' },
    ],
    []
  );

  const title = pageTitles[location.pathname] || 'لوحة المدير';

  return (
    <div className="min-h-screen bg-bg lg:flex">
      <Sidebar items={items} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar title={title} onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}