using System.Globalization;
using System.Net;
using System.Text;
using GuitarDb.API.Models;

namespace GuitarDb.API.Services;

public record NewsletterGuitar(
    string Id, string Title, string? Condition, decimal Price, decimal? OriginalPrice, string? Image);

/// <summary>Everything one issue shows. A null code means the issue has no code section.</summary>
public record NewsletterIssueContent(
    IReadOnlyList<NewsletterGuitar> InStock,
    IReadOnlyList<NewsletterGuitar> OnSale,
    string? DiscountCode,
    decimal DiscountPercent,
    DateTime? DiscountExpiresAt,
    IReadOnlyList<NewsletterGuitar> RecentlySold);

public record NewsletterBranding(string SiteUrl, string ShopName, string MailingAddress);

/// <summary>
/// Builds a newsletter issue from listings and renders it as HTML and plain text.
/// Pure: no database, no clock, no network, so the preview, the test send and the
/// real broadcast all come out of exactly the same code.
/// </summary>
public static class NewsletterTemplate
{
    public const int MaxInStock = 8;
    public const int MaxRecentlySold = 6;

    /// <summary>Resend swaps this for each recipient's own one-click unsubscribe link.</summary>
    public const string UnsubscribeUrl = "{{{RESEND_UNSUBSCRIBE_URL}}}";

    // Brand palette and type, mirrored from EmailService so both kinds of mail match the site.
    private const string Oxblood = "#6E0114";
    private const string Cream = "#FFFFF3";
    private const string Ink = "#020E1C";
    private const string Paper = "#f2f0e3";
    private const string Rule = "#E4E4D7";
    private const string Muted = "#5A5F66";
    private const string HeadingFont = "Anton, Impact, 'Arial Narrow Bold', sans-serif";
    private const string BodyFont = "Archivo, Arial, Helvetica, sans-serif";
    private const string MonoFont = "'JetBrains Mono', Consolas, 'Courier New', monospace";

    private static readonly CultureInfo Us = CultureInfo.GetCultureInfo("en-US");

    // ---------------- Choosing what goes in ----------------

    /// <param name="available">Guitars that can be bought right now.</param>
    /// <param name="recentlySold">Guitars sold since the last issue, newest first.</param>
    /// <param name="code">This issue's discount code, or null for none.</param>
    public static NewsletterIssueContent BuildContent(
        IEnumerable<MyListing> available, IEnumerable<MyListing> recentlySold, DiscountCode? code)
    {
        var newestFirst = available
            .OrderByDescending(l => l.ListedAt ?? l.ScrapedAt)
            .ToList();

        return new NewsletterIssueContent(
            newestFirst.Take(MaxInStock).Select(ToGuitar).ToList(),
            newestFirst.Where(l => l.OriginalPrice.HasValue && l.OriginalPrice.Value > l.Price).Select(ToGuitar).ToList(),
            code?.Code,
            code?.PercentOff ?? 0m,
            code?.ExpiresAt,
            recentlySold.Take(MaxRecentlySold).Select(ToGuitar).ToList());
    }

    /// <summary>An issue with nothing to buy is skipped rather than sent.</summary>
    public static bool ShouldSend(NewsletterIssueContent content) =>
        content.InStock.Count > 0 || content.OnSale.Count > 0;

    public static string Subject(NewsletterIssueContent content)
    {
        var parts = new List<string>();
        if (content.InStock.Count > 0)
            parts.Add($"{content.InStock.Count} guitar{(content.InStock.Count == 1 ? "" : "s")} in stock");
        if (content.OnSale.Count > 0)
            parts.Add($"{content.OnSale.Count} on sale");
        if (content.DiscountCode != null)
            parts.Add($"{content.DiscountPercent:0.##}% off inside");
        return parts.Count == 0 ? "News from the shop" : string.Join(", ", parts);
    }

    private static NewsletterGuitar ToGuitar(MyListing l) => new(
        l.Id ?? "",
        l.ListingTitle,
        l.Condition,
        l.Price,
        l.OriginalPrice,
        l.Images.FirstOrDefault(i => !string.IsNullOrWhiteSpace(i)));

    // ---------------- HTML ----------------

