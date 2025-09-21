# Moderation Queue

The admin moderation queue allows administrators to review and manage user comments across the site.

## Features

- **Filter by Status**: View comments by status (pending, approved, spam, deleted)
- **Search**: Search through comment content, author names, emails, and post titles
- **Bulk Actions**: Select multiple comments and perform bulk approve/spam/delete operations
- **Individual Actions**: Edit comment content, approve, mark as spam, or delete individual comments
- **Pagination**: Navigate through large numbers of comments with configurable page size
- **Attachments**: View and manage media attachments associated with comments
- **Revalidation**: Automatic cache invalidation when comment statuses change

## Usage

### Accessing the Moderation Queue

Navigate to `/admin/moderation` in the admin panel. This requires admin privileges.

### Filtering Comments

- **Status Filter**: Use the dropdown to filter by comment status
- **Search**: Enter text to search across comment content, author info, and post titles
- **Combined Filters**: Status and search filters can be used together

### Managing Comments

#### Individual Actions
- **Approve**: Change status to approved, making the comment visible on the site
- **Spam**: Mark as spam, hiding it from public view
- **Delete**: Soft delete (status = deleted), hiding from public but keeping in database
- **Edit**: Modify the comment content with markdown sanitization

#### Bulk Actions
1. Select multiple comments using checkboxes
2. Use bulk action buttons to approve, spam, or delete multiple comments at once
3. Use "Select all" to select all comments on the current page

### Configuration

The moderation queue uses the following configuration values:

- `MODERATION.PAGE-SIZE` (default: 20): Number of comments to display per page

## Technical Details

### Cache Invalidation

When comment statuses are changed, the system automatically:
- Revalidates the affected post pages (`post:{postId}`)
- Revalidates the home page to update comment counts
- Ensures immediate visibility of moderation changes

### Status Flow

Comments have the following status options:
- `pending`: Awaiting moderation (default for new comments)
- `approved`: Visible on the public site
- `spam`: Hidden from public view but kept for admin review
- `deleted`: Soft deleted, hidden from public view

### Security

- All moderation actions require admin authentication
- Comment editing includes server-side markdown sanitization
- Search queries are parameterized to prevent SQL injection

## API

The moderation functionality is exposed through:
- `/api/admin/comments/moderate` - Server action endpoint for moderation operations
- Server actions in `/admin/moderation/actions.ts` for page functionality