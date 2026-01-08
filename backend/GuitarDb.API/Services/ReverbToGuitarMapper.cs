using GuitarDb.API.DTOs;
using GuitarDb.API.Models;
using System.Text.RegularExpressions;

namespace GuitarDb.API.Services;

public class ReverbToGuitarMapper
{
    private readonly ILogger<ReverbToGuitarMapper> _logger;

    public ReverbToGuitarMapper(ILogger<ReverbToGuitarMapper> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Converts a ReverbListing DTO to a Guitar model
    /// </summary>
    public Guitar MapToGuitar(ReverbListing listing)
    {
        try
        {
            var guitar = new Guitar
            {
                Brand = ExtractBrand(listing),
                Model = ExtractModel(listing),
                Year = ExtractYear(listing),
                Finish = listing.Finish,
                Category = ExtractCategory(listing),
                Specs = ExtractSpecs(listing),
                Images = ExtractImages(listing),
                PriceHistory = new List<PriceSnapshot> { CreatePriceSnapshot(listing) },
                Metadata = new GuitarMetadata
                {
                    CreatedAt = DateTime.UtcNow,
                    LastUpdated = DateTime.UtcNow
                }
            };

            return guitar;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error mapping ReverbListing {ListingId} to Guitar", listing.Id);
            throw;
        }
    }

    /// <summary>
    /// Updates an existing Guitar with a new price snapshot from a ReverbListing
    /// </summary>
    public Guitar UpdateGuitarWithListing(Guitar guitar, ReverbListing listing)
    {
        try
        {
            // Add new price snapshot
            guitar.PriceHistory ??= new List<PriceSnapshot>();
            guitar.PriceHistory.Add(CreatePriceSnapshot(listing));

            // Update images if new ones are available
            var newImages = ExtractImages(listing);
            if (newImages != null && newImages.Count > 0)
            {
                guitar.Images = newImages;
            }

            // Update metadata
            guitar.Metadata.LastUpdated = DateTime.UtcNow;

            return guitar;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating Guitar with ReverbListing {ListingId}", listing.Id);
            throw;
        }
    }

    private string ExtractBrand(ReverbListing listing)
    {
        // Prefer make field, fallback to parsing title
        if (!string.IsNullOrWhiteSpace(listing.Make))
        {
            return listing.Make;
        }

        // Try to extract brand from title
        if (!string.IsNullOrWhiteSpace(listing.Title))
        {
            var firstWord = listing.Title.Split(' ').FirstOrDefault();
            return firstWord ?? "Unknown";
        }

        return "Unknown";
    }

    private string ExtractModel(ReverbListing listing)
    {
        // Prefer model field, fallback to title
        if (!string.IsNullOrWhiteSpace(listing.Model))
        {
            return listing.Model;
        }

        if (!string.IsNullOrWhiteSpace(listing.Title))
        {
            return listing.Title;
        }

        return "Unknown Model";
    }

    private int? ExtractYear(ReverbListing listing)
    {
        // Try to parse year from year field
        if (!string.IsNullOrWhiteSpace(listing.Year))
        {
            if (int.TryParse(listing.Year, out var year))
            {
                // Validate reasonable year range (1900-current year + 1)
                if (year >= 1900 && year <= DateTime.UtcNow.Year + 1)
                {
                    return year;
                }
            }
        }

        // Try to extract year from title or description
        var text = $"{listing.Title} {listing.Description}";
        var yearMatch = Regex.Match(text, @"\b(19\d{2}|20\d{2})\b");
        if (yearMatch.Success && int.TryParse(yearMatch.Value, out var extractedYear))
        {
            if (extractedYear >= 1900 && extractedYear <= DateTime.UtcNow.Year + 1)
            {
                return extractedYear;
            }
        }

        return null;
    }

    private string? ExtractCategory(ReverbListing listing)
    {
        if (listing.Categories != null && listing.Categories.Count > 0)
        {
            return listing.Categories.FirstOrDefault()?.FullName;
        }

        return null;
    }

    private GuitarSpecs? ExtractSpecs(ReverbListing listing)
    {
        if (string.IsNullOrWhiteSpace(listing.Description))
        {
            return null;
        }

        var description = listing.Description.ToLowerInvariant();

        return new GuitarSpecs
        {
            Body = ExtractBodySpecs(description),
            Neck = ExtractNeckSpecs(description),
            Electronics = ExtractElectronicsSpecs(description),
            Hardware = ExtractHardwareSpecs(description)
        };
    }

    private BodySpecs? ExtractBodySpecs(string description)
    {
        var bodySpecs = new BodySpecs();
        var hasData = false;

        // Extract body wood
        var bodyWoods = new[] { "mahogany", "alder", "ash", "maple", "basswood", "walnut", "koa", "rosewood" };
        foreach (var wood in bodyWoods)
        {
            if (description.Contains($"{wood} body") || description.Contains($"body: {wood}"))
            {
                bodySpecs.Wood = char.ToUpper(wood[0]) + wood.Substring(1);
                hasData = true;
                break;
            }
        }

        // Extract top wood
        var topWoods = new[] { "maple", "spruce", "figured maple", "quilted maple", "flamed maple" };
        foreach (var wood in topWoods)
        {
            if (description.Contains($"{wood} top"))
            {
                bodySpecs.Top = char.ToUpper(wood[0]) + wood.Substring(1);
                hasData = true;
                break;
            }
        }

        // Extract binding
        if (description.Contains("binding"))
        {
            var bindingMatch = Regex.Match(description, @"(\w+)\s+binding");
            if (bindingMatch.Success)
            {
                bodySpecs.Binding = bindingMatch.Groups[1].Value;
                hasData = true;
            }
        }

        return hasData ? bodySpecs : null;
    }

    private NeckSpecs? ExtractNeckSpecs(string description)
    {
        var neckSpecs = new NeckSpecs();
        var hasData = false;

        // Extract neck wood
        var neckWoods = new[] { "mahogany", "maple", "rosewood", "ebony", "pau ferro" };
        foreach (var wood in neckWoods)
        {
            if (description.Contains($"{wood} neck") || description.Contains($"neck: {wood}"))
            {
                neckSpecs.Wood = char.ToUpper(wood[0]) + wood.Substring(1);
                hasData = true;
                break;
            }
        }

        // Extract fret count
        var fretMatch = Regex.Match(description, @"(\d{2})\s*frets?");
        if (fretMatch.Success && int.TryParse(fretMatch.Groups[1].Value, out var frets))
        {
            neckSpecs.Frets = frets;
            hasData = true;
        }

        // Extract scale length
        var scaleMatch = Regex.Match(description, @"(\d{2}\.?\d*)['""\s]*(scale|scale length)");
        if (scaleMatch.Success && double.TryParse(scaleMatch.Groups[1].Value, out var scale))
        {
            neckSpecs.ScaleLength = scale;
            hasData = true;
        }

        // Extract neck profile
        var profiles = new[] { "c-shape", "u-shape", "v-shape", "slim taper", "chunky" };
        foreach (var profile in profiles)
        {
            if (description.Contains(profile))
            {
                neckSpecs.Profile = profile;
                hasData = true;
                break;
            }
        }

        return hasData ? neckSpecs : null;
    }

    private ElectronicsSpecs? ExtractElectronicsSpecs(string description)
    {
        var electronics = new ElectronicsSpecs();
        var hasData = false;

        // Extract pickups
        var pickups = new List<string>();
        var pickupTypes = new[]
        {
            "humbucker", "single coil", "p90", "p-90", "mini humbucker",
            "burstbucker", "alnico", "gibson", "seymour duncan", "dimarzio"
        };

        foreach (var pickup in pickupTypes)
        {
            if (description.Contains(pickup))
            {
                pickups.Add(pickup);
            }
        }

        if (pickups.Count > 0)
        {
            electronics.Pickups = pickups;
            hasData = true;
        }

        // Extract controls
        var controls = new List<string>();
        if (description.Contains("volume"))
        {
            controls.Add("Volume");
            hasData = true;
        }
        if (description.Contains("tone"))
        {
            controls.Add("Tone");
            hasData = true;
        }
        if (description.Contains("3-way") || description.Contains("three-way"))
        {
            controls.Add("3-way selector");
            hasData = true;
        }
        if (description.Contains("5-way") || description.Contains("five-way"))
        {
            controls.Add("5-way selector");
            hasData = true;
        }

        if (controls.Count > 0)
        {
            electronics.Controls = controls;
        }

        return hasData ? electronics : null;
    }

    private HardwareSpecs? ExtractHardwareSpecs(string description)
    {
        var hardware = new HardwareSpecs();
        var hasData = false;

        // Extract bridge type
        var bridges = new[]
        {
            "tune-o-matic", "tremolo", "bigsby", "floyd rose",
            "hardtail", "wraparound", "abr-1"
        };

        foreach (var bridge in bridges)
        {
            if (description.Contains(bridge))
            {
                hardware.Bridge = bridge;
                hasData = true;
                break;
            }
        }

        // Extract tailpiece
        if (description.Contains("stopbar") || description.Contains("stop bar"))
        {
            hardware.Tailpiece = "Stopbar";
            hasData = true;
        }
        else if (description.Contains("trapeze"))
        {
            hardware.Tailpiece = "Trapeze";
            hasData = true;
        }

        // Extract tuners
        var tuners = new[] { "grover", "kluson", "gotoh", "schaller" };
        foreach (var tuner in tuners)
        {
            if (description.Contains(tuner))
            {
                hardware.Tuners = char.ToUpper(tuner[0]) + tuner.Substring(1);
                hasData = true;
                break;
            }
        }

        return hasData ? hardware : null;
    }

    private List<string>? ExtractImages(ReverbListing listing)
    {
        if (listing.Photos == null || listing.Photos.Count == 0)
        {
            return null;
        }

        var images = new List<string>();
        foreach (var photo in listing.Photos)
        {
            var imageUrl = photo.Links?.Large?.Href ?? photo.Links?.Small?.Href;
            if (!string.IsNullOrWhiteSpace(imageUrl))
            {
                images.Add(imageUrl);
            }
        }

        return images.Count > 0 ? images : null;
    }

    private PriceSnapshot CreatePriceSnapshot(ReverbListing listing)
    {
        var price = ParsePrice(listing.Price);

        return new PriceSnapshot
        {
            Date = listing.PublishedAt ?? DateTime.UtcNow,
            Source = "Reverb",
            Condition = listing.Condition?.DisplayName,
            AvgPrice = price,
            MinPrice = price,
            MaxPrice = price,
            ListingCount = 1,
            SampleListings = new List<SimplifiedListing>
            {
                new SimplifiedListing
                {
                    ListingId = listing.Id,
                    Title = listing.Title,
                    Price = price ?? 0,
                    Condition = listing.Condition?.DisplayName,
                    Url = listing.Links?.Web?.Href,
                    ImageUrl = listing.Photos?.FirstOrDefault()?.Links?.Large?.Href,
                    ListedDate = listing.PublishedAt
                }
            }
        };
    }

    private decimal? ParsePrice(ReverbPrice? reverbPrice)
    {
        if (reverbPrice == null || string.IsNullOrWhiteSpace(reverbPrice.Amount))
        {
            return null;
        }

        // Remove currency symbols and parse
        var amountStr = reverbPrice.Amount.Replace(",", "").Trim();
        if (decimal.TryParse(amountStr, out var amount))
        {
            return amount;
        }

        _logger.LogWarning("Failed to parse price amount: {Amount}", reverbPrice.Amount);
        return null;
    }
}
