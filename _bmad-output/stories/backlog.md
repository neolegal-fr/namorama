# Namespoter — Backlog User Stories

> Généré par BMad Master · 2026-02-19
> Langue de sortie : English (per config)

---

## US-001 · International vs. Local Domain Name Search

**As a** user searching for a domain name,
**I want to** indicate whether I'm targeting an international audience or a local/regional one,
**So that** the AI generates names and checks extensions that are relevant to my market.

### Acceptance Criteria
- [ ] Step 1 or Step 2 includes a toggle/option: **International** | **Local**
- [ ] When "Local" is selected, the locale is auto-detected from the selected TLD extensions (e.g. `.fr` → French, `.de` → German, `.es` → Spanish)
- [ ] The user can override the detected locale via a dropdown or text field
- [ ] The locale is passed to the AI keyword/name generation prompt to bias suggestions toward the target language and culture
- [ ] If no locale-specific extension is selected, the setting defaults to International

### Notes
- Locale inference table (initial): `.fr`→fr, `.de`→de, `.es`→es, `.it`→it, `.nl`→nl, `.pt`→pt, `.pl`→pl, `.be`→fr/nl, `.ch`→fr/de
- The locale preference should be persisted with the project

---

## US-002 · Copy Domain Name from Results Table

**As a** user reviewing available domain names,
**I want to** copy a domain name (with its extension) to my clipboard with a single click,
**So that** I can quickly use it in a registrar, document, or message without manual selection.

### Acceptance Criteria
- [ ] Each row in the results table has a copy icon (📋) next to the domain name
- [ ] Clicking the icon copies `name + extension` (e.g. `floralship.com`) to the clipboard
- [ ] A brief visual feedback is shown on success (e.g. icon changes to ✓ for 1.5s)
- [ ] If multiple extensions are selected, clicking the icon copies all available combinations (e.g. `floralship.com, floralship.net`) or opens a small popover to choose
- [ ] Works in all modern browsers (uses `navigator.clipboard.writeText`)

---

## US-003 · Fix Header Overlap on Scroll (Step 3)

**As a** user scrolling through domain results on Step 3,
**I want the** extensions/availability banner to not overlap the domain table rows,
**So that** I can read results without content being hidden behind sticky elements.

### Acceptance Criteria
- [ ] The extensions banner (Step 3 top panel) does not overlay table rows when scrolling
- [ ] If the banner is sticky, appropriate `scroll-margin-top` or `padding-top` compensates for its height
- [ ] Tested at common breakpoints: 375px, 768px, 1280px
- [ ] No content is clipped or unreachable

### Notes
- Likely a `position: sticky` + `z-index` conflict with PrimeNG Card/Table components
- Prefer inline styles over Tailwind utilities for layout properties (known PrimeNG override issue)

---

## US-004 · Retrieve User Locale from Keycloak at Login

**As a** user who logs in via Keycloak SSO,
**I want** the application to read my preferred locale from my Keycloak profile,
**So that** the interface language is automatically set to my preference without manual selection.

### Acceptance Criteria
- [ ] On successful authentication, the app reads the `locale` claim from the Keycloak token (or the `preferred_username`/user profile endpoint)
- [ ] If a valid locale is found (`fr`, `en`, etc.), `TranslateService.use(locale)` is called
- [ ] If no locale is found in the token, the current browser-detection logic is used as fallback
- [ ] The locale selection UI (flag toggle) still allows the user to override manually
- [ ] The Keycloak realm must expose the `locale` attribute in the token (verify realm config)

### Notes
- Keycloak token claims: check `locale` or `preferred_locale` in `KeycloakService.getKeycloakInstance().tokenParsed`
- Realm config: Mappers → add "User Attribute" mapper for `locale` to ID token

---

## US-005 · Domain Name Pros & Cons Analysis (On-Demand, Cached)

**As a** user interested in a specific domain name,
**I want** an AI-generated analysis of that name's strengths and weaknesses,
**So that** I can make an informed decision before registering it.

