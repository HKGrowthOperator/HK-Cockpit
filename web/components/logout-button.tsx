"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }
  return (
    <button
      onClick={logout}
      className="border-border text-muted-foreground hover:text-foreground rounded-md border px-3 py-1.5 text-xs"
    >
      Abmelden
    </button>
  );
}
