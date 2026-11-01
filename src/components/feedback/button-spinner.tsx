import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

/** Spinner de 20px usado dentro dos botões em loading. */
export function ButtonSpinner({ className }: { className?: string }) {
  return (
    <Loader2
      aria-hidden="true"
      className={cn("size-5 shrink-0 animate-spin", className)}
      strokeWidth={2}
    />
  );
}
