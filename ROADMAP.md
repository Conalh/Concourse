# Concourse Roadmap

Last updated: 2026-07-16

Concourse is a cross-platform, local-first learning suite. The near-term goal is
a trustworthy desktop and browser workflow for portable course packs, not a
marketplace or hosted learning service.

## Delivered In The 0.1 Baseline

- Framework-agnostic learning contracts, engine, application facade, and
  persistence boundaries.
- Browser flows for Today, Routes, Loop, Transfer, Progress, profiles, settings,
  evidence, recaps, and concept exploration.
- Browser-local pack import, installed-release lifecycle, and durable learner
  progress.
- Versioned learning-pack contracts and Node/browser SDK entry points.
- Canonical hashing, deterministic archives, release diffs, archive limits,
  atomic installs, and known-good release preservation.
- Tauri shell, local Courses-folder selection, filesystem-backed pack reads,
  and atomic installed-pack records.
- A full Logic Foundations pack with source attribution and multiple tested
  release fixtures.
- MIT-licensed software, contributor guidance, security reporting, and
  cross-platform CI.

## Next

- Produce signed or checksummed desktop release artifacts and exercise the full
  install, sync, learn, relaunch smoke path on supported operating systems.
- Define and publish the official static catalog contract, compatibility rules,
  and downloadable pack index.
- Add catalog download and checksum verification through the existing local
  installation path.
- Precompile the bundled pack validators and remove `unsafe-eval` from the
  production Tauri content security policy.
- Split the browser bundle by product route and set a measured performance
  budget.
- Add more independently licensed example packs and authoring templates.

## Later, Separate Decisions Required

These are intentionally outside the local-first product boundary:

- accounts or hosted learner progress
- paid pack purchases or marketplace operations
- ratings, reviews, comments, or creator dashboards
- community submission and moderation workflows
- cloud sync

Each requires a separate product spec and architecture decision.
