# SEO and conversion implementation report

Implemented locally on September 8, 2026. No deployment or production-server changes were made. No backend, authentication, encryption, billing, check-in, reminder, release, recovery, database, or private-sharing behavior was changed.

## Result

- All 28 public indexable routes have a contextual CTA or the existing pricing checkout action.
- Five new guides use the existing guide registry, route, prerender, sitemap and schema architecture.
- Sitemap: **23 → 28 routes**. Prerender: **23 → 28 routes** (17 non-guide public pages; guides increased from 6 to 11).
- All 21 requested cluster links are present with the exact supplied anchor texts. Additional supplied section links and related-guide links are also present.
- All 17 FAQ answers exist verbatim in generated HTML inside native `details` elements.
- Production build, source audit, sitemap XML and JSON-LD validation passed. All 28 routes hydrated without console errors or metadata/schema mismatches.
- No public indexable page lacks a CTA.

The starting working tree already contained changes to App.tsx, guides, several public pages, route metadata and sitemap, plus an untracked ProofOfLifePage.tsx. Those changes were preserved and incorporated. `/proof-of-life` was already present at the start; it is not counted as a new route in this pass. HEAD alone has one fewer route than the starting working tree.

## New routes

- `/guides/dead-mans-switch-email`
- `/guides/proof-of-life-protocol`
- `/guides/what-is-a-digital-vault`
- `/guides/digital-vault-vs-cloud-storage`
- `/guides/what-happens-to-bitcoin-when-you-die`

## Content and template changes

The shared guide template now provides semantic breadcrumbs, an answer-first introduction, “By AnyCircumstances,” an updated date tied to the same `modified` value used for Article `dateModified`, optional H2-derived “On this page” links, a 760px reading width, separated sections, lists, data-driven callouts, horizontally scrollable comparison tables with column/row headers, related guides, optional middle CTAs and a final contextual CTA. Publication dates were preserved; modified dates reflect this content reorganization. New guides use September 8, 2026 for publication and modification.

Existing accurate guide copy was retained or reorganized. Earlier overlapping Bitcoin/Ethereum/other-crypto summaries were replaced with the supplied expansions; the original crypto opening and security warning were retained. The digital-will guide retains its existing prose and receives the supplied introduction, comparison and email section.

The homepage, switch/vault pillars, how-it-works timeline and branch, emergency-vault list, features, pricing and FAQ use supplied text. Conflicting blocks are identified below. The previous “most secure,” “guaranteed delivery,” and seed-phrase assurance were removed. The pricing diff contains only the requested H1 and introduction replacements.

Guide index categories:

- Dead Man's Switch & Check-Ins
- Digital Vaults & Emergency Information
- Crypto & Digital Assets
- Family & Account Planning

## CTA coverage and route verification

CTA keys: general = General Product; switch = Dead Man's Switch; vault = Digital Vault; crypto = Crypto; emergency = Emergency Information; informational = Low-Pressure Informational. Multiple entries indicate configured middle and final CTAs. Existing emergency checklist/binder guides use Emergency Information; existing family-document/password guides use General Product because no separate mapping was supplied.