    public static string RenderHtml(NewsletterIssueContent content, NewsletterBranding branding)
    {
        var site = branding.SiteUrl.TrimEnd('/');
        var body = new StringBuilder();

        if (content.InStock.Count > 0)
        {
            body.Append(SectionHeading("New and in stock", "The latest guitars on the wall"));
            body.Append(GuitarGrid(content.InStock, site, sold: false));
            body.Append(Button($"{site}/", "See everything in stock"));
        }

        if (content.OnSale.Count > 0)
        {
            body.Append(SectionHeading("On sale", "Marked down right now"));
            body.Append(GuitarGrid(content.OnSale, site, sold: false));
        }

        if (content.DiscountCode != null)
        {
            body.Append(CodeBlock(content));
        }

        if (content.RecentlySold.Count > 0)
        {
            body.Append(SectionHeading("Recently sold", "Gone to new homes"));
            body.Append(GuitarGrid(content.RecentlySold, site, sold: true));
        }

        var shop = WebUtility.HtmlEncode(branding.ShopName);
        var address = WebUtility.HtmlEncode(branding.MailingAddress);

        return $@"<!DOCTYPE html>
<html>
<head>
<meta charset=""utf-8"">
<meta name=""viewport"" content=""width=device-width, initial-scale=1"">
<title>{WebUtility.HtmlEncode(Subject(content))}</title>
<link href=""https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@400;600;700&family=JetBrains+Mono:wght@500&display=swap"" rel=""stylesheet"">
</head>
<body style=""margin: 0; padding: 0; background-color: {Paper};"">
<table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"" border=""0"" style=""background-color: {Paper};"">
<tr><td align=""center"" style=""padding: 24px 12px;"">
<table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"" border=""0"" style=""max-width: 600px; background-color: {Cream}; border: 1px solid {Rule}; border-top: 4px solid {Oxblood};"">
<tr><td style=""padding: 24px; border-bottom: 1px solid {Rule};""><a href=""{site}"" style=""text-decoration: none;""><img src=""{site}/images/logo-transparent.png"" width=""180"" alt=""{shop}"" style=""display: block; width: 180px; max-width: 100%; height: auto; border: 0; font-family: {HeadingFont}; font-size: 24px; text-transform: uppercase; color: {Oxblood};""></a></td></tr>
<tr><td style=""padding: 8px 24px 32px; font-family: {BodyFont}; font-size: 15px; line-height: 1.55; color: {Ink};"">
{body}
</td></tr>
<tr><td style=""padding: 20px 24px; border-top: 1px solid {Rule}; font-family: {BodyFont}; font-size: 12px; line-height: 1.6; color: {Muted};"">
<span style=""font-family: {MonoFont}; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;"">{shop}</span><br>
{address}<br>
You are getting this because you opted in to the shop newsletter on your account.
<a href=""{UnsubscribeUrl}"" style=""color: {Muted}; text-decoration: underline;"">Unsubscribe</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>";
    }

    private static string SectionHeading(string title, string kicker) => $@"
<p style=""margin: 28px 0 4px; font-family: {MonoFont}; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: {Oxblood};"">{kicker}</p>
<h2 style=""margin: 0 0 16px; font-family: {HeadingFont}; font-weight: 400; font-size: 30px; line-height: 1.05; text-transform: uppercase; color: {Ink};"">{title}</h2>";

    private static string Button(string href, string label) => $@"
<p style=""margin: 8px 0 0;""><a href=""{href}"" style=""display: inline-block; background-color: {Oxblood}; color: {Cream}; padding: 14px 26px; text-decoration: none; font-family: {MonoFont}; font-size: 13px; letter-spacing: 0.14em; text-transform: uppercase;"">{label}</a></p>";

    /// <summary>Two guitars to a row, in a table so every mail client lays it out the same.</summary>
    private static string GuitarGrid(IReadOnlyList<NewsletterGuitar> guitars, string site, bool sold)
    {
        var html = new StringBuilder();
        html.Append(@"<table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"" border=""0"">");

        for (var i = 0; i < guitars.Count; i += 2)
        {
            html.Append("<tr>");
            html.Append(GuitarCell(guitars[i], site, sold, left: true));
            html.Append(i + 1 < guitars.Count
                ? GuitarCell(guitars[i + 1], site, sold, left: false)
                : @"<td width=""50%"" style=""width: 50%;"">&nbsp;</td>");
            html.Append("</tr>");
        }

        html.Append("</table>");
        return html.ToString();
    }

    private static string GuitarCell(NewsletterGuitar guitar, string site, bool sold, bool left)
    {
        var url = $"{site}/listing/{guitar.Id}";
        var title = WebUtility.HtmlEncode(guitar.Title);
        var padding = left ? "0 8px 20px 0" : "0 0 20px 8px";

        var image = string.IsNullOrWhiteSpace(guitar.Image)
            ? ""
            : $@"<a href=""{url}"" style=""text-decoration: none;""><img src=""{WebUtility.HtmlEncode(guitar.Image)}"" width=""268"" alt=""{title}"" style=""display: block; width: 100%; max-width: 268px; height: auto; border: 1px solid {Rule};""></a>";

        string priceLine;
        if (sold)
        {
            priceLine = $@"<span style=""font-family: {MonoFont}; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: {Muted};"">Sold</span>";
        }
        else if (guitar.OriginalPrice.HasValue && guitar.OriginalPrice.Value > guitar.Price)
        {
            priceLine = $@"<span style=""font-weight: 700; color: {Oxblood};"">{Money(guitar.Price)}</span> <span style=""color: {Muted}; text-decoration: line-through;"">{Money(guitar.OriginalPrice.Value)}</span>";
        }
        else
        {
            priceLine = $@"<span style=""font-weight: 700; color: {Ink};"">{Money(guitar.Price)}</span>";
        }

        var condition = sold || string.IsNullOrWhiteSpace(guitar.Condition)
            ? ""
            : $@"<br><span style=""font-family: {MonoFont}; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: {Muted};"">{WebUtility.HtmlEncode(guitar.Condition)}</span>";

        return $@"<td width=""50%"" valign=""top"" style=""width: 50%; padding: {padding}; font-family: {BodyFont}; font-size: 14px; line-height: 1.4; color: {Ink};"">
{image}
<p style=""margin: 10px 0 4px;""><a href=""{url}"" style=""color: {Ink}; font-weight: 600; text-decoration: none;"">{title}</a></p>
<p style=""margin: 0;"">{priceLine}{condition}</p>
</td>";
    }

