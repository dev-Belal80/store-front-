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
  renderMobileCard,
}) {
  return (
    <div className="space-y-4">
      {/* Desktop view */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-border bg-white">
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

      {/* Mobile view */}
      <div className="block md:hidden space-y-3">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="animate-pulse rounded-xl border border-border bg-white p-4 space-y-2">
                <div className="h-4 w-1/3 rounded bg-slate-200" />
                <div className="h-3 w-1/2 rounded bg-slate-200 animate-pulse delay-75" />
                <div className="h-3 w-1/4 rounded bg-slate-200 animate-pulse delay-150" />
              </div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-white py-12 text-text-muted">
            <EmptyIcon className="h-8 w-8" />
            <p className="text-sm">{emptyMessage}</p>
          </div>
        ) : (
          data.map((row, rowIndex) => {
            if (renderMobileCard) {
              return (
                <div
                  key={row.id ?? rowIndex}
                  className={cn(
                    'rounded-xl border border-border bg-white p-4 shadow-sm',
                    rowClassName?.(row, rowIndex)
                  )}
                >
                  {renderMobileCard(row, rowIndex)}
                </div>
              );
            }

            const titleColumn = columns[0];
            const restColumns = columns.slice(1);
            const actionsColumn = columns.find((col) => col.key === 'actions');

            return (
              <div
                key={row.id ?? rowIndex}
                className={cn(
                  'rounded-xl border border-border bg-white p-4 shadow-sm space-y-3',
                  rowClassName?.(row, rowIndex)
                )}
              >
                {titleColumn && (
                  <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
                    <div className="font-semibold text-text">
                      {titleColumn.render ? titleColumn.render(row[titleColumn.key], row) : row[titleColumn.key] ?? '—'}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm">
                  {restColumns.map((col) => {
                    if (col.key === 'actions') return null;
                    return (
                      <div key={col.key} className="space-y-0.5">
                        <div className="text-[11px] font-medium text-text-muted">{col.label}</div>
                        <div className="font-medium text-text">
                          {col.render ? col.render(row[col.key], row) : row[col.key] ?? '—'}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {actionsColumn && actionsColumn.render && (
                  <div className="border-t border-slate-100 pt-2 flex justify-end">
                    {actionsColumn.render(null, row)}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}