| Route | H1 | CTA present? | Prerendered? | In sitemap? | Schema |
| --- | --- | --- | --- | --- | --- |
| / | A Secure Digital Vault with a Built-In Dead Man's Switch | Yes — general | Yes | Yes | WebPage |
| /dead-mans-switch | A Dead Man's Switch for Email, Check-Ins, and Encrypted Files | Yes — switch, switch | Yes | Yes | WebPage |
| /digital-vault | A Secure Digital Vault for Important Documents and Emergency Information | Yes — vault, vault | Yes | Yes | WebPage |
| /emergency-information-vault | Emergency Information Vault: Secure Important Information for the People You Trust | Yes — emergency, emergency | Yes | Yes | WebPage, BreadcrumbList |
| /features | Digital emergency vault features | Yes — general | Yes | Yes | WebPage |
| /how-it-works | How AnyCircumstances Works | Yes — general | Yes | Yes | WebPage |
| /proof-of-life | Digital Proof-of-Life Check-Ins | Yes — general | Yes | Yes | WebPage, BreadcrumbList |
| /pricing | Secure Digital Vault Pricing | Yes — checkout | Yes | Yes | WebPage |
| /security | How we keep your data safe | Yes — general | Yes | Yes | WebPage |
| /about | About AnyCircumstances | Yes — general | Yes | Yes | WebPage |
| /faq | Frequently Asked Questions | Yes — general | Yes | Yes | WebPage |
| /guides | Prepare the information people may need. | Yes — general | Yes | Yes | WebPage |
| /scenarios | What would happen ifyou couldn’t explain it tomorrow? | Yes — general | Yes | Yes | WebPage |
| /contact | How can we help? | Yes — informational | Yes | Yes | WebPage |
| /privacy | Privacy Policy | Yes — informational | Yes | Yes | WebPage |
| /terms | Terms and Conditions | Yes — informational | Yes | Yes | WebPage |
| /accessibility | Access should never depend on circumstance. | Yes — informational | Yes | Yes | WebPage |
| /guides/emergency-information-checklist | Emergency Information Checklist for Your Family | Yes — emergency | Yes | Yes | Article, BreadcrumbList |
| /guides/digital-emergency-binder | How to Build a Digital Emergency Binder | Yes — emergency | Yes | Yes | Article, BreadcrumbList |
| /guides/important-documents-family-should-know | Important Documents Your Family Should Know About | Yes — general | Yes | Yes | Article, BreadcrumbList |
| /guides/how-to-leave-passwords-to-family | How to Leave Passwords and Account Access to Family | Yes — general | Yes | Yes | Article, BreadcrumbList |
| /guides/what-happens-to-crypto-when-you-die | What Happens to Cryptocurrency When You Die? | Yes — crypto, crypto | Yes | Yes | Article, BreadcrumbList |
| /guides/dead-mans-switch-vs-digital-will | Dead Man’s Switch vs. Digital Will | Yes — switch, switch | Yes | Yes | Article, BreadcrumbList |
| /guides/dead-mans-switch-email | How a Dead Man's Switch Email Works | Yes — switch | Yes | Yes | Article, BreadcrumbList |
| /guides/proof-of-life-protocol | What Is a Proof of Life Protocol? | Yes — switch | Yes | Yes | Article, BreadcrumbList |
| /guides/what-is-a-digital-vault | What Is a Digital Vault? | Yes — vault | Yes | Yes | Article, BreadcrumbList |
| /guides/digital-vault-vs-cloud-storage | Digital Vault vs Cloud Storage: What's the Difference? | Yes — vault | Yes | Yes | Article, BreadcrumbList |
| /guides/what-happens-to-bitcoin-when-you-die | What Happens to Bitcoin When You Die? | Yes — crypto | Yes | Yes | Article, BreadcrumbList |

CTA coverage is enforced through the existing indexable public-route registry in PublicLayout; guides render their own context-specific CTAs. Pricing uses its existing checkout button. Login, signup, authenticated pages, shares, utility/noindex pages and unknown routes receive no new CTA banner.

## Exact metadata

Every route uses a self-referencing canonical of `https://anycircumstances.com` plus the route below and `index, follow, max-image-preview:large`. Page-level duplicate metadata writers were removed where they conflicted with the existing route registry. The existing registry owns non-guide metadata; guides use the same manifest for client and prerender SEO.

