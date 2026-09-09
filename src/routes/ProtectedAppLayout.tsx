import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/layouts/AppLayout";

export default function ProtectedAppLayout() {
  const { role, loading } = useAuth();
  if (loading) return <main className="min-h-screen flex items-center justify-center p-6" role="status">Loading your account…</main>;
  return role === "user" ? <AppLayout /> : <Navigate to="/login" replace />;
}
