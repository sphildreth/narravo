using Microsoft.EntityFrameworkCore;
using Narravo.Core.Models;
using Narravo.Core.Enums;
using Narravo.Data;

namespace Narravo.Web.Services;

public interface IDataSeeder
{
    Task SeedAsync();
}

public class DataSeeder : IDataSeeder
{
    private readonly NarravoDbContext _context;
    private readonly ILogger<DataSeeder> _logger;

    public DataSeeder(NarravoDbContext context, ILogger<DataSeeder> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task SeedAsync()
    {
        try
        {
            // Check if we already have data
            if (await _context.Posts.AnyAsync())
            {
                _logger.LogInformation("Database already contains posts, skipping seed");
                return;
            }

            _logger.LogInformation("Seeding database with sample data");

            // Create a sample user
            var author = new User
            {
                Provider = "local",
                ProviderKey = "admin",
                Email = "admin@narravo.local",
                DisplayName = "Admin User",
                Roles = "Admin",
                CreatedUtc = DateTime.UtcNow,
                UpdatedUtc = DateTime.UtcNow
            };
            
            _context.Users.Add(author);
            await _context.SaveChangesAsync();

            // Create sample categories and tags
            var category = new Term
            {
                Name = "General",
                Slug = "general",
                Type = TermType.Category,
                Description = "General blog posts",
                CreatedUtc = DateTime.UtcNow
            };

            var tag1 = new Term
            {
                Name = "Welcome",
                Slug = "welcome",
                Type = TermType.Tag,
                Description = "Welcome posts",
                CreatedUtc = DateTime.UtcNow
            };

            var tag2 = new Term
            {
                Name = "Getting Started",
                Slug = "getting-started",
                Type = TermType.Tag,
                Description = "Getting started posts",
                CreatedUtc = DateTime.UtcNow
            };

            _context.Terms.AddRange(category, tag1, tag2);
            await _context.SaveChangesAsync();

            // Create sample posts
            var post1 = new Post
            {
                Title = "Welcome to Narravo",
                Slug = "welcome-to-narravo",
                ContentMd = "# Welcome to Narravo\n\nNarravo is a lightweight, modern blog platform built with ASP.NET Core and Blazor.\n\n## Features\n\n- Fast and responsive\n- Modern admin interface\n- WordPress import support\n- Comment system with threading\n- Reaction system\n- Video comments\n- Backup and restore\n\nWe hope you enjoy using Narravo!",
                ContentHtml = "<h1>Welcome to Narravo</h1><p>Narravo is a lightweight, modern blog platform built with ASP.NET Core and Blazor.</p><h2>Features</h2><ul><li>Fast and responsive</li><li>Modern admin interface</li><li>WordPress import support</li><li>Comment system with threading</li><li>Reaction system</li><li>Video comments</li><li>Backup and restore</li></ul><p>We hope you enjoy using Narravo!</p>",
                Excerpt = "Welcome to Narravo, a lightweight and modern blog platform built with ASP.NET Core and Blazor.",
                Status = PostStatus.Published,
                PublishedUtc = DateTime.UtcNow.AddHours(-1),
                CreatedUtc = DateTime.UtcNow.AddHours(-1),
                UpdatedUtc = DateTime.UtcNow.AddHours(-1),
                AuthorId = author.Id
            };

            var post2 = new Post
            {
                Title = "Getting Started with Your Blog",
                Slug = "getting-started-with-your-blog",
                ContentMd = "# Getting Started\n\nCongratulations on setting up your Narravo blog! Here are some steps to get you started:\n\n## 1. Customize Your Settings\n\nVisit the admin panel to configure your site settings, including:\n- Site name and description\n- Authentication providers\n- Comment moderation settings\n\n## 2. Create Your First Post\n\nUse the admin interface to create and publish your first blog post.\n\n## 3. Import Existing Content\n\nIf you're migrating from WordPress, you can use our WXR import feature to bring over your existing content.\n\n## 4. Engage with Your Audience\n\nEnable comments and reactions to build a community around your content.",
                ContentHtml = "<h1>Getting Started</h1><p>Congratulations on setting up your Narravo blog! Here are some steps to get you started:</p><h2>1. Customize Your Settings</h2><p>Visit the admin panel to configure your site settings, including:</p><ul><li>Site name and description</li><li>Authentication providers</li><li>Comment moderation settings</li></ul><h2>2. Create Your First Post</h2><p>Use the admin interface to create and publish your first blog post.</p><h2>3. Import Existing Content</h2><p>If you're migrating from WordPress, you can use our WXR import feature to bring over your existing content.</p><h2>4. Engage with Your Audience</h2><p>Enable comments and reactions to build a community around your content.</p>",
                Excerpt = "A guide to help you get started with your new Narravo blog platform.",
                Status = PostStatus.Published,
                PublishedUtc = DateTime.UtcNow.AddHours(-2),
                CreatedUtc = DateTime.UtcNow.AddHours(-2),
                UpdatedUtc = DateTime.UtcNow.AddHours(-2),
                AuthorId = author.Id
            };

            _context.Posts.AddRange(post1, post2);
            await _context.SaveChangesAsync();

            // Create post-term relationships
            var postTerms = new[]
            {
                new PostTerm { PostId = post1.Id, TermId = category.Id },
                new PostTerm { PostId = post1.Id, TermId = tag1.Id },
                new PostTerm { PostId = post2.Id, TermId = category.Id },
                new PostTerm { PostId = post2.Id, TermId = tag2.Id }
            };

            _context.PostTerms.AddRange(postTerms);

            // Create sample comments
            var comment1 = new Comment
            {
                PostId = post1.Id,
                AuthorDisplay = "Jane Doe",
                AuthorEmail = "jane@example.com",
                BodyMd = "Great platform! Looking forward to using it.",
                BodyHtml = "<p>Great platform! Looking forward to using it.</p>",
                CreatedUtc = DateTime.UtcNow.AddMinutes(-30),
                Status = CommentStatus.Approved
            };

            var comment2 = new Comment
            {
                PostId = post1.Id,
                AuthorDisplay = "John Smith",
                AuthorEmail = "john@example.com",
                BodyMd = "This looks very promising. The admin interface is clean!",
                BodyHtml = "<p>This looks very promising. The admin interface is clean!</p>",
                CreatedUtc = DateTime.UtcNow.AddMinutes(-15),
                Status = CommentStatus.Approved
            };

            _context.Comments.AddRange(comment1, comment2);
            await _context.SaveChangesAsync();

            // Create a reply to the first comment
            var reply = new Comment
            {
                PostId = post1.Id,
                ParentId = comment1.Id,
                AuthorDisplay = "Admin User",
                AuthorEmail = "admin@narravo.local",
                AuthorUserId = author.Id,
                BodyMd = "Thank you! We're excited to see what you create with it.",
                BodyHtml = "<p>Thank you! We're excited to see what you create with it.</p>",
                CreatedUtc = DateTime.UtcNow.AddMinutes(-10),
                Status = CommentStatus.Approved
            };

            _context.Comments.Add(reply);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Database seeded successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error seeding database");
            throw;
        }
    }
}