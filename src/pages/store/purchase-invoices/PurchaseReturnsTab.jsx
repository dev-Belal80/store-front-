import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RotateCcw } from 'lucide-react';
import { getPurchaseReturns } from '../../../api/purchaseInvoices';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import CreatePurchaseReturnModal from './CreatePurchaseReturnModal';

const extractReturns = (response) => {
  const payload = response?.data?.data ?? response?.data ?? [];
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.returns)) return payload.returns;
  if (Array.isArray(payload)) return payload;
  return [];
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function PurchaseReturnsTab() {
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();

  const returnsQuery = useQuery({
    queryKey: ['purchase-returns'],
    queryFn: getPurchaseReturns,
  });

  const returns = extractReturns(returnsQuery.data);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-text">مرتجعات المشتريات</h2>
          <p className="text-sm text-text-muted">المنتجات المعادة إلى الموردين</p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <Plus size={16} />
          مرتجع جديد
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white">
        {returnsQuery.isLoading ? (
          <div className="p-8 text-center text-text-muted">جاري التحميل...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted">رقم المرتجع</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted">المورد</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted">الفاتورة الأصلية</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted">عدد الأصناف</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted">الإجمالي</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted">المبلغ المسترد</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted">المتبقي</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted">التاريخ</th>
              </tr>
            </thead>

            <tbody>
              {returns.map((ret) => {
                const returnNumber = ret?.return_number || ret?.number || `PR-${ret?.id || '—'}`;
                const supplierName = ret?.supplier_name || ret?.supplier?.name || '—';
                const invoiceNumber = ret?.invoice_number || ret?.purchase_invoice_number || '—';
                const itemsCount = Number(ret?.items_count ?? ret?.items?.length ?? 0) || 0;
                const totalAmount = toNumber(ret?.total_amount ?? ret?.total ?? ret?.amount);
                const refundAmount = toNumber(ret?.refund_amount ?? ret?.cash_refund_amount);
                const remainingAmount = toNumber(ret?.remaining_amount ?? ret?.remaining ?? totalAmount - refundAmount);
                const dateValue = ret?.date || ret?.return_date || ret?.created_at;

                return (
                  <tr key={ret?.id || returnNumber} className="border-b border-border last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-primary">{returnNumber}</td>
                    <td className="px-4 py-3 font-medium text-text">{supplierName}</td>
                    <td className="px-4 py-3 text-xs text-text-muted">
                      {invoiceNumber !== '—' ? (
                        <span className="rounded bg-slate-100 px-2 py-0.5 font-mono">{invoiceNumber}</span>
                      ) : (
                        <span className="text-text-muted">مرتجع مستقل</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-muted">{itemsCount} صنف</td>
                    <td className="px-4 py-3 font-mono font-medium text-text">{formatCurrency(totalAmount)}</td>
                    <td className="px-4 py-3 font-mono font-medium text-green-600">
                      {refundAmount > 0 ? formatCurrency(refundAmount) : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      <span className={remainingAmount > 0 ? 'font-medium text-danger' : 'text-green-600'}>
                        {remainingAmount > 0 ? formatCurrency(remainingAmount) : 'مكتمل'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-text-muted">{dateValue ? formatDate(dateValue) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {!returnsQuery.isLoading && returns.length === 0 ? (
          <div className="py-16 text-center text-text-muted">
            <RotateCcw size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">لا توجد مرتجعات بعد</p>
            <p className="mt-1 text-xs">اضغط "مرتجع جديد" لإنشاء أول مرتجع</p>
          </div>
        ) : null}
      </div>

      {showCreate ? (
        <CreatePurchaseReturnModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['purchase-returns'] });
            queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
            setShowCreate(false);
          }}
        />
      ) : null}
    </div>
  );
}
