using Microsoft.EntityFrameworkCore;
using Narravo.Core.Models;
using Narravo.Core.Enums;
using Narravo.Data;

namespace Narravo.Web.Services;

public interface IPostService
{
    Task<IEnumerable<Post>> GetPublishedPostsAsync(int skip = 0, int take = 10);
    Task<Post?> GetPostBySlugAsync(string slug);
    Task<Post?> GetPostByIdAsync(int id);
    Task<Post> CreatePostAsync(Post post);
    Task<Post> UpdatePostAsync(Post post);
    Task DeletePostAsync(int id);
    Task<int> GetPostCountAsync();
}

public class PostService : IPostService
{
    private readonly NarravoDbContext _context;
    private readonly ILogger<PostService> _logger;

    public PostService(NarravoDbContext context, ILogger<PostService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<IEnumerable<Post>> GetPublishedPostsAsync(int skip = 0, int take = 10)
    {
        return await _context.Posts
            .Where(p => p.Status == PostStatus.Published && p.PublishedUtc <= DateTime.UtcNow)
            .Include(p => p.Author)
            .Include(p => p.PostTerms).ThenInclude(pt => pt.Term)
            .OrderByDescending(p => p.PublishedUtc)
            .Skip(skip)
            .Take(take)
            .ToListAsync();
    }

    public async Task<Post?> GetPostBySlugAsync(string slug)
    {
        return await _context.Posts
            .Include(p => p.Author)
            .Include(p => p.PostTerms).ThenInclude(pt => pt.Term)
            .Include(p => p.Comments.Where(c => c.Status == CommentStatus.Approved))
                .ThenInclude(c => c.Replies.Where(r => r.Status == CommentStatus.Approved))
            .FirstOrDefaultAsync(p => p.Slug == slug);
    }

    public async Task<Post?> GetPostByIdAsync(int id)
    {
        return await _context.Posts
            .Include(p => p.Author)
            .Include(p => p.PostTerms).ThenInclude(pt => pt.Term)
            .Include(p => p.PostMeta)
            .FirstOrDefaultAsync(p => p.Id == id);
    }

    public async Task<Post> CreatePostAsync(Post post)
    {
        post.CreatedUtc = DateTime.UtcNow;
        post.UpdatedUtc = DateTime.UtcNow;
        
        _context.Posts.Add(post);
        await _context.SaveChangesAsync();
        
        _logger.LogInformation("Created post with ID {PostId}", post.Id);
        return post;
    }

    public async Task<Post> UpdatePostAsync(Post post)
    {
        post.UpdatedUtc = DateTime.UtcNow;
        
        _context.Posts.Update(post);
        await _context.SaveChangesAsync();
        
        _logger.LogInformation("Updated post with ID {PostId}", post.Id);
        return post;
    }

    public async Task DeletePostAsync(int id)
    {
        var post = await _context.Posts.FindAsync(id);
        if (post != null)
        {
            _context.Posts.Remove(post);
            await _context.SaveChangesAsync();
            _logger.LogInformation("Deleted post with ID {PostId}", id);
        }
    }

    public async Task<int> GetPostCountAsync()
    {
        return await _context.Posts.CountAsync();
    }
}