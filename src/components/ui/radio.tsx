import * as React from 'react';
import { cn } from '@/lib/utils';

function Radio({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      {...props}
      type="radio"
      data-slot="radio"
      className={cn(
        'size-4 shrink-0 cursor-pointer accent-primary focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    />
  );
}

export { Radio };
