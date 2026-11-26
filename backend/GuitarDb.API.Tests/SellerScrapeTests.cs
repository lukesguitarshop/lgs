using System.Net;
using GuitarDb.API.Models;
using GuitarDb.API.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace GuitarDb.API.Tests;

public class SellerScrapeTests
{
    private const string SellerA = "64b000000000000000000001";
    private const string SellerB = "64b000000000000000000002";

    [Fact]
    public void ShopScrape_OwnsOnlyListingsWithoutASeller()
    {
        Assert.True(ScraperService.IsOwnedBy(new MyListing(), sellerId: null));
        Assert.False(ScraperService.IsOwnedBy(new MyListing { SellerId = SellerA }, sellerId: null));
    }

    [Fact]
    public void SellerScrape_OwnsOnlyThatSellersListings()
    {
        Assert.True(ScraperService.IsOwnedBy(new MyListing { SellerId = SellerA }, SellerA));
        Assert.False(ScraperService.IsOwnedBy(new MyListing { SellerId = SellerB }, SellerA));
        Assert.False(ScraperService.IsOwnedBy(new MyListing(), SellerA));
    }

    [Fact]
    public void Token_RoundTrips_AndIsNotStoredInTheClear()
    {
        var stored = SecretProtector.Protect("reverb-token-123", "master-secret");

        Assert.DoesNotContain("reverb-token-123", stored);
        Assert.Equal("reverb-token-123", SecretProtector.Unprotect(stored, "master-secret"));
    }

    [Fact]
    public void Token_EncryptsDifferentlyEachTime()
    {
        Assert.NotEqual(
            SecretProtector.Protect("reverb-token-123", "master-secret"),
            SecretProtector.Protect("reverb-token-123", "master-secret"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not-a-protected-value")]
    [InlineData("v1:###")]
    [InlineData("v1:AAAA")]
    public void Unprotect_ReturnsNullForUnusableValues(string? stored)
    {
        Assert.Null(SecretProtector.Unprotect(stored, "master-secret"));
    }

    [Fact]
    public void Unprotect_ReturnsNullUnderADifferentMasterSecret()
    {
        var stored = SecretProtector.Protect("reverb-token-123", "master-secret");

        Assert.Null(SecretProtector.Unprotect(stored, "rotated-secret"));
    }

    [Fact]
    public void Unprotect_ReturnsNullWhenTamperedWith()
    {
        var stored = SecretProtector.Protect("reverb-token-123", "master-secret");
        var bytes = Convert.FromBase64String(stored[3..]);
        bytes[^1] ^= 0x01;

        Assert.Null(SecretProtector.Unprotect("v1:" + Convert.ToBase64String(bytes), "master-secret"));
    }

    private sealed class RecordingHandler(HttpStatusCode status) : HttpMessageHandler
    {
        public List<string> AuthorizationHeaders { get; } = new();

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            AuthorizationHeaders.AddRange(request.Headers.GetValues("Authorization"));
            return Task.FromResult(new HttpResponseMessage(status) { Content = new StringContent("{}") });
        }
    }

    private static ScraperService ScraperWith(RecordingHandler handler)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["ReverbApi:ApiKey"] = "shop-key" })
            .Build();

        // Token validation never touches the database.
        return new ScraperService(new HttpClient(handler), null!, configuration, NullLogger<ScraperService>.Instance);
    }

    [Fact]
    public async Task SellerRequests_CarryTheSellersToken_NotTheShopKey()
    {
        var handler = new RecordingHandler(HttpStatusCode.OK);

        Assert.True(await ScraperWith(handler).ValidateTokenAsync("seller-token"));
        Assert.Equal(new[] { "Bearer seller-token" }, handler.AuthorizationHeaders);
    }

    [Theory]
    [InlineData(HttpStatusCode.Unauthorized)]
    [InlineData(HttpStatusCode.Forbidden)]
    public async Task ATokenReverbRejects_IsReportedAsInvalid(HttpStatusCode status)
    {
        Assert.False(await ScraperWith(new RecordingHandler(status)).ValidateTokenAsync("bad-token"));
    }

    [Fact]
    public async Task AReverbOutage_IsNotMistakenForABadToken()
    {
        var scraper = ScraperWith(new RecordingHandler(HttpStatusCode.ServiceUnavailable));

        await Assert.ThrowsAsync<HttpRequestException>(() => scraper.ValidateTokenAsync("seller-token"));
    }
}
