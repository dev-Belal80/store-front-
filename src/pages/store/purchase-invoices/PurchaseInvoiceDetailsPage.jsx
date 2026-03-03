import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { getPurchaseInvoice } from '../../../api/purchaseInvoices';
import DataTable from '../../../components/shared/DataTable';
import InvoiceAttachment from '../../../components/shared/InvoiceAttachment';
import LoadingSpinner from '../../../components/shared/LoadingSpinner';
import PageHeader from '../../../components/shared/PageHeader';
import { Button } from '../../../components/ui/button';
import { formatCurrency, formatDate } from '../../../utils/formatters';

const extractPayload = (response) => response?.data?.data ?? response?.data ?? {};

export default function PurchaseInvoiceDetailsPage() {
  const { id } = useParams();

  const invoiceQuery = useQuery({
    queryKey: ['purchase-invoice-details', id],
    queryFn: async () => extractPayload(await getPurchaseInvoice(id)),
  });

  if (invoiceQuery.isLoading) {
    return <LoadingSpinner />;
  }

  const invoice = invoiceQuery.data || {};
  const items = Array.isArray(invoice?.items) ? invoice.items : [];
  const existingAttachment =
    invoice?.attachment
      ? {
          name: invoice.attachment?.name || invoice.attachment?.original_name || invoice.attachment_original_name || 'مرفق الفاتورة',
          url: invoice.attachment?.url || invoice.attachment?.path || invoice.attachment_path || null,
        }
      : invoice?.attachment_path || invoice?.attachment_original_name
        ? {
            name: invoice?.attachment_original_name || 'مرفق الفاتورة',
            url: invoice?.attachment_url || invoice?.attachment_path || null,
          }
        : null;

  const columns = [
    {
      key: 'product',
      label: 'المنتج',
      render: (_, row) => row?.product?.name || row?.product_name || '—',
    },
    {
      key: 'ordered_quantity',
      label: 'المطلوب',
    },
    {
      key: 'received_quantity',
      label: 'المستلم',
    },
    {
      key: 'unit_price',
      label: 'سعر الوحدة',
      render: (value) => formatCurrency(value || 0),
    },
    {
      key: 'line_total',
      label: 'الإجمالي',
      render: (_, row) => formatCurrency((Number(row?.received_quantity) || 0) * (Number(row?.unit_price) || 0)),
    },
  ];

  return (
    <div>
      <PageHeader
        title={`تفاصيل فاتورة شراء #${invoice?.invoice_number || id}`}
        subtitle={`التاريخ: ${invoice?.date ? formatDate(invoice.date) : '—'}`}
        actions={
          <Link to="/store/purchase-invoices">
            <Button type="button" variant="outline" className="flex items-center gap-2">
              <ArrowRight className="h-4 w-4" />
              <span>رجوع</span>
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="rounded-xl border border-border bg-white p-4 text-sm text-text-muted">
            <div>المورد: {invoice?.supplier?.name || invoice?.supplier_name || '—'}</div>
            <div>الحالة: {invoice?.status || '—'}</div>
            <div>التاريخ: {invoice?.date ? formatDate(invoice.date) : '—'}</div>
          </div>

          <DataTable columns={columns} data={items} loading={invoiceQuery.isFetching} emptyMessage="لا توجد أصناف" />
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-white p-4 text-sm text-text-muted">
            <div>الإجمالي: {formatCurrency(invoice?.total_amount || 0)}</div>
            <div>المدفوع: {formatCurrency(invoice?.paid_amount || 0)}</div>
            <div>المتبقي: {formatCurrency((Number(invoice?.total_amount) || 0) - (Number(invoice?.paid_amount) || 0))}</div>
          </div>

          <InvoiceAttachment
            invoiceId={invoice?.id || Number(id)}
            existingAttachment={existingAttachment}
            onUploadSuccess={invoiceQuery.refetch}
            onDeleteSuccess={invoiceQuery.refetch}
          />
        </div>
      </div>
    </div>
  );
}
