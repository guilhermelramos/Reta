import { useEffect, useState } from "react";

/**
 * Contagem regressiva do botão de retry (429). `seconds` nulo/zero libera o
 * botão na hora; quando o `Retry-After` chega, é ele que manda.
 */
export function useRetryCountdown(seconds?: number | null): number {
  const initial =
    seconds != null && Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 0;
  const [left, setLeft] = useState(initial);

  useEffect(() => {
    const start =
      seconds != null && Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 0;
    setLeft(start);
    if (!start) return;
    const timer = window.setInterval(() => {
      setLeft((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [seconds]);

  return left;
}
