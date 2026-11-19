-- SPDX-License-Identifier: Apache-2.0
INSERT INTO posts (slug, title, html, excerpt, published_at)
VALUES ('sample-post', 'Sample post', '<p>A sample post for performance checks.</p>', 'A sample post for performance checks.', now())
ON CONFLICT (slug) DO NOTHING;
