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
    public string Make { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string? Finish { get; set; }
    public int? Year { get; set; }
}
