using GuitarDb.API.Services;

namespace GuitarDb.API.Tests;

public class ProductMatcherTests
{
    [Theory]
    [InlineData("Artist Series Limited Edition Brent Mason Telecaster", "Fender", "Brent Mason Telecaster")]
    [InlineData("Fender American Standard Black 1997", "Fender", "American Standard")]
    [InlineData("0262311506", "Fender", "")]
    [InlineData("ST62-53 1993-1994 MADE IN JAPAN 3.575kg #Q005966", "Fender", "ST62-53 JAPAN")]
    [InlineData("OMC-15E", "Martin", "OMC-15E")]
    [InlineData("RG7620-BK Standard", "Ibanez", "RG7620-BK Standard")]
    [InlineData("RGIX27FESM-FSL Iron Label", "Ibanez", "RGIX27FESM-FSL Iron Label")]
    [InlineData("Fender JV Modified '50s Stratocaster HSS, 2-Tone Sunburst (Pre-Owned)", "Fender", "JV Modified '50s Stratocaster HSS")]
    [InlineData("Les Paul Standard '50s P-90", "Gibson", "Les Paul Standard '50s P-90")]
    public void Clean_strips_seller_filler(string text, string make, string expected)
    {
        Assert.Equal(expected, ProductMatcher.Clean(text, make));
    }

    [Fact]
    public void Queries_go_from_literal_to_cleaned_without_duplicates()
    {
        var queries = ProductMatcher.BuildQueries("Fender", "Artist Series Limited Edition Brent Mason Telecaster",
            "Fender Artist Series Limited Edition Brent Mason Telecaster 2008 - Sunburst");

        Assert.Equal(new[]
        {
            "Fender Artist Series Limited Edition Brent Mason Telecaster",
            "Fender Brent Mason Telecaster",
            "Fender Brent Mason",
        }, queries);
    }

    [Fact]
    public void Queries_skip_models_that_clean_to_nothing()
    {
        var queries = ProductMatcher.BuildQueries("Fender", "0262311506", "Fender 0262311506 Telecaster Custom");

        Assert.Equal(new[] { "Fender 0262311506", "Fender Telecaster Custom" }, queries);
    }

    [Fact]
    public void Picks_the_signature_model_over_the_custom_shop_relic()
    {
        var best = ProductMatcher.PickBest(
            "Artist Series Limited Edition Brent Mason Telecaster Fender Artist Series Limited Edition Brent Mason Telecaster",
            2008, "Fender", new[]
            {
                new ProductCandidate("133355", "Fender Custom Shop Brent Mason Signature Telecaster Relic", "Fender"),
                new ProductCandidate("125055", "Fender Brent Mason Signature Telecaster", "Fender"),
            });

        Assert.Equal("125055", best?.Id);
    }

    [Fact]
    public void Year_inside_the_product_range_wins()
    {
        var best = ProductMatcher.PickBest("American Standard Stratocaster", 1997, "Fender", new[]
        {
            new ProductCandidate("3", "Fender American Standard Stratocaster 2008 - 2016", "Fender"),
            new ProductCandidate("98927", "Fender American Standard Stratocaster 1986 - 2000", "Fender"),
        });

        Assert.Equal("98927", best?.Id);
    }

    [Fact]
    public void Left_handed_product_loses_to_right_handed_listing()
    {
        var best = ProductMatcher.PickBest("American Standard Stratocaster", 1995, "Fender", new[]
        {
            new ProductCandidate("98914", "Fender American Standard Stratocaster Left-Handed 1989 - 2000", "Fender"),
            new ProductCandidate("98927", "Fender American Standard Stratocaster 1986 - 2000", "Fender"),
        });

        Assert.Equal("98927", best?.Id);
    }

    [Fact]
    public void More_specific_product_wins_when_the_listing_names_it()
    {
        var best = ProductMatcher.PickBest("Flying V 2024 Gibson 70's Flying V in Antique Natural with Original Hardshell", 2024, "Gibson", new[]
        {
            new ProductCandidate("1", "Gibson Flying V", "Gibson"),
            new ProductCandidate("113405", "Gibson '70s Flying V", "Gibson"),
        });

        Assert.Equal("113405", best?.Id);
    }

    [Fact]
    public void Ambiguous_matches_are_refused()
    {
        var best = ProductMatcher.PickBest("Fender American Standard Black 1997", 1997, "Fender", new[]
        {
            new ProductCandidate("98927", "Fender American Standard Stratocaster 1986 - 2000", "Fender"),
            new ProductCandidate("99999", "Fender American Standard Telecaster 1988 - 2000", "Fender"),
        });

        Assert.Null(best);
    }

    [Fact]
    public void Weak_matches_and_other_brands_are_refused()
    {
        Assert.Null(ProductMatcher.PickBest("Telecaster", null, "Fender", new[]
        {
            new ProductCandidate("1", "Fender American Professional II Stratocaster HSS", "Fender"),
        }));

        Assert.Null(ProductMatcher.PickBest("Les Paul Standard", null, "Gibson", new[]
        {
            new ProductCandidate("2", "Epiphone Les Paul Standard", "Epiphone"),
        }));
    }

    [Fact]
    public void Cases_and_parts_are_never_matched()
    {
        var best = ProductMatcher.PickBest("SG Gibson SG 1978 - Walnut", 1978, "Gibson", new[]
        {
            new ProductCandidate("1", "Gibson SG Original Hardshell Case", "Gibson"),
            new ProductCandidate("2", "Gibson SG Pickguard", "Gibson"),
        });

        Assert.Null(best);
    }

