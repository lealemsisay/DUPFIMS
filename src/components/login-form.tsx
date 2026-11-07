"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";

export function LoginForm() {
  const router = useRouter();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [authenticationError, setAuthenticationError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  async function onSubmit(values: LoginInput) {
    setAuthenticationError(undefined);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = (await response.json()) as {
        error?: string;
        redirectTo?: string;
      };

      if (!response.ok) {
        setAuthenticationError(
          result.error ?? "The username or password is incorrect.",
        );
        return;
      }

      router.push(result.redirectTo ?? "/dashboard");
      router.refresh();
    } catch {
      setAuthenticationError(
        "Sign-in is temporarily unavailable. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="login-form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <label className="field-row">
        <span className="field-icon">
          <UserRound aria-hidden="true" size={20} fill="currentColor" />
        </span>
        <input
          {...register("username")}
          className="field-control"
          type="text"
          autoComplete="username"
          placeholder="User name or email"
          aria-label="User name or email"
          aria-invalid={Boolean(errors.username)}
          aria-describedby={errors.username ? "username-error" : undefined}
          disabled={isSubmitting}
        />
      </label>
      {errors.username ? (
        <p className="form-error" id="username-error" role="alert">
          {errors.username.message}
        </p>
      ) : null}

      <label className="field-row">
        <span className="field-icon">
          <LockKeyhole aria-hidden="true" size={19} fill="currentColor" />
        </span>
        <span className="password-field">
          <input
            {...register("password")}
            className="field-control"
            type={passwordVisible ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Password"
            aria-label="Password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "password-error" : undefined}
            disabled={isSubmitting}
          />
          <button
            className="password-toggle"
            type="button"
            onClick={() => setPasswordVisible((visible) => !visible)}
            aria-label={passwordVisible ? "Hide password" : "Show password"}
            aria-pressed={passwordVisible}
            disabled={isSubmitting}
          >
            {passwordVisible ? (
              <EyeOff aria-hidden="true" size={18} />
            ) : (
              <Eye aria-hidden="true" size={18} />
            )}
          </button>
        </span>
      </label>
      {errors.password ? (
        <p className="form-error" id="password-error" role="alert">
          {errors.password.message}
        </p>
      ) : null}

      {authenticationError ? (
        <p className="form-error" role="alert">
          {authenticationError}
        </p>
      ) : null}

      <button className="submit-button" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Signing in..." : "Login"}
      </button>
    </form>
  );
}
