using Narravo.Core.Interfaces;

namespace Narravo.Web.Services;

public class LocalFileStore : IFileStore
{
    private readonly string _basePath;
    private readonly ILogger<LocalFileStore> _logger;

    public LocalFileStore(IConfiguration configuration, ILogger<LocalFileStore> logger)
    {
        _basePath = configuration["Narravo:DataPath"] ?? "./data";
        _logger = logger;
        
        // Ensure the base directory exists
        Directory.CreateDirectory(_basePath);
    }

    public async Task<string> SaveFileAsync(Stream stream, string fileName, string? subPath = null)
    {
        var fullPath = GetFullPath(fileName, subPath);
        var directory = Path.GetDirectoryName(fullPath);
        
        if (!string.IsNullOrEmpty(directory))
        {
            Directory.CreateDirectory(directory);
        }

        using var fileStream = new FileStream(fullPath, FileMode.Create);
        await stream.CopyToAsync(fileStream);
        
        _logger.LogInformation("Saved file to {FilePath}", fullPath);
        return GetRelativePath(fullPath);
    }

    public async Task<Stream> GetFileAsync(string path)
    {
        var fullPath = GetFullPath(path);
        
        if (!File.Exists(fullPath))
        {
            throw new FileNotFoundException($"File not found: {path}");
        }

        return await Task.FromResult(new FileStream(fullPath, FileMode.Open, FileAccess.Read));
    }

    public async Task<bool> DeleteFileAsync(string path)
    {
        var fullPath = GetFullPath(path);
        
        if (File.Exists(fullPath))
        {
            File.Delete(fullPath);
            _logger.LogInformation("Deleted file {FilePath}", fullPath);
            return await Task.FromResult(true);
        }

        return await Task.FromResult(false);
    }

    public async Task<bool> FileExistsAsync(string path)
    {
        var fullPath = GetFullPath(path);
        return await Task.FromResult(File.Exists(fullPath));
    }

    public async Task<long> GetFileSizeAsync(string path)
    {
        var fullPath = GetFullPath(path);
        
        if (!File.Exists(fullPath))
        {
            throw new FileNotFoundException($"File not found: {path}");
        }

        var fileInfo = new FileInfo(fullPath);
        return await Task.FromResult(fileInfo.Length);
    }

    private string GetFullPath(string fileName, string? subPath = null)
    {
        if (subPath != null)
        {
            return Path.Combine(_basePath, subPath, fileName);
        }
        
        return Path.Combine(_basePath, fileName);
    }

    private string GetRelativePath(string fullPath)
    {
        return Path.GetRelativePath(_basePath, fullPath);
    }
}