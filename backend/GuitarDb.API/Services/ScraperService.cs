using System.Text.Json;
using GuitarDb.API.Helpers;
using GuitarDb.API.Models;
using GuitarDb.API.Models.Reverb;

namespace GuitarDb.API.Services;

public class ScraperService
{
    private readonly HttpClient _httpClient;
    private readonly MongoDbService _mongoDbService;
    private readonly ILogger<ScraperService> _logger;
    private readonly string _baseUrl;
    private readonly int _pageSize;
    private readonly int _rateLimitDelayMs;
    private readonly JsonSerializerOptions _jsonOptions;

    public ScraperService(
        HttpClient httpClient,
        MongoDbService mongoDbService,
        IConfiguration configuration,
        ILogger<ScraperService> logger)
    {
        _httpClient = httpClient;
        _mongoDbService = mongoDbService;
        _logger = logger;

        var apiKey = configuration["ReverbApi:ApiKey"]
            ?? throw new ArgumentNullException("ReverbApi:ApiKey", "Reverb API key is not configured");
        _baseUrl = configuration["ReverbApi:BaseUrl"] ?? "https://api.reverb.com/api";
        _pageSize = 50;
        _rateLimitDelayMs = 500;

        _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");
        _httpClient.DefaultRequestHeaders.Add("Accept", "application/hal+json");
        _httpClient.DefaultRequestHeaders.Add("Accept-Version", "3.0");

        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        };
    }

    /// <summary>Refreshes the shop's own listings using the configured Reverb API key.</summary>
    public Task<ScraperResult> RunAsync(CancellationToken cancellationToken = default) =>
        RunAsync(sellerId: null, apiToken: null, cancellationToken);

    /// <summary>
    /// Refreshes one guest seller's listings using their own Reverb token. Only listings
    /// owned by that seller are created, updated or disabled.
    /// </summary>
    public Task<ScraperResult> RunForSellerAsync(string sellerId, string apiToken, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(sellerId)) throw new ArgumentException("Seller id is required", nameof(sellerId));
        if (string.IsNullOrWhiteSpace(apiToken)) throw new ArgumentException("Reverb token is required", nameof(apiToken));
        return RunAsync(sellerId, apiToken, cancellationToken);
    }

    /// <summary>
    /// A scrape owns exactly the listings with its own seller id: null for the shop, the
    /// seller's user id otherwise. Everything it reads, disables or updates goes through this,
    /// so one account's scrape can never sweep another account's guitars into /sold.
    /// </summary>
    public static bool IsOwnedBy(MyListing listing, string? sellerId) =>
        string.IsNullOrEmpty(sellerId)
            ? string.IsNullOrEmpty(listing.SellerId)
            : listing.SellerId == sellerId;

    /// <summary>
    /// Checks a Reverb personal access token against the same endpoint the scraper reads.
    /// True = accepted, false = Reverb rejected it. Throws if Reverb could not be reached.
    /// </summary>
    public async Task<bool> ValidateTokenAsync(string apiToken, CancellationToken cancellationToken = default)
    {
        using var response = await GetAsync($"{_baseUrl}/my/listings?per_page=1", apiToken, cancellationToken);
        if (response.StatusCode is System.Net.HttpStatusCode.Unauthorized or System.Net.HttpStatusCode.Forbidden)
        {
            return false;
        }
        response.EnsureSuccessStatusCode();
        return true;
    }

    // The shop's key is the client's default Authorization header; a seller's token
    // replaces it for that one request only.
    private Task<HttpResponseMessage> GetAsync(string url, string? apiToken, CancellationToken cancellationToken)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, url);
        if (!string.IsNullOrEmpty(apiToken))
        {
            request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiToken);
        }
        return _httpClient.SendAsync(request, cancellationToken);
    }

    private async Task<ScraperResult> RunAsync(string? sellerId, string? apiToken, CancellationToken cancellationToken)
    {
        var startTime = DateTime.UtcNow;
        var result = new ScraperResult();

        _logger.LogInformation("===== Starting Scraper Service =====");
        _logger.LogInformation("Start Time: {Time:yyyy-MM-dd HH:mm:ss} UTC", startTime);

        try
        {
            // Step 1: Get existing listings from database
            _logger.LogInformation("Step 1: Fetching existing listings from database...");
            var existingListings = (await _mongoDbService.GetAllListingsForAdminAsync())
                .Where(l => IsOwnedBy(l, sellerId))
                .ToList();
            var existingReverbLinks = existingListings
                .Where(l => !string.IsNullOrEmpty(l.ReverbLink))
                .Select(l => UrlHelper.NormalizeReverbLink(l.ReverbLink)!)
                .ToHashSet();
            _logger.LogInformation("Found {Count} existing listings in database", existingListings.Count);
            result.OutputLines.Add($"Found {existingListings.Count} existing listings in database");

            // Step 2: Fetch my listings from Reverb (summary data)
            _logger.LogInformation("Step 2: Fetching my listings from Reverb...");
            result.OutputLines.Add("Fetching listings from Reverb...");
            var reverbListings = await FetchMyListingsAsync(
                l => l.State.Slug.Equals("live", StringComparison.OrdinalIgnoreCase),
                cancellationToken,
                apiToken: apiToken);
            result.OutputLines.Add($"Fetched {reverbListings.Count} live listings from Reverb");

            // Step 3: Disable listings no longer on Reverb
            var liveReverbLinks = reverbListings
                .Where(l => !string.IsNullOrEmpty(l.ListingUrl))
                .Select(l => UrlHelper.NormalizeReverbLink(l.ListingUrl)!)
                .ToHashSet();

            var linksToDisable = existingReverbLinks
                .Where(link => !liveReverbLinks.Contains(link))
                .ToList();

            if (linksToDisable.Count > 0)
            {
                _logger.LogInformation("Step 3: Disabling {Count} listings no longer on Reverb...", linksToDisable.Count);
                await DisableByReverbLinksAsync(linksToDisable, cancellationToken);
                result.ListingsDisabled = linksToDisable.Count;
                result.OutputLines.Add($"Disabled {linksToDisable.Count} listings no longer on Reverb");
            }
            else
            {
                _logger.LogInformation("Step 3: No listings to disable");
                result.OutputLines.Add("No listings to disable");
            }

            if (reverbListings.Count == 0)
            {
                _logger.LogWarning("No live listings found on Reverb");
                result.OutputLines.Add("No live listings found on Reverb");
                result.Duration = DateTime.UtcNow - startTime;
                return result;
            }

            // Step 4: Fetch full details for each listing to get all photos
            _logger.LogInformation("Step 4: Fetching full details for {Count} listings...", reverbListings.Count);
            result.OutputLines.Add($"Fetching full details for {reverbListings.Count} listings...");
            var myListings = new List<MyListing>();
            var totalPhotos = 0;

            for (var i = 0; i < reverbListings.Count; i++)
            {
                var listing = reverbListings[i];
                _logger.LogInformation("  [{Current}/{Total}] Fetching details for: {Title}",
                    i + 1, reverbListings.Count, listing.Title);

                var detailedListing = await FetchListingDetailsAsync(listing.Id, cancellationToken, apiToken);

                // Fall back to summary data if detail fetch fails
                var myListing = ConvertToMyListing(detailedListing ?? listing);
                myListing.SellerId = sellerId;
                myListings.Add(myListing);
                totalPhotos += myListing.Images.Count;

                // Rate limit between requests
                if (i < reverbListings.Count - 1)
                {
                    await Task.Delay(_rateLimitDelayMs, cancellationToken);
                }
            }

            // Step 5: Upsert listings to database (update existing, insert new)
            _logger.LogInformation("Step 5: Upserting {Count} listings to database...", myListings.Count);
            result.OutputLines.Add($"Upserting {myListings.Count} listings to database...");
            var skipped = 0;
            foreach (var listing in myListings)
            {
                if (!await UpsertByReverbLinkAsync(listing, cancellationToken))
                {
                    skipped++;
                }
            }

            if (skipped > 0)
            {
                result.OutputLines.Add($"Skipped {skipped} listings that already belong to another account on this site");
            }

            result.ListingsScraped = myListings.Count - skipped;
            result.TotalPhotos = totalPhotos;
            result.Duration = DateTime.UtcNow - startTime;
            result.OutputLines.Add($"Scraper completed: {result.ListingsScraped} listings, {totalPhotos} photos");

            _logger.LogInformation("===== SCRAPER SUMMARY =====");
            _logger.LogInformation("Listings Scraped: {Count}", myListings.Count);
            _logger.LogInformation("Total Photos: {Photos}", totalPhotos);
            _logger.LogInformation("Listings Disabled: {Disabled}", result.ListingsDisabled);
            _logger.LogInformation("Duration: {Duration}", result.Duration);

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Scraper failed with error");
            result.Error = ex.Message;
            result.Duration = DateTime.UtcNow - startTime;
            throw;
        }
    }

    private async Task<List<ReverbListing>> FetchMyListingsAsync(
        Func<ReverbListing, bool> keep,
        CancellationToken cancellationToken,
        Dictionary<string, int>? stateTally = null,
        string? stateQuery = null,
        string? apiToken = null)
    {
        var allListings = new List<ReverbListing>();
        var currentPage = 1;
        // No state param means live only. "all" is the only filter value Reverb honours for
        // widening this; state=sold returns nothing even though sold is a real state.slug,
        // so sold listings have to be pulled from state=all and filtered client-side.
        string? nextUrl = $"{_baseUrl}/my/listings?per_page={_pageSize}"
            + (string.IsNullOrEmpty(stateQuery) ? "" : $"&state={stateQuery}");

        _logger.LogInformation("Fetching my Reverb listings...");

        while (!string.IsNullOrEmpty(nextUrl))
        {
            try
            {
                _logger.LogDebug("Fetching page {Page}: {Url}", currentPage, nextUrl);

                using var response = await GetAsync(nextUrl, apiToken, cancellationToken);
                response.EnsureSuccessStatusCode();

                var content = await response.Content.ReadAsStringAsync(cancellationToken);
                var reverbResponse = JsonSerializer.Deserialize<ReverbListingsResponse>(content, _jsonOptions);

                if (reverbResponse == null || reverbResponse.Listings == null)
                {
                    _logger.LogWarning("Received null response from Reverb API");
                    break;
                }

                if (stateTally != null)
                {
                    foreach (var listing in reverbResponse.Listings)
                    {
                        var slug = string.IsNullOrEmpty(listing.State.Slug) ? "unknown" : listing.State.Slug;
                        stateTally[slug] = stateTally.GetValueOrDefault(slug) + 1;
                    }
                }

                var matched = reverbResponse.Listings.Where(keep).ToList();

                allListings.AddRange(matched);

                _logger.LogInformation("Page {Page}: {Count} listings ({Matched} matched, {Total} total)",
                    currentPage, reverbResponse.Listings.Count, matched.Count, allListings.Count);

                nextUrl = reverbResponse.Links?.Next?.Href;

                if (!string.IsNullOrEmpty(nextUrl))
                {
                    await Task.Delay(_rateLimitDelayMs, cancellationToken);
                }

                currentPage++;
            }
            catch (HttpRequestException ex)
            {
                _logger.LogError(ex, "HTTP error while fetching page {Page}", currentPage);
                throw;
            }
            catch (JsonException ex)
            {
                _logger.LogError(ex, "Failed to parse JSON response from page {Page}", currentPage);
                throw;
            }
        }

        _logger.LogInformation("Fetched {Total} matching listings", allListings.Count);

        return allListings;
    }

    // ONE-OFF DIAGNOSTIC: /my/listings returns only live listings (state=all just adds drafts),
    // so sold history has to come from somewhere else. This probes every candidate source in a
    // single call and reports what this account actually returns, without writing anything.
    // Reports field NAMES plus a whitelist of values so buyer PII in orders is never surfaced.
    // Remove alongside BackfillSoldListingsAsync.
    public async Task<List<ReverbProbeResult>> ProbeSoldSourcesAsync(CancellationToken cancellationToken = default)
    {
        var candidates = new[]
        {
            $"{_baseUrl}/my/listings?per_page=50&state=all",
            $"{_baseUrl}/my/listings?per_page=50&state=sold",
            $"{_baseUrl}/my/listings?per_page=50&state=ended",
            $"{_baseUrl}/my/orders/selling/all?per_page=50",
            $"{_baseUrl}/my/orders/selling/unpaid?per_page=5",
        };

        var results = new List<ReverbProbeResult>();

        foreach (var url in candidates)
        {
            var probe = new ReverbProbeResult { Url = url.Replace(_baseUrl, "") };

            try
            {
                var response = await _httpClient.GetAsync(url, cancellationToken);
                probe.Status = (int)response.StatusCode;
                var content = await response.Content.ReadAsStringAsync(cancellationToken);

                if (!response.IsSuccessStatusCode)
                {
                    probe.Note = content.Length > 200 ? content[..200] : content;
                    results.Add(probe);
                    await Task.Delay(_rateLimitDelayMs, cancellationToken);
                    continue;
                }

                using var doc = JsonDocument.Parse(content);
                var root = doc.RootElement;

                if (root.TryGetProperty("total", out var totalEl) && totalEl.ValueKind == JsonValueKind.Number)
                {
                    probe.TotalReported = totalEl.GetInt32();
                }

                // The collection lives under "listings" or "orders" depending on the endpoint.
                JsonElement items = default;
                foreach (var name in new[] { "listings", "orders" })
                {
                    if (root.TryGetProperty(name, out items) && items.ValueKind == JsonValueKind.Array)
                    {
                        probe.CollectionName = name;
                        break;
                    }
                }

                if (probe.CollectionName == null)
                {
                    probe.Note = "no listings/orders array; top-level keys: " +
                        string.Join(",", root.EnumerateObject().Select(p => p.Name).Take(15));
                    results.Add(probe);
                    await Task.Delay(_rateLimitDelayMs, cancellationToken);
                    continue;
                }

                probe.ReturnedCount = items.GetArrayLength();

                foreach (var item in items.EnumerateArray())
                {
                    if (item.TryGetProperty("state", out var st) && st.ValueKind == JsonValueKind.Object
                        && st.TryGetProperty("slug", out var slug))
                    {
                        var s = slug.GetString() ?? "unknown";
                        probe.StateTally[s] = probe.StateTally.GetValueOrDefault(s) + 1;
                    }
                    else if (item.TryGetProperty("status", out var status) && status.ValueKind == JsonValueKind.String)
                    {
                        var s = status.GetString() ?? "unknown";
                        probe.StateTally[s] = probe.StateTally.GetValueOrDefault(s) + 1;
                    }
                }

                if (probe.ReturnedCount > 0)
                {
                    var first = items[0];
                    probe.SampleFields = first.EnumerateObject().Select(p => p.Name).ToList();

                    if (first.TryGetProperty("_links", out var links) && links.ValueKind == JsonValueKind.Object)
                    {
                        probe.SampleLinks = links.EnumerateObject().Select(p => p.Name).ToList();
                    }

                    // Whitelisted values only — never echo buyer_name, addresses, or contact info.
                    foreach (var field in new[] { "title", "created_at", "paid_at", "status", "sku", "product_id", "order_number" })
                    {
                        if (first.TryGetProperty(field, out var val) && val.ValueKind != JsonValueKind.Null)
                        {
                            probe.SampleValues[field] = val.ValueKind == JsonValueKind.String
                                ? val.GetString() ?? ""
                                : val.ToString();
                        }
                    }

                    if (first.TryGetProperty("photos", out var photos) && photos.ValueKind == JsonValueKind.Array)
                    {
                        probe.SampleValues["photos.count"] = photos.GetArrayLength().ToString();
                    }

                    if (first.TryGetProperty("amount_product", out var amt) && amt.ValueKind == JsonValueKind.Object
                        && amt.TryGetProperty("amount", out var amtVal))
                    {
                        probe.SampleValues["amount_product.amount"] = amtVal.ToString();
                    }
                }
            }
            catch (Exception ex)
            {
                probe.Note = $"{ex.GetType().Name}: {ex.Message}";
            }

            results.Add(probe);
            await Task.Delay(_rateLimitDelayMs, cancellationToken);
        }

        return results;
    }

    // ONE-OFF MAINTENANCE: backfills Reverb listings that sold before this site existed so
    // they show up in the public /sold gallery. Insert-only, and deliberately never writes
    // to the transactions collection so the finance dashboard is untouched.
    // Remove this method, its result types, the admin endpoint, and the admin button once run.
    // Collapses a Reverb title to a comparison key: case, punctuation and spacing vary between
    // a listing and its relist, so only letters and digits are kept.
    private static string NormalizeTitle(string? title)
    {
        if (string.IsNullOrWhiteSpace(title)) return string.Empty;

        var chars = title
            .ToLowerInvariant()
            .Where(c => char.IsLetterOrDigit(c) || char.IsWhiteSpace(c))
            .ToArray();

        return string.Join(' ', new string(chars).Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }

    public async Task<SoldBackfillResult> BackfillSoldListingsAsync(
        bool confirm,
        int maxPerRun = 40,
        bool includeEnded = false,
        CancellationToken cancellationToken = default)
    {
        var startTime = DateTime.UtcNow;
        var result = new SoldBackfillResult { Confirmed = confirm };

        _logger.LogInformation("===== Sold-listing backfill ({Mode}) =====", confirm ? "COMMIT" : "PREVIEW");

        // Every listing already on the site, live or disabled. These are never touched.
        var existingLinks = (await _mongoDbService.GetAllListingsForAdminAsync())
            .Where(l => !string.IsNullOrEmpty(l.ReverbLink))
            .Select(l => UrlHelper.NormalizeReverbLink(l.ReverbLink)!)
            .ToHashSet();
        result.OutputLines.Add($"{existingLinks.Count} listings already on the site");

        var stateTally = new Dictionary<string, int>();
        var allListings = await FetchMyListingsAsync(
            _ => true,
            cancellationToken,
            stateTally,
            stateQuery: "all");

        result.StateTally = stateTally;
        result.TotalReverbListings = stateTally.Values.Sum();
        result.OutputLines.Add(
            $"Reverb returned {result.TotalReverbListings} listings: " +
            string.Join(", ", stateTally.OrderByDescending(kv => kv.Value).Select(kv => $"{kv.Key}={kv.Value}")));

        bool InState(ReverbListing l, string slug) =>
            l.State.Slug.Equals(slug, StringComparison.OrdinalIgnoreCase);

        var soldListings = allListings.Where(l => InState(l, "sold")).ToList();
        var endedListings = allListings.Where(l => InState(l, "ended")).ToList();

        result.SoldOnReverb = soldListings.Count;
        result.EndedOnReverb = endedListings.Count;

        // Every sold listing is a real sale, so same-title sold entries are kept: two units of
        // the same model genuinely sold twice. Ended listings are the opposite problem — an
        // ended listing is usually a relist of something that later sold, or stock still on
        // hand, so those are guarded on title to avoid the same guitar landing twice.
        var candidates = new List<ReverbListing>(soldListings);

        if (includeEnded)
        {
            var blockedTitles = (await _mongoDbService.GetAllListingsForAdminAsync())
                .Select(l => NormalizeTitle(l.ListingTitle))
                .Concat(allListings.Where(l => InState(l, "live")).Select(l => NormalizeTitle(l.Title)))
                .Concat(soldListings.Select(l => NormalizeTitle(l.Title)))
                .Where(t => !string.IsNullOrEmpty(t))
                .ToHashSet();

            // Newest first, so a relist chain collapses onto its most recent entry.
            foreach (var listing in endedListings.OrderByDescending(l => l.PublishedAt ?? DateTime.MinValue))
            {
                var title = NormalizeTitle(listing.Title);

                if (!string.IsNullOrEmpty(title) && !blockedTitles.Add(title))
                {
                    result.EndedSkippedDuplicateTitle++;
                    continue;
                }

                candidates.Add(listing);
            }

            result.OutputLines.Add(
                $"Ended listings: {endedListings.Count} on Reverb, " +
                $"{result.EndedSkippedDuplicateTitle} skipped as relists or still-in-stock duplicates");
        }
        else
        {
            result.OutputLines.Add($"Ended listings excluded ({endedListings.Count} on Reverb)");
        }

        // Dedupe: skip anything already on the site, and collapse repeats within the feed itself.
        var seenLinks = new HashSet<string>();
        var toImport = new List<ReverbListing>();

        foreach (var listing in candidates)
        {
            var link = UrlHelper.NormalizeReverbLink(listing.ListingUrl);

            if (string.IsNullOrEmpty(link))
            {
                result.SkippedNoLink++;
                continue;
            }

            if (existingLinks.Contains(link))
            {
                result.AlreadyOnSite++;
                continue;
            }

            if (!seenLinks.Add(link))
            {
                result.DuplicatesInFeed++;
                continue;
            }

            toImport.Add(listing);
        }

        result.OutputLines.Add(
            $"{candidates.Count} candidates, {result.AlreadyOnSite} already on the site, " +
            $"{result.DuplicatesInFeed} duplicate links in feed, {result.SkippedNoLink} without a link");

        result.PendingTotal = toImport.Count;

        if (!confirm)
        {
            result.Items = toImport.Select(l => new SoldBackfillItem
            {
                Title = l.Title,
                ReverbLink = UrlHelper.NormalizeReverbLink(l.ListingUrl),
                Price = l.Price?.Amount ?? 0,
                ListedAt = l.PublishedAt,
                Photos = l.AllImageUrls.Count,
                State = l.State.Slug
            }).ToList();

            result.Duration = DateTime.UtcNow - startTime;
            result.OutputLines.Add($"PREVIEW ONLY — nothing written. {toImport.Count} listings would be imported.");
            return result;
        }

        // Each listing needs its own detail fetch for the full photo set, so a large backfill
        // would outlast the browser's patience in one request. Cap each run and let the caller
        // click again — the whole thing is insert-only and idempotent, so batches just resume.
        if (maxPerRun > 0 && toImport.Count > maxPerRun)
        {
            toImport = toImport.Take(maxPerRun).ToList();
        }

        // Committing. Use CancellationToken.None from here on so a browser timeout mid-run
        // cannot abandon the import partway through a listing.
        for (var i = 0; i < toImport.Count; i++)
        {
            var summary = toImport[i];
            _logger.LogInformation("  [{Current}/{Total}] Importing sold listing: {Title}",
                i + 1, toImport.Count, summary.Title);

            // The summary payload carries few photos; the detail endpoint has the full set.
            var detailed = await FetchListingDetailsAsync(summary.Id, CancellationToken.None) ?? summary;

            var myListing = ConvertToMyListing(detailed);
            myListing.Disabled = true;   // this, and only this, is what puts it in the /sold gallery
            myListing.Pending = false;

            var created = await _mongoDbService.CreateMyListingAsync(myListing);

            // CreateMyListingAsync stamps ScrapedAt with "now", which would bury genuinely
            // recent sales on the /sold page (it sorts by ScrapedAt). Restore the sale-era date.
            if (!string.IsNullOrEmpty(created.Id))
            {
                created.ScrapedAt = detailed.PublishedAt ?? created.ScrapedAt;
                await _mongoDbService.UpdateMyListingAsync(created.Id, created);
            }

            result.Imported++;
            result.TotalPhotos += myListing.Images.Count;
            result.Items.Add(new SoldBackfillItem
            {
                Title = myListing.ListingTitle,
                ReverbLink = myListing.ReverbLink,
                Price = myListing.Price,
                ListedAt = myListing.ListedAt,
                Photos = myListing.Images.Count,
                State = detailed.State.Slug
            });

            if (i < toImport.Count - 1)
            {
                await Task.Delay(_rateLimitDelayMs, CancellationToken.None);
            }
        }

        result.Remaining = Math.Max(0, result.PendingTotal - result.Imported);
        result.Duration = DateTime.UtcNow - startTime;
        result.OutputLines.Add($"Imported {result.Imported} sold listings ({result.TotalPhotos} photos). No transactions written.");
        if (result.Remaining > 0)
        {
            result.OutputLines.Add($"{result.Remaining} still to go — run it again to continue.");
        }

        _logger.LogInformation("===== Backfill imported {Count} sold listings in {Duration} =====",
            result.Imported, result.Duration);

        return result;
    }

    private async Task<ReverbListing?> FetchListingDetailsAsync(long listingId, CancellationToken cancellationToken, string? apiToken = null)
    {
        var url = $"{_baseUrl}/listings/{listingId}";

        try
        {
            using var response = await GetAsync(url, apiToken, cancellationToken);
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync(cancellationToken);
            // Individual listing endpoint returns the listing directly (not wrapped)
            return JsonSerializer.Deserialize<ReverbListing>(content, _jsonOptions);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to fetch details for listing {ListingId}", listingId);
            return null;
        }
    }

    private MyListing ConvertToMyListing(ReverbListing reverb)
    {
        var scrapedPrice = reverb.Price?.Amount ?? 0;
        return new MyListing
        {
            ListingTitle = reverb.Title,
            Description = reverb.Description,
            Images = reverb.AllImageUrls,
            ReverbLink = UrlHelper.NormalizeReverbLink(reverb.ListingUrl),
            Condition = reverb.Condition?.DisplayName,
            Price = scrapedPrice,
            OriginalPrice = scrapedPrice,
            Currency = reverb.Price?.Currency ?? "USD",
            ScrapedAt = DateTime.UtcNow,
            ListedAt = reverb.PublishedAt
        };
    }

    /// <returns>False when the Reverb link is already on the site under a different owner and was left alone.</returns>
    private async Task<bool> UpsertByReverbLinkAsync(MyListing listing, CancellationToken cancellationToken)
    {
        // Check if listing exists
        var existing = await _mongoDbService.GetMyListingByReverbLinkAsync(listing.ReverbLink);

        if (existing != null)
        {
            if (!IsOwnedBy(existing, listing.SellerId))
            {
                _logger.LogWarning("Skipping {Link}: already on the site under a different owner", listing.ReverbLink);
                return false;
            }

            // Update existing - preserve Id, Disabled status, and admin-set Price
            listing.Id = existing.Id;
            listing.Disabled = existing.Disabled;
            // Keep the admin-set price, only update OriginalPrice from scrape
            listing.Price = existing.Price;
            await _mongoDbService.UpdateMyListingAsync(existing.Id!, listing);
        }
        else
        {
            // Insert new
            await _mongoDbService.CreateMyListingAsync(listing);

            // Auto-create a "for_sale" transaction so it shows in the finance tracker.
            // Only for the shop's own stock: a guest seller's guitar is not shop inventory.
            if (string.IsNullOrEmpty(listing.SellerId))
            {
                var transaction = new Transaction
                {
                    Date = DateTime.UtcNow,
                    GuitarName = listing.ListingTitle,
                    ListingId = listing.Id,
                    PurchasePrice = listing.Price,
                    TransactionType = "for_sale",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                await _mongoDbService.CreateTransactionAsync(transaction);
            }
        }

        return true;
    }

    private async Task DisableByReverbLinksAsync(List<string> reverbLinks, CancellationToken cancellationToken)
    {
        await _mongoDbService.DisableByReverbLinksAsync(reverbLinks);
    }
}

// ONE-OFF DIAGNOSTIC: remove alongside ProbeSoldSourcesAsync.
public class ReverbProbeResult
{
    public string Url { get; set; } = string.Empty;
    public int Status { get; set; }
    public int? TotalReported { get; set; }
    public string? CollectionName { get; set; }
    public int ReturnedCount { get; set; }
    public Dictionary<string, int> StateTally { get; set; } = new();
    public List<string> SampleFields { get; set; } = new();
    public List<string> SampleLinks { get; set; } = new();
    public Dictionary<string, string> SampleValues { get; set; } = new();
    public string? Note { get; set; }
}

// ONE-OFF MAINTENANCE: remove alongside BackfillSoldListingsAsync.
public class SoldBackfillResult
{
    public bool Confirmed { get; set; }
    public int TotalReverbListings { get; set; }
    public int SoldOnReverb { get; set; }
    public int EndedOnReverb { get; set; }
    public int EndedSkippedDuplicateTitle { get; set; }
    public int AlreadyOnSite { get; set; }
    public int DuplicatesInFeed { get; set; }
    public int SkippedNoLink { get; set; }
    public int Imported { get; set; }
    public int PendingTotal { get; set; }
    public int Remaining { get; set; }
    public int TotalPhotos { get; set; }
    public TimeSpan Duration { get; set; }
    public Dictionary<string, int> StateTally { get; set; } = new();
    public List<SoldBackfillItem> Items { get; set; } = new();
    public List<string> OutputLines { get; set; } = new();
}

// ONE-OFF MAINTENANCE: remove alongside BackfillSoldListingsAsync.
public class SoldBackfillItem
{
    public string Title { get; set; } = string.Empty;
    public string? ReverbLink { get; set; }
    public decimal Price { get; set; }
    public DateTime? ListedAt { get; set; }
    public int Photos { get; set; }
    public string State { get; set; } = string.Empty;
}

public class ScraperResult
{
    public int ListingsScraped { get; set; }
    public int TotalPhotos { get; set; }
    public int ListingsDisabled { get; set; }
    public TimeSpan Duration { get; set; }
    public string? Error { get; set; }
    public List<string> OutputLines { get; set; } = new();
}
