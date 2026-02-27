# Namespoter — Backlog User Stories

> Généré par BMad Master · 2026-02-19
> Langue de sortie : English (per config)

---

## US-001 · International vs. Local Domain Name Search

**Status**: ✅ Implemented

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

**Status**: ✅ Implemented

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

**Status**: ✅ Implemented

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

**Status**: ✅ Implemented

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

**Status**: ✅ Implemented

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

**Status**: ✅ Implemented

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

**Status**: ✅ Implemented

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

**Status**: ✅ Implemented

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

**Status**: ✅ Implemented

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

**Status**: ✅ Implemented (duplicate of US-008)

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

**Status**: ✅ Implemented

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

**Status**: ❌ To do

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

**Status**: ❌ To do

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

**Status**: ✅ Implemented

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

**Status**: ✅ Implemented

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

**Status**: ✅ Implemented

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

**Status**: ⚠️ Partial (FR/EN implemented; DE, ES, IT, etc. not yet)

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

**Status**: ❌ To do

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

**Status**: ⚠️ Partial (fixed at 10, not configurable via UI)

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

**Status**: ❌ To do

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

**Status**: ⚠️ Partial (coût implicite visible dans le dialog billing, pas de warning pré-recherche)

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

**Status**: ❌ To do

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

## US-023 · Landing Page — Brand Name Angle & SEO Optimisation

**Status**: ⚠️ Partial (contenu brand en place, meta tags / Open Graph / schema.org manquants)

**As a** entrepreneur searching for a brand name online,
**I want** to find Namespoter when I search for "find a brand name" or "brand name generator",
**So that** I discover the tool through organic search rather than only word-of-mouth.

### Context

The current landing page positions Namespoter primarily as a **domain name finder**. But the core value proposition is stronger: *find a brand name that is also available as a domain*. This dual angle (brand + domain) targets a broader and higher-intent audience — founders, freelancers, and product teams who start from the question "what should I call my brand?" not "what domain should I buy?".

SEO opportunity: queries like *"trouver un nom de marque"*, *"générateur nom de marque"*, *"brand name generator"*, *"find available brand name"* have significant search volume and are underserved by most domain-focused tools.

---

### Acceptance Criteria

#### Messaging & copy
- [ ] The main headline (`h1`) leads with the **brand name** angle, not the domain angle, e.g.:
  - FR: *"Trouvez le nom de marque idéal — avec le domaine disponible."*
  - EN: *"Find the perfect brand name — with the domain available."*
- [ ] The sub-headline clarifies the dual benefit: brand name + domain availability, in one step
- [ ] The benefit bullets are reordered / reworded to lead with brand naming:
  - "AI-generated brand name ideas tailored to your product and audience"
  - "Real-time domain availability check across all extensions"
  - "Short, memorable, distinctive — quality criteria built in"
  - "Save your favourites and share with your team"
- [ ] The CTA button copy reflects the brand angle: *"Find my brand name"* / *"Trouver mon nom de marque"*
- [ ] The free-credits note mentions brand names: *"100 free credits = up to 100 brand name ideas"*

#### SEO (meta tags & structure)
- [ ] `<title>` tag: *"Namespoter — Brand Name Generator with Domain Availability"* (FR + EN variants)
- [ ] `<meta name="description">`: 150-160 chars covering brand name + domain + AI + free
- [ ] `<h1>` contains the primary keyword ("brand name" / "nom de marque")
- [ ] Semantic HTML: the landing section uses `<section>`, `<h1>`, `<h2>`, `<ul>` — not just `<div>` + `<p>`
- [ ] `lang` attribute on `<html>` is set correctly per active locale (fr / en)
- [ ] Open Graph tags added: `og:title`, `og:description`, `og:url`, `og:image` (placeholder image acceptable initially)

#### Structured data (optional but recommended)
- [ ] A `<script type="application/ld+json">` block declares the page as a `WebApplication` with `name`, `description`, `url`, `applicationCategory: "BusinessApplication"`

### Technical Notes
- Changes are mostly in `web/src/index.html` (meta tags, lang), `web/src/app/components/wizard/wizard.html` (landing section copy), and `web/public/assets/i18n/fr.json` + `en.json` (translation keys)
- The `lang` attribute can be set dynamically from `TranslateService.onLangChange` via a small effect in `AppComponent`
- Angular does not support SSR in the current setup — meta tags are only seen by JS-capable crawlers (Googlebot). Consider adding `@angular/ssr` in a future story if SEO becomes a priority
- Canonical URL: add `<link rel="canonical" href="https://namespoter.com/">` in `index.html`

