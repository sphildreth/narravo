<!-- SPDX-License-Identifier: Apache-2.0 -->
# Narravo — Admin Wireframes (MVP)

Purpose: low‑fidelity wireframes for the Admin area screens defined in `PRD_SPEC_ADMINISTRATION.md`. These describe layout, primary controls, and key states to guide implementation.

Conventions
- Layout: Left nav, top bar (breadcrumbs + actions), content area, toasts area.
- Components: Next.js App Router pages, Radix UI primitives, Tailwind for layout.
- Responsiveness: Desktop first; mobile stacks panels, tables → cards.
- Keyboard: `/` focus search; `j/k` navigate list; `space` select row; `a` select all; `esc` close drawer/modal; `s` save.
- Toasts: success, error; destructive actions require confirm.

Nav
- Dashboard
- Posts
- Moderation
- Users
- System
  - Appearance
  - Configuration


1) Dashboard
- Path: `/admin`
- Goal: snapshot of site health + quick actions.

Layout (desktop)
[Top bar: Dashboard                                    (New Post) (Review Pending)]
[Cards:  Published Posts | Pending Comments | Spam | Total Users ]
[Recent:  Recent Comments (list with Approve/Spam)                 ]
[Activity: Last 10 Admin Actions (optional)]

Elements
- KPI cards (clickable):
  - Published posts (links to Posts filtered Published)
  - Pending comments (links to Moderation: Pending)
  - Spam comments (links to Moderation: Spam)
  - Users (links to Users)
- Recent comments: list with inline Approve/Spam buttons; “View in context”.
- Quick actions: New Post, Review Pending.

Empty states
- If no content, show succinct guidance and links to create/import (optional).


2) Posts — List
- Path: `/admin/posts`
- Goal: manage posts at scale.

Layout (desktop)
[Top bar: Posts     [Search __________] (New Post)              ]
[Filters: Status [Any|Published|Draft]  Date [____ to ____]     ]
[Bulk: (Publish) (Unpublish) (Delete)  — X selected            ]
[Table]
| ☐ | Title                  | Slug           | Published | Updated | Actions |
|───|────────────────────────|────────────────|───────────|─────────|────────-|
| ☐ | My First Post          | my-first-post  | 2025-09-01| 09-20   | Edit ⋮  |
| ☐ | Draft Thoughts         | draft-thoughts | —         | 09-18   | Edit ⋮  |
[Pagination ◀ 1 2 3 ▶]

Row actions (kebab)
- View, Edit, Publish/Unpublish, Delete.

Empty, loading & error
- Skeleton on load; empty copy with “Create your first post”. Errors show inline banners + retry.


3) Post — Create/Edit
- Paths: `/admin/posts/new`, `/admin/posts/[id]`
- Goal: author or update a post safely.

Layout (desktop, two-column)
[Header: ← Posts / Post Title (status chip: Draft/Published)     (Preview) (Save Draft) (Publish)]
[Main]
- Title [________________________]
- Slug  [_____________]  (Auto from title • Validate: unique)
- Excerpt [textarea ~3 lines]
- Content (HTML editor) [ tall area with toolbar (basic) ]
[Sidebar]
- Publish
  - PublishedAt: [date][time]  (Now) (Clear)
  - Actions: (Publish Now) (Unpublish)
- SEO (optional MVP-lite): show computed meta preview
- Danger Zone: (Delete Post)

Modals
- Delete confirmation including cascade warning (# of comments).
- Leave with unsaved changes (if dirty + navigate away).

States
- Draft vs Published chip; scheduled (future date) shows tooltip.
- Optimistic concurrency: if updatedAt stale, show “Out of date” with Reload/Overwrite dialog.


4) Moderation — Comments
- Path: `/admin/moderation`
- Goal: triage and act on comments quickly.

Layout (desktop, list + detail)
[Top bar: Moderation     [Search __________] (Bulk: Approve Spam Delete)]
[Tabs: Pending (12) | Approved | Spam | Deleted   Date [____ to ____] ]

