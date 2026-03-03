import { useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Plus, Save, Trash2 } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { z } from 'zod';
import { getCustomers } from '../../../api/customers';
import { getProducts } from '../../../api/products';
import { createSalesInvoice } from '../../../api/salesInvoices';
import LoadingSpinner from '../../../components/shared/LoadingSpinner';
import PageHeader from '../../../components/shared/PageHeader';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { formatCurrency } from '../../../utils/formatters';

const itemSchema = z.object({
  product_id: z.coerce.number().min(1, 'المنتج مطلوب'),
  quantity: z.coerce.number().min(0.001, 'الكمية يجب أن تكون أكبر من 0'),
  unit_price: z.coerce.number().min(0, 'السعر غير صحيح'),
});

const salesInvoiceSchema = z.object({
  customer_id: z.coerce.number().min(1, 'العميل مطلوب'),
  paid_amount: z.coerce.number().min(0, 'المبلغ المدفوع غير صحيح'),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, 'أضف بندًا واحدًا على الأقل'),
});

const defaultItem = {
  product_id: 0,
  quantity: 1,
  unit_price: 0,
};

const extractItems = (response) => {
  const payload = response?.data?.data ?? response?.data ?? [];
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.products)) return payload.products;
  if (Array.isArray(payload)) return payload;
  return [];
};

