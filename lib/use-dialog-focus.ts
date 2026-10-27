"use client";
import { useCallback, useEffect, useRef } from "react";
/** Capture synchronously at launch, before autofocus moves into the dialog. */
export function useDialogFocus(open: boolean) {
  const outside = useRef<HTMLElement | null>(null);
  const remember = useCallback(() => {
    const el = document.activeElement;
    if (el instanceof HTMLElement && !el.closest("dialog"))
      outside.current = el;
  }, []);
  useEffect(() => {
    if (!open) return;
    const launcher = outside.current;
    return () => {
      requestAnimationFrame(() => {
        if (launcher?.isConnected) launcher.focus();
      });
    };
  }, [open]);
  return remember;
}
