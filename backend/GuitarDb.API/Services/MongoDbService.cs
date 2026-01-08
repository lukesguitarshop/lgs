using GuitarDb.API.Models;
using MongoDB.Driver;

namespace GuitarDb.API.Services;

public class MongoDbService
{
    private readonly IMongoCollection<Guitar> _guitarsCollection;
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
        _guitarsCollection = database.GetCollection<Guitar>("guitars");

        CreateIndexesAsync().GetAwaiter().GetResult();
    }

    private async Task CreateIndexesAsync()
    {
        try
        {
            // Create compound index on brand + model
            var brandModelIndex = Builders<Guitar>.IndexKeys
                .Ascending(g => g.Brand)
                .Ascending(g => g.Model);
            await _guitarsCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<Guitar>(brandModelIndex, new CreateIndexOptions { Name = "brand_model_idx" })
            );

            // Create index on year
            var yearIndex = Builders<Guitar>.IndexKeys.Ascending(g => g.Year);
            await _guitarsCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<Guitar>(yearIndex, new CreateIndexOptions { Name = "year_idx" })
            );

            // Create index on priceHistory.date
            var priceHistoryDateIndex = Builders<Guitar>.IndexKeys.Descending("priceHistory.date");
            await _guitarsCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<Guitar>(priceHistoryDateIndex, new CreateIndexOptions { Name = "price_history_date_idx" })
            );

            _logger.LogInformation("MongoDB indexes created successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating MongoDB indexes");
        }
    }

    public async Task<Guitar> CreateGuitarAsync(Guitar guitar)
    {
        // Clear the Id to let MongoDB auto-generate it
        guitar.Id = null;

        guitar.Metadata = new GuitarMetadata
        {
            CreatedAt = DateTime.UtcNow,
            LastUpdated = DateTime.UtcNow
        };

        await _guitarsCollection.InsertOneAsync(guitar);
        return guitar;
    }

    public async Task<List<Guitar>> GetAllGuitarsAsync()
    {
        return await _guitarsCollection.Find(_ => true).ToListAsync();
    }

    public async Task<List<Guitar>> GetGuitarsByBrandAsync(string brand)
    {
        var filter = Builders<Guitar>.Filter.Eq(g => g.Brand, brand);
        return await _guitarsCollection.Find(filter).ToListAsync();
    }

    public async Task<Guitar?> GetGuitarByModelAndYearAsync(string model, int? year)
    {
        var filterBuilder = Builders<Guitar>.Filter;
        var filter = filterBuilder.And(
            filterBuilder.Eq(g => g.Model, model),
            filterBuilder.Eq(g => g.Year, year)
        );

        return await _guitarsCollection.Find(filter).FirstOrDefaultAsync();
    }

    public async Task<bool> AddPriceSnapshotAsync(string guitarId, PriceSnapshot priceSnapshot)
    {
        var filter = Builders<Guitar>.Filter.Eq(g => g.Id, guitarId);
        var update = Builders<Guitar>.Update
            .Push(g => g.PriceHistory, priceSnapshot)
            .Set(g => g.Metadata.LastUpdated, DateTime.UtcNow);

        var result = await _guitarsCollection.UpdateOneAsync(filter, update);
        return result.ModifiedCount > 0;
    }

    public async Task<List<Guitar>> SearchGuitarsAsync(string query)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return await GetAllGuitarsAsync();
        }

        var filterBuilder = Builders<Guitar>.Filter;
        var filter = filterBuilder.Or(
            filterBuilder.Regex(g => g.Brand, new MongoDB.Bson.BsonRegularExpression(query, "i")),
            filterBuilder.Regex(g => g.Model, new MongoDB.Bson.BsonRegularExpression(query, "i")),
            filterBuilder.Regex(g => g.Finish, new MongoDB.Bson.BsonRegularExpression(query, "i")),
            filterBuilder.Regex(g => g.Category, new MongoDB.Bson.BsonRegularExpression(query, "i"))
        );

        return await _guitarsCollection.Find(filter).ToListAsync();
    }

    public async Task<Guitar?> GetGuitarByIdAsync(string id)
    {
        var filter = Builders<Guitar>.Filter.Eq(g => g.Id, id);
        return await _guitarsCollection.Find(filter).FirstOrDefaultAsync();
    }

    public async Task<bool> UpdateGuitarAsync(string id, Guitar guitar)
    {
        guitar.Metadata.LastUpdated = DateTime.UtcNow;
        var filter = Builders<Guitar>.Filter.Eq(g => g.Id, id);
        var result = await _guitarsCollection.ReplaceOneAsync(filter, guitar);
        return result.ModifiedCount > 0;
    }

    public async Task<bool> DeleteGuitarAsync(string id)
    {
        var filter = Builders<Guitar>.Filter.Eq(g => g.Id, id);
        var result = await _guitarsCollection.DeleteOneAsync(filter);
        return result.DeletedCount > 0;
    }
}
