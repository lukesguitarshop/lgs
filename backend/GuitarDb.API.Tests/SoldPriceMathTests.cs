using GuitarDb.API.Models;
using GuitarDb.API.Services;

namespace GuitarDb.API.Tests;

public class SoldPriceMathTests
{
    private static readonly DateTime Now = new(2026, 11, 5, 12, 0, 0, DateTimeKind.Utc);

    private static ProductSale Sale(int monthsAgo, decimal amount) =>
        new() { SoldAt = Now.AddMonths(-monthsAgo).AddDays(1), Amount = amount };

    [Fact]
    public void Uses_six_months_when_it_has_enough_sales()
    {
        var sales = new[] { Sale(1, 1000), Sale(2, 1200), Sale(3, 1100), Sale(4, 1300), Sale(5, 900), Sale(10, 5000) };

        var stats = SoldPriceMath.Compute(sales, Now);

        Assert.Equal(6, stats.WindowMonths);
        Assert.Equal(5, stats.SaleCount);
        Assert.Equal(1100m, stats.Median);
        Assert.Equal(900m, stats.Low);
        Assert.Equal(1300m, stats.High);
    }

    [Fact]
    public void Widens_to_twelve_then_twentyfour_months_when_short()
    {
        var twelve = new[] { Sale(1, 1000), Sale(2, 1000), Sale(8, 2000), Sale(9, 2000), Sale(11, 2000) };
        Assert.Equal(12, SoldPriceMath.Compute(twelve, Now).WindowMonths);

        var twentyFour = new[] { Sale(1, 1000), Sale(14, 1000), Sale(15, 2000), Sale(20, 2000), Sale(23, 2000) };
        var stats = SoldPriceMath.Compute(twentyFour, Now);
        Assert.Equal(24, stats.WindowMonths);
        Assert.Equal(2000m, stats.Median);
    }

    [Fact]
    public void Too_few_sales_reports_the_24_month_count()
    {
        var stats = SoldPriceMath.Compute(new[] { Sale(1, 1000), Sale(13, 1400) }, Now);

        Assert.Equal(24, stats.WindowMonths);
        Assert.Equal(2, stats.SaleCount);
        Assert.Equal(1200m, stats.Median);
    }

    [Fact]
    public void No_sales_has_no_median()
    {
        var stats = SoldPriceMath.Compute(Array.Empty<ProductSale>(), Now);

        Assert.Null(stats.Median);
        Assert.Equal(0, stats.SaleCount);
    }

    [Fact]
    public void Even_count_median_averages_the_middle_two()
    {
        Assert.Equal(1150m, SoldPriceMath.Median(new[] { 1000m, 1100m, 1200m, 1300m }));
    }

    [Theory]
    [InlineData("Fender Stratocaster", "Fender", true)]
    [InlineData("Gibson SG (1961 - Present)", "Gibson", true)]
    [InlineData("Gibson Les Paul", "Gibson", true)]
    [InlineData("Fender Jazz Bass", "Fender", true)]
    [InlineData("Gibson Les Paul Junior (2019 - Present)", "Gibson", false)]
    [InlineData("Gibson Les Paul Studio 1998 - 2011", "Gibson", false)]
    [InlineData("Fender American Standard Stratocaster 1986 - 2000", "Fender", false)]
    public void Single_word_products_are_broad(string title, string brand, bool broad)
    {
        Assert.Equal(broad, SoldPriceMath.IsBroad(title, brand));
    }

    [Fact]
    public void Override_key_normalizes_case_punctuation_and_spacing()
    {
        Assert.Equal("gibson|les paul standard 50s", SoldPriceMath.OverrideKey("Gibson", "  Les Paul Standard '50s "));
        Assert.Equal(SoldPriceMath.OverrideKey("FENDER", "Player II  Stratocaster"), SoldPriceMath.OverrideKey("fender", "player ii stratocaster"));
        Assert.Null(SoldPriceMath.OverrideKey("Fender", " "));
    }

    [Theory]
    [InlineData("https://reverb.com/p/gibson-les-paul-standard-50s-p-90-2019-present", "gibson-les-paul-standard-50s-p-90-2019-present")]
    [InlineData("reverb.com/p/fender-brent-mason-signature-telecaster?condition=used", "fender-brent-mason-signature-telecaster")]
    [InlineData("https://www.reverb.com/p/Fender-Player-II-Stratocaster#reviews", "fender-player-ii-stratocaster")]
    [InlineData("fender-player-ii-stratocaster", "fender-player-ii-stratocaster")]
    [InlineData("https://reverb.com/item/12345-some-guitar", null)]
    [InlineData("not a link", null)]
    [InlineData("", null)]
    public void Parses_product_slug_from_links(string input, string? expected)
    {
        Assert.Equal(expected, SoldPriceMath.ParseProductSlug(input));
    }
}
