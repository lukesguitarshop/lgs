using GuitarDb.API.Attributes;
using GuitarDb.API.Services;
using Microsoft.AspNetCore.Mvc;

namespace GuitarDb.API.Controllers;

/// <summary>
/// Numbers for the admin Analytics page. One endpoint per subject, so a new kind of
/// analytics is a new action here and a new section on the page.
/// </summary>
[ApiController]
[Route("api/admin/analytics")]
[AdminAuthorize]
public class AdminAnalyticsController : ControllerBase
{
    private const int TopListingCount = 10;

    private readonly MongoDbService _mongoDbService;

    public AdminAnalyticsController(MongoDbService mongoDbService)
    {
        _mongoDbService = mongoDbService;
    }

    /// <summary>
    /// Listing page views over the last <paramref name="days"/> days (UTC): headline
    /// totals, a day-by-day series, and the most viewed guitars in that range.
    /// </summary>
    [HttpGet("views")]
    public async Task<IActionResult> GetViews([FromQuery] int days = ViewAnalytics.DefaultDays)
    {
        days = ViewAnalytics.ClampDays(days);
        var now = DateTime.UtcNow;

        // The 7-day tile needs a week of rows even when the page asks for fewer days.
        var rows = await _mongoDbService.GetListingViewDaysAsync(
            ViewAnalytics.RangeStart(now, Math.Max(days, 7)));
        var summary = ViewAnalytics.Summarize(rows, now, days);
        var last7Days = days >= 7 ? summary.Last7Days : ViewAnalytics.Summarize(rows, now, 7).InRange;

        var allTime = await _mongoDbService.GetListingViewCountsAsync();
        var watchers = await _mongoDbService.GetWatcherCountsAsync();

        var top = summary.ByListing.Take(TopListingCount).ToList();
        var listings = top.Count > 0
            ? (await _mongoDbService.GetListingsByIdsAsync(top.Select(t => t.ListingId)))
                .ToDictionary(l => l.Id!, l => l)
            : new Dictionary<string, Models.MyListing>();

        return Ok(new
        {
            days,
            totals = new
            {
                today = summary.Today,
                last_7_days = last7Days,
                in_range = summary.InRange,
                all_time = allTime.Values.Sum(),
                listings_viewed = summary.ByListing.Count
            },
            daily = summary.Daily.Select(d => new { date = d.Date, views = d.Views }),
            top_listings = top
                // A listing deleted since it was viewed has no title to show.
                .Where(t => listings.ContainsKey(t.ListingId))
                .Select(t =>
                {
                    var listing = listings[t.ListingId];
                    return new
                    {
                        id = listing.Id,
                        listing_title = listing.ListingTitle,
                        image = listing.Images.FirstOrDefault(),
                        price = listing.Price,
                        disabled = listing.Disabled,
                        views = t.Views,
                        all_time_views = allTime.GetValueOrDefault(t.ListingId),
                        watchers = watchers.GetValueOrDefault(t.ListingId)
                    };
                })
        });
    }
}
