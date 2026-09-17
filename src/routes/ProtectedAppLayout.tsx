import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/layouts/AppLayout";

export default function ProtectedAppLayout() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <main className="min-h-screen flex items-center justify-center p-6" role="status">Loading your account…</main>;
  return isAuthenticated ? <AppLayout /> : <Navigate to="/login" replace />;
}
