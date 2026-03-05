import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, HandCoins, Plus, Search, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getCustomers } from '../../../api/customers';
import { createCustomerPayment } from '../../../api/payments';
import { cancelSalesInvoice, getSalesInvoice, getSalesInvoices } from '../../../api/salesInvoices';
import BalanceDisplay from '../../../components/shared/BalanceDisplay';
import DataTable from '../../../components/shared/DataTable';
import LoadingSpinner from '../../../components/shared/LoadingSpinner';
import PageHeader from '../../../components/shared/PageHeader';
import Pagination from '../../../components/shared/Pagination';
import StatusBadge from '../../../components/shared/StatusBadge';
import { Button } from '../../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import { normalizePaginatedResponse } from '../../../utils/pagination';

const customerReceiptSchema = z.object({
  party_id: z.coerce.number().min(1, 'العميل مطلوب'),
  amount: z.coerce.number().min(0.01, 'المبلغ يجب أن يكون أكبر من صفر'),
  notes: z.string().optional(),
  date: z.string().min(1, 'التاريخ مطلوب'),
});

const getTodayDate = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const extractItems = (response) => {
  const payload = response?.data?.data ?? response?.data ?? [];
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.customers)) return payload.customers;
  if (Array.isArray(payload)) return payload;
  return [];
};

const extractInvoicePayload = (response) => {
  const payload = response?.data?.data ?? response?.data ?? {};
  return payload?.invoice ?? payload;
};

const SALES_INVOICES_PER_PAGE = 10;

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getInvoiceDate = (invoice) => invoice?.date || invoice?.invoice_date || invoice?.created_at || null;
const getInvoiceNumber = (invoice) => invoice?.invoice_number || invoice?.number || `INV-${invoice?.id}`;
const getCustomerName = (invoice) =>
  invoice?.customer?.name || invoice?.customer_name || invoice?.client?.name || invoice?.client_name || '—';
const getInvoiceAmount = (invoice, key) => {
  if (key === 'paid') return toNumber(invoice?.paid_amount ?? invoice?.paid ?? 0);
  if (key === 'remaining') return toNumber(invoice?.remaining_amount ?? invoice?.due_amount ?? invoice?.remaining ?? 0);
  return toNumber(invoice?.total_amount ?? invoice?.total ?? invoice?.grand_total ?? invoice?.amount ?? 0);
};

const normalizeList = (response) => {
  const normalized = normalizePaginatedResponse(response);
  const raw = response?.data ?? {};
  const payload = normalized.payload || {};
  const fallbackInvoices = Array.isArray(payload?.invoices)
    ? payload.invoices
    : Array.isArray(raw?.invoices)
      ? raw.invoices
      : [];
  const items = normalized.items.length > 0 ? normalized.items : fallbackInvoices;
  const paginationSource = payload?.pagination || raw?.pagination;

  const meta = paginationSource
    ? {
        page: Math.max(1, toNumber(paginationSource?.current_page ?? paginationSource?.page, normalized.meta.page)),
        perPage: Math.max(1, toNumber(paginationSource?.per_page ?? paginationSource?.perPage, SALES_INVOICES_PER_PAGE)),
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
    items,
    meta,
    payload,
  };
};

const getStatusOptions = () => [
  { value: '', label: 'كل الحالات' },
  { value: 'confirmed', label: 'مؤكدة' },
  { value: 'cancelled', label: 'ملغاة' },
];

