import { useLocation } from "react-router-dom";
import { Seo } from "@/components/seo/Seo";

const helpful = [
  { href: "/", label: "Home" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact support" },
];

const NotFound = () => {
  const location = useLocation();

  return (
    <main id="main-content" className="public-site flex min-h-screen items-center justify-center px-4 py-16">
      <Seo title="Page Not Found | AnyCircumstances" description="The requested page could not be found." path={location.pathname} noindex />
      <div className="contact-panel w-full max-w-xl">
        <p className="micro-label"><span className="status-dot" aria-hidden="true" /> 404</p>
        <h1 className="mt-6 text-4xl md:text-5xl">We couldn’t find that page</h1>
        <p className="mt-5 text-lg text-muted-foreground">
          The link may be mistyped or out of date. If you were opening an emergency link from an email, use the full link from
          the email. Each link opens one file and works once.
        </p>
        <nav aria-label="Helpful links" className="mt-8">
          <ul className="flex flex-wrap gap-3">
            {helpful.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="inline-flex min-h-11 items-center rounded-full border px-4 text-sm text-foreground hover:bg-accent">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </main>
  );
};

export default NotFound;
