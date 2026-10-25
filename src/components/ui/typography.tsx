import * as React from 'react';
import { cn } from '@/lib/utils';

type TypographyVariant =
  | 'display'
  | 'pageTitle'
  | 'sectionTitle'
  | 'cardTitle'
  | 'eyebrow'
  | 'body'
  | 'muted'
  | 'caption';

type TypographyProps = React.HTMLAttributes<HTMLElement> & {
  as?: React.ElementType;
  variant?: TypographyVariant;
};

const typographyVariants: Record<TypographyVariant, string> = {
  display: 'text-4xl leading-tight font-semibold tracking-tight sm:text-6xl lg:text-7xl',
  pageTitle: 'text-3xl font-semibold tracking-tight sm:text-4xl',
  sectionTitle: 'text-2xl font-semibold tracking-tight sm:text-3xl',
  cardTitle: 'text-base font-semibold tracking-tight',
  eyebrow: 'text-xs font-semibold tracking-[0.2em] text-primary uppercase',
  body: 'text-base leading-7',
  muted: 'text-sm leading-6 text-muted-foreground',
  caption: 'text-xs leading-5 text-muted-foreground',
};

function Typography({
  as: Component = 'p',
  variant = 'body',
  className,
  ...props
}: TypographyProps) {
  return (
    <Component
      data-slot="typography"
      className={cn(typographyVariants[variant], className)}
      {...props}
    />
  );
}

export { Typography, typographyVariants };
