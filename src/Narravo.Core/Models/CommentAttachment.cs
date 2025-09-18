using System.ComponentModel.DataAnnotations;
using Narravo.Core.Enums;

namespace Narravo.Core.Models;

public class CommentAttachment
{
    public int Id { get; set; }
    
    public int CommentId { get; set; }
    
    public AttachmentKind Kind { get; set; }
    
    [Required]
    [MaxLength(500)]
    public string Path { get; set; } = string.Empty;
    
    [Required]
    [MaxLength(100)]
    public string Mime { get; set; } = string.Empty;
    
    public long Size { get; set; }
    
    public int? DurationSec { get; set; }
    
    [MaxLength(500)]
    public string? PosterPath { get; set; }
    
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
    
    // Navigation properties
    public Comment Comment { get; set; } = null!;
}