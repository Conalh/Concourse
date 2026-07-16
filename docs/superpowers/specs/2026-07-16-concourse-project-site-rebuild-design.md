# Concourse Project Site Rebuild Design

- **Date:** 2026-07-16
- **Status:** Approved for implementation planning
- **Target:** `website/` on the Concourse repository
- **Audience:** Open-source developers, designers, technical writers, and course authors who may contribute to Concourse

## Summary

Replace the existing Concourse project website wholesale with a clean-slate static site. The new site is an interactive project manifesto: it demonstrates the learning experience first, explains the open system underneath second, and then gives prospective contributors concrete ways to participate.

The site is not a commercial landing page. It does not sell subscriptions, collect leads, or imply that Concourse is a hosted service. Its job is to make the project understandable in seconds and make contribution feel useful, credible, and approachable.

The existing website is not a design or content reference. Its HTML, CSS, JavaScript, imagery, copy, component structure, and visual decisions must be removed rather than adapted.

## Goals

1. Make the central idea immediately legible: Concourse turns a subject into a guided learning route.
2. Demonstrate that idea through a real, lightweight interaction rather than a product screenshot or promotional animation.
3. Reveal the larger model naturally: guided routes, active recall, progress, and portable local learning packs.
4. Present the usable application and the open pack ecosystem as two connected contribution surfaces.
5. Give contributors clear entry points across interface work, learning-engine development, pack tooling, local-first infrastructure, documentation, and course authoring.
6. State the current project boundary honestly: open source, local first, no accounts, no hosted learner state, and no marketplace behavior.
7. Remain fast, accessible, responsive, dependency-light, and maintainable without a website build pipeline.

## Non-Goals

- Redesigning or modifying the React/Tauri learning application.
- Reusing any part of the current project site.
- Building a hosted learning service, account flow, analytics system, mailing list, marketplace, or payment path.
- Embedding the complete Concourse application into the project site.
- Turning the homepage into full project documentation or a substitute for the repository README.
- Claiming unreleased catalog, cloud, or marketplace functionality.
- Persisting demo answers, identifying visitors, or making network requests during the demo.

## Core Message

The site should establish this sequence of ideas:

1. Learning is easier to follow when knowledge has a route.
2. Concourse is a working local-first application for following those routes and practicing recall.
3. Those routes can be packaged as portable, versioned learning packs.
4. The application and pack system are both open for contributors to improve.

The primary hero copy is:

> **Learning should have a route.**
>
> Concourse is an open-source, local-first system for building guided learning routes, practicing recall, and sharing portable course packs.

- Primary action: **Explore the demo**
- Secondary action: **View on GitHub**

There is no eyebrow, badge, version pill, or pretitle above the hero heading.

## Information Architecture

### 1. Header

The header contains a newly designed Concourse mark and wordmark, in-page links to Demo, System, and Contribute, plus a clear GitHub link. On small screens it becomes a two-row navigation: the brand and GitHub link remain on the first row, while the three in-page links sit on a second row. It does not use a hamburger menu or add another JavaScript interaction.

### 2. Hero

The hero uses a desktop split composition: large editorial copy on the left and the first state of the interactive route on the right. The demo preview is already visible before interaction, so the visitor understands that the primary action opens a real experience.

On mobile, the copy precedes the demo in a single column. The primary action scrolls and focuses the active demo surface.

### 3. Guided Demo

The four-step demo is the main explanatory device. It uses a simple custom microbiology topic, **Inside a bacterial cell**, rather than a production course pack.

The four beats are:

1. **Choose the route.** The visitor starts a three-concept route: cell membrane, DNA, and ribosomes.
2. **Learn one idea.** A simplified bacterial-cell diagram focuses on the membrane. One concise explanation states that the cell membrane regulates movement into and out of the cell.
3. **Recall it.** The visitor answers, “Which structure controls movement into and out of the cell?” The choices are Cell membrane, DNA, and Ribosomes. Cell membrane is correct. A correct answer advances the route. An incorrect answer receives an explanatory response and can retry without losing place.
4. **See what moved.** The completed concept becomes visible progress. The interface then reveals that the lesson belongs to `bacterial-cell-basics.learntpack`, identified as local, portable, versioned, and editable.

The tour is always user-controlled. It does not autoplay. It offers Back and Reset controls once they are relevant. The entire path should take roughly 30–45 seconds, but a visitor should understand the primary idea from the first interaction.

The demo is a faithful miniature of the product model, not a claim that the sample pack ships with Concourse.

### 4. System Explanation

The page pulls back from the demo into a concise architecture story:

- **Route:** structured course creation and course learning.
- **Loop:** flashcards, retrieval practice, and review.
- **Transfer:** portable course and pack exchange.
- **Concourse:** the open application that ties the experience together.

A connected diagram shows two equal layers:

```text
Learning experience
routes · recall · progress · browser/desktop UI
                    ↕
Open pack system
contracts · validation · archives · local installation · authored content
```

