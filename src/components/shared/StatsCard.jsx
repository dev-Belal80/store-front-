import { cn } from '../../lib/utils';

const colorMap = {
  green: {
    iconBg: 'bg-green-100 text-green-700',
    border: 'border-green-500',
  },
  amber: {
    iconBg: 'bg-amber-100 text-amber-700',
    border: 'border-amber-500',
  },
  red: {
    iconBg: 'bg-red-100 text-red-700',
    border: 'border-red-500',
  },
  blue: {
    iconBg: 'bg-blue-100 text-blue-700',
    border: 'border-blue-500',
  },
};

export default function StatsCard({ title, value, icon: Icon, color = 'green', subtitle }) {
  const palette = colorMap[color] || colorMap.green;

  return (
    <div className={cn('rounded-xl border border-border bg-white p-4 shadow-sm', 'border-b-4', palette.border)}>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-sm text-text-muted">{title}</p>
          <p className="mt-1 text-3xl font-bold text-text">{value}</p>
        </div>
        <div className={cn('rounded-full p-2.5', palette.iconBg)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {subtitle ? <p className="text-xs text-text-muted">{subtitle}</p> : null}
    </div>
  );
}