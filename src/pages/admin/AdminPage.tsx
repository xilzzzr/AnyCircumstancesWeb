import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck, Database, Users, ArrowLeft, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadAuthSession } from "@/lib/authSession";

type Discount = { id: string; code: string | null; name: string; percentOff: number | null; amountOff: number | null; currency: string | null; duration: string; endsAt: number | null };
type Subscription = { id: string; status: string; currency: string; interval: string; amountCents: number | null; baseAmountCents: number | null; discounts?: Discount[]; priceNames?: string[]; sale?: string; cancelAtPeriodEnd?: boolean; error?: string };
type Customer = { id: string; email: string; accountStatus: string; billingStatus: string; billingInterval: string; configuredAmountCents: number | null; currency: string; storageLimitGb: number | null; usedBytes: number; checkInFrequency: string | null; addons: string[]; stripeSubscriptionId: string | null; entitlements: { provider: string; status: string; productId: string; currentPeriodEnd: string | null }[] };
type Customers = { customers: Customer[]; page: number; pageSize: number; total: number; customerCount: number; totalUsedBytes: number; fileCount: number };
type Report = { month: string; generatedAt: string; subscriptions: Record<string, Subscription>; currencies: { currency: string; monthlyRecurringCents: number; grossCents: number; feeCents: number; netCents: number; adjustmentsCents: number }[]; warnings: string[]; notes: string; mrrComplete: boolean };
type ReportState = { state: "loading" | "ready" | "unavailable"; report?: Report; error?: string };

class ApiError extends Error { constructor(public status: number, public code: string) { super(code); } }
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const request = () => fetch(`/auth/admin${path}`, { credentials: "include", ...options });
  let response = await request();
  let body = await response.json();
  if (response.status === 401 && body.error !== "admin_login_required" && path !== "/login") {
    await loadAuthSession();
    response = await request();
    body = await response.json();
  }
  if (!response.ok) throw new ApiError(response.status, body.error);
  return body;
}
const zeroDecimalCurrencies = new Set(["bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf"]);
const money = (cents: number | null | undefined, currency = "usd") => cents == null ? "Unavailable" : new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / (zeroDecimalCurrencies.has(currency.toLowerCase()) ? 1 : 100));
const gb = (bytes: number) => (bytes / 1024 ** 3).toLocaleString("en-US", { maximumFractionDigits: 3 });
const errorMessage = (error: unknown) => error instanceof ApiError && error.status === 403 ? "This account does not have admin access."
  : error instanceof ApiError && error.status === 429 ? "Too many attempts. Please wait before trying again."
  : error instanceof ApiError && error.code === "invalid_credentials" ? "The email or password is incorrect."
  : "Could not load this information. Please try again.";

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>{detail && <p className="mt-2 text-xs text-muted-foreground">{detail}</p>}</div>;
}

