# Resource Security Model

Learning resources are untrusted data until validation succeeds. The v0.1
contract allows teaching metadata and safe content blocks, not executable
content.

## Trust Boundaries

| Boundary | Rule |
| --- | --- |
| Archive input | Treat every `.learntpack` archive as untrusted. |
| JSON documents | Validate structure and semantics before install. |
| Assets | Accept only supported static asset media types and safe paths. |
| Embedded resource content | Render as safe app-owned content blocks, not HTML. |
| External resources | Treat as links or locators; do not fetch during validation. |
| Engagement events | Treat as private learner data outside the archive. |

## Prohibited Pack Content

The contract and SDK reject or do not support:

- CSS files.
- HTML files.
- JavaScript and TypeScript files.
- React components.
- WebAssembly.
- Native binaries.
- Shell scripts and executable extensions.
- Executable plugins.
- Remote asset manifests.
- Learner progress, ReviewEvents, ResourceEngagementEvents, due dates, or card
  statistics inside pack archives.

## Resource Sources

`embedded-content` may contain only the contract `ContentBlock` subset. Apps
must render text as text and must not interpret block text as HTML or script.

External source variants are locators:

- `external-link`
- `external-video`
- `external-audio`
- `interactive-reference`
- `bibliographic-reference`

Validators require HTTPS URLs where URLs exist. Validators do not fetch remote
content. Applications decide whether and how to open a remote resource, and
should make the transition explicit to the learner.

## URL And Path Rules

- URLs in resource sources and provenance must use `https://`.
- Archive paths must be relative.
- Archive paths must not contain drive letters, absolute roots, empty
  segments, `.`, or `..`.
- Asset paths must stay under `assets/`.
- Symlinks are rejected by the SDK.
- Unsupported executable and browser-code file extensions are rejected by the
  SDK.

## SVG And Assets

SVG is treated as a static asset only. Host applications that cannot sanitize
SVG safely should reject or disable SVG rendering. Static SVG must not contain
script, event handlers, external resources, embedded HTML, or remote
references.

The SDK does not execute assets and does not load remote assets while
validating, packing, unpacking, inspecting, or diffing.

## External Interactive Resources

`interactive-reference` describes an external interactive tool. It does not
grant the external tool access to pack storage, learner progress, cookies, or
application APIs.

Applications that open external interactive resources should:

- Use normal browser/site isolation.
- Avoid passing learner identifiers unless the user and product policy allow
  it.
- Treat any return value from the external site as untrusted input.
- Record only app-owned `ResourceEngagementEvent` evidence when appropriate.

## Provenance Warnings

The validator emits warnings for suspicious provenance combinations, including:

- Embedded pack-authored content marked `external-link-only`.
- External links or media marked `pack-authored`.
- License strings that look attribution-required without attribution text.

Warnings are not proof of license compliance. Pack authors and publishers
remain responsible for rights, attribution, and review.

## Private Engagement Data

`ResourceEngagementEvent` is private learner evidence. It is never part of a
public pack archive.

Sensitive fields include:

- `sourceInstanceId`
- `eventId`
- `occurredAt`
- `progressRatio`
- `positionSeconds`
- `metadata`

Apps may redact, encrypt, access-control, or avoid syncing these fields
according to their privacy policy. The shared contract does not define a shared
analytics system or scheduler.

## SDK Responsibilities

`@learnt/learning-pack-sdk` provides archive and filesystem tooling around the
contract:

- Validate before packing.
- Validate after unpacking.
- Reject path traversal and absolute archive paths.
- Reject symlinks.
- Enforce file-count, per-file, and total-size limits.
- Verify manifest hashes.
- Use deterministic file ordering.
- Produce stable content hashes for identical canonical input.
- Extract into a temporary directory before atomic installation.
- Never execute pack content.
- Reserve publisher signatures as a future extension point without verifying
  signatures in v0.1.

## Consumer Responsibilities

Consuming apps should:

- Import public types and validators from `@learnt/learning-pack-contracts`.
- Use the SDK or equivalent archive validation before install.
- Keep resource engagement and review events outside public packs.
- Use app-owned rendering, link-opening, and privacy controls.
- Ignore unknown optional capabilities with warnings.
- Reject unknown required capabilities.
- Never duplicate the public contract types in app-local code.