### Acceptance Criteria
- [ ] When the user marks a domain as a **favourite** (❤️), the analysis is automatically triggered in the background
- [ ] The analysis is computed **once** and cached (stored with the suggestion in the DB)
- [ ] The analysis is displayed below the domain name when it is selected/expanded (or in a tooltip/panel on the favourite row)
- [ ] Analysis covers: memorability, pronounceability, international readability, SEO potential, brand risk (generic vs. distinctive), length
- [ ] If the analysis is pending, a subtle loading indicator is shown
- [ ] The analysis is NOT recomputed if already present in the DB

### API Changes
- New field on `DomainSuggestion` entity: `analysis: string | null`
- New endpoint: `POST /domain/analyze { suggestionId }` — returns `{ analysis: string }`; idempotent (returns cached if already computed)
- Triggered automatically by the toggle-favourite flow (fire-and-forget, non-blocking)

### Frontend Changes
- After toggling favourite ON: call `analyzeIfNeeded(result.id)` in the background
- Display analysis text (expandable panel) under the domain row when available

---

## US-006 · Landing Page Redesign — SSO / Marketing Focus

**As a** visitor discovering Namespoter for the first time,
**I want** to immediately understand what the service does and feel invited to try it,
**So that** I convert to a registered user.

### Acceptance Criteria

#### Tagline
- [ ] A short tagline is displayed prominently below the logo/title, e.g.:
  *"NameSpotter — Find a relevant, available domain name. Fast."*

#### Marketing Section (above the fold)
- [ ] Concise value proposition: what it does, how (AI + real WHOIS), why it's better
- [ ] 3–4 key benefit bullets: AI-powered suggestions, real-time availability, favourite & save, multi-extension support
- [ ] Visual or icon set to support the copy

#### Call to Action
- [ ] Prominent CTA button: **"Discover X free domain names"** (X = initial credit grant, e.g. 10)
- [ ] CTA navigates to Step 1 of the wizard (description input)
- [ ] If user is already logged in, the CTA reads **"Start a new search"** and goes directly to Step 1

#### SSO Integration
- [ ] "Login / Register" action is available from the landing page header
- [ ] After login, the user is redirected back to the landing page (or wizard if they clicked CTA first)

---

## US-007 · Multi-Extension Input (Pre-filled, Flexible Separators)

**As a** user configuring domain extensions to check,
**I want** the extension field to be pre-filled with `.com` and to accept multiple extensions in a flexible format,
**So that** I can quickly set up my search without worrying about exact syntax.

### Acceptance Criteria
- [ ] The extension input field is **pre-filled with `.com`** when the wizard starts or resets
- [ ] The user can enter multiple extensions separated by **space, comma, or semicolon** (e.g. `com net .io`, `.fr, .de`, `.com;.net`)
- [ ] Extensions are normalized on input: a leading `.` is added if missing, lowercased
- [ ] Pressing **Enter** or clicking **Add** parses all entered extensions and adds them as chips
- [ ] Duplicate extensions are silently ignored
- [ ] Invalid format shows a brief inline validation message

### Notes
- The current single-extension-at-a-time UX is a friction point; batch input resolves this
- Default value: `['.com']` (already the case in `resetProject()`)

---

## US-008 · Streaming Domain Results (Progressive Display)

**As a** user waiting for domain search results,
**I want** results to appear progressively as they are found,
**So that** I'm not staring at a blank spinner for the full duration of the search.

### Acceptance Criteria
- [ ] The search endpoint streams results as each domain candidate is validated (WHOIS check passed)
- [ ] The frontend appends each new result to the table as it arrives, without clearing existing rows
- [ ] A progress indicator shows how many names have been checked so far (e.g. "7/20 checked…")
- [ ] The full loading overlay is replaced by an inline per-row animation
- [ ] If the stream ends with fewer results than expected, a "No more results" state is shown

### Technical Notes
- Backend: replace `Promise.all` batch + return with a **Server-Sent Events (SSE)** stream or chunked HTTP response
- NestJS: use `@Sse()` decorator or `res.write()` with `Transfer-Encoding: chunked`
- Frontend: use `EventSource` or `HttpClient` with `reportProgress: true` + `observe: 'events'`
- This is a **medium-high complexity** story; consider splitting into: (a) SSE infrastructure spike, (b) UI progressive rendering

