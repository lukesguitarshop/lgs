namespace GuitarDb.API.Models;

public class SweetwaterListing
{
    public long ListingId { get; set; }
    public string Title { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public decimal? OriginalPrice { get; set; }
    public string? Condition { get; set; }
    public string? ImageUrl { get; set; }
    public string ListingUrl { get; set; } = string.Empty;
    public string? Shipping { get; set; }
    /// <summary>Shipping in dollars when Sweetwater states it ("$99.00 Shipping", "Free Shipping").</summary>
    public decimal? ShippingPrice { get; set; }
    public DateTime? PublishedAt { get; set; }

    // Gear Exchange is a marketplace - every listing has its own seller
    public long? SellerUserId { get; set; }
    public string? SellerName { get; set; }
    public string? SellerSlug { get; set; }
    public string? SellerLocation { get; set; }
    /// <summary>How many listings the seller has up across all of Gear Exchange.</summary>
    public int? SellerListingCount { get; set; }
    public string Make { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string? Finish { get; set; }
    public int? Year { get; set; }
}
