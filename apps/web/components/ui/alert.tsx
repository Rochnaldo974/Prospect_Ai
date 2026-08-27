import * as React from 'react';
import { cn } from '@/lib/utils/cn';

export function Alert({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<'div'> & { variant?: 'default' | 'destructive' | 'success' }) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-md border px-4 py-3 text-sm',
        variant === 'destructive' && 'border-destructive/40 bg-destructive/10 text-destructive',
        variant === 'success' && 'border-success/40 bg-success/10 text-success',
        variant === 'default' && 'border-border bg-muted/50 text-foreground',
        className,
      )}
      {...props}
    />
  );
}
