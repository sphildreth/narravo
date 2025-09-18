using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Narravo.Core.Models;
using Narravo.Web.Services;

namespace Narravo.Web.Pages;

public class PostDetailModel : PageModel
{
    private readonly IPostService _postService;
    private readonly ILogger<PostDetailModel> _logger;

    public PostDetailModel(IPostService postService, ILogger<PostDetailModel> logger)
    {
        _postService = postService;
        _logger = logger;
    }

    public Post? Post { get; set; }

    public async Task<IActionResult> OnGetAsync(string slug)
    {
        if (string.IsNullOrEmpty(slug))
        {
            return NotFound();
        }

        try
        {
            Post = await _postService.GetPostBySlugAsync(slug);
            
            if (Post == null)
            {
                _logger.LogWarning("Post with slug '{Slug}' not found", slug);
                return NotFound();
            }

            return Page();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error loading post with slug '{Slug}'", slug);
            return NotFound();
        }
    }
}