# Concourse Living Route Course Design

**Status:** Approved design

**Date:** 2026-07-16

## Decision and precedence

Replace the current 45–60 second guided demo with a 15–20 minute sample course on the existing `/demo/` page.

This specification supersedes the duration, persistence, activity count, and six-phase experience described in `2026-07-16-concourse-guided-demo-redesign-design.md`. The dedicated-page architecture from `2026-07-16-concourse-dedicated-demo-page.md` remains in force: the landing page introduces the experience, while `/demo/` owns the complete interactive course.

## Summary

The public demo will become a genuine miniature Concourse course called **How a bacterium survives**. It will demonstrate a required learning spine, evidence-aware support and extension branches, delayed retrieval, transparent route decisions, local progress, and inspectable pack-shaped authored data.

The experience remains a static, framework-free browser application. It requires no account, backend, analytics, remote learner state, or runtime network request. Progress is stored only in the visitor's browser and can be erased through an explicit reset.

## Problem

The current microbiology demo has appropriate subject matter and a useful interaction model, but it is too short to demonstrate what Concourse is for. One prediction, one application question, and a pack inspector can show individual interface ideas, but they cannot show sustained learning, cumulative evidence, retrieval over time, meaningful route adaptation, or the relationship between a complete course and its authored pack.

The replacement must feel like real learning rather than a product tour. A visitor should understand Concourse by using it for long enough to experience progression, uncertainty, reinforcement, extension, recall, and authorship.

## Goals

- Deliver a coherent 15–20 minute course for a first-time visitor following a typical path.
- Keep a required scientific spine while adapting support, retrieval, and extension nodes around learner evidence.
- Make every route change deterministic, visible, and explainable.
- Accumulate evidence across the full session instead of replacing one activity with another without history.
- Revisit earlier concepts in later contexts so retrieval is demonstrated rather than merely described.
- Use varied, accessible activities instead of repeating one multiple-choice pattern.
- Make the current concept, route position, evidence, and authored source understandable at the same time.
- Show that readable local pack documents author the concepts, route, and activities.
- Save and resume progress locally without creating an account or contacting a server.
- Preserve keyboard, screen-reader, reduced-motion, narrow-screen, zoom, and no-JavaScript access.
- Keep scientific claims accurate, appropriately qualified, and sourced from reputable open educational or primary material.

## Non-goals

- Reproducing the full browser or desktop Concourse application.
- Adding authentication, cloud synchronization, analytics, cookies, advertising, or a learner backend.
- Claiming that route changes are produced by AI, machine learning, or an opaque recommendation engine.
- Teaching a complete introductory microbiology course.
- Diagnosing infection, recommending antibiotics, or providing medical treatment guidance.
- Supporting arbitrary JSON editing, binary `.learntpack` installation, archive signing, hash regeneration, repacking, or export in the browser.
- Persisting temporary focus, animation, validation-message, or hover state.
- Making drag-and-drop the only way to complete any activity.
- Turning the project landing page back into the interactive course surface.

## Experience principles

### Learn first, explain the product through use

The visitor enters a learning session, not a marketing walkthrough. Concourse concepts such as route, evidence, retrieval, and pack authorship are revealed when the learner encounters them. Explanatory product copy stays concise and contextual.

### One accumulating workspace

The route, bacterial model, evidence history, and pack source persist as the learner advances. The experience should feel like one system gathering context rather than a slideshow of disconnected pages.

### Transparent adaptation

Every support recommendation, delayed retrieval node, and extension unlock includes a plain-language reason such as: **You identified the correct mechanism but reported low confidence, so this concept will return after the next chapter.**

### Learner agency

The required spine is always available. Support and extension branches are visibly recommended but skippable. Skipping a branch is recorded as a route decision, not treated as failure.

### Truthful public claims

The demo may say that its local route responds to recorded evidence according to visible rules. It may not imply hosted adaptation, AI recommendations, durable cross-device progress, or full pack validation unless those capabilities are actually present.

## Course frame

**Title:** How a bacterium survives

**Audience:** Curious adults and beginning biology learners with no assumed microbiology background.

**Scientific frame:** A simplified, representative bacterium encounters changing environmental conditions. Copy must acknowledge that bacterial species and mechanisms vary where a generalization could otherwise mislead.

**Estimated time:** 15–20 minutes for a typical path. Support-heavy and extension-heavy paths may take several minutes longer.

**Core composition:**

- 6 required concept chapters;
- 13 required activities;
- 5 support branches;
- 4 extension branches;
- 1 integrated retrieval and completion recap.

## Required learning spine

### 1. Hold the boundary

Introduce the cell membrane, cell wall, selective permeability, and the difference between a barrier and a rigid support structure.

Required activities:

1. Predict whether oxygen, glucose, and sodium cross the lipid membrane directly.
2. Identify which structure primarily controls molecular passage and which structure primarily resists osmotic rupture.

