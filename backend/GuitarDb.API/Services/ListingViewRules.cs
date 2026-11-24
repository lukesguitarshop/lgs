using System.Security.Cryptography;
using System.Text;

namespace GuitarDb.API.Services;

/// <summary>
/// Decides which listing page views count, and how a visitor is told apart from the next
/// one. Pure, so the rules can be tested without a request or a database.
/// </summary>
public static class ListingViewRules
{
    // Substrings of user agents that load pages without a person looking at them:
    // crawlers, link-preview fetchers, uptime checks, audits and scripts.
    private static readonly string[] BotMarkers =
    {
        "bot", "crawl", "spider", "slurp", "headless", "lighthouse", "preview", "monitor",
        "facebookexternalhit", "whatsapp", "curl", "wget", "python-requests", "siteaudit",
        "pingdom", "uptime"
    };

    public static bool IsBot(string? userAgent)
    {
        if (string.IsNullOrWhiteSpace(userAgent)) return true;
        return BotMarkers.Any(marker => userAgent.Contains(marker, StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>
    /// A one-way key for "this visitor, today". The day is part of the hash, so the same
    /// person counts again tomorrow, and the salt keeps the key from being reversed into
    /// an IP address by anyone holding the database.
    /// </summary>
    public static string VisitorKey(string? ip, string? userAgent, string salt, DateTime utcNow)
    {
        var input = $"{salt}|{utcNow:yyyy-MM-dd}|{ip?.Trim()}|{userAgent?.Trim()}";
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(input))).ToLowerInvariant();
    }

    /// <summary>
    /// The visitor's address behind Fly's proxy: Fly's own header, then the first hop of
    /// X-Forwarded-For, then the socket (local development).
    /// </summary>
    public static string? ClientIp(string? flyClientIp, string? forwardedFor, string? connectionIp)
    {
        if (!string.IsNullOrWhiteSpace(flyClientIp)) return flyClientIp.Trim();

        var firstHop = forwardedFor?.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            .FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(firstHop)) return firstHop;

        return string.IsNullOrWhiteSpace(connectionIp) ? null : connectionIp.Trim();
    }
}
