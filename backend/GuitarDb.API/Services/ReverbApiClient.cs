using GuitarDb.API.DTOs;
using System.Net;
using System.Text.Json;

namespace GuitarDb.API.Services;

public class ReverbApiClient
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<ReverbApiClient> _logger;
    private readonly string _apiKey;
    private readonly string _baseUrl;
    private const int MaxRetries = 3;
    private const int InitialRetryDelayMs = 1000;

    public ReverbApiClient(
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<ReverbApiClient> logger)
    {
        _httpClient = httpClient;
        _logger = logger;

        _apiKey = configuration["ReverbApi:ApiKey"]
            ?? throw new ArgumentNullException("ReverbApi:ApiKey", "Reverb API key is not configured");

        _baseUrl = configuration["ReverbApi:BaseUrl"]
            ?? throw new ArgumentNullException("ReverbApi:BaseUrl", "Reverb API base URL is not configured");

        // Configure HttpClient base address and default headers
        _httpClient.BaseAddress = new Uri(_baseUrl);
        _httpClient.DefaultRequestHeaders.Add("Accept", "application/hal+json");
        _httpClient.DefaultRequestHeaders.Add("Accept-Version", "3.0");
        _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {_apiKey}");
    }

    public async Task<List<ReverbListing>> SearchGuitarsAsync(
        string query,
        int page = 1,
        int perPage = 25,
        CancellationToken cancellationToken = default)
    {
        var retryCount = 0;
        var delay = InitialRetryDelayMs;

        while (retryCount <= MaxRetries)
        {
            try
            {
                // Build query parameters
                var queryParams = new Dictionary<string, string>
                {
                    { "query", query },
                    { "page", page.ToString() },
                    { "per_page", perPage.ToString() }
                };

                var queryString = string.Join("&", queryParams.Select(kvp =>
                    $"{Uri.EscapeDataString(kvp.Key)}={Uri.EscapeDataString(kvp.Value)}"));

                var requestUri = $"/listings?{queryString}";

                _logger.LogInformation("Searching Reverb for guitars: {Query}, Page: {Page}", query, page);

                var response = await _httpClient.GetAsync(requestUri, cancellationToken);

                // Handle rate limiting with exponential backoff
                if (response.StatusCode == HttpStatusCode.TooManyRequests)
                {
                    if (retryCount >= MaxRetries)
                    {
                        _logger.LogError("Rate limit exceeded after {MaxRetries} retries", MaxRetries);
                        throw new HttpRequestException("Rate limit exceeded. Please try again later.");
                    }

                    var retryAfter = response.Headers.RetryAfter?.Delta?.TotalMilliseconds ?? delay;
                    _logger.LogWarning(
                        "Rate limited by Reverb API. Retry {RetryCount}/{MaxRetries} after {Delay}ms",
                        retryCount + 1,
                        MaxRetries,
                        retryAfter);

                    await Task.Delay((int)retryAfter, cancellationToken);
                    retryCount++;
                    delay *= 2; // Exponential backoff
                    continue;
                }

                // Ensure success status code
                response.EnsureSuccessStatusCode();

                var content = await response.Content.ReadAsStringAsync(cancellationToken);

                var options = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                };

                var result = JsonSerializer.Deserialize<ReverbListingResponse>(content, options);

                if (result?.Listings == null)
                {
                    _logger.LogWarning("No listings found in Reverb API response");
                    return new List<ReverbListing>();
                }

                _logger.LogInformation(
                    "Successfully retrieved {Count} listings from Reverb (Total: {Total})",
                    result.Listings.Count,
                    result.Total);

                return result.Listings;
            }
            catch (HttpRequestException ex) when (retryCount < MaxRetries)
            {
                retryCount++;
                _logger.LogWarning(
                    ex,
                    "HTTP error calling Reverb API. Retry {RetryCount}/{MaxRetries} after {Delay}ms",
                    retryCount,
                    MaxRetries,
                    delay);

                await Task.Delay(delay, cancellationToken);
                delay *= 2; // Exponential backoff
            }
            catch (TaskCanceledException ex)
            {
                _logger.LogError(ex, "Request to Reverb API timed out");
                throw new HttpRequestException("Request to Reverb API timed out", ex);
            }
            catch (JsonException ex)
            {
                _logger.LogError(ex, "Failed to parse Reverb API response");
                throw new InvalidOperationException("Failed to parse Reverb API response", ex);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error calling Reverb API");
                throw;
            }
        }

        _logger.LogError("Failed to retrieve listings from Reverb after {MaxRetries} retries", MaxRetries);
        throw new HttpRequestException($"Failed to retrieve listings from Reverb after {MaxRetries} retries");
    }

    public async Task<ReverbListing?> GetListingByIdAsync(
        string listingId,
        CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Fetching Reverb listing: {ListingId}", listingId);

            var response = await _httpClient.GetAsync($"/listings/{listingId}", cancellationToken);
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync(cancellationToken);

            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            };

            var listing = JsonSerializer.Deserialize<ReverbListing>(content, options);

            _logger.LogInformation("Successfully retrieved listing: {ListingId}", listingId);

            return listing;
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "Failed to retrieve listing {ListingId} from Reverb", listingId);
            return null;
        }
        catch (JsonException ex)
        {
            _logger.LogError(ex, "Failed to parse Reverb listing {ListingId}", listingId);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error retrieving listing {ListingId}", listingId);
            return null;
        }
    }
}