Support branch: **Charge and molecular size**. Use a visual comparison of small nonpolar, large polar, and charged substances.

Extension branch: **Two common envelope patterns**. Compare simplified Gram-positive and Gram-negative envelopes without turning the branch into diagnostic microbiology.

### 2. Move matter

Teach concentration gradients, passive transport, channels, carriers, and active transport.

Required activities:

1. Predict the net movement of a substance across a concentration gradient.
2. Match oxygen, an ion, and a nutrient to direct diffusion, a channel, or a carrier.

Support branch: **Reading a concentration gradient**. Make high-to-low movement visible and distinguish molecule count from molecule size.

Extension branch: **Using a proton gradient**. Introduce the idea that bacteria can store usable energy across a membrane without requiring mastery of detailed biochemistry.

### 3. Survive salt shock

Teach osmosis, relative solute concentration, water movement, and the protective role of the bacterial cell wall.

Required activities:

1. Predict water movement after the external environment becomes saltier.
2. Compare the likely cell response in relatively dilute and concentrated surroundings.

Support branch: **Tonicity without vocabulary traps**. Begin from water movement and introduce terminology only after the mechanism is understood.

There is no separate strong-evidence extension in this chapter. Strong evidence schedules a delayed osmotic-stress retrieval prompt inside the antibiotic scenario.

### 4. Pay for movement

Distinguish passive processes from energy-requiring transport and connect transport decisions to environmental survival.

Required activities:

1. Classify transport examples as down-gradient or energy-coupled.
2. Choose which strategy helps a cell accumulate a scarce nutrient when the internal concentration is already higher.

Support branch: **Passive versus active**. Rebuild the distinction using direction, gradient, and energy rather than memorized labels.

Extension branch: **Making energy without oxygen**. Introduce fermentation and anaerobic respiration as distinct possibilities while stating clearly that available pathways vary among bacteria.

### 5. Build a response

Teach that DNA stores information, RNA carries an expressed instruction, and ribosomes assemble proteins such as transporters.

Required activities:

1. Put DNA, RNA, ribosome, and protein production into a meaningful sequence using keyboard-accessible move controls.
2. Apply the sequence to a cell producing more of a needed transport protein.

Support branch: **DNA → RNA → protein**. Use a compact model that separates stored information from the machinery that reads it.

Extension branch: **Plasmids and resistance traits**. Explain that plasmids can carry genes, including some resistance genes, while avoiding the false claim that all resistance is plasmid-borne.

### 6. Face an antibiotic

Apply the course through an integrated, non-clinical scenario. The visitor examines simplified effects on the cell wall, membrane, and ribosome, then reasons about what the bacterium can no longer do.

Required activities:

1. Match three simplified antibiotic targets to the disrupted cellular process.
2. Explain the consequence of a ribosome-targeting antibiotic for producing a new transport protein.
3. Retrieve an earlier membrane, transport, or osmosis concept selected from the learner's evidence history.

This chapter always includes one delayed retrieval activity. The selected retrieval target is deterministic and based on the earliest non-strong evidence record; if every earlier record is strong, it revisits osmotic stress as an integration challenge.

## Evidence model

Every assessed activity records:

- activity identifier;
- concept identifier;
- selected response;
- correctness;
- confidence (`high` or `low`);
- attempt count;
- completion time;
- resulting evidence classification.

Evidence classifications are deterministic:

- **Strong:** correct on the first attempt with high confidence.
- **Developing:** correct with low confidence, or correct after one incorrect attempt.
- **Support indicated:** two unsuccessful attempts, or an incorrect first attempt paired with high confidence.

The visitor sees friendly descriptions such as **secure**, **worth revisiting**, and **support recommended**. Internal classifications remain available in the evidence details for transparency.

## Route rules

- Strong evidence unlocks the chapter's optional extension when one exists.
- Developing evidence keeps the learner on the required spine and schedules a delayed retrieval activity.
- Support-indicated evidence recommends the chapter's support branch and schedules a delayed retrieval activity.
- A learner may skip a recommended support or extension branch.
- Skipping never blocks the required spine or deletes the evidence that caused the recommendation.
- Completing a support branch records bridge completion but does not overwrite the original evidence record.
- Completing an extension records enrichment separately from required-course completion.
- Invalid, stale, or out-of-order events do not mutate course state.

The current and projected route must update immediately after each classified checkpoint. A **Why this route?** disclosure explains the exact evidence and rule involved.

## Activity patterns

The course uses a restrained set of reusable patterns:

- prediction followed by an observable model result;
- single- and multiple-choice classification;
- mechanism matching;
- keyboard-accessible ordering with move-up and move-down controls;
- scenario decisions;
- confidence selection;
- delayed retrieval;
- short evidence reflection.

