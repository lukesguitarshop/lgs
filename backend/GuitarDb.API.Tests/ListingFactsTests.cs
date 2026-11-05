using GuitarDb.API.Services;

namespace GuitarDb.API.Tests;

public class ListingFactsTests
{
    private static (YearSpan? Years, string? Source) Find(string? yearField = null, string? title = null, string? description = null,
        string make = "Gibson", string? model = null, int? madeYear = null, string? madeDecade = null) =>
        ListingFacts.FindYears(make, model, yearField, title, description, madeYear, madeDecade);

    [Theory]
    [InlineData("2015", 2015, 2015)]
    [InlineData("2010s", 2010, 2019)]
    [InlineData("Late 70's", 1970, 1979)]
    [InlineData("'90s", 1990, 1999)]
    [InlineData("1993 - 1994", 1993, 1994)]
    public void Reads_the_year_field(string field, int from, int to)
    {
        Assert.Equal(new YearSpan(from, to), ListingFacts.ParseYearField(field));
    }

    [Fact]
    public void Wide_catalog_ranges_in_the_year_field_are_ignored()
    {
        Assert.Null(ListingFacts.ParseYearField("1952 - 2023"));
    }

    [Fact]
    public void Exact_listing_year_wins()
    {
        var (years, source) = Find(yearField: "2012", title: "2019 Gibson SG", madeYear: null);
        Assert.Equal(new YearSpan(2012, 2012), years);
        Assert.Equal(YearSources.Listing, source);
    }

    [Theory]
    [InlineData("2011 Gibson SG Standard Cherry Red", 2011)]
    [InlineData("Gibson Les Paul Studio 2008 - Wine Red", 2008)]
    [InlineData("Used Gibson 2011 Gibson Les Paul Studio Deluxe Tobacco Sunburst", 2011)]
    public void Takes_the_year_from_the_title(string title, int year)
    {
        var (years, source) = Find(title: title, model: title);
        Assert.Equal(new YearSpan(year, year), years);
        Assert.Equal(YearSources.Title, source);
    }

    [Theory]
    [InlineData("Fender American Vintage II 1963 Telecaster - Sunburst", "Fender")]
    [InlineData("Gibson Custom Shop 1959 Les Paul Standard Reissue", "Gibson")]
    [InlineData("Gibson Les Paul Standard 2019 - Present - Gold Top", "Gibson")]
    [InlineData("Fender Custom Shop 1956 Stratocaster Relic", "Fender")]
    public void Model_years_in_titles_are_not_build_years(string title, string make)
    {
        Assert.Null(Find(title: title, make: make).Years);
    }

    [Theory]
    [InlineData("<p>Made in 2016 at the Nashville plant.</p>", 2016)]
    [InlineData("<p>This 2019 Gibson plays great.</p>", 2019)]
    [InlineData("<p>A beautiful 2014 Gibson Les Paul with case.</p>", 2014)]
    [InlineData("<p>Year: 2007</p>", 2007)]
    [InlineData("<p>I purchased it new in 2021 from Sweetwater.</p>", 2021)]
    [InlineData("<p>2012 Gibson Les Paul Studio in great shape.</p>", 2012)]
    public void Finds_the_year_in_the_description(string description, int year)
    {
        var (years, source) = Find(title: "Gibson Les Paul Studio", description: description, model: "Les Paul Studio");
        Assert.Equal(new YearSpan(year, year), years);
        Assert.Equal(YearSources.Description, source);
    }

    [Theory]
    [InlineData("<p>Includes a 2023 tour case. Plays well.</p>")]
    [InlineData("<p>Strings changed in 2024.</p>")]
    [InlineData("<p>A faithful 1959 reissue.</p>")]
    public void Ignores_years_that_are_not_build_years(string description)
    {
        Assert.Null(Find(title: "Gibson Les Paul Studio", description: description, model: "Les Paul Studio").Years);
    }

    [Theory]
    [InlineData("02382512", 2002)]   // YDDDYRRR: day 238, year 0+2
    [InlineData("91239317", 1999)]   // 9..9 -> 1999
    [InlineData("113600482", 2010)]  // 9 digits, year 1+0
    [InlineData("140029155", 2014)]  // 2014 two-digit prefix
    [InlineData("230034123", 2023)]  // day 300, year 2+3
    [InlineData("99999999", null)]   // day 999 isn't a day
    public void Decodes_gibson_serials(string serial, int? year)
    {
        Assert.Equal(year, ListingFacts.DecodeGibson(serial));
    }

    [Theory]
    [InlineData("US19045678", 2019)]
    [InlineData("MX15123456", 2015)]
    [InlineData("Z5123456", 2005)]
    [InlineData("N4123456", 1994)]
    [InlineData("MZ7123456", 2007)]
    [InlineData("ICS12123456", 2012)]
    [InlineData("V123456", null)]
    public void Decodes_fender_serials(string serial, int? year)
    {
        Assert.Equal(year, ListingFacts.DecodeFender(serial));
    }

