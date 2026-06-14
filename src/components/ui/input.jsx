import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

export const Input = forwardRef(({ className, type = 'text', dir, ...props }, ref) => {
  // Number inputs don't work correctly in RTL layouts in many browsers.
  // Auto-apply dir="ltr" for number inputs unless explicitly overridden.
  const resolvedDir = dir ?? (type === 'number' ? 'ltr' : undefined);

  return (
    <input
      ref={ref}
      type={type}
      dir={resolvedDir}
      className={cn(
        'flex h-11 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        className
      )}
      {...props}
    />
  );
});

Input.displayName = 'Input';