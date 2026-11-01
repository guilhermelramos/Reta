import { createFileRoute } from "@tanstack/react-router";
import { ShellLayout } from "@/components/shell";

export const Route = createFileRoute("/_shell")({
  component: ShellLayout,
});