| Route | Title | Description |
| --- | --- | --- |
| / | Secure Emergency Digital Vault & Dead Man’s Switch \| AnyCircumstances | Store encrypted files, choose trusted recipients, and use scheduled check-ins to release important information if you become unavailable. |
| /dead-mans-switch | Dead Man's Switch Email for Encrypted Files \| AnyCircumstances | Set recurring check-ins, email reminders, a grace period, and trusted recipients. If you stop responding, AnyCircumstances can securely release assigned files. |
| /digital-vault | Secure Digital Vault for Important Documents \| AnyCircumstances | A personal digital vault for encrypted documents, emergency information, recovery instructions, and controlled delivery to trusted recipients. |
| /emergency-information-vault | Emergency Information Vault for Family \| AnyCircumstances | Organize important documents, contacts, account instructions, insurance information, recovery details, and emergency files for trusted recipients. |
| /features | Encrypted Vault, Trusted Recipients & Check-Ins \| AnyCircumstances | Explore client-side file encryption, scheduled check-ins, trusted recipients, selective sharing, and secure emergency delivery. |
| /how-it-works | How AnyCircumstances Check-Ins & Emergency Delivery Work | See the full flow: encrypted files, trusted recipients, scheduled check-ins, email reminders, a customizable grace period, and secure recipient delivery. |
| /proof-of-life | Proof of Life Protocol & Digital Check-Ins \| AnyCircumstances | Learn how recurring digital proof-of-life check-ins, PIN confirmation, reminders, and a grace period can control secure information release. |
| /pricing | Secure Digital Vault Pricing \| AnyCircumstances | Compare AnyCircumstances plans for encrypted storage, trusted contacts, check-ins, and emergency file delivery. |
| /security | Digital Vault Security & Encryption \| AnyCircumstances | Learn how AnyCircumstances encrypts files on your device, stores ciphertext, protects accounts, and handles controlled recovery. |
| /about | About AnyCircumstances \| Emergency Information Planning | Learn why AnyCircumstances helps people prepare important encrypted information for trusted contacts. |
| /faq | Digital Vault & Dead Man’s Switch FAQ \| AnyCircumstances | Answers about encrypted storage, scheduled check-ins, trusted contacts, emergency delivery, billing, and account security. |
| /guides | Emergency Planning & Digital Inheritance Guides \| AnyCircumstances | Practical guides to emergency information, important documents, passwords, cryptocurrency access, and controlled digital release. |
| /scenarios | Emergency Planning Ideas & Scenarios \| AnyCircumstances | Explore practical ways to prepare private information for family, travel, business continuity, and unexpected emergencies. |
| /contact | Contact AnyCircumstances | Contact the AnyCircumstances team for product and account support. |
| /privacy | Privacy Policy \| AnyCircumstances | Read the AnyCircumstances privacy policy. |
| /terms | Terms of Service \| AnyCircumstances | Read the AnyCircumstances terms of service. |
| /accessibility | Accessibility \| AnyCircumstances | Read the AnyCircumstances accessibility commitment and provide feedback. |
| /guides/emergency-information-checklist | Emergency Information Checklist for Families \| AnyCircumstances | A practical checklist of documents, contacts, account details, and instructions your family may need during an emergency. |
| /guides/digital-emergency-binder | Digital Emergency Binder: What to Include & How to Secure It | Build a useful digital emergency binder without leaving sensitive documents exposed or instructions out of date. |
| /guides/important-documents-family-should-know | Important Documents Your Family Should Know About | A clear guide to the documents, locations, contacts, and instructions family members may need if you become unavailable. |
| /guides/how-to-leave-passwords-to-family | How to Leave Passwords to Family Safely \| AnyCircumstances | Plan how family can find and recover important online accounts without placing passwords in an exposed note or document. |
| /guides/what-happens-to-crypto-when-you-die | What Happens to Bitcoin & Crypto When You Die? \| AnyCircumstances | What happens to Bitcoin, Ethereum, wallets, exchange accounts, seed phrases, and other cryptocurrency when the owner dies or becomes unavailable? |
| /guides/dead-mans-switch-vs-digital-will | Dead Man’s Switch vs Digital Will: Key Differences | Compare conditional information release with digital estate instructions, including when each works and why neither replaces a legal will. |
| /guides/dead-mans-switch-email | Dead Man's Switch Email: How Automatic Check-Ins Work \| AnyCircumstances | Learn how a dead man's switch email works, why check-ins and grace periods matter, and how trusted recipients can be contacted if you stop responding. |
| /guides/proof-of-life-protocol | Proof of Life Protocol: How Digital Check-Ins Work \| AnyCircumstances | Learn what a proof-of-life protocol is, how recurring digital check-ins work, and how missed check-ins can trigger a grace period and conditional release. |
| /guides/what-is-a-digital-vault | What Is a Digital Vault? Secure Document Storage Explained | Learn what a digital vault is, what people store in one, how it differs from cloud storage and password managers, and what to look for in a secure vault. |
| /guides/digital-vault-vs-cloud-storage | Digital Vault vs Cloud Storage: What's the Difference? | Compare secure digital vaults with Google Drive, Dropbox-style cloud storage, password managers, and emergency document storage. |
| /guides/what-happens-to-bitcoin-when-you-die | What Happens to Bitcoin When You Die? | What happens to Bitcoin after death depends on self-custody, exchange custody, hardware wallets, recovery phrases, legal authority, and whether heirs can recover access. |

## Internal links

The requested cluster links below were checked against generated main-content anchors. The supplied Bitcoin-specific, crypto recovery, cloud-storage comparison and digital-will email links are also rendered, together with all new guide related links. The guides index links to all eleven guides.