export default function SalesInvoicesPage() {
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({
    customer_id: '',
    status: '',
    from: '',
    to: '',
  });
  const [detailsInvoiceId, setDetailsInvoiceId] = useState(null);
  const [cancelInvoice, setCancelInvoice] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelReasonError, setCancelReasonError] = useState('');
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptSearchTerm, setReceiptSearchTerm] = useState('');
  const [debouncedReceiptSearchTerm, setDebouncedReceiptSearchTerm] = useState('');

  const {
    register: registerReceipt,
    handleSubmit: handleReceiptSubmit,
    reset: resetReceiptForm,
    watch: watchReceipt,
    setValue: setReceiptValue,
    formState: { errors: receiptErrors },
  } = useForm({
    resolver: zodResolver(customerReceiptSchema),
    defaultValues: {
      party_id: 0,
      amount: '',
      notes: '',
      date: getTodayDate(),
    },
  });

  const customersQuery = useQuery({
    queryKey: ['customers-for-sales-invoices'],
    queryFn: () => getCustomers(1, { per_page: 1000 }),
  });

  const customerReceiptsQuery = useQuery({
    queryKey: ['customers-for-sales-receipts', debouncedReceiptSearchTerm],
    queryFn: () => getCustomers(1, { per_page: 1000, search: debouncedReceiptSearchTerm || undefined }),
    enabled: isReceiptModalOpen,
  });

  const salesInvoicesQuery = useQuery({
    queryKey: ['sales-invoices', currentPage, filters],
    queryFn: async () =>
      normalizeList(
        await getSalesInvoices(currentPage, {
          status: filters.status || undefined,
          customer_id: filters.customer_id || undefined,
          from: filters.from || undefined,
          to: filters.to || undefined,
        })
      ),
    keepPreviousData: true,
  });

  const invoiceDetailsQuery = useQuery({
    queryKey: ['sales-invoice-details', detailsInvoiceId],
    queryFn: async () => extractInvoicePayload(await getSalesInvoice(detailsInvoiceId)),
    enabled: Boolean(detailsInvoiceId),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }) => cancelSalesInvoice(id, { reason }),
    onSuccess: () => {
      toast.success('تم إلغاء الفاتورة بنجاح');
      setCancelInvoice(null);
      setCancelReason('');
      setCancelReasonError('');
      queryClient.invalidateQueries({ queryKey: ['sales-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['sales-invoice-details'] });
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

  const customerReceiptMutation = useMutation({
    mutationFn: (data) => createCustomerPayment(data),
    onSuccess: () => {
      toast.success('تم تسجيل التحصيل بنجاح');
      setIsReceiptModalOpen(false);
      setReceiptSearchTerm('');
      setDebouncedReceiptSearchTerm('');
      resetReceiptForm({
        party_id: 0,
        amount: '',
        notes: '',
        date: getTodayDate(),
      });
      queryClient.invalidateQueries({ queryKey: ['sales-invoices'] });
    },
    onError: () => toast.error('تعذر حفظ سند القبض'),
  });

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedReceiptSearchTerm(receiptSearchTerm.trim());
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [receiptSearchTerm]);

  const invoices = salesInvoicesQuery.data?.items || [];
  const meta = salesInvoicesQuery.data?.meta || { page: 1, lastPage: 1, total: 0, perPage: SALES_INVOICES_PER_PAGE };
  const customers = extractItems(customersQuery.data);
  const customersForReceipt = extractItems(customerReceiptsQuery.data);
  const statusOptions = getStatusOptions();
  const selectedCustomerId = Number(watchReceipt('party_id')) || 0;
  const selectedCustomer = customersForReceipt.find((customer) => Number(customer.id) === selectedCustomerId);

  const onSubmitCustomerReceipt = (values) => {
    customerReceiptMutation.mutate(values);
  };

  const columns = useMemo(
    () => [
      {
        key: 'number',
        label: 'رقم الفاتورة',
        render: (_, row) => (
          <span className="font-mono font-bold text-text">{getInvoiceNumber(row)}</span>
        ),
      },
      {
        key: 'customer',
        label: 'العميل',
        render: (_, row) => getCustomerName(row),
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
        key: 'remaining',
        label: 'المتبقي',
        render: (value, row) => {
          const remaining = Number(value ?? getInvoiceAmount(row, 'remaining'));
          return <span className={remaining > 0 ? 'font-semibold text-danger' : ''}>{formatCurrency(remaining)}</span>;
        },
      },
      {
        key: 'status',
        label: 'الحالة',
        render: (value) => <StatusBadge status={value || 'confirmed'} />,
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
        key: 'actions',
        label: 'إجراءات',
        render: (_, row) => (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setDetailsInvoiceId(row.id)}
              className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
              title="عرض"
            >
              <Eye className="h-4 w-4" />
            </button>

            {row?.status === 'confirmed' ? (
              <button
                type="button"
                onClick={() => {
                  setCancelInvoice(row);
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

  const detailsInvoice = invoiceDetailsQuery.data || {};
  const detailItems = Array.isArray(detailsInvoice?.items) ? detailsInvoice.items : [];

  const detailsColumns = [
    {
      key: 'product',
      label: 'المنتج',
      render: (_, row) => row?.product?.name || row?.product_name || '—',
    },
    {
      key: 'quantity',
      label: 'الكمية',
      render: (value) => Number(value ?? 0).toLocaleString('ar-EG'),
    },
    {
      key: 'unit_price',
      label: 'السعر',
      render: (value) => formatCurrency(value ?? 0),
    },
    {
      key: 'line_total',
      label: 'الإجمالي',
      render: (_, row) => formatCurrency((Number(row?.quantity) || 0) * (Number(row?.unit_price) || 0)),
    },
  ];

  const onCancelConfirm = () => {
    const reason = cancelReason.trim();
    if (!reason) {
      setCancelReasonError('سبب الإلغاء مطلوب');
      return;
    }

    cancelMutation.mutate({ id: cancelInvoice.id, reason });
  };

  return (
    <div>
      <PageHeader
        title="فواتير البيع"
        subtitle="إدارة ومراجعة فواتير البيع"
        actions={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => setIsReceiptModalOpen(true)}
            >
              <HandCoins className="h-4 w-4" />
              <span>تحصيل من عميل</span>
            </Button>

            <Link to="/store/sales-invoices/create">
              <Button type="button" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                <span>فاتورة جديدة</span>
              </Button>
            </Link>
          </div>
        }
      />

      <div className="mb-4 grid gap-3 rounded-xl border border-border bg-white p-3 md:grid-cols-4">
        <select
          value={filters.customer_id}
          onChange={(event) => {
            setCurrentPage(1);
            setFilters((previous) => ({ ...previous, customer_id: event.target.value }));
          }}
          className="h-11 rounded-lg border border-border bg-white px-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <option value="">كل العملاء</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>

        <select
          value={filters.status}
          onChange={(event) => {
            setCurrentPage(1);
            setFilters((previous) => ({ ...previous, status: event.target.value }));
          }}
          className="h-11 rounded-lg border border-border bg-white px-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {statusOptions.map((option) => (
            <option key={option.value || 'all'} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={filters.from}
          onChange={(event) => {
            setCurrentPage(1);
            setFilters((previous) => ({ ...previous, from: event.target.value }));
          }}
          className="h-11 rounded-lg border border-border bg-white px-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />

        <input
          type="date"
          value={filters.to}
          onChange={(event) => {
            setCurrentPage(1);
            setFilters((previous) => ({ ...previous, to: event.target.value }));
          }}
          className="h-11 rounded-lg border border-border bg-white px-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
      </div>

      {salesInvoicesQuery.isLoading ? (
        <LoadingSpinner />
      ) : (
        <DataTable
          columns={columns}
          data={invoices}
          loading={salesInvoicesQuery.isFetching}
          emptyMessage="لا توجد فواتير بيع"
        />
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
        isLoading={salesInvoicesQuery.isFetching}
      />

      <Dialog open={Boolean(detailsInvoiceId)} onOpenChange={(open) => (!open ? setDetailsInvoiceId(null) : null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>تفاصيل فاتورة البيع</DialogTitle>
            <DialogDescription>
              {invoiceDetailsQuery.isLoading
                ? 'جاري تحميل التفاصيل...'
                : `رقم الفاتورة: ${detailsInvoice?.invoice_number || detailsInvoiceId || '—'}`}
            </DialogDescription>
          </DialogHeader>

          {invoiceDetailsQuery.isLoading ? (
            <LoadingSpinner />
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-slate-50 p-3 text-sm text-text-muted">
                <div>العميل: {detailsInvoice?.customer?.name || detailsInvoice?.customer_name || '—'}</div>
                <div>الحالة: {detailsInvoice?.status || '—'}</div>
                <div>الإجمالي: {formatCurrency(detailsInvoice?.total_amount || detailsInvoice?.total || 0)}</div>
                <div>المدفوع: {formatCurrency(detailsInvoice?.paid_amount || 0)}</div>
                <div>المتبقي: {formatCurrency(detailsInvoice?.remaining_amount || 0)}</div>
              </div>

              <DataTable columns={detailsColumns} data={detailItems} loading={false} emptyMessage="لا توجد بنود" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isReceiptModalOpen}
        onOpenChange={(open) => {
          setIsReceiptModalOpen(open);

          if (!open) {
            setReceiptSearchTerm('');
            setDebouncedReceiptSearchTerm('');
            resetReceiptForm({
              party_id: 0,
              amount: '',
              notes: '',
              date: getTodayDate(),
            });
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HandCoins className="h-5 w-5 text-green-600" />
              <span>سند قبض — تحصيل من عميل</span>
            </DialogTitle>
            <DialogDescription>سجّل تحصيل نقدي من  عميل</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleReceiptSubmit(onSubmitCustomerReceipt)} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text">العميل *</label>

              <div className="relative">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <Input
                  value={receiptSearchTerm}
                  onChange={(event) => {
                    setReceiptSearchTerm(event.target.value);
                    setReceiptValue('party_id', 0);
                  }}
                  placeholder="ابحث عن عميل..."
                  className="pr-9"
                />
              </div>

              {customerReceiptsQuery.isLoading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <select
                  {...registerReceipt('party_id')}
                  className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-text"
                >
                  <option value={0}>اختر عميلًا</option>
                  {customersForReceipt.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              )}

              {selectedCustomer ? (
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-text-muted">
                  {selectedCustomer.name} — الرصيد: <BalanceDisplay balance={Number(selectedCustomer.balance) || 0} />
                </div>
              ) : null}

              {receiptErrors.party_id ? <p className="text-sm text-danger">{receiptErrors.party_id.message}</p> : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-text">المبلغ *</label>
                <Input type="number" min="0" step="0.01" {...registerReceipt('amount')} />
                {receiptErrors.amount ? <p className="text-sm text-danger">{receiptErrors.amount.message}</p> : null}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-text">التاريخ</label>
                <Input type="date" {...registerReceipt('date')} />
                {receiptErrors.date ? <p className="text-sm text-danger">{receiptErrors.date.message}</p> : null}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text">الملاحظات</label>
              <Input {...registerReceipt('notes')} placeholder="ملاحظات إضافية" />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsReceiptModalOpen(false)}
                disabled={customerReceiptMutation.isPending}
              >
                إغلاق
              </Button>

              <Button type="submit" disabled={customerReceiptMutation.isPending}>
                {customerReceiptMutation.isPending ? 'جاري الحفظ...' : '💾 حفظ سند القبض'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(cancelInvoice)}
        onOpenChange={(open) => {
          if (!open) {
            setCancelInvoice(null);
            setCancelReason('');
            setCancelReasonError('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إلغاء الفاتورة رقم {cancelInvoice?.invoice_number || `INV-${cancelInvoice?.id || ''}`}</DialogTitle>
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
                setCancelInvoice(null);
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
