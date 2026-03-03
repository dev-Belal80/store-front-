import { useEffect, useRef, useState } from 'react';
import { CheckCircle, Eye, FileText, Paperclip, Trash2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from '../../api/axios';
import {
  deletePurchaseInvoiceAttachment,
  uploadPurchaseInvoiceAttachment,
} from '../../api/purchaseInvoices';
import { Button } from '../ui/button';
import ConfirmDialog from './ConfirmDialog';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const validateFile = (file) => {
  if (!file) return false;

  if (!ALLOWED_TYPES.includes(file.type)) {
    toast.error('صيغة الملف غير مدعومة. المسموح: JPG, PNG, PDF فقط');
    return false;
  }

  if (file.size > MAX_FILE_SIZE) {
    toast.error('حجم الملف يتجاوز 5 ميجابايت');
    return false;
  }

  return true;
};

export default function InvoiceAttachment({
  invoiceId,
  existingAttachment,
  onUploadSuccess,
  onDeleteSuccess,
}) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);

  const fileName = existingAttachment?.name || 'مرفق الفاتورة';
  const isPdf = fileName.toLowerCase().endsWith('.pdf');
  const hasAttachment = Boolean(existingAttachment);

  useEffect(() => {
    let activeUrl = '';

    const loadPreview = async () => {
      if (!invoiceId || !hasAttachment || isPdf) {
        setPreviewUrl('');
        return;
      }

      try {
        setLoadingPreview(true);
        const response = await axios.get(`/store/purchase-invoices/${invoiceId}/attachment`, {
          responseType: 'blob',
        });
        activeUrl = URL.createObjectURL(response.data);
        setPreviewUrl(activeUrl);
      } catch (error) {
        setPreviewUrl('');
        toast.error(error?.response?.data?.message || 'تعذر تحميل المعاينة');
      } finally {
        setLoadingPreview(false);
      }
    };

    loadPreview();

    return () => {
      if (activeUrl) {
        URL.revokeObjectURL(activeUrl);
      }
    };
  }, [invoiceId, hasAttachment, isPdf]);

  const handleUpload = async (file) => {
    if (!validateFile(file) || !invoiceId) return;

    try {
      setUploading(true);
      setProgress(0);

      const formData = new FormData();
      formData.append('attachment', file);

      await uploadPurchaseInvoiceAttachment(invoiceId, formData, {
        onUploadProgress: (event) => {
          const total = Number(event?.total) || 0;
          const loaded = Number(event?.loaded) || 0;
          const percent = total > 0 ? Math.round((loaded * 100) / total) : 0;
          setProgress(percent);
        },
      });

      toast.success('تم رفع المرفق بنجاح');
      onUploadSuccess?.();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'فشل رفع الملف');
    } finally {
      setUploading(false);
      setProgress(0);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleView = async () => {
    if (!invoiceId) return;

    const previewWindow = window.open('', '_blank');

    try {
      const response = await axios.get(`/store/purchase-invoices/${invoiceId}/attachment`, {
        responseType: 'blob',
      });

      const objectUrl = URL.createObjectURL(response.data);
      if (previewWindow) {
        previewWindow.location.href = objectUrl;
      } else {
        window.open(objectUrl, '_blank');
      }

      setTimeout(() => URL.revokeObjectURL(objectUrl), 60 * 1000);
    } catch (error) {
      if (previewWindow) {
        previewWindow.close();
      }
      toast.error(error?.response?.data?.message || 'تعذر فتح الملف');
    }
  };

  const handleDelete = async () => {
    if (!invoiceId) return;

    try {
      setDeleting(true);
      await deletePurchaseInvoiceAttachment(invoiceId);
      toast.success('تم حذف المرفق');
      setShowConfirmDelete(false);
      onDeleteSuccess?.();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'فشل حذف المرفق');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold text-text">
          <Paperclip className="h-4 w-4 text-primary" />
          <span>مرفق فاتورة المورد</span>
        </div>

        {hasAttachment ? (
          <span className="flex items-center gap-1 text-sm font-medium text-primary">
            <CheckCircle className="h-4 w-4" />
            <span>مرفق</span>
          </span>
        ) : null}
      </div>

      {uploading ? (
        <div className="space-y-2 rounded-lg border border-border bg-bg p-4">
          <div className="text-sm text-text">جاري الرفع...</div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <div className="text-xs text-text-muted">{progress}%</div>
        </div>
      ) : hasAttachment ? (
        <div className="space-y-3">
          {isPdf ? (
            <div className="flex min-h-28 flex-col items-center justify-center rounded-lg border border-border bg-bg p-4 text-center">
              <FileText className="mb-2 h-9 w-9 text-text-muted" />
              <div className="text-sm font-medium text-text">{fileName}</div>
              <div className="text-xs text-text-muted">ملف PDF</div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-bg">
              {loadingPreview ? (
                <div className="flex h-52 items-center justify-center text-sm text-text-muted">جاري تحميل المعاينة...</div>
              ) : previewUrl ? (
                <img src={previewUrl} alt={fileName} className="h-52 w-full object-cover" />
              ) : (
                <div className="flex h-52 items-center justify-center text-sm text-text-muted">لا يمكن عرض المعاينة</div>
              )}
            </div>
          )}

          <div className="text-sm text-text-muted">{fileName}</div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={handleView} className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              <span>{isPdf ? 'فتح الملف' : 'عرض كامل'}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => setShowConfirmDelete(true)}
              className="flex items-center gap-2 text-danger"
            >
              <Trash2 className="h-4 w-4" />
              <span>حذف المرفق</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div
            className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
              isDragging ? 'border-primary bg-bg' : 'border-border bg-bg'
            }`}
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);

              const file = event.dataTransfer?.files?.[0];
              if (file) {
                handleUpload(file);
              }
            }}
          >
            <Upload className="mx-auto mb-2 h-8 w-8 text-text-muted" />
            <div className="text-sm font-medium text-text">اسحب الملف هنا</div>
            <div className="text-sm text-text-muted">أو اضغط للاختيار</div>
            <div className="mt-2 text-xs text-text-muted">JPG • PNG • PDF</div>
            <div className="text-xs text-text-muted">الحد الأقصى 5MB</div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                handleUpload(file);
              }
            }}
          />

          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2"
          >
            <Paperclip className="h-4 w-4" />
            <span>اختر ملف</span>
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={showConfirmDelete}
        title="حذف المرفق"
        message="هل تريد حذف المرفق؟ لا يمكن التراجع عن هذا الإجراء."
        confirmLabel="حذف المرفق"
        onConfirm={handleDelete}
        onCancel={() => setShowConfirmDelete(false)}
        loading={deleting}
      />
    </div>
  );
}