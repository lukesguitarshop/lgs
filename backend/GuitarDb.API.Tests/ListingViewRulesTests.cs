using GuitarDb.API.Services;

namespace GuitarDb.API.Tests;

public class ListingViewRulesTests
{
    private static readonly DateTime Day = new(2026, 11, 23, 15, 0, 0, DateTimeKind.Utc);
    private const string Chrome =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
    private const string Iphone =
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";

    // ---- IsBot ----

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")]
    [InlineData("Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)")]
    [InlineData("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)")]
    [InlineData("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36")]
    [InlineData("Mozilla/5.0 (Linux; Android 11) Chrome-Lighthouse")]
    [InlineData("Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)")]
    [InlineData("WhatsApp/2.23.20 A")]
    [InlineData("curl/8.4.0")]
    [InlineData("python-requests/2.31.0")]
    [InlineData("Mozilla/5.0 AppleWebKit/537.36 (compatible; AhrefsSiteAudit/6.1; +http://ahrefs.com/robot/site-audit)")]
    [InlineData("Mozilla/5.0 (compatible; YandexSpider/3.0)")]
    public void IsBot_true_for_missing_and_automated_agents(string? userAgent)
    {
        Assert.True(ListingViewRules.IsBot(userAgent));
    }

    [Theory]
    [InlineData(Chrome)]
    [InlineData(Iphone)]
    [InlineData("Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0")]
    public void IsBot_false_for_real_browsers(string userAgent)
    {
        Assert.False(ListingViewRules.IsBot(userAgent));
    }

    // ---- VisitorKey ----

    [Fact]
    public void VisitorKey_is_stable_for_the_same_visitor_on_the_same_day()
    {
        var morning = ListingViewRules.VisitorKey("203.0.113.7", Chrome, "salt", Day.Date.AddHours(1));
        var evening = ListingViewRules.VisitorKey("203.0.113.7", Chrome, "salt", Day.Date.AddHours(23));

        Assert.Equal(morning, evening);
    }

    [Fact]
    public void VisitorKey_changes_the_next_day()
    {
        var today = ListingViewRules.VisitorKey("203.0.113.7", Chrome, "salt", Day);
        var tomorrow = ListingViewRules.VisitorKey("203.0.113.7", Chrome, "salt", Day.AddDays(1));

        Assert.NotEqual(today, tomorrow);
    }

    [Fact]
    public void VisitorKey_differs_by_ip_agent_and_salt()
    {
        var baseKey = ListingViewRules.VisitorKey("203.0.113.7", Chrome, "salt", Day);

        Assert.NotEqual(baseKey, ListingViewRules.VisitorKey("203.0.113.8", Chrome, "salt", Day));
        Assert.NotEqual(baseKey, ListingViewRules.VisitorKey("203.0.113.7", Iphone, "salt", Day));
        Assert.NotEqual(baseKey, ListingViewRules.VisitorKey("203.0.113.7", Chrome, "other", Day));
    }

    [Fact]
    public void VisitorKey_is_a_hash_that_does_not_contain_the_ip()
    {
        var key = ListingViewRules.VisitorKey("203.0.113.7", Chrome, "salt", Day);

        Assert.Equal(64, key.Length);
        Assert.Matches("^[0-9a-f]{64}$", key);
        Assert.DoesNotContain("203.0.113.7", key);
    }

    [Fact]
    public void VisitorKey_tolerates_missing_ip_and_agent()
    {
        var key = ListingViewRules.VisitorKey(null, null, "salt", Day);

        Assert.Equal(64, key.Length);
    }

    // ---- ClientIp ----

    [Fact]
    public void ClientIp_prefers_the_fly_header()
    {
        Assert.Equal("198.51.100.4", ListingViewRules.ClientIp("198.51.100.4", "203.0.113.7, 10.0.0.1", "10.0.0.2"));
    }

    [Fact]
    public void ClientIp_falls_back_to_the_first_forwarded_address()
    {
        Assert.Equal("203.0.113.7", ListingViewRules.ClientIp(null, " 203.0.113.7 , 10.0.0.1", "10.0.0.2"));
    }

    [Fact]
    public void ClientIp_falls_back_to_the_connection()
    {
        Assert.Equal("10.0.0.2", ListingViewRules.ClientIp("", "  ", "10.0.0.2"));
    }
}
