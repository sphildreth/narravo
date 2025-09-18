using System.ComponentModel.DataAnnotations;

namespace Narravo.Core.Models;

public class User
{
    public int Id { get; set; }
    
    [Required]
    [MaxLength(100)]
    public string Provider { get; set; } = string.Empty;
    
    [Required]
    [MaxLength(100)]
    public string ProviderKey { get; set; } = string.Empty;
    
    [Required]
    [MaxLength(255)]
    public string Email { get; set; } = string.Empty;
    
    [Required]
    [MaxLength(255)]
    public string DisplayName { get; set; } = string.Empty;
    
    [MaxLength(500)]
    public string Roles { get; set; } = string.Empty;
    
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
    
    public DateTime UpdatedUtc { get; set; } = DateTime.UtcNow;
    
    // Navigation properties
    public ICollection<Post> Posts { get; set; } = new List<Post>();
    public ICollection<Comment> Comments { get; set; } = new List<Comment>();
    public ICollection<Reaction> Reactions { get; set; } = new List<Reaction>();
}