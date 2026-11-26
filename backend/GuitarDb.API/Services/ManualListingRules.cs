using System.Net;

namespace GuitarDb.API.Services;

/// <summary>
/// Rules for a listing typed in by hand in admin, as opposed to one the Reverb scraper
/// brought over.
/// </summary>
public static class ManualListingRules
{
    public const int MaxTitleLength = 200;
    public const int MaxDescriptionLength = 20000;
    public const int MaxPhotos = 25;
    public const long MaxPhotoBytes = 10 * 1024 * 1024;

    /// <summary>
    /// Reverb's condition names, since that is what every scraped listing carries and what
    /// the shop's condition filter and the marketplace exports key on.
    /// </summary>
    public static readonly string[] Conditions =
        { "Brand New", "Mint", "Excellent", "Very Good", "Good", "Fair", "Poor" };

    public static readonly string[] PhotoContentTypes =
        { "image/jpeg", "image/png", "image/gif", "image/webp" };

    /// <summary>
    /// Listing descriptions are stored and rendered as HTML (they come from Reverb that
    /// way). Turns typed text into the same shape: a paragraph per blank-line-separated
    /// block, a line break per newline, everything else escaped.
    /// </summary>
    public static string? DescriptionToHtml(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;

        var paragraphs = text.Replace("\r\n", "\n").Replace('\r', '\n')
            .Split("\n\n", StringSplitOptions.RemoveEmptyEntries)
            .Select(block => block.Trim('\n', ' ', '\t'))
            .Where(block => block.Length > 0)
            .Select(block => "<p>" + string.Join("<br>",
                block.Split('\n').Select(line => WebUtility.HtmlEncode(line.Trim()))) + "</p>");

        var html = string.Concat(paragraphs);
        return html.Length == 0 ? null : html;
    }
}
