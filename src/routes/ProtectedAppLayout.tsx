import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/layouts/AppLayout";

export default function ProtectedAppLayout() {
  const { role, loading } = useAuth();
  const location = useLocation();

  if (loading) return <main className="min-h-screen flex items-center justify-center p-6" role="status">Loading your account…</main>;

  if (role === "user") return <AppLayout />;

  const next = `${location.pathname}${location.search}${location.hash}`;
  return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
}
