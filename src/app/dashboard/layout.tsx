import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { getAppSession } from "@/lib/backend-api";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await getAppSession();

  if (!session?.user.id) {
    redirect("/");
  }
  if (session.user.mustChangePassword) {
    redirect("/change-password");
  }

  return (
    <DashboardShell
      userName={session.user.name ?? session.user.email ?? "University user"}
      userEmail={session.user.email ?? ""}
    >
      {children}
    </DashboardShell>
  );
}
