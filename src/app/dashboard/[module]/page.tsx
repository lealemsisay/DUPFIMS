import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Bell,
  Building2,
  ChartNoAxesCombined,
  ClipboardList,
  FileText,
  Mail,
  Settings,
  ShieldAlert,
  UsersRound,
} from "lucide-react";
import { redirect } from "next/navigation";
import { UserManagement } from "@/components/user-management";
import { CampusManagement } from "@/components/campus-management";
import { AccountRequestWorkspace } from "@/components/account-request-workspace";
import { AccountApprovalWorkspace } from "@/components/account-approval-workspace";
import { NotificationsWorkspace } from "@/components/notifications-workspace";
import { getAppSession } from "@/lib/backend-api";

const modulePermissions: Record<string, string> = {
  students: "student:read",
  cases: "case:read",
  information: "information:read",
  notifications: "notifications:read",
  messages: "messages:read",
  reports: "reports:read",
  users: "users:read",
  "account-requests": "users:request",
  "account-approvals": "users:approve",
  campuses: "campuses:manage",
  settings: "settings:manage",
};

const modules = {
  students: {
    title: "Student Management",
    description:
      "Student records, search, filters, and management actions will be available here.",
    icon: UsersRound,
  },
  cases: {
    title: "Disciplinary Case Management",
    description:
      "Authorized case records, review queues, and case-management actions will be available here.",
    icon: ShieldAlert,
  },
  information: {
    title: "Information Flow",
    description:
      "Information submissions, early-warning updates, and review workflows will be available here.",
    icon: ClipboardList,
  },
  notifications: {
    title: "Notifications",
    description:
      "Your notification inbox, read status, and notification actions will be available here.",
    icon: Bell,
  },
  messages: {
    title: "Messages",
    description:
      "Your university messages and conversations will be available here.",
    icon: Mail,
  },
  reports: {
    title: "Reports and Analytics",
    description:
      "Authorized reports and university analytics will be available here.",
    icon: ChartNoAxesCombined,
  },
  users: {
    title: "User Management",
    description:
      "User accounts, role assignments, and account-management actions will be available here.",
    icon: UsersRound,
  },
  "account-requests": {
    title: "Account Requests",
    description: "Submit and track approval of requested accounts.",
    icon: UsersRound,
  },
  "account-approvals": {
    title: "Account Approval",
    description: "Review pending account requests.",
    icon: UsersRound,
  },
  campuses: {
    title: "Campus Management",
    description:
      "Campus records, assignments, and campus-management actions will be available here.",
    icon: Building2,
  },
  settings: {
    title: "University Settings",
    description:
      "University-wide system settings and configuration will be available here.",
    icon: Settings,
  },
  profile: {
    title: "My Profile",
    description:
      "Your account information and profile settings will be available here.",
    icon: FileText,
  },
} as const;

export default async function DashboardModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const page = modules[module as keyof typeof modules];
  if (!page) notFound();

  const session = await getAppSession();
  if (!session?.user.id) redirect("/");
  const requiredPermission = modulePermissions[module];
  if (requiredPermission && !session.user.permissions.includes(requiredPermission)) {
    notFound();
  }

  if (module === "users") {
    const managerRole = session.user.roles.find(
      (role) =>
        role === "System Administrator" || role === "Peace Forum President",
    );
    if (managerRole) return <UserManagement managerRole={managerRole} />;
    return <AccountRequestWorkspace />;
  }
  if (module === "account-requests") return <AccountRequestWorkspace />;
  if (module === "account-approvals") {
    if (!session.user.roles.includes("Peace Forum President")) notFound();
    return <AccountApprovalWorkspace />;
  }
  if (module === "campuses") return <CampusManagement />;
  if (module === "notifications") return <NotificationsWorkspace />;

  const Icon = page.icon;

  return (
    <section className="module-page" aria-labelledby="module-title">
      <div className="dashboard-welcome">
        <div>
          <h1 id="module-title">{page.title}</h1>
          <p>Peace Forum Information Management System</p>
        </div>
      </div>
      <div className="module-placeholder">
        <Icon aria-hidden="true" size={38} />
        <h2>This module is under development</h2>
        <p>{page.description}</p>
        <p className="module-placeholder-note">
          No module data or actions are available yet. No changes will be
          submitted from this page.
        </p>
        <Link className="module-action-link" href="/dashboard">
          Back to dashboard
        </Link>
      </div>
    </section>
  );
}
