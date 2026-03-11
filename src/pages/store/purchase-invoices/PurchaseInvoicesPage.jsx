import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BanknoteArrowDown, Eye, Plus, Search, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { createSupplierPayment } from '../../../api/payments';
import { cancelPurchaseInvoice, getPurchaseInvoices } from '../../../api/purchaseInvoices';
import { getSuppliers } from '../../../api/suppliers';
import BalanceDisplay from '../../../components/shared/BalanceDisplay';
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
import PurchaseReturnsTab from './PurchaseReturnsTab';

const supplierPaymentSchema = z.object({
  party_id: z.coerce.number().min(1, 'المورد مطلوب'),
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
  if (Array.isArray(payload?.suppliers)) return payload.suppliers;
  if (Array.isArray(payload)) return payload;
  return [];
};

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
  const [activeTab, setActiveTab] = useState('invoices');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cancellingInvoice, setCancellingInvoice] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelReasonError, setCancelReasonError] = useState('');
  const [isSupplierPaymentModalOpen, setIsSupplierPaymentModalOpen] = useState(false);
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [debouncedSupplierSearchTerm, setDebouncedSupplierSearchTerm] = useState('');

  const {
    register: registerSupplierPayment,
    handleSubmit: handleSupplierPaymentSubmit,
    reset: resetSupplierPaymentForm,
    setValue: setSupplierPaymentValue,
    watch: watchSupplierPayment,
    formState: { errors: supplierPaymentErrors },
  } = useForm({
    resolver: zodResolver(supplierPaymentSchema),
    defaultValues: {
      party_id: 0,
      amount: '',
      notes: '',
      date: getTodayDate(),
    },
  });

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

  const suppliersForPaymentsQuery = useQuery({
    queryKey: ['suppliers-for-purchase-payments', debouncedSupplierSearchTerm],
    queryFn: () => getSuppliers(1, { per_page: 1000, search: debouncedSupplierSearchTerm || undefined }),
    enabled: isSupplierPaymentModalOpen,
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

  const supplierPaymentMutation = useMutation({
    mutationFn: (data) => createSupplierPayment(data),
    onSuccess: () => {
      toast.success('تم تسجيل الدفع بنجاح');
      setIsSupplierPaymentModalOpen(false);
      setSupplierSearchTerm('');
      setDebouncedSupplierSearchTerm('');
      resetSupplierPaymentForm({
        party_id: 0,
        amount: '',
        notes: '',
        date: getTodayDate(),
      });
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
    },
    onError: () => toast.error('تعذر حفظ سند الصرف'),
  });

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSupplierSearchTerm(supplierSearchTerm.trim());
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [supplierSearchTerm]);

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
  const suppliersForPayments = extractItems(suppliersForPaymentsQuery.data);
  const selectedSupplierId = Number(watchSupplierPayment('party_id')) || 0;
  const selectedSupplier = suppliersForPayments.find((supplier) => Number(supplier.id) === selectedSupplierId);

  const onSubmitSupplierPayment = (values) => {
    supplierPaymentMutation.mutate(values);
  };

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
          activeTab === 'invoices' ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="flex items-center gap-2"
                onClick={() => setIsSupplierPaymentModalOpen(true)}
              >
                <BanknoteArrowDown className="h-4 w-4" />
                <span>سند صرف لمورد</span>
              </Button>

              <Link to="/store/purchase-invoices/create">
                <Button type="button" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  <span>إضافة فاتورة شراء</span>
                </Button>
              </Link>
            </div>
          ) : null
        }
      />

      <div className="mb-4 flex w-fit overflow-hidden rounded-lg border border-border">
        {[
          { key: 'invoices', label: 'فواتير الشراء' },
          { key: 'returns', label: 'مرتجعات الشراء' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`border-l border-border px-4 py-2 text-sm font-medium transition-colors first:border-l-0 ${
              activeTab === tab.key ? 'bg-primary text-white' : 'bg-white text-text hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'invoices' ? (
        <>
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
            open={isSupplierPaymentModalOpen}
            onOpenChange={(open) => {
              setIsSupplierPaymentModalOpen(open);

              if (!open) {
                setSupplierSearchTerm('');
                setDebouncedSupplierSearchTerm('');
                resetSupplierPaymentForm({
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
                  <BanknoteArrowDown className="h-5 w-5 text-amber-600" />
                  <span>سند صرف — دفع لمورد</span>
                </DialogTitle>
                <DialogDescription>سجّل دفعًا نقديًا للمورد</DialogDescription>
              </DialogHeader>

          <form onSubmit={handleSupplierPaymentSubmit(onSubmitSupplierPayment)} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text">المورد *</label>

              <div className="relative">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <Input
                  value={supplierSearchTerm}
                  onChange={(event) => {
                    setSupplierSearchTerm(event.target.value);
                    setSupplierPaymentValue('party_id', 0);
                  }}
                  placeholder="ابحث عن مورد..."
                  className="pr-9"
                />
              </div>

              {suppliersForPaymentsQuery.isLoading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <select
                  {...registerSupplierPayment('party_id')}
                  className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-text"
                >
                  <option value={0}>اختر موردًا</option>
                  {suppliersForPayments.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              )}

              {selectedSupplier ? (
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-text-muted">
                  {selectedSupplier.name} — الرصيد: <BalanceDisplay balance={Number(selectedSupplier.balance) || 0} />
                </div>
              ) : null}

              {supplierPaymentErrors.party_id ? (
                <p className="text-sm text-danger">{supplierPaymentErrors.party_id.message}</p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-text">المبلغ *</label>
                <Input type="number" min="0" step="0.01" {...registerSupplierPayment('amount')} />
                {supplierPaymentErrors.amount ? (
                  <p className="text-sm text-danger">{supplierPaymentErrors.amount.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-text">التاريخ</label>
                <Input type="date" {...registerSupplierPayment('date')} />
                {supplierPaymentErrors.date ? (
                  <p className="text-sm text-danger">{supplierPaymentErrors.date.message}</p>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text">الملاحظات</label>
              <Input {...registerSupplierPayment('notes')} placeholder="ملاحظات إضافية" />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSupplierPaymentModalOpen(false)}
                disabled={supplierPaymentMutation.isPending}
              >
                إغلاق
              </Button>

              <Button type="submit" disabled={supplierPaymentMutation.isPending}>
                {supplierPaymentMutation.isPending ? 'جاري الحفظ...' : '💾 حفظ سند الصرف'}
              </Button>
            </DialogFooter>
          </form>
            </DialogContent>
          </Dialog>

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
        </>
      ) : (
        <PurchaseReturnsTab />
      )}
    </div>
  );
}
