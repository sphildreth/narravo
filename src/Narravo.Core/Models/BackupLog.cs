using System.ComponentModel.DataAnnotations;

namespace Narravo.Core.Models;

public class BackupLog
{
    public int Id { get; set; }
    
    [Required]
    [MaxLength(100)]
    public string Kind { get; set; } = string.Empty;
    
    [Required]
    [MaxLength(50)]
    public string Status { get; set; } = string.Empty;
    
    [MaxLength(500)]
    public string? ManifestPath { get; set; }
    
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
}