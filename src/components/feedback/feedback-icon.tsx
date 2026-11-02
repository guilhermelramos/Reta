import {
  AlertTriangle,
  BellOff,
  ChartNoAxesColumn,
  Compass,
  FileWarning,
  KeyRound,
  TimerReset,
  WifiOff,
} from "lucide-react";
import type { FeedbackKind } from "@/lib/feedback/error-copy";

/** Ícone coerente com o tipo do erro; decorativo (o texto já explica). */
export function FeedbackIcon({
  kind,
  className,
}: {
  kind: FeedbackKind;
  className?: string;
}) {
  const props = { className, strokeWidth: 1.75, "aria-hidden": true as const };
  switch (kind) {
    case "offline":
      return <WifiOff {...props} />;
    case "rate-limit":
      return <TimerReset {...props} />;
    case "unauthorized":
    case "missing-key":
      return <KeyRound {...props} />;
    case "notifications":
      return <BellOff {...props} />;
    case "sheet":
      return <FileWarning {...props} />;
    case "block":
      return <Compass {...props} />;
    case "empty":
      return <ChartNoAxesColumn {...props} />;
    default:
      return <AlertTriangle {...props} />;
  }
}
