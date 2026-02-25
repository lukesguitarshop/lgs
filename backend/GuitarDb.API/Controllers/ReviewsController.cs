using GuitarDb.API.Services;
using Microsoft.AspNetCore.Mvc;

namespace GuitarDb.API.Controllers;

[ApiController]
[Route("api/reviews")]
public class ReviewsController : ControllerBase
{
    private readonly MongoDbService _mongoDbService;

    public ReviewsController(MongoDbService mongoDbService)
    {
        _mongoDbService = mongoDbService;
    }

    [HttpGet]
    public async Task<IActionResult> GetReviews(
        [FromQuery] string? search = null,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 20;
        if (pageSize > 100) pageSize = 100;

        var (reviews, totalCount) = await _mongoDbService.GetReviewsAsync(
            search, fromDate, toDate, page, pageSize);

        return Ok(new
        {
            reviews = reviews.Select(r => new
            {
                id = r.Id,
                guitar_name = r.GuitarName,
                reviewer_name = r.ReviewerName,
                review_date = r.ReviewDate,
                rating = r.Rating,
                review_text = r.ReviewText
            }),
            total_count = totalCount,
            page,
            page_size = pageSize,
            total_pages = (int)Math.Ceiling((double)totalCount / pageSize)
        });
    }

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats([FromQuery] int recentDays = 30)
    {
        if (recentDays < 1) recentDays = 30;

        var (totalCount, recentCount) = await _mongoDbService.GetReviewStatsAsync(recentDays);

        return Ok(new
        {
            total_count = totalCount,
            recent_count = recentCount,
            recent_days = recentDays,
            average_rating = 5
        });
    }
}
