using GuitarDb.API.Models;
using GuitarDb.API.Services;

namespace GuitarDb.API.Tests;

public class NewsletterTemplateTests
{
    private static readonly NewsletterBranding Branding = new(
        SiteUrl: "https://lukesguitarshop.com",
        ShopName: "Luke's Guitar Shop",
        MailingAddress: "123 Main St, Westerville, OH 43082");

    private static NewsletterGuitar Guitar(string id, string title, decimal price, decimal? original = null) =>
        new(id, title, "Excellent", price, original, $"https://img.example/{id}.jpg");

    private static NewsletterIssueContent Issue(
        IReadOnlyList<NewsletterGuitar>? inStock = null,
        IReadOnlyList<NewsletterGuitar>? onSale = null,
        IReadOnlyList<NewsletterGuitar>? sold = null,
        string? code = "STRUM-1126") =>
        new(
            inStock ?? new[] { Guitar("a1", "PRS Standard 24 2003", 1975m) },
            onSale ?? Array.Empty<NewsletterGuitar>(),
            code,
            5m,
            code == null ? null : new DateTime(2026, 12, 10, 15, 0, 0, DateTimeKind.Utc),
            sold ?? Array.Empty<NewsletterGuitar>());

    // ---- HTML ----

    [Fact]
    public void An_in_stock_guitar_is_shown_with_its_price_and_a_link_to_its_listing()
    {
        var html = NewsletterTemplate.RenderHtml(Issue(), Branding);

        Assert.Contains("PRS Standard 24 2003", html);
        Assert.Contains("$1,975", html);
        Assert.Contains("https://lukesguitarshop.com/listing/a1", html);
        Assert.Contains("https://img.example/a1.jpg", html);
    }

    [Fact]
    public void A_sale_guitar_shows_the_original_price_struck_through_beside_the_sale_price()
    {
        var html = NewsletterTemplate.RenderHtml(
            Issue(onSale: new[] { Guitar("s1", "Gibson Explorer", 1899m, original: 2199m) }), Branding);

        Assert.Contains("On sale", html);
        Assert.Contains("$1,899", html);
        Assert.Contains("line-through", html);
        Assert.Contains("$2,199", html);
    }

    [Fact]
    public void A_section_with_nothing_in_it_is_left_out()
    {
        var html = NewsletterTemplate.RenderHtml(Issue(), Branding);

        Assert.DoesNotContain("On sale", html);
        Assert.DoesNotContain("Recently sold", html);
    }

    [Fact]
    public void The_code_section_gives_the_code_the_percent_and_the_expiry_date()
    {
        var html = NewsletterTemplate.RenderHtml(Issue(), Branding);

        Assert.Contains("STRUM-1126", html);
        Assert.Contains("5% off", html);
        Assert.Contains("December 10, 2026", html);
    }

    [Fact]
    public void An_issue_without_a_code_has_no_code_section()
    {
        var html = NewsletterTemplate.RenderHtml(Issue(code: null), Branding);

        Assert.DoesNotContain("% off", html);
    }

    [Fact]
    public void Recently_sold_guitars_are_listed_when_there_are_some()
    {
        var html = NewsletterTemplate.RenderHtml(
            Issue(sold: new[] { Guitar("z9", "Fender Telecaster 1998", 1100m) }), Branding);

        Assert.Contains("Recently sold", html);
        Assert.Contains("Fender Telecaster 1998", html);
    }

    [Fact]
    public void The_footer_carries_the_mailing_address_and_the_unsubscribe_link()
    {
        var html = NewsletterTemplate.RenderHtml(Issue(), Branding);

        Assert.Contains("123 Main St, Westerville, OH 43082", html);
        Assert.Contains("href=\"{{{RESEND_UNSUBSCRIBE_URL}}}\"", html);
        Assert.Contains("Unsubscribe", html);
    }

    [Fact]
    public void Listing_titles_are_html_encoded()
    {
        var html = NewsletterTemplate.RenderHtml(
            Issue(inStock: new[] { Guitar("a1", "Fender <Strat> & Case", 900m) }), Branding);

        Assert.Contains("Fender &lt;Strat&gt; &amp; Case", html);
        Assert.DoesNotContain("<Strat>", html);
    }

    // ---- Plain text ----

    [Fact]
    public void The_plain_text_version_carries_the_guitars_the_code_and_the_unsubscribe_link()
    {
        var text = NewsletterTemplate.RenderText(
            Issue(onSale: new[] { Guitar("s1", "Gibson Explorer", 1899m, original: 2199m) }), Branding);

        Assert.Contains("PRS Standard 24 2003 - $1,975", text);
        Assert.Contains("https://lukesguitarshop.com/listing/a1", text);
        Assert.Contains("Gibson Explorer - $1,899 (was $2,199)", text);
        Assert.Contains("STRUM-1126", text);
        Assert.Contains("123 Main St, Westerville, OH 43082", text);
        Assert.Contains("{{{RESEND_UNSUBSCRIBE_URL}}}", text);
        Assert.DoesNotContain("<", text);
    }

    // ---- Choosing what goes in ----

    private static MyListing Listing(string id, decimal price, decimal? original = null, int daysOld = 0) => new()
    {
        Id = id,
        ListingTitle = $"Guitar {id}",
        Condition = "Excellent",
        Price = price,
        OriginalPrice = original,
        Images = new List<string> { $"https://img.example/{id}.jpg" },
        ListedAt = new DateTime(2026, 11, 20, 0, 0, 0, DateTimeKind.Utc).AddDays(-daysOld)
    };

    [Fact]
    public void In_stock_is_newest_first_and_capped_at_eight()
    {
        var available = Enumerable.Range(0, 12).Select(i => Listing($"g{i}", 1000m, daysOld: i)).Reverse().ToList();

        var content = NewsletterTemplate.BuildContent(available, new List<MyListing>(), null);

        Assert.Equal(8, content.InStock.Count);
        Assert.Equal("g0", content.InStock[0].Id);
        Assert.Equal("g7", content.InStock[7].Id);
    }

    [Fact]
    public void On_sale_is_only_the_guitars_marked_down_from_an_original_price()
    {
        var available = new List<MyListing>
        {
            Listing("full", 1000m),
            Listing("sale", 900m, original: 1100m),
            Listing("same", 900m, original: 900m)
        };

        var content = NewsletterTemplate.BuildContent(available, new List<MyListing>(), null);

        Assert.Equal(new[] { "sale" }, content.OnSale.Select(g => g.Id));
    }

    [Fact]
    public void Recently_sold_is_capped_at_six()
    {
        var sold = Enumerable.Range(0, 9).Select(i => Listing($"s{i}", 1000m)).ToList();

        var content = NewsletterTemplate.BuildContent(new List<MyListing> { Listing("g", 1m) }, sold, null);

        Assert.Equal(6, content.RecentlySold.Count);
    }

    [Fact]
    public void An_issue_with_nothing_in_stock_and_nothing_on_sale_is_not_worth_sending()
    {
        var empty = NewsletterTemplate.BuildContent(
            new List<MyListing>(), new List<MyListing> { Listing("s", 1m) }, null);
        var stocked = NewsletterTemplate.BuildContent(
            new List<MyListing> { Listing("g", 1m) }, new List<MyListing>(), null);

        Assert.False(NewsletterTemplate.ShouldSend(empty));
        Assert.True(NewsletterTemplate.ShouldSend(stocked));
    }
}