---

## US-009 · Search Timeout Warning (30s)

**As a** user waiting for domain search results,
**I want** to be notified if the search is taking longer than 30 seconds,
**So that** I can decide whether to wait, retry, or adjust my query.

### Acceptance Criteria
- [ ] If no result has been returned after **30 seconds**, a non-blocking dialog or toast appears:
  *"The search is taking longer than expected. Do you want to keep waiting?"*
- [ ] The dialog offers two actions: **Keep waiting** | **Cancel and retry**
- [ ] "Keep waiting" dismisses the dialog and continues the search
- [ ] "Cancel and retry" aborts the current request and returns the user to Step 2
- [ ] The timer resets when new results arrive (relevant once US-008 streaming is implemented)
- [ ] The 30-second threshold is a configurable constant (frontend only)

---

## US-010 · Streaming Domain Results (Progressive Display)

**As a** user waiting for domain search results,
**I want** results to appear one by one as each domain is validated,
**So that** I see progress immediately instead of staring at a spinner for the full search duration.

> Replaces US-008 with a more concrete spec.

### Acceptance Criteria
- [ ] Each validated domain appears in the table as soon as its WHOIS check completes, without waiting for the full batch
- [ ] A subtle inline indicator shows how many names have been checked so far (e.g. "12 checked…")
- [ ] The global full-screen loading overlay is removed; individual row spinners replace it
- [ ] The 30s timeout dialog (US-009) remains compatible (timer resets on each new row received)
- [ ] If the stream ends with zero results, the "No results" message appears immediately

### Technical Notes
- Backend: NestJS `@Sse()` decorator, emit one JSON event per validated candidate
- Frontend: replace `HttpClient.post` with `EventSource` or `HttpClient` with `observe: 'events'` + `reportProgress`
- The existing `recheckDomains()` WHOIS path stays unchanged (it already returns full results)
- Split into two sub-tasks: (a) SSE endpoint spike, (b) progressive UI rendering

---

## US-011 · Manual Row Entry (User-defined Domain Ideas)

**As a** user reviewing AI-generated domain suggestions,
**I want to** add my own domain name ideas to the results table,
**So that** I can check their availability alongside the AI suggestions in the same interface.

### Acceptance Criteria
- [ ] Below the results table, a text input allows the user to type a bare domain name (without extension, e.g. `florizon`)
- [ ] Pressing **Enter** or clicking **Add** appends a new row to the table with the entered name
- [ ] Availability is checked immediately for all currently selected extensions (same WHOIS recheck flow as adding a new TLD)
- [ ] The row shows spinners per extension while checking, then ✓/✗ per result
- [ ] Manually added rows are visually distinguishable (e.g. a subtle ✏️ icon or different row shade)
- [ ] Manually added rows are saved with the project (persisted as regular suggestions)
- [ ] Duplicate names (already in the table) are silently ignored

### Technical Notes
- Reuse the existing `recheckDomains(names, extensions)` endpoint — just call it with the single new name
- Save the row via the existing `addSuggestions` project service method

---

## US-012 · MCP Server — Invoke Namespoter from an AI Chat

**As a** developer or power user working in an AI chat environment (Claude, Cursor, etc.),
**I want** a Model Context Protocol (MCP) server that exposes Namespoter's core functions as tools,
**So that** I can search for available domain names directly from my AI assistant without opening the web app.

### Acceptance Criteria
- [ ] An MCP server (Node.js / TypeScript) is published and documented
- [ ] It exposes at minimum the following tools:
  - `search_domains(description, keywords, extensions, matchMode)` → returns available domains
  - `recheck_domains(names, extensions)` → returns availability matrix
  - `get_project(projectId)` → returns saved project with suggestions
- [ ] The server authenticates with the Namespoter API using an API key (new auth mechanism, separate from Keycloak SSO)
- [ ] It can be declared in a `.mcp.json` / `claude_desktop_config.json` with a simple `npx namespoter-mcp` command
- [ ] README documents setup, authentication, and example prompts

