using System.ComponentModel.DataAnnotations;

namespace Narravo.Core.Models;

public class Media
{
    public int Id { get; set; }
    
    [MaxLength(1000)]
    public string? OriginalUrl { get; set; }
    
    [Required]
    [MaxLength(500)]
    public string LocalPath { get; set; } = string.Empty;
    
    [Required]
    [MaxLength(100)]
    public string Mime { get; set; } = string.Empty;
    
    public int? Width { get; set; }
    
    public int? Height { get; set; }
    
    [MaxLength(64)]
    public string? Sha256 { get; set; }
    
    public long Size { get; set; }
    
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
}