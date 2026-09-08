import { Link } from "react-router-dom";
import type { GuideComparison, GuideLink, GuideSection } from "@/data/guides";

export function ContentLinks({ links }: { links: GuideLink[] }) {
  return <ul className="content-links mt-6 flex flex-wrap gap-x-6 gap-y-3">{links.map(link => <li key={`${link.path}-${link.label}`}><Link className="text-primary underline underline-offset-4 hover:opacity-80" to={link.path}>{link.label}</Link></li>)}</ul>;
}

export function ComparisonTable({ comparison, caption }: { comparison: GuideComparison; caption: string }) {
  // Keyboard users need a focusable region to scroll wide comparison tables.
  // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
  return <div className="comparison-scroll my-8 overflow-x-auto rounded-2xl border" role="region" aria-label={caption} tabIndex={0}>
    <table className="w-full min-w-[600px] border-collapse text-left text-base leading-7">
      <caption className="sr-only">{caption}</caption>
      <thead className="bg-muted/60"><tr>{comparison.columns.map(column => <th scope="col" key={column} className="p-4 font-semibold">{column}</th>)}</tr></thead>
      <tbody>{comparison.rows.map(row => <tr key={row[0]} className="border-t">{row.map((cell, index) => index === 0 ? <th scope="row" key={index} className="p-4 font-medium">{cell}</th> : <td key={index} className="p-4 text-muted-foreground">{cell}</td>)}</tr>)}</tbody>
    </table>
  </div>;
}

export function SectionContent({ section }: { section: GuideSection }) {
  const List = section.ordered ? "ol" : "ul";
  return <>
    {section.paragraphs?.map(paragraph => <p key={paragraph} className="mt-5 text-lg leading-8 text-muted-foreground">{paragraph}</p>)}
    {section.items && <ul className="mt-6 list-disc space-y-3 pl-6 text-lg leading-8 text-muted-foreground">{section.items.map(item => <li key={item}>{item}</li>)}</ul>}
    {section.cards && <List className={`mt-7 grid gap-5 ${section.ordered ? "list-decimal pl-6 marker:font-semibold marker:text-primary" : "sm:grid-cols-2"}`}>{section.cards.map(card => <li key={card.heading} className="rounded-2xl border bg-card p-5"><h3 className="text-xl font-semibold">{card.heading}</h3><p className="mt-3 leading-7 text-muted-foreground">{card.text}</p></li>)}</List>}
    {section.comparison && <ComparisonTable comparison={section.comparison} caption={section.heading} />}
    {section.callout && <aside className="mt-7 rounded-2xl border-l-4 border-primary bg-primary/5 p-6"><h3 className="text-xl font-semibold">{section.callout.title}</h3><p className="mt-3 leading-7 text-muted-foreground">{section.callout.text}</p></aside>}
    {section.finalParagraph && <p className="mt-5 text-lg leading-8 text-muted-foreground">{section.finalParagraph}</p>}
    {section.links && <ContentLinks links={section.links} />}
  </>;
}

export function PublicContentSection({ section, id }: { section: GuideSection; id?: string }) {
  return <section id={id} className="public-content-section container mx-auto max-w-5xl scroll-mt-24 px-4 py-14"><h2 className="text-3xl font-semibold sm:text-4xl">{section.heading}</h2><SectionContent section={section} /></section>;
}