### Out of Scope
- Server-side rendering (SSR)
- Sitemap generation
- Multilingual hreflang tags

---

## US-024 · Keycloak Theme — Align Login/Register Pages with App Design

**Status**: ✅ Implemented

**As a** user registering or logging in to Namespoter,
**I want** the Keycloak login and registration pages to look like the rest of the application,
**So that** the experience feels seamless and professional rather than generic.

### Context

Keycloak serves its own login/register/forgot-password pages. By default these use the Keycloak "Keycloak" theme (grey, generic). Namespoter uses a clean, minimal design (PrimeNG Aura, dark primary colour, sans-serif). The disconnect is jarring when users are redirected to login.

Keycloak supports custom themes via a `themes/` folder mounted into the container. A custom theme can extend `keycloak` (base) or `keycloak.v2` and override only the CSS/templates needed.

---

### Acceptance Criteria

#### Visual alignment
- [ ] Background colour matches the app: white or very light grey (`#f8f9fa`)
- [ ] Primary action button (Login, Register, Submit) matches the app's primary colour (`var(--p-primary-color)` ≈ `#6366f1` indigo or the configured Aura primary)
- [ ] Font family matches the app: system-ui / Inter (or whatever is used globally)
- [ ] The Keycloak logo/name is replaced by the **Namespoter wordmark** (text or SVG logo)
- [ ] Form inputs have the same border-radius and focus style as PrimeNG inputs
- [ ] Error messages are styled consistently (red, not default Keycloak styling)
- [ ] Footer text ("Powered by Keycloak") is removed or replaced with "© Namespoter"

#### Pages covered
- [ ] Login (`login.ftl`)
- [ ] Registration (`register.ftl`)
- [ ] Forgot password (`login-reset-password.ftl`)
- [ ] Email sent confirmation (`login-page-expired.ftl` / info page)

#### Infrastructure
- [ ] The custom theme lives in `infra/keycloak/themes/namespoter/` and is mounted into the container via `docker-compose.yml`
- [ ] `docker-compose.yml` passes `--spi-theme-default=namespoter` (or sets `KC_SPI_THEME_DEFAULT`) so the realm uses it automatically
- [ ] The realm-export.json is updated to reference `loginTheme: "namespoter"` so it applies on fresh import
- [ ] Hot-reload works in dev: theme changes are reflected without rebuilding the container (Keycloak dev mode caches themes per request when `KC_CACHE=local`)

#### Localisation
- [ ] FR and EN translations are provided for all overridden strings (via `messages/messages_fr.properties` and `messages_en.properties`)

### Technical Notes
- Keycloak theme structure: `themes/namespoter/login/` with `theme.properties`, `resources/css/styles.css`, and optionally overridden `.ftl` templates
- `theme.properties` must declare `parent=keycloak.v2` to inherit all default templates and only override what's needed
- CSS-only approach preferred (override `styles.css` only, no `.ftl` changes) unless logo replacement requires template edit
- The Namespoter logo can be injected via `theme.properties` → `styles=css/styles.css` and a CSS `content:url(...)` or an `<img>` in an overridden `login.ftl` header
- Docker volume mount: `- ./keycloak/themes:/opt/keycloak/themes` in `infra/docker-compose.yml`
- Test all pages in FR and EN before closing the story

### Out of Scope
- Custom email templates (separate story)
- Dark mode for Keycloak pages
- Advanced animations or illustrations

---

## US-025 · Auto-Favourite Manually Added Domains

**Status**: ✅ Implemented

**As a** user who adds a domain name manually to the results table,
**I want** it to be automatically marked as a favourite,
**So that** the AI analysis is triggered immediately and the row stays visible at the top of the list.

### Acceptance Criteria
- [ ] When `addManualDomain()` successfully adds a row, `isFavorite` is set to `true` on the temp row immediately (optimistic)
- [ ] Once the suggestion is saved to the DB (after WHOIS check), `toggleFavorite` is called server-side to persist the favourite state
- [ ] The AI analysis (US-005) is triggered automatically for the new row (same as toggling favourite)
- [ ] The row is sorted to the top of the table alongside other favourites

### Technical Notes
- In `addManualDomain()`, after receiving the saved suggestion ID, call `projectService.toggleFavorite(id)` then `domainService.analyzeName(id)`
- Set `isManual: true, isFavorite: true` on the temp row before the WHOIS check so the heart is immediately red

