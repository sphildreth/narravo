namespace Narravo.Core.Interfaces;

public interface IFileStore
{
    Task<string> SaveFileAsync(Stream stream, string fileName, string? subPath = null);
    Task<Stream> GetFileAsync(string path);
    Task<bool> DeleteFileAsync(string path);
    Task<bool> FileExistsAsync(string path);
    Task<long> GetFileSizeAsync(string path);
}