# Blizu

**Što ti je blizu?** Za svaku adresu u Gradu Zagrebu Blizu pokazuje koliko je minuta hoda do svakodnevnih javnih
usluga (liječnik, ljekarna, vrtić, škola, knjižnica, pošta, javni prijevoz, park, trgovina) za četiri persone (opće,
starija osoba, roditelj s djetetom, invalidska kolica), a gradskim planerima pokazuje gdje je nezadovoljena potreba
najveća i gdje bi 1–5 novih ustanova koristilo najviše ljudi.

- **Natjecanje:** Datathon Portala otvorenih podataka 2026., izazov **A: Društvo i javne usluge**
- **Licenca koda:** [EUPL-1.2](LICENSE)

## Dokumentacija

| Dokument                                                       | Sadržaj                                                                          |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [apps/blizu/docs/README.md](apps/blizu/docs/README.md)         | Opis aplikacije, arhitektura, izvori podataka, koraci unosa, API, ograničenja    |
| [apps/blizu/docs/validation.md](apps/blizu/docs/validation.md) | Validacija izračuna pješačkih vremena                                            |
| [docs/FOUNDATION.md](docs/FOUNDATION.md)                       | Zajednički paketi `opendata_core` (Python) i `@dt/ui` (React), konvencije        |
| [docs/adr/](docs/adr/)                                         | Arhitekturne odluke (stack, pgvector, ograničenje upita, Geofabrik, Night Atlas) |
| [apps/blizu/data/evidence/](apps/blizu/data/evidence/)         | Sirovi odgovori izvora s datumom dohvata (dokazi)                                |

## Arhitektura ukratko

```
 data.gov.hr (CKAN)  ZET GTFS  OpenStreetMap (Overpass / Geofabrik)  Eurostat Census 2021 grid
        │                │                    │                                │
        └────────────────┴───── blizu ingest (Typer CLI) ──────────────────────┘
                                      │
              PostgreSQL+PostGIS ◄────┤────► data/derived: pješački grafovi i udaljenosti (.npz)
                                      │
                         FastAPI  /api/v1  (OpenAPI /docs lokalno)
                                      │
                       React SPA (Vite, MapLibre)  ◄── Caddy (HTTPS, CSP, /api proxy)
```

## Korišteni skupovi podataka

| Skup podataka                                 | Izdavatelj                          | Poveznica                                        | Licenca                      |
| --------------------------------------------- | ----------------------------------- | ------------------------------------------------ | ---------------------------- |
| Dječji vrtići (geoportal)                     | prema CKAN metapodacima skupa       | https://data.gov.hr/ (`geoportal-djecji-vrtici`) | CC BY 4.0                    |
| Slobodna mjesta u vrtićima                    | prema CKAN metapodacima skupa       | https://data.gov.hr/                             | Otvorena dozvola             |
| Vrtići, osnovne i srednje škole (INSPIRE WFS) | prema CKAN metapodacima skupa       | https://data.gov.hr/                             | nije navedena u metapodacima |
| ZET GTFS vozni red                            | Zagrebački električni tramvaj (ZET) | https://zet.hr/gtfs-scheduled/latest             | nije navedena uz feed        |
| OpenStreetMap (pješačka mreža i objekti)      | OpenStreetMap contributors          | https://www.openstreetmap.org/                   | ODbL 1.0                     |
| Popis 2021., mreža stanovništva 1 km (V3)     | Eurostat (GISCO)                    | https://ec.europa.eu/eurostat/web/gisco          | Eurostat (navođenje izvora)  |

Svaka tablica ima zapis o izvoru i vremenu dohvata (`data_source`, `ingestion_run`); aplikacija ih prikazuje na
stranici „Izvori podataka” (`GET /api/v1/sources`). Detalji i ograničenja izvora:
[apps/blizu/docs/README.md](apps/blizu/docs/README.md#izvori-podataka).

## Brzi početak (lokalno)

Potrebno: Docker, [uv](https://docs.astral.sh/uv/) (Python 3.12), Node 20 + pnpm 9, make (na Windowsu iz Git Basha).

```bash
cp .env.example .env                 # POSTGRES_PASSWORD, CONTACT_EMAIL
make dev                             # PostgreSQL + PostGIS + pgvector, Mailpit
uv sync                              # (uv sync --extra semantic za semantičku pretragu)
make migrate
make ingest STEP=all                 # sources, graph, facilities, gtfs, access, grid (~8 min)
uv run --package blizu-api uvicorn blizu_api.main:app --port 8010
pnpm install && BLIZU_API_URL=http://127.0.0.1:8010 pnpm --filter blizu-web dev   # http://localhost:5173
```

Testovi: `make test` (pytest bez mreže + vitest), `make lint`, `make build`. Testovi koriste samo stvarne snimljene
odgovore izvora.

> Node 22+ ima eksperimentalni globalni `localStorage` koji u vitestu može zasjeniti jsdom; projekt cilja Node 20
> (`.nvmrc`, CI). Na novijem Nodeu pokreni testove s `NODE_OPTIONS=--no-experimental-webstorage`.

Produkcija: `docker compose -f docker-compose.prod.yml --env-file .env up -d --build` (PostgreSQL, API, SPA i Caddy
s automatskim HTTPS certifikatom za `BLIZU_HOST`).

## Struktura

```
apps/blizu/api    FastAPI + ingest CLI (paket blizu_api), migracije, testovi
apps/blizu/web    React SPA (MapLibre karta)
apps/blizu/data   dokazi (evidence); izvedeni grafovi i sirovi podaci nastaju lokalno
packages/core     opendata_core: config, HTTP s predmemorijom, provenance, CKAN, geo, geocode, popgrid, optimize, semantic
packages/ui       @dt/ui: tokeni, Tailwind preset, pristupačne React komponente
infra/            slika baze, Dockerfile za API i web
```

## Alati otvorenog koda i umjetne inteligencije

- Stack: Python 3.12, FastAPI, SQLAlchemy, Alembic, PostgreSQL 16, PostGIS, pgvector, osmnx, osmium, scipy,
  sentence-transformers (model `intfloat/multilingual-e5-small`, MIT), React 18, Vite, Tailwind, MapLibre, Caddy.
  Sve otvorenog koda.
- Pri razvoju korišten je AI asistent za programiranje **Claude Code** (Anthropic).

## Licenca

Izvorni kod: [EUPL-1.2](LICENSE). Podaci zadržavaju licence svojih izdavatelja (vidi tablicu izvora iznad).