Every activity has a clear prompt, completion condition, retry behavior, textual feedback, and non-visual explanation. Visual manipulation supplements native controls rather than replacing them.

## Workspace design

### Desktop

The dedicated page keeps a full-width application workspace:

- **Top bar:** course identity, current chapter, progress, estimated time remaining, local-save status, and reset.
- **Left route:** required spine plus visible support, retrieval, extension, completed, current, skipped, and upcoming states.
- **Center stage:** bacterial model, current concept, activity, observation, and feedback.
- **Right context:** tabs for current evidence, route decision, and pack source.

The right context area must never squeeze the center activity below a usable reading width. At intermediate widths, the context becomes a drawer or stacked region before the center is compressed.

### Narrow screens and zoom

- The current activity remains first in reading and interaction priority.
- The route becomes a horizontally scrollable chapter strip plus an expandable full-route view.
- Evidence, route decision, and pack source become accessible tabs below the activity.
- JSON and long code lines scroll inside their own panel and never widen the page.
- The page has no horizontal overflow at 320 CSS pixels or 200 percent zoom.

### Resume entry

When an incomplete valid save exists, `/demo/` begins with a compact resume choice showing:

- course title;
- last completed chapter;
- overall completion;
- estimated remaining time;
- **Resume course** and **Start over** actions.

Starting over requires confirmation. A completed save offers **Review results**, **Try another path**, and **Start over**.

## Local progress

Progress uses a versioned local-storage record under `concourse.demo.course.v1`.

The persisted record contains only course state:

```js
{
  version: 1,
  courseId: 'bacterial-survival',
  courseRevision: 1,
  currentNodeId: 'move-matter-gradient',
  completedNodeIds: [],
  availableNodeIds: [],
  evidence: [],
  branchDecisions: {},
  draft: {
    biofilmExtensionEnabled: false,
    activeFile: 'courses.json',
  },
  startedAt: 'ISO-8601 timestamp',
  updatedAt: 'ISO-8601 timestamp',
}
```

Storage requirements:

- Validate all restored fields against the current course graph and allowed values.
- Ignore unknown fields.
- Reject impossible node identifiers, invalid evidence records, and incompatible versions.
- If a save is corrupt or incompatible, explain that local progress could not be restored and offer a clean start.
- If storage is unavailable or a write fails, continue in session-only mode and show a non-blocking status.
- Do not persist focus, open disclosures, animation state, validation errors, or transient feedback.
- Reset deletes the course record only after confirmation.
- No save data leaves the browser.

## Evidence and completion recap

The completion view summarizes:

- required concepts completed;
- required activities completed;
- strong, developing, and support-indicated evidence counts;
- support branches completed or skipped;
- extensions completed or skipped;
- delayed retrieval results;
- the route actually taken;
- the local pack documents that authored the session.

The recap avoids grades, rankings, percentages presented as mastery, or claims of durable competency. It describes evidence from this sample course only.

## Pack authorship

The right context area includes an **Open the pack** tab throughout the course. It highlights the document responsible for the current surface:

- `pack.json`: identity, version, license, and capabilities;
- `catalog.json`: concepts and relationships;
- `courses.json`: required spine, branches, and route relationships;
- `items.json`: activities, responses, evaluation, and feedback.

At completion, the visitor may activate **Add a biofilm survival extension**. This controlled local edit:

1. adds the biofilm concept to the unpacked `catalog.json` draft;
2. adds an optional follow-up node to the unpacked `courses.json` draft;
3. marks both files as changed;
4. adds the new node to the visible route;
5. leaves the released source documents untouched.

The interface labels the result **Unpacked local draft**. It may preview structural checks implemented by this demo, but it must state that complete contract validation, manifest hashing, repacking, signing, installation, and export are outside the browser experience.

## Scientific content requirements

- Use a simplified representative bacterium and state when bacterial mechanisms vary by species.
- Distinguish the cell membrane from the cell wall.
- Describe diffusion and osmosis in terms of net movement rather than claiming individual molecules move only one way.
- Avoid presenting tonicity vocabulary before the water-movement mechanism.
- State that active transport requires energy coupling without implying all transport proteins consume ATP directly.
- Present DNA → RNA → protein as the relevant instructional model while acknowledging that regulation is more complex.
- State that some, not all, resistance traits are plasmid-borne.
- Describe antibiotic targets as simplified examples, not treatment guidance.
- Include a compact references and attribution view based on reputable open educational or primary sources.

## Architecture

Keep the website framework-free and split the expanded runtime by responsibility:

