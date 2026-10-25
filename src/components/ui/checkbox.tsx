import * as React from 'react';
import { cn } from '@/lib/utils';

function Checkbox({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      {...props}
      type="checkbox"
      data-slot="checkbox"
      className={cn(
        'size-4 shrink-0 cursor-pointer rounded border-input accent-primary focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    />
  );
}

export { Checkbox };
