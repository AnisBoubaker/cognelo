# Durable background jobs

Core stores queue records in PostgreSQL and dispatches registered handlers. Enqueue accepts an optional database transaction, allowing an activity's frozen submission and its processing job to commit together. Idempotency keys prevent duplicate jobs.

Claims are serialized briefly with an advisory lock, then ordered by priority and creation time. `registerBackgroundJobQueueLimit` sets a server-wide queue ceiling across API workers; trusted `concurrencyGroup`/`concurrencyLimit` metadata further limits a class/activity. `updateBackgroundJobConcurrency` changes waiting work without restarting active jobs. Each worker replenishes independent execution slots rather than waiting for an entire batch.

Claims have unique ownership tokens, heartbeat every 15 seconds, and recover after two minutes without a heartbeat. Interrupted jobs retry up to their configured attempt limit; exhausted work remains failed and visible. Success/failure writes match the running owner so stale workers cannot overwrite replacement results. Activity handlers must additionally verify their lease and domain state when publishing durable output.

A cancelled running job retains its slot until the in-flight request unwinds, preventing cancellation from temporarily exceeding the provider concurrency ceiling. Dead cancelled-worker leases expire. Waiting/failed cancellations require no retained slot. Generic deadline jobs use a separate queue; activity finalizers recheck effective policy and finalize only server-saved answers.

The API starts the shared worker through instrumentation. `COGNELO_BACKGROUND_JOBS_DISABLED=true` disables automatic workers for explicitly controlled tests; leave it unset or false for normal operation. Worker failures are isolated and polling continues after transient database errors. No production test data is needed for health checks.
