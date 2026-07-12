import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-geist-ink/20 dark:focus-visible:ring-white/20 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-black disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // Marketing-scale black pill CTA — inverts in dark mode (white pill)
        default:
          'bg-geist-primary text-geist-on-primary hover:bg-geist-ink/90 dark:bg-white dark:text-black dark:hover:bg-neutral-200 rounded-geist-pill text-button-lg',
        // White pill paired with primary — inverts in dark mode (dark pill)
        secondary:
          'bg-geist-canvas text-geist-ink hover:bg-geist-canvas-soft dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800 rounded-geist-pill text-button-lg geist-level-1',
        // Destructive
        destructive:
          'bg-geist-error text-white hover:bg-geist-error-deep dark:bg-red-600 dark:hover:bg-red-700 rounded-geist-pill text-button-lg',
        // Outline — hairline border, white fill
        outline:
          'border border-geist-hairline bg-geist-canvas text-geist-ink hover:bg-geist-canvas-soft dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:hover:bg-neutral-800 rounded-geist-sm text-button-md',
        // Ghost — no border, no fill
        ghost:
          'text-geist-body hover:bg-geist-canvas-soft-2 hover:text-geist-ink dark:text-white dark:hover:bg-neutral-800 dark:hover:text-white rounded-geist-sm text-button-md',
        // Link style
        link: 'text-geist-link underline-offset-4 hover:underline dark:text-white text-body-sm',
        // Nav CTA — small black pill (6px radius) — inverts in dark
        'nav-primary':
          'bg-geist-primary text-geist-on-primary hover:bg-geist-ink/90 dark:bg-white dark:text-black dark:hover:bg-neutral-200 rounded-geist-sm text-body-sm-strong',
        // Nav secondary — white with hairline
        'nav-secondary':
          'bg-geist-canvas text-geist-ink border border-geist-hairline hover:bg-geist-canvas-soft dark:bg-neutral-900 dark:text-white dark:border-neutral-700 dark:hover:bg-neutral-800 rounded-geist-sm text-body-sm-strong',
      },
      size: {
        // Marketing scale — ~48px tall pill
        default: 'h-12 px-6 py-3',
        // Standard — 40px
        md: 'h-10 px-4 py-2',
        // Small — 32px (nav buttons, compact CTAs)
        sm: 'h-8 px-3 py-1.5',
        // Nav CTA — 28px
        nav: 'h-7 px-2 py-1',
        // Icon button
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
