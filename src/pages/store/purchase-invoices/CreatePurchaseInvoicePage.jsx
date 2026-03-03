import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Plus, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { searchVariants } from '../../../api/products';
import { createPurchaseInvoice } from '../../../api/purchaseInvoices';
import { getSuppliers } from '../../../api/suppliers';
import LoadingSpinner from '../../../components/shared/LoadingSpinner';
import PageHeader from '../../../components/shared/PageHeader';
import SearchableSelect from '../../../components/shared/SearchableSelect';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { formatCurrency } from '../../../utils/formatters';

const getApiErrorMessage = (error, fallback) => {
  const data = error?.response?.data;
  const directMessage = data?.message;
  if (typeof directMessage === 'string' && directMessage.trim()) return directMessage;

  const errors = data?.errors;
  if (errors && typeof errors === 'object') {
    const firstError = Object.values(errors).flat().find((value) => typeof value === 'string' && value.trim());
    if (firstError) return firstError;
  }

  return fallback;
};

const itemSchema = z
  .object({
    variant_id: z.coerce.number().min(1, 'المنتج مطلوب'),
    ordered_quantity: z.coerce.number().int().min(1, 'الكمية المطلوبة يجب أن تكون أكبر من صفر'),
    received_quantity: z.coerce.number().int().min(0, 'الكمية المستلمة غير صحيحة'),
    unit_price: z.coerce.number().min(0, 'سعر الوحدة غير صحيح'),
  })
  .refine((values) => values.received_quantity <= values.ordered_quantity, {
    message: 'الكمية المستلمة لا تتجاوز المطلوبة',
    path: ['received_quantity'],
  });

const purchaseInvoiceSchema = z.object({
  supplier_id: z.coerce.number().min(1, 'المورد مطلوب'),
  paid_amount: z.coerce.number().min(0, 'المبلغ المدفوع غير صحيح'),
  items: z.array(itemSchema).min(1, 'أضف منتجًا واحدًا على الأقل'),
});

const defaultItem = {
  variant_id: 0,
  ordered_quantity: 1,
  received_quantity: 1,
  unit_price: 0,
};

const extractItems = (response) => {
  const payload = response?.data?.data ?? response?.data ?? [];
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
};

export default function CreatePurchaseInvoicePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedVariants, setSelectedVariants] = useState({});

  const {
    register,
    control,
    watch,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(purchaseInvoiceSchema),
    defaultValues: {
      supplier_id: 0,
      paid_amount: 0,
      items: [defaultItem],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const suppliersQuery = useQuery({
    queryKey: ['suppliers-for-purchase'],
    queryFn: () => getSuppliers(1, { per_page: 1000 }),
  });

  const createMutation = useMutation({
    mutationFn: (data) => createPurchaseInvoice(data),
    onSuccess: () => {
      toast.success('تم إنشاء فاتورة الشراء بنجاح');
      queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      navigate('/store/purchase-invoices');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'تعذر إنشاء فاتورة الشراء')),
  });

  const suppliers = extractItems(suppliersQuery.data);
  const itemsValues = watch('items');

  const totalAmount = itemsValues.reduce((sum, item) => {
    const received = Number(item?.received_quantity) || 0;
    const unitPrice = Number(item?.unit_price) || 0;
    return sum + received * unitPrice;
  }, 0);

  const onSubmit = (values) => {
    const payload = {
      supplier_id: Number(values.supplier_id),
      paid_amount: Number(values.paid_amount) || 0,
      items: values.items.map((item) => {
        const orderedQuantity = Number(item.ordered_quantity) || 0;
        const receivedQuantity = Number(item.received_quantity) || 0;
        const unitPrice = Number(item.unit_price) || 0;

        return {
          variant_id: Number(item.variant_id),
          ordered_quantity: orderedQuantity,
          received_quantity: receivedQuantity,
          quantity: receivedQuantity,
          unit_price: unitPrice,
        };
      }),
    };

    createMutation.mutate(payload);
  };

  if (suppliersQuery.isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div>
      <PageHeader
        title="إضافة فاتورة شراء"
        subtitle="تسجيل فاتورة شراء جديدة من المورد"
        actions={
          <Link to="/store/purchase-invoices">
            <Button type="button" variant="outline" className="flex items-center gap-2">
              <ArrowRight className="h-4 w-4" />
              <span>رجوع</span>
            </Button>
          </Link>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="rounded-xl border border-border bg-white p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text">المورد *</label>
              <select
                {...register('supplier_id')}
                className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <option value={0}>اختر المورد</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
              {errors.supplier_id ? <p className="text-sm text-danger">{errors.supplier_id.message}</p> : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text">المدفوع</label>
              <Input type="number" min="0" step="0.01" {...register('paid_amount')} />
              {errors.paid_amount ? <p className="text-sm text-danger">{errors.paid_amount.message}</p> : null}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-text">الأصناف</h3>
            <Button type="button" variant="outline" onClick={() => append(defaultItem)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span>إضافة صنف</span>
            </Button>
          </div>

          <div className="space-y-3">
            {fields.map((field, index) => {
              const row = itemsValues?.[index] || defaultItem;
              const selectedVariantId = Number(row.variant_id) || 0;
              const variant = selectedVariants[index];
              const stock = Number(variant?.current_stock ?? 0);
              const ordered = Number(itemsValues?.[index]?.ordered_quantity) || 0;
              const received = Number(itemsValues?.[index]?.received_quantity) || 0;
              const unitPrice = Number(itemsValues?.[index]?.unit_price) || 0;
              const rowTotal = received * unitPrice;
              const invalidReceived = received > ordered;

              return (
                <div key={field.id} className="rounded-lg border border-border p-3">
                  <div className="grid gap-3 lg:grid-cols-6">
                    <div className="lg:col-span-2 space-y-1">
                      <label className="text-xs font-medium text-text-muted">المنتج / الحجم</label>
                      <SearchableSelect
                        value={selectedVariantId || null}
                        onChange={(id, selectedVariant) => {
                          setValue(`items.${index}.variant_id`, id ?? 0, { shouldValidate: true, shouldDirty: true });
                          setValue(`items.${index}.unit_price`, selectedVariant?.purchase_price ?? selectedVariant?.sale_price ?? 0, {
                            shouldValidate: true,
                            shouldDirty: true,
                          });
                          setSelectedVariants((previous) => ({ ...previous, [index]: selectedVariant || null }));
                        }}
                        fetchFn={searchVariants}
                        queryKey={`purchase-variants-search-${index}`}
                        placeholder="ابحث عن منتج أو حجم..."
                        renderOption={(item) => {
                          const currentStock = Number(item.current_stock ?? 0);
                          return `${item.name} — المخزون: ${currentStock.toLocaleString('ar-EG')} قطعة`;
                        }}
                        renderSelected={(item) => item.name}
                        error={errors.items?.[index]?.variant_id?.message}
                      />
                      <input type="hidden" {...register(`items.${index}.variant_id`)} />
                      <p className="text-xs text-text-muted">
                        المتاح: {stock.toLocaleString('ar-EG')} قطعة
                      </p>
                      {errors.items?.[index]?.variant_id ? (
                        <p className="text-xs text-danger">{errors.items[index].variant_id.message}</p>
                      ) : null}
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-text-muted">المطلوب</label>
                      <Input type="number" min="1" step="1" {...register(`items.${index}.ordered_quantity`)} />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-text-muted">المستلم</label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        {...register(`items.${index}.received_quantity`)}
                        className={invalidReceived ? 'border-red-500 focus-visible:ring-red-500' : ''}
                      />
                      {invalidReceived ? <p className="text-xs text-danger">الكمية المستلمة لا تتجاوز المطلوبة</p> : null}
                      {errors.items?.[index]?.received_quantity ? (
                        <p className="text-xs text-danger">{errors.items[index].received_quantity.message}</p>
                      ) : null}
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-text-muted">سعر الوحدة</label>
                      <Input type="number" min="0" step="0.01" {...register(`items.${index}.unit_price`)} />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-text-muted">الإجمالي</label>
                      <div className="flex h-10 items-center rounded-md border border-border bg-slate-50 px-2 text-sm font-semibold text-text">
                        {formatCurrency(rowTotal)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedVariants((previous) => {
                          const updated = { ...previous };
                          delete updated[index];

                          const shifted = {};
                          Object.keys(updated).forEach((key) => {
                            const numericKey = Number(key);
                            const targetKey = numericKey > index ? numericKey - 1 : numericKey;
                            shifted[targetKey] = updated[key];
                          });

                          return shifted;
                        });
                        remove(index);
                      }}
                      disabled={fields.length === 1}
                      className="rounded-md p-2 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                      title="حذف الصنف"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {errors.items?.message ? <p className="mt-2 text-sm text-danger">{errors.items.message}</p> : null}
        </div>

        <div className="rounded-xl border border-border bg-white p-4">
          <div className="mb-3 text-lg font-bold text-text">الإجمالي الكلي: {formatCurrency(totalAmount)}</div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'جاري الحفظ...' : 'حفظ فاتورة الشراء'}
            </Button>
            <Link to="/store/purchase-invoices">
              <Button type="button" variant="outline">إلغاء</Button>
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