---

## US-026 · Refined Analysis Display — Star Gauge + Detail Card (US-005 follow-up)

**Status**: ✅ Implemented

**As a** user viewing a favourited domain's analysis,
**I want** to see a compact summary line with a star score and key points, expandable to a full metric detail card,
**So that** I get immediate signal quality at a glance without the full text always taking up space.

### Acceptance Criteria

#### Compact summary line (always visible when analysis is ready)
- [ ] Displayed on a single discreet line directly below the domain name (inside the same table cell)
- [ ] Contains: a **5-star gauge** (average of all 6 metric scores) + the first **strength** + the first **weakness**, truncated with ellipsis if too long
- [ ] Example: `★★★★☆  ✅ Punchy and short  ⚠️ May clash with "Florazon"`
- [ ] Font size ≈ 0.72rem, muted colour (`#6b7280`), no background

#### Detail card (expandable)
- [ ] A `…` or `+` button at the end of the summary line opens a detail card (replaces the current chevron behaviour from US-005)
- [ ] The detail card shows each of the 6 metrics as a labelled star-bar row:
  ```
  Memorability       ★★★★☆
  Pronunciation      ★★★★★
  International      ★★★☆☆
  SEO                ★★☆☆☆
  Distinctiveness    ★★★★☆
  Length             ★★★☆☆  (7 chars)
  ```
- [ ] Below the metrics: full **Strengths** and **Watch out** text
- [ ] The card closes when clicking `…` again or clicking elsewhere

#### Backend — structured analysis format
- [ ] The AI prompt is updated to return **structured JSON** instead of free text:
  ```json
  {
    "scores": { "memorability": 4, "pronunciation": 5, "international": 3, "seo": 2, "distinctiveness": 4, "length": 3 },
    "strengths": "Punchy and short, easy to spell",
    "watchout": "May be confused with similar names in the sector"
  }
  ```
- [ ] The `analysis` DB column stores this JSON string
- [ ] The average score is computed on the frontend: `mean(Object.values(scores))`
- [ ] Existing plain-text analyses (from US-005 initial implementation) are treated as legacy and re-analysed on next favourite toggle if the JSON parse fails

### Technical Notes
- Update `DomainService.analyzeNameWithAI()` to use `response_format: { type: 'json_object' }` and a prompt that returns the above structure
- Frontend: parse `result.analysis` as JSON; fall back to displaying raw text if parse fails (backwards compat)
- Star gauge: render with `★` / `☆` characters or a simple loop — no extra library needed
- The detail card can be a `<div>` positioned absolutely or just inline-expanded below the summary line (inline preferred, simpler)

---

## US-027 · Move Streaming Progress Panel Between Table and Action Buttons

**Status**: ✅ Implemented

**As a** user watching domain results appear progressively,
**I want** the streaming progress indicator to appear between the last table row and the "More suggestions" button,
**So that** it feels connected to the table being built rather than floating above it.

### Acceptance Criteria
- [ ] The streaming progress panel (`streamProgress()`) is moved from its current position (above the table) to **between the table and the navigation buttons**
- [ ] When `streamProgress()` is active and `domains().length > 0`, the panel appears directly below the table card, above the manual entry input and the action buttons
- [ ] When `streamProgress()` is null (search complete or not started), the panel is hidden (no layout shift)
- [ ] The panel width matches the table (`max-width: 36rem; width: 100%`)
- [ ] Layout order in Step 3 becomes:
  1. Title + subtitle
  2. Note (if fewer results than expected)
  3. Copy table button
  4. Results table
  5. **Streaming progress panel** ← moved here
  6. Manual domain entry input
  7. Navigation buttons (Back / New project / More suggestions)

### Technical Notes
- Cut the `<div *ngIf="streamProgress()">` block from its current location in `wizard.html` and paste it after the `</div>` closing the table wrapper
- No logic changes required

---

## US-028 · Fix Dropdown Menus Rendering Too Low on Scroll

**Status**: ⚠️ Partial (appendTo="body" appliqué, à valider en test réel)

**As a** user who has scrolled down the page,
**I want** dropdown menus (Select, language picker, match-mode selector) to open at the correct position relative to their trigger,
**So that** I don't have to scroll back up to interact with them.