- `demo-course.js`: immutable chapter, node, activity, feedback, and scientific-reference definitions.
- `demo-pack.js`: pack-shaped source documents, highlighted excerpts, and controlled biofilm draft projection.
- `demo-model.js`: validated course state and event transitions.
- `demo-routing.js`: pure evidence classification, branch availability, delayed retrieval selection, and route projection.
- `demo-storage.js`: local record serialization, validation, restoration, reset, and session-only fallback.
- `demo-activities.js`: reusable semantic renderers for the approved activity patterns.
- `demo-render.js`: workspace, route, evidence, context tabs, recap, focus, and live-region rendering.
- `main.js`: page mounting, DOM event translation, persistence coordination, and teardown.

No content module may write to the DOM or storage. Routing and evidence logic remain pure and independently testable. Storage accepts and returns validated plain data. Rendering consumes projected state instead of reimplementing route rules.

## Error handling

- Invalid model events return unchanged state.
- Missing or malformed course nodes fail the build-time/test contract rather than producing an incomplete live route.
- A malformed saved record never partially mutates a clean state.
- Storage failures preserve the current session and report session-only mode.
- A malformed local pack draft resets the draft projection without deleting learner evidence.
- Missing required DOM roots prevent mounting cleanly without throwing uncaught page errors.
- Activity validation remains inline, textual, focusable, and specific.
- Live-region announcements occur for phase changes, route decisions, save-mode changes, and completion—not for every local visual update.

## Accessibility

- Complete the required spine and every branch with keyboard controls only.
- Use native buttons, radios, checkboxes, fieldsets, details, and tabs wherever appropriate.
- Give route nodes textual state in addition to color and shape.
- Move focus only after meaningful activity or chapter transitions.
- Keep visible focus indicators at least 3:1 against adjacent colors.
- Keep controls at least 44 by 44 CSS pixels where pointer activation is expected.
- Provide equivalent text for every model result and animation.
- Honor `prefers-reduced-motion`; no learning state may depend on motion.
- Preserve content and functionality at 320 CSS pixels and 200 percent zoom.
- Use polite announcements and avoid repeating the entire route or evidence history.
- Make pack tabs keyboard navigable and keep their panel relationship explicit.

## Performance and privacy

- No runtime request may leave the site origin.
- No third-party script, font, tracker, video, or analytics request may be added.
- Total uncompressed guided-course JavaScript should remain under 90 KB.
- Total website CSS should remain under 80 KB uncompressed.
- Prefer CSS and small local vector assets over raster media.
- Local timestamps and evidence remain on the device.
- The interface states **Saved on this device** rather than implying account or cloud storage.

## No-JavaScript experience

Without JavaScript, `/demo/` provides:

- the complete required learning spine;
- concise explanations for each scientific concept;
- disclosed answers and reasoning for representative activities;
- the deterministic adaptation rules;
- the pack document map;
- a statement that interactive evidence, branching, resume, and pack editing require JavaScript.

Runtime-only controls, save status, and progress are hidden when JavaScript is unavailable.

## Testing strategy

### Pure model and routing

- initial state and route projection;
- strong, developing, and support-indicated classifications;
- extension unlocks;
- support recommendations;
- delayed retrieval scheduling and target selection;
- skip and complete decisions;
- invalid and out-of-order events;
- required-course and enrichment completion distinctions;
- recap projections.

### Persistence

- valid round trip;
- incomplete resume;
- completed review state;
- reset confirmation and deletion;
- corrupt JSON;
- incompatible version;
- unknown fields;
- impossible node and evidence identifiers;
- storage read and write failures;
- session-only fallback;
- draft restoration independent from learner evidence.

### Document and runtime

- semantic heading and landmark hierarchy;
- required course and no-JavaScript content;
- direct strong-evidence path;
- support-heavy path;
- extension-heavy path;
- mixed evidence path;
- delayed retrieval;
- resume and start-over flows;
- pack-source highlighting;
- biofilm draft mutation;
- keyboard activity completion;
- focus movement and live announcements;
- teardown without leaked listeners.

### Styling and browser verification

- 320, 390, 768, 1024, and 1440 CSS pixel viewports;
- 200 percent zoom;
- no horizontal page overflow;
- readable center-stage width before context stacking;
- reduced motion;
- keyboard-only direct, support, and extension paths;
- local save and resume in a real browser;
- corrupt-save recovery;
- zero console errors;
- canonical production domain tested separately from the deployment preview.

## Success criteria

- The required spine contains 6 coherent chapters and 13 assessed activities.
- A typical route provides 15–20 minutes of meaningful interaction.
- Every evidence classification produces a visible, truthful route consequence.
- At least one earlier concept returns during the integrated antibiotic scenario.
- A visitor can leave, return, and resume on the same device without an account.
- A visitor can explain why a branch appeared using the interface alone.
- The completion recap represents the actual route and evidence taken.
- The pack source identifies the authored document behind the current route or activity.
- Enabling the biofilm extension updates the local catalog draft, course draft, and visible route together.
- All automated, accessibility, responsive, build, and live production verification gates pass before deployment.
