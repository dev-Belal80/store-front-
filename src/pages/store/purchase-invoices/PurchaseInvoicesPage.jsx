import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Plus, Search, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { cancelPurchaseInvoice, getPurchaseInvoices } from '../../../api/purchaseInvoices';
import DataTable from '../../../components/shared/DataTable';
import LoadingSpinner from '../../../components/shared/LoadingSpinner';
import PageHeader from '../../../components/shared/PageHeader';
import Pagination from '../../../components/shared/Pagination';
import StatusBadge from '../../../components/shared/StatusBadge';
import { Button } from '../../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import { normalizePaginatedResponse } from '../../../utils/pagination';

const PURCHASE_INVOICES_PER_PAGE = 10;

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getInvoiceDate = (invoice) => invoice?.date || invoice?.invoice_date || invoice?.created_at || null;
const getInvoiceNumber = (invoice) => invoice?.invoice_number || invoice?.number || `#${invoice?.id}`;
const getSupplierName = (invoice) =>
  invoice?.supplier?.name || invoice?.supplier_name || invoice?.vendor?.name || invoice?.vendor_name || '—';
const getInvoiceAmount = (invoice, key) => {
  if (key === 'paid') {
    return toNumber(invoice?.paid_amount ?? invoice?.paid ?? 0);
  }
  return toNumber(invoice?.total_amount ?? invoice?.total ?? invoice?.grand_total ?? invoice?.amount ?? 0);
};

const normalizeList = (response) => {
  const normalized = normalizePaginatedResponse(response);
  const raw = response?.data ?? {};
  const payload = normalized.payload || {};
  const paginationSource = payload?.pagination || raw?.pagination;

  const meta = paginationSource
    ? {
        page: Math.max(1, toNumber(paginationSource?.current_page ?? paginationSource?.page, normalized.meta.page)),
        perPage: Math.max(
          1,
          toNumber(paginationSource?.per_page ?? paginationSource?.perPage, PURCHASE_INVOICES_PER_PAGE)
        ),
        total: Math.max(0, toNumber(paginationSource?.total, normalized.meta.total)),
        lastPage: Math.max(
          1,
          toNumber(
            paginationSource?.last_page ?? paginationSource?.lastPage,
            normalized.meta.lastPage
          )
        ),
      }
    : normalized.meta;

  return {
    items: normalized.items,
    meta,
    payload,
  };
};