    [Fact]
    public void Uses_a_serial_number_in_the_description()
    {
        var (years, source) = Find(title: "Fender Stratocaster", make: "Fender", model: "Stratocaster",
            description: "<p>Great player. Serial number: US19045678. Comes with gig bag.</p>");
        Assert.Equal(new YearSpan(2019, 2019), years);
        Assert.Equal(YearSources.Serial, source);
    }

    [Fact]
    public void Falls_back_to_a_decade()
    {
        var (years, _) = Find(title: "Gibson SG Standard", madeDecade: "2010s");
        Assert.Equal(new YearSpan(2010, 2019), years);
        Assert.Equal("2010s", years.ToString());
    }

    [Fact]
    public void Sweetwater_made_year_wins()
    {
        Assert.Equal(new YearSpan(2019, 2019), Find(title: "SG Standard Electric Guitar - Heritage Cherry", madeYear: 2019).Years);
    }
}

public class MatcherYearAndTieTests
{
    private static readonly ProductCandidate[] LesPaulStudios =
    {
        new("1", "Gibson Les Paul Studio (2024 - Present)", "Gibson"),
        new("2", "Gibson Les Paul Studio 1998 - 2011", "Gibson"),
        new("3", "Gibson Les Paul Studio 1990 - 1997", "Gibson"),
    };

    [Fact]
    public void A_year_from_anywhere_picks_the_right_era()
    {
        Assert.Equal("2", ProductMatcher.PickBest("Les Paul Studio", 2008, "Gibson", LesPaulStudios)?.Id);
    }

    [Fact]
    public void A_decade_rules_out_eras_it_does_not_touch()
    {
        // 1990s: inside 1990-1997 is impossible to confirm, but 2024-Present is out
        var best = ProductMatcher.PickBest("Les Paul Studio", new YearSpan(2020, 2029), "Gibson", LesPaulStudios);
        Assert.Equal("1", best?.Id);
    }

    [Fact]
    public void Year_ranged_product_without_siblings_is_trusted_undated()
    {
        var only = new ProductCandidate("1", "Gibson Les Paul Standard '50s (2019 - Present)", "Gibson");
        var candidates = new[] { only, new ProductCandidate("2", "Gibson Les Paul Standard '60s (2019 - Present)", "Gibson") };

        Assert.False(ProductMatcher.HasYearSiblings(only, candidates, "Gibson"));
        Assert.True(ProductMatcher.IsStrongMatch("Les Paul Standard '50s", null, only, "Gibson", hasYearSiblings: false));
        Assert.True(ProductMatcher.HasYearSiblings(LesPaulStudios[0], LesPaulStudios, "Gibson"));
    }

    [Fact]
    public void Colors_and_extras_do_not_block_a_strong_match()
    {
        var product = new ProductCandidate("1", "Fender Player II Stratocaster", "Fender");
        Assert.True(ProductMatcher.IsStrongMatch("2026 Fender Player II Stratocaster British Racing Green (MIM)", 2026, product, "Fender", hasYearSiblings: false));
    }

    [Fact]
    public void Signature_and_collection_are_filler()
    {
        Assert.True(ProductMatcher.IsStrongMatch("Slash Les Paul Standard", null, new ProductCandidate("1", "Gibson Slash Collection Les Paul Standard", "Gibson"), "Gibson"));
        Assert.True(ProductMatcher.IsStrongMatch("MonoNeon Jazz Bass V", null, new ProductCandidate("2", "Fender MonoNeon Signature Jazz Bass V", "Fender"), "Fender"));
    }

    [Fact]
    public void Four_digit_model_year_matches_the_two_digit_product_name()
    {
        var product = new ProductCandidate("1", "Fender American Vintage II '75 Telecaster Deluxe", "Fender");
        Assert.True(ProductMatcher.IsStrongMatch("American Vintage II 1975 Telecaster Deluxe", null, product, "Fender"));
    }

    [Fact]
    public void Description_breaks_a_tie_on_the_distinguishing_word()
    {
        var tied = new[]
        {
            new ProductCandidate("1", "Fender Player Stratocaster", "Fender"),
            new ProductCandidate("2", "Fender Player Stratocaster HSS", "Fender"),
        };

        Assert.Equal("2", ProductMatcher.BreakTie(tied, "<p>HSS configuration with a coil split. Plays great.</p>", "Fender")?.Id);
        // Silence about HSS doesn't make it the plain model
        Assert.Null(ProductMatcher.BreakTie(tied, "<p>Plays great, no issues.</p>", "Fender"));
    }

    [Fact]
    public void A_single_model_year_does_not_tie_with_the_current_range()
    {
        var best = ProductMatcher.PickBest("SG Standard", 2019, "Gibson", new[]
        {
            new ProductCandidate("1", "Gibson SG Standard 2018", "Gibson"),
            new ProductCandidate("2", "Gibson SG Standard (2019 - Present)", "Gibson"),
            new ProductCandidate("3", "Gibson SG Standard 1991 - 2012", "Gibson"),
        });

        Assert.Equal("2", best?.Id);
    }
}