export default function CreateSalesInvoice() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    register,
    control,
    watch,
    handleSubmit,
    setError,
    clearErrors,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(salesInvoiceSchema),
    defaultValues: {
      customer_id: 0,
      paid_amount: 0,
      notes: '',
      items: [defaultItem],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const customersQuery = useQuery({
    queryKey: ['customers-for-sales-create'],
    queryFn: () => getCustomers(1, { per_page: 1000 }),
  });

  const productsQuery = useQuery({
    queryKey: ['products-for-sales-create'],
    queryFn: () => getProducts(1, { per_page: 1000 }),
  });

  const createMutation = useMutation({
    mutationFn: (payload) => createSalesInvoice(payload),
    onSuccess: (response) => {
      const payload = response?.data?.data ?? response?.data ?? {};
      const invoice = payload?.invoice ?? payload;
      const invoiceNumber = invoice?.invoice_number || `INV-${invoice?.id || 'XXXX'}`;
      toast.success(`تم إنشاء الفاتورة رقم ${invoiceNumber} بنجاح`);
      queryClient.invalidateQueries({ queryKey: ['sales-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      navigate('/store/sales-invoices');
    },
    onError: () => toast.error('تعذر إنشاء فاتورة البيع'),
  });

  const customers = extractItems(customersQuery.data);
  const products = extractItems(productsQuery.data);
  const productsById = useMemo(() => {
    const map = new Map();
    products.forEach((product) => map.set(Number(product.id), product));
    return map;
  }, [products]);

  const selectedCustomerId = Number(watch('customer_id')) || 0;
  const itemsValues = watch('items');
  const paidAmount = Number(watch('paid_amount')) || 0;

  const rows = useMemo(() => (Array.isArray(itemsValues) ? itemsValues : []), [itemsValues]);

  const totalAmount = useMemo(
    () =>
      rows.reduce((sum, item) => {
        const quantity = Number(item?.quantity) || 0;
        const unitPrice = Number(item?.unit_price) || 0;
        return sum + quantity * unitPrice;
      }, 0),
    [rows]
  );

  const remainingAmount = Math.max(totalAmount - paidAmount, 0);

  const stockViolations = useMemo(
    () =>
      rows.map((item) => {
        const product = productsById.get(Number(item?.product_id));
        const stock = Number(product?.current_stock ?? product?.stock ?? 0);
        const quantity = Number(item?.quantity) || 0;
        return quantity > stock;
      }),
    [rows, productsById]
  );

  const hasStockViolation = stockViolations.some(Boolean);
  const isSaveDisabled = fields.length === 0 || selectedCustomerId <= 0;

  const onSubmit = (values) => {
    if (hasStockViolation) {
      toast.error('لا يمكن حفظ الفاتورة: توجد كميات أكبر من المخزون المتاح');
      return;
    }

    if (Number(values.paid_amount) > totalAmount) {
      setError('paid_amount', {
        type: 'manual',
        message: 'المبلغ المدفوع لا يمكن أن يتجاوز الإجمالي',
      });
      return;
    }

    clearErrors('paid_amount');

    createMutation.mutate({
      customer_id: Number(values.customer_id),
      paid_amount: Number(values.paid_amount) || 0,
      notes: values.notes?.trim() || '',
      items: values.items.map((item) => ({
        product_id: Number(item.product_id),
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
      })),
    });
  };

  if (customersQuery.isLoading || productsQuery.isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div>
      <PageHeader
        title="إنشاء فاتورة بيع جديدة"
        subtitle="إضافة فاتورة بيع مع البنود والكميات والأسعار"
        actions={
          <Link to="/store/sales-invoices">
            <Button type="button" variant="outline" className="flex items-center gap-2">
              <ArrowRight className="h-4 w-4" />
              <span>رجوع</span>
            </Button>
          </Link>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-white p-4">
            <h2 className="mb-3 text-base font-semibold text-text">بيانات الفاتورة</h2>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-text">العميل *</label>
                <select
                  {...register('customer_id')}
                  className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <option value={0}>اختر العميل</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
                {errors.customer_id ? <p className="text-sm text-danger">{errors.customer_id.message}</p> : null}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-text">ملاحظات</label>
                <textarea
                  {...register('notes')}
                  rows={3}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  placeholder="ملاحظات إضافية..."
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-text">بنود الفاتورة</h2>
              <Button type="button" variant="outline" className="flex items-center gap-2" onClick={() => append(defaultItem)}>
                <Plus className="h-4 w-4" />
                <span>إضافة بند</span>
              </Button>
            </div>

            <div className="space-y-3">
              {fields.map((field, index) => {
                const row = rows[index] || defaultItem;
                const selectedProductId = Number(row.product_id) || 0;
                const selectedProduct = productsById.get(selectedProductId);
                const currentStock = Number(selectedProduct?.current_stock ?? selectedProduct?.stock ?? 0);
                const rowQuantity = Number(row.quantity) || 0;
                const rowUnitPrice = Number(row.unit_price) || 0;
                const rowTotal = rowQuantity * rowUnitPrice;
                const invalidStock = stockViolations[index];

                return (
                  <div key={field.id} className="rounded-lg border border-border p-3">
                    <div className="grid gap-3 lg:grid-cols-12">
                      <div className="space-y-1 lg:col-span-5">
                        <label className="text-xs font-medium text-text-muted">المنتج</label>
                        <select
                          {...register(`items.${index}.product_id`, {
                            onChange: (event) => {
                              const productId = Number(event.target.value) || 0;
                              const product = productsById.get(productId);
                              const salePrice = Number(product?.sale_price ?? product?.price ?? 0);
                              setValue(`items.${index}.unit_price`, salePrice, { shouldValidate: true, shouldDirty: true });
                            },
                          })}
                          className="h-10 w-full rounded-md border border-border bg-white px-2 text-sm text-text"
                        >
                          <option value={0}>اختر المنتج</option>
                          {products.map((product) => {
                            const stock = Number(product?.current_stock ?? product?.stock ?? 0);
                            return (
                              <option key={product.id} value={product.id}>
                                {product.name} — المخزون: {stock.toLocaleString('ar-EG')} وحدة
                              </option>
                            );
                          })}
                        </select>
                        {errors.items?.[index]?.product_id ? (
                          <p className="text-xs text-danger">{errors.items[index].product_id.message}</p>
                        ) : null}
                      </div>

                      <div className="space-y-1 lg:col-span-2">
                        <label className="text-xs font-medium text-text-muted">الكمية</label>
                        <Input
                          type="number"
                          min="0.001"
                          step="0.001"
                          {...register(`items.${index}.quantity`)}
                          className={invalidStock ? 'border-red-500 focus-visible:ring-red-500' : ''}
                        />
                        <p className="text-xs text-text-muted">المتاح: {currentStock.toLocaleString('ar-EG')} كيلو</p>
                        {invalidStock ? <p className="text-xs text-danger">الكمية أكبر من المخزون المتاح</p> : null}
                        {errors.items?.[index]?.quantity ? (
                          <p className="text-xs text-danger">{errors.items[index].quantity.message}</p>
                        ) : null}
                      </div>

                      <div className="space-y-1 lg:col-span-2">
                        <label className="text-xs font-medium text-text-muted">السعر</label>
                        <Input type="number" min="0" step="0.01" {...register(`items.${index}.unit_price`)} />
                        {errors.items?.[index]?.unit_price ? (
                          <p className="text-xs text-danger">{errors.items[index].unit_price.message}</p>
                        ) : null}
                      </div>

                      <div className="space-y-1 lg:col-span-2">
                        <label className="text-xs font-medium text-text-muted">الإجمالي</label>
                        <div className="flex h-10 items-center rounded-md border border-border bg-slate-50 px-2 text-sm font-semibold text-text">
                          {formatCurrency(rowTotal)}
                        </div>
                      </div>

                      <div className="flex items-end justify-end lg:col-span-1">
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          disabled={fields.length === 1}
                          className="rounded-md p-2 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                          title="حذف البند"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {errors.items?.message ? <p className="mt-2 text-sm text-danger">{errors.items.message}</p> : null}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Link to="/store/sales-invoices">
              <Button type="button" variant="outline">
                إلغاء
              </Button>
            </Link>

            <Button type="submit" disabled={isSaveDisabled || createMutation.isPending} className="flex items-center gap-2">
              <Save className="h-4 w-4" />
              <span>{createMutation.isPending ? 'جاري الحفظ...' : 'حفظ الفاتورة'}</span>
            </Button>
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div className="rounded-xl border border-border bg-white p-4">
            <h2 className="mb-3 text-base font-semibold text-text">ملخص الفاتورة</h2>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-text-muted">الإجمالي</span>
                <span className="font-bold text-text">{formatCurrency(totalAmount)}</span>
              </div>

              <div className="space-y-1">
                <label className="text-text-muted">المدفوع</label>
                <Input type="number" min="0" max={totalAmount} step="0.01" {...register('paid_amount')} />
                {errors.paid_amount ? <p className="text-xs text-danger">{errors.paid_amount.message}</p> : null}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-text-muted">المتبقي</span>
                <span className={`font-bold ${remainingAmount === 0 ? 'text-green-600' : 'text-danger'}`}>
                  {formatCurrency(remainingAmount)}
                </span>
              </div>

              {remainingAmount === 0 ? (
                <p className="text-sm font-medium text-green-600">مسدد بالكامل ✓</p>
              ) : (
                <p className="text-sm font-medium text-danger">متبقي {formatCurrency(remainingAmount)}</p>
              )}
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
}
