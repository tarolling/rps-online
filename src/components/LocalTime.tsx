"use client";

import { ReactNode, useEffect, useState } from "react";

/**
 * Renders a timestamp formatted in the viewer's local timezone. Starts out
 * showing `fallback` (the server-rendered UTC string) so SSR and the initial
 * client render match, then swaps to the local-time string once mounted.
 */
export default function LocalTime({ ms, fallback, className, prefix }: { ms: number, fallback: string, className?: string, prefix?: ReactNode }) {
  const [text, setText] = useState(fallback);

  useEffect(() => {
    setText(new Date(ms).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }));
  }, [ms]);

  return <p className={className}>{prefix}{text}</p>;
}
