# Concourse Guided Demo Redesign

**Status:** Approved design

**Date:** 2026-07-16

## Summary

Replace the current four-panel website demo with a compact, guided product experience that demonstrates three ideas in one continuous interaction:

1. Concourse feels like a real learning application.
2. A learning route can respond transparently to evidence and confidence without hiding the rule from the learner.
3. The lesson and route come from an open, inspectable learning pack that can be changed locally.

The demo remains a static, progressively enhanced website feature. It has no account, backend, analytics, remote runtime dependency, or durable learner state.

## Problem

The current demo is technically functional but experientially weak. It presents one fact, one obvious multiple-choice question, and a textual pack summary across disconnected panels. The route map, learning evidence, and pack format are described more than they are demonstrated. A first-time visitor can complete the flow without understanding what makes Concourse distinct.

The replacement must create an immediate product-level impression while staying small enough to understand in roughly 45 to 60 seconds.

## Goals

- Begin inside the learning experience instead of behind a start screen.
- Make the learner interact with a scientific model rather than advance through a slideshow.
- Keep route, activity, evidence, and progress visible as cumulative parts of one workspace.
- Use accuracy and confidence as separate inputs.
- Show a transparent, learner-accepted bridge concept when the initial evidence is weak.
- Preserve and visibly return to the main learning thread after a bridge.
- Reveal authentic pack-shaped documents and show a real local data mutation affecting the route.
- Preserve keyboard, screen-reader, reduced-motion, narrow-screen, and no-JavaScript access.
- Keep the website framework-free, local-first, and easy for contributors to inspect.

## Non-goals

- Reproducing the complete browser or desktop Concourse application.
- Claiming that Concourse currently provides automatic or AI-generated recommendations.
- Adding accounts, cloud synchronization, analytics, cookies, persistence, or network requests.
- Supporting arbitrary pack authoring or free-form JSON editing in the landing-page demo.
- Parsing or installing a binary `.learntpack` archive in the browser.
- Turning the editorial project site into a general-purpose dashboard.
- Changing the sections of the project site outside the demo except where surrounding copy must stay truthful.

## Experience

The demo is a guided reveal with five beats. The bacterial cell, route, and progress remain visible throughout; content changes in place rather than replacing the whole interface.

### 1. Predict

The initial view is already active. A simplified bacterial membrane sits in the center workspace with three labelled molecules approaching it:

- oxygen;
- glucose;
- a sodium ion.

The visitor answers: **Which substance crosses the lipid membrane most easily without a transport protein?** The correct answer is oxygen. The visitor also records one of two confidence choices:

- **I knew it** maps to high confidence;
- **I was guessing** maps to low confidence.

The submit action remains disabled until both an answer and confidence choice are present. The two inputs are announced and visually distinct.

### 2. Observe

Submission produces an immediate in-place result:

- oxygen crosses the membrane directly;
- glucose stops and is shown using a transport protein;
- the sodium ion stops and is shown using an ion channel or pump.

The explanation states that membrane permeability depends on properties such as size, polarity, and charge. The visual result is supplementary; the same information is available in text.

### 3. Follow or bridge

The routing rule is deterministic and visible:

- a correct answer with high confidence continues directly to **Transport proteins**;
- an incorrect answer or low confidence offers **Charge and size** as a bridge concept.

The bridge is not inserted automatically. The learner accepts **Take the short bridge**, after which the route graph adds the bridge node and shows its connection back to the main thread. Completing the bridge returns the learner to **Transport proteins**.

This demonstrates responsive guidance without claiming a hidden recommendation engine. The route change is an explicit behavior of this website demo.

### 4. Apply

The visitor answers a short application question: **A bacterial cell needs glucose. What helps glucose cross its membrane?**

The correct answer is **A transport protein**. Distractors are **A ribosome** and **DNA**. Incorrect selections receive a concise explanation and remain retryable. A correct response records visible evidence, completes the current concept, and advances the route.

### 5. Open the pack

After the application response, the right context area expands into a pack inspector. The inspector explains that `.learntpack` archives contain versioned, validated documents and shows concise excerpts from the same local demo data used to render the experience:

- `pack.json` for identity, version, license, and capabilities;
- `catalog.json` for concepts and relationships;
- `courses.json` for the authored route;
- `items.json` for prompts, responses, and evaluation.