### Technical Notes
- Use the official MCP TypeScript SDK (`@modelcontextprotocol/sdk`)
- New API key auth: add a `POST /auth/api-key` endpoint or a static key managed via env var
- Publish as `namespoter-mcp` on npm (or as a private package initially)
- Consider a `search_and_refine(description)` composite tool that chains refine + keywords + search

---

## US-013 · Distribution — Teams App, Claude Skill, Marketplace Integrations

**As a** user of productivity tools (Microsoft Teams, Slack, Claude.ai, etc.),
**I want** to access Namespoter's domain search directly within my existing workflow tool,
**So that** I don't have to switch context to find and check domain names.

### Acceptance Criteria

#### Microsoft Teams App
- [ ] A Teams app manifest is created and published to the Teams App Store (or sideloaded for internal use)
- [ ] Users can invoke `@Namespoter find me a domain for [description]` in any Teams channel or chat
- [ ] Results are returned as an Adaptive Card with the availability matrix

#### Claude Skill (claude.ai)
- [ ] The MCP server (US-012) is registered as a Claude skill / integration
- [ ] Users can invoke domain search from Claude.ai conversations without leaving the chat

#### Slack App (optional / later)
- [ ] A Slack slash command `/namespoter [description]` triggers a search and posts results as a Block Kit message

### Technical Notes
- Teams: use Bot Framework SDK + Adaptive Cards; requires Azure Bot registration
- Claude skill: depends on US-012 MCP server being published and accepted by Anthropic
- Prioritise MCP (US-012) first as it unblocks both Claude skill and potentially other integrations
- API key auth (US-012) is a prerequisite for all integrations

---

## US-014 · Online Credit Purchase via Stripe (Packs + Subscription)

**As a** registered user who needs credits,
**I want** to subscribe to a monthly plan or purchase extra credit packs,
**So that** I can continue searching for domain names without friction, choosing the model that suits my usage.

---

### Pricing Model

#### Monthly Subscription
- **Essential** — 2 000 credits/month · **€5/month**
- Credits reset on each billing cycle (unused credits are **not** carried over)
- Managed by the customer via the Stripe Customer Portal (upgrade, cancel, update payment method)

#### Extra Credit Packs (one-time, stackable)
- **Pack 1000** — 1 000 credits · **€10** (one-time)
- Extra credits are **preserved** (no expiry)
- Extra credits are consumed **after** subscription credits are exhausted

#### Credit Consumption Order
1. Subscription credits (reset monthly)
2. Extra credits (permanent, consumed only when subscription credits reach 0)

---

### Acceptance Criteria

#### Frontend — Billing Dialog
- [ ] The existing credit dialog is replaced by a billing page or modal with two sections:
  - **Subscription**: current plan status (active / inactive), monthly credits remaining, next renewal date; CTA to subscribe or manage via Stripe Customer Portal
  - **Extra credits**: "Buy 1 000 credits — €10" button triggers a Stripe Checkout one-time session
- [ ] Credit balance in the navbar displays: `subscription credits + extra credits` (total)
- [ ] After any payment, the credit balance refreshes automatically (polling or redirect)
- [ ] On successful payment/subscription, the user is redirected to `/payment/success`
- [ ] On cancellation, the user is redirected to `/payment/cancel` (or back to the dialog)

#### Backend — Data Model
- [ ] `User` entity gains two new fields:
  - `subscriptionCredits: number` (reset monthly by webhook, default 0)
  - `extraCredits: number` (accumulated, never reset, default 0)
- [ ] `User.credits` (existing field) becomes a computed property: `subscriptionCredits + extraCredits`
- [ ] New `stripeCustomerId: string` field on `User` (created on first checkout)
- [ ] New `stripeSubscriptionId: string | null` field on `User`

#### Backend — Endpoints
- [ ] `POST /payments/checkout/subscription` (authenticated)
  - Creates a Stripe Checkout Session in `subscription` mode for the Essential plan
  - Returns `{ url: string }`
