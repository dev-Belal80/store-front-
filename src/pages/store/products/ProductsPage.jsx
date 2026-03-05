import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, ChevronLeft, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getCategories } from '../../../api/categories';
import {
  addVariant,
  createProduct,
  deleteProduct,
  deleteVariant,
  getProducts,
  updateProduct,
  updateVariant,
} from '../../../api/products';
import ConfirmDialog from '../../../components/shared/ConfirmDialog';
import LoadingSpinner from '../../../components/shared/LoadingSpinner';
import Pagination from '../../../components/shared/Pagination';
import PageHeader from '../../../components/shared/PageHeader';
import { Button } from '../../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import { formatCurrency } from '../../../utils/formatters';

const productSchema = z.object({
  category_id: z.coerce.number().min(1, 'التصنيف مطلوب'),
  name: z.string().min(1, 'اسم المنتج مطلوب'),
});

const variantSchema = z.object({
  name: z.string().min(1, 'اسم الحجم مطلوب'),
  purchase_price: z.coerce.number().min(0, 'سعر الشراء غير صحيح'),
  sale_price: z.coerce.number().min(0, 'سعر البيع غير صحيح'),
  low_stock_threshold: z.coerce.number().min(0, 'حد التنبيه غير صحيح').default(0),
});

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const extractCategoryItems = (response) => {
  const payload = response?.data?.data ?? response?.data ?? [];
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
};

const extractProducts = (response) => {
  const payload = response?.data?.data ?? response?.data ?? {};
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
};

const getProductCategoryName = (product, categories) => {
  const directName =
    (typeof product?.category === 'string' ? product.category : '') ||
    product?.category?.name ||
    product?.category_name;
  if (directName) return directName;

  const categoryId = toNumber(product?.category_id ?? product?.categoryId);
  if (categoryId <= 0) return '—';

  const matched = categories.find((category) => toNumber(category?.id) === categoryId);
  return matched?.name || '—';
};

const getProductVariants = (product) => {
  if (Array.isArray(product?.variants)) return product.variants;
  return [];
};

const isVariantLowStock = (variant) => {
  if (Boolean(variant?.is_low_stock)) return true;
  const alertLimit = toNumber(variant?.low_stock_threshold);
  if (alertLimit <= 0) return false;
  const stock = toNumber(variant?.current_stock);
  return stock <= alertLimit;
};

