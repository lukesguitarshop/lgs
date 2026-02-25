using GuitarDb.Scraper.Configuration;
using GuitarDb.Scraper.Models.Domain;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace GuitarDb.Scraper.Services;

public class MyListingRepository
{
    private readonly IMongoCollection<MyListing> _collection;
    private readonly ILogger<MyListingRepository> _logger;

    public MyListingRepository(MongoDbSettings settings, ILogger<MyListingRepository> logger)
    {
        _logger = logger;

        var client = new MongoClient(settings.ConnectionString);
        var database = client.GetDatabase(settings.DatabaseName);
        _collection = database.GetCollection<MyListing>("my_listings");

        CreateIndexes();
    }

    private void CreateIndexes()
    {
        try
        {
            var indexKeys = Builders<MyListing>.IndexKeys.Descending(l => l.ScrapedAt);
            _collection.Indexes.CreateOne(new CreateIndexModel<MyListing>(indexKeys,
                new CreateIndexOptions { Name = "scraped_at_idx" }));

            var reverbLinkIndex = Builders<MyListing>.IndexKeys.Ascending(l => l.ReverbLink);
            _collection.Indexes.CreateOne(new CreateIndexModel<MyListing>(reverbLinkIndex,
                new CreateIndexOptions { Name = "reverb_link_idx", Unique = true, Sparse = true }));

            _logger.LogInformation("MongoDB indexes created for my_listings");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating indexes");
        }
    }

    public async Task<MyListing> InsertAsync(MyListing listing, CancellationToken cancellationToken = default)
    {
        listing.Id = null;
        listing.ScrapedAt = DateTime.UtcNow;

        await _collection.InsertOneAsync(listing, cancellationToken: cancellationToken);
        return listing;
    }

    public async Task InsertManyAsync(List<MyListing> listings, CancellationToken cancellationToken = default)
    {
        if (listings.Count == 0) return;

        foreach (var listing in listings)
        {
            listing.Id = null;
            listing.ScrapedAt = DateTime.UtcNow;
        }

        await _collection.InsertManyAsync(listings, cancellationToken: cancellationToken);
        _logger.LogInformation("Inserted {Count} listings into my_listings", listings.Count);
    }

    public async Task<long> ClearAllAsync(CancellationToken cancellationToken = default)
    {
        var result = await _collection.DeleteManyAsync(FilterDefinition<MyListing>.Empty, cancellationToken);
        _logger.LogInformation("Cleared {Count} existing listings from my_listings", result.DeletedCount);
        return result.DeletedCount;
    }

    public async Task<long> CountAsync(CancellationToken cancellationToken = default)
    {
        return await _collection.CountDocumentsAsync(FilterDefinition<MyListing>.Empty, cancellationToken: cancellationToken);
    }

    public async Task<List<MyListing>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        return await _collection.Find(FilterDefinition<MyListing>.Empty).ToListAsync(cancellationToken);
    }

    public async Task UpsertByReverbLinkAsync(MyListing listing, CancellationToken cancellationToken = default)
    {
        var filter = Builders<MyListing>.Filter.Eq(l => l.ReverbLink, listing.ReverbLink);
        var options = new ReplaceOptions { IsUpsert = true };

        // Preserve the ID and Disabled status if updating, let MongoDB generate ID if inserting
        var existing = await _collection.Find(filter).FirstOrDefaultAsync(cancellationToken);
        if (existing != null)
        {
            listing.Id = existing.Id;
            listing.Disabled = existing.Disabled;
        }
        else
        {
            listing.Id = null;
        }

        await _collection.ReplaceOneAsync(filter, listing, options, cancellationToken);
    }

    public async Task<long> DisableByReverbLinksAsync(List<string> reverbLinks, CancellationToken cancellationToken = default)
    {
        if (reverbLinks.Count == 0) return 0;

        var filter = Builders<MyListing>.Filter.In(l => l.ReverbLink, reverbLinks);
        var update = Builders<MyListing>.Update.Set(l => l.Disabled, true);
        var result = await _collection.UpdateManyAsync(filter, update, cancellationToken: cancellationToken);

        _logger.LogInformation("Disabled {Count} listings no longer on Reverb", result.ModifiedCount);
        return result.ModifiedCount;
    }
}
