using GuitarDb.API.Services;

namespace GuitarDb.API.Tests;

public class RepairDetectorTests
{
    [Theory]
    [InlineData("Gibson Les Paul Standard 2015 - Headstock Repair")]
    [InlineData("1998 Les Paul Studio w/ repaired headstock")]
    [InlineData("Gibson SG Standard HS repair, plays great")]
    [InlineData("Les Paul Custom - broken neck, professionally fixed")]
    public void Flags_repairs_in_the_title(string title)
    {
        Assert.NotNull(RepairDetector.Find(title, null));
    }

    [Theory]
    [InlineData("<p>Plays great. The headstock was broken and professionally repaired by a luthier in 2019.</p>")]
    [InlineData("<p>Has had a headstock repair, very clean, almost invisible.</p>")]
    [InlineData("<ul><li>Neck has been re-glued at the headstock</li></ul>")]
    [InlineData("<p>No fret buzz, but the headstock was cracked and glued years ago.</p>")]
    [InlineData("<p>Cracked head stock, fully stable.</p>")]
    [InlineData("<p>Re-glued neck joint, solid as a rock.</p>")]
    public void Flags_repairs_in_the_description(string description)
    {
        Assert.NotNull(RepairDetector.Find("Gibson Les Paul", description));
    }

    [Theory]
    [InlineData("<p>No breaks, cracks, or headstock repairs.</p>")]
    [InlineData("<p>Never had a headstock repair. No issues at all.</p>")]
    [InlineData("<p>There are no headstock or neck breaks or repairs.</p>")]
    [InlineData("<p>Headstock has never been broken or repaired.</p>")]
    [InlineData("<p>Free of any neck repairs.</p>")]
    [InlineData("<p>The headstock isn't cracked.</p>")]
    [InlineData("<p>The neck pickup is broken and needs replacing.</p>")]
    [InlineData("<p>Neck pickup coil split works great.</p>")]
    [InlineData("<p>Classic glued neck construction with a long tenon.</p>")]
    [InlineData("<p>Headstock tuner is cracked but works.</p>")]
    [InlineData("<p>Mahogany body, maple top, rosewood fretboard. Plays perfectly.</p>")]
    public void Ignores_negated_and_unrelated_mentions(string description)
    {
        Assert.Null(RepairDetector.Find("Gibson Les Paul Standard", description));
    }

    [Fact]
    public void Returns_the_sentence_trimmed()
    {
        var note = RepairDetector.Find("Gibson ES-335", "<p>Beautiful guitar. The headstock was repaired by Gibson in 2012 and has held up perfectly ever since through years of gigging.</p>");

        Assert.Equal("The headstock was repaired by Gibson in 2012 and has held up perfectly ever since through years of gigging.", note);
    }
}
