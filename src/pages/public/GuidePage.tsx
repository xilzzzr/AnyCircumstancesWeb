import { Fragment } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowRight, BookOpen } from "lucide-react";
import { Seo } from "@/components/seo/Seo";
import { getPrerenderRouteSeo } from "@/seo/prerenderRoutes";
import { guideBySlug, guides } from "@/data/guides";
import { ContextualCta } from "@/components/public/ContextualCta";
import { ComparisonTable, ContentLinks, SectionContent } from "@/components/public/ArticleContent";

const date = (value: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
const categories = ["Dead Man's Switch & Check-Ins", "Digital Vaults & Emergency Information", "Crypto & Digital Assets", "Family & Account Planning"];
// Google's no-JavaScript link for adding a site as a preferred source. It only changes the
// results of the person who clicks it (Top Stories, AI Overviews, AI Mode), and it loads no
// Google script on our pages.
export const preferredSourceUrl = "https://www.google.com/preferences/source?q=anycircumstances.com";
const sectionId = (heading: string, index: number) => `${heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${index + 1}`;

export function GuidesIndexPage() {
  return <div className="container mx-auto max-w-6xl px-4 py-16 md:py-20">
    <p className="micro-label">GUIDES</p><h1 className="mt-5 max-w-4xl text-4xl font-bold md:text-6xl">Prepare the information people may need.</h1>
    <p className="mt-6 max-w-3xl text-lg text-muted-foreground">Clear, practical planning guides for emergencies, digital accounts, important documents, and inheritance.</p>
    {categories.map(category => <section className="mt-14" key={category}><h2 className="text-2xl font-semibold md:text-3xl">{category}</h2><div className="mt-7 grid gap-5 md:grid-cols-2">{guides.filter(guide => guide.category === category).map(guide => <article key={guide.slug} className="rounded-2xl border bg-card p-7"><BookOpen aria-hidden="true" className="h-6 w-6 text-primary" /><h3 className="mt-4 text-2xl font-semibold"><Link className="hover:text-primary" to={`/guides/${guide.slug}`}>{guide.cardTitle ?? guide.title}</Link></h3><p className="mt-3 leading-7 text-muted-foreground">{guide.cardDescription ?? guide.description}</p><Link className="mt-5 inline-flex items-center gap-2 font-medium text-primary" to={`/guides/${guide.slug}`}>Read the guide <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link></article>)}</div></section>)}
  </div>;
}

export function GuidePage() {
  const { slug = "" } = useParams();
  const guide = guideBySlug[slug];
  if (!guide) return <Navigate to="/404" replace />;
  const path = `/guides/${guide.slug}`;
  const seo = getPrerenderRouteSeo(path)!;
  return <article className="guide-article">
    <Seo {...seo} />
    <header className="border-b bg-gradient-to-b from-muted/40 to-background px-4 py-12 md:py-16">
      <div className="mx-auto max-w-[760px]">
        <nav aria-label="Breadcrumb"><ol className="flex flex-wrap gap-2 text-sm text-muted-foreground"><li><Link to="/">Home</Link><span aria-hidden="true"> /</span></li><li><Link to="/guides">Guides</Link><span aria-hidden="true"> /</span></li><li aria-current="page">{guide.title}</li></ol></nav>
        <p className="micro-label mt-9">PRACTICAL GUIDE</p><h1 className="mt-5 text-4xl font-bold md:text-5xl">{guide.title}</h1>
        <p className="guide-intro mt-6 text-xl leading-8 text-muted-foreground">{guide.intro}</p>
        {guide.comparison && <ComparisonTable comparison={guide.comparison} caption={guide.title} />}
        <p className="mt-6 text-sm text-muted-foreground"><span>By AnyCircumstances</span><span aria-hidden="true"> · </span>Updated <time dateTime={guide.modified}>{date(guide.modified)}</time></p>
      </div>
    </header>
    <div className="mx-auto max-w-[792px] px-4 py-10 md:py-14">
      {guide.showToc !== false && <nav aria-label="On this page" className="mb-12 rounded-2xl border bg-muted/30 p-6"><h2 className="text-xl font-semibold">On this page</h2><ol className="mt-5 space-y-3">{guide.sections.map((section, index) => <li key={section.heading}><a className="text-muted-foreground underline underline-offset-4 hover:text-primary" href={`#${sectionId(section.heading, index)}`}>{section.heading}</a></li>)}</ol></nav>}
      <div className="space-y-12">{guide.sections.map((section, index) => <Fragment key={section.heading}><section id={sectionId(section.heading, index)} className="guide-section scroll-mt-24 border-t pt-10"><h2 className="text-2xl font-semibold md:text-3xl">{section.heading}</h2><SectionContent section={section} /></section>{index === guide.ctaAfterSection && <ContextualCta variant={guide.ctaVariant} />}</Fragment>)}
        <aside className="rounded-2xl border bg-card p-6 md:p-8"><p className="micro-label">RELATED READING</p><h2 className="mt-3 text-2xl font-semibold">Continue planning</h2><ContentLinks links={guide.related} /></aside>
        <p className="text-sm leading-6 text-muted-foreground">Read our guides often? <a className="underline underline-offset-4 hover:text-primary" href={preferredSourceUrl} target="_blank" rel="noopener noreferrer">Add AnyCircumstances as a preferred source on Google</a> to see them more often in your own Google results.</p>
        <ContextualCta variant={guide.ctaVariant} />
      </div>
    </div>
  </article>;
}
