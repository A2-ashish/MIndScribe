# MindScribe Roadmap

_Last updated: 2025-09-18_

## Vision
MindScribe converts raw personal journaling into structured reflective artifacts (insights + capsules + swarm/twin state) while enforcing safety, privacy, and efficient reuse. The system evolves toward multi‑modal understanding, adaptive personalization, and longitudinal narrative intelligence.

## Phase Summary (Status Legend: ✅ done | 🚧 planned | 🧪 experimental | ⏳ future)

| Phase | Name | Core Goal | Status |
|-------|------|-----------|--------|
| 0 | Core Pipeline & Agents | Entry → insight → capsule generation (foundational agents) | ✅ |
| 1 | Robustness & Safety | Auth, rate limiting, moderation, error unification | ✅ |
| 2 | Similarity Upgrade | Versioned embeddings, dynamic reuse, decision logging | ✅ |
| 3 | Media Ingestion | Audio/image upload, transcription & labeling, text normalization | 🚧 |
| 4 | Classifier Path | Fine‑tuned risk/intent classifier + fallback gating | 🚧 |
| 5 | BigQuery & Swarm Narrative | Analytics export + aggregated narrative generation | 🚧 |
| 6 | Personalization Loop (Future) | Adaptive models per user (lightweight) | ⏳ |
| 7 | Multi‑Capsule Orchestration | Capsule chaining & reflective synthesis | ⏳ |

---
## Architectural Pillars
1. Deterministic Safety & Observability: All automated decisions (similarity, moderation, risk) produce structured logs.
2. Versioned Intelligence: Embeddings, classifier models, and transformation heuristics carry explicit version tags to enable safe migrations & audit.
3. Reuse Over Regenerate: Preference for capsule reuse when semantic overlap is high (thresholded similarity) to reduce token cost and drift.
4. Layered Gating: Heuristic → lightweight classifier → (future) heavier model escalation for risky or ambiguous content.
5. Minimal Trust Surface: Client writes only primitive user-authored fields; all AI artifacts server-generated and immutable.

---
## Current Data Model (Key Collections)
- `entries` (user text + moderation flags, processed=false until pipeline completes)
- `insights` (structured reflection from an entry)
- `capsules` (durable thematic memory units)
- `alerts` (safety notifications)
- `twinStates` (evolving personal state vector / narrative snapshot)
- `swarmSnapshots` (aggregated anonymized metrics)
- `capsuleEmbeddings` (embedding vectors + version)
- `similarityDecisions` (logs for reuse decisions)
- `rateLimits` (token bucket docs — server only)

Future Collections (Planned):
- `mediaAssets` (raw + processed meta for audio/image ingestion)
- `classifierDecisions` (score + modelVersion + gating outcome)
- `exportManifests` (tracking BigQuery export runs & checksums)

---
## Phase 0 (Complete): Core Pipeline & Agents
Components:
- `insightsAgent`, `capsuleAgent`, `safetyAgent`, `twinAgent`, `swarmAgent`
- Basic embedding placeholder (later upgraded) & naive similarity
- Deterministic fallback logic for generation failures
Outcome: Stable minimal journaling transformation loop.

---
## Phase 1 (Complete): Robustness & Safety
Additions:
- Central `HttpError` + uniform JSON error format
- Rate limiting (token bucket; per-user; capacity adjustable)
- Moderation gating (self-harm rejection)
- Real embeddings attempt (Gemini) + fallback deterministic vector
- `recentCapsules` endpoint + frontend bundle viewer
- Firestore rules tightening
Outcome: Production-hardened baseline with guardrails.

---
## Phase 2 (Complete): Similarity Upgrade
Goals Achieved:
- `EMBEDDING_VERSION` constant + stored per capsuleEmbedding doc
- Enhanced similarity scoring returning ranked candidates + metadata
- Dynamic thresholding (`baseMin`, adjustable future heuristics)
- Capsule reuse decision logging (`similarityDecisions` collection)
- Refactored reuse path in `capsuleAgent` with logging + early exit
Why: Improves cost efficiency, auditability, and paves way for multi‑modal extension.
Open Follow-ups:
- Backfill function for historical embeddings if version increments
- UI surface (admin) to inspect similarity decision logs

---
## Phase 3 (Planned): Media Ingestion 🚧
Objectives:
- Accept audio (spoken journaling) & images (contextual artifacts / handwriting)
- Normalize all media → textual substrate joined to entry text (flagged by source)
Design Highlights:
- Storage Path: `media/{uid}/{entryId}/{assetId}`
- Collection: `mediaAssets` with fields:
  - `assetId`, `userId`, `entryId`, `type` ('audio'|'image'), `mime`, `status` ('pending'|'processing'|'complete'|'failed'), `transcript` (text), `labels` (array), `error`, `createdAt`, `updatedAt`, `version` (pipeline version)
- Upload Flow: Client gets signed URL (callable) → PUT object → create Firestore doc (pending)
- Triggers: Cloud Storage finalize -> enqueue processing (audio transcription / image labeling)
- Processing:
  - Audio: STT (primary vendor) → fallback Gemini multimodal summarization for short clips
  - Image: Vision label detection + optional Gemini caption
- Integration: On completion, append normalized text (transcript + labels caption) to entry enrichment context before insight/capsule generation if entry still unprocessed
- Safety: Enforce size/duration caps; sanitize MIME types; fail fast with logged reason
- Metrics: Latency, failure rate, average transcript length
- Versioning: `mediaPipelineVersion` to allow future model swaps

