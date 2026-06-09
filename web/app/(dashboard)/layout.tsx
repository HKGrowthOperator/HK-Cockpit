import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

// Shell for the whole OS: sidebar + topbar around every module page.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  return <AppShell email={session?.email}>{children}</AppShell>;
}
