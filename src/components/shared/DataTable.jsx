import { Database } from 'lucide-react';
import { cn } from '../../lib/utils';

function TableSkeletonRows({ columnsCount }) {
  return Array.from({ length: 5 }).map((_, rowIndex) => (
    <tr key={`skeleton-${rowIndex}`} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
      {Array.from({ length: columnsCount }).map((__, colIndex) => (
        <td key={`skeleton-cell-${rowIndex}-${colIndex}`} className="border-b border-border px-4 py-3">
          <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
        </td>
      ))}
    </tr>
  ));
}

export default function DataTable({
  columns,
  data,
  loading,
  emptyMessage = 'لا توجد بيانات',
  emptyIcon: EmptyIcon = Database,
  rowClassName,
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-white">
      <table className="min-w-full border-collapse text-right">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="border-b border-border px-4 py-3 text-sm font-semibold text-text">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {loading ? <TableSkeletonRows columnsCount={columns.length} /> : null}

          {!loading && data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12">
                <div className="flex flex-col items-center justify-center gap-2 text-text-muted">
                  <EmptyIcon className="h-8 w-8" />
                  <p className="text-sm">{emptyMessage}</p>
                </div>
              </td>
            </tr>
          ) : null}

          {!loading &&
            data.map((row, rowIndex) => (
              <tr
                key={row.id ?? rowIndex}
                className={cn(rowIndex % 2 === 0 ? 'bg-white' : 'bg-slate-50/60', rowClassName?.(row, rowIndex))}
              >
                {columns.map((column) => {
                  const value = row[column.key];

                  return (
                    <td key={`${row.id ?? rowIndex}-${column.key}`} className="border-b border-border px-4 py-3 text-sm text-text">
                      {column.render ? column.render(value, row) : value ?? '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}