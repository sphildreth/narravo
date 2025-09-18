using System.ComponentModel.DataAnnotations;
using Narravo.Core.Enums;

namespace Narravo.Core.Models;

public class Post
{
    public int Id { get; set; }
    
    [Required]
    [MaxLength(500)]
    public string Title { get; set; } = string.Empty;
    
    [Required]
    [MaxLength(500)]
    public string Slug { get; set; } = string.Empty;
    
    public string ContentMd { get; set; } = string.Empty;
    
    public string ContentHtml { get; set; } = string.Empty;
    
    [MaxLength(1000)]
    public string Excerpt { get; set; } = string.Empty;
    
    public PostStatus Status { get; set; } = PostStatus.Draft;
    
    public DateTime? PublishedUtc { get; set; }
    
    public DateTime UpdatedUtc { get; set; } = DateTime.UtcNow;
    
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
    
    public int AuthorId { get; set; }
    
    [Timestamp]
    public byte[]? RowVersion { get; set; }
    
    // Navigation properties
    public User Author { get; set; } = null!;
    public ICollection<PostTerm> PostTerms { get; set; } = new List<PostTerm>();
    public ICollection<Comment> Comments { get; set; } = new List<Comment>();
    public ICollection<Reaction> Reactions { get; set; } = new List<Reaction>();
    public ICollection<PostMeta> PostMeta { get; set; } = new List<PostMeta>();
}