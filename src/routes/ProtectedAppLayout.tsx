import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/layouts/AppLayout";

export default function ProtectedAppLayout() {
  const { role } = useAuth();
  return role === "user" ? <AppLayout /> : <Navigate to="/login" />;
}