export default function AdminPage() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [data, setData] = useState<Customers | null>(null);
  const [report, setReport] = useState<ReportState | null>(null);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);

  function handleError(e: unknown) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
      setAuthorized(false); setData(null); setReport(null); navigate("/admin/login", { replace: true });
      setError(e.status === 403 ? errorMessage(e) : "Please sign in again to continue.");
    } else setError(errorMessage(e));
  }

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        await loadAuthSession();
        await api("/session");
        if (live) { setAuthorized(true); navigate("/admin", { replace: true }); }
      } catch (e) {
        if (live) { if (e instanceof ApiError && e.status === 403) setError(errorMessage(e)); navigate("/admin/login", { replace: true }); }
      } finally { if (live) setChecking(false); }
    })();
    return () => { live = false; };
  }, [navigate]);

  useEffect(() => {
    if (!authorized) return;
    let live = true;
    setBusy(true); setError(""); setData(null);
    api<Customers>(`/customers?page=${page}&search=${encodeURIComponent(query)}`)
      .then(value => { if (live) setData(value); })
      .catch(e => { if (live) handleError(e); })
      .finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
    // Navigation occurs only when the server revokes authorization.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, page, query, revision]);

  useEffect(() => {
    if (!authorized) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    setReport(null);
    async function poll() {
      try {
        const value = await api<ReportState>(`/report?month=${month}`);
        if (!live) return;
        setReport(value);
        timer = setTimeout(poll, value.state === "loading" ? 3000 : 60000);
      } catch (e) { if (live) handleError(e); }
    }
    void poll();
    return () => { live = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, month, revision]);

  async function login(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/auth/login", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const body = await response.json();
      if (!response.ok) throw new ApiError(response.status, body.error);
      await api("/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      setPassword(""); setAuthorized(true); navigate("/admin", { replace: true });
    } catch (e) { setError(errorMessage(e)); } finally { setPassword(""); setBusy(false); }
  }

  async function logout() {
    setBusy(true);
    try {
      await api("/logout", { method: "POST" });
      setAuthorized(false); setData(null); setReport(null); setError(""); navigate("/admin/login", { replace: true });
    } catch (e) { handleError(e); } finally { setBusy(false); }
  }

  if (checking) return <main className="min-h-screen grid place-items-center" role="status">Checking admin access…</main>;
  if (!authorized) return <main className="min-h-screen grid place-items-center bg-background p-6">
    <div className="w-full max-w-sm space-y-7">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={15} /> AnyCircumstances</Link>
      <div><ShieldCheck className="mb-5 text-emerald-200" size={32} /><h1 className="text-3xl font-semibold">Admin sign in</h1><p className="mt-2 text-sm text-muted-foreground">Use your authorized AnyCircumstances account.</p></div>
      <form onSubmit={login} className="space-y-5">
        <div className="space-y-2"><label htmlFor="admin-email" className="text-sm">Email</label><Input id="admin-email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></div>
        <div className="space-y-2"><label htmlFor="admin-password" className="text-sm">Password</label><Input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <Button className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in to admin"}</Button>
      </form>
      <p className="text-xs text-muted-foreground">Admin sessions expire after 15 minutes.</p>
    </div>
  </main>;

  const finance = report?.state === "ready" ? report.report : null;
  return <main className="min-h-screen bg-background px-4 py-8 md:px-10">
    <div className="mx-auto max-w-[1500px] space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-6">
        <div><Link to="/" className="text-sm text-muted-foreground">AnyCircumstances</Link><h1 className="mt-2 flex items-center gap-3 text-3xl font-semibold"><ShieldCheck className="text-emerald-200" /> Admin overview</h1></div>
        <div className="flex gap-2"><Button variant="outline" disabled={busy} onClick={() => setRevision(r => r + 1)}><RefreshCw size={16} className="mr-2" />Refresh</Button><Button variant="ghost" disabled={busy} onClick={logout}><LogOut size={16} className="mr-2" />Sign out</Button></div>
      </header>
      {error && <p role="alert" className="rounded-lg border border-red-900 p-4 text-red-300">{error}</p>}
      <section aria-label="Customer and storage totals" className="grid gap-4 sm:grid-cols-2">
        <Stat label="Customers" value={data ? data.customerCount.toLocaleString() : "…"} detail="All registered accounts" />
        <Stat label="Total customer storage" value={data ? `${gb(data.totalUsedBytes)} GB` : "…"} detail={data ? `${data.fileCount.toLocaleString()} file records, including reserved uploads` : undefined} />
      </section>
      <section aria-labelledby="revenue-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 id="revenue-heading" className="text-xl font-semibold">Revenue</h2><p className="text-sm text-muted-foreground">Actual net receipts for the selected month. Recurring revenue reflects current plans.</p></div><div><label htmlFor="revenue-month" className="sr-only">Revenue month (UTC)</label><Input id="revenue-month" type="month" value={month} min="2000-01" max={new Date().toISOString().slice(0, 7)} onChange={e => { if (e.target.value) setMonth(e.target.value); }} /></div></div>
        {!report || report.state === "loading" ? <p role="status" className="rounded-xl border p-6 text-muted-foreground">Loading prices, discounts, and Stripe transactions…</p>
          : report.state === "unavailable" ? <p role="alert" className="rounded-xl border p-6 text-amber-200">Stripe reporting is unavailable. Customer storage details remain available. {report.error === "stripe_not_configured" ? "Stripe is not configured on this server." : "Try again in five minutes."}</p> : null}
        {finance && <>
          {!finance.currencies.length && <p className="rounded-xl border p-5 text-muted-foreground">No linked Stripe subscriptions or payments found.</p>}
          {finance.currencies.map(c => <div key={c.currency} className="space-y-3"><p className="text-xs uppercase tracking-widest text-muted-foreground">{c.currency}</p><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Current monthly recurring revenue" value={money(c.monthlyRecurringCents, c.currency)} detail={finance.mrrComplete ? "Estimate before Stripe fees and tax" : "Partial estimate: see reporting notices"} />
            <Stat label="Payments received" value={money(c.grossCents, c.currency)} detail={`${finance.month}, includes annual payments received`} />
            <Stat label="Transaction fees" value={money(c.feeCents, c.currency)} detail={`Refunds / adjustments: ${money(c.adjustmentsCents, c.currency)}`} />
            <Stat label="Net after transaction fees" value={money(c.netCents, c.currency)} detail="Actual receipts, including refunds and adjustments" />
          </div></div>)}
          <p className="text-xs leading-relaxed text-muted-foreground">{finance.notes} Last synced {new Date(finance.generatedAt).toLocaleString()}.</p>
          {!!finance.warnings.length && <details className="rounded-lg border border-amber-900 p-4 text-sm text-amber-200"><summary className="cursor-pointer">Reporting notices ({finance.warnings.length})</summary><ul className="mt-3 list-disc space-y-1 pl-5">{finance.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></details>}
        </>}
      </section>
      <section aria-labelledby="customers-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4"><h2 id="customers-heading" className="flex items-center gap-2 text-xl font-semibold"><Users size={20} />Customers</h2>
          <form className="flex gap-2" onSubmit={e => { e.preventDefault(); setPage(1); setQuery(search.trim()); }}><label htmlFor="customer-search" className="sr-only">Search customer email or ID</label><Input id="customer-search" placeholder="Search email or ID" value={search} onChange={e => setSearch(e.target.value)} className="w-56" /><Button variant="outline">Search</Button></form></div>
        <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground"><tr>{["Customer", "Subscription & price", "Discount / sale", "Features", "Storage"].map(h => <th key={h} scope="col" className="p-4 font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y">{data?.customers.map(customer => {
            const sub = customer.stripeSubscriptionId ? finance?.subscriptions[customer.stripeSubscriptionId] : null;
            const apple = customer.entitlements.some(e => e.provider === "apple" && e.status === "active" && (!e.currentPeriodEnd || new Date(e.currentPeriodEnd).getTime() > Date.now()));
            const overLimit = customer.storageLimitGb != null && customer.usedBytes > customer.storageLimitGb * 1024 ** 3;
            return <tr key={customer.id} className="align-top hover:bg-muted/20">
              <td className="p-4"><p className="font-medium break-all">{customer.email}</p><p className="mt-1 font-mono text-xs text-muted-foreground">ID {customer.id}</p><p className="mt-2 text-xs text-muted-foreground">Account: {customer.accountStatus}</p></td>
              <td className="p-4"><p className="font-medium">{sub ? `${money(sub.amountCents, sub.currency)}${sub.interval ? ` / ${sub.interval}` : ""}` : apple ? "Apple: price unavailable" : customer.stripeSubscriptionId ? "Stripe price loading / unavailable" : customer.configuredAmountCents != null ? `${money(customer.configuredAmountCents, customer.currency)} / ${customer.billingInterval} (configured)` : "No plan"}</p>
                {sub?.baseAmountCents != null && sub.baseAmountCents !== sub.amountCents && <p className="mt-1 text-xs text-muted-foreground">Before coupon: {money(sub.baseAmountCents, sub.currency)}</p>}
                <p className="mt-2 text-xs text-muted-foreground">{sub?.status || customer.billingStatus}{sub?.cancelAtPeriodEnd ? " · Cancels at period end" : ""}</p>{customer.entitlements.map((e, i) => <p key={i} className="mt-1 text-xs text-muted-foreground">{e.provider}: {e.status}</p>)}
              </td>
              <td className="p-4"><div className="space-y-2">{sub?.discounts?.map(d => <div key={d.id} className="rounded-md border border-emerald-900 bg-emerald-950/25 px-2 py-1 text-xs text-emerald-200"><p className="font-medium">{d.code || d.name}</p><p>{d.percentOff != null ? `${d.percentOff}% off` : `${money(d.amountOff, d.currency || sub.currency)} off`} · {d.duration}</p>{d.endsAt && <p>Until {new Date(d.endsAt * 1000).toLocaleDateString()}</p>}</div>)}
                {sub?.sale && <p className="text-xs">Sale: {sub.sale}</p>}{sub?.priceNames?.map(n => <p key={n} className="text-xs text-muted-foreground">{n}</p>)}
                {(sub?.interval === "annual" || customer.billingInterval === "annual") && <p className="text-xs text-muted-foreground">Annual pricing</p>}
                {!sub?.discounts?.length && <p className="text-xs text-muted-foreground">{sub && !sub.error ? "No Stripe coupon" : apple ? "Apple discounts unavailable" : customer.stripeSubscriptionId ? "Discounts unavailable until Stripe sync" : "No Stripe subscription"}</p>}</div></td>
              <td className="p-4"><p>Check-ins: {customer.checkInFrequency || "Not configured"}</p><p className="mt-1 text-xs text-muted-foreground">{customer.addons.length ? customer.addons.join(", ") : "No add-ons"}</p></td>
              <td className="p-4"><p className={overLimit ? "text-amber-200" : ""}><Database size={14} className="mr-1 inline" />{gb(customer.usedBytes)} / {customer.storageLimitGb ?? "—"} GB</p>{overLimit && <p className="mt-1 text-xs text-amber-200">Over limit</p>}</td>
            </tr>;
          })}</tbody></table>
          {busy && <p role="status" className="p-8 text-center text-muted-foreground">Loading customers…</p>}{data && !data.customers.length && <p className="p-8 text-center text-muted-foreground">No customers found.</p>}
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground"><p>{data ? `${data.total.toLocaleString()} results · Page ${page} of ${Math.max(1, Math.ceil(data.total / data.pageSize))}` : ""}</p><div className="flex gap-2"><Button variant="outline" disabled={busy || page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button><Button variant="outline" disabled={busy || !data || page * data.pageSize >= data.total} onClick={() => setPage(p => p + 1)}>Next</Button></div></div>
      </section>
    </div>
  </main>;
}
