"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

export function ChangePasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: formData.get("currentPassword"),
          newPassword: formData.get("newPassword"),
          confirmPassword: formData.get("confirmPassword"),
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        redirectTo?: string;
      };

      if (!response.ok) {
        setError(result.error ?? "Unable to change your password.");
        return;
      }

      router.replace(result.redirectTo ?? "/dashboard");
      router.refresh();
    } catch {
      setError("Password change is temporarily unavailable. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="login-form" onSubmit={onSubmit}>
      <label className="password-change-field">
        <span>Current password</span>
        <input
          className="field-control password-change-input"
          type="password"
          name="currentPassword"
          autoComplete="current-password"
          required
          disabled={isSubmitting}
        />
      </label>
      <label className="password-change-field">
        <span>New password</span>
        <input
          className="field-control password-change-input"
          type="password"
          name="newPassword"
          autoComplete="new-password"
          minLength={6}
          maxLength={12}
          required
          disabled={isSubmitting}
        />
      </label>
      <label className="password-change-field">
        <span>Confirm new password</span>
        <input
          className="field-control password-change-input"
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          minLength={6}
          maxLength={12}
          required
          disabled={isSubmitting}
        />
      </label>
      <p className="password-hint">Use 6 to 12 characters. Passwords are case-sensitive.</p>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="submit-button" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Updating password..." : "Update password"}
      </button>
    </form>
  );
}
