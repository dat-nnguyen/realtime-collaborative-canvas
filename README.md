# Realtime Collaborative Canvas State Sync Engine

A high-performance, distributed, real-time collaborative canvas sync engine modeled after Figma and Google Docs. Built with **Node.js (ESM)**, **Fastify**, **WebSockets**, **Yjs (CRDT)**, **Redis Pub/Sub**, and **PostgreSQL**.

---

## 🏛️ System Architecture

```
                     ┌──────────────────┐
                     │ Client A Browser │
                     │  (Local Y.Doc)   │
                     └────────┬─────────┘
                              │ WebSocket (Raw Binary Frames)
                              ▼
        ┌──────────────────────────────────────────────┐
        │        Load Balancer / Reverse Proxy         │
        └───────────────┬──────────────┬───────────────┘
                        │              │
                        ▼              ▼
           ┌────────────────┐      ┌────────────────┐
           │ Server Node #1 │      │ Server Node #2 │
           │ (Fastify + ws) │      │ (Fastify + ws) │
           └───────┬────────┘      └───────┬────────┘
                   │                       │
                   │   Redis Pub/Sub Bus   │
                   └───────►┌─────┐◄───────┘
                            │Redis│ (Binary buffers)
                            └─────┘
                               │ Periodic debounced snapshots
                               ▼
                        ┌──────────────┐
                        │  PostgreSQL  │
                        │ (Snapshots)  │
                        └──────────────┘
```

---

## 🚀 Key Architectural Pillars

1. **Conflict-Free Replicated Data Types (CRDT / Yjs)**:
   - Client and server maintain synchronized state without centralized lock management.
   - Fractional indexing prevents race conditions during layer / z-index reordering.
2. **High-Performance Binary Wire Protocol**:
   - Zero JSON serialization on the hot sync path: uses raw `Uint8Array` / Node `Buffer` payloads.
   - `perMessageDeflate: false` to maximize socket capacity and prevent V8 memory exhaustion.
3. **Multi-Node Horizontal Scaling (Redis Pub/Sub)**:
   - Server replicas synchronize room updates across instances with echo loop prevention.
4. **Debounced Write-Behind Persistence (PostgreSQL)**:
   - Avoids database write thrashing by debouncing state flushes (2s idle / 30s max wait) as compressed `BYTEA` snapshots.
5. **Ephemeral Awareness**:
   - Real-time cursors and selections transmitted via `y-protocols/awareness` (throttled to 30Hz, zero database overhead).

---

## 📂 Project Structure

```
├── .agents/                   # Custom agent workflow skills
├── benchmarks/                # C10K memory stress tests & P99 cross-replica latency probes
├── client/                    # Minimalist HTML5 Canvas / SVG collaborative demo
└── src/
    ├── cluster/               # Redis Pub/Sub adapter for distributed sync
    ├── crdt/                  # Yjs canvas schema, shape helpers & fractional indexing
    ├── protocols/             # Binary protocol handlers (sync & awareness)
    ├── rooms/                 # In-memory Room & connection lifecycle manager
    └── storage/               # PostgreSQL connection pool & snapshot manager
```
