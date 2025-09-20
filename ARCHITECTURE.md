# MindScribe Architecture (MVP → Extended)

## Core Data Collections
- entries: raw journals (text, status)
- insights: emotional + semantic analysis output
- capsules: generated coping modules
- alerts: safety escalation artifacts
- twinStates: evolving emotional twin state
- swarmSnapshots: anonymized aggregate mood metrics

## Cloud Functions (Agents)
- submitEntry (HTTP) → writes entries
- onEntryCreated (Firestore trigger) → generates insights (Gemini + heuristics)
- onInsightCreated (Firestore trigger) → generates coping capsule
- onSafetyCheck (Firestore trigger) → creates alerts for high risk
- onTwinUpdate (Firestore trigger) → updates user twin state
- onSwarmAggregation (Scheduled) → aggregates community metrics

## Supporting Libraries (lib/)
- gemini.ts: AI text analysis (hybrid: Gemini + fallback)
- safety.ts / safetyAgent.ts: risk scoring and escalation
- capsuleSelector.ts + gemini.ts: capsule generation / content
- embeddings.ts: (placeholder) semantic embedding utilities
- moderation.ts: basic keyword moderation (extendable)
- youtube.ts: playlist recommendations (stub)
- aggregation.ts: shared math helpers for swarm/twin
- firestore.ts: admin initialization & db export

## Flow Overview
1. submitEntry → entries/{id}
2. onEntryCreated → insights/{id}
3. (parallel) onSafetyCheck + onTwinUpdate consume insight
4. onInsightCreated → capsules/{id}
5. Scheduled onSwarmAggregation → swarmSnapshots/{id}

## Extensibility Points
- Add audio/image journaling: Cloud Storage trigger → create entries + mark modality
- Add embeddings similarity reuse for capsules
- Replace heuristic with fine-tuned Vertex AI model (phase 3)
- Add Graph/API layer via Cloud Run for complex queries

## Security & Compliance (Planned)
- Field-level encryption for high-risk phrases (KMS)
- Access rules: user can only read own entries/insights/capsules; swarmSnapshots public aggregate
- Future: anonymization pipeline exporting to BigQuery

---
This file evolves alongside implementation milestones.
