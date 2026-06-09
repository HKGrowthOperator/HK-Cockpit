"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Lädt die Server-Daten in einem Intervall neu (für die Always-on-Wand).
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
