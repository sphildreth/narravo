using System.ComponentModel.DataAnnotations;

namespace Narravo.Core.Models;

public class ImportLog
{
    public int Id { get; set; }
    
    [Required]
    [MaxLength(100)]
    public string Kind { get; set; } = string.Empty;
    
    [MaxLength(255)]
    public string? Ref { get; set; }
    
    [Required]
    [MaxLength(50)]
    public string Level { get; set; } = string.Empty;
    
    [Required]
    public string Message { get; set; } = string.Empty;
    
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
}