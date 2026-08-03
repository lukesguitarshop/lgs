namespace GuitarDb.API.Services;

public class DealFinderScheduleOptions
{
    /// <summary>Off by default so a missing config section can never start scraping.</summary>
    public bool Enabled { get; set; } = false;

    /// <summary>24-hour local time, "HH:mm".</summary>
    public string TimeOfDay { get; set; } = "08:00";

    /// <summary>IANA time zone id. .NET 9 resolves these on Windows and Linux alike.</summary>
    public string TimeZone { get; set; } = "America/New_York";

    public bool RunReverb { get; set; } = true;

    public bool RunSweetwater { get; set; } = true;

    /// <summary>
    /// How long after the scheduled time a missed run may still fire. Without this bound,
    /// a machine starting at 11pm would satisfy "past 8am today, has not run today" and
    /// fire a run at 11pm.
    /// </summary>
    public int CatchUpWindowHours { get; set; } = 4;
}

public static class DealFinderSchedule
{
    /// <summary>
    /// Returns the local date whose run is currently due, or null if none is.
    /// Pure - no clock, no config, no I/O - so the DST and catch-up cases can be
    /// reasoned about and exercised directly.
    /// </summary>
    public static DateOnly? GetDueRunDate(
        DateTime utcNow,
        TimeZoneInfo timeZone,
        TimeOnly timeOfDay,
        int catchUpWindowHours)
    {
        var localNow = TimeZoneInfo.ConvertTimeFromUtc(utcNow, timeZone);
        var today = DateOnly.FromDateTime(localNow);
        var scheduledLocal = today.ToDateTime(timeOfDay);

        // Not yet time today.
        if (localNow < scheduledLocal)
            return null;

        // Too late - the catch-up window has closed, wait for tomorrow.
        if (localNow >= scheduledLocal.AddHours(catchUpWindowHours))
            return null;

        return today;
    }
}
