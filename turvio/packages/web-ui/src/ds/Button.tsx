import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import * as React from "react";
import { cn } from "./cn";

export const buttonVariants = cva(
  "relative inline-flex shrink-0 select-none items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-xl text-[13.5px] font-bold transition-[background-color,border-color,color,box-shadow,transform] duration-[var(--duration-base)] ease-[var(--ease-out-quart)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 g:rounded-md g:text-[13px] g:font-medium g:active:scale-100 g:hover:translate-y-0 g:[&_svg]:size-[15px]",
  {
    variants: {
      variant: {
        // .btn-primary: violet gradient, inner highlight, glow; a light sheen sweeps across on hover.
        primary:
          "border-0 bg-[linear-gradient(135deg,var(--violet-hi)_0%,var(--violet)_55%,#4F3BE0_100%)] text-on-accent shadow-[var(--shadow-primary)] hover:-translate-y-px hover:shadow-[var(--shadow-primary-hover)] after:pointer-events-none after:absolute after:inset-0 after:-translate-x-[120%] after:bg-[linear-gradient(110deg,transparent_30%,rgba(255,255,255,.28)_50%,transparent_70%)] after:transition-transform after:duration-700 hover:after:translate-x-[120%] g:bg-none g:bg-brand-600 g:after:hidden g:hover:bg-[color-mix(in_srgb,var(--violet)_88%,white)]",
        dark: "border border-line-strong bg-navy text-ink hover:-translate-y-px hover:bg-navy-800 [[data-theme=light]_&]:text-white g:border-transparent",
        secondary: "border border-line-strong bg-surface text-ink hover:-translate-y-px hover:border-line-3 g:border-line-2 g:bg-surface-2 g:hover:bg-[var(--selected)] g:hover:border-line-2",
        ghost: "font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink g:font-medium g:hover:bg-[var(--hover)]",
        danger: "border border-line-strong bg-surface text-danger-ink hover:-translate-y-px hover:bg-danger-soft",
      },
      size: {
        sm: "h-8 rounded-[10px] px-3 text-[12.5px] g:h-7 g:rounded-md g:px-2.5 g:text-[12.5px]",
        md: "h-10 px-4 g:h-8 g:px-3",
        lg: "h-11 px-5 text-[15px] g:h-9 g:px-4 g:text-[13.5px]",
        icon: "size-10 g:size-8",
        "icon-sm": "size-8 rounded-[10px] g:size-7 g:rounded-md",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, type, ...props },
  ref,
) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp ref={ref} type={asChild ? undefined : (type ?? "button")} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-line-strong px-1.5 font-sans text-[11px] font-bold text-muted g:h-[18px] g:rounded g:font-medium", className)}>
      {children}
    </kbd>
  );
}
