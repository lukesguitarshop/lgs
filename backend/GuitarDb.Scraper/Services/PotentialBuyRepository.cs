using GuitarDb.Scraper.Configuration;
using GuitarDb.Scraper.Models.Domain;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace GuitarDb.Scraper.Services;

public class PotentialBuyRepository
{
    private readonly IMongoCollection<PotentialBuy> _collection;
    private readonly ILogger<PotentialBuyRepository> _logger;

    public PotentialBuyRepository(MongoDbSettings settings, ILogger<PotentialBuyRepository> logger)
    {
        var client = new MongoClient(settings.ConnectionString);
        var database = client.GetDatabase(settings.DatabaseName);
        _collection = database.GetCollection<PotentialBuy>("potential_buys");
        _logger = logger;

        CreateIndexes();
    }

    private void CreateIndexes()
    {
        var indexModels = new List<CreateIndexModel<PotentialBuy>>
        {
            new(Builders<PotentialBuy>.IndexKeys.Ascending(x => x.ReverbListingId),
                new CreateIndexOptions { Unique = true, Name = "reverb_listing_id_unique" }),
            new(Builders<PotentialBuy>.IndexKeys
                .Ascending(x => x.IsDeal)
                .Ascending(x => x.Dismissed),
                new CreateIndexOptions { Name = "is_deal_dismissed_idx" }),
            new(Builders<PotentialBuy>.IndexKeys.Descending(x => x.FirstSeenAt),
                new CreateIndexOptions { Name = "first_seen_at_idx" })
        };

        _collection.Indexes.CreateMany(indexModels);
    }

    public async Task<PotentialBuy?> GetByReverbListingIdAsync(long reverbListingId, CancellationToken ct = default)
    {
        return await _collection
            .Find(x => x.ReverbListingId == reverbListingId)
            .FirstOrDefaultAsync(ct);
    }

    public async Task UpsertAsync(PotentialBuy potentialBuy, CancellationToken ct = default)
    {
        var existing = await GetByReverbListingIdAsync(potentialBuy.ReverbListingId, ct);

        if (existing != null)
        {
            potentialBuy.Id = existing.Id;
            potentialBuy.FirstSeenAt = existing.FirstSeenAt;
            potentialBuy.Dismissed = existing.Dismissed;
            potentialBuy.Purchased = existing.Purchased;
        }

        var filter = Builders<PotentialBuy>.Filter.Eq(x => x.ReverbListingId, potentialBuy.ReverbListingId);
        var options = new ReplaceOptions { IsUpsert = true };

        await _collection.ReplaceOneAsync(filter, potentialBuy, options, ct);
        _logger.LogDebug("Upserted potential buy: {Title}", potentialBuy.ListingTitle);
    }

    public async Task<List<PotentialBuy>> GetAllAsync(CancellationToken ct = default)
    {
        return await _collection.Find(_ => true).ToListAsync(ct);
    }

    public async Task<int> GetDealCountAsync(CancellationToken ct = default)
    {
        return (int)await _collection.CountDocumentsAsync(
            x => x.IsDeal && !x.Dismissed && !x.Purchased,
            cancellationToken: ct);
    }

    public async Task<long> GetTotalCountAsync(CancellationToken ct = default)
    {
        return await _collection.CountDocumentsAsync(_ => true, cancellationToken: ct);
    }

    /// <summary>
    /// Delete listings that weren't seen in the current scrape run (no longer on Reverb).
    /// </summary>
    public async Task<long> DeleteStaleListingsAsync(DateTime scraperRunStartTime, CancellationToken ct = default)
    {
        // Delete active listings (not dismissed/purchased) that weren't updated in this run
        var filter = Builders<PotentialBuy>.Filter.And(
            Builders<PotentialBuy>.Filter.Lt(x => x.LastCheckedAt, scraperRunStartTime),
            Builders<PotentialBuy>.Filter.Eq(x => x.Dismissed, false),
            Builders<PotentialBuy>.Filter.Eq(x => x.Purchased, false)
        );

        var result = await _collection.DeleteManyAsync(filter, ct);
        return result.DeletedCount;
    }

    /// <summary>
    /// Delete old dismissed/purchased records to keep database size manageable.
    /// </summary>
    public async Task<long> DeleteOldResolvedAsync(int olderThanDays, CancellationToken ct = default)
    {
        var cutoffDate = DateTime.UtcNow.AddDays(-olderThanDays);

        var filter = Builders<PotentialBuy>.Filter.And(
            Builders<PotentialBuy>.Filter.Lt(x => x.LastCheckedAt, cutoffDate),
            Builders<PotentialBuy>.Filter.Or(
                Builders<PotentialBuy>.Filter.Eq(x => x.Dismissed, true),
                Builders<PotentialBuy>.Filter.Eq(x => x.Purchased, true)
            )
        );

        var result = await _collection.DeleteManyAsync(filter, ct);
        return result.DeletedCount;
    }
}
