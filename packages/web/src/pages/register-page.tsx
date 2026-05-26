import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";

export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError(t("auth.errorPasswordMatch"));
      return;
    }
    if (password.length < 6) {
      setError(t("auth.errorPasswordShort"));
      return;
    }
    setLoading(true);
    try {
      await register(name, email, password);
      navigate("/app", { replace: true });
    } catch (err) {
      if (err instanceof Error && err.message === "EMAIL_EXISTS") {
        setError(t("auth.errorEmailExists"));
      } else {
        setError(t("auth.errorGeneric"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={t("auth.registerTitle")}
      subtitle={t("auth.registerSub")}
      footer={
        <p className="text-[var(--muted)]">
          {t("auth.hasAccount")}{" "}
          <Link to="/login" className="font-medium text-[var(--accent)] hover:underline">
            {t("auth.login")}
          </Link>
        </p>
      }
    >
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <label className="block text-sm">
          <span className="text-[var(--muted)]">{t("auth.name")}</span>
          <input
            type="text"
            required
            autoComplete="name"
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">{t("auth.email")}</span>
          <input
            type="email"
            required
            autoComplete="email"
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">{t("auth.password")}</span>
          <input
            type="password"
            required
            autoComplete="new-password"
            minLength={6}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--muted)]">{t("auth.confirmPassword")}</span>
          <input
            type="password"
            required
            autoComplete="new-password"
            minLength={6}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        <Button type="submit" className="w-full h-11" disabled={loading}>
          {loading ? t("auth.loading") : t("auth.register")}
        </Button>
      </form>
    </AuthLayout>
  );
}
