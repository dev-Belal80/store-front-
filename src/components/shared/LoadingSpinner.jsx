import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function LoadingSpinner({ size = 'md', className }) {
  if (size === 'sm') {
    return <Loader2 className={cn('h-4 w-4 animate-spin', className)} />;
  }

  return (
    <div className={cn('flex min-h-[240px] items-center justify-center', className)}>
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}