import type { ButtonHTMLAttributes } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold min-h-12 transition-colors disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg hover:bg-primary/90",
        surface: "border border-border bg-surface-2 text-fg hover:border-primary/50",
        tonal: "border-[1.5px] border-primary bg-primary-tonal text-primary hover:bg-primary/10",
        destructive: "border border-clay/60 bg-clay/15 text-clay-text hover:bg-clay/25",
        ghost: "bg-transparent text-fg hover:bg-surface-2",
        clay: "border border-clay/40 text-clay-text hover:bg-clay/10",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

type Props = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, asChild, type = "button", ...props }: Props) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant }), className)} type={asChild ? undefined : type} {...props} />;
}