[List (left)]
| ☐ | Excerpt                       | Post            | Author      | Created |
|───|───────────────────────────────|-----------------|-------------|---------|
| ☐ | “Love this article…”          | My First Post   | Jane D.     | 09-20   |

[Detail (right)]
- Full body (rendered, sanitized)
- Context: Parent snippet, Thread path
- Attachments: thumbnails/posters with (Remove)
- Actions: (Approve) (Spam) (Delete soft) (Hard Delete ⋮)
- Edit: [Markdown/HTML textarea] (Save)
- Reply as Admin: [textarea] (Reply)

Bulk actions
- Apply to selected; confirm destructive actions; show success/error per item.


5) Users — List & Detail
- Path: `/admin/users`
- Goal: find users and take admin actions.

Layout (desktop)
[Top bar: Users     [Search name/email __________]              ]
[Table]
| Name        | Email                 | Joined  | Comments | Reactions | Admin |
|-------------|-----------------------|---------|----------|-----------|-------|
| Jane Doe    | jane@example.com      | 09-01   | 12       | 33        | No    |

[Drawer / Side panel on row click]
- Profile: name, email, avatar
- Admin status: (Allowlist matched: jane@example.com) [read-only]
- Recent comments (last 10) with links to posts
- Actions: (Anonymize/Delete User) → confirm consequence (comments become anonymous)


6) System → Appearance
- Path: `/admin/system/appearance`
- Goal: set theme and banner.

Layout
[Top bar: Appearance]
[Tabs: Theme | Banner | Icons]

Theme tab
- Default theme: (o) Light ( ) Dark  — Save
- Note: cookie/session theme toggle still available to users; this sets site default.

Banner tab
- Image: (Upload) via R2 presign → shows preview
- Alt: [__________]
- Credit: [text]  URL: [__________]
- Overlay color: [#RRGGBB]   Opacity: [ 0 — 60 ]
- Focal point: X [0..1]  Y [0..1]
- (Preview)  (Save)

Icons tab (optional MVP-lite)
- Favicon/logo upload; guidance on sizes; fallback to /public assets.


7) System → Configuration
- Path: `/admin/system/configuration`
- Goal: manage typed configuration with overrides.

Layout (desktop)
[Top bar: Configuration    [Search key prefix _________] (New Key)]
[Filters: Type [any|string|number|…]  Scope [All|Global|User]]
[Table]
| Key                         | Type     | Scope   | Required | Updated | Actions |
|-----------------------------|----------|---------|----------|---------|---------|
| SITE.TITLE                  | string   | Global  | Yes      | 09-19   | Edit    |
| THEME.DEFAULT               | string   | Global  | No       | 09-18   | Edit    |

[Drawer: Create/Edit]
- Key [UPPERCASE.DOT.NOTATION] (disabled when editing)
- Type [select] (required on create; immutable thereafter)
- Value [type-safe input control]
- Allowed values [JSON array]
- Required [checkbox]
- Actions: (Save) (Cancel)

[User override section]
- Pick user [autocomplete]
- Override Value [type-safe input]
- (Save Override) (Delete Override)

[Cache]
- Show effective value for a sample user
- (Invalidate Cache for Key)


Common Patterns & States
- Confirmations: delete, hard delete, anonymize, publish/unpublish.
- Loading: skeletons for tables and panels; button spinners on actions.
- Errors: inline banner + retry; toast with details; preserve form state.
- A11y: focus management on open/close of drawers; keyboard navigation in lists.
- Rate limits: show friendly message when 429; suggest waiting or reducing bulk batch size.
- Mobile: left nav collapses behind menu; list → detail becomes stacked pages.


Suggested Routes Map
- `/admin`, `/admin/posts`, `/admin/posts/new`, `/admin/posts/[id]`
- `/admin/moderation`
- `/admin/users`
- `/admin/system/appearance`, `/admin/system/configuration`


Appendix — Minimal Dimensions
- Layout breakpoints: sm (stack), md (single column), lg (two column), xl (wide tables)
- Table page size: 20 rows by default
- Text truncation: ellipsis on long titles/slugs; tooltips on hover

