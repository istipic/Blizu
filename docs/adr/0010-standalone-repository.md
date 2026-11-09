# ADR 0010: Standalone repository

- Status: accepted
- Date: 2026-11-09

## Context

The Datathon rules require a separate solution for each challenge. Blizu (challenge A) was developed in a monorepo
next to two other apps (Otporko, Birokratko) that share `opendata_core` and `@dt/ui`.

## Decision

The repository was created with `git filter-repo --invert-paths` from the monorepo, dropping `apps/nabavaradar`,
`apps/otporno` and their ADRs, so the commit history of Blizu and the shared packages is kept. The internal layout
(`apps/blizu`, `packages/core`, `packages/ui`, `infra/`) is unchanged, so migrations, Dockerfiles, tests and
documentation links keep working. The shared packages are copied as they were. Root files (README, compose files,
Caddyfile, Makefile, database init, `.env.example`, CLAUDE.md) describe one app; lock files were regenerated only to
drop the removed workspace members (no version changed).

## Consequences

- Blizu builds, tests and deploys on its own (`make dev`, `make test`, `docker-compose.prod.yml`).
- Changes to the shared packages are no longer synchronised with the other apps' repositories.
