# Client key times implementation plan

**Goal:** Show the last authentication and last model request separately in the key list.

**Architecture:** Keep `lastUsedAt` as the existing authentication timestamp. Read the latest retained `model_requests.started_at` for each listed key through the existing `(client_api_key_ref, started_at)` index, expose it as `lastModelRequestAt`, and render both columns. Label the new column as retained history so purged records are not represented as lifetime activity.

**Tech Stack:** Rust, PostgreSQL, Vue.

## Tasks

- [x] Add the indexed latest request lookup to key list and detail projections.
- [x] Carry the timestamp through admin model and API response.
- [x] Rename the existing UI label and add a model request column with relative and full time.
- [x] Verify backend compilation, API serialization, frontend typecheck and lint. Database integration requires a test database.
