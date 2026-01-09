using MongoDB.Bson.Serialization.Attributes;

namespace GuitarDb.API.Models;

public class PriceSnapshot
{
    [BsonElement("date")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime Date { get; set; }

    [BsonElement("conditionPricing")]
    public List<ConditionPricing> ConditionPricing { get; set; } = new();

    [BsonElement("totalListingsScraped")]
    public int TotalListingsScraped { get; set; }

    [BsonElement("scrapedAt")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime ScrapedAt { get; set; }
}

public class ConditionPricing
{
    [BsonElement("condition")]
    public GuitarCondition Condition { get; set; }

    [BsonElement("averagePrice")]
    public decimal? AveragePrice { get; set; }

    [BsonElement("minPrice")]
    public decimal? MinPrice { get; set; }

    [BsonElement("maxPrice")]
    public decimal? MaxPrice { get; set; }

    [BsonElement("listingCount")]
    public int ListingCount { get; set; }

    [BsonElement("currency")]
    public string Currency { get; set; } = "USD";
}

public enum GuitarCondition
{
    BrandNew,
    Mint,
    Excellent,
    VeryGood,
    Good,
    Fair,
    Poor
}
