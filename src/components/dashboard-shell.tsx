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
  ShieldAlert,
  UserRound,
  UsersRound,
  X,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";

const navigation = [
  { label: "Dashboard", href: "/dashboard", icon: Gauge, active: true },
  { label: "Student Management", icon: UsersRound },
  { label: "Disciplinary Cases", icon: ShieldAlert },
  { label: "Information Flow", icon: ClipboardList },
  { label: "Notifications", icon: Bell },
  { label: "Messages", icon: Mail },
  { label: "Reports and Analytics", icon: ChartNoAxesCombined },
  { label: "User Management", icon: UserRound },
  { label: "Campus Management", icon: Building2 },
  { label: "University Settings", icon: Settings },
  { label: "My Profile", icon: FileText },
];

type DashboardShellProps = {
  children: ReactNode;
  userName: string;
  userEmail: string;
};

export function DashboardShell({
  children,
  userName,
  userEmail,
}: DashboardShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [signOutError, setSignOutError] = useState<string>();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

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
              priority
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
          <Link
            className="notification-link"
            href="/dashboard#notifications-title"
            aria-label="View notifications"
          >
            <Bell aria-hidden="true" size={18} />
          </Link>
          <span className="user-avatar">
            <UserRound aria-hidden="true" size={19} />
          </span>
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
          <p className="sidebar-label">Main menu</p>
          <nav className="dashboard-nav" aria-label="Main navigation">
            {navigation.map(({ label, href, icon: Icon }) => {
              const isActive = href ? pathname === href : false;
              return href ? (
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
              ) : (
                <span
                  className="dashboard-nav-disabled"
                  key={label}
                  aria-disabled="true"
                  title="This module is planned for a later phase."
                >
                  <Icon aria-hidden="true" size={17} />
                  {label}
                </span>
              );
            })}
          </nav>
        </aside>
        <main className="dashboard-main">{children}</main>
      </div>
    </div>
  );
}
