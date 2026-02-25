namespace GuitarDb.API.Helpers;

public static class UrlHelper
{
    /// <summary>
    /// Normalizes a Reverb link URL to ensure consistent format:
    /// - Enforces https scheme
    /// - Removes trailing slashes
    /// - Trims whitespace
    /// </summary>
    public static string? NormalizeReverbLink(string? url)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            return null;
        }

        var normalized = url.Trim();

        // Enforce https
        if (normalized.StartsWith("http://", StringComparison.OrdinalIgnoreCase))
        {
            normalized = "https://" + normalized.Substring(7);
        }

        // Remove trailing slashes
        normalized = normalized.TrimEnd('/');

        return normalized;
    }
}