This diagram must remain readable as semantic HTML. Decorative connector lines may enhance it but may not carry the meaning alone.

### 5. Contributor Paths

The contributor section begins with **Find your way in.** It presents four specific paths:

1. **Shape the experience** — React UI, accessibility, learning flows, visualization, and interaction design.
2. **Build the learning engine** — sequencing, evidence, recall, progress, and the framework-independent core.
3. **Extend portable packs** — contracts, validation, SDK tooling, security boundaries, and import/export workflows.
4. **Create learning routes** — example packs, authoring guidance, templates, documentation, and openly licensed course material.

Each path links to the most relevant repository directory or maintained documentation. Link destinations must be verified against the current repository during implementation. No link may point at a hypothetical issue label or document.

A compact good-first-contribution strip explains the actual development path:

```text
Clone → npm ci → npm run dev → npm run verify
```

It links to `CONTRIBUTING.md` instead of reproducing the full setup guide.

### 6. Current Project Truth

This section uses the heading **Built enough to use. Early enough to shape.** It distinguishes delivered v0.1 capabilities from next work.

Current claims may include only repository-verified capabilities, such as the browser and Tauri shells, deterministic learning sessions, portable pack contracts and SDK tooling, local persistence, defensive pack validation, and the bundled Logic Foundations example.

The status section also states the boundary plainly:

- no accounts
- no hosted learner state
- no analytics
- no application backend
- learner progress and installed packs stay local

Volatile counts such as exact test totals should either be derived during implementation from current verified output or omitted. The site must not hard-code a count that is likely to drift unnoticed.

### 7. Final Invitation and Footer

The final heading is **Help build better routes through knowledge.** It links to GitHub, `CONTRIBUTING.md`, `ROADMAP.md`, and the demo reset/start action.

The footer includes the MIT software license link, security reporting link, repository link, and a concise local-first statement. It does not include social-proof counters, newsletter forms, social network links, or fabricated organization information.

## Visual System

The site combines open-source precision with playful energy inside the demo.

### Palette

- Canvas: warm white `#F6F7F2`
- Primary ink: near-black `#10131A`
- Secondary ink: slate `#5F6672`
- Rules: `#D7DAD1`
- Primary action: cobalt `#2457FF`
- Demo accent: electric lime `#C7F34A`
- Feedback/highlight accent: coral `#FF6B57`
- Dark technical surface: midnight `#141B2D`

Contrast must meet WCAG AA for normal text and interactive states. Lime is an accent/background treatment, not a default small-text color on white.

### Typography

Use one self-hosted, open-licensed Instrument Sans variable font for headings, body, and interface text. Technical labels, commands, and pack metadata use the platform `ui-monospace` stack. The site makes no third-party font request.

Headings are large, compact, and editorial. Body copy remains comfortably readable with moderate line lengths. Technical labels are small but never below an accessible reading size.

### Composition

- A disciplined 12-column desktop grid.
- Strong shared edges and thin rules instead of a page made of floating cards.
- Generous negative space around major statements.
- Restrained corner radii used where interaction or containment requires them.
- Large section transitions with a visible route line connecting major ideas.
- A denser, more colorful demo area nested within the quieter editorial page.

### Route Motif

An abstract line with junctions and progress nodes runs through the visual language. It must not become literal transit imagery. There are no trains, station signs, tickets, or map pastiche. In the demo, the route line is functional: it communicates the active concept and visible progress.

### Illustration and Identity

All site identity and illustration assets are new. The Concourse mark should be a compact abstract junction or connected-node form that works beside the wordmark and as a favicon-scale symbol. The bacterial cell diagram is a clean custom vector illustration with only the structures needed by the lesson. It should feel scientific and inviting without resembling clip art or a textbook stock image.

## Interaction Model

The demo state model has four valid primary states: `route`, `lesson`, `recall`, and `pack`. The recall state also records `unanswered`, `incorrect`, or `correct` answer status.

All transitions are explicit:

```text
route --start--> lesson
lesson --back--> route
lesson --continue--> recall
recall --back--> lesson
recall --incorrect--> recall with explanation
recall --retry--> recall unanswered
recall --correct--> pack
pack --back--> recall correct
any non-route state --reset--> route
```

Back navigation restores the relevant earlier state without stale status announcements. Reset returns focus to the demo heading or start control. Invalid state input resolves to `route` rather than throwing.

The primary hero action scrolls to the demo, starts it only if the visitor explicitly activates Start, and moves focus to the demo heading. In-page navigation updates focus meaningfully without trapping the browser history.

## Technical Architecture

The production site remains a static, framework-free surface:

```text
website/
  index.html
  styles.css
  main.js
  demo-model.js
  assets/
    concourse-mark.svg
    bacterial-cell.svg
    instrument-sans.woff2
    social-preview.svg
```

- `index.html` owns semantic structure, complete fallback copy, metadata, and link destinations.
- `styles.css` owns tokens, layout, components, interaction states, breakpoints, focus states, and reduced motion.
- `demo-model.js` owns the pure demo state and transitions.
- `main.js` binds the state model to the DOM, focus management, status announcements, navigation behavior, and rendering.

