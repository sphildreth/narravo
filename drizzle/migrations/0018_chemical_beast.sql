CREATE INDEX "comment_attachments_comment_id_idx" ON "comment_attachments" USING btree ("comment_id");--> statement-breakpoint
CREATE INDEX "comments_post_tree_idx" ON "comments" USING btree ("post_id","status","depth","path") WHERE "comments"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "comments_parent_id_idx" ON "comments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "posts_published_feed_idx" ON "posts" USING btree ("published_at","id") WHERE "posts"."deleted_at" is null and "posts"."published_at" is not null;--> statement-breakpoint
CREATE INDEX "posts_category_id_idx" ON "posts" USING btree ("category_id");