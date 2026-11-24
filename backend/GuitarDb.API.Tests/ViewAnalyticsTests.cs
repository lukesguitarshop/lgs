using GuitarDb.API.Models;
using GuitarDb.API.Services;

namespace GuitarDb.API.Tests;

public class ViewAnalyticsTests
{
    private static readonly DateTime Today = new(2026, 11, 23, 18, 30, 0, DateTimeKind.Utc);

    private static ListingViewDay Row(string listingId, string day, long count) =>
        new() { ListingId = listingId, Day = day, Count = count };

    [Fact]
    public void DayKey_is_the_utc_calendar_date()
    {
        Assert.Equal("2026-11-23", ViewAnalytics.DayKey(Today));
    }

    [Fact]
    public void Daily_series_covers_every_day_in_the_range_oldest_first_with_zeros()
    {
        var rows = new[] { Row("a", "2026-11-23", 4), Row("b", "2026-11-23", 1), Row("a", "2026-11-21", 2) };

        var summary = ViewAnalytics.Summarize(rows, Today, days: 3);

        Assert.Equal(
            new[] { ("2026-11-21", 2L), ("2026-11-22", 0L), ("2026-11-23", 5L) },
            summary.Daily.Select(d => (d.Date, d.Views)));
    }

    [Fact]
    public void Totals_cover_today_the_last_seven_days_and_the_whole_range()
    {
        var rows = new[]
        {
            Row("a", "2026-11-23", 4),  // today
            Row("a", "2026-11-17", 3),  // 7th day back, inclusive
            Row("a", "2026-11-16", 10), // outside the last 7
            Row("a", "2026-10-25", 6),  // first day of a 30-day range
            Row("a", "2026-10-24", 99), // before the range
        };

        var summary = ViewAnalytics.Summarize(rows, Today, days: 30);

        Assert.Equal(4, summary.Today);
        Assert.Equal(7, summary.Last7Days);
        Assert.Equal(23, summary.InRange);
    }

    [Fact]
    public void Per_listing_totals_are_ranked_highest_first_and_ignore_days_outside_the_range()
    {
        var rows = new[]
        {
            Row("a", "2026-11-23", 1), Row("a", "2026-11-22", 1),
            Row("b", "2026-11-23", 5),
            Row("c", "2026-11-01", 50),
        };

        var summary = ViewAnalytics.Summarize(rows, Today, days: 7);

        Assert.Equal(new[] { ("b", 5L), ("a", 2L) }, summary.ByListing.Select(l => (l.ListingId, l.Views)));
    }

    [Fact]
    public void An_empty_history_still_gives_a_full_zero_series()
    {
        var summary = ViewAnalytics.Summarize(Array.Empty<ListingViewDay>(), Today, days: 7);

        Assert.Equal(7, summary.Daily.Count);
        Assert.All(summary.Daily, d => Assert.Equal(0, d.Views));
        Assert.Equal(0, summary.InRange);
        Assert.Empty(summary.ByListing);
    }

    [Theory]
    [InlineData(0, 30)]
    [InlineData(-5, 30)]
    [InlineData(7, 7)]
    [InlineData(90, 90)]
    [InlineData(5000, 365)]
    public void ClampDays_keeps_the_range_sensible(int requested, int expected)
    {
        Assert.Equal(expected, ViewAnalytics.ClampDays(requested));
    }
}