- [ ] `POST /payments/checkout/pack` (authenticated)
  - Creates a Stripe Checkout Session in `payment` mode for the 1 000-credit pack
  - Returns `{ url: string }`
- [ ] `GET /payments/portal` (authenticated)
  - Creates a Stripe Billing Portal session for the authenticated user
  - Returns `{ url: string }` — frontend redirects the user to it
- [ ] `POST /payments/webhook` (public, Stripe signature verified)
  - `checkout.session.completed` (mode=`payment`) → add 1 000 to `extraCredits`
  - `invoice.paid` (subscription) → reset `subscriptionCredits` to 2 000
  - `customer.subscription.deleted` → set `subscriptionCredits` to 0, clear `stripeSubscriptionId`
  - All handlers are idempotent (check event already processed via `stripeEventId`)

#### Invoicing
- [ ] Stripe automatic invoices enabled for subscriptions and one-time payments
- [ ] Invoices are sent by Stripe directly to the customer's email (PDF attached)
- [ ] Stripe invoice settings configured in Dashboard: commercial name "Namespoter", legal footer with NeoLegal's SIRET, VAT number, and registered address (French legal requirement)
- [ ] Stripe payouts configured to NeoLegal's Qonto IBAN — no API integration needed
- [ ] Monthly Stripe CSV export for accounting / bookkeeping (no Qonto API integration in scope)

#### Stripe Customer Portal
- [ ] Portal enabled in Stripe Dashboard with permissions: cancel subscription, update payment method, view invoice history
- [ ] "Manage my subscription" button in the billing dialog opens the portal (via `GET /payments/portal`)

#### Configuration
- [ ] `STRIPE_SECRET_KEY` env var (backend)
- [ ] `STRIPE_WEBHOOK_SECRET` env var (backend)
- [ ] `STRIPE_ESSENTIAL_PRICE_ID` env var — Stripe Price ID for the monthly subscription
- [ ] `STRIPE_PACK_PRICE_ID` env var — Stripe Price ID for the 1 000-credit pack
- [ ] `STRIPE_PORTAL_RETURN_URL` env var — URL to redirect after portal session

#### Success / Cancel Pages
- [ ] `/payment/success`: confirmation message + refreshed credit balance
- [ ] `/payment/cancel`: cancellation message + link back to billing dialog

### Technical Notes
- Use `stripe` Node.js SDK on the backend (`npm install stripe`)
- Stripe Checkout hosted page (no card data in the app — PCI-compliant)
- Create Stripe Products & Prices in the Dashboard before development; store Price IDs in env vars
- For local dev: `stripe listen --forward-to localhost:3000/payments/webhook`
- Credit deduction logic stays in `UsersService.decrementCredits()` — update to consume `subscriptionCredits` first, then `extraCredits`

### Out of Scope (for this story)
- Multiple subscription tiers
- VAT / Stripe Tax automation
- Refunds
- Promo codes / coupons

---

## US-015 · Exclude Already-Evaluated Candidates from LLM Re-generation

**As a** user requesting additional domain suggestions ("More suggestions"),
**I want** the AI to avoid re-proposing names it has already generated,
**So that** every new batch brings genuinely fresh ideas.

### Acceptance Criteria
- [ ] When calling the LLM for a new batch of candidates, the list of already-evaluated domain names (base names, without extension) is included in the prompt context
- [ ] The prompt explicitly instructs the LLM to avoid any name already in the list
- [ ] The backend passes this exclusion list regardless of whether the request is an initial search or a "More suggestions" top-up
- [ ] The exclusion list is capped to a reasonable size (e.g. 200 names) to avoid token bloat — oldest entries are trimmed first if the list exceeds the cap
- [ ] No duplicate base names appear across successive batches for the same project

### Technical Notes
- The existing `DomainSuggestion` records for the current project are the source of truth for the exclusion list
- Pass as a compact comma-separated list in the prompt: `Already tested (do not reproduce): floralship, bloomly, verdana, …`
- Consider prompt-token budget: 200 names × ~8 chars avg ≈ 1 600 chars — acceptable for GPT-3.5

---