Key Risks & Mitigations:
- Long audio latency → chunk or duration cap (e.g. 2 min limit MVP)
- Cost spikes → rate limit daily media minutes per user
- Privacy of images → restrict to personal non-public processing; never export raw

---
## Phase 4 (Planned): Classifier Path 🚧
Objectives:
- Introduce fine-tuned text classifier (risk / emotional intensity / journaling taxonomy)
- Provide structured signals to twin & swarm layers
Architecture:
1. Heuristic Pre-Gate (current risk rules) → pass candidate text
2. Lightweight Classifier (distilled model or external endpoint) returns scores
3. Decision Layer: combine scores + heuristics; may escalate to LLM for ambiguous edge cases (future)
Artifacts:
- `classifierDecisions` collection: `{ decisionId, userId, entryId, scores:{}, modelVersion, createdAt }`
- Add classifier scores to insight generation prompt (contextual modulation)
Versioning & Rollout:
- Shadow mode logging first without affecting pipeline → evaluate precision/recall
- Promote to gating once stable

---
## Phase 5 (Planned): BigQuery & Swarm Narrative 🚧
Objectives:
- Periodic export of anonymized aggregates for longitudinal, population-level insights ("swarm narrative")
- Enable cohort analytics & experiment measurement
Design:
- Export Task: Scheduled function → read whitelisted fields → write newline-delimited JSON to GCS → auto-ingest to BigQuery external or native table
- Schema Considerations: userId hashed, timestamps bucketed (e.g., day), capsule themes, mood vectors (future), classifier buckets
- Swarm Narrative Generator: Aggregates recent window (e.g., 24h) into a neutral summary; stored in `swarmSnapshots`
Governance:
- Strict field allowlist & hashing; PII excluded
- Differential privacy (future phase) if needed

---
## Phase 6+ (Exploratory)
- Personalization Loop: Per-user lightweight embeddings / fine-tunes; adaptive thresholds
- Multi-Capsule Orchestration: Synthesis across capsules (temporal arcs, progress tracking)
- Context Compression: Automated summarization of stale capsules to reduce storage & cost
- On-Device Edge Hints (very future): Local sketch embedding pre-filter

---
## Versioning & Migration Strategy
| Artifact | Version Tag | Migration Approach |
|----------|-------------|-------------------|
| Embeddings | `EMBEDDING_VERSION` | Backfill task regenerates missing/old vectors lazily or in batches |
| Media Pipeline | `mediaPipelineVersion` (planned) | Non-breaking; reprocess only if quality leap |
| Classifier Model | `classifierModelVersion` (planned) | Shadow mode → dual logging → promote |
| Similarity Threshold Logic | Encoded in decision log fields | Compare cohorts across threshold configs |

Backfill Utility (Planned):
- Admin callable function iterating capsules without current version embedding; batches (N=50) per invocation; resumable via cursor.

---
## Observability & Logging
Current:
- Similarity decisions (score, chosen capsule, thresholds)
- Moderation rejections & rate limit enforcement (HTTP errors)
Planned:
- Media processing durations & failure codes
- Classifier confidence distributions
- Export job manifests (row counts, checksum, duration)

---
## Security & Privacy Guardrails
- Firestore rules: user-owned reads, server-only writes for AI artifacts
- Separation of embedding vectors (no direct client writes) & decision logs
- Future: Introduce data retention policy (e.g., automatic purge of raw media after N days post transcription)

---
## Immediate Next Action Candidates
1. Implement `mediaAssets` schema + stub functions (Phase 3 bootstrap)
2. Add embedding backfill admin function (unblocks future version bump)
3. Build similarity decision admin viewer (internal tooling)
4. Shadow classifier scaffold: write empty `classifierDecisions` entries with placeholder scores

---
## Technical Debt & Enhancements
- Similarity evaluation tests (statistical, threshold regression) pending
- Dedicated error codes enumeration for client UX differentiation
- Rate limit bucket diversification (short burst vs long window)
- Centralized metrics exporter (structured logs → optional Pub/Sub sink)

---
## Success Metrics (Initial Definitions)
| Domain | Metric | Baseline (Est.) | Target Post-Phase |
|--------|--------|-----------------|-------------------|
| Reuse | % entries reusing capsule | TBD | >25% without quality loss |
| Safety | False negative severe risk | Low via heuristics | Maintain / reduce |
| Media | Avg transcription latency | N/A | < 12s (short clips) |
| Classifier | Shadow F1 vs heuristic | N/A | +15% precision at equal recall |
| Cost | Avg tokens per entry | Current baseline | -20% after reuse + media summarization |

---
## Glossary
- Capsule: Durable thematic summary; context anchor reused across entries.
- Twin State: User-personal evolving semantic profile.
- Swarm: Aggregated anonymized macro-layer capturing community-level patterns.
- Decision Log: Structured append-only record enabling audit & tuning.

---
## Change Log
- 2025-09-18: Initial roadmap document created (covers phases 0–5 with extensions)

---
## Appendix: Proposed `mediaAssets` Firestore Rules (Draft)
```rules
match /mediaAssets/{id} {
  allow create: if creatingOwn() &&
    request.resource.data.keys().hasOnly([
      'assetId','userId','entryId','type','mime','status','createdAt','updatedAt'
    ]) &&
    request.resource.data.type in ['audio','image'] &&
    request.resource.data.status == 'pending';
  allow read: if isOwner();
  allow update, delete: if false; // server functions will manage status & transcripts
}
```
