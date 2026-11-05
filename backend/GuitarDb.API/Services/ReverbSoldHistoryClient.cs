using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using GuitarDb.API.Models;

namespace GuitarDb.API.Services;

/// <summary>
/// Reads a Reverb product's sold transactions from the GraphQL query behind the price
/// guide on reverb.com product pages (priceRecordsSearch). Not an official API: Reverb
/// could change or block it, so every failure returns null and the deal finders fail loudly
/// when most lookups break.
/// </summary>
public class ReverbSoldHistoryClient
{
    private const string Url = "https://gql.reverb.com/graphql";
    private const int PageSize = 250;
    private const int MaxRecords = 1000;

    private const string Query = """
        query Search_PriceGuideTool_TransactionTable($canonicalProductIds: [String], $sellerCountries: [String], $conditionSlugs: [String], $createdAfterDate: String, $actionableStatuses: [String], $limit: Int, $offset: Int) {
          priceRecordsSearch(input: {canonicalProductIds: $canonicalProductIds, sellerCountries: $sellerCountries, listingConditionSlugs: $conditionSlugs, createdAfterDate: $createdAfterDate, actionableStatuses: $actionableStatuses, limit: $limit, offset: $offset}) {
            priceRecords { condition { displayName } createdAt { seconds } amountProduct { amountCents currency } listingId }
            total
          }
        }
        """;

    /// <summary>Good to Mint - the conditions the median is taken over.</summary>
    private static readonly string[] ConditionSlugs = { "mint", "excellent", "very-good", "good" };

    private readonly HttpClient _httpClient;
    private readonly ILogger<ReverbSoldHistoryClient> _logger;
    private readonly JsonSerializerOptions _jsonOptions = new() { PropertyNameCaseInsensitive = true };

    public ReverbSoldHistoryClient(HttpClient httpClient, ILogger<ReverbSoldHistoryClient> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
        _httpClient.DefaultRequestHeaders.Add("X-Reverb-App", "REVERB");
        _httpClient.DefaultRequestHeaders.Add("X-Display-Currency", "USD");
        _httpClient.DefaultRequestHeaders.Add("X-Shipping-Region", "US_CON");
        _httpClient.DefaultRequestHeaders.Add("X-Graphql-Operation", "query Search_PriceGuideTool_TransactionTable");
    }

    /// <summary>
    /// US sales in Good to Mint condition since <paramref name="sinceUtc"/>, newest first, or
    /// null when the query fails. Shipped, picked-up and received orders only, like Reverb's table.
    /// </summary>
    public async Task<List<ProductSale>?> FetchSalesAsync(IReadOnlyList<string> canonicalProductIds, DateTime sinceUtc, CancellationToken ct = default)
    {
        if (canonicalProductIds.Count == 0) return new List<ProductSale>();

        var sales = new List<ProductSale>();
        var offset = 0;

        try
        {
            while (offset < MaxRecords)
            {
                var payload = JsonSerializer.Serialize(new
                {
                    operationName = "Search_PriceGuideTool_TransactionTable",
                    query = Query,
                    variables = new
                    {
                        canonicalProductIds,
                        conditionSlugs = ConditionSlugs,
                        sellerCountries = new[] { "US" },
                        actionableStatuses = new[] { "shipped", "picked_up", "received" },
                        createdAfterDate = sinceUtc.ToString("yyyy-MM-dd"),
                        limit = PageSize,
                        offset,
                    },
                });

                using var response = await _httpClient.PostAsync(Url, new StringContent(payload, Encoding.UTF8, "application/json"), ct);
                var content = await response.Content.ReadAsStringAsync(ct);
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Sold history query returned HTTP {Status}: {Body}", (int)response.StatusCode, Truncate(content));
                    return null;
                }

                var result = JsonSerializer.Deserialize<GraphQlResponse>(content, _jsonOptions);
                if (result?.Errors is { Count: > 0 } || result?.Data?.PriceRecordsSearch == null)
                {
                    _logger.LogWarning("Sold history query returned errors: {Body}", Truncate(content));
                    return null;
                }

                var page = result.Data.PriceRecordsSearch;
                foreach (var record in page.PriceRecords)
                {
                    if (record.CreatedAt?.Seconds is not { } seconds || record.AmountProduct?.AmountCents is not { } cents || cents <= 0)
                        continue;
                    if (record.AmountProduct.Currency is { } currency && !currency.Equals("USD", StringComparison.OrdinalIgnoreCase))
                        continue;

                    sales.Add(new ProductSale
                    {
                        SoldAt = DateTimeOffset.FromUnixTimeSeconds(seconds).UtcDateTime,
                        Condition = record.Condition?.DisplayName,
                        Amount = cents / 100m,
                        ListingId = record.ListingId,
                    });
                }

                offset += PageSize;
                if (page.PriceRecords.Count < PageSize || offset >= page.Total) break;
            }

            return sales.OrderByDescending(s => s.SoldAt).ToList();
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogWarning(ex, "Sold history query failed for products {Ids}", string.Join(",", canonicalProductIds));
            return null;
        }
    }

    private static string Truncate(string text) => text.Length > 300 ? text[..300] : text;

    private class GraphQlResponse
    {
        public GraphQlData? Data { get; set; }
        public List<JsonElement>? Errors { get; set; }
    }

    private class GraphQlData
    {
        public PriceRecordsPage? PriceRecordsSearch { get; set; }
    }

    private class PriceRecordsPage
    {
        public List<PriceRecord> PriceRecords { get; set; } = new();
        public int Total { get; set; }
    }

    private class PriceRecord
    {
        public NamedValue? Condition { get; set; }
        public Timestamp? CreatedAt { get; set; }
        public Money? AmountProduct { get; set; }
        public string? ListingId { get; set; }
    }

    private class NamedValue
    {
        public string? DisplayName { get; set; }
    }

    private class Timestamp
    {
        [JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
        public long? Seconds { get; set; }
    }

    private class Money
    {
        [JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
        public long? AmountCents { get; set; }
        public string? Currency { get; set; }
    }
}