## US-016 · Memorable Brand & Domain Name Criteria in LLM Prompt

**As a** user looking for a strong domain name,
**I want** the AI to apply proven memorability criteria when generating suggestions,
**So that** the names I receive are not just available but genuinely brandable.

### Acceptance Criteria
- [ ] The generation prompt explicitly instructs the LLM to favour names that meet the following criteria:
  - **Short**: ideally ≤ 10 characters (base name without extension)
  - **Easy to pronounce**: phonetically natural in the target language, no ambiguous letter clusters
  - **Easy to spell**: no unexpected silent letters, no confusing double letters unless intentional
  - **Distinctive**: not generic (avoid `easybooking`, `quickservice`-style constructs)
  - **No hyphens or numbers** in the base name
  - **Evocative**: ideally suggests the product's benefit, emotion, or sector without being literal
  - **Legally safer**: avoid trademarked terms or proper nouns
- [ ] The prompt weight on memorability can be tuned without code change (configurable system prompt or env-var override)
- [ ] The existing locale/target-language injection (US-001) is preserved and combined with these new criteria

### Technical Notes
- Update `DomainService.buildPrompt()` (or equivalent) to include a "Brand name quality criteria" section
- Keep the criteria as a bullet list in a dedicated prompt section — easier to iterate on than inline prose
- A/B test before and after with the same description to validate improvement

---

## US-017 · Extended European Language Support

**As a** user targeting a non-English, non-French European market,
**I want** to select my target language from a broader list of European languages,
**So that** the AI generates culturally and linguistically appropriate domain name suggestions.

### Acceptance Criteria
- [ ] The language selector (Step 2, local/regional mode) includes at minimum: German (de), Spanish (es), Italian (it), Portuguese (pt), Dutch (nl), Polish (pl), Swedish (sv), Danish (da), Finnish (fi), Romanian (ro), Czech (cs)
- [ ] The selected language is passed to the LLM prompt and to the keyword generation step
- [ ] The UI language selector itself (FR/EN flag toggle) remains separate from the target-language selector
- [ ] Adding a new language requires only a new entry in a config array — no code change
- [ ] Languages are listed alphabetically (by their native name) in the dropdown

### Technical Notes
- Existing locale inference table (`.fr`→fr, `.de`→de, etc.) in US-001 should be extended to cover all new languages
- LLM prompt: replace the current hardcoded language instruction with a dynamic `Generate names in {{language}}` insertion
- Consider grouping: "Most common" at top (en, fr, de, es), then alphabetical full list

---

## US-018 · Favourite Comparison Tool

**As a** user who has shortlisted several favourite domain names,
**I want** to compare them side by side in a structured view,
**So that** I can make a final decision without toggling back and forth through the full results table.

### Acceptance Criteria
- [ ] A "Compare favourites" button or tab appears when the user has ≥ 2 favourites
- [ ] The comparison view displays each favourite in a column (or card) with:
  - Domain name + availability per extension (✓/✗ matrix)
  - Length (character count of base name)
  - AI memorability score or pros/cons summary if available (US-005)
  - A "Copy" action per domain
  - An "Open registrar" link per available extension
- [ ] The user can remove a domain from the comparison without un-favouriting it
- [ ] The comparison is limited to 5 domains maximum to keep the layout usable
- [ ] The view is accessible from Step 3 (results page) and from the project drawer

### Technical Notes
- No new backend endpoint required — data is already in the local project state
- Implement as a Dialog or a dedicated panel below the results table
- If US-005 (pros/cons) is not yet implemented, the analysis column is hidden

---

## US-019 · Configurable Batch Size for "More Suggestions"

**As a** user requesting additional domain suggestions,
**I want** to specify how many new suggestions I want before clicking "More suggestions",
**So that** I can choose between a quick top-up (5) or a larger batch (20) based on my needs and credit budget.

