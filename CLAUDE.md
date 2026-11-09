# CLAUDE.md — Blizu

Blizu: walking-time access to daily public services in Zagreb, built for the Croatian
"Datathon Portala otvorenih podataka 2026", challenge A. Standalone repository.

## WORKING RULES (apply to every task)

1. Inspect before changing: run `git status`, list the tree (depth 3), read docs/FOUNDATION.md and apps/blizu/docs/ before editing.
2. Preserve working functionality. No rewrites of working code unless a test proves a defect.
3. Implement in small steps. After each meaningful step run the relevant tests and commit (Conventional Commits).
4. Never invent API endpoints, parameters, field names, credentials, datasets or data values. Probe the real source, save evidence (raw response with date) under apps/blizu/data/evidence/, then code against it.
5. No fake, sample or demo data in production code paths. Tests use recorded REAL responses saved as tests/fixtures/<source>/<YYYY-MM-DD>_<name>.<ext>. Never present cached or stale data as live: always expose retrieval time.
6. Every table loaded from an external source has a data_source row and an ingestion_run row (opendata_core.provenance).
7. Do not add dependencies beyond the fixed stack unless essential; if you add one, record why in docs/adr/.
8. Secrets only in .env (gitignored); keep .env.example current; never print secrets in logs.
9. UI text in Croatian (hr), code and comments in English.
10. Never claim something works without running it.
11. Respect source usage policies: identifying User-Agent with contact email, rate limits, caching.
12. Commits carry no `Co-Authored-By` trailer for AI assistants.

## Quick reference

- Docs: README.md, apps/blizu/docs/, docs/FOUNDATION.md, decisions in docs/adr/.
- Python: uv workspace (`uv sync`, `uv run pytest apps/blizu/api`). Core package: `opendata_core`.
- Web: pnpm workspace (`pnpm --filter blizu-web dev|build|test`). Shared UI: `@dt/ui`.
- Local infra: `make dev` (PostgreSQL 16 + PostGIS + pgvector, Mailpit).
