using Narravo.Core.Models;

namespace Narravo.Core.Interfaces;

public interface ISearchIndex
{
    Task IndexPostAsync(Post post);
    Task RemovePostAsync(int postId);
    Task<IEnumerable<Post>> SearchAsync(string query, int skip = 0, int take = 10);
    Task RebuildIndexAsync();
}