### Acceptance Criteria
- [ ] The "More suggestions" button is accompanied by a small numeric selector (stepper or segmented control): **5 · 10 · 20** (default: 10)
- [ ] The selected quantity is passed to the backend as the `count` parameter of the domain search request
- [ ] The credit cost is displayed next to the selector: e.g. "= 10 credits"
- [ ] The selected quantity persists within the session (sticky across successive "More" clicks)
- [ ] The selector does not appear if the user has fewer credits than the minimum option (5)

### Technical Notes
- Backend already accepts a `count` / `limit` parameter — verify and expose it if not already wired
- Display format suggestion: `[ More suggestions ] [ 5 | 10 | 20 ]` or a single split-button

---

## US-020 · Feedback Form with 1 000-Credit Reward

**As a** user of Namespoter,
**I want** to share feedback about what could be improved and receive free credits in return,
**So that** I'm incentivised to contribute to the product's improvement.

### Acceptance Criteria
- [ ] A "Give feedback" entry point is visible in the app (e.g. menu bar item, footer link, or floating button)
- [ ] Clicking it opens a dialog with:
  - A headline: *"Tell us what could be improved — get 1 000 free credits"*
  - A free-text area (required, min 20 chars, max 1 000 chars)
  - An optional email field (pre-filled if the user is logged in)
  - A submit button
- [ ] On submission:
  - The feedback is stored in the DB (`Feedback` entity: `id`, `keycloakId`, `email`, `message`, `createdAt`)
  - **1 000 extra credits are added to the user's account** (same as buying a pack, but free)
  - A success toast confirms: *"Thank you! 1 000 credits have been added to your account."*
  - The user cannot submit feedback more than **once per 30 days** (rate-limit per account)
- [ ] If the user is not logged in, clicking "Give feedback" prompts login first
- [ ] The feedback is viewable by admins via a simple `GET /feedback` endpoint (authenticated, admin role)

### Technical Notes
- New `Feedback` entity + `FeedbackModule` (controller + service)
- Credit grant uses the existing `usersService.addExtraCredits(keycloakId, 1000)`
- Rate-limit: query the latest `Feedback` record for the user; reject if `createdAt > now - 30 days`
- No email notification to admin in scope (can be added later)

---

## US-021 · Explain Credit Cost in UI ("1 credit = 1 name suggestion")

**As a** new or occasional user,
**I want** to understand clearly what a credit represents and how many I'm spending,
**So that** I can make informed decisions about my searches and purchases.

### Acceptance Criteria
- [ ] The credit balance display in the nav bar includes a tooltip or info icon explaining: *"1 credit = 1 domain name suggestion"*
- [ ] On Step 2 (before searching), the search button label or a sub-label indicates the estimated credit cost: e.g. *"Search — ~10 credits"*
- [ ] The billing dialog includes a line: *"Each domain name suggestion costs 1 credit. Extensions checked do not cost extra."*
- [ ] The landing page free-credits note is updated to reference the explanation: *"100 free credits on sign-up = up to 100 domain name suggestions"*
- [ ] i18n: both FR and EN translations are provided for all new strings

### Technical Notes
- No backend change required
- Tooltip on credit balance: PrimeNG `pTooltip` directive
- Estimated cost on search button: derive from `selectedKeywords.length × (estimated names per keyword)` — or simply show a fixed `~10 credits per search`

---

## US-022 · "Buy on registrar" button for available domains

**As a** user who has found an available domain name,
**I want** a direct link to buy it on a registrar from within the results table,
**So that** I can register the domain immediately without leaving the app and searching manually.

### Context — Affiliate programmes

| Registrar | Market | Commission (domains) | Cookie | Notes |
|-----------|--------|----------------------|--------|-------|
| **OVH** | France / EU | 3.2% | 45 days | Via third-party network (CJ / Impact). French market leader. |
| **Namecheap** | International | 35% | 30 days | Via Impact Radius / ShareASale. High commission. |
| **Gandi** | France / EU | TBC — no confirmed public programme | — | Respected by devs; worth a direct link even without commission. |
| **GoDaddy** | International | Via CJ | 30 days | Optional, lower brand perception in FR market. |

**Recommendation**: start with OVH + Namecheap (confirmed programmes). Add Gandi as a no-commission direct link. Skip GoDaddy for now.

---

