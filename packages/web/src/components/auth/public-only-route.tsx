import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth-store";

/** Redirect authenticated users away from login/register/landing CTAs */
export function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const ready = useAuthStore((s) => s.ready);

  if (!ready) return null;
  if (user) return <Navigate to="/app" replace />;

  return <>{children}</>;
}
