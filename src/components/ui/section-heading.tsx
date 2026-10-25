import type { ReactNode } from 'react';
import { Typography } from '@/components/ui/typography';
import { cn } from '@/lib/utils';

type HeadingLevel = 'h1' | 'h2' | 'h3';

type SectionHeadingProps = {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  level?: HeadingLevel;
  className?: string;
  contentClassName?: string;
  descriptionClassName?: string;
};

function SectionHeading({
  title,
  eyebrow,
  description,
  action,
  level = 'h2',
  className,
  contentClassName,
  descriptionClassName,
}: SectionHeadingProps) {
  const isPageHeading = level === 'h1';

  return (
    <header
      className={cn(
        'flex flex-col justify-between gap-4',
        isPageHeading ? 'lg:flex-row lg:items-end' : 'sm:flex-row sm:items-end',
        className,
      )}
    >
      <div className={cn('min-w-0', contentClassName)}>
        {eyebrow && (
          <Typography as="p" variant="eyebrow">
            {eyebrow}
          </Typography>
        )}
        <Typography
          as={level}
          variant={isPageHeading ? 'pageTitle' : 'sectionTitle'}
          className={eyebrow ? 'mt-2' : undefined}
        >
          {title}
        </Typography>
        {description && (
          <Typography
            variant="muted"
            className={cn(
              isPageHeading ? 'mt-3 text-base leading-7 sm:text-lg' : 'mt-2 max-w-2xl',
              descriptionClassName,
            )}
          >
            {description}
          </Typography>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export { SectionHeading };
