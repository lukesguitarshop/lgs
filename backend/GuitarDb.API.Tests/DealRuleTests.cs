using GuitarDb.API.Models;
using GuitarDb.API.Services;

namespace GuitarDb.API.Tests;

public class DealRuleTests
{
    private static ProductPrice Product(decimal? median = 2000, int sales = 12, bool broad = false) => new()
    {
        ProductId = "104712",
        Title = "Gibson Les Paul Standard '50s P-90",
        WebUrl = "https://reverb.com/p/x",
        Median = median,
        SaleCount = sales,
        WindowMonths = 6,
        IsBroad = broad,
        UsedLowPrice = 1700,
        NewLowPrice = 2600,
    };

    private static PotentialBuy Buy(decimal delivered) => new() { Price = delivered, TotalPrice = delivered };

    private static SoldPriceResult Match(ProductPrice? product, string source = MatchSources.ListingLink, bool strong = false, bool stale = false) =>
        new() { Product = product, MatchSource = source, StrongTextMatch = strong, Stale = stale };

    [Fact]
    public void At_or_under_80_percent_of_median_is_a_deal()
    {
        var buy = Buy(1600);
        SoldPriceService.Apply(buy, Match(Product()), canShip: true, thresholdPercent: 80);

        Assert.True(buy.IsDeal);
        Assert.True(buy.HasPriceGuide);
        Assert.Equal(20m, buy.DiscountPercent);
        Assert.Equal(2000m, buy.SoldMedian);
        Assert.Equal(1700m, buy.PriceGuideLow);
        Assert.Equal("104712", buy.ProductId);
    }

    [Fact]
    public void Over_80_percent_is_priced_but_not_a_deal()
    {
        var buy = Buy(1601);
        SoldPriceService.Apply(buy, Match(Product()), canShip: true, thresholdPercent: 80);

        Assert.False(buy.IsDeal);
        Assert.True(buy.PriceReliable);
    }

    [Fact]
    public void Not_shipping_to_us_is_never_a_deal()
    {
        var buy = Buy(1000);
        SoldPriceService.Apply(buy, Match(Product()), canShip: false, thresholdPercent: 80);

        Assert.False(buy.IsDeal);
    }

    [Theory]
    [InlineData(MatchSources.TextSearch, false, 12, false, false, UnreliableReasons.TextMatch)]
    [InlineData(MatchSources.ListingLink, false, 4, false, false, UnreliableReasons.FewSales)]
    [InlineData(MatchSources.Alias, false, 12, true, false, UnreliableReasons.BroadProduct)]
    [InlineData(MatchSources.Manual, false, 12, false, true, UnreliableReasons.Stale)]
    public void Untrusted_prices_show_but_are_never_deals(string source, bool strong, int sales, bool broad, bool stale, string reason)
    {
        var buy = Buy(1000);
        SoldPriceService.Apply(buy, Match(Product(sales: sales, broad: broad), source, strong, stale), canShip: true, thresholdPercent: 80);

        Assert.False(buy.IsDeal);
        Assert.False(buy.HasPriceGuide);
        Assert.Equal(reason, buy.UnreliableReason);
        Assert.Equal(2000m, buy.SoldMedian);
    }

    [Fact]
    public void Strong_text_match_is_trusted()
    {
        var buy = Buy(1000);
        SoldPriceService.Apply(buy, Match(Product(), MatchSources.TextSearch, strong: true), canShip: true, thresholdPercent: 80);

        Assert.True(buy.IsDeal);
        Assert.Null(buy.UnreliableReason);
    }

    [Fact]
    public void Median_over_budget_is_not_a_deal()
    {
        var buy = Buy(2000);
        SoldPriceService.Apply(buy, Match(Product(median: 4000)), canShip: true, thresholdPercent: 80);

        Assert.False(buy.IsDeal);
    }

    [Fact]
    public void No_product_clears_earlier_pricing()
    {
        var buy = Buy(1000);
        SoldPriceService.Apply(buy, Match(Product()), canShip: true, thresholdPercent: 80);
        SoldPriceService.Apply(buy, new SoldPriceResult(), canShip: true, thresholdPercent: 80);

        Assert.Null(buy.ProductId);
        Assert.Null(buy.SoldMedian);
        Assert.False(buy.IsDeal);
        Assert.False(buy.HasPriceGuide);
    }

    [Fact]
    public void Product_with_no_sales_is_few_sales()
    {
        var buy = Buy(1000);
        SoldPriceService.Apply(buy, Match(Product(median: null, sales: 0)), canShip: true, thresholdPercent: 80);

        Assert.Equal(UnreliableReasons.FewSales, buy.UnreliableReason);
        Assert.Null(buy.DiscountPercent);
    }

    [Theory]
    [InlineData("Player II Stratocaster", "Fender Player II Stratocaster", true)]
    [InlineData("Player II Stratocaster - Black", "Fender Player II Stratocaster", true)]
    [InlineData("Player II Stratocaster HSS w/ upgraded pickups and locking tuners", "Fender Player II Stratocaster", false)]
    [InlineData("Player II Stratocaster", "Fender Player II Stratocaster Left-Handed", false)]
    [InlineData("American Standard", "Fender American Standard Stratocaster 1986 - 2000", false)]
    public void Strong_match_needs_the_names_to_agree(string model, string productTitle, bool strong)
    {
        Assert.Equal(strong, ProductMatcher.IsStrongMatch(model, null, new ProductCandidate("1", productTitle, "Fender"), "Fender"));
    }
}
