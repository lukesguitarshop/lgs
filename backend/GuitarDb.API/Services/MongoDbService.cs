using GuitarDb.API.Models;
using MongoDB.Driver;

namespace GuitarDb.API.Services;

public class MongoDbService
{
    private readonly IMongoCollection<MyListing> _myListingsCollection;
    private readonly ILogger<MongoDbService> _logger;

    public MongoDbService(IConfiguration configuration, ILogger<MongoDbService> logger)
    {
        _logger = logger;

        var connectionString = configuration["MongoDb:ConnectionString"]
            ?? throw new ArgumentNullException("MongoDb:ConnectionString", "MongoDB connection string is not configured");

        var databaseName = configuration["MongoDb:DatabaseName"]
            ?? throw new ArgumentNullException("MongoDb:DatabaseName", "MongoDB database name is not configured");

        var client = new MongoClient(connectionString);
        var database = client.GetDatabase(databaseName);
        _myListingsCollection = database.GetCollection<MyListing>("my_listings");

        CreateIndexesAsync().GetAwaiter().GetResult();
    }

    private async Task CreateIndexesAsync()
    {
        try
        {
            var scrapedAtIndex = Builders<MyListing>.IndexKeys.Descending(l => l.ScrapedAt);
            await _myListingsCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<MyListing>(scrapedAtIndex, new CreateIndexOptions { Name = "scraped_at_idx" })
            );

            _logger.LogInformation("MongoDB indexes created successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating MongoDB indexes");
        }
    }

    public async Task<MyListing> CreateMyListingAsync(MyListing listing)
    {
        listing.Id = null;
        listing.ScrapedAt = DateTime.UtcNow;

        await _myListingsCollection.InsertOneAsync(listing);
        return listing;
    }

    public async Task<List<MyListing>> GetAllMyListingsAsync()
    {
        return await _myListingsCollection.Find(_ => true)
            .SortByDescending(l => l.ScrapedAt)
            .ToListAsync();
    }

    public async Task<MyListing?> GetMyListingByIdAsync(string id)
    {
        var filter = Builders<MyListing>.Filter.Eq(l => l.Id, id);
        return await _myListingsCollection.Find(filter).FirstOrDefaultAsync();
    }

    public async Task<List<MyListing>> GetListingsByIdsAsync(IEnumerable<string> ids)
    {
        var filter = Builders<MyListing>.Filter.In(l => l.Id, ids);
        return await _myListingsCollection.Find(filter).ToListAsync();
    }

    public async Task<List<MyListing>> SearchMyListingsAsync(string query)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return await GetAllMyListingsAsync();
        }

        var filterBuilder = Builders<MyListing>.Filter;
        var filter = filterBuilder.Or(
            filterBuilder.Regex(l => l.ListingTitle, new MongoDB.Bson.BsonRegularExpression(query, "i")),
            filterBuilder.Regex(l => l.Description, new MongoDB.Bson.BsonRegularExpression(query, "i"))
        );

        return await _myListingsCollection.Find(filter)
            .SortByDescending(l => l.ScrapedAt)
            .ToListAsync();
    }

    public async Task<bool> UpdateMyListingAsync(string id, MyListing listing)
    {
        var filter = Builders<MyListing>.Filter.Eq(l => l.Id, id);
        var result = await _myListingsCollection.ReplaceOneAsync(filter, listing);
        return result.ModifiedCount > 0;
    }

    public async Task<bool> DeleteMyListingAsync(string id)
    {
        var filter = Builders<MyListing>.Filter.Eq(l => l.Id, id);
        var result = await _myListingsCollection.DeleteOneAsync(filter);
        return result.DeletedCount > 0;
    }
}
