
# Unit Testing Requirements for WordPress WXR XML Import

_Last updated: 2025-09-24 21:35:59_

This document defines unit-test requirements for a coding agent implementing an importer for WordPress WXR (WordPress eXtended RSS) XML exports. It is organized by feature area, with explicit **fixtures**, **setup**, **assertions**, and **edge cases** the tests must cover. Use small, deterministic fixtures that isolate behavior (unit level), plus a handful of “component-style” tests that validate end-to-end mapping logic without external services.

---

---

## Fixture Location & Conventions (Authoritative)

**Canonical path for all fixtures in this repo:** `./tests/fixtures/wxr/`

- File extensions: `.xml` **or** `.wxr` (identical format).
- Test discovery glob: `tests/fixtures/wxr/**/*.(xml|wxr)` (recursive).
- Environment override (optional): `FIXTURE_DIR` — when set, the loader must read from this directory instead of the default.
- Minimal loader contract:
    - Provide `load_fixture(name: string): string` that resolves by filename (without path) inside `tests/fixtures/wxr`.
    - Provide `list_fixtures(): string[]` returning relative paths under `tests/fixtures/wxr` sorted alphabetically.
    - Fail fast with a clear error if a named fixture is missing; include suggested names on typos (Levenshtein ≤ 2).

**Examples**
- `load_fixture("wxr_html_lists.xml")` → reads `./tests/fixtures/wxr/wxr_html_lists.xml`
- `load_fixture("wxr_iframe_embed.wxr")` → reads `./tests/fixtures/wxr/wxr_iframe_embed.wxr`

**CI Note:** Tests MUST NOT reference absolute machine paths. Always use the canonical relative path or the `FIXTURE_DIR` override.



## 0) Test Philosophy & Harness

- **Deterministic fixtures**: Keep each XML under 2–10 KB unless testing large-file behavior.
- **No network / no filesystem side effects**: Mock storage and HTTP. All media downloads should be mocked.
- **Pure functions where possible**: Parsing & mapping should be testable without the database. DB writes should be behind an interface you can stub.
- **Idempotency**: Running the same import twice must not duplicate entities; tests must assert no-op behavior on re-import.
- **Property-based tests**: For fields like slugs, titles, and meta keys, fuzz inputs (unicode, emoji, whitespace, mixed RTL/LTR) and assert stable, valid outputs.
- **Golden files**: Maintain “golden” normalized results for a few canonical fixtures; assert strict equality (with helpful diff on failure).
- **Schema-aware XML parsing**: Validate **well-formedness** and required elements; if using XPaths, test that queries are robust to namespaced and non-namespaced nodes.

---

## 1) XML Parsing & Namespaces

**Fixtures**
- `wxr_minimal.xml`: single post with author, category, and comment.
- `wxr_namespaced.xml`: includes `wp:`, `content:`, `excerpt:`, `dc:` namespaces and mixed prefix usage.
- `wxr_malformed.xml`: broken closing tag or bad entity (should fail gracefully).

**Assertions**
- Parser rejects malformed XML with a clear error.
- Namespaced elements resolve correctly even if namespace prefixes vary.
- Character encoding (UTF‑8) preserved; test with emoji and accents.

