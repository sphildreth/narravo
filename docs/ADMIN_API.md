<!-- SPDX-License-Identifier: Apache-2.0 -->
  - Removes a user override.

- POST /api/admin/config/invalidate
  - Body: { key, userId? }
  - Manually invalidates cache for a key (global when userId omitted).

- POST /api/admin/users/anonymize
  - Body: { userId } or { email }
  - Deletes the user row (comments become anonymous via FK, reactions cascade). Returns { ok, deleted }.

Notes
- All mutation endpoints return HTTP 403 when the caller is not an admin.
- Errors include { ok: false, error: { message } } with status 400.
