using System.Globalization;

namespace GuitarDb.API.Services;

public class DealFinderScheduleOptions
{
    /// <summary>Off by default so a missing config section can never start scraping.</summary>
    public bool Enabled { get; set; } = false;

    /// <summary>
    /// The times of day to run, as 24-hour local "HH:mm". Each is claimed and recorded
    /// independently, so an 8am run does not satisfy the 1pm one.
    /// </summary>
    /// <remarks>
    /// Deliberately empty by default. The configuration binder APPENDS to an existing
    /// List instance rather than replacing it, so any seeded default would survive
    /// alongside the configured values and silently add a slot nobody asked for.
    /// An empty list is treated as a misconfiguration and refuses to run.
    /// </remarks>
    public List<string> TimesOfDay { get; set; } = new();

    /// <summary>IANA time zone id. .NET 9 resolves these on Windows and Linux alike.</summary>
    public string TimeZone { get; set; } = "America/New_York";

    public bool RunReverb { get; set; } = true;

    public bool RunSweetwater { get; set; } = true;

    /// <summary>
    /// How long after a scheduled time a missed run may still fire. Without this bound,
    /// a machine starting at 11pm would satisfy "past 8am today, has not run today" and
    /// fire a run at 11pm.
    /// </summary>
    public int CatchUpWindowHours { get; set; } = 4;
}

/// <summary>
/// One occurrence of a scheduled time - a local date paired with a time of day.
/// </summary>
public readonly record struct ScheduledSlot(DateOnly Date, TimeOnly Time)
{
    public string RunDateKey => Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    public string SlotKey => Time.ToString("HH\\:mm", CultureInfo.InvariantCulture);

    public override string ToString() => $"{RunDateKey} {SlotKey}";
}

public static class DealFinderSchedule
{
    /// <summary>
    /// Returns every slot whose catch-up window is currently open, oldest first.
    /// Pure - no clock, no config, no I/O - so the DST and catch-up cases can be
    /// reasoned about and exercised directly.
    /// </summary>
    public static IReadOnlyList<ScheduledSlot> GetOpenSlots(
        DateTime utcNow,
        TimeZoneInfo timeZone,
        IReadOnlyList<TimeOnly> timesOfDay,
        int catchUpWindowHours)
    {
        var localNow = TimeZoneInfo.ConvertTimeFromUtc(utcNow, timeZone);
        var today = DateOnly.FromDateTime(localNow);
        var window = TimeSpan.FromHours(catchUpWindowHours);

        var open = new List<ScheduledSlot>();

        // Yesterday's occurrences still matter when a catch-up window spans midnight.
        foreach (var date in new[] { today.AddDays(-1), today })
        {
            foreach (var time in timesOfDay)
            {
                var scheduledLocal = date.ToDateTime(time);

                if (localNow >= scheduledLocal && localNow < scheduledLocal.Add(window))
                    open.Add(new ScheduledSlot(date, time));
            }
        }

        return open
            .OrderBy(s => s.Date)
            .ThenBy(s => s.Time)
            .ToList();
    }
}
