"use client";

import {
  Bell,
  Building2,
  ChartNoAxesCombined,
  ClipboardList,
  FileText,
  Gauge,
  Mail,
  Menu,
  Settings,
  ShieldCheck,
  ShieldAlert,
  UserRound,
  UsersRound,
  X,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

const navigation = [
  { label: "Dashboard", href: "/dashboard", icon: Gauge, permission: "dashboard:read" },
  { label: "Student Management", href: "/dashboard/students", icon: UsersRound, permission: "student:read" },
  {
    label: "Disciplinary Cases",
    href: "/dashboard/cases",
    icon: ShieldAlert,
    permission: "case:read",
  },
  {
    label: "Information Flow",
    href: "/dashboard/information",
    icon: ClipboardList,
    permission: "information:read",
  },
  { label: "Notifications", href: "/dashboard/notifications", icon: Bell, permission: "notifications:read" },
  { label: "Messages", href: "/dashboard/messages", icon: Mail, permission: "messages:read" },
  {
    label: "Reports and Analytics",
    href: "/dashboard/reports",
    icon: ChartNoAxesCombined,
    permission: "reports:read",
  },
  { label: "User Management", href: "/dashboard/users", icon: UserRound, permission: "users:read" },
  { label: "Account Requests", href: "/dashboard/account-requests", icon: UserRound, permission: "users:request" },
  { label: "Account Approval", href: "/dashboard/account-approvals", icon: ShieldCheck, permission: "users:approve" },
  { label: "Campus Management", href: "/dashboard/campuses", icon: Building2, permission: "campuses:manage" },
  { label: "University Settings", href: "/dashboard/settings", icon: Settings, permission: "settings:manage" },
  { label: "My Profile", href: "/dashboard/profile", icon: FileText },
];

type DashboardShellProps = {
  children: ReactNode;
  userName: string;
  userEmail: string;
  permissions: string[];
};

export function DashboardShell({
  children,
  userName,
  userEmail,
  permissions,
}: DashboardShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [signOutError, setSignOutError] = useState<string>();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  async function handleSignOut() {
    setSignOutError(undefined);
    setIsSigningOut(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        setSignOutError("Unable to sign out. Please try again.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setSignOutError("Unable to sign out. Please try again.");
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="dashboard-root">
      <header className="dashboard-header">
        <button
          className="mobile-menu-button"
          type="button"
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileMenuOpen}
          aria-controls="dashboard-navigation"
        >
          {mobileMenuOpen ? (
            <X aria-hidden="true" size={18} />
          ) : (
            <Menu aria-hidden="true" size={18} />
          )}
          Menu
        </button>
        <Link className="dashboard-brand" href="/dashboard">
          <span className="brand-crest" aria-hidden="true">
            <Image
              src="/images/dilla-university-logo.jpg"
              alt=""
              width={38}
              height={48}
            />
          </span>
          <span className="dashboard-brand-text">
            <span className="dashboard-brand-title">DILLA UNIVERSITY</span>
            <span className="dashboard-brand-subtitle">
              Peace Forum Information Management System
            </span>
          </span>
        </Link>
        <div className="dashboard-user">
          {permissions.includes("notifications:read") ? (
            <Link
              className="notification-link"
              href="/dashboard/notifications"
              aria-label="View notifications"
            >
              <Bell aria-hidden="true" size={18} />
            </Link>
          ) : null}
          <Link
            className="user-avatar"
            href="/dashboard/profile"
            aria-label="Open my profile"
          >
            <UserRound aria-hidden="true" size={19} />
          </Link>
          <span className="user-details">
            <strong>{userName}</strong>
            <span>{userEmail}</span>
          </span>
          <button
            className="signout-button"
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
          >
            <LogOut aria-hidden="true" size={15} />
            {isSigningOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </header>
      {signOutError ? (
        <p className="dashboard-signout-error" role="alert">
          {signOutError}
        </p>
      ) : null}
      <div className="dashboard-frame">
        <aside
          className={`dashboard-sidebar${mobileMenuOpen ? " is-open" : ""}`}
          id="dashboard-navigation"
        >
          <div className="sidebar-brand">
            <span className="brand-crest sidebar-brand-crest" aria-hidden="true">
              <Image
                src="/images/dilla-university-logo.jpg"
                alt=""
                width={34}
                height={34}
              />
            </span>
            <span>Dilla University</span>
          </div>
          <p className="sidebar-label">Main menu</p>
          <nav className="dashboard-nav" aria-label="Main navigation">
            {navigation
              .filter(({ permission }) => !permission || permissions.includes(permission))
              .map(({ label, href, icon: Icon }) => {
              const isActive =
                pathname === href ||
                (href !== "/dashboard" && pathname.startsWith(`${href}/`));
              return (
                <Link
                  className={`dashboard-nav-link${isActive ? " is-active" : ""}`}
                  href={href}
                  key={label}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Icon aria-hidden="true" size={17} />
                  {label}
                </Link>
              );
              })}
          </nav>
        </aside>
        <main className="dashboard-main">{children}</main>
      </div>
    </div>
  );
}