The demo has no backend, API, storage, cookie, analytics event, or remote dependency. State exists only in memory and resets on reload.

The site progressively enhances. Without JavaScript, the visitor sees the route, lesson, recall explanation, pack reveal, system story, and contribution paths as a readable static sequence. Interactive controls that require JavaScript are hidden or presented as static content when enhancement is unavailable.

The state model should have focused automated tests outside the deployable `website/` directory, using the repository's existing JavaScript/TypeScript test tooling or Node's built-in test runner. Test wiring may add a website-specific command to `package.json`, and the command must be included in the repository verification path if it remains fast and deterministic.

## Accessibility

- Semantic landmarks and heading hierarchy.
- Native buttons and links for all interactions.
- Visible focus treatment that works on every palette surface.
- Keyboard completion of the entire demo, including incorrect answer and retry.
- A polite live region for answer feedback and progress changes.
- Focus movement only after deliberate navigation, never on background state changes.
- Text alternatives for the cell illustration; decorative route lines are hidden from assistive technology.
- No meaning communicated by color alone.
- `prefers-reduced-motion` disables path drawing, transforms, and smooth scrolling while preserving state clarity.
- At 200% zoom and 320 CSS pixels wide, content remains readable without horizontal page scrolling.

## Responsive Design

Primary verification viewports are:

- 1440 × 1000 desktop
- 1024 × 768 small desktop/tablet landscape
- 768 × 1024 tablet portrait
- 390 × 844 mobile
- 320 × 700 narrow mobile

The desktop split hero becomes a single-column flow below the layout breakpoint. The system diagram stacks without losing layer relationships. Contributor paths become a ruled vertical list rather than generic card tiles. Demo controls remain large enough for touch and answers never depend on hover.

## Motion

Motion supports comprehension:

- Route lines draw only when a visitor advances.
- The active node moves between concepts after explicit input.
- Demo panels use short opacity and position transitions.
- Progress changes visibly but never loops or pulses indefinitely.

No section autoplays, parallax scrolls, or runs decorative continuous animation. Reduced-motion mode presents immediate final states.

## Performance and Privacy Budget

- Zero third-party runtime requests.
- No analytics, telemetry, cookies, local storage, or session storage.
- JavaScript target: under 20 KB uncompressed for the complete demo and navigation behavior.
- Initial site transfer target: under 250 KB compressed, including the font and essential SVG assets.
- SVG assets are optimized and contain no embedded raster data.
- The page remains useful before the font loads and when JavaScript is disabled.
- External GitHub and documentation links are the only expected outbound requests initiated by the visitor.

## Failure Handling

- JavaScript unavailable: show the complete static walkthrough.
- Invalid demo transition: return to the route state and keep the page usable.
- Missing illustration: retain text labels and lesson copy without layout collapse.
- Font failure: fall back to the platform sans-serif stack without hidden text.
- External link failure: no local state depends on the destination.
- Narrow or zoomed layout: stack content rather than clip, scale down, or hide primary information.

## Verification Strategy

Implementation is complete only after all of the following:

1. Automated tests cover valid transitions, incorrect answer, retry, Back, Reset, and invalid-state recovery.
2. Repository formatting, lint, tests, type checking, and production build pass.
3. The static website is served locally and completed in a real browser.
4. Desktop and mobile layouts are visually inspected at the defined viewports.
5. Keyboard-only completion, focus order, live feedback, and reset behavior are exercised.
6. Reduced-motion and JavaScript-disabled fallbacks are inspected.
7. All internal and external links are checked against the current repository.
8. The final browser screenshots are compared directly with the approved visual concept using `view_image`.
9. The canonical hosted URL is checked only after the replacement deployment is available; the condemned live site is not opened as a reference before replacement.

## Replacement and Delivery Boundary

Implementation starts by deleting the tracked contents of `website/` and then creating the approved replacement. No old site file or asset is retained simply for convenience.

Work happens on the isolated `codey/concourse-project-site` branch based on the current `concourse/main`. The dirty Learnt checkout and its `docs/design` files remain untouched.

The implementation will be committed and pushed after verification. Deployment must use the repository's existing project-site path or hosting configuration without changing the application deployment. The canonical site is considered updated only after its rendered content is verified live.

## Alternatives Rejected

### Open-source project console

A dense technical dashboard would serve developers already convinced by the project, but it would not explain the learning experience quickly enough.

### Full-page guided learning story

An immersive end-to-end story would be memorable, but it would overemphasize consumer polish and delay the open-source contribution story.

### Framework-based marketing application

React or another site framework would add a build and dependency surface without improving this small deterministic interaction. A static progressive-enhancement architecture is easier to host, inspect, and contribute to.

### Hosted full-application demo

The full browser application remains valuable, but it carries more concepts and setup state than a first-time visitor needs. The purpose-built micro-demo communicates the core model faster and can link onward to the complete application later.
