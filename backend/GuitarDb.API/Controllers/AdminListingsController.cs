using GuitarDb.API.Attributes;
using GuitarDb.API.Models;
using GuitarDb.API.Services;
using Microsoft.AspNetCore.Mvc;

namespace GuitarDb.API.Controllers;

/// <summary>
/// Creating a listing by hand. Every other listing arrives from the Reverb scraper; this
/// is for a guitar that isn't on Reverb. The rest of listing management (price, disable,
/// feature, delete) is in <see cref="AdminController"/> and works on these the same way.
/// </summary>
[ApiController]
[Route("api/admin/listings")]
[AdminAuthorize]
public class AdminListingsController : ControllerBase
{
    private readonly MongoDbService _mongoDbService;
    private readonly IFileStorageService _fileStorage;
    private readonly ILogger<AdminListingsController> _logger;

    public AdminListingsController(MongoDbService mongoDbService, IFileStorageService fileStorage,
        ILogger<AdminListingsController> logger)
    {
        _mongoDbService = mongoDbService;
        _fileStorage = fileStorage;
        _logger = logger;
    }

    public class CreateListingRequest
    {
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string Condition { get; set; } = string.Empty;
        public decimal Price { get; set; }
        /// <summary>What the guitar cost, for the finance tracker. Optional.</summary>
        public decimal? PurchasePrice { get; set; }
        /// <summary>In display order; the first is the cover photo.</summary>
        public List<IFormFile>? Photos { get; set; }
    }

    // The browser shrinks photos before sending (well under 1MB each), so this is a backstop.
    private const long MaxCreateBytes = 100 * 1024 * 1024;

    [HttpPost]
    [RequestSizeLimit(MaxCreateBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxCreateBytes)]
    public async Task<IActionResult> Create([FromForm] CreateListingRequest request)
    {
        // Everything is checked before anything is written.
        var title = request.Title?.Trim() ?? string.Empty;
        if (title.Length == 0)
            return BadRequest(new { error = "Title is required" });
        if (title.Length > ManualListingRules.MaxTitleLength)
            return BadRequest(new { error = $"Title must be {ManualListingRules.MaxTitleLength} characters or fewer" });
        if (!ManualListingRules.Conditions.Contains(request.Condition))
            return BadRequest(new { error = "Pick a condition" });
        if (request.Price <= 0)
            return BadRequest(new { error = "Price must be more than zero" });
        if (request.PurchasePrice is < 0)
            return BadRequest(new { error = "What you paid can't be negative" });
        if ((request.Description?.Length ?? 0) > ManualListingRules.MaxDescriptionLength)
            return BadRequest(new { error = $"Description must be {ManualListingRules.MaxDescriptionLength} characters or fewer" });

        var images = request.Photos ?? new List<IFormFile>();
        if (images.Count == 0)
            return BadRequest(new { error = "Add at least one photo" });
        if (images.Count > ManualListingRules.MaxPhotos)
            return BadRequest(new { error = $"You can add up to {ManualListingRules.MaxPhotos} photos" });
        foreach (var image in images)
        {
            if (image.Length == 0)
                return BadRequest(new { error = $"{image.FileName} is empty. Remove it and try again." });
            if (image.Length > ManualListingRules.MaxPhotoBytes)
                return BadRequest(new { error = $"{image.FileName} is over 10MB. Remove it or pick a smaller photo." });
            if (!ManualListingRules.PhotoContentTypes.Contains((image.ContentType ?? string.Empty).ToLowerInvariant()))
                return BadRequest(new { error = $"{image.FileName} isn't a JPEG, PNG, GIF, or WebP photo." });
        }

        // Photos go up first, under an id chosen now; the listing is inserted once, complete,
        // so the shop never shows a guitar with half its photos.
        var id = MongoDB.Bson.ObjectId.GenerateNewId().ToString();
        var photoUrls = new List<string>();
        try
        {
            for (var i = 0; i < images.Count; i++)
            {
                var image = images[i];
                // Numbered so the stored objects sort in display order.
                var key = $"listings/{id}/{i + 1:D2}-{Guid.NewGuid():N}{Path.GetExtension(image.FileName).ToLowerInvariant()}";
                using var stream = image.OpenReadStream();
                photoUrls.Add(await _fileStorage.UploadAsync(key, stream, image.ContentType));
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Photo upload failed while creating a manual listing");
            await CleanUpPhotosAsync(id);
            return StatusCode(500, new { error = "The photos didn't upload. Nothing was created, so please try again." });
        }

        var now = DateTime.UtcNow;
        var listing = new MyListing
        {
            Id = id,
            ListingTitle = title,
            Description = ManualListingRules.DescriptionToHtml(request.Description),
            Images = photoUrls,
            ReverbLink = null,
            Condition = request.Condition,
            Price = request.Price,
            OriginalPrice = request.Price,
            Currency = "USD",
            ScrapedAt = now,
            ListedAt = now
        };

        try
        {
            await _mongoDbService.CreateManualListingAsync(listing);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Saving a manual listing failed");
            await CleanUpPhotosAsync(id);
            return StatusCode(500, new { error = "Something went wrong saving the listing. Nothing was created, so please try again." });
        }

        // Same "for_sale" finance row the scraper opens for a new Reverb listing. The
        // listing is already live at this point, so a failure here must not fail the request.
        try
        {
            await _mongoDbService.CreateTransactionAsync(new Transaction
            {
                Date = now,
                GuitarName = title,
                ListingId = id,
                PurchasePrice = request.PurchasePrice ?? request.Price,
                TransactionType = "for_sale",
                CreatedAt = now,
                UpdatedAt = now
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Manual listing {Id} was created but its finance transaction was not", id);
        }

        _logger.LogInformation("Created manual listing {Id}: {Title}", id, title);

        // Same shape as a row of GET /api/admin/listings so the table can show it at once.
        return Ok(new
        {
            id = listing.Id,
            listing_title = listing.ListingTitle,
            description = listing.Description,
            condition = listing.Condition,
            images = listing.Images,
            price = listing.Price,
            currency = listing.Currency,
            disabled = false,
            featured = false,
            view_count = 0,
            watcher_count = 0,
            is_reserved = false
        });
    }

    private async Task CleanUpPhotosAsync(string id)
    {
        try
        {
            await _fileStorage.DeletePrefixAsync($"listings/{id}/");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Couldn't remove photos of the failed manual listing {Id}", id);
        }
    }
}
