# Security Policy

## Supported Versions

The latest release and the `main` branch receive security fixes.

## Reporting A Vulnerability

Use GitHub's private vulnerability reporting for this repository. Do not open a
public issue with exploit details, crafted learning packs, filesystem paths, or
sensitive learner data.

Include the affected version or commit, reproduction steps, impact, and any
suggested mitigation. You should receive an acknowledgement within seven days.

## Trust Boundary

Learning packs and their archives are untrusted input. Concourse validates pack
structure, references, capabilities, canonical file hashes, archive paths, file
counts, and byte limits before installation. A valid pack can still contain
external resource links, so review pack provenance before opening them.

The desktop webview CSP currently permits `unsafe-eval` because Ajv compiles the
bundled validation schemas at runtime. Imported pack content is treated only as
data and is never evaluated as code. Precompiling those validators and removing
the CSP exception is tracked on the roadmap.

Learner progress remains local to the browser or desktop runtime. The current
app has no accounts, hosted learner state, analytics, or application backend.