The visitor activates **Add a DNA side route**. The controlled edit adds a DNA concept to the local catalog data and a corresponding side-route node to the local course data. The inspector highlights the affected excerpts in `catalog.json` and `courses.json`, and the route graph adds the DNA node.

The inspector labels the editable data **Unpacked local draft** and marks the two documents as changed. It does not imply that a modified draft still matches a released archive's manifest hashes. Revalidation, hash generation, repacking, and export remain outside this landing-page demo.

The label uses “side route,” not “pack extension,” so it is not confused with the pack contract's extension and capability mechanisms.

The edit is intentionally constrained. It demonstrates that pack documents are inspectable and authored data drives the route; it does not claim to be a complete authoring environment.

## Screen Design

### Desktop

The demo appears as a compact application workspace inside the editorial page.

- **Top edge:** pack filename, local-state text, progress summary, and a restrained reset control.
- **Left rail:** a persistent route graph with completed, current, upcoming, bridge, and added side-route states.
- **Center workspace:** the bacterial membrane interaction, questions, explanations, and application activity.
- **Right context area:** current evidence and explanation during learning; the pack inspector after completion.

The cell and route stay anchored. Feedback appears in place so the learner sees one accumulating system instead of a sequence of unrelated cards.

### Mobile and narrow screens

- The route becomes a compact horizontal path above the activity.
- The bacterial membrane and current action remain first in reading order.
- Evidence and explanation follow the activity.
- The pack inspector replaces the context area after the pack reveal instead of forcing a multi-column layout.
- The page must not create horizontal overflow at 320 CSS pixels or at 200 percent zoom.

## Visual Language

The demo retains the website's midnight, cobalt, lime, and warm-paper palette, typography, and route-line motif. It is deliberately denser and more product-like than the surrounding editorial page.

The bacterial membrane illustration is scientific but simplified. Oxygen, glucose, sodium, the lipid bilayer, and the relevant protein are labelled in text. Decorative detail must not compete with the task.

The pack inspector uses the site's monospace face and code-like alignment, but it must remain readable rather than imitating a dense development environment. It shows only the fields necessary to explain the change.

## Motion

- Molecules use short transform-based movement to cross, stop at, or pass through the membrane.
- Route changes draw a connection before revealing the new node.
- Evidence and feedback transition in place without layout jumps.
- The pack inspector expands from the existing right context area rather than appearing as a modal.
- The DNA route node appears only after the local pack mutation succeeds.
- Press feedback is pointer-gated and uses the established strong ease-out curve.
- Functional interaction motion stays under 300 milliseconds unless a scientific process needs a slightly longer explanatory sequence.
- Reduced-motion mode removes positional movement and communicates the same state through immediate placement, text, and color.
- Keyboard-triggered actions update state immediately and do not rely on decorative motion.

## Content and Scientific Boundary

The demo teaches only the following claims:

- the cell membrane is a selective boundary;
- small nonpolar oxygen molecules can diffuse through the lipid bilayer;
- charged sodium ions do not freely cross the lipid core and require membrane proteins;
- glucose is comparatively large and polar and uses transport proteins;
- size, polarity, and charge help explain membrane permeability.

The wording must avoid suggesting that all transport is passive or that a single mechanism handles every molecule. The scientific copy remains introductory and does not introduce osmosis, electrochemical gradients, or detailed transporter classes.

## Architecture

### Static content

The demo owns a small immutable source object shaped around Learning Pack Contract 0.1 concepts. It contains the minimum `pack`, `catalog`, `courses`, and `items` data required by the experience. The display excerpts are derived from this object instead of being separately hard-coded strings.

The source object is not advertised as a complete binary `.learntpack`. The inspector explicitly distinguishes the archive from the documents inside it and the edited local draft from a validated release.

### State model

A pure state model owns all valid states and transitions. At minimum it records:

- phase: `predict`, `result`, `bridge-offer`, `bridge`, `apply`, or `pack`;
- selected molecule answer;
- confidence: high or low;
- prediction result;
- whether the bridge was offered, accepted, and completed;
- application answer and status;
- evidence records shown in the context area;
- whether the DNA side route is enabled;
- the derived local pack documents.

Valid transitions include:

```text
predict --submit correct + high confidence--> result --continue--> apply
predict --submit incorrect or low confidence--> result --continue--> bridge-offer
bridge-offer --accept--> bridge --complete--> apply
bridge-offer --skip--> apply
apply --incorrect--> apply with feedback
apply --correct--> pack
pack --toggle DNA on/off--> pack with derived documents and route
any phase --reset--> predict
```

