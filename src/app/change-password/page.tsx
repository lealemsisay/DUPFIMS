import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/change-password-form";
import { getAppSession } from "@/lib/backend-api";

export default async function ChangePasswordPage() {
  const session = await getAppSession();

  if (!session?.user.id) redirect("/");
  if (!session.user.mustChangePassword) redirect("/dashboard");

  return (
    <main className="password-change-page">
      <section className="login-card password-change-card">
        <div className="login-card-heading">
          <span className="login-eyebrow">DUPFIMS</span>
          <h1>Change your password</h1>
          <p>Set a new password before continuing to the system.</p>
        </div>
        <ChangePasswordForm />
      </section>
    </main>
  );
}
