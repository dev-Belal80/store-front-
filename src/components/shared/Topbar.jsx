import { Menu } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const roleLabelMap = {
  super_admin: 'مدير عام',
  store_owner: 'صاحب متجر',
};

export default function Topbar({ title, onMenuClick }) {
  const user = useAuthStore((state) => state.user);
  const roleLabel = roleLabelMap[user?.role] || user?.role || 'مستخدم';

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-white px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-md border border-border p-2 text-text lg:hidden"
          aria-label="فتح القائمة"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold text-text">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <span className="hidden text-sm font-medium text-text-muted sm:inline">{user?.name || '—'}</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{roleLabel}</span>
      </div>
    </header>
  );
}