### Acceptance Criteria

#### Results table
- [ ] For each cell where a domain+extension is **available** (✓), a small external-link icon or "Buy" micro-button appears on row hover
- [ ] Clicking opens the registrar's domain search/purchase page in a new tab, pre-filled with the full domain (e.g. `florizon.com`)
- [ ] If multiple registrars are configured, a small popover lets the user choose (e.g. OVH | Namecheap | Gandi)
- [ ] The button/icon does **not** appear for unavailable (✗) or pending (spinner) cells
- [ ] On mobile, the button is always visible (no hover state)

#### Affiliate link configuration
- [ ] Registrar URLs and affiliate tracking IDs are configured via environment variables:
  - `REGISTRAR_OVH_AFFILIATE_ID` — appended to OVH deep-link if set
  - `REGISTRAR_NAMECHEAP_AFFILIATE_ID` — appended to Namecheap deep-link if set
- [ ] If no affiliate ID is configured for a registrar, a plain (non-tracked) deep-link is used as fallback
- [ ] Deep-link URL patterns (configurable):
  - OVH: `https://www.ovhcloud.com/fr/domains/domain-name-search/?q={domain}` (+ affiliate param if configured)
  - Namecheap: `https://www.namecheap.com/domains/registration/results/?domain={domain}` (+ affiliate param)
  - Gandi: `https://www.gandi.net/fr/domain/suggest?q={name}` (no affiliate)

#### Frontend configuration
- [ ] The list of active registrars is driven by a config array in the frontend (easy to add/remove registrars without code changes)
- [ ] Each registrar entry includes: `name`, `label`, `icon` (or logo URL), `buildUrl(domain: string): string`
- [ ] The default registrar (used for single-click, no popover) can be configured

### Technical Notes
- All affiliate URL-building logic stays on the **frontend** (pure URL construction, no backend needed)
- Affiliate IDs can be injected via Angular environment files (`environment.ts` / `environment.prod.ts`) or fetched from a `GET /config` public endpoint
- Track clicks via `window.open(url, '_blank', 'noopener')` — no additional analytics needed in scope
- Registrar logos: use text labels initially; replace with SVG logos later if desired

### Out of Scope
- Automated affiliate programme registration
- Price comparison between registrars
- Cart/checkout integration

---

## Priority / Effort Matrix (initial estimate)

| Story | Value | Effort | Priority |
|-------|-------|--------|----------|
| US-007 · Multi-extension input | High | Low | 🔴 Now |
| US-003 · Scroll overlap fix | High | Low | 🔴 Now |
| US-002 · Copy to clipboard | High | Low | 🔴 Now |
| US-004 · Locale from Keycloak | Medium | Low | 🟠 Next |
| US-006 · Landing page redesign | High | Medium | 🟠 Next |
| US-001 · International/local toggle | Medium | Medium | 🟠 Next |
| US-009 · Timeout warning | Medium | Low | 🟠 Next |
| US-005 · Pros & cons analysis | High | High | 🟡 Later |
| US-010 · Streaming results (SSE) | High | High | 🟡 Later |
| US-011 · Manual row entry | Medium | Low | 🟠 Next |
| US-012 · MCP server | High | Medium | 🟡 Later |
| US-013 · Teams / Claude skill / Marketplace | High | High | 🔵 Future |
| US-014 · Stripe packs + subscription | High | High | 🟠 Next |
| US-015 · Exclude already-evaluated candidates | High | Low | 🟠 Next |
| US-016 · Memorable brand criteria in prompt | High | Low | 🟠 Next |
| US-017 · Extended European language support | Medium | Low | 🟠 Next |
| US-018 · Favourite comparison tool | Medium | Medium | 🟡 Later |
| US-019 · Configurable batch size ("More") | Medium | Low | 🟠 Next |
| US-020 · Feedback form + 1 000 credit reward | High | Medium | 🟠 Next |
| US-021 · Explain credit cost in UI | High | Low | 🔴 Now |
| US-022 · "Buy on registrar" button (OVH, Namecheap, Gandi) | High | Low | 🟠 Next |
