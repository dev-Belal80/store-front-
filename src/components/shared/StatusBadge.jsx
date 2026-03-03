import { cn } from '../../lib/utils';

const statusMap = {
  confirmed: {
    label: 'مؤكدة',
    className: 'bg-green-100 text-green-700',
  },
  cancelled: {
    label: 'ملغاة',
    className: 'bg-red-100 text-red-700',
  },
  active: {
    label: 'مفعّل',
    className: 'bg-green-100 text-green-700',
  },
  inactive: {
    label: 'موقوف',
    className: 'bg-red-100 text-red-700',
  },
};

export default function StatusBadge({ status }) {
  const config = statusMap[status] || {
    label: status || 'غير معروف',
    className: 'bg-slate-100 text-slate-700',
  };

  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-semibold', config.className)}>
      {config.label}
    </span>
  );
}