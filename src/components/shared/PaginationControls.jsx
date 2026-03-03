import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function PaginationControls({
  page,
  perPage,
  total,
  lastPage,
  onPageChange,
  onPerPageChange,
  className,
}) {
  const canPrev = page > 1;
  const canNext = page < lastPage;
  const start = total === 0 ? 0 : (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);

  return (
    <div className={cn('mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white p-3', className)}>
      <div className="text-sm text-text-muted">
        عرض {start} - {end} من {total}
      </div>

      <div className="flex items-center gap-2">
        <select
          value={perPage}
          onChange={(event) => onPerPageChange(Number(event.target.value))}
          className="h-9 rounded-lg border border-border bg-white px-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {[10, 25, 50, 100].map((size) => (
            <option key={size} value={size}>
              {size} / صفحة
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!canPrev}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="الصفحة السابقة"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        <span className="min-w-[84px] text-center text-sm font-medium text-text">
          صفحة {page} من {lastPage}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={!canNext}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="الصفحة التالية"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}