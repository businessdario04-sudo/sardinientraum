import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-slate-900 text-white',
        secondary: 'bg-slate-100 text-slate-800',
        outline: 'border border-slate-200 text-slate-700',
        critical: 'bg-red-100 text-red-700 border border-red-200',
        high: 'bg-orange-100 text-orange-700 border border-orange-200',
        medium: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
        low: 'bg-green-100 text-green-700 border border-green-200',
        open: 'bg-slate-100 text-slate-700',
        assigned: 'bg-blue-100 text-blue-700',
        in_progress: 'bg-indigo-100 text-indigo-700',
        waiting: 'bg-amber-100 text-amber-700',
        completed: 'bg-green-100 text-green-700',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
