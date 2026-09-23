import * as React from 'react';

import { cn } from '@/lib/utils';

export type FormProps = React.ComponentProps<'form'>;

function Form({ className, ...props }: FormProps) {
  return (
    <form data-slot="form" className={cn('space-y-6', className)} {...props} />
  );
}

export { Form };