Back navigation returns to the previous meaningful phase without retaining feedback that no longer applies. Impossible or malformed actions leave the current valid state unchanged. A malformed initial state resets to `predict`.

### Rendering

- `demo-model.js` owns immutable content derivation and pure transitions.
- `main.js` owns DOM event translation, rendering, announcements, and focus movement.
- Semantic HTML in `index.html` provides the accessible structure and no-JavaScript reading sequence.
- CSS owns responsive layout and predetermined transform or opacity transitions.
- No frontend framework or animation dependency is added.

## Progressive Enhancement

Without JavaScript, the demo becomes a readable static walkthrough containing:

- the membrane prediction and answer;
- the direct and bridge route explanation;
- the glucose application question and answer;
- the four pack-document roles;
- an example of the DNA side-route change.

Controls that require runtime state are hidden or replaced by static disclosure elements. All project-site navigation and contribution links continue to work.

## Accessibility

- The molecule choices and confidence choices use native controls with visible labels.
- The route graph is supplementary; a text progress summary communicates the same state.
- Diagram meaning is provided through alternative text and adjacent explanatory copy.
- Correct, incorrect, bridge, progress, and pack-edit changes are announced through polite live regions.
- Focus moves to the new phase heading only after a phase change, never for in-place feedback.
- Incorrect application feedback leaves focus on the selected answer or retry control.
- Every control has a minimum 44 by 44 CSS pixel target.
- Focus indicators maintain at least 3:1 adjacent contrast on every demo surface.
- Color is never the only indicator for correctness, progress, or route state.

## Error Handling

- Invalid model events preserve the last valid state.
- Missing optional illustration elements leave the text workflow usable.
- A pack mutation is derived atomically; the route does not change if derivation fails.
- If animation APIs are unavailable, state updates immediately.
- Reset returns all learner, evidence, route, and pack-edit state to the initial prediction.
- No failure path stores data, performs a request, or blocks access to the rest of the page.

## Performance Boundary

- The demo remains dependency-free and runs from the existing static site.
- New runtime behavior should keep the combined website demo JavaScript under 30 KB uncompressed.
- Visuals should be vector or CSS-based and ship locally.
- Animation must use transform and opacity where movement is required.
- No remote font, script, image, analytics, or API request is introduced.

## Testing

### Model tests

- Initial state and derived route.
- Correct/high-confidence direct path.
- Incorrect and low-confidence bridge offers.
- Bridge acceptance, completion, skip, and return to the main thread.
- Incorrect application retry and correct completion.
- DNA side-route enable and disable mutations across catalog, course, and route projections.
- Reset and invalid-event recovery.

### DOM and accessibility tests

- Required controls, labels, status regions, and pack-document hooks.
- Answer and confidence selection rendering.
- Focus placement for each phase and retry path.
- Correct status announcements.
- No-JavaScript disclosures and hidden inert controls.
- Minimum target size and reduced-motion rules.

### Browser verification

- Complete direct and bridge paths with mouse and keyboard.
- Toggle the DNA side route and verify both document excerpts and route graph.
- Compare desktop and mobile renders against the approved visual concept.
- Verify 320 CSS pixels, 200 percent zoom, reduced motion, and disabled JavaScript.
- Confirm no console errors, broken assets, remote runtime requests, or horizontal overflow.

## Acceptance Criteria

The redesign is complete when:

1. The demo begins immediately inside the bacterial-membrane activity.
2. Accuracy and confidence both influence the visible next step according to the documented rule.
3. Weak evidence offers, but does not silently insert, the bridge concept.
4. Completing or skipping the bridge returns to the main route.
5. The glucose application activity records visible evidence and progress.
6. The pack inspector identifies the four real contract document roles.
7. Adding the DNA side route changes derived catalog data, course data, and the visible route together.
8. The inspector identifies the edit as an unpacked local draft rather than a validated release.
9. The complete experience works with keyboard input, reduced motion, and at 320 CSS pixels.
10. The no-JavaScript walkthrough preserves the full explanatory story.
11. Automated website tests, the repository verification command, and production build pass.
12. Final motion review reports no feel-breaking issue.
13. The canonical public site is verified after deployment before the change is reported complete.
