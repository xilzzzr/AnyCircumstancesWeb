import { useLocation } from "react-router-dom";
import { Seo } from "./Seo";
import { getPublicRouteSeo } from "@/seo/publicRoutes";

export function RouteSeo() {
  const { pathname } = useLocation();
  const privateRoute = pathname.startsWith("/admin") || pathname.startsWith("/app") || pathname.startsWith("/share") || ["/login", "/signup", "/verification", "/verify-email", "/email-verified", "/create-pin", "/create-panic-pin", "/onboarding", "/forgot-password", "/reset-password", "/cookies", "/status"].includes(pathname);
  const page = getPublicRouteSeo(pathname);

  if (page) return <Seo title={page.title} description={page.description} path={page.path} type={page.type} schema={page.schema} />;
  if (pathname === "/status") return <Seo title="Service Status | AnyCircumstances" description="Live check of whether the AnyCircumstances service is responding." path={pathname} noindex />;
  if (pathname === "/cookies") return <Seo title="Cookies | AnyCircumstances" description="The cookies and browser storage AnyCircumstances uses." path={pathname} noindex />;
  if (privateRoute) return <Seo title="Account | AnyCircumstances" description="Secure AnyCircumstances account page." path={pathname} noindex />;
  return null;
}
