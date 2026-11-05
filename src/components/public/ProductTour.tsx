import { useState } from "react";

const shots = [
  {
    id: "vault",
    tab: "1. Your vault",
    title: "Upload files to your encrypted vault",
    text: "Files are encrypted in your browser before upload. Your vault lists what you’ve stored, marks files assigned to an emergency contact, and shows how much space you’ve used.",
    src: "/product/vault.jpg",
    alt: "The AnyCircumstances vault page listing four sample files with their sizes and upload dates; three are marked Emergency.",
  },
  {
    id: "contacts",
    tab: "2. Emergency contacts",
    title: "Choose who receives each file",
    text: "Add a contact, assign the files they should get, and see whether they’ve confirmed their email address.",
    src: "/product/contacts.jpg",
    alt: "The emergency contacts page showing two sample contacts, one confirmed and one waiting for confirmation, each with assigned files.",
  },
  {
    id: "check-in",
    tab: "3. Check-ins",
    title: "Set your check-in rules",
    text: "Your check-in frequency comes from your plan. You choose the grace period and how many reminder emails you get.",
    src: "/product/check-in.jpg",
    alt: "The check-in settings page showing a weekly check-in schedule from the plan, PIN settings, and a grace period slider set to 1 day.",
  },
  {
    id: "recipient",
    tab: "4. What a recipient sees",
    title: "Recipients open files in their browser",
    text: "Each emailed link opens a page that explains what it is before anything happens. The recipient then downloads and decrypts the file.",
    src: "/product/recipient.jpg",
    alt: "The page a recipient sees after opening an emergency link, explaining who shared the information, with an Open shared file button.",
  },
];

export function ProductTour() {
  const [active, setActive] = useState(shots[0].id);
  const current = shots.find((shot) => shot.id === active) ?? shots[0];

  return (
    <section aria-labelledby="tour-title" className="border-t border-white/5 py-20 md:py-28">
      <div className="container mx-auto max-w-6xl px-4">
        <p className="micro-label"><span className="status-dot" aria-hidden="true" /> SEE THE PRODUCT</p>
        <h2 id="tour-title" className="mt-5 max-w-3xl text-3xl md:text-5xl">What it looks like</h2>
        <p className="mt-5 max-w-3xl text-lg text-muted-foreground">
          Real screens from the app, shown with fictional sample data.
        </p>

        <div role="tablist" aria-label="Product screens" className="mt-8 flex flex-wrap gap-2">
          {shots.map((shot) => (
            <button
              key={shot.id}
              id={`tour-tab-${shot.id}`}
              type="button"
              role="tab"
              aria-selected={shot.id === active}
              aria-controls={`tour-panel-${shot.id}`}
              tabIndex={shot.id === active ? 0 : -1}
              onClick={() => setActive(shot.id)}
              onKeyDown={(event) => {
                if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
                event.preventDefault();
                const index = shots.findIndex((shot) => shot.id === active);
                const next = shots[(index + (event.key === "ArrowRight" ? 1 : shots.length - 1)) % shots.length];
                setActive(next.id);
                document.getElementById(`tour-tab-${next.id}`)?.focus();
              }}
              className={`min-h-11 rounded-full border px-4 text-sm transition-colors ${shot.id === active ? "bg-[#f3f4ef] text-[#111]" : "text-foreground hover:bg-accent"}`}
            >
              {shot.tab}
            </button>
          ))}
        </div>

        <div id={`tour-panel-${current.id}`} role="tabpanel" aria-labelledby={`tour-tab-${current.id}`} className="mt-6 grid items-start gap-6 lg:grid-cols-[1fr_320px]">
          <figure className="overflow-hidden rounded-2xl border bg-card">
            <img src={current.src} alt={current.alt} width={1280} height={800} loading="lazy" decoding="async" className="block h-auto w-full" />
            <figcaption className="border-t px-4 py-3 text-sm text-muted-foreground">Sample data. Names, files and addresses are fictional.</figcaption>
          </figure>
          <div className="rounded-2xl border bg-card p-6">
            <h3 className="text-xl text-foreground">{current.title}</h3>
            <p className="mt-3 leading-7 text-muted-foreground">{current.text}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
