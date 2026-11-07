import Link from "next/link";
import Image from "next/image";
import { Megaphone } from "lucide-react";

const portalSections = [{ label: "Announcement", icon: Megaphone, muted: true }];

export function PortalHeader() {
  return (
    <header className="portal-header">
      <Link className="portal-brand" href="/" aria-label="Dilla University home">
        <span className="brand-crest" aria-hidden="true">
          <Image
            src="/images/dilla-university-logo.jpg"
            alt=""
            width={43}
            height={54}
            priority
          />
        </span>
        <span>
          <span className="brand-name">DILLA UNIVERSITY</span>
          <span className="brand-caption">DILLA UNIVERSITY PORTAL</span>
        </span>
      </Link>
      <nav className="portal-nav" aria-label="University portal">
        {portalSections.map(({ label, icon: Icon, muted }) => (
          <span
            className={`portal-nav-item${muted ? " is-muted" : ""}`}
            key={label}
          >
            <Icon aria-hidden="true" size={16} />
            {label}
          </span>
        ))}
      </nav>
    </header>
  );
}