    private static string CodeBlock(NewsletterIssueContent content)
    {
        var expiry = content.DiscountExpiresAt.HasValue
            ? $" Good through {ExpiryDate(content.DiscountExpiresAt.Value)}."
            : "";

        return $@"
<table role=""presentation"" width=""100%"" cellpadding=""0"" cellspacing=""0"" border=""0"" style=""margin: 32px 0 4px;"">
<tr><td align=""center"" style=""background-color: {Oxblood}; padding: 28px 20px; font-family: {BodyFont}; color: {Cream};"">
<p style=""margin: 0 0 6px; font-family: {MonoFont}; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;"">Your subscriber code</p>
<p style=""margin: 0 0 14px; font-family: {HeadingFont}; font-size: 34px; line-height: 1.05; text-transform: uppercase;"">{content.DiscountPercent:0.##}% off any guitar</p>
<p style=""margin: 0 0 14px;""><span style=""display: inline-block; background-color: {Cream}; color: {Ink}; padding: 12px 22px; font-family: {MonoFont}; font-size: 20px; letter-spacing: 0.14em;"">{WebUtility.HtmlEncode(content.DiscountCode)}</span></p>
<p style=""margin: 0; font-size: 13px; line-height: 1.5;"">Enter it at checkout. Works on sale guitars too, once per account.{expiry}</p>
</td></tr>
</table>";
    }

    // ---------------- Plain text ----------------

    public static string RenderText(NewsletterIssueContent content, NewsletterBranding branding)
    {
        var site = branding.SiteUrl.TrimEnd('/');
        var text = new StringBuilder();
        text.AppendLine(branding.ShopName.ToUpperInvariant());
        text.AppendLine();

        void Section(string title, IReadOnlyList<NewsletterGuitar> guitars, bool sold)
        {
            if (guitars.Count == 0) return;
            text.AppendLine(title.ToUpperInvariant());
            foreach (var g in guitars)
            {
                if (sold)
                {
                    text.AppendLine($"- {g.Title}");
                    continue;
                }

                var was = g.OriginalPrice.HasValue && g.OriginalPrice.Value > g.Price
                    ? $" (was {Money(g.OriginalPrice.Value)})"
                    : "";
                text.AppendLine($"- {g.Title} - {Money(g.Price)}{was}");
                text.AppendLine($"  {site}/listing/{g.Id}");
            }
            text.AppendLine();
        }

        Section("New and in stock", content.InStock, sold: false);
        Section("On sale", content.OnSale, sold: false);

        if (content.DiscountCode != null)
        {
            text.AppendLine($"YOUR SUBSCRIBER CODE: {content.DiscountCode}");
            var expiry = content.DiscountExpiresAt.HasValue
                ? $" Good through {ExpiryDate(content.DiscountExpiresAt.Value)}."
                : "";
            text.AppendLine(
                $"{content.DiscountPercent:0.##}% off any guitar. Enter it at checkout. Works on sale guitars too, once per account.{expiry}");
            text.AppendLine();
        }

        Section("Recently sold", content.RecentlySold, sold: true);

        text.AppendLine("--");
        text.AppendLine(branding.ShopName);
        text.AppendLine(branding.MailingAddress);
        text.AppendLine("You are getting this because you opted in to the shop newsletter on your account.");
        text.AppendLine($"Unsubscribe: {UnsubscribeUrl}");
        return text.ToString();
    }

    // ---------------- Formatting ----------------

    /// <summary>Whole dollars when there are no cents, as the site shows prices.</summary>
    private static string Money(decimal amount) =>
        amount == Math.Truncate(amount)
            ? amount.ToString("$#,##0", Us)
            : amount.ToString("$#,##0.00", Us);

    /// <summary>The expiry as a shop-local (Eastern) calendar date.</summary>
    private static string ExpiryDate(DateTime utc)
    {
        var local = utc;
        try
        {
            local = TimeZoneInfo.ConvertTimeFromUtc(
                DateTime.SpecifyKind(utc, DateTimeKind.Utc),
                TimeZoneInfo.FindSystemTimeZoneById("America/New_York"));
        }
        catch (TimeZoneNotFoundException)
        {
            // Fall back to the UTC date rather than fail to render an issue.
        }

        return local.ToString("MMMM d, yyyy", Us);
    }
}
