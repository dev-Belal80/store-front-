import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Pencil, Plus, Search, Trash2, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  createSupplier,
  deleteSupplier,
  getSuppliers,
  updateSupplier,
} from '../../../api/suppliers';
import BalanceDisplay from '../../../components/shared/BalanceDisplay';
import ConfirmDialog from '../../../components/shared/ConfirmDialog';
import DataTable from '../../../components/shared/DataTable';
import PageHeader from '../../../components/shared/PageHeader';
import LoadingSpinner from '../../../components/shared/LoadingSpinner';
import Pagination from '../../../components/shared/Pagination';
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
import { normalizePaginatedResponse } from '../../../utils/pagination';

const supplierSchema = z.object({
  name: z.string().min(1, 'الاسم مطلوب'),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export default function SuppliersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [deletingSupplier, setDeletingSupplier] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: '',
      phone: '',
      address: '',
      notes: '',
    },
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const suppliersQuery = useQuery({
    queryKey: ['suppliers', currentPage, searchTerm],
    queryFn: async () =>
      normalizePaginatedResponse(
        await getSuppliers(currentPage, {
          search: searchTerm || undefined,
        })
      ),
    keepPreviousData: true,
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, data }) => (id ? updateSupplier(id, data) : createSupplier(data)),
    onSuccess: () => {
      toast.success('تم حفظ بيانات المورد بنجاح');
      setIsFormOpen(false);
      setEditingSupplier(null);
      reset({ name: '', phone: '', address: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: () => toast.error('تعذر حفظ بيانات المورد'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteSupplier(id),
    onSuccess: () => {
      toast.success('تم حذف المورد بنجاح');
      setDeletingSupplier(null);
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
    onError: () => toast.error('تعذر حذف المورد'),
  });

  const suppliers = suppliersQuery.data?.items || [];
  const pagination = suppliersQuery.data?.meta || { page: 1, perPage: 10, total: suppliers.length, lastPage: 1 };

  const openCreateDialog = () => {
    setEditingSupplier(null);
    reset({ name: '', phone: '', address: '', notes: '' });
    setIsFormOpen(true);
  };

  const openEditDialog = useCallback((supplier) => {
    setEditingSupplier(supplier);
    reset({
      name: supplier?.name || '',
      phone: supplier?.phone || '',
      address: supplier?.address || '',
      notes: supplier?.notes || '',
    });
    setIsFormOpen(true);
  }, [reset]);

  const onSave = (values) => {
    saveMutation.mutate({ id: editingSupplier?.id, data: values });
  };

  const columns = useMemo(
    () => [
      {
        key: 'name',
        label: 'الاسم',
        render: (value) => <span className="font-semibold text-text">{value || '—'}</span>,
      },
      {
        key: 'phone',
        label: 'الهاتف',
        render: (value) => <span className="text-text-muted">{value || '—'}</span>,
      },
      {
        key: 'balance',
        label: 'الرصيد',
        render: (value) => <BalanceDisplay balance={Number(value) || 0} />,
      },
      {
        key: 'actions',
        label: 'إجراءات',
        render: (_, row) => (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                navigate(`/store/suppliers/${row.id}/statement`, {
                  state: { name: row?.name, phone: row?.phone, balance: Number(row?.balance) || 0 },
                })
              }
              className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
              title="كشف حساب"
            >
              <FileText className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => openEditDialog(row)}
              className="rounded-md p-2 text-blue-600 hover:bg-blue-50"
              title="تعديل"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setDeletingSupplier(row)}
              className="rounded-md p-2 text-red-600 hover:bg-red-50"
              title="حذف"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    [navigate, openEditDialog]
  );

  return (
    <div>
      <PageHeader
        title="الموردون"
        subtitle="إدارة بيانات الموردين وكشوف الحساب"
        actions={
          <Button type="button" onClick={openCreateDialog} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            <span>إضافة مورد</span>
          </Button>
        }
      />

      <div className="mb-4 rounded-xl border border-border bg-white p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="بحث بالاسم أو الهاتف..."
            className="pr-9"
          />
        </div>
      </div>

      {suppliersQuery.isLoading ? (
        <LoadingSpinner />
      ) : (
        <DataTable
          columns={columns}
          data={suppliers}
          loading={suppliersQuery.isFetching}
          emptyMessage="لا يوجد موردون"
          emptyIcon={Truck}
        />
      )}

      <Pagination
        currentPage={pagination.page}
        lastPage={pagination.lastPage}
        total={pagination.total}
        perPage={pagination.perPage}
        itemLabel="مورد"
        onPageChange={(nextPage) => {
          if (nextPage < 1 || nextPage > pagination.lastPage) return;
          setCurrentPage(nextPage);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        isLoading={suppliersQuery.isFetching}
      />

      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) {
            setEditingSupplier(null);
            reset({ name: '', phone: '', address: '', notes: '' });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSupplier ? 'تعديل بيانات المورد' : 'إضافة مورد جديد'}</DialogTitle>
            <DialogDescription>أدخل البيانات المطلوبة ثم اضغط حفظ.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSave)} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text">الاسم *</label>
              <Input {...register('name')} placeholder="اسم المورد" />
              {errors.name ? <p className="text-sm text-danger">{errors.name.message}</p> : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text">الهاتف</label>
              <Input {...register('phone')} placeholder="رقم الهاتف" dir="ltr" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text">العنوان</label>
              <Input {...register('address')} placeholder="عنوان المورد" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text">ملاحظات</label>
              <textarea
                {...register('notes')}
                rows={3}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                placeholder="ملاحظات إضافية"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} disabled={saveMutation.isPending}>
                إلغاء
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <LoadingSpinner size="sm" className="text-white" />
                    جاري الحفظ...
                  </span>
                ) : (
                  'حفظ'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deletingSupplier)}
        title="تأكيد الحذف"
        message={`هل أنت متأكد من حذف ${deletingSupplier?.name || 'هذا المورد'}؟`}
        onCancel={() => setDeletingSupplier(null)}
        onConfirm={() => deleteMutation.mutate(deletingSupplier.id)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}