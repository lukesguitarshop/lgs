using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace GuitarDb.API.Services;

public class UpsTrackingService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<UpsTrackingService> _logger;
    private readonly HttpClient _httpClient;
    private readonly string? _clientId;
    private readonly string? _clientSecret;
    private readonly string? _baseUrl;
    private readonly bool _isEnabled;
    private string? _accessToken;
    private DateTime _tokenExpiry = DateTime.MinValue;

    public UpsTrackingService(IConfiguration configuration, ILogger<UpsTrackingService> logger, HttpClient httpClient)
    {
        _configuration = configuration;
        _logger = logger;
        _httpClient = httpClient;

        _clientId = _configuration["UPS:ClientId"];
        _clientSecret = _configuration["UPS:ClientSecret"];
        _baseUrl = _configuration["UPS:BaseUrl"] ?? "https://onlinetools.ups.com";

        _isEnabled = !string.IsNullOrEmpty(_clientId) && !string.IsNullOrEmpty(_clientSecret);

        if (!_isEnabled)
        {
            _logger.LogWarning("UPS tracking service is disabled - credentials not configured");
        }
    }

    public bool IsEnabled => _isEnabled;

    private async Task<string?> GetAccessTokenAsync()
    {
        if (!_isEnabled) return null;

        // Return cached token if still valid
        if (!string.IsNullOrEmpty(_accessToken) && DateTime.UtcNow < _tokenExpiry)
        {
            return _accessToken;
        }

        try
        {
            var credentials = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{_clientId}:{_clientSecret}"));

            var request = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl}/security/v1/oauth/token");
            request.Headers.Authorization = new AuthenticationHeaderValue("Basic", credentials);
            request.Content = new FormUrlEncodedContent(new[]
            {
                new KeyValuePair<string, string>("grant_type", "client_credentials")
            });

            var response = await _httpClient.SendAsync(request);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("Failed to get UPS access token: {StatusCode}", response.StatusCode);
                return null;
            }

            var content = await response.Content.ReadAsStringAsync();
            var tokenResponse = JsonSerializer.Deserialize<JsonElement>(content);

            _accessToken = tokenResponse.GetProperty("access_token").GetString();
            var expiresIn = tokenResponse.GetProperty("expires_in").GetInt32();
            _tokenExpiry = DateTime.UtcNow.AddSeconds(expiresIn - 60); // Refresh 1 minute early

            return _accessToken;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting UPS access token");
            return null;
        }
    }

    public async Task<TrackingStatus?> GetTrackingStatusAsync(string trackingNumber)
    {
        if (!_isEnabled)
        {
            _logger.LogDebug("UPS tracking disabled, skipping status check for {TrackingNumber}", trackingNumber);
            return null;
        }

        try
        {
            var accessToken = await GetAccessTokenAsync();
            if (string.IsNullOrEmpty(accessToken))
            {
                return null;
            }

            var request = new HttpRequestMessage(
                HttpMethod.Get,
                $"{_baseUrl}/api/track/v1/details/{trackingNumber}?locale=en_US&returnSignature=false"
            );
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            request.Headers.Add("transId", Guid.NewGuid().ToString());
            request.Headers.Add("transactionSrc", "LukesGuitarShop");

            var response = await _httpClient.SendAsync(request);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("UPS tracking request failed for {TrackingNumber}: {StatusCode}",
                    trackingNumber, response.StatusCode);
                return null;
            }

            var content = await response.Content.ReadAsStringAsync();
            var trackingResponse = JsonSerializer.Deserialize<JsonElement>(content);

            return ParseTrackingResponse(trackingResponse);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting UPS tracking status for {TrackingNumber}", trackingNumber);
            return null;
        }
    }

    private TrackingStatus? ParseTrackingResponse(JsonElement response)
    {
        try
        {
            var trackResponse = response.GetProperty("trackResponse");
            var shipment = trackResponse.GetProperty("shipment")[0];
            var package = shipment.GetProperty("package")[0];
            var currentStatus = package.GetProperty("currentStatus");

            var statusCode = currentStatus.GetProperty("code").GetString() ?? "";
            var statusDescription = currentStatus.GetProperty("description").GetString() ?? "";

            // UPS status codes:
            // D = Delivered
            // I = In Transit
            // P = Pickup
            // M = Billing Information Received (Manifest)
            // X = Exception
            var isDelivered = statusCode.Equals("D", StringComparison.OrdinalIgnoreCase) ||
                              statusDescription.Contains("Delivered", StringComparison.OrdinalIgnoreCase);

            string? deliveryDate = null;
            if (package.TryGetProperty("deliveryDate", out var deliveryDateElement))
            {
                var deliveryDates = deliveryDateElement.EnumerateArray().ToList();
                if (deliveryDates.Count > 0)
                {
                    var dateObj = deliveryDates[0];
                    if (dateObj.TryGetProperty("date", out var dateStr))
                    {
                        deliveryDate = dateStr.GetString();
                    }
                }
            }

            return new TrackingStatus
            {
                StatusCode = statusCode,
                StatusDescription = statusDescription,
                IsDelivered = isDelivered,
                DeliveryDate = deliveryDate
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error parsing UPS tracking response");
            return null;
        }
    }
}

public class TrackingStatus
{
    public string StatusCode { get; set; } = string.Empty;
    public string StatusDescription { get; set; } = string.Empty;
    public bool IsDelivered { get; set; }
    public string? DeliveryDate { get; set; }
}
