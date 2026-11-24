using System.Globalization;
using GuitarDb.API.Models;

namespace GuitarDb.API.Services;

/// <summary>
/// Turns the per-listing, per-day view rows into what the admin analytics page shows.
/// Pure, so the date arithmetic can be tested without a database. Days are UTC.
/// </summary>
public static class ViewAnalytics
{
    public const int DefaultDays = 30;
    public const int MaxDays = 365;

    public record DayViews(string Date, long Views);
    public record ListingViews(string ListingId, long Views);
    public record Summary(
        long Today,
        long Last7Days,
        long InRange,
        IReadOnlyList<DayViews> Daily,
        IReadOnlyList<ListingViews> ByListing);

    public static string DayKey(DateTime utc) => utc.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    public static int ClampDays(int requested) =>
        requested <= 0 ? DefaultDays : Math.Min(requested, MaxDays);

    /// <summary>The first day of a range of <paramref name="days"/> days ending today.</summary>
    public static string RangeStart(DateTime utcNow, int days) => DayKey(utcNow.Date.AddDays(-(days - 1)));

    public static Summary Summarize(IEnumerable<ListingViewDay> rows, DateTime utcNow, int days)
    {
        var today = DayKey(utcNow);
        var rangeStart = RangeStart(utcNow, days);
        var weekStart = RangeStart(utcNow, 7);

        // Day keys are yyyy-MM-dd, so ordinal string comparison is date comparison.
        var inRange = rows
            .Where(r => string.CompareOrdinal(r.Day, rangeStart) >= 0 && string.CompareOrdinal(r.Day, today) <= 0)
            .ToList();

        var perDay = inRange.GroupBy(r => r.Day).ToDictionary(g => g.Key, g => g.Sum(r => r.Count));

        var daily = Enumerable.Range(0, days)
            .Select(offset => DayKey(utcNow.Date.AddDays(-(days - 1) + offset)))
            .Select(day => new DayViews(day, perDay.GetValueOrDefault(day)))
            .ToList();

        var byListing = inRange
            .GroupBy(r => r.ListingId)
            .Select(g => new ListingViews(g.Key, g.Sum(r => r.Count)))
            .Where(l => l.Views > 0)
            .OrderByDescending(l => l.Views)
            .ThenBy(l => l.ListingId, StringComparer.Ordinal)
            .ToList();

        return new Summary(
            Today: perDay.GetValueOrDefault(today),
            Last7Days: daily.Where(d => string.CompareOrdinal(d.Date, weekStart) >= 0).Sum(d => d.Views),
            InRange: daily.Sum(d => d.Views),
            Daily: daily,
            ByListing: byListing);
    }
}
