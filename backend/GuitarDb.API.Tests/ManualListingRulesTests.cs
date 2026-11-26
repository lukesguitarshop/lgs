using GuitarDb.API.Services;

namespace GuitarDb.API.Tests;

public class ManualListingRulesTests
{
    [Fact]
    public void Blank_lines_split_paragraphs_and_newlines_become_breaks()
    {
        var html = ManualListingRules.DescriptionToHtml("2019 Les Paul.\r\nPlays great.\n\n\nShips in a hard case.");
        Assert.Equal("<p>2019 Les Paul.<br>Plays great.</p><p>Ships in a hard case.</p>", html);
    }

    [Fact]
    public void Typed_markup_is_escaped_rather_than_rendered()
    {
        var html = ManualListingRules.DescriptionToHtml("Frets <90% & a 10\" radius");
        Assert.Equal("<p>Frets &lt;90% &amp; a 10&quot; radius</p>", html);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  \n\n \t ")]
    public void Nothing_typed_means_no_description(string? text)
    {
        Assert.Null(ManualListingRules.DescriptionToHtml(text));
    }
}
