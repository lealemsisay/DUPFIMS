import { LoginForm } from "@/components/login-form";
import { PortalHeader } from "@/components/portal-header";
import Image from "next/image";
import { ArrowRight, GraduationCap, Megaphone, UsersRound } from "lucide-react";

const services = [
  {
    title: "Peace Forum",
    description: "Coordinate peace-building activities across Dilla University.",
    icon: UsersRound,
    tone: "rose",
  },
  {
    title: "Information Flow",
    description: "Share timely updates and support early response.",
    icon: Megaphone,
    tone: "blue",
  },
  {
    title: "University Community",
    description: "A safer, more connected campus community.",
    icon: GraduationCap,
    tone: "gold",
  },
];

export default function Home() {
  return (
    <main className="portal-page">
      <PortalHeader />
      <div className="login-content">
        <section className="portal-intro" aria-label="About DUPFIMS">
          <p className="intro-copy">
            This portal supports the Dilla University community with coordinated
            peace forum information and services.
          </p>
          <div className="service-list">
            {services.map(({ title, description, icon: Icon, tone }) => (
              <article className="service-card" key={title}>
                <div className={`service-icon service-icon-${tone}`}>
                  <Icon aria-hidden="true" size={34} strokeWidth={2.2} />
                </div>
                <div className="service-copy">
                  <h2>{title}</h2>
                  <p>{description}</p>
                </div>
                <ArrowRight className="service-arrow" aria-hidden="true" size={18} />
              </article>
            ))}
          </div>
          <p className="portal-note">
            Dilla University Peace Forum Information Management System
          </p>
        </section>

        <section className="login-panel" aria-label="Sign in">
          <div className="university-mark" aria-label="Dilla University">
            <Image
              src="/images/dilla-university-logo.jpg"
              alt="Dilla University"
              width={172}
              height={217}
              priority
            />
          </div>
          <div className="login-card">
            <div className="login-card-heading">
              <span className="login-eyebrow">DUPFIMS</span>
              <h1>Login to your account</h1>
              <p>Use your university account to continue.</p>
            </div>
            <LoginForm />
          </div>
          <p className="login-footer">Dilla University · Peace Forum</p>
        </section>
      </div>
    </main>
  );
}