| From | Exact anchor | To |
| --- | --- | --- |
| /dead-mans-switch | dead man's switch email | /guides/dead-mans-switch-email |
| /dead-mans-switch | proof-of-life check-ins | /guides/proof-of-life-protocol |
| /dead-mans-switch | dead man's switch vs digital will | /guides/dead-mans-switch-vs-digital-will |
| /dead-mans-switch | how check-ins and grace periods work | /how-it-works |
| /digital-vault | what is a digital vault | /guides/what-is-a-digital-vault |
| /digital-vault | digital vault vs cloud storage | /guides/digital-vault-vs-cloud-storage |
| /digital-vault | emergency information vault | /emergency-information-vault |
| /guides/dead-mans-switch-email | digital dead man's switch | /dead-mans-switch |
| /guides/dead-mans-switch-email | proof-of-life protocol | /guides/proof-of-life-protocol |
| /guides/proof-of-life-protocol | dead man's switch | /dead-mans-switch |
| /guides/proof-of-life-protocol | full check-in flow | /how-it-works |
| /guides/what-is-a-digital-vault | secure digital vault | /digital-vault |
| /guides/what-is-a-digital-vault | digital vault vs cloud storage | /guides/digital-vault-vs-cloud-storage |
| /guides/digital-vault-vs-cloud-storage | secure digital vault | /digital-vault |
| /guides/digital-vault-vs-cloud-storage | emergency information vault | /emergency-information-vault |
| /guides/what-happens-to-crypto-when-you-die | what happens to Bitcoin when you die | /guides/what-happens-to-bitcoin-when-you-die |
| /guides/what-happens-to-crypto-when-you-die | dead man's switch | /dead-mans-switch |
| /guides/what-happens-to-crypto-when-you-die | secure digital vault | /digital-vault |
| /guides/what-happens-to-bitcoin-when-you-die | cryptocurrency after death | /guides/what-happens-to-crypto-when-you-die |
| /guides/what-happens-to-bitcoin-when-you-die | secure digital vault | /digital-vault |
| /guides/what-happens-to-bitcoin-when-you-die | dead man's switch | /dead-mans-switch |

## Structured data and semantic HTML

- All eleven guides emit Article and BreadcrumbList JSON-LD, including headline, description, real publication/modification dates, organization author/publisher and canonical mainEntityOfPage.
- Non-guide pages retain WebPage schema. The existing emergency-vault and proof-of-life BreadcrumbList schemas now also appear consistently in source HTML through the route registry.
- No second sitemap or SEO subsystem was introduced. The existing build still writes public/sitemap.xml and dist/sitemap.xml.
- Scenario cards are articles with an existing category label, preserved eyebrow, H3 linked to the scenario, paragraph and separate disclosure button. Existing scenario prose is unchanged.
- Direct Link/Button wrappers in touched public components were converted to a single styled anchor, avoiding nested interactive elements.
- FAQ native disclosures keep the answers in HTML while remaining keyboard-operable without JavaScript.
- Comparison tables have equal cell counts, captions, scoped column/row headings and a keyboard-focusable scroll region. The single local accessibility-lint exception documents why the scroll region needs focus.

## Supplied-copy conflicts and withheld blocks

1. **Passkey check-ins are not implemented in this checkout.** `backend/auth.js:1088` accepts a 4–6 digit PIN at `/verification-check-in`; `src/pages/app/CheckInPage.tsx` uses that PIN flow. Searching the web/backend and sibling iOS source found no WebAuthn/passkey implementation. Withheld the PIN-or-passkey check-in card blocks in Part 5 step 3, Part 7 step 6, Part 11 step 3 and Part 12 step 3. Reused the supplied “You check in” heading and existing “Enter your PIN to confirm the check-in.” sentence. Existing unsupported passkey feature cards were removed from the homepage and Features page. No passkey capability was added.
2. **Reminders are sent after the deadline, during the grace period.** `backend/dispatch_emergency.js:54` filters for `NOW() > next_due_at`, and lines 70–75 schedule the configured 1–5 reminders across the grace window. Part 7 step 4's body promising reminders “when a check-in is approaching or has been missed” was withheld. It uses the exact supplied safe sentence “Reminder emails are sent according to the reminder settings you configured.” No before-deadline reminder behavior was added. Generic educational discussion of what other systems can do remains supplied copy.
3. **Eligibility and setup requirements qualify general release descriptions.** The dispatcher requires an active billing entitlement and verified contacts with assigned files; file access also depends on recipient recovery setup. Uploading and changing schedule/reminder options are subject to existing account/plan controls. The supplied copy does not describe all these prerequisites; it must not be interpreted as an unconditional delivery guarantee. No behavior or pricing numbers were changed to remove these prerequisites.
4. **The panic PIN is a separate trigger.** The same check-in endpoint can dispatch immediately for a panic PIN (`backend/auth.js:1140`). Statements about a successful routine check-in stopping a pending release describe the normal PIN path. The supplied marketing timeline does not describe the panic-PIN exception; additional approved copy is needed if the page should explain that feature.