**Edge Cases**
- CDATA blocks for content/excerpt.
- HTML entities (&nbsp;, &amp;, &#x2014;); confirm they render correctly post-parse.
- Line endings `\r\n` vs `\n` don’t change semantics.

---

## 2) Versioning & Compatibility

**Fixtures**
- `wxr_v1_2.xml`, `wxr_v1_1.xml` (simulate version differences via `wp:wxr_version`).

**Assertions**
- Importer reads `wp:wxr_version` and logs/branches as needed.
- Unknown versions produce a warning but try best-effort import.

---

## 3) Authors & Users

**Fixtures**
- `wxr_authors_basic.xml`: two authors with `wp:author_login`, `wp:author_email`, display name.
- `wxr_author_missing_email.xml`: author missing optional fields.

**Assertions**
- Authors map deterministically to internal users (by login/email).
- Missing optional fields default sanely; no crashes.
- Idempotent user creation: re-import does not create duplicates.

**Edge Cases**
- Email collisions, Unicode logins, mixed case normalization.

---

## 4) Posts / Pages / Custom Post Types

**Fixtures**
- `wxr_posts_mix.xml`: includes `post`, `page`, and a custom type (e.g., `product`).
- `wxr_post_statuses.xml`: includes `publish`, `draft`, `private`, `pending`, `future`.
- `wxr_post_password.xml`: password-protected post.
- `wxr_sticky.xml`: `wp:is_sticky` = 1.
- `wxr_revisions.xml`: includes revisions; ensure correct canonical selection.
- `wxr_nav_menu_items.xml`: items with `nav_menu_item` post type.
- `wxr_gutenberg_blocks.xml`: content with Gutenberg block comments (e.g., `<!-- wp:paragraph -->`).

**Assertions**
- Correct type mapping & storage per post type.
- Status mapping retained (draft stays draft, future-dated respected).
- Sticky flag imported.
- Password protected posts persist the password indicator/field.
- Revisions handled: only latest “current” content used unless revisions explicitly imported.
- Nav menu items either imported or skipped with explicit log; no crash.
- Gutenberg blocks preserved as raw HTML/serialized content, not stripped.

**Edge Cases**
- Slug collisions: deterministic suffixing logic.
- Very long titles/slugs truncated or hashed per spec; tests assert exact behavior.
- Unicode slugs normalized per configured rules.

---

## 5) Content Fields (HTML, More Tag, Shortcodes, Embeds)

**Fixtures**
- `wxr_more_excerpt.xml`: content containing `<!--more-->` once and multiple times.
- `wxr_shortcodes.xml`: `[gallery]`, `[audio]`, arbitrary `[shortcode attr="x"]text[/shortcode]`.
- `wxr_oembed.xml`: URLs that WP typically auto-embeds.
- `wxr_cdata_content.xml`: content wrapped in CDATA with HTML.

**Assertions**
- **More tag**: first `<!--more-->` split creates an excerpt (if enabled); excerpt text trimmed; re-join logic correct if needed.
- Excerpt field: when `excerpt:encoded` present, that overrides derived excerpt.
- Shortcodes: either preserved verbatim, stripped, or transformed—assert chosen strategy consistently across fixtures.
- Dangerous HTML sanitized if importer performs sanitization; verify allowed tags list.
- CDATA preserved/decoded appropriately; no double-escaping.
- Emojis and RTL/LTR text preserved.

**Edge Cases**
- Multiple `<!--more-->` occurrences: only first splits; rest remain.
- Nested shortcodes or malformed closing tags handled gracefully.
- HTML entity decoding performed exactly once.

---

## 6) Attachments & Media

**Fixtures**
- `wxr_attachments.xml`: `attachment` posts with `wp:attachment_url`.
- `wxr_attachment_missing_file.xml`: attachment missing or 404 (mocked HTTP).

**Assertions**
- Attachment posts create media records with file metadata (mime, dimensions if available).
- Download pipeline is **mocked**; failures logged; importer continues.
- Parent/child relationships set (attachment → parent post via `wp:post_parent`).
- Status `inherit` handled correctly.

**Edge Cases**
- Duplicate media by URL or hash deduplicated.
- Query string or size variants in URLs preserved/normalized.
- Orphan attachments imported but not linked; logged for review.

---

## 7) Taxonomies (Categories, Tags, Custom Taxonomies)

**Fixtures**
- `wxr_terms_hierarchy.xml`: hierarchical categories with parent/child.
- `wxr_custom_tax.xml`: custom taxonomy `genre` with terms assigned to posts.
- `wxr_term_slugs_collide.xml`: two terms same name different parents.

**Assertions**
- Create/merge terms deterministically; maintain hierarchy.
- Term assignments attached to correct posts.
- Slug normalization and collision handling deterministic.
- Empty or missing term arrays do not crash.

**Edge Cases**
- Invalid parents; circular refs guarded against.
- Very deep hierarchies handled (depth ≥ 6).

---

## 8) Comments, Pingbacks, Trackbacks

**Fixtures**
- `wxr_comments_basic.xml`: threaded comments, `approved` states, dates, authors (registered + guest).
- `wxr_pingbacks.xml`: `pingback` / `trackback` types.

**Assertions**
- Comment threading created via `wp:comment_parent`.
- Approved/pending/spam/trash states mapped correctly.
- Author info (name, email, URL) preserved for guests.
- Pingbacks/trackbacks imported or explicitly ignored with logs.

**Edge Cases**
- Comments on password-protected posts.
- Missing parent comment gracefully attaches at root.

---

## 9) GUIDs, IDs, and Mapping

**Fixtures**
- `wxr_duplicate_guids.xml`: two posts with same GUID (seen in broken exports).
- `wxr_missing_guid.xml`: no GUID.

**Assertions**
- GUID treated as stable external key only if unique; duplicates handled without collision in internal IDs.
- Missing GUIDs fallback to composite keys (type + slug + date) or similar deterministic scheme.
- Re-import updates existing by GUID/slug matching, not dups.

---

## 10) Post Meta & Custom Fields

**Fixtures**
- `wxr_meta_basic.xml`: common keys like `_thumbnail_id`.
- `wxr_meta_serialized.xml`: PHP-serialized arrays/objects in meta.
- `wxr_meta_large.xml`: large meta values (≥ 64 KB).

**Assertions**
- Meta preserved with correct types; serialized meta parsed (if supported) or stored raw per strategy.
- Thumbnail linkage resolved to media.
- Large values stored without truncation (or explicitly truncated with logs).

**Edge Cases**
- Duplicate keys: last-one-wins or merged—assert chosen policy.
- Binary-ish data safely handled or rejected.

---

## 11) Dates, Timezones, and Formatting

**Fixtures**
- `wxr_dates_mixed.xml`: mix of local time, GMT time, and future-dated posts.

**Assertions**
- Correct parsing of `post_date` and `post_date_gmt`; internal storage normalized (e.g., UTC).
- Date math consistent; drafts/future posts keep status & schedule.

**Edge Cases**
- Leap years, DST transitions; test boundary cases.

---

## 12) Slugs, Permalinks, and Routing

**Fixtures**
- `wxr_slug_edge.xml`: long slugs, unicode, whitespace, duplicate names on same date.
- `wxr_permalink_struct.xml`: simulate different permalink expectations (date-based vs post-name).

**Assertions**
- Slugs normalized per rules; ensure uniqueness with deterministic suffixing.
- Back-compat permalink redirects optionally emitted; if feature exists, assert mapping table.

---

## 13) Performance & Limits (Unit-Appropriate)

**Fixtures**
- `wxr_many_small.xml`: 200 small posts.
- `wxr_single_huge_content.xml`: one post with 2 MB HTML.

**Assertions**
- Parser pipeline handles N posts within budgeted time (set an upper bound for unit scope, e.g., < 500 ms for 200 small posts on CI runner).
- Memory usage bounded (no quadratic behavior).

**Edge Cases**
- Streaming vs buffered parsing toggle covered if supported.

---

## 14) Error Handling, Logging, and Reporting

**Fixtures**
- Use above fixtures but inject specific failures: missing required elements, 404 downloads, invalid taxonomy.

**Assertions**
- All errors produce actionable messages (source post GUID/slug, element path).
- Non-fatal errors do not abort entire import; fail only the entity and continue.
- A summary report aggregates counts: created/updated/skipped/failed by entity type.

---

## 15) Resumability & Checkpointing (if supported)

**Fixtures**
- Simulate import stopping mid-file and resuming.

**Assertions**
- On resume, importer continues from last successful checkpoint without duplicating earlier entities.
- Checkpoint persisted via deterministic cursor (e.g., item index + checksum).

---

## 16) Configuration Flags

If importer supports flags (e.g., “skip media”, “map private to draft”, “strip shortcodes”):

**Assertions**
- Each flag has unit tests covering ON and OFF.
- Default values documented; tests assert defaults.

---

## 17) Test Data Catalog (Suggested Files)

- `wxr_minimal.xml`
- `wxr_namespaced.xml`
- `wxr_malformed.xml`
- `wxr_v1_2.xml`, `wxr_v1_1.xml`
- `wxr_authors_basic.xml`, `wxr_author_missing_email.xml`
- `wxr_posts_mix.xml`, `wxr_post_statuses.xml`, `wxr_post_password.xml`, `wxr_sticky.xml`, `wxr_revisions.xml`, `wxr_nav_menu_items.xml`, `wxr_gutenberg_blocks.xml`
- `wxr_more_excerpt.xml`, `wxr_shortcodes.xml`, `wxr_oembed.xml`, `wxr_cdata_content.xml`
- `wxr_attachments.xml`, `wxr_attachment_missing_file.xml`
- `wxr_terms_hierarchy.xml`, `wxr_custom_tax.xml`, `wxr_term_slugs_collide.xml`
- `wxr_comments_basic.xml`, `wxr_pingbacks.xml`
- `wxr_duplicate_guids.xml`, `wxr_missing_guid.xml`
- `wxr_meta_basic.xml`, `wxr_meta_serialized.xml`, `wxr_meta_large.xml`
- `wxr_dates_mixed.xml`
- `wxr_slug_edge.xml`, `wxr_permalink_struct.xml`
- `wxr_many_small.xml`, `wxr_single_huge_content.xml`

---

## 18) Example Test Case Template

```md
### Case: Parse “more” tag and derive excerpt
**Fixture**: `wxr_more_excerpt.xml`  
**Setup**: Import with `deriveExcerpt=true`, `respectExcerptField=true`  
**Expect**:  
- `post.excerpt` equals text before first `<!--more-->`, trimmed.  
- `post.content` equals original content with first `<!--more-->` removed, remainder intact.  
- If `excerpt:encoded` present, it **overrides** derived excerpt.  
- Re-import yields no changes (idempotent).  
```

---

## 19) Tooling Recommendations

- Unit test framework of your stack (e.g., Jest/Vitest for TS; xUnit/NUnit for .NET; pytest for Python).
- **XML assertions helper**: small utility to XPath for nodes, normalize whitespace, decode entities once.
- **Fixtures loader**: auto-discovers `fixtures/wxr/*.xml` and exposes typed builders.
- **Snapshot/golden testing**: store normalized post objects (JSON) for key fixtures.

---

## 20) Done Criteria

- All sections (1–19) have at least one passing test.
- Code coverage for import mapping functions ≥ 90% lines/branches.
- CI runs tests in < 2 minutes with deterministic results.
- Lint/typecheck integrated; no `any` leaks in mapping code.


---

## Appendix A — Included Fixture Files

**Canonical fixture directory:** `./tests/fixtures/wxr/`


_Generated: 2025-09-24 21:50:14_

The following WXR fixtures are included in the downloadable pack and align to the sections above:

- `wxr_attachment_missing_file.xml`
- `wxr_attachments.xml`
- `wxr_author_missing_email.xml`
- `wxr_comments_basic.xml`
- `wxr_custom_tax.xml`
- `wxr_dates_mixed.xml`
- `wxr_duplicate_guids.xml`
- `wxr_malformed.xml`
- `wxr_many_small.xml`
- `wxr_meta_serialized.xml`
- `wxr_minimal.xml`
- `wxr_missing_guid.xml`
- `wxr_more_excerpt.xml`
- `wxr_namespaced.xml`
- `wxr_pingbacks.xml`
- `wxr_post_password.xml`
- `wxr_post_statuses.xml`
- `wxr_posts_mix.xml`
- `wxr_revisions.xml`
- `wxr_shortcodes.xml`
- `wxr_single_huge_content.xml`
- `wxr_slug_edge.xml`
- `wxr_sticky.xml`
- `wxr_terms_hierarchy.xml`
- `wxr_v1_1.xml`
- `wxr_v1_2.xml`

---

## Appendix B — HTML Element Handling Matrix
_Generated: 2025-09-24 22:08:16_

Define and test a **sanitization/serialization policy** for common WordPress content elements. For each tag, specify: **allow/strip/transform**, **allowed attributes**, and whether **URL validation** is enforced.

| Element | Policy | Allowed Attributes (example) | Notes/Test Expectations |

| --- | --- | --- | --- |

| `p`, `span`, `strong`, `em`, `b`, `i` | allow | global attrs | Preserve whitespace & inline semantics |

| `ul`, `ol`, `li` | allow | global attrs | Nested lists survive round-trip; order maintained (see `wxr_html_lists.xml`) |

| `blockquote` | allow | cite | Text preserved (see `wxr_code_pre_blockquote.xml`) |

| `pre`, `code` | allow | class, data-lang | No double-escaping; language class retained |

| `img` | allow | src, srcset, sizes, alt, title, width, height, data-* | Validate URLs; preserve `srcset/sizes` (see `wxr_img_srcset_data_attrs.xml`) |

| `a` | allow | href, title, target, rel | Enforce safe `rel` on `target=_blank` (see `wxr_anchor_rel_target.xml`) |

| `figure`, `figcaption` | allow | global attrs | Keep caption semantics (see `wxr_image_caption_gallery.xml`) |

| `table`, `thead`, `tbody`, `tfoot`, `tr`, `th`, `td` | allow | scope, colspan, rowspan | No layout corruption (see `wxr_table_complex.xml`) |

| `iframe` | **transform or allowlist** | src, width, height, allow, allowfullscreen | Prefer transform to trusted embed component; validate hostname (see `wxr_iframe_embed.xml`) |

| `video`, `audio`, `source` | allow | src, controls, type | URL validation; no autoplay unless policy permits |

| `object`, `embed` | **strip or transform** | data, type | Often blocked; assert logs when stripped (see `wxr_iframe_embed.xml`) |

| `script`, `style` | **strip** | — | Must be removed or sandboxed (see `wxr_script_style.xml`) |

| HTML entities | decode-once | — | Ensure not double-decoded (see `wxr_entities_cdata_mixed.xml`) |

| RTL/LTR attributes | allow | dir | Ensure rendering direction preserved (see `wxr_rtl_mixed_ltr.xml`) |

| Line endings | normalize | — | `\r\n` handled consistently (see `wxr_line_endings_crlf.xml`) |

| oEmbed URLs | transform | — | Convert to embed model; no network in unit tests (see `wxr_oembed_urls.xml`) |

| Gutenberg block comments | preserve | — | Keep block boundaries (see `wxr_gutenberg_blocks.xml`) |

| Nav Menu Items | import/skip with log | meta `_menu_item_*` | Deterministic behavior (see `wxr_nav_menu_items.xml`, `wxr_menu_terms.xml`) |

| Comment states | map | approved/pending/spam/trash | Correct state mapping (see `wxr_comment_states.xml`) |

| Attachments (variants) | dedupe | URL canonicalization | Query strings normalized (see `wxr_attachment_variants.xml`) |

| Orphan attachments | import + log | — | Not linked to post; logged (see `wxr_orphan_attachment.xml`) |

| Term slug collisions | disambiguate | — | Parent-aware slug or suffix (see `wxr_term_slug_collision.xml`) |


**Action**: Implement tests asserting the exact sanitization outcomes for each element per the chosen policy (e.g., snapshot the normalized HTML after import).

