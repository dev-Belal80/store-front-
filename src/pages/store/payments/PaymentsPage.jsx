import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { BanknoteArrowDown, HandCoins, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { getCustomers } from '../../../api/customers';
import { createCustomerPayment, createSupplierPayment } from '../../../api/payments';
import { getSuppliers } from '../../../api/suppliers';
import BalanceDisplay from '../../../components/shared/BalanceDisplay';
import LoadingSpinner from '../../../components/shared/LoadingSpinner';
import PageHeader from '../../../components/shared/PageHeader';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';

const paymentSchema = z.object({
  party_id: z.coerce.number().min(1, 'الطرف مطلوب'),
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
  if (Array.isArray(payload)) return payload;
  return [];
};

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = useState('customer');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      party_id: 0,
      amount: '',
      notes: '',
      date: getTodayDate(),
    },
  });

  const customersQuery = useQuery({
    queryKey: ['customers-for-payments', debouncedSearchTerm],
    queryFn: () => getCustomers(1, { per_page: 1000, search: debouncedSearchTerm || undefined }),
    enabled: activeTab === 'customer',
  });

  const suppliersQuery = useQuery({
    queryKey: ['suppliers-for-payments', debouncedSearchTerm],
    queryFn: () => getSuppliers(1, { per_page: 1000, search: debouncedSearchTerm || undefined }),
    enabled: activeTab === 'supplier',
  });

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const submitMutation = useMutation({
    mutationFn: (data) => (activeTab === 'customer' ? createCustomerPayment(data) : createSupplierPayment(data)),
    onSuccess: () => {
      toast.success(activeTab === 'customer' ? 'تم تسجيل التحصيل بنجاح' : 'تم تسجيل الدفع بنجاح');
      reset({
        party_id: 0,
        amount: '',
        notes: '',
        date: getTodayDate(),
      });
      setSearchTerm('');
      setDebouncedSearchTerm('');
    },
    onError: () => toast.error('تعذر حفظ السند'),
  });

  const parties = useMemo(() => {
    const raw = activeTab === 'customer' ? customersQuery.data : suppliersQuery.data;
    return extractItems(raw);
  }, [activeTab, customersQuery.data, suppliersQuery.data]);

  const selectedPartyId = Number(watch('party_id')) || 0;
  const selectedParty = parties.find((party) => Number(party.id) === selectedPartyId);

  const onSubmit = (values) => {
    submitMutation.mutate(values);
  };

  const loadingParties = customersQuery.isLoading || suppliersQuery.isLoading;

  return (
    <div>
      <PageHeader title="المدفوعات" subtitle="تسجيل سندات القبض والصرف" />

      <div className="mb-4 grid gap-2 md:grid-cols-2">
        <button
          type="button"
          onClick={() => {
            setActiveTab('customer');
            setSearchTerm('');
            setDebouncedSearchTerm('');
            setValue('party_id', 0);
          }}
          className={`rounded-xl border p-3 text-sm font-semibold transition-colors ${
            activeTab === 'customer'
              ? 'border-primary bg-primary text-white'
              : 'border-border bg-white text-text hover:border-primary'
          }`}
        >
          سند قبض — تحصيل من عميل
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('supplier');
            setSearchTerm('');
            setDebouncedSearchTerm('');
            setValue('party_id', 0);
          }}
          className={`rounded-xl border p-3 text-sm font-semibold transition-colors ${
            activeTab === 'supplier'
              ? 'border-primary bg-primary text-white'
              : 'border-border bg-white text-text hover:border-primary'
          }`}
        >
          سند صرف — دفع لمورد
        </button>
      </div>

      <div className="rounded-xl border border-border bg-white p-4">
        <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-text">
          {activeTab === 'customer' ? (
            <>
              <HandCoins className="h-5 w-5 text-green-600" />
              <span>تحصيل نقدي من عميل</span>
            </>
          ) : (
            <>
              <BanknoteArrowDown className="h-5 w-5 text-amber-600" />
              <span>دفع نقدي لمورد</span>
            </>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-text">{activeTab === 'customer' ? 'العميل *' : 'المورد *'}</label>

            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <Input
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setValue('party_id', 0);
                }}
                placeholder={activeTab === 'customer' ? 'ابحث عن عميل...' : 'ابحث عن مورد...'}
                className="pr-9"
              />
            </div>

            {loadingParties ? (
              <LoadingSpinner size="sm" />
            ) : (
              <select
                {...register('party_id')}
                className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-text"
              >
                <option value={0}>{activeTab === 'customer' ? 'اختر عميلًا' : 'اختر موردًا'}</option>
                {parties.map((party) => (
                  <option key={party.id} value={party.id}>
                    {party.name}
                  </option>
                ))}
              </select>
            )}

            {selectedParty ? (
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-text-muted">
                {selectedParty.name} — الرصيد: <BalanceDisplay balance={Number(selectedParty.balance) || 0} />
              </div>
            ) : null}

            {errors.party_id ? <p className="text-sm text-danger">{errors.party_id.message}</p> : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text">المبلغ *</label>
              <Input type="number" min="0" step="0.01" {...register('amount')} />
              {errors.amount ? <p className="text-sm text-danger">{errors.amount.message}</p> : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text">التاريخ</label>
              <Input type="date" {...register('date')} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-text">الملاحظات</label>
            <Input {...register('notes')} placeholder="ملاحظات إضافية" />
          </div>

          <Button type="submit" disabled={submitMutation.isPending}>
            {submitMutation.isPending
              ? 'جاري الحفظ...'
              : activeTab === 'customer'
                ? '💾 حفظ سند القبض'
                : '💾 حفظ سند الصرف'}
          </Button>
        </form>
      </div>
    </div>
  );
}