## Verification

- `npm run build`: passed; client build, SSR build and prerender completed for all 28 routes.
- `python3 scripts/verify-public.py`: passed for all 28 routes. Checks source titles, descriptions, canonicals, robots, H1s, meaningful main content, CTA coverage, schema consistency, guide dates/byline/TOC, table structure, no nested interactive controls, every FAQ answer, sitemap XML/route equality and noindex fallback pages.
- Local isolated headless Chrome tested all 28 generated routes with and without JavaScript: zero hydration/page/console errors and zero title/description/canonical/robots/schema mismatches. The connected Browser runtime had no available browser, so an isolated test browser was used. Production was not contacted or modified.
- Mobile checks at 375px on home, switch-email guide, digital-will guide, crypto guide, how-it-works, digital-vault, FAQ and privacy: no horizontal document overflow. Screenshots reviewed for the homepage and guide layouts; wide tables scroll inside their containers.
- FAQ expand/collapse, timeline anchor and scenario disclosure interactions passed.
- All 21 exact requested cluster anchors passed a generated-HTML check. New-guide supplied-copy checks showed only the documented withheld passkey card blocks.
- Targeted ESLint across all changed/new TypeScript files: one **pre-existing** failure remains at `src/pages/public/PricingPage.tsx:115` (`no-explicit-any` in the unchanged checkout handler). All other targeted files pass.
- `npx tsc --noEmit -p tsconfig.app.json`: two **pre-existing** errors remain: `EmergencyContactsPage.tsx:165` (union response contacts property) and `PricingPage.tsx:113` (billingInterval inferred as string). Neither affected the production build. The private contact code and checkout logic were left unchanged.
- `git diff --check`: passed.

The repeatable source verification script is included in the repository. It generates `dist/public-audit.json`; the browser harness and screenshots stayed in the temporary local QA directory and are not application dependencies.

## Issues intentionally left unchanged / copy still needed

- The existing `/proof-of-life` page overlaps the new protocol guide's search intent. It was preserved as an existing public route rather than adding an unrequested redirect/removal; the exact query map assigns protocol-query ownership to the new guide.
- Scenario text still includes shorthand missed-check-in release descriptions. Per the explicit instruction, scenario prose was not rewritten; its semantic markup was corrected. Approved scenario copy would be needed to spell out the grace-period qualification everywhere.
- More precise approved copy is needed if marketing should explain billing eligibility, recipient verification/recovery prerequisites or panic-PIN behavior. Unsupported passkey and pre-deadline-reminder claims were not shipped.
- The existing checkout lint/type errors and private contacts type error remain outside this content pass.
- Other existing public claims, legal text and security documentation were preserved; no certification, custody, legal-ownership or guaranteed-delivery claim was added.
- No production deployment, production-server access, redirect/configuration change, Caddy/PM2 change or backend/API change was performed.

## Files changed

`src/App.tsx` already had the proof-of-life route before this pass and was not edited during this implementation. The remaining files below were added or updated in this pass (some started with user changes):

- `docs/SEO_IMPLEMENTATION_REPORT.md`
- `docs/SEO_QUERY_MAP.md`
- `public/sitemap.xml`
- `scripts/verify-public.py`
- `src/components/public/ArticleContent.tsx`
- `src/components/public/ContextualCta.tsx`
- `src/components/scenarios/ScenarioCard.tsx`
- `src/data/ctas.ts`
- `src/data/faqs.ts`
- `src/data/guides.ts`
- `src/data/publicContent.json`
- `src/index.css`
- `src/layouts/PublicLayout.tsx`
- `src/pages/public/AccessibilityPage.tsx`
- `src/pages/public/ContactPage.tsx`
- `src/pages/public/DeadMansSwitchPage.tsx`
- `src/pages/public/DigitalVaultPage.tsx`
- `src/pages/public/EmergencyInformationVaultPage.tsx`
- `src/pages/public/FaqPage.tsx`
- `src/pages/public/FeaturesPage.tsx`
- `src/pages/public/GuidePage.tsx`
- `src/pages/public/HowItWorksPage.tsx`
- `src/pages/public/LandingPage.tsx`
- `src/pages/public/PricingPage.tsx`
- `src/pages/public/ProofOfLifePage.tsx`
- `src/pages/public/ScenariosPage.tsx`
- `src/seo/publicRoutes.ts`
