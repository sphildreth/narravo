using System.ComponentModel.DataAnnotations;

namespace Narravo.Core.Models;

public class Redirect
{
    public int Id { get; set; }
    
    [Required]
    [MaxLength(1000)]
    public string FromPath { get; set; } = string.Empty;
    
    [Required]
    [MaxLength(1000)]
    public string ToPath { get; set; } = string.Empty;
    
    public int HttpStatus { get; set; } = 301;
    
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
    
    public int HitCount { get; set; } = 0;
}