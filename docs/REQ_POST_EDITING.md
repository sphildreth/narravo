# Overview

Enhancements and bugs related to editing a post.

# Admin Enhancements

- Be able to lock and unlock a post
    - Add a button to the admin block that toggles the lock state with "Lock" and "Unlock" text
- Be able to unpublish a post (effectively hide it from public pages)
    - Add a button to the admin block that toggles the publish state with "Unpublish" text
    - When this button is clicked the published_at value is nulled

### Lock and unlock
- When a post is locked it is effectively in read only mode
- Users cannot comment on a locked post and a "Comments are disabled" message is shown where the comments component would have been displayed
- A padlock appears in th post title
    - For the post titled "Super Cool Post Example" it would look like this "🔒Super Cool Post Example"

### Unpublish
- When a post is unpublished it does not appear in any public pages
    - Does not appear in tag or category views
    - Does not appear in searches
    - Does not appear in the index view
- There is a button in the admin posts portal "Show Unpublished" which lists all unpublished posts

# Editor Enhancements
- When adding a new post on the blur of "Title" generate the Slug automatically
- When editing a post ensure the tab moves from "Excerpt" field to the Content field (don't tab into a wysiwyg editor bar item, tab into the main content area)
- Add the ability to manage the featured image
    - Be able to remove featured image
    - Be able to upload new featured image
- Add the ability to resize an image by dragging the image corners in the wysiwyg editor
- Add the ability to edit and paste mermaidjs diagrams in the wysiwyg editor and to display mermaidjs diagrams in the post detail view

