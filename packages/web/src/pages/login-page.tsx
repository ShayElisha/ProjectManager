import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth-store";

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? "/app";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof Error && err.message === "INVALID_CREDENTIALS") {
        setError(t("auth.errorInvalid"));
      } else {
        setError(t("auth.errorGeneric"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={t("auth.loginTitle")}
      subtitle={t("auth.loginSub")}
      footer={
        <p className="text-[var(--muted)]">
          {t("auth.noAccount")}{" "}
          <Link to="/register" className="font-medium text-[var(--accent)] hover:underline">
            {t("auth.register")}
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
            autoComplete="current-password"
            minLength={6}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <Button type="submit" className="w-full h-11" disabled={loading}>
          {loading ? t("auth.loading") : t("auth.login")}
        </Button>
      </form>
    </AuthLayout>
  );
}
