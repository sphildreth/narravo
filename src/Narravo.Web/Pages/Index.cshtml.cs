using Microsoft.AspNetCore.Mvc.RazorPages;
using Narravo.Core.Models;
using Narravo.Web.Services;

namespace Narravo.Web.Pages;

public class IndexModel : PageModel
{
    private readonly ILogger<IndexModel> _logger;
    private readonly IPostService _postService;

    public IndexModel(ILogger<IndexModel> logger, IPostService postService)
    {
        _logger = logger;
        _postService = postService;
    }

    public IEnumerable<Post> RecentPosts { get; set; } = new List<Post>();

    public async Task OnGetAsync()
    {
        _logger.LogInformation("Home page accessed");
        
        try
        {
            RecentPosts = await _postService.GetPublishedPostsAsync(0, 5);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error loading recent posts");
            RecentPosts = new List<Post>();
        }
    }
}