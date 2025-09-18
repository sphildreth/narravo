using System.ComponentModel.DataAnnotations;

namespace Narravo.Core.Models;

public class PostMeta
{
    public int Id { get; set; }
    
    public int PostId { get; set; }
    
    [Required]
    [MaxLength(255)]
    public string Key { get; set; } = string.Empty;
    
    public string Value { get; set; } = string.Empty;
    
    // Navigation properties
    public Post Post { get; set; } = null!;
}