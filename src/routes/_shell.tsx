import { createFileRoute } from "@tanstack/react-router";
import { AndroidBackHandler } from "@/components/android-back";
import { ShellLayout } from "@/components/shell";

function ShellRoute() {
  return (
    <>
      <AndroidBackHandler />
      <ShellLayout />
    </>
  );
}

export const Route = createFileRoute("/_shell")({
  component: ShellRoute,
});
