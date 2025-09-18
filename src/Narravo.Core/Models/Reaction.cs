using System.ComponentModel.DataAnnotations;
using Narravo.Core.Enums;

namespace Narravo.Core.Models;

public class Reaction
{
    public int Id { get; set; }
    
    [Required]
    [MaxLength(50)]
    public string TargetType { get; set; } = string.Empty;
    
    public int TargetId { get; set; }
    
    public int? UserId { get; set; }
    
    [MaxLength(50)]
    public string? AnonymousId { get; set; }
    
    public ReactionKind Kind { get; set; }
    
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
    
    // Navigation properties
    public User? User { get; set; }
}