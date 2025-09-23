# Overview 

The ability for the admin user to download backups and purge data from the database.

# Requirements
- Create a new Database menu item under System
- Move the current Import under Database so its Admin -> System -> Database -> Import
    - This has the import features currently in place
- Create a new Export under Database so its Admin -> System -> Database -> Export
    - This is a new export feature to create a backup of the entire system
    - Put checkboxes to include post data, user data, and database data
    - This will create a zip file with the backup data
    - When the user clicks on the download button, the zip file will be downloaded to the user's computer
- Create a new Purge under Database so its Admin -> System -> Database -> Purge
    - This will delete all posts from the database
        - Include the ability to delete categories, posts, comments, reactions, redirects, tags and users
        - If the user selects posts include the options that will be deleted by foreign keys
    - This will be a confirmation dialog that will ask the user to confirm the purge