### Acceptance Criteria
- [ ] All PrimeNG `<p-select>` / `<p-selectButton>` / overlay panels open at the correct screen position regardless of scroll offset
- [ ] Tested at: no scroll, 200px scroll, 600px scroll on both desktop and mobile
- [ ] No regression on other overlay components (Drawer, Dialog, Toast, Tooltip)

### Root Cause (likely)
PrimeNG overlays default to `appendTo="body"` which positions the panel relative to `document.body`. If the body has `overflow: hidden` or if there's a CSS `transform` on an ancestor, the overlay calculates its position from the wrong origin. Alternatively, the overlay uses `position: absolute` relative to the viewport scroll offset and miscalculates.

### Technical Notes
- Check `appendTo` attribute on all `<p-select>` usages — ensure it is either `"body"` (default, usually correct) or not set
- Check `styles.css` and `index.html` for any `overflow: hidden` or `transform` on `body` / `html` / wrapper elements that could break fixed/absolute positioning
- PrimeNG 21 known issue: if the parent has `position: relative` and `overflow: hidden`, overlay panels clip. Solution: ensure no ancestor of the trigger has `overflow: hidden`
- If the issue is scroll-related: PrimeNG overlays should recalculate on scroll — check if `appendTo="body"` is missing on affected components

---

## US-029 · Subscription Management & Self-Service Cancellation

**Status**: ❌ To do

**As a** subscribed user,
**I want** to view my current subscription details and cancel it on my own,
**So that** I am not locked in and always have clear visibility over my billing commitment.

### Context
US-014 implements the Stripe checkout and Customer Portal redirect. This story focuses on the **post-subscription self-service experience**: a dedicated account section the user can reach at any time, showing subscription status and providing a one-click path to manage or cancel.

### Acceptance Criteria

#### Frontend — Account / Subscription Section
- [ ] A "Subscription" tab or card is accessible from the user menu (top-right avatar / menu) at all times
- [ ] The section displays:
  - Current plan name (e.g. "Essential — 2 000 credits/month") or "No active subscription"
  - Subscription status badge: **Active** / **Cancelled (active until …)** / **Expired**
  - Subscription credits remaining this period + reset date (e.g. "1 340 / 2 000 — resets on 15 Mar")
  - Extra (permanent) credits balance
  - Next billing date and amount (if active)
- [ ] A **"Manage subscription"** button opens the Stripe Customer Portal in a new tab (`GET /payments/portal`)
- [ ] A **"Cancel subscription"** shortcut button is shown (active plan only):
  - Triggers a confirmation dialog: "Your subscription will remain active until [date]. After that, your monthly credits will not renew. Confirm?"
  - On confirm, redirects to the Stripe Customer Portal pre-opened on the cancellation flow
- [ ] After cancellation (user returns from portal), the status badge updates to "Cancelled (active until …)" on next page load / polling
- [ ] No active subscription: section shows "No active plan" and a CTA "Subscribe" (links to US-014 checkout flow)

#### Backend
- [ ] `GET /users/me/subscription` — returns:
  ```json
  {
    "plan": "essential" | null,
    "status": "active" | "cancelled" | "expired" | "none",
    "subscriptionCredits": 1340,
    "subscriptionCreditsTotal": 2000,
    "extraCredits": 500,
    "currentPeriodEnd": "2026-03-15T00:00:00Z" | null,
    "nextBillingAmount": 500 | null
  }
  ```
- [ ] Data sourced from local DB fields + optional Stripe API call for `nextBillingAmount` (or cached on webhook)
- [ ] The existing `GET /payments/portal` endpoint (US-014) is reused as-is for the management redirect

#### Webhook — Cancellation State
- [ ] `customer.subscription.updated` with `cancel_at_period_end: true` → set a new `subscriptionCancelledAt: Date` field on `User` (date of next period end); status becomes "cancelled" in the API response

### Technical Notes
- The Subscription section can be implemented as a new `<p-dialog>` or a new route `/account` with a tab layout
- Prefer a dialog (consistent with existing "credits" dialog pattern) unless the account page already exists
- `subscriptionCancelledAt` field added to `User` entity; `status` in the API response is derived:
  - `active`: `stripeSubscriptionId` set, `subscriptionCancelledAt` null
  - `cancelled`: `stripeSubscriptionId` set, `subscriptionCancelledAt` in the future
  - `expired`: `stripeSubscriptionId` null, `subscriptionCancelledAt` in the past (or cleared)
  - `none`: no `stripeSubscriptionId` ever
