# Comment Moderation

Slice 05 introduces the full moderation workflow for Narravo comments. This document outlines the core surfaces and how to operate them.

## Admin Queue
- Navigate to `/admin/comments` (Admins and Moderators have access).
- The left panel lists comments in `Pending` or `Spam` status ordered by submission time.
- Use bulk actions (`Approve`, `Spam`, `Reject`) to transition selected comments. Optional notes are stored in the moderation log.
- The detail panel includes a Markdown editor with toolbar shortcuts (bold, italic, code, link, quote, bullet) plus live preview.
- The history timeline displays previous status changes with moderator names and notes for auditability.

## APIs
- `GET /api/admin/comments/queue` — returns queue entries for the moderation list.
- `GET /api/admin/comments/{id}` — fetches a full comment record including history.
- `POST /api/admin/comments/{id}/content` — updates Markdown and re-renders sanitized HTML.
- `POST /api/admin/comments/status` — bulk status transitions with notes.

All admin endpoints require the `ModeratorOrAdmin` authorization policy.

## Anti-Spam Enhancements
- Comment submissions now pass through heuristic spam detection (excessive links, known spam keywords, low-effort link drops). Matches are stored with `Spam` status and trigger notifier warnings.
- User-level (3/min) and IP-level (10/5 min) throttles enforce pacing alongside the existing IP-based fixed window limiter.
- Honeypot and minimum submit time checks remain in place; additional notifier hooks log spam/pending events.

## Markdown Sanitization
- Markdown rendering now applies an allowlist sanitizer that retains safe formatting (`p`, `strong`, `em`, `code`, `pre`, `blockquote`, lists, media) while stripping scripts, inline handlers, and unsupported attributes.
- Sanitization is shared across public rendering and moderation edits to guarantee consistent output.

## Notifications
- The default implementation logs moderation events. Future slices can replace `IModerationNotifier` with email or webhook integration without changing the queue UI.