    [Fact]
    public void Different_models_sharing_only_a_wood_word_do_not_match()
    {
        var candidate = new ProductCandidate("176321", "Martin GPC-16E Mahogany", "Martin");

        Assert.Null(ProductMatcher.PickBest("OMC-15E Martin OMC-15E 2002 - Mahogany", 2002, "Martin", new[] { candidate }));
        Assert.False(ProductMatcher.IsStrongMatch("OMC-15E", 2002, candidate, "Martin"));
    }

    [Fact]
    public void Year_ranged_product_is_not_strong_without_a_listing_year()
    {
        var candidate = new ProductCandidate("1", "Martin HD-28 1976 - 1992", "Martin");

        Assert.False(ProductMatcher.IsStrongMatch("HD-28", null, candidate, "Martin"));
        Assert.True(ProductMatcher.IsStrongMatch("HD-28", 1985, candidate, "Martin"));
    }

    [Fact]
    public void Generic_model_text_does_not_name_a_specific_product()
    {
        Assert.False(ProductMatcher.NamesProduct("Les Paul", null, new ProductCandidate("1", "Gibson Les Paul Junior (2019 - Present)", "Gibson"), "Gibson"));
        Assert.False(ProductMatcher.NamesProduct("Stratocaster", null, new ProductCandidate("2", "Fender ST-62 Stratocaster Reissue Left-Handed MIJ", "Fender"), "Fender"));
        Assert.True(ProductMatcher.NamesProduct("Ritchie Blackmore Artist Series Signature Stratocaster", null, new ProductCandidate("3", "Fender Ritchie Blackmore Stratocaster", "Fender"), "Fender"));
        Assert.True(ProductMatcher.NamesProduct("Player Plus Stratocaster", null, new ProductCandidate("4", "Fender Player Plus Stratocaster HSS", "Fender"), "Fender"));

        var dated = new ProductCandidate("5", "Gibson SG Standard 1991 - 2012", "Gibson");
        Assert.False(ProductMatcher.NamesProduct("SG Standard", null, dated, "Gibson"));
        Assert.False(ProductMatcher.NamesProduct("SG Standard", 2021, dated, "Gibson"));
        Assert.True(ProductMatcher.NamesProduct("SG Standard", 2011, dated, "Gibson"));
    }

    [Fact]
    public void Limited_edition_product_is_not_a_strong_match_for_the_regular_model()
    {
        var limited = new ProductCandidate("1", "Fender Limited Edition Cabronita Telecaster 2019", "Fender");

        Assert.False(ProductMatcher.IsStrongMatch("Cabronita Telecaster", null, limited, "Fender"));
        Assert.False(ProductMatcher.IsStrongMatch("Cabronita Telecaster", 2023, limited, "Fender"));
    }

    [Fact]
    public void Single_trailing_year_is_a_model_year_but_reissue_years_are_names()
    {
        var modelYear = new ProductCandidate("1", "Gibson Les Paul CM 2015", "Gibson");
        Assert.True(ProductMatcher.IsStrongMatch("Les Paul CM", 2015, modelYear, "Gibson"));
        Assert.False(ProductMatcher.IsStrongMatch("Les Paul CM", 2020, modelYear, "Gibson"));

        var reissue = new ProductCandidate("2", "Gibson Custom Shop 1959 Les Paul Standard Reissue", "Gibson");
        Assert.True(ProductMatcher.IsStrongMatch("Custom Shop 1959 Les Paul Standard Reissue", 2012, reissue, "Gibson"));
    }

    [Theory]
    [InlineData("Taylor", "114ce Grand Auditorium", "Taylor 114ce")]
    [InlineData("Gibson", "ES-335 Figured Semi-hollowbody", "Gibson ES-335")]
    [InlineData("ESP", "LTD EC-1000 Electric Guitar Plek'd", "ESP EC-1000")]
    [InlineData("Jackson", "PS-7", "Jackson PS-7")]
    public void Queries_fall_back_to_the_model_number(string make, string model, string expected)
    {
        Assert.Contains(expected, ProductMatcher.BuildQueries(make, model, null));
    }

    [Fact]
    public void Series_filler_does_not_tie_the_original_with_the_mark_ii()
    {
        var best = ProductMatcher.PickBest("American Professional Stratocaster", null, "Fender", new[]
        {
            new ProductCandidate("1", "Fender American Professional II Stratocaster", "Fender"),
            new ProductCandidate("2", "Fender American Professional II Stratocaster HSS", "Fender"),
            new ProductCandidate("3", "Fender American Professional Classic Stratocaster", "Fender"),
            new ProductCandidate("4", "Fender American Professional Series Stratocaster (2017 - 2019)", "Fender"),
        });

        Assert.Equal("4", best?.Id);
    }

    [Fact]
    public void Undated_listing_refuses_between_year_variants()
    {
        Assert.Null(ProductMatcher.PickBest("Les Paul Studio", null, "Gibson", new[]
        {
            new ProductCandidate("1", "Gibson Les Paul Studio (2024 - Present)", "Gibson"),
            new ProductCandidate("2", "Gibson Les Paul Studio 1998 - 2011", "Gibson"),
            new ProductCandidate("3", "Gibson Les Paul Studio 1990 - 1997", "Gibson"),
        }));
    }
}