- Stripe Customer Portal handles payment method updates, invoice history, and cancellation — no need to rebuild those flows

---

## US-030 · Import Description from a Web Page URL

**Status**: ❌ To do

**As a** user who already has a product or landing page,
**I want** to paste a URL instead of writing my product description manually,
**So that** Namespoter can extract the relevant context automatically and I can skip the writing step.

### Acceptance Criteria

#### Frontend — Step 1 (Description)
- [ ] Below the description textarea, a collapsible "Or import from a URL" section appears
- [ ] It contains:
  - A URL input field with placeholder `https://myproduct.com`
  - An **"Extract"** button (disabled while empty or loading)
- [ ] On click, a spinner replaces the button and the textarea is disabled
- [ ] On success, the extracted description fills the textarea; the user can edit it before continuing
- [ ] On error (unreachable URL, extraction failed, etc.), a toast message is shown: "Could not extract content from this URL. Please enter the description manually."
- [ ] The URL input and the textarea are mutually exclusive as *primary input* but not locked: the user can still type or edit the textarea after extraction

#### Backend — New Endpoint
- [ ] `POST /domain/extract-description` (authenticated)
  - Body: `{ "url": string }`
  - Validates that `url` is a well-formed `http` or `https` URL
  - Fetches the page HTML (timeout: 8 s, max body: 512 KB)
  - Strips HTML tags, removes nav/footer/script/style noise (basic cheerio extraction targeting `<main>`, `<article>`, `<h1>`, `<p>` tags)
  - Sends the cleaned text (truncated to 3 000 chars) to OpenAI with the prompt:
    > "You are a product analyst. Based on the following web page content, write a concise product description (2–4 sentences) suitable for generating brand name ideas. Focus on what the product does, who it is for, and its key differentiator."
  - Returns: `{ "description": string }`
  - Costs **0 credits** (extraction is a free helper action, not a domain suggestion)
  - Rate-limited: max 5 calls/user/hour to avoid abuse

#### Security & Edge Cases
- [ ] SSRF protection: reject URLs resolving to private IP ranges (10.x, 192.168.x, 127.x, etc.) before fetching
- [ ] `User-Agent` header set to `Namespoter-Bot/1.0` on outgoing fetch
- [ ] If the page returns a non-200 status, return a 422 with `{ "error": "page_unreachable" }`
- [ ] If extracted text < 50 chars after stripping, return a 422 with `{ "error": "content_too_short" }`
- [ ] PDF / non-HTML content-types are rejected immediately (future story could handle PDFs)

### Technical Notes
- Use `axios` (already a NestJS dependency) for the HTTP fetch with a custom timeout config
- Use `cheerio` for HTML parsing (add as dependency: `npm install cheerio`)
- SSRF check: use `dns.lookup` + IP range validation before the actual fetch, or use a library like `ssrf-req-filter`
- New `DomainController` route: `POST /domain/extract-description`
- Rate limiting: use `@nestjs/throttler` with a custom TTL/limit override for this specific endpoint
- Frontend: new method `extractDescriptionFromUrl(url: string): Observable<{ description: string }>` in `DomainService`

---

## US-031 · LLM Model Selection — Standard vs. Premium

**Status**: ❌ To do

**As a** user who wants higher-quality name suggestions,
**I want** to choose between a standard model (fast, economical) and a premium model (more creative, more accurate),
**So that** I can decide the right trade-off between credit cost and output quality for my project.

### Context
The backend currently uses `gpt-3.5-turbo` for all AI calls (keyword generation, domain idea generation, description reformulation, name analysis). A premium tier using `gpt-4o` would produce more creative and contextually relevant suggestions, at a higher per-call cost that is passed on to the user as extra credits consumed.

### Pricing Model

| Tier | Model | Cost per domain suggestion | Cost per analysis |
|------|-------|---------------------------|-------------------|
| Standard | `gpt-3.5-turbo` | 1 credit | 1 credit |
| Premium | `gpt-4o` | 3 credits | 2 credits |

### Acceptance Criteria

#### Frontend — Model Selector (Step 1)
- [ ] A segmented control or radio group is displayed in Step 1 below the description textarea:
  - **Standard** — GPT-3.5 · 1 credit / suggestion
  - **Premium** — GPT-4o · 3 credits / suggestion ✨
