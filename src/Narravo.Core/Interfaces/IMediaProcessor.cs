namespace Narravo.Core.Interfaces;

public interface IMediaProcessor
{
    Task<string?> GenerateVideoPosterAsync(string videoPath);
    Task<(int width, int height)?> GetImageDimensionsAsync(string imagePath);
    Task<int?> GetVideoDurationAsync(string videoPath);
    Task<string> OptimizeImageAsync(string imagePath, int maxWidth = 1920);
}