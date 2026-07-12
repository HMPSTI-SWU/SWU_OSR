import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-geist-md bg-geist-canvas-soft-2 dark:bg-neutral-800',
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
