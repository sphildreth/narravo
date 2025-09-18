using System.ComponentModel.DataAnnotations;
using Narravo.Core.Enums;

namespace Narravo.Core.Models;

public class Comment
{
    public int Id { get; set; }
    
    public int PostId { get; set; }
    
    public int? ParentId { get; set; }
    
    [Required]
    [MaxLength(255)]
    public string AuthorDisplay { get; set; } = string.Empty;
    
    public int? AuthorUserId { get; set; }
    
    [MaxLength(255)]
    public string AuthorEmail { get; set; } = string.Empty;
    
    public string BodyMd { get; set; } = string.Empty;
    
    public string BodyHtml { get; set; } = string.Empty;
    
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
    
    public CommentStatus Status { get; set; } = CommentStatus.Pending;
    
    // Navigation properties
    public Post Post { get; set; } = null!;
    public Comment? Parent { get; set; }
    public User? AuthorUser { get; set; }
    public ICollection<Comment> Replies { get; set; } = new List<Comment>();
    public ICollection<CommentAttachment> Attachments { get; set; } = new List<CommentAttachment>();
    public ICollection<Reaction> Reactions { get; set; } = new List<Reaction>();
}