export default function PurchaseInvoicesPage() {
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cancellingInvoice, setCancellingInvoice] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelReasonError, setCancelReasonError] = useState('');

  const purchaseInvoicesQuery = useQuery({
    queryKey: ['purchase-invoices', currentPage, searchTerm, statusFilter],
    queryFn: async () =>
      normalizeList(
        await getPurchaseInvoices(currentPage, {
          search: searchTerm || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
        })
      ),
    keepPreviousData: true,
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }) => cancelPurchaseInvoice(id, { reason }),
    onSuccess: () => {
      toast.success('تم إلغاء الفاتورة بنجاح');
      setCancellingInvoice(null);
      setCancelReason('');
      setCancelReasonError('');
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
    },
    onError: (error) => {
      const apiMessage =
        error?.response?.data?.errors?.reason?.[0] ||
        error?.response?.data?.message ||
        'تعذر إلغاء الفاتورة';
      setCancelReasonError(apiMessage);
      toast.error(apiMessage);
    },
  });

  const onCancelConfirm = () => {
    const reason = cancelReason.trim();
    if (!reason) {
      setCancelReasonError('يرجى تقديم سبب لإلغاء الفاتورة.');
      return;
    }

    cancelMutation.mutate({ id: cancellingInvoice.id, reason });
  };

  const invoices = purchaseInvoicesQuery.data?.items || [];
  const meta = purchaseInvoicesQuery.data?.meta || { page: 1, lastPage: 1, total: 0, perPage: PURCHASE_INVOICES_PER_PAGE };

  const columns = useMemo(
    () => [
      {
        key: 'number',
        label: 'رقم الفاتورة',
        render: (_, row) => getInvoiceNumber(row),
      },
      {
        key: 'date',
        label: 'التاريخ',
        render: (value, row) => {
          const dateValue = value || getInvoiceDate(row);
          return dateValue ? formatDate(dateValue) : '—';
        },
      },
      {
        key: 'supplier',
        label: 'المورد',
        render: (_, row) => getSupplierName(row),
      },
      {
        key: 'total',
        label: 'الإجمالي',
        render: (value, row) => formatCurrency(value ?? getInvoiceAmount(row, 'total')),
      },
      {
        key: 'paid',
        label: 'المدفوع',
        render: (value, row) => formatCurrency(value ?? getInvoiceAmount(row, 'paid')),
      },
      {
        key: 'status',
        label: 'الحالة',
        render: (value) => <StatusBadge status={value || 'confirmed'} />,
      },
      {
        key: 'actions',
        label: 'إجراءات',
        render: (_, row) => (
          <div className="flex items-center gap-1">
            <Link
              to={`/store/purchase-invoices/${row.id}`}
              className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
              title="عرض"
            >
              <Eye className="h-4 w-4" />
            </Link>

            {row?.status !== 'cancelled' ? (
              <button
                type="button"
                onClick={() => {
                  setCancellingInvoice(row);
                  setCancelReason('');
                  setCancelReasonError('');
                }}
                className="rounded-md p-2 text-red-600 hover:bg-red-50"
                title="إلغاء"
              >
                <XCircle className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div>
      <PageHeader
        title="فواتير الشراء"
        subtitle="إدارة ومراجعة فواتير الشراء"
        actions={
          <Link to="/store/purchase-invoices/create">
            <Button type="button" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span>إضافة فاتورة شراء</span>
            </Button>
          </Link>
        }
      />

      <div className="mb-4 grid gap-3 rounded-xl border border-border bg-white p-3 md:grid-cols-3">
        <div className="relative md:col-span-2">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setCurrentPage(1);
            }}
            placeholder="بحث برقم الفاتورة أو اسم المورد..."
            className="pr-9"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setCurrentPage(1);
          }}
          className="h-11 rounded-lg border border-border bg-white px-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <option value="all">كل الحالات</option>
          <option value="confirmed">مؤكدة</option>
          <option value="cancelled">ملغاة</option>
        </select>
      </div>

      {purchaseInvoicesQuery.isLoading ? (
        <LoadingSpinner />
      ) : (
        <DataTable columns={columns} data={invoices} loading={purchaseInvoicesQuery.isFetching} emptyMessage="لا توجد فواتير شراء" />
      )}

      <Pagination
        currentPage={meta.page}
        lastPage={meta.lastPage}
        total={meta.total}
        perPage={meta.perPage}
        itemLabel="فاتورة"
        onPageChange={(nextPage) => {
          if (nextPage < 1 || nextPage > meta.lastPage) return;
          setCurrentPage(nextPage);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        isLoading={purchaseInvoicesQuery.isFetching}
      />

      <Dialog
        open={Boolean(cancellingInvoice)}
        onOpenChange={(open) => {
          if (!open) {
            setCancellingInvoice(null);
            setCancelReason('');
            setCancelReasonError('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إلغاء فاتورة الشراء {cancellingInvoice?.invoice_number || `#${cancellingInvoice?.id || ''}`}</DialogTitle>
            <DialogDescription>سيتم عكس المخزون والقيود المالية</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-sm font-medium text-text">سبب الإلغاء *</label>
            <textarea
              value={cancelReason}
              onChange={(event) => {
                setCancelReason(event.target.value);
                if (cancelReasonError) setCancelReasonError('');
              }}
              rows={4}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              placeholder="اكتب سبب الإلغاء"
            />
            {cancelReasonError ? <p className="text-sm text-danger">{cancelReasonError}</p> : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCancellingInvoice(null);
                setCancelReason('');
                setCancelReasonError('');
              }}
              disabled={cancelMutation.isPending}
            >
              إلغاء
            </Button>

            <Button
              type="button"
              onClick={onCancelConfirm}
              disabled={cancelMutation.isPending}
              className="bg-danger text-white hover:bg-red-700 focus-visible:ring-danger"
            >
              {cancelMutation.isPending ? 'جاري التنفيذ...' : 'تأكيد الإلغاء'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
