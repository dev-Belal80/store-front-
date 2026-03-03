import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Tags, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { createCategory, deleteCategory, getCategories } from '../../../api/categories';
import ConfirmDialog from '../../../components/shared/ConfirmDialog';
import DataTable from '../../../components/shared/DataTable';
import LoadingSpinner from '../../../components/shared/LoadingSpinner';
import PaginationControls from '../../../components/shared/PaginationControls';
import PageHeader from '../../../components/shared/PageHeader';
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

const categorySchema = z.object({
  name: z.string().min(1, 'اسم التصنيف مطلوب'),
});

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
    },
  });

  const categoriesQuery = useQuery({
    queryKey: ['categories', page, perPage, searchTerm],
    queryFn: async () =>
      normalizePaginatedResponse(
        await getCategories({
          page,
          per_page: perPage,
          search: searchTerm || undefined,
        })
      ),
    keepPreviousData: true,
  });

  const categories = categoriesQuery.data?.items || [];
  const pagination = categoriesQuery.data?.meta || { page: 1, perPage, total: categories.length, lastPage: 1 };

  const createMutation = useMutation({
    mutationFn: (data) => createCategory(data),
    onSuccess: () => {
      toast.success('تم إضافة التصنيف بنجاح');
      setIsFormOpen(false);
      reset({ name: '' });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: () => toast.error('تعذر إضافة التصنيف'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteCategory(id),
    onSuccess: () => {
      toast.success('تم حذف التصنيف بنجاح');
      setDeletingCategory(null);
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: () => toast.error('تعذر حذف التصنيف'),
  });

  const columns = [
    {
      key: 'name',
      label: 'اسم التصنيف',
      render: (value) => <span className="font-semibold text-text">{value || '—'}</span>,
    },
    {
      key: 'products_count',
      label: 'عدد المنتجات',
      render: (value) => Number(value || 0),
    },
    {
      key: 'actions',
      label: 'إجراءات',
      render: (_, row) => (
        <button
          type="button"
          onClick={() => {
            const count = Number(row?.products_count || 0);
            if (count > 0) {
              toast.error(`لا يمكن حذف التصنيف — يحتوي على ${count} منتجات`);
              return;
            }

            setDeletingCategory(row);
          }}
          className="rounded-md p-2 text-red-600 hover:bg-red-50"
          title="حذف"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ),
    },
  ];

  const onCreate = (values) => {
    createMutation.mutate(values);
  };

  return (
    <div>
      <PageHeader
        title="التصنيفات"
        subtitle="إدارة تصنيفات المنتجات"
        actions={
          <Button type="button" onClick={() => setIsFormOpen(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            <span>تصنيف جديد</span>
          </Button>
        }
      />

      <div className="mb-4 rounded-xl border border-border bg-white p-3">
        <Input
          value={searchTerm}
          onChange={(event) => {
            setSearchTerm(event.target.value);
            setPage(1);
          }}
          placeholder="بحث باسم التصنيف..."
        />
      </div>

      {categoriesQuery.isLoading ? (
        <LoadingSpinner />
      ) : (
        <DataTable columns={columns} data={categories} loading={categoriesQuery.isFetching} emptyMessage="لا توجد تصنيفات" emptyIcon={Tags} />
      )}

      <PaginationControls
        page={pagination.page}
        perPage={pagination.perPage}
        total={pagination.total}
        lastPage={pagination.lastPage}
        onPageChange={(nextPage) => setPage(nextPage)}
        onPerPageChange={(nextPerPage) => {
          setPerPage(nextPerPage);
          setPage(1);
        }}
      />

      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) {
            reset({ name: '' });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إضافة تصنيف جديد</DialogTitle>
            <DialogDescription>أدخل اسم التصنيف ثم اضغط حفظ.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onCreate)} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text">اسم التصنيف</label>
              <Input {...register('name')} placeholder="اسم التصنيف" />
              {errors.name ? <p className="text-sm text-danger">{errors.name.message}</p> : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} disabled={createMutation.isPending}>
                إلغاء
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? (
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
        open={Boolean(deletingCategory)}
        title="تأكيد الحذف"
        message={`هل أنت متأكد من حذف ${deletingCategory?.name || 'هذا التصنيف'}؟`}
        onCancel={() => setDeletingCategory(null)}
        onConfirm={() => deleteMutation.mutate(deletingCategory.id)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}