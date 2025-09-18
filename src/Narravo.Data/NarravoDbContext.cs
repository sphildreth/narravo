using Microsoft.EntityFrameworkCore;
using Narravo.Core.Models;

namespace Narravo.Data;

public class NarravoDbContext : DbContext
{
    public NarravoDbContext(DbContextOptions<NarravoDbContext> options) : base(options)
    {
    }

    public DbSet<Post> Posts { get; set; }
    public DbSet<User> Users { get; set; }
    public DbSet<Term> Terms { get; set; }
    public DbSet<PostTerm> PostTerms { get; set; }
    public DbSet<Comment> Comments { get; set; }
    public DbSet<CommentAttachment> CommentAttachments { get; set; }
    public DbSet<Reaction> Reactions { get; set; }
    public DbSet<Media> Media { get; set; }
    public DbSet<Redirect> Redirects { get; set; }
    public DbSet<PostMeta> PostMeta { get; set; }
    public DbSet<ImportLog> ImportLogs { get; set; }
    public DbSet<BackupLog> BackupLogs { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Configure PostTerm many-to-many relationship
        modelBuilder.Entity<PostTerm>()
            .HasKey(pt => new { pt.PostId, pt.TermId });

        modelBuilder.Entity<PostTerm>()
            .HasOne(pt => pt.Post)
            .WithMany(p => p.PostTerms)
            .HasForeignKey(pt => pt.PostId);

        modelBuilder.Entity<PostTerm>()
            .HasOne(pt => pt.Term)
            .WithMany(t => t.PostTerms)
            .HasForeignKey(pt => pt.TermId);

        // Configure Comment self-referencing relationship
        modelBuilder.Entity<Comment>()
            .HasOne(c => c.Parent)
            .WithMany(c => c.Replies)
            .HasForeignKey(c => c.ParentId)
            .OnDelete(DeleteBehavior.Restrict);

        // Configure User provider uniqueness
        modelBuilder.Entity<User>()
            .HasIndex(u => new { u.Provider, u.ProviderKey })
            .IsUnique();

        // Configure Post slug uniqueness
        modelBuilder.Entity<Post>()
            .HasIndex(p => p.Slug)
            .IsUnique();

        // Configure Term slug and type uniqueness
        modelBuilder.Entity<Term>()
            .HasIndex(t => new { t.Slug, t.Type })
            .IsUnique();

        // Configure Reaction uniqueness per target and user
        modelBuilder.Entity<Reaction>()
            .HasIndex(r => new { r.TargetType, r.TargetId, r.UserId, r.Kind })
            .IsUnique()
            .HasFilter("UserId IS NOT NULL");

        // Configure Reaction uniqueness per target and anonymous user
        modelBuilder.Entity<Reaction>()
            .HasIndex(r => new { r.TargetType, r.TargetId, r.AnonymousId, r.Kind })
            .IsUnique()
            .HasFilter("AnonymousId IS NOT NULL");

        // Configure Redirect from path uniqueness
        modelBuilder.Entity<Redirect>()
            .HasIndex(r => r.FromPath)
            .IsUnique();

        // Configure PostMeta uniqueness per post and key
        modelBuilder.Entity<PostMeta>()
            .HasIndex(pm => new { pm.PostId, pm.Key })
            .IsUnique();

        // Configure foreign key relationships
        modelBuilder.Entity<Post>()
            .HasOne(p => p.Author)
            .WithMany(u => u.Posts)
            .HasForeignKey(p => p.AuthorId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Comment>()
            .HasOne(c => c.Post)
            .WithMany(p => p.Comments)
            .HasForeignKey(c => c.PostId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Comment>()
            .HasOne(c => c.AuthorUser)
            .WithMany(u => u.Comments)
            .HasForeignKey(c => c.AuthorUserId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<CommentAttachment>()
            .HasOne(ca => ca.Comment)
            .WithMany(c => c.Attachments)
            .HasForeignKey(ca => ca.CommentId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Reaction>()
            .HasOne(r => r.User)
            .WithMany(u => u.Reactions)
            .HasForeignKey(r => r.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<PostMeta>()
            .HasOne(pm => pm.Post)
            .WithMany(p => p.PostMeta)
            .HasForeignKey(pm => pm.PostId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}