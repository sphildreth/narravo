namespace Narravo.Core.Models;

public class PostTerm
{
    public int PostId { get; set; }
    public int TermId { get; set; }
    
    // Navigation properties
    public Post Post { get; set; } = null!;
    public Term Term { get; set; } = null!;
}