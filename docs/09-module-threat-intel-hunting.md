# 09 — Module: Threat Intelligence & Hunting

**Primary files:** `backend/app/api/{iocs,threat_feeds,hunt,attack_graph,mitre}.py`, `backend/app/services/enrichment_service.py`.

## 1. IOCs (Indicators of Compromise)

`iocs.py`. List/create/delete are fully wired frontend-to-backend (`ThreatIntelligence.tsx` ↔ `iocApi.ts`).

**Known gap**: several real backend endpoints have no frontend caller — `GET /iocs/{id}` (single-fetch), `PUT /iocs/{id}` (update), `GET /iocs/{id}/enrichment` (view enrichment detail), `POST /iocs/{id}/re-enrich`, `POST /iocs/sync`. There's no edit form for an existing IOC despite the backend fully supporting it. If asked to add IOC editing, the API is already there.

## 2. Enrichment sources

`enrichment_service.py` integrates three real external threat-intel sources, not mocked:
- **VirusTotal** (`VIRUSTOTAL_API_KEY`)
- **AbuseIPDB** (`ABUSEIPDB_API_KEY`)
- **AlienVault OTX** (per-tenant key, set in Settings — supports SHA256/MD5/IPv4/IPv6/Domain/URL lookups)

Global fallback keys can be set in `.env`; a tenant's own key set in Settings takes priority. If neither is set, enrichment calls simply return no data for that source rather than erroring.

## 3. Threat Feeds

`threat_feeds.py` — config management, synchronous lookup, and enrichment endpoints all wired. `POST /threat-feeds/lookup-async` exists server-side (queues a Celery task) but has no frontend caller — only referenced from the frontend's demo-mode mock data, not real usage.

Feed source integrations referenced across the codebase (per `README.md` and service code): URLhaus, MalwareBazaar, OpenPhish, AlienVault OTX.

## 4. Threat Hunting

`hunt.py` — eight real search endpoints, all backed by actual queries against telemetry tables (not a facade over a single generic search):

`GET /hunt/{process|hash|ip|domain|username|mitre|persistence|country}`

Each takes a `days`/`limit` window and returns real matches. Notably, `/hunt/domain` doesn't depend on a dedicated DNS-telemetry table (which has no real data source in most deployments — see [10-module-agent-telemetry.md](10-module-agent-telemetry.md)); instead it searches process command-lines and file paths for domain-like strings, a deliberate workaround given the DNS-visibility gap. `/hunt/mitre` returns two distinct result shapes in one response — matched alerts (`title`, `severity`, ...) and matched detection rules (`name`, `rule_type`, `mitre_tactic`, `enabled`, ...) — these are genuinely different objects; a frontend type bug conflating them was fixed this engagement (see [13-known-issues-technical-debt.md](13-known-issues-technical-debt.md)).

Endpoints gate on an `analyst_required` dependency — Viewer-role users cannot run hunts.

## 5. Attack Graph

`attack_graph.py` — builds a visual graph of related entities (device → process → network/C2) for an incident. Fully wired, no gaps found.

## 6. MITRE ATT&CK Coverage — real backend, zero UI

`mitre.py` implements `/mitre/coverage`, `/mitre/heatmap`, `/mitre/top-techniques` — genuinely computed coverage data, explicitly documented in the code as intended to power a frontend heatmap. **No frontend caller exists** (`mitreApi.ts` doesn't exist; "MITRE" references elsewhere in the frontend are just technique-string display fields on Alerts/Incidents/Hunt/AttackGraph, not calls to this router). If asked to build a MITRE coverage view, the data layer is already complete — this is pure frontend work.
