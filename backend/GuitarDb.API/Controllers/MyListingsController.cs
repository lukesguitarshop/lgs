using GuitarDb.API.Services;
using Microsoft.AspNetCore.Mvc;

namespace GuitarDb.API.Controllers;

[ApiController]
[Route("api/listings")]
public class MyListingsController : ControllerBase
{
    private readonly MongoDbService _mongoDbService;

    public MyListingsController(MongoDbService mongoDbService)
    {
        _mongoDbService = mongoDbService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAllListings()
    {
        var listings = await _mongoDbService.GetAllMyListingsAsync();

        return Ok(listings.Select(l => new
        {
            id = l.Id,
            listing_title = l.ListingTitle,
            description = l.Description,
            condition = l.Condition,
            images = l.Images,
            reverb_link = l.ReverbLink,
            price = l.Price,
            currency = l.Currency,
            scraped_at = l.ScrapedAt,
            listed_at = l.ListedAt
        }));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetListingById(string id)
    {
        var listing = await _mongoDbService.GetMyListingByIdAsync(id);

        if (listing == null)
        {
            return NotFound(new { error = "Listing not found" });
        }

        return Ok(new
        {
            id = listing.Id,
            listing_title = listing.ListingTitle,
            description = listing.Description,
            condition = listing.Condition,
            images = listing.Images,
            reverb_link = listing.ReverbLink,
            price = listing.Price,
            currency = listing.Currency,
            scraped_at = listing.ScrapedAt,
            listed_at = listing.ListedAt,
            disabled = listing.Disabled
        });
    }
}
