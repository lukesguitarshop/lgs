using GuitarDb.Scraper.Configuration;
using GuitarDb.Scraper.Models.Domain;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;

namespace GuitarDb.Scraper.Services;

public class GuitarRepository
{
    private readonly IMongoCollection<Guitar> _guitars;
    private readonly ILogger<GuitarRepository> _logger;

    public GuitarRepository(MongoDbSettings settings, ILogger<GuitarRepository> logger)
    {
        _logger = logger;

        var client = new MongoClient(settings.ConnectionString);
        var database = client.GetDatabase(settings.DatabaseName);
        _guitars = database.GetCollection<Guitar>(settings.GuitarsCollectionName);

        CreateIndexes();
    }

    private void CreateIndexes()
    {
        try
        {
            var indexKeys = Builders<Guitar>.IndexKeys
                .Ascending(g => g.Make)
                .Ascending(g => g.Model)
                .Ascending(g => g.Year);

            var indexModel = new CreateIndexModel<Guitar>(indexKeys, new CreateIndexOptions
            {
                Name = "make_model_year_idx"
            });

            _guitars.Indexes.CreateOne(indexModel);
            _logger.LogInformation("Created compound index on Make, Model, Year");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to create index (may already exist)");
        }
    }

    public async Task<Guitar?> FindByUniqueKeyAsync(
        string make,
        string model,
        int? year,
        CancellationToken cancellationToken = default)
    {
        var filter = Builders<Guitar>.Filter.And(
            Builders<Guitar>.Filter.Eq(g => g.Make, make),
            Builders<Guitar>.Filter.Eq(g => g.Model, model),
            Builders<Guitar>.Filter.Eq(g => g.Year, year)
        );

        return await _guitars.Find(filter).FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<Guitar> UpsertGuitarAsync(
        Guitar guitar,
        CancellationToken cancellationToken = default)
    {
        var existing = await FindByUniqueKeyAsync(guitar.Make, guitar.Model, guitar.Year, cancellationToken);

        if (existing == null)
        {
            guitar.CreatedAt = DateTime.UtcNow;
            guitar.UpdatedAt = DateTime.UtcNow;
            await _guitars.InsertOneAsync(guitar, cancellationToken: cancellationToken);
            _logger.LogInformation("Created new guitar: {Make} {Model} ({Year})",
                guitar.Make, guitar.Model, guitar.Year?.ToString() ?? "Unknown");
            return guitar;
        }

        return existing;
    }

    public async Task AppendPriceSnapshotAsync(
        string guitarId,
        PriceSnapshot snapshot,
        CancellationToken cancellationToken = default)
    {
        var filter = Builders<Guitar>.Filter.Eq(g => g.Id, guitarId);
        var update = Builders<Guitar>.Update
            .Push(g => g.PriceHistory, snapshot)
            .Set(g => g.UpdatedAt, DateTime.UtcNow);

        await _guitars.UpdateOneAsync(filter, update, cancellationToken: cancellationToken);
        _logger.LogDebug("Appended price snapshot to guitar {GuitarId}", guitarId);
    }

    public async Task UpdateImagesAsync(
        string guitarId,
        List<string> images,
        CancellationToken cancellationToken = default)
    {
        var filter = Builders<Guitar>.Filter.Eq(g => g.Id, guitarId);
        var update = Builders<Guitar>.Update
            .Set(g => g.Images, images)
            .Set(g => g.UpdatedAt, DateTime.UtcNow);

        await _guitars.UpdateOneAsync(filter, update, cancellationToken: cancellationToken);
        _logger.LogDebug("Updated images for guitar {GuitarId}", guitarId);
    }

    public async Task UpdateReverbInfoAsync(
        string guitarId,
        string? reverbLink,
        decimal? shippingPrice,
        CancellationToken cancellationToken = default)
    {
        var filter = Builders<Guitar>.Filter.Eq(g => g.Id, guitarId);
        var updateBuilder = Builders<Guitar>.Update.Set(g => g.UpdatedAt, DateTime.UtcNow);

        if (!string.IsNullOrEmpty(reverbLink))
        {
            updateBuilder = updateBuilder.Set(g => g.ReverbLink, reverbLink);
        }

        if (shippingPrice.HasValue)
        {
            updateBuilder = updateBuilder.Set(g => g.ShippingPrice, shippingPrice.Value);
        }

        await _guitars.UpdateOneAsync(filter, updateBuilder, cancellationToken: cancellationToken);
        _logger.LogDebug("Updated Reverb info for guitar {GuitarId}", guitarId);
    }

    public async Task<bool> HasSnapshotForDateAsync(
        string guitarId,
        DateTime date,
        CancellationToken cancellationToken = default)
    {
        var normalizedDate = date.Date;

        var filter = Builders<Guitar>.Filter.And(
            Builders<Guitar>.Filter.Eq(g => g.Id, guitarId),
            Builders<Guitar>.Filter.ElemMatch(g => g.PriceHistory,
                snapshot => snapshot.Date.Date == normalizedDate)
        );

        var count = await _guitars.CountDocumentsAsync(filter, cancellationToken: cancellationToken);
        return count > 0;
    }
}
