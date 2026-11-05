import { Outlet, Link, NavLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Shield, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { PublicPageCta } from '@/components/public/ContextualCta';

const navLinks = [
  { label: 'How it works', href: '/how-it-works' },
  { label: 'Recipients', href: '/recipients' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Security', href: '/security' },
  { label: 'FAQ', href: '/faq' },
];

export function PublicLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="public-site min-h-screen flex flex-col bg-background">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      {/* Header */}
      <header className="public-header sticky top-0 z-50 border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex min-h-11 items-center gap-2 group" aria-label="AnyCircumstances home">
            <div className="public-logo h-8 w-8 rounded-full flex items-center justify-center">
              <Shield aria-hidden="true" className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-medium text-base tracking-tight text-foreground transition-colors">
              anycircumstances
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav aria-label="Main" className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <NavLink
                key={link.href}
                to={link.href}
                className={({ isActive }) => `inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-foreground lg:px-4 ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* Desktop Auth Buttons */}
          <div className="hidden md:flex items-center gap-2">
            <Button asChild variant="ghost" className="min-h-11"><Link to="/login">
                Log in
              </Link></Button>
            <Button asChild className="min-h-11 shadow-md"><Link to="/pricing">
                Get started
              </Link></Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            className="icon-button md:hidden flex items-center justify-center p-2 hover:bg-accent rounded-lg transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
          >
            {mobileMenuOpen ? <X aria-hidden="true" className="h-5 w-5" /> : <Menu aria-hidden="true" className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div id="mobile-navigation" className="md:hidden border-t border-border bg-card animate-fade-in">
            <nav aria-label="Main" className="container mx-auto px-4 py-4 flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className="px-4 py-3 text-base font-medium text-foreground hover:bg-accent rounded-lg transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-border">
                <Button asChild variant="outline" className="min-h-11 w-full"><Link to="/login" onClick={() => setMobileMenuOpen(false)}>Log in</Link></Button>
                <Button asChild className="min-h-11 w-full"><Link to="/pricing" onClick={() => setMobileMenuOpen(false)}>Get started</Link></Button>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main id="main-content" tabIndex={-1} className="public-main flex-1">
        <Outlet />
        <PublicPageCta />
      </main>

      {/* Footer */}
      <footer className="public-footer border-t border-border bg-card/50">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1">
              <Link to="/" className="flex items-center gap-2 mb-4">
                <div className="public-logo h-8 w-8 rounded-full flex items-center justify-center">
                  <Shield className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="font-semibold text-foreground">anycircumstances</span>
              </Link>
              <p className="text-sm text-muted-foreground">
                Important information, delivered to the people you choose when you can’t.
              </p>
              <p className="mt-4 text-sm text-muted-foreground">
                Support: <a href="mailto:contact@anycircumstances.com" className="text-foreground underline underline-offset-4">contact@anycircumstances.com</a>
              </p>
            </div>

            <div>
              <h2 className="footer-heading mb-4">Product</h2>
              <ul className="footer-links space-y-1 text-sm text-muted-foreground">
                <li><Link to="/how-it-works" className="hover:text-foreground transition-colors">How it works</Link></li>
                <li><Link to="/recipients" className="hover:text-foreground transition-colors">What recipients receive</Link></li>
                <li><Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link></li>
                <li><Link to="/security" className="hover:text-foreground transition-colors">Security</Link></li>
                <li><Link to="/digital-vault" className="hover:text-foreground transition-colors">Secure digital vault</Link></li>
                <li><Link to="/dead-mans-switch" className="hover:text-foreground transition-colors">Dead man’s switch</Link></li>
                <li><Link to="/scenarios" className="hover:text-foreground transition-colors">Ideas & scenarios</Link></li>
              </ul>
            </div>

            <div>
              <h2 className="footer-heading mb-4">Support</h2>
              <ul className="footer-links space-y-1 text-sm text-muted-foreground">
                <li><Link to="/faq" className="hover:text-foreground transition-colors">FAQ</Link></li>
                <li><Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link></li>
                <li><Link to="/status" className="hover:text-foreground transition-colors">Service status</Link></li>
                <li><Link to="/guides" className="hover:text-foreground transition-colors">Planning guides</Link></li>
                <li><Link to="/emergency-information-vault" className="hover:text-foreground transition-colors">Emergency information vault</Link></li>
                <li><Link to="/about" className="hover:text-foreground transition-colors">About</Link></li>
              </ul>
            </div>

            <div>
              <h2 className="footer-heading mb-4">Legal</h2>
              <ul className="footer-links space-y-1 text-sm text-muted-foreground">
                <li><Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link></li>
                <li><Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link></li>
                <li><Link to="/cookies" className="hover:text-foreground transition-colors">Cookies</Link></li>
                <li><Link to="/accessibility" className="hover:text-foreground transition-colors">Accessibility</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} anycircumstances. All rights reserved.</p>
            <p>File contents are encrypted in your browser before upload</p>
            <span style={{ display: 'inline-block', textAlign: 'center', fontFamily: 'system-ui,sans-serif', lineHeight: 1 }}>
              <a
                href="https://tools.launchllama.co/products/anycircumstances?utm_source=badge&utm_medium=referral"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'block', lineHeight: 0 }}
              >
                <img
                  src="https://tools.launchllama.co/featured-badge.png?v=2"
                  alt="Featured on Launch"
                  width={200}
                  height={52}
                  style={{ display: 'block', border: 0 }}
                />
              </a>
              <a
                href="https://launchmcp.co/?utm_source=badge&utm_medium=referral"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'block', marginTop: '-2px', paddingTop: 0, fontSize: '7px', fontWeight: 600, color: '#888', textDecoration: 'none', lineHeight: 1, letterSpacing: '0.02em' }}
              >
                Launch
              </a>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
