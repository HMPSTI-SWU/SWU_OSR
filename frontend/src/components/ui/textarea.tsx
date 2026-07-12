import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-geist-sm border border-geist-hairline bg-geist-canvas px-3 py-2 text-sm text-geist-ink placeholder:text-geist-mute focus:outline-none focus:ring-2 focus:ring-geist-ink/10 focus:border-geist-hairline-strong disabled:cursor-not-allowed disabled:opacity-50 transition-colors dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:placeholder:text-neutral-500 dark:focus:ring-white/10 dark:focus:border-neutral-600',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
