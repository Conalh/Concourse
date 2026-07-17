# Concourse Dedicated Demo Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the guided learning workspace a dedicated full-width `/demo/` page and replace the compressed landing-page embed with a clear invitation.

**Architecture:** `website/demo/index.html` becomes the only document that owns the interactive `data-demo` tree and loads `main.js`. `website/index.html` stays an editorial project page and links to the demo rather than mounting it. The JavaScript model, content, and runtime remain unchanged; CSS adds only page-shell and landing-invitation rules.

**Tech Stack:** Semantic HTML, modern CSS, native JavaScript ES modules, Node test runner, JSDOM, Playwright, Cloudflare Pages.

## Global Constraints

- Preserve every existing guided-demo route, evidence, inspector, keyboard, screen-reader, reduced-motion, narrow-screen, and no-JavaScript behavior.
- Keep the website framework-free, dependency-free at runtime, and free of remote requests.
- Do not duplicate the interactive workspace on the landing page.
- Use `/demo/` as the canonical public demo path.
- Keep all existing public claims conservative and unchanged except where copy must describe the new page boundary.

---

### Task 1: Lock the page ownership contract

**Files:**

- Modify: `scripts/website-document.test.mjs`
- Modify: `scripts/website-runtime.test.mjs`
- Modify: `scripts/website-styles.test.mjs`

**Interfaces:**

- Consumes: the current `data-demo`, `data-demo-panel`, `data-demo-form`, `data-demo-status`, and `data-pack-inspector` DOM hooks.
- Produces: a document contract in which only `website/demo/index.html` owns those hooks and loads `../main.js`.

- [ ] **Step 1: Write failing document-boundary tests**

Parse both pages and assert the landing page has no `[data-demo]`, no `main.js` module script, and three links to `./demo/`. Parse the demo page and assert its canonical URL is `https://concourse.conalhickey.com/demo/`, it contains one `[data-demo]`, six `[data-demo-panel]` elements, four `[data-route-node]` elements, the prediction form, pack inspector, live region, and `../main.js` module script.

- [ ] **Step 2: Point runtime tests at the future demo page**

Replace:

```js
const html = await readFile(
  new URL('../website/index.html', import.meta.url),
  'utf8',
)
```

with:

```js
const html = await readFile(
  new URL('../website/demo/index.html', import.meta.url),
  'utf8',
)
```

- [ ] **Step 3: Add full-width style assertions**

Assert the demo stylesheet contains `.demo-page main`, `.demo-page .demo-section`, and a single-column page shell outside the existing workspace grid.

- [ ] **Step 4: Run focused tests and confirm RED**

Run `node --test scripts/website-document.test.mjs scripts/website-runtime.test.mjs scripts/website-styles.test.mjs`. Expected: failure because `website/demo/index.html` and the dedicated-page rules do not exist.

### Task 2: Split the documents without changing the demo runtime

**Files:**

- Create: `website/demo/index.html`
- Modify: `website/index.html`
- Modify: `website/styles.css`
- Modify: `website/demo.css`

**Interfaces:**

- Consumes: the current interactive `<section class="demo-section" data-demo>` tree and `main.js` runtime.
- Produces: a full-width `/demo/` document and a non-interactive landing invitation linking to it.

- [ ] **Step 1: Create the dedicated document**

Create a semantic page shell with body class `demo-page`, canonical `/demo/`, relative `../assets/`, `../styles.css`, `../demo.css`, and `../main.js` URLs. Move the existing interactive demo section and no-JavaScript walkthrough into its main content unchanged.

- [ ] **Step 2: Replace the landing embed**

Replace the interactive section with an editorial `#demo` invitation that contains the heading **Inside a bacterial cell**, a concise explanation, and `<a href="./demo/">Open the full demo</a>`. Change the header, hero, and closing demo links to `./demo/`, and remove the landing page's `main.js` module script.

- [ ] **Step 3: Give the demo page the full content width**

Add page-specific rules equivalent to:

```css
.demo-page main {
  display: block;
  width: min(100%, var(--content-width));
}

.demo-page .demo-section {
  min-height: 0;
  margin-block: 1.5rem 3rem;
}
```

Retain the existing `.lab-workspace` three-column grid and narrow-screen stack.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run `node --test scripts/website-document.test.mjs scripts/website-runtime.test.mjs scripts/website-styles.test.mjs`. Expected: all tests pass.

### Task 3: Verify and publish

**Files:**

- Verify: `website/index.html`
- Verify: `website/demo/index.html`
- Verify: `website/styles.css`
- Verify: `website/demo.css`

**Interfaces:**

- Consumes: the completed static-site artifact.
- Produces: a verified GitHub `main` commit and canonical Cloudflare Pages deployment.

- [ ] **Step 1: Run repository verification**

Run `npm run verify`, `npm audit --omit=dev`, and `git diff --check`. Expected: all commands exit 0 and audit reports zero vulnerabilities.

- [ ] **Step 2: Verify both pages in a real browser**

At desktop and mobile widths, confirm the landing page contains only the invitation; `/demo/` uses the full content width; the direct route, bridge route, pack tabs, reset, and DNA side-route toggle work; keyboard focus is visible; and the console is clean.

- [ ] **Step 3: Commit, push, and deploy**

Commit with `fix: give the guided demo its own page`, push the exact commit to the Concourse GitHub `main`, wait for CI, deploy the same SHA to Cloudflare Pages, and verify both canonical URLs return the expected documents.