- [ ] The selected tier is persisted in the wizard state signal and sent with every API request
- [ ] When switching to Premium, a brief inline tooltip or note reads: "More creative results — uses 3× more credits"
- [ ] The current credit balance is visible nearby so the user can evaluate affordability
- [ ] The model choice is saved with the project (restored on project reload)

#### Backend — Model Routing
- [ ] All `DomainService` methods (`reformulateDescription`, `generateKeywords`, `generateDomainIdeas`, `recheckDomainWithAI`, `analyzeNameWithAI`, `extractDescription`) accept an optional `model: 'standard' | 'premium'` parameter (default: `'standard'`)
- [ ] A private helper `resolveModel(tier)` maps tier → OpenAI model ID:
  - `'standard'` → `'gpt-3.5-turbo'`
  - `'premium'` → `'gpt-4o'`
- [ ] The `SearchDomainsDto` gains a `tier?: 'standard' | 'premium'` field (default `'standard'`)
- [ ] Credit deduction in `DomainController` applies the correct multiplier:
  - Standard: 1 credit per available domain found (current behaviour)
  - Premium: 3 credits per available domain found
- [ ] Analysis (`POST /domain/analyze`) also deducts 1 (standard) or 2 (premium) credits based on the tier stored on the project or passed in the request

#### Backend — Safeguards
- [ ] If the user's total credit balance < multiplier × requested batch size, the API returns a 402 with `{ "error": "insufficient_credits", "required": N, "available": M }` before any OpenAI call is made
- [ ] The premium model is only available to authenticated users (public/anonymous users are locked to Standard)

### Technical Notes
- The 6 `openai.chat.completions.create({ model: 'gpt-3.5-turbo', ... })` calls in `domain.service.ts` are the only change points — replace the hardcoded string with `this.resolveModel(tier)`
- `gpt-4o` supports `response_format: { type: 'json_object' }` (same as gpt-3.5-turbo) — no prompt changes needed
- Store `tier` on the `Project` entity as an optional string field (migration required); default `'standard'` for existing projects
- The `DomainSuggestion` entity can optionally store the model used for traceability/debugging

---

## US-032 · Long-Form "Phrase" Domain Names for Local Market Targeting

**Status**: ❌ To do

**As a** user who has selected a local/regional market target,
**I want** the app to also suggest phrase-based domain names (longer, conversational names in my target language),
**So that** I can explore a style of domain that is natural-sounding, memorable in the local language, and often still available.

### Context
When targeting a local market (US-001), short invented names may feel foreign or SEO-weak. Phrase-based domains (e.g. `monboulangerparis.fr`, `jetrouvemonpsy.fr`, `deinhandwerker.de`) are a proven alternative: they rank on long-tail keywords, are easy to remember and type, and tend to have much higher availability than short names. This generation mode complements — but does not replace — the standard short-name search.

### Acceptance Criteria

#### Frontend — Step 2 (Keywords / Options)
- [ ] When `isLocal` is active (US-001), a toggle appears in Step 2: **"Also suggest phrase-style domains"** (off by default)
- [ ] When enabled, the search request includes `phraseDomains: true`
- [ ] In the results table (Step 3), phrase-style domains are visually distinguished with a badge or icon (e.g. 📝 or "phrase") so the user can tell them apart from short names
- [ ] The toggle state is persisted in the wizard state and saved with the project

#### Backend — Phrase Domain Generation
- [ ] When `phraseDomains: true`, `DomainService.generateDomainIdeas()` runs a **second, separate prompt** targeting phrase-style names:
  - Prompt instruction (adapted to the active locale):
    > "Generate 10 domain name ideas that are natural phrases or short sentences in {locale} language. They should be 3–6 words long, use no hyphens, and describe what the product or service does in everyday language. Examples for French: `jetrouvemonpsy`, `monboulangerparis`, `lecoachdevotreequipe`. Return only a JSON array of lowercase strings without spaces or dots."
  - The phrase prompt runs in parallel with (or after) the standard short-name prompt
  - The resulting names are merged into the candidate list before Whois verification
- [ ] Phrase domains are flagged with `style: 'phrase'` in the `DomainSuggestion` entity (new optional field, default `'standard'`)
- [ ] Credit deduction is identical to standard suggestions (1 credit per domain found available, or the premium multiplier if US-031 is active)
- [ ] `phraseDomains` is only accepted when `locale` is set (guard: returns 400 if `phraseDomains: true` and no locale)

#### Whois Verification
- [ ] Phrase-style domains go through the same Whois verification pipeline as standard domains — no special handling required

