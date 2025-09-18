using Narravo.Core.Models;

namespace Narravo.Core.Interfaces;

public interface IAuthProviderMapper
{
    Task<User> MapUserAsync(string provider, string providerKey, string email, string displayName);
    Task<bool> IsValidProviderAsync(string provider);
    Task<string[]> GetUserRolesAsync(User user);
}