const canDeleteProduct = (product) => {
  const variants = getProductVariants(product);
  if (!variants.length) return true;

  return variants.every((variant) => {
    const movementsCount = toNumber(
      variant?.stock_movements_count ?? variant?.movements_count ?? variant?.stock_movements ?? variant?.transactions_count
    );
    const hasMovements = Boolean(variant?.has_stock_movements ?? variant?.has_movements);
    return !hasMovements && movementsCount === 0;
  });
};

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [expandedProducts, setExpandedProducts] = useState({});

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [variantTargetProduct, setVariantTargetProduct] = useState(null);
  const [editingVariant, setEditingVariant] = useState(null);
  const [deletingProduct, setDeletingProduct] = useState(null);
  const [deletingVariant, setDeletingVariant] = useState(null);

  const {
    register: registerProduct,
    handleSubmit: handleSubmitProduct,
    reset: resetProduct,
    formState: { errors: productErrors },
  } = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: {
      category_id: 0,
      name: '',
    },
  });

  const {
    register: registerVariant,
    handleSubmit: handleSubmitVariant,
    reset: resetVariant,
    formState: { errors: variantErrors },
  } = useForm({
    resolver: zodResolver(variantSchema),
    defaultValues: {
      name: '',
      purchase_price: 0,
      sale_price: 0,
      low_stock_threshold: 0,
    },
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory]);

  const productsQuery = useQuery({
    queryKey: ['products', currentPage, searchTerm, selectedCategory],
    queryFn: () =>
      getProducts(currentPage, {
        search: searchTerm || undefined,
        category_id: selectedCategory || undefined,
      }),
    keepPreviousData: true,
  });

  const categoriesQuery = useQuery({
    queryKey: ['categories-for-products'],
    queryFn: () => getCategories({ page: 1, per_page: 1000 }),
  });

  const createProductMutation = useMutation({
    mutationFn: (payload) => createProduct(payload),
    onSuccess: (response) => {
      toast.success('تم حفظ المنتج بنجاح');
      setIsProductModalOpen(false);
      resetProduct({ category_id: 0, name: '' });

      const payload = response?.data?.data ?? response?.data ?? {};
      const createdProduct = payload?.product ?? payload;
      if (createdProduct?.id) {
        setVariantTargetProduct(createdProduct);
        setEditingVariant(null);
        resetVariant({
          name: '',
          purchase_price: 0,
          sale_price: 0,
          low_stock_threshold: 0,
        });
        setIsVariantModalOpen(true);
      }

      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: () => toast.error('تعذر حفظ المنتج'),
  });

  const addVariantMutation = useMutation({
    mutationFn: ({ productId, payload }) => addVariant(productId, payload),
    onSuccess: () => {
      toast.success('تمت إضافة الحجم بنجاح');
      setIsVariantModalOpen(false);
      setEditingVariant(null);
      setVariantTargetProduct(null);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: () => toast.error('تعذر إضافة الحجم'),
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ productId, payload }) => updateProduct(productId, payload),
    onSuccess: () => {
      toast.success('تم تعديل المنتج بنجاح');
      setIsProductModalOpen(false);
      setEditingProduct(null);
      resetProduct({ category_id: 0, name: '' });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: () => toast.error('تعذر تعديل المنتج'),
  });

  const updateVariantMutation = useMutation({
    mutationFn: ({ productId, variantId, payload }) => updateVariant(productId, variantId, payload),
    onSuccess: () => {
      toast.success('تم تعديل الحجم بنجاح');
      setIsVariantModalOpen(false);
      setEditingVariant(null);
      setVariantTargetProduct(null);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: () => toast.error('تعذر تعديل الحجم'),
  });

  const deleteVariantMutation = useMutation({
    mutationFn: ({ productId, variantId }) => deleteVariant(productId, variantId),
    onSuccess: () => {
      toast.success('تم حذف الحجم بنجاح');
      setDeletingVariant(null);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: () => toast.error('تعذر حذف الحجم'),
  });

  const deleteProductMutation = useMutation({
    mutationFn: (productId) => deleteProduct(productId),
    onSuccess: () => {
      toast.success('تم حذف المنتج بنجاح');
      setDeletingProduct(null);
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: () => toast.error('تعذر حذف المنتج'),
  });

  const categories = extractCategoryItems(categoriesQuery.data);
  const products = useMemo(() => extractProducts(productsQuery.data), [productsQuery.data]);

  useEffect(() => {
    setExpandedProducts((previous) => {
      const next = { ...previous };
      products.forEach((product) => {
        if (typeof next[product.id] === 'undefined') {
          next[product.id] = true;
        }
      });
      return next;
    });
  }, [products]);

  const productsResponse = productsQuery.data?.data?.data ?? productsQuery.data?.data ?? {};
  const total = toNumber(productsResponse?.total);
  const lastPage = toNumber(productsResponse?.last_page) || Math.max(1, Math.ceil(total / 10));

  const openCreateProductModal = () => {
    setEditingProduct(null);
    resetProduct({ category_id: 0, name: '' });
    setIsProductModalOpen(true);
  };

  const openEditProductModal = (product) => {
    setEditingProduct(product);
    resetProduct({
      category_id: toNumber(product?.category_id ?? product?.categoryId),
      name: product?.name || '',
    });
    setIsProductModalOpen(true);
  };

  const openAddVariantModal = (product) => {
    setVariantTargetProduct(product);
    setEditingVariant(null);
    resetVariant({
      name: '',
      purchase_price: 0,
      sale_price: 0,
      low_stock_threshold: 0,
    });
    setIsVariantModalOpen(true);
  };

  const openEditVariantModal = (product, variant) => {
    setVariantTargetProduct(product);
    setEditingVariant(variant);
    resetVariant({
      name: variant?.name || '',
      purchase_price: toNumber(variant?.purchase_price),
      sale_price: toNumber(variant?.sale_price),
      low_stock_threshold: toNumber(variant?.low_stock_threshold),
    });
    setIsVariantModalOpen(true);
  };

  const onSubmitProduct = (values) => {
    const payload = {
      category_id: Number(values.category_id),
      name: values.name?.trim() || '',
    };

    if (editingProduct?.id) {
      updateProductMutation.mutate({
        productId: editingProduct.id,
        payload,
      });
      return;
    }

    createProductMutation.mutate(payload);
  };

  const onSubmitVariant = (values) => {
    if (!variantTargetProduct?.id) {
      toast.error('لم يتم تحديد المنتج');
      return;
    }

    const payload = {
      name: values.name?.trim() || '',
      purchase_price: Number(values.purchase_price) || 0,
      sale_price: Number(values.sale_price) || 0,
      low_stock_threshold: Number(values.low_stock_threshold) || 0,
    };

    if (editingVariant?.id) {
      updateVariantMutation.mutate({
        productId: variantTargetProduct.id,
        variantId: editingVariant.id,
        payload,
      });
      return;
    }

    addVariantMutation.mutate({
      productId: variantTargetProduct.id,
      payload,
    });
  };

  const toggleExpanded = (productId) => {
    setExpandedProducts((previous) => ({
      ...previous,
      [productId]: !previous[productId],
    }));
  };

  const handlePageChange = (nextPage) => {
    if (nextPage < 1 || nextPage > lastPage) return;
    setCurrentPage(nextPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div>
      <PageHeader
        title="المنتجات"
        subtitle="إدارة المنتجات والأحجام"
        actions={
          <Button type="button" onClick={openCreateProductModal} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            <span>إضافة منتج</span>
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 rounded-xl border border-border bg-white p-3 md:grid-cols-2">
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="بحث بالمنتج أو الحجم..."
            className="pr-9"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={(event) => setSelectedCategory(event.target.value)}
          className="h-11 rounded-lg border border-border bg-white px-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <option value="">كل التصنيفات</option>
          {categories.map((category) => (
            <option key={category.id} value={String(category.id)}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-border bg-white">
        {productsQuery.isLoading ? (
          <div className="p-6">
            <LoadingSpinner />
          </div>
        ) : products.length === 0 ? (
          <p className="p-6 text-center text-sm text-text-muted">لا توجد منتجات</p>
        ) : (
          <div className="divide-y divide-border">
            {products.map((product) => {
              const categoryName = getProductCategoryName(product, categories);
              const variants = getProductVariants(product);
              const isExpanded = expandedProducts[product.id] ?? true;
              const productCanDelete = canDeleteProduct(product);

              return (
                <div key={product.id} className="p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50/70 px-3 py-2">
                    <button
                      type="button"
                      className="flex items-center gap-2 text-right"
                      onClick={() => toggleExpanded(product.id)}
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4 text-text-muted" /> : <ChevronLeft className="h-4 w-4 text-text-muted" />}
                      <div>
                        <p className="font-semibold text-text">{product?.name || '—'}</p>
                        <p className="text-xs text-text-muted">{categoryName}</p>
                      </div>
                    </button>

                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" className="h-8 px-3" onClick={() => openEditProductModal(product)}>
                        تعديل
                      </Button>
                      <Button type="button" variant="outline" className="h-8 px-3" onClick={() => openAddVariantModal(product)}>
                        + حجم
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-3 text-red-600"
                        onClick={() => setDeletingProduct(product)}
                        disabled={!productCanDelete}
                      >
                        حذف
                      </Button>
                    </div>
                  </div>

                  {!productCanDelete ? (
                    <p className="mt-2 text-xs text-amber-700">لا يمكن حذف المنتج لأن بعض الأحجام لها حركات مخزون.</p>
                  ) : null}

                  {isExpanded ? (
                    <div className="mr-5 mt-3 space-y-2 border-r border-border pr-4">
                      {variants.length === 0 ? (
                        <p className="text-sm text-text-muted">لا توجد أحجام لهذا المنتج.</p>
                      ) : (
                        variants.map((variant) => {
                          const lowStock = isVariantLowStock(variant);
                          const stock = toNumber(variant?.current_stock);
                          return (
                            <div
                              key={variant.id}
                              className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
                                lowStock ? 'border-amber-200 bg-amber-50' : 'border-border bg-white'
                              }`}
                            >
                              <div>
                                <div className="font-medium text-text">{variant?.name || '—'}</div>
                              </div>

                              <div className="flex flex-wrap items-center gap-4 text-sm">
                                <span className="font-semibold text-text">{formatCurrency(toNumber(variant?.sale_price))}</span>
                                <span className="text-text-muted">{stock.toLocaleString('ar-EG')} قطعة</span>
                                {lowStock ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                    ⚠️ منخفض
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">✅</span>
                                )}

                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => openEditVariantModal(product, variant)}
                                    className="rounded-md p-2 text-blue-600 hover:bg-blue-50"
                                    title="تعديل"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingVariant({ product, variant })}
                                    className="rounded-md p-2 text-red-600 hover:bg-red-50"
                                    title="حذف"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Pagination
        currentPage={currentPage}
        lastPage={lastPage}
        total={total}
        perPage={10}
        onPageChange={handlePageChange}
        isLoading={productsQuery.isFetching}
      />

      <Dialog
        open={isProductModalOpen}
        onOpenChange={(open) => {
          setIsProductModalOpen(open);
          if (!open) {
            setEditingProduct(null);
            resetProduct({ category_id: 0, name: '' });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'تعديل المنتج' : 'إضافة منتج جديد'}</DialogTitle>
            <DialogDescription>
              {editingProduct ? 'قم بتعديل بيانات المنتج الأساسية.' : 'أدخل بيانات المنتج الأساسية، ثم أضف الحجم.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitProduct(onSubmitProduct)} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text">التصنيف *</label>
              <select
                {...registerProduct('category_id')}
                className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <option value={0}>اختر التصنيف</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {productErrors.category_id ? <p className="text-sm text-danger">{productErrors.category_id.message}</p> : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text">اسم المنتج *</label>
              <Input {...registerProduct('name')} placeholder="اسم المنتج" />
              {productErrors.name ? <p className="text-sm text-danger">{productErrors.name.message}</p> : null}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsProductModalOpen(false)}
                disabled={createProductMutation.isPending || updateProductMutation.isPending}
              >
                إلغاء
              </Button>
              <Button type="submit" disabled={createProductMutation.isPending || updateProductMutation.isPending}>
                {createProductMutation.isPending || updateProductMutation.isPending
                  ? 'جاري الحفظ...'
                  : editingProduct
                    ? 'حفظ التعديلات'
                    : 'حفظ'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isVariantModalOpen}
        onOpenChange={(open) => {
          setIsVariantModalOpen(open);
          if (!open) {
            setEditingVariant(null);
            setVariantTargetProduct(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingVariant ? 'تعديل الحجم' : 'إضافة حجم'}</DialogTitle>
            <DialogDescription>
              {variantTargetProduct?.name ? `المنتج: ${variantTargetProduct.name}` : 'أدخل بيانات الحجم'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmitVariant(onSubmitVariant)} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text">اسم الحجم *</label>
              <Input {...registerVariant('name')} placeholder="مثال: 1 كيلو" />
              {variantErrors.name ? <p className="text-sm text-danger">{variantErrors.name.message}</p> : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-text">سعر الشراء *</label>
                <Input type="number" min="0" step="0.01" {...registerVariant('purchase_price')} />
                {variantErrors.purchase_price ? <p className="text-sm text-danger">{variantErrors.purchase_price.message}</p> : null}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-text">سعر البيع *</label>
                <Input type="number" min="0" step="0.01" {...registerVariant('sale_price')} />
                {variantErrors.sale_price ? <p className="text-sm text-danger">{variantErrors.sale_price.message}</p> : null}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-text">حد التنبيه</label>
              <Input type="number" min="0" step="1" {...registerVariant('low_stock_threshold')} />
              {variantErrors.low_stock_threshold ? (
                <p className="text-sm text-danger">{variantErrors.low_stock_threshold.message}</p>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsVariantModalOpen(false)}
                disabled={addVariantMutation.isPending || updateVariantMutation.isPending}
              >
                إلغاء
              </Button>
              <Button type="submit" disabled={addVariantMutation.isPending || updateVariantMutation.isPending}>
                {addVariantMutation.isPending || updateVariantMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deletingProduct)}
        title="تأكيد الحذف"
        message={`هل أنت متأكد من حذف ${deletingProduct?.name || 'هذا المنتج'}؟`}
        onCancel={() => setDeletingProduct(null)}
        onConfirm={() => deleteProductMutation.mutate(deletingProduct.id)}
        loading={deleteProductMutation.isPending}
      />

      <ConfirmDialog
        open={Boolean(deletingVariant)}
        title="تأكيد الحذف"
        message={`هل أنت متأكد من حذف الحجم ${deletingVariant?.variant?.name || ''}؟`}
        onCancel={() => setDeletingVariant(null)}
        onConfirm={() =>
          deleteVariantMutation.mutate({
            productId: deletingVariant.product.id,
            variantId: deletingVariant.variant.id,
          })
        }
        loading={deleteVariantMutation.isPending}
      />
    </div>
  );
}
