import { AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import LoadingSpinner from './LoadingSpinner';

const confirmColorClasses = {
  red: 'bg-danger hover:bg-red-700 focus-visible:ring-danger text-white',
  green: 'bg-primary hover:bg-primary-dark focus-visible:ring-primary text-white',
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'تأكيد',
  confirmColor = 'red',
  onConfirm,
  onCancel,
  loading = false,
}) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => (!isOpen ? onCancel?.() : null)}>
      <DialogContent>
        <DialogHeader>
          <div className="mb-2 flex items-center gap-2 text-amber-500">
            <AlertTriangle className="h-5 w-5" />
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            إلغاء
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={confirmColorClasses[confirmColor] || confirmColorClasses.red}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <LoadingSpinner size="sm" className="text-white" />
                جاري التنفيذ...
              </span>
            ) : (
              confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}