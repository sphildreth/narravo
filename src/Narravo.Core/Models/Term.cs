using System.ComponentModel.DataAnnotations;
using Narravo.Core.Enums;

namespace Narravo.Core.Models;

public class Term
{
    public int Id { get; set; }
    
    [Required]
    [MaxLength(255)]
    public string Name { get; set; } = string.Empty;
    
    [Required]
    [MaxLength(255)]
    public string Slug { get; set; } = string.Empty;
    
    public TermType Type { get; set; }
    
    [MaxLength(1000)]
    public string Description { get; set; } = string.Empty;
    
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
    
    // Navigation properties
    public ICollection<PostTerm> PostTerms { get; set; } = new List<PostTerm>();
}