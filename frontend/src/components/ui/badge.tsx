import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center px-3 py-1 text-xs font-bold uppercase tracking-wider",
  {
    variants: {
      variant: {
        default: "bg-millennium-cyan text-white",
        secondary: "border-2 border-millennium-slate text-millennium-slate",
        destructive: "bg-red-600 text-white",
        outline: "border-2 border-millennium-cyan text-millennium-cyan",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