### Technical Notes
- The second prompt can be added as a private `generatePhraseDomainIdeas(description, keywords, locale, model)` method in `DomainService`, following the same structure as `generateDomainIdeas()`
- Both prompts can be fired concurrently with `Promise.all` to keep latency low
- If the total candidate pool (standard + phrase) exceeds the target batch size, prioritise standard names first; include phrase names up to the remaining quota
- The `style` column on `DomainSuggestion` is a simple `varchar` with default `'standard'`; migration required
- Frontend badge: a small `p-tag` with severity `secondary` and value "phrase" appended next to the domain name in the table

---

## US-033 · Tinder Mode — Swipe to Like / Dislike Domain Names

**Status**: ❌ To do

**As a** user who has received domain name suggestions,
**I want** to review them one by one in a swipe-style card interface,
**So that** I can quickly sort through many options without the cognitive load of a full table, and end up with a clear shortlist.

### Context
The current table view works well on desktop but is overwhelming on mobile and cognitively demanding when there are many results. A card-by-card "Tinder mode" reduces each decision to a binary yes/no, naturally building a shortlist. It complements — not replaces — the table: a toggle lets the user switch between both views at any time.

### UX Flow
1. User arrives at Step 3 (results). A toggle in the header switches between **Table view** and **Tinder mode**.
2. In Tinder mode, one card is shown at a time. The card displays:
   - The domain name (large, centred)
   - Availability badge per selected extension (✅ / ❌)
   - If analysis exists: star score inline
3. The user acts:
   - **👎 Dislike** (swipe left / left button) — skips the name; it is added to the dislike list
   - **👍 Like** (swipe right / right button) — adds the name to the shortlist panel
   - **❤️ Coup de cœur** (center button or double-tap) — marks as favourite (calls `toggleFavorite()`, triggers AI analysis) and adds to shortlist
4. When all current cards have been reviewed, the app shows:
   - "All names reviewed — load more?" → calls `findDomains(append=true)` with disliked names added to `excludeNames`
5. At any point the user can open the **shortlist panel** (slide-in or bottom sheet) to review their liked / coup-de-cœur names.
6. A **"Done"** button on the shortlist exits Tinder mode and switches back to Table view, filtered to the liked names only.

### Acceptance Criteria

#### Frontend — View Toggle
- [ ] A segmented control (`p-selectButton`) in the Step 3 header lets the user switch between **📋 Table** and **🃏 Tinder**
- [ ] The selected view mode is persisted in the wizard state (survives navigation within the wizard session)
- [ ] Switching to Tinder mode starts from the first unreviewed card (not from the beginning if the user has already swiped some)

#### Frontend — Card UI
- [ ] One card is visible at a time, centred on screen, with subtle drop-shadow and rounded corners
- [ ] Card content:
  - Domain name in large bold text
  - A row of extension availability chips: `.com ✅ · .fr ❌ · .net ✅`
  - Star score (if analysis available), greyed-out placeholder if not
- [ ] Three action buttons below the card: **✕ Dislike** · **❤️ Coup de cœur** · **✓ Like**
- [ ] On desktop: click buttons. On mobile: swipe left (dislike) / swipe right (like) gestures are supported in addition to buttons
- [ ] A swipe animation plays on action (card slides out left or right with a colour tint: red for dislike, green for like, pink for coup de cœur)
- [ ] A progress indicator shows "X / N reviewed" and the number of names liked so far
- [ ] When there are no more cards: a "Load more suggestions" prompt appears automatically

#### Frontend — Shortlist Panel
- [ ] A floating badge (bottom-right) shows the count of liked names; clicking it opens the shortlist panel
- [ ] The shortlist panel lists liked and coup-de-cœur names with their availability and analysis score
- [ ] The user can un-like a name from the shortlist panel (removes from shortlist, does not add to dislike)
- [ ] A "Done – keep shortlist" button exits Tinder mode and filters the Table view to shortlisted names only

#### Frontend — State Signals
- [ ] New signals in `WizardComponent`:
  - `tinderMode = signal<boolean>(false)`
  - `tinderIndex = signal<number>(0)` — index of the current card in `domains()`
  - `likedNames = signal<string[]>([])` — names liked or coup-de-cœur
  - `dislikedNames = signal<string[]>([])` — names to exclude from next batch
- [ ] `dislikedNames()` is merged into `excludeNames` on the next `findDomains(append=true)` call (alongside already-displayed names, per US-015)

