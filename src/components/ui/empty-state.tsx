import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Typography } from '@/components/ui/typography';
import { cn } from '@/lib/utils';

type EmptyStateProps = {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  titleAs?: 'h1' | 'h2' | 'h3';
  className?: string;
};

function EmptyState({
  title,
  description,
  icon,
  action,
  titleAs = 'h2',
  className,
}: EmptyStateProps) {
  return (
    <Card
      as="section"
      variant="outline"
      padding="lg"
      className={cn('items-center gap-0 border-dashed py-12 text-center', className)}
    >
      {icon && (
        <div
          aria-hidden="true"
          className="mb-3 grid size-12 place-items-center rounded-full bg-muted text-2xl"
        >
          {icon}
        </div>
      )}
      <Typography as={titleAs} variant="cardTitle" className="text-base">
        {title}
      </Typography>
      {description && (
        <Typography variant="muted" className="mt-2 max-w-md">
          {description}
        </Typography>
      )}
      {action && <div className="mt-6">{action}</div>}
    </Card>
  );
}

export { EmptyState };