#### Backend
- [ ] No backend changes required. All actions (like, coup de cœur, load more) use existing endpoints:
  - Coup de cœur → `toggleFavorite()` (existing)
  - Load more → `findDomains(append=true)` with extended `excludeNames` (existing)

### Technical Notes
- Swipe gesture: use the `(touchstart)` / `(touchend)` Angular host listeners on the card element, compute `deltaX`; threshold: 80px
- Card animation: CSS `transition: transform 0.3s, opacity 0.3s` + Angular `[style.transform]` binding; add a `leaving-left` / `leaving-right` class on action then reset after transition
- The Tinder view iterates `domains()` by index (`tinderIndex`); since `domains()` is a live signal that grows as streaming adds results, new cards appear automatically at the end of the deck
- Do NOT remove disliked domains from `domains()` — they remain in the Table view (the user may want to reconsider); only hide them in Tinder mode via the index pointer
- No PrimeNG card component needed — a plain `<div>` with inline styles avoids theme overrides (per project CSS conventions)

---

## Priority / Effort Matrix (initial estimate)

| Story | Value | Effort | Priority | Status |
|-------|-------|--------|----------|--------|
| US-007 · Multi-extension input | High | Low | 🔴 Now | ✅ Done |
| US-003 · Scroll overlap fix | High | Low | 🔴 Now | ✅ Done |
| US-002 · Copy to clipboard | High | Low | 🔴 Now | ✅ Done |
| US-021 · Explain credit cost in UI | High | Low | 🔴 Now | ⚠️ Partial |
| US-025 · Auto-favourite manually added domains | High | Low | 🔴 Now | ✅ Done |
| US-027 · Move streaming progress panel position | Medium | Low | 🔴 Now | ✅ Done |
| US-028 · Fix dropdown menus rendering too low on scroll | High | Low | 🔴 Now | ⚠️ Partial |
| US-004 · Locale from Keycloak | Medium | Low | 🟠 Next | ✅ Done |
| US-006 · Landing page redesign | High | Medium | 🟠 Next | ✅ Done |
| US-001 · International/local toggle | Medium | Medium | 🟠 Next | ✅ Done |
| US-009 · Timeout warning | Medium | Low | 🟠 Next | ✅ Done |
| US-011 · Manual row entry | Medium | Low | 🟠 Next | ✅ Done |
| US-014 · Stripe packs + subscription | High | High | 🟠 Next | ✅ Done |
| US-015 · Exclude already-evaluated candidates | High | Low | 🟠 Next | ✅ Done |
| US-016 · Memorable brand criteria in prompt | High | Low | 🟠 Next | ✅ Done |
| US-017 · Extended European language support | Medium | Low | 🟠 Next | ⚠️ Partial |
| US-019 · Configurable batch size ("More") | Medium | Low | 🟠 Next | ⚠️ Partial |
| US-020 · Feedback form + 1 000 credit reward | High | Medium | 🟠 Next | ❌ To do |
| US-022 · "Buy on registrar" button (OVH, Namecheap, Gandi) | High | Low | 🟠 Next | ❌ To do |
| US-023 · Landing page — brand name angle & SEO | High | Low | 🟠 Next | ⚠️ Partial |
| US-026 · Refined analysis display — star gauge + detail card | High | Medium | 🟠 Next | ✅ Done |
| US-029 · Subscription management & self-service cancellation | High | Medium | 🟠 Next | ❌ To do |
| US-030 · Import description from a web page URL | High | Medium | 🟠 Next | ❌ To do |
| US-031 · LLM model selection — Standard vs. Premium | High | Medium | 🟠 Next | ❌ To do |
| US-032 · Long-form "phrase" domain names for local targeting | Medium | Low | 🟠 Next | ❌ To do |
| US-033 · Tinder mode — swipe to like / dislike domain names | High | Medium | 🟠 Next | ❌ To do |
| US-005 · Pros & cons analysis | High | High | 🟡 Later | ✅ Done |
| US-010 · Streaming results (SSE) | High | High | 🟡 Later | ✅ Done |
| US-012 · MCP server | High | Medium | 🟡 Later | ❌ To do |
| US-018 · Favourite comparison tool | Medium | Medium | 🟡 Later | ❌ To do |
| US-024 · Keycloak theme — align with app design | Medium | Medium | 🟡 Later | ✅ Done |
| US-013 · Teams / Claude skill / Marketplace | High | High | 🔵 Future | ❌ To do |
