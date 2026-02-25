using GuitarDb.API.Helpers;
using GuitarDb.API.Models;
using MongoDB.Driver;

namespace GuitarDb.API.Services;

public class MongoDbService
{
    private readonly IMongoCollection<MyListing> _myListingsCollection;
    private readonly IMongoCollection<Order> _ordersCollection;
    private readonly IMongoCollection<Review> _reviewsCollection;
    private readonly IMongoCollection<User> _usersCollection;
    private readonly IMongoCollection<Favorite> _favoritesCollection;
    private readonly IMongoCollection<Offer> _offersCollection;
    private readonly IMongoCollection<Message> _messagesCollection;
    private readonly IMongoCollection<Conversation> _conversationsCollection;
    private readonly IMongoCollection<PendingCartItem> _pendingCartItemsCollection;
    private readonly IMongoCollection<PasswordResetToken> _passwordResetTokensCollection;
    private readonly IMongoCollection<EmailVerificationToken> _emailVerificationTokensCollection;
    private readonly IMongoCollection<PotentialBuy> _potentialBuysCollection;
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
        _ordersCollection = database.GetCollection<Order>("orders");
        _reviewsCollection = database.GetCollection<Review>("reviews");
        _usersCollection = database.GetCollection<User>("users");
        _favoritesCollection = database.GetCollection<Favorite>("favorites");
        _offersCollection = database.GetCollection<Offer>("offers");
        _messagesCollection = database.GetCollection<Message>("messages");
        _conversationsCollection = database.GetCollection<Conversation>("conversations");
        _pendingCartItemsCollection = database.GetCollection<PendingCartItem>("pending_cart_items");
        _passwordResetTokensCollection = database.GetCollection<PasswordResetToken>("password_reset_tokens");
        _emailVerificationTokensCollection = database.GetCollection<EmailVerificationToken>("email_verification_tokens");
        _potentialBuysCollection = database.GetCollection<PotentialBuy>("potential_buys");

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

            var reverbLinkIndex = Builders<MyListing>.IndexKeys.Ascending(l => l.ReverbLink);
            await _myListingsCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<MyListing>(reverbLinkIndex, new CreateIndexOptions { Name = "reverb_link_idx", Unique = true, Sparse = true })
            );

            var orderSessionIndex = Builders<Order>.IndexKeys.Ascending(o => o.StripeSessionId);
            await _ordersCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<Order>(orderSessionIndex, new CreateIndexOptions { Name = "stripe_session_id_idx", Unique = true, Sparse = true })
            );

            var paypalOrderIndex = Builders<Order>.IndexKeys.Ascending(o => o.PayPalOrderId);
            await _ordersCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<Order>(paypalOrderIndex, new CreateIndexOptions { Name = "paypal_order_id_idx", Unique = true, Sparse = true })
            );

            var orderCreatedAtIndex = Builders<Order>.IndexKeys.Descending(o => o.CreatedAt);
            await _ordersCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<Order>(orderCreatedAtIndex, new CreateIndexOptions { Name = "created_at_idx" })
            );

            var reviewDateIndex = Builders<Review>.IndexKeys.Descending(r => r.ReviewDate);
            await _reviewsCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<Review>(reviewDateIndex, new CreateIndexOptions { Name = "review_date_idx" })
            );

            // User indexes
            var userEmailIndex = Builders<User>.IndexKeys.Ascending(u => u.Email);
            await _usersCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<User>(userEmailIndex, new CreateIndexOptions { Name = "email_idx", Unique = true, Sparse = true })
            );

            var guestSessionIndex = Builders<User>.IndexKeys.Ascending(u => u.GuestSessionId);
            await _usersCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<User>(guestSessionIndex, new CreateIndexOptions { Name = "guest_session_id_idx", Unique = true, Sparse = true })
            );

            // Favorites indexes
            var favoriteCompoundIndex = Builders<Favorite>.IndexKeys
                .Ascending(f => f.UserId)
                .Ascending(f => f.ListingId);
            await _favoritesCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<Favorite>(favoriteCompoundIndex, new CreateIndexOptions { Name = "user_listing_idx", Unique = true })
            );

            var favoriteUserIndex = Builders<Favorite>.IndexKeys.Ascending(f => f.UserId);
            await _favoritesCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<Favorite>(favoriteUserIndex, new CreateIndexOptions { Name = "user_id_idx" })
            );

            // Offers indexes
            var offerListingIndex = Builders<Offer>.IndexKeys.Ascending(o => o.ListingId);
            await _offersCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<Offer>(offerListingIndex, new CreateIndexOptions { Name = "listing_id_idx" })
            );

            var offerBuyerIndex = Builders<Offer>.IndexKeys.Ascending(o => o.BuyerId);
            await _offersCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<Offer>(offerBuyerIndex, new CreateIndexOptions { Name = "buyer_id_idx" })
            );

            var offerStatusIndex = Builders<Offer>.IndexKeys.Ascending(o => o.Status);
            await _offersCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<Offer>(offerStatusIndex, new CreateIndexOptions { Name = "status_idx" })
            );

            // Messages indexes
            var messageConversationIndex = Builders<Message>.IndexKeys.Ascending(m => m.ConversationId);
            await _messagesCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<Message>(messageConversationIndex, new CreateIndexOptions { Name = "conversation_id_idx" })
            );

            var messageSenderIndex = Builders<Message>.IndexKeys.Ascending(m => m.SenderId);
            await _messagesCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<Message>(messageSenderIndex, new CreateIndexOptions { Name = "sender_id_idx" })
            );

            var messageRecipientIndex = Builders<Message>.IndexKeys.Ascending(m => m.RecipientId);
            await _messagesCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<Message>(messageRecipientIndex, new CreateIndexOptions { Name = "recipient_id_idx" })
            );

            var messageCreatedAtIndex = Builders<Message>.IndexKeys.Descending(m => m.CreatedAt);
            await _messagesCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<Message>(messageCreatedAtIndex, new CreateIndexOptions { Name = "created_at_idx" })
            );

            // Conversations indexes
            var conversationParticipantsIndex = Builders<Conversation>.IndexKeys.Ascending(c => c.ParticipantIds);
            await _conversationsCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<Conversation>(conversationParticipantsIndex, new CreateIndexOptions { Name = "participant_ids_idx" })
            );

            var conversationLastMessageAtIndex = Builders<Conversation>.IndexKeys.Descending(c => c.LastMessageAt);
            await _conversationsCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<Conversation>(conversationLastMessageAtIndex, new CreateIndexOptions { Name = "last_message_at_idx" })
            );

            // PendingCartItems indexes
            var pendingCartUserIndex = Builders<PendingCartItem>.IndexKeys.Ascending(p => p.UserId);
            await _pendingCartItemsCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<PendingCartItem>(pendingCartUserIndex, new CreateIndexOptions { Name = "user_id_idx" })
            );

            var pendingCartExpiresAtIndex = Builders<PendingCartItem>.IndexKeys.Ascending(p => p.ExpiresAt);
            await _pendingCartItemsCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<PendingCartItem>(pendingCartExpiresAtIndex, new CreateIndexOptions
                {
                    Name = "expires_at_idx",
                    ExpireAfter = TimeSpan.Zero // TTL index - documents expire at ExpiresAt time
                })
            );

            // PasswordResetToken indexes
            var passwordResetTokenIndex = Builders<PasswordResetToken>.IndexKeys.Ascending(p => p.Token);
            await _passwordResetTokensCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<PasswordResetToken>(passwordResetTokenIndex, new CreateIndexOptions { Name = "token_idx", Unique = true })
            );

            var passwordResetExpiresAtIndex = Builders<PasswordResetToken>.IndexKeys.Ascending(p => p.ExpiresAt);
            await _passwordResetTokensCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<PasswordResetToken>(passwordResetExpiresAtIndex, new CreateIndexOptions
                {
                    Name = "expires_at_idx",
                    ExpireAfter = TimeSpan.Zero // TTL index - documents expire at ExpiresAt time
                })
            );

            // EmailVerificationToken indexes
            var emailVerificationTokenIndex = Builders<EmailVerificationToken>.IndexKeys.Ascending(e => e.Token);
            await _emailVerificationTokensCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<EmailVerificationToken>(emailVerificationTokenIndex, new CreateIndexOptions { Name = "token_idx", Unique = true })
            );

            var emailVerificationExpiresAtIndex = Builders<EmailVerificationToken>.IndexKeys.Ascending(e => e.ExpiresAt);
            await _emailVerificationTokensCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<EmailVerificationToken>(emailVerificationExpiresAtIndex, new CreateIndexOptions
                {
                    Name = "expires_at_idx",
                    ExpireAfter = TimeSpan.Zero // TTL index - documents expire at ExpiresAt time
                })
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
        var filter = Builders<MyListing>.Filter.Ne(l => l.Disabled, true);
        return await _myListingsCollection.Find(filter)
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
        var searchFilter = filterBuilder.Or(
            filterBuilder.Regex(l => l.ListingTitle, new MongoDB.Bson.BsonRegularExpression(query, "i")),
            filterBuilder.Regex(l => l.Description, new MongoDB.Bson.BsonRegularExpression(query, "i"))
        );
        var notDisabledFilter = filterBuilder.Ne(l => l.Disabled, true);
        var filter = filterBuilder.And(searchFilter, notDisabledFilter);

        return await _myListingsCollection.Find(filter)
            .SortByDescending(l => l.ScrapedAt)
            .ToListAsync();
    }

    public async Task<bool> UpdateMyListingAsync(string id, MyListing listing)
    {
        var filter = Builders<MyListing>.Filter.Eq(l => l.Id, id);
        var result = await _myListingsCollection.ReplaceOneAsync(filter, listing);
        return result.MatchedCount > 0;
    }

    public async Task<bool> DeleteMyListingAsync(string id)
    {
        var filter = Builders<MyListing>.Filter.Eq(l => l.Id, id);
        var result = await _myListingsCollection.DeleteOneAsync(filter);
        return result.DeletedCount > 0;
    }

    public async Task<bool> SetListingDisabledAsync(string id, bool disabled)
    {
        var filter = Builders<MyListing>.Filter.Eq(l => l.Id, id);
        var update = Builders<MyListing>.Update.Set(l => l.Disabled, disabled);
        var result = await _myListingsCollection.UpdateOneAsync(filter, update);
        return result.MatchedCount > 0;
    }

    public async Task<bool> UpdateListingPriceAsync(string id, decimal price)
    {
        var filter = Builders<MyListing>.Filter.Eq(l => l.Id, id);
        var update = Builders<MyListing>.Update.Set(l => l.Price, price);
        var result = await _myListingsCollection.UpdateOneAsync(filter, update);
        return result.MatchedCount > 0;
    }

    public async Task<List<MyListing>> GetAllListingsForAdminAsync()
    {
        return await _myListingsCollection.Find(_ => true)
            .SortByDescending(l => l.ScrapedAt)
            .ToListAsync();
    }

    public async Task<bool> DisableListingsByIdsAsync(IEnumerable<string> ids)
    {
        var filter = Builders<MyListing>.Filter.In(l => l.Id, ids);
        var update = Builders<MyListing>.Update.Set(l => l.Disabled, true);
        var result = await _myListingsCollection.UpdateManyAsync(filter, update);
        return result.MatchedCount > 0;
    }

    public async Task<MyListing?> GetMyListingByReverbLinkAsync(string? reverbLink)
    {
        var normalizedLink = UrlHelper.NormalizeReverbLink(reverbLink);
        if (string.IsNullOrEmpty(normalizedLink)) return null;

        var filter = Builders<MyListing>.Filter.Eq(l => l.ReverbLink, normalizedLink);
        return await _myListingsCollection.Find(filter).FirstOrDefaultAsync();
    }

    public async Task<long> DisableByReverbLinksAsync(IEnumerable<string> reverbLinks)
    {
        var linksList = reverbLinks
            .Select(l => UrlHelper.NormalizeReverbLink(l))
            .Where(l => l != null)
            .Cast<string>()
            .ToList();
        if (linksList.Count == 0) return 0;

        var filter = Builders<MyListing>.Filter.In(l => l.ReverbLink, linksList);
        var update = Builders<MyListing>.Update.Set(l => l.Disabled, true);
        var result = await _myListingsCollection.UpdateManyAsync(filter, update);

        _logger.LogInformation("Disabled {Count} listings by Reverb link", result.ModifiedCount);
        return result.ModifiedCount;
    }

    public async Task<Order> CreateOrderAsync(Order order)
    {
        order.Id = null;
        order.CreatedAt = DateTime.UtcNow;

        await _ordersCollection.InsertOneAsync(order);
        var orderId = order.PaymentMethod == "paypal" ? order.PayPalOrderId : order.StripeSessionId;
        _logger.LogInformation("Created order with {PaymentMethod} ID: {OrderId}", order.PaymentMethod, orderId);
        return order;
    }

    public async Task<Order?> GetOrderBySessionIdAsync(string sessionId)
    {
        var filter = Builders<Order>.Filter.Eq(o => o.StripeSessionId, sessionId);
        return await _ordersCollection.Find(filter).FirstOrDefaultAsync();
    }

    public async Task<Order?> GetOrderByPayPalOrderIdAsync(string paypalOrderId)
    {
        var filter = Builders<Order>.Filter.Eq(o => o.PayPalOrderId, paypalOrderId);
        return await _ordersCollection.Find(filter).FirstOrDefaultAsync();
    }

    public async Task<List<Order>> GetAllOrdersAsync()
    {
        return await _ordersCollection.Find(_ => true)
            .SortByDescending(o => o.CreatedAt)
            .ToListAsync();
    }

    public async Task<List<Order>> GetOrdersByUserIdAsync(string userId)
    {
        var filter = Builders<Order>.Filter.Eq(o => o.UserId, userId);
        return await _ordersCollection.Find(filter)
            .SortByDescending(o => o.CreatedAt)
            .ToListAsync();
    }

    public async Task<int> LinkGuestOrdersToUserAsync(string guestSessionId, string userId)
    {
        var filter = Builders<Order>.Filter.Eq(o => o.GuestSessionId, guestSessionId);
        var update = Builders<Order>.Update
            .Set(o => o.UserId, userId)
            .Set(o => o.GuestSessionId, null);

        var result = await _ordersCollection.UpdateManyAsync(filter, update);
        return (int)result.ModifiedCount;
    }

    public async Task<int> LinkGuestOrdersByEmailToUserAsync(string email, string userId)
    {
        // Find orders with matching guest email that don't already have a user_id
        var filter = Builders<Order>.Filter.And(
            Builders<Order>.Filter.Eq(o => o.GuestEmail, email),
            Builders<Order>.Filter.Eq(o => o.UserId, null)
        );
        var update = Builders<Order>.Update
            .Set(o => o.UserId, userId)
            .Set(o => o.GuestEmail, null);

        var result = await _ordersCollection.UpdateManyAsync(filter, update);
        return (int)result.ModifiedCount;
    }

    public async Task<(int duplicatesFound, int deleted)> CleanupDuplicateListingsAsync()
    {
        // Find all listings grouped by ReverbLink
        var allListings = await _myListingsCollection.Find(_ => true).ToListAsync();

        var grouped = allListings
            .Where(l => !string.IsNullOrEmpty(l.ReverbLink))
            .GroupBy(l => l.ReverbLink)
            .Where(g => g.Count() > 1)
            .ToList();

        var duplicatesFound = grouped.Sum(g => g.Count() - 1);
        var deletedCount = 0;

        foreach (var group in grouped)
        {
            // Keep the most recent (by ScrapedAt), delete others
            var toDelete = group
                .OrderByDescending(l => l.ScrapedAt)
                .Skip(1)
                .Select(l => l.Id)
                .Where(id => id != null)
                .ToList();

            if (toDelete.Count > 0)
            {
                var filter = Builders<MyListing>.Filter.In(l => l.Id, toDelete!);
                var result = await _myListingsCollection.DeleteManyAsync(filter);
                deletedCount += (int)result.DeletedCount;
            }
        }

        _logger.LogInformation("Duplicate cleanup: found {DuplicatesFound} duplicates, deleted {Deleted}", duplicatesFound, deletedCount);

        return (duplicatesFound, deletedCount);
    }

    public async Task<(int processed, int updated)> NormalizeExistingReverbLinksAsync()
    {
        var allListings = await _myListingsCollection.Find(_ => true).ToListAsync();
        var processed = 0;
        var updated = 0;

        foreach (var listing in allListings)
        {
            if (string.IsNullOrEmpty(listing.ReverbLink))
            {
                continue;
            }

            processed++;
            var normalized = UrlHelper.NormalizeReverbLink(listing.ReverbLink);

            if (normalized != listing.ReverbLink)
            {
                var filter = Builders<MyListing>.Filter.Eq(l => l.Id, listing.Id);
                var update = Builders<MyListing>.Update.Set(l => l.ReverbLink, normalized);
                await _myListingsCollection.UpdateOneAsync(filter, update);
                updated++;
            }
        }

        _logger.LogInformation("ReverbLink normalization: processed {Processed}, updated {Updated}", processed, updated);

        return (processed, updated);
    }

    public async Task<(List<Review> reviews, long totalCount)> GetReviewsAsync(
        string? search = null,
        DateTime? fromDate = null,
        DateTime? toDate = null,
        int page = 1,
        int pageSize = 20)
    {
        var filterBuilder = Builders<Review>.Filter;
        var filters = new List<FilterDefinition<Review>>();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchFilter = filterBuilder.Or(
                filterBuilder.Regex(r => r.GuitarName, new MongoDB.Bson.BsonRegularExpression(search, "i")),
                filterBuilder.Regex(r => r.ReviewerName, new MongoDB.Bson.BsonRegularExpression(search, "i"))
            );
            filters.Add(searchFilter);
        }

        if (fromDate.HasValue)
        {
            filters.Add(filterBuilder.Gte(r => r.ReviewDate, fromDate.Value));
        }

        if (toDate.HasValue)
        {
            filters.Add(filterBuilder.Lte(r => r.ReviewDate, toDate.Value));
        }

        var combinedFilter = filters.Count > 0
            ? filterBuilder.And(filters)
            : filterBuilder.Empty;

        var totalCount = await _reviewsCollection.CountDocumentsAsync(combinedFilter);

        var reviews = await _reviewsCollection.Find(combinedFilter)
            .SortByDescending(r => r.ReviewDate)
            .Skip((page - 1) * pageSize)
            .Limit(pageSize)
            .ToListAsync();

        return (reviews, totalCount);
    }

    public async Task<(long totalCount, long recentCount)> GetReviewStatsAsync(int recentDays = 30)
    {
        var totalCount = await _reviewsCollection.CountDocumentsAsync(_ => true);

        var recentDate = DateTime.UtcNow.AddDays(-recentDays);
        var recentFilter = Builders<Review>.Filter.Gte(r => r.ReviewDate, recentDate);
        var recentCount = await _reviewsCollection.CountDocumentsAsync(recentFilter);

        return (totalCount, recentCount);
    }

    public async Task InsertReviewAsync(Review review)
    {
        review.Id = null;
        await _reviewsCollection.InsertOneAsync(review);
    }

    public async Task InsertManyReviewsAsync(IEnumerable<Review> reviews)
    {
        var reviewsList = reviews.ToList();
        foreach (var review in reviewsList)
        {
            review.Id = null;
        }
        await _reviewsCollection.InsertManyAsync(reviewsList);
    }

    public async Task<long> DeleteAllReviewsAsync()
    {
        var result = await _reviewsCollection.DeleteManyAsync(_ => true);
        return result.DeletedCount;
    }

    // User operations
    public async Task<User> CreateUserAsync(User user)
    {
        user.Id = null;
        user.CreatedAt = DateTime.UtcNow;

        await _usersCollection.InsertOneAsync(user);
        _logger.LogInformation("Created user: {Email}, IsGuest: {IsGuest}", user.Email ?? user.GuestSessionId, user.IsGuest);
        return user;
    }

    public async Task<User?> GetUserByIdAsync(string id)
    {
        var filter = Builders<User>.Filter.Eq(u => u.Id, id);
        return await _usersCollection.Find(filter).FirstOrDefaultAsync();
    }

    public async Task<User?> GetUserByEmailAsync(string email)
    {
        var filter = Builders<User>.Filter.Eq(u => u.Email, email.ToLowerInvariant());
        return await _usersCollection.Find(filter).FirstOrDefaultAsync();
    }

    public async Task<User?> GetUserByGuestSessionIdAsync(string guestSessionId)
    {
        var filter = Builders<User>.Filter.Eq(u => u.GuestSessionId, guestSessionId);
        return await _usersCollection.Find(filter).FirstOrDefaultAsync();
    }

    public async Task<User?> GetAdminUserAsync()
    {
        var filter = Builders<User>.Filter.Eq(u => u.IsAdmin, true);
        return await _usersCollection.Find(filter).FirstOrDefaultAsync();
    }

    public async Task<bool> UpdateUserAsync(string id, User user)
    {
        var filter = Builders<User>.Filter.Eq(u => u.Id, id);
        var result = await _usersCollection.ReplaceOneAsync(filter, user);
        return result.MatchedCount > 0;
    }

    public async Task<bool> UpdateUserPasswordAsync(string id, string passwordHash)
    {
        var filter = Builders<User>.Filter.Eq(u => u.Id, id);
        var update = Builders<User>.Update.Set(u => u.PasswordHash, passwordHash);
        var result = await _usersCollection.UpdateOneAsync(filter, update);
        return result.MatchedCount > 0;
    }

    public async Task<bool> ConvertGuestToRegisteredAsync(string id, string email, string passwordHash, string fullName)
    {
        var filter = Builders<User>.Filter.Eq(u => u.Id, id);
        var update = Builders<User>.Update
            .Set(u => u.Email, email.ToLowerInvariant())
            .Set(u => u.PasswordHash, passwordHash)
            .Set(u => u.FullName, fullName)
            .Set(u => u.IsGuest, false)
            .Unset(u => u.GuestSessionId);
        var result = await _usersCollection.UpdateOneAsync(filter, update);
        return result.MatchedCount > 0;
    }

    // Favorites operations
    public async Task<Favorite> AddFavoriteAsync(string userId, string listingId)
    {
        var favorite = new Favorite
        {
            UserId = userId,
            ListingId = listingId,
            CreatedAt = DateTime.UtcNow
        };

        await _favoritesCollection.InsertOneAsync(favorite);
        _logger.LogInformation("Added favorite: User {UserId}, Listing {ListingId}", userId, listingId);
        return favorite;
    }

    public async Task<bool> RemoveFavoriteAsync(string userId, string listingId)
    {
        var filter = Builders<Favorite>.Filter.And(
            Builders<Favorite>.Filter.Eq(f => f.UserId, userId),
            Builders<Favorite>.Filter.Eq(f => f.ListingId, listingId)
        );
        var result = await _favoritesCollection.DeleteOneAsync(filter);
        if (result.DeletedCount > 0)
        {
            _logger.LogInformation("Removed favorite: User {UserId}, Listing {ListingId}", userId, listingId);
        }
        return result.DeletedCount > 0;
    }

    public async Task<List<Favorite>> GetUserFavoritesAsync(string userId)
    {
        var filter = Builders<Favorite>.Filter.Eq(f => f.UserId, userId);
        return await _favoritesCollection.Find(filter)
            .SortByDescending(f => f.CreatedAt)
            .ToListAsync();
    }

    public async Task<bool> IsFavoriteAsync(string userId, string listingId)
    {
        var filter = Builders<Favorite>.Filter.And(
            Builders<Favorite>.Filter.Eq(f => f.UserId, userId),
            Builders<Favorite>.Filter.Eq(f => f.ListingId, listingId)
        );
        return await _favoritesCollection.Find(filter).AnyAsync();
    }

    public async Task<List<string>> GetUserFavoriteListingIdsAsync(string userId)
    {
        var filter = Builders<Favorite>.Filter.Eq(f => f.UserId, userId);
        var favorites = await _favoritesCollection.Find(filter).ToListAsync();
        return favorites.Select(f => f.ListingId).ToList();
    }

    // Offers operations
    public async Task<Offer> CreateOfferAsync(Offer offer)
    {
        offer.Id = null;
        offer.CreatedAt = DateTime.UtcNow;
        offer.UpdatedAt = DateTime.UtcNow;

        await _offersCollection.InsertOneAsync(offer);
        _logger.LogInformation("Created offer: Buyer {BuyerId}, Listing {ListingId}, Amount {Amount}",
            offer.BuyerId, offer.ListingId, offer.InitialOfferAmount);
        return offer;
    }

    public async Task<Offer?> GetOfferByIdAsync(string offerId)
    {
        var filter = Builders<Offer>.Filter.Eq(o => o.Id, offerId);
        return await _offersCollection.Find(filter).FirstOrDefaultAsync();
    }

    public async Task<List<Offer>> GetOffersByBuyerAsync(string buyerId)
    {
        var filter = Builders<Offer>.Filter.Eq(o => o.BuyerId, buyerId);
        return await _offersCollection.Find(filter)
            .SortByDescending(o => o.UpdatedAt)
            .ToListAsync();
    }

    public async Task<List<Offer>> GetOffersByListingAsync(string listingId)
    {
        var filter = Builders<Offer>.Filter.Eq(o => o.ListingId, listingId);
        return await _offersCollection.Find(filter)
            .SortByDescending(o => o.UpdatedAt)
            .ToListAsync();
    }

    public async Task<List<Offer>> GetOffersByListingsAsync(IEnumerable<string> listingIds)
    {
        var filter = Builders<Offer>.Filter.In(o => o.ListingId, listingIds);
        return await _offersCollection.Find(filter)
            .SortByDescending(o => o.UpdatedAt)
            .ToListAsync();
    }

    public async Task<List<Offer>> GetOffersByStatusAsync(string status)
    {
        var filter = Builders<Offer>.Filter.Eq(o => o.Status, status);
        return await _offersCollection.Find(filter)
            .SortByDescending(o => o.UpdatedAt)
            .ToListAsync();
    }

    public async Task<bool> UpdateOfferStatusAsync(string offerId, string status)
    {
        var filter = Builders<Offer>.Filter.Eq(o => o.Id, offerId);
        var update = Builders<Offer>.Update
            .Set(o => o.Status, status)
            .Set(o => o.UpdatedAt, DateTime.UtcNow);
        var result = await _offersCollection.UpdateOneAsync(filter, update);
        return result.MatchedCount > 0;
    }

    public async Task<bool> UpdateOfferCounterAsync(string offerId, decimal counterAmount)
    {
        var filter = Builders<Offer>.Filter.Eq(o => o.Id, offerId);
        var update = Builders<Offer>.Update
            .Set(o => o.CounterOfferAmount, counterAmount)
            .Set(o => o.Status, OfferStatus.Countered)
            .Set(o => o.UpdatedAt, DateTime.UtcNow);
        var result = await _offersCollection.UpdateOneAsync(filter, update);
        return result.MatchedCount > 0;
    }

    public async Task<bool> AcceptCounterOfferAsync(string offerId)
    {
        var offer = await GetOfferByIdAsync(offerId);
        if (offer == null || offer.CounterOfferAmount == null) return false;

        var filter = Builders<Offer>.Filter.Eq(o => o.Id, offerId);
        var update = Builders<Offer>.Update
            .Set(o => o.CurrentOfferAmount, offer.CounterOfferAmount.Value)
            .Set(o => o.Status, OfferStatus.Accepted)
            .Set(o => o.UpdatedAt, DateTime.UtcNow);
        var result = await _offersCollection.UpdateOneAsync(filter, update);
        return result.MatchedCount > 0;
    }

    public async Task<bool> AddOfferMessageAsync(string offerId, OfferMessage message)
    {
        message.CreatedAt = DateTime.UtcNow;
        var filter = Builders<Offer>.Filter.Eq(o => o.Id, offerId);
        var update = Builders<Offer>.Update
            .Push(o => o.Messages, message)
            .Set(o => o.UpdatedAt, DateTime.UtcNow);
        var result = await _offersCollection.UpdateOneAsync(filter, update);
        return result.MatchedCount > 0;
    }

    /// <summary>
    /// Reject all other offers on a listing when one is accepted
    /// </summary>
    public async Task<List<Offer>> RejectOtherOffersOnListingAsync(string listingId, string acceptedOfferId)
    {
        // Find all pending or countered offers on this listing (excluding the accepted one)
        var filter = Builders<Offer>.Filter.And(
            Builders<Offer>.Filter.Eq(o => o.ListingId, listingId),
            Builders<Offer>.Filter.Ne(o => o.Id, acceptedOfferId),
            Builders<Offer>.Filter.In(o => o.Status, new[] { OfferStatus.Pending, OfferStatus.Countered })
        );

        var offersToReject = await _offersCollection.Find(filter).ToListAsync();

        foreach (var offer in offersToReject)
        {
            // Update status to rejected
            var updateFilter = Builders<Offer>.Filter.Eq(o => o.Id, offer.Id);
            var update = Builders<Offer>.Update
                .Set(o => o.Status, OfferStatus.Rejected)
                .Set(o => o.UpdatedAt, DateTime.UtcNow)
                .Push(o => o.Messages, new OfferMessage
                {
                    SenderId = null,
                    MessageText = "This offer was automatically rejected because another offer was accepted",
                    CreatedAt = DateTime.UtcNow,
                    IsSystemMessage = true
                });
            await _offersCollection.UpdateOneAsync(updateFilter, update);
            _logger.LogInformation("Auto-rejected offer {OfferId} because offer {AcceptedOfferId} was accepted", offer.Id, acceptedOfferId);
        }

        return offersToReject;
    }

    public async Task<Offer?> GetActiveOfferByBuyerAndListingAsync(string buyerId, string listingId)
    {
        var filter = Builders<Offer>.Filter.And(
            Builders<Offer>.Filter.Eq(o => o.BuyerId, buyerId),
            Builders<Offer>.Filter.Eq(o => o.ListingId, listingId),
            Builders<Offer>.Filter.In(o => o.Status, new[] { OfferStatus.Pending, OfferStatus.Countered })
        );
        return await _offersCollection.Find(filter).FirstOrDefaultAsync();
    }

    public async Task<List<Offer>> GetAllOffersAsync(string? status = null)
    {
        var filter = string.IsNullOrEmpty(status)
            ? Builders<Offer>.Filter.Empty
            : Builders<Offer>.Filter.Eq(o => o.Status, status);
        return await _offersCollection.Find(filter)
            .SortByDescending(o => o.UpdatedAt)
            .ToListAsync();
    }

    // Conversation operations
    public async Task<Conversation> CreateConversationAsync(Conversation conversation)
    {
        conversation.Id = null;
        conversation.CreatedAt = DateTime.UtcNow;

        await _conversationsCollection.InsertOneAsync(conversation);
        _logger.LogInformation("Created conversation between participants: {Participants}",
            string.Join(", ", conversation.ParticipantIds));
        return conversation;
    }

    public async Task<Conversation?> GetConversationByIdAsync(string conversationId)
    {
        var filter = Builders<Conversation>.Filter.Eq(c => c.Id, conversationId);
        return await _conversationsCollection.Find(filter).FirstOrDefaultAsync();
    }

    public async Task<List<Conversation>> GetConversationsByUserAsync(string userId)
    {
        var filter = Builders<Conversation>.Filter.AnyEq(c => c.ParticipantIds, userId);
        return await _conversationsCollection.Find(filter)
            .SortByDescending(c => c.LastMessageAt)
            .ToListAsync();
    }

    public async Task<Conversation?> GetConversationByParticipantsAsync(string userId1, string userId2, string? listingId = null)
    {
        var participantFilter = Builders<Conversation>.Filter.And(
            Builders<Conversation>.Filter.AnyEq(c => c.ParticipantIds, userId1),
            Builders<Conversation>.Filter.AnyEq(c => c.ParticipantIds, userId2)
        );

        if (listingId != null)
        {
            var listingFilter = Builders<Conversation>.Filter.Eq(c => c.ListingId, listingId);
            var combinedFilter = Builders<Conversation>.Filter.And(participantFilter, listingFilter);
            return await _conversationsCollection.Find(combinedFilter).FirstOrDefaultAsync();
        }

        return await _conversationsCollection.Find(participantFilter).FirstOrDefaultAsync();
    }

    public async Task<bool> UpdateConversationLastMessageAsync(string conversationId, string lastMessage)
    {
        var filter = Builders<Conversation>.Filter.Eq(c => c.Id, conversationId);
        var update = Builders<Conversation>.Update
            .Set(c => c.LastMessage, lastMessage)
            .Set(c => c.LastMessageAt, DateTime.UtcNow);
        var result = await _conversationsCollection.UpdateOneAsync(filter, update);
        return result.MatchedCount > 0;
    }

    // Message operations
    public async Task<Message> CreateMessageAsync(Message message)
    {
        message.Id = null;
        message.CreatedAt = DateTime.UtcNow;
        message.IsRead = false;

        await _messagesCollection.InsertOneAsync(message);
        _logger.LogInformation("Created message from {SenderId} to {RecipientId}",
            message.SenderId, message.RecipientId);
        return message;
    }

    public async Task<Message?> GetMessageByIdAsync(string messageId)
    {
        var filter = Builders<Message>.Filter.Eq(m => m.Id, messageId);
        return await _messagesCollection.Find(filter).FirstOrDefaultAsync();
    }

    public async Task<List<Message>> GetMessagesByConversationAsync(string conversationId, int limit = 50)
    {
        var filter = Builders<Message>.Filter.Eq(m => m.ConversationId, conversationId);
        return await _messagesCollection.Find(filter)
            .SortByDescending(m => m.CreatedAt)
            .Limit(limit)
            .ToListAsync();
    }

    public async Task<bool> MarkMessageAsReadAsync(string messageId)
    {
        var filter = Builders<Message>.Filter.Eq(m => m.Id, messageId);
        var update = Builders<Message>.Update.Set(m => m.IsRead, true);
        var result = await _messagesCollection.UpdateOneAsync(filter, update);
        return result.MatchedCount > 0;
    }

    public async Task<long> MarkConversationMessagesAsReadAsync(string conversationId, string userId)
    {
        var filter = Builders<Message>.Filter.And(
            Builders<Message>.Filter.Eq(m => m.ConversationId, conversationId),
            Builders<Message>.Filter.Eq(m => m.RecipientId, userId),
            Builders<Message>.Filter.Eq(m => m.IsRead, false)
        );
        var update = Builders<Message>.Update.Set(m => m.IsRead, true);
        var result = await _messagesCollection.UpdateManyAsync(filter, update);
        return result.ModifiedCount;
    }

    public async Task<long> GetUnreadMessageCountAsync(string userId)
    {
        var filter = Builders<Message>.Filter.And(
            Builders<Message>.Filter.Eq(m => m.RecipientId, userId),
            Builders<Message>.Filter.Eq(m => m.IsRead, false)
        );
        return await _messagesCollection.CountDocumentsAsync(filter);
    }

    // PendingCartItem operations
    public async Task<PendingCartItem> CreatePendingCartItemAsync(PendingCartItem item)
    {
        item.Id = null;
        item.CreatedAt = DateTime.UtcNow;

        await _pendingCartItemsCollection.InsertOneAsync(item);
        _logger.LogInformation("Created pending cart item: User {UserId}, Listing {ListingId}, Offer {OfferId}",
            item.UserId, item.ListingId, item.OfferId);
        return item;
    }

    public async Task<List<PendingCartItem>> GetPendingCartItemsByUserAsync(string userId)
    {
        var filter = Builders<PendingCartItem>.Filter.Eq(p => p.UserId, userId);
        return await _pendingCartItemsCollection.Find(filter)
            .SortByDescending(p => p.CreatedAt)
            .ToListAsync();
    }

    public async Task<PendingCartItem?> GetPendingCartItemByIdAsync(string id)
    {
        var filter = Builders<PendingCartItem>.Filter.Eq(p => p.Id, id);
        return await _pendingCartItemsCollection.Find(filter).FirstOrDefaultAsync();
    }

    public async Task<bool> DeletePendingCartItemAsync(string id)
    {
        var filter = Builders<PendingCartItem>.Filter.Eq(p => p.Id, id);
        var result = await _pendingCartItemsCollection.DeleteOneAsync(filter);
        if (result.DeletedCount > 0)
        {
            _logger.LogInformation("Deleted pending cart item: {Id}", id);
        }
        return result.DeletedCount > 0;
    }

    public async Task<bool> DeletePendingCartItemByListingAsync(string listingId)
    {
        // Delete all pending cart items for this listing (item was purchased)
        var filter = Builders<PendingCartItem>.Filter.Eq(p => p.ListingId, listingId);
        var result = await _pendingCartItemsCollection.DeleteManyAsync(filter);
        if (result.DeletedCount > 0)
        {
            _logger.LogInformation("Deleted {Count} pending cart item(s) for listing: {ListingId}", result.DeletedCount, listingId);
        }
        return result.DeletedCount > 0;
    }

    public async Task<bool> DeletePendingCartItemByUserAndListingAsync(string userId, string listingId)
    {
        var filter = Builders<PendingCartItem>.Filter.And(
            Builders<PendingCartItem>.Filter.Eq(p => p.UserId, userId),
            Builders<PendingCartItem>.Filter.Eq(p => p.ListingId, listingId)
        );
        var result = await _pendingCartItemsCollection.DeleteManyAsync(filter);
        if (result.DeletedCount > 0)
        {
            _logger.LogInformation("Deleted {Count} pending cart item(s) for user {UserId}, listing: {ListingId}", result.DeletedCount, userId, listingId);
        }
        return result.DeletedCount > 0;
    }

    public async Task<List<PendingCartItem>> GetAllPendingCartItemsAsync()
    {
        return await _pendingCartItemsCollection.Find(_ => true)
            .SortByDescending(p => p.CreatedAt)
            .ToListAsync();
    }

    public async Task<List<PendingCartItem>> GetPendingCartItemsByListingIdsAsync(List<string> listingIds)
    {
        var filter = Builders<PendingCartItem>.Filter.In(p => p.ListingId, listingIds);
        return await _pendingCartItemsCollection.Find(filter).ToListAsync();
    }

    public async Task<List<PendingCartItem>> GetPendingCartItemsByUserAndListingIdsAsync(string userId, List<string> listingIds)
    {
        var filter = Builders<PendingCartItem>.Filter.And(
            Builders<PendingCartItem>.Filter.Eq(p => p.UserId, userId),
            Builders<PendingCartItem>.Filter.In(p => p.ListingId, listingIds)
        );
        return await _pendingCartItemsCollection.Find(filter).ToListAsync();
    }

    // PasswordResetToken operations
    public async Task<PasswordResetToken> CreatePasswordResetTokenAsync(string userId)
    {
        // Invalidate any existing tokens for this user
        var existingFilter = Builders<PasswordResetToken>.Filter.And(
            Builders<PasswordResetToken>.Filter.Eq(p => p.UserId, userId),
            Builders<PasswordResetToken>.Filter.Eq(p => p.Used, false)
        );
        var updateExisting = Builders<PasswordResetToken>.Update.Set(p => p.Used, true);
        await _passwordResetTokensCollection.UpdateManyAsync(existingFilter, updateExisting);

        var token = new PasswordResetToken
        {
            UserId = userId,
            Token = Guid.NewGuid().ToString("N"),
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddHours(1), // Token valid for 1 hour
            Used = false
        };

        await _passwordResetTokensCollection.InsertOneAsync(token);
        _logger.LogInformation("Created password reset token for user: {UserId}", userId);
        return token;
    }

    public async Task<PasswordResetToken?> GetPasswordResetTokenAsync(string token)
    {
        var filter = Builders<PasswordResetToken>.Filter.And(
            Builders<PasswordResetToken>.Filter.Eq(p => p.Token, token),
            Builders<PasswordResetToken>.Filter.Eq(p => p.Used, false),
            Builders<PasswordResetToken>.Filter.Gt(p => p.ExpiresAt, DateTime.UtcNow)
        );
        return await _passwordResetTokensCollection.Find(filter).FirstOrDefaultAsync();
    }

    public async Task<bool> MarkPasswordResetTokenUsedAsync(string token)
    {
        var filter = Builders<PasswordResetToken>.Filter.Eq(p => p.Token, token);
        var update = Builders<PasswordResetToken>.Update.Set(p => p.Used, true);
        var result = await _passwordResetTokensCollection.UpdateOneAsync(filter, update);
        return result.MatchedCount > 0;
    }

    // EmailVerificationToken operations
    public async Task<EmailVerificationToken> CreateEmailVerificationTokenAsync(string userId)
    {
        // Invalidate any existing tokens for this user
        var existingFilter = Builders<EmailVerificationToken>.Filter.And(
            Builders<EmailVerificationToken>.Filter.Eq(e => e.UserId, userId),
            Builders<EmailVerificationToken>.Filter.Eq(e => e.Used, false)
        );
        var updateExisting = Builders<EmailVerificationToken>.Update.Set(e => e.Used, true);
        await _emailVerificationTokensCollection.UpdateManyAsync(existingFilter, updateExisting);

        var token = new EmailVerificationToken
        {
            UserId = userId,
            Token = Guid.NewGuid().ToString("N"),
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddHours(24), // Token valid for 24 hours
            Used = false
        };

        await _emailVerificationTokensCollection.InsertOneAsync(token);
        _logger.LogInformation("Created email verification token for user: {UserId}", userId);
        return token;
    }

    public async Task<EmailVerificationToken?> GetEmailVerificationTokenAsync(string token)
    {
        var filter = Builders<EmailVerificationToken>.Filter.And(
            Builders<EmailVerificationToken>.Filter.Eq(e => e.Token, token),
            Builders<EmailVerificationToken>.Filter.Eq(e => e.Used, false),
            Builders<EmailVerificationToken>.Filter.Gt(e => e.ExpiresAt, DateTime.UtcNow)
        );
        return await _emailVerificationTokensCollection.Find(filter).FirstOrDefaultAsync();
    }

    public async Task<bool> MarkEmailVerificationTokenUsedAsync(string token)
    {
        var filter = Builders<EmailVerificationToken>.Filter.Eq(e => e.Token, token);
        var update = Builders<EmailVerificationToken>.Update.Set(e => e.Used, true);
        var result = await _emailVerificationTokensCollection.UpdateOneAsync(filter, update);
        return result.MatchedCount > 0;
    }

    public async Task<bool> SetUserEmailVerifiedAsync(string userId)
    {
        var filter = Builders<User>.Filter.Eq(u => u.Id, userId);
        var update = Builders<User>.Update.Set(u => u.EmailVerified, true);
        var result = await _usersCollection.UpdateOneAsync(filter, update);
        return result.MatchedCount > 0;
    }

    // Potential Buys operations
    public async Task<(List<PotentialBuy> Items, long TotalCount)> GetPotentialBuysAsync(
        string? status = null,
        string? sort = null,
        int page = 1,
        int perPage = 20,
        CancellationToken ct = default)
    {
        var filter = Builders<PotentialBuy>.Filter.Empty;

        switch (status?.ToLower())
        {
            case "deals":
                filter = Builders<PotentialBuy>.Filter.And(
                    Builders<PotentialBuy>.Filter.Eq(x => x.IsDeal, true),
                    Builders<PotentialBuy>.Filter.Eq(x => x.Dismissed, false),
                    Builders<PotentialBuy>.Filter.Eq(x => x.Purchased, false));
                break;
            case "no-price-guide":
                filter = Builders<PotentialBuy>.Filter.Eq(x => x.HasPriceGuide, false);
                break;
            case "dismissed":
                filter = Builders<PotentialBuy>.Filter.Eq(x => x.Dismissed, true);
                break;
            case "purchased":
                filter = Builders<PotentialBuy>.Filter.Eq(x => x.Purchased, true);
                break;
        }

        var sortDef = sort?.ToLower() switch
        {
            "best-deal" => Builders<PotentialBuy>.Sort.Descending(x => x.DiscountPercent),
            "price-low" => Builders<PotentialBuy>.Sort.Ascending(x => x.Price),
            "price-high" => Builders<PotentialBuy>.Sort.Descending(x => x.Price),
            _ => Builders<PotentialBuy>.Sort.Descending(x => x.FirstSeenAt)
        };

        var totalCount = await _potentialBuysCollection.CountDocumentsAsync(filter, cancellationToken: ct);

        var items = await _potentialBuysCollection
            .Find(filter)
            .Sort(sortDef)
            .Skip((page - 1) * perPage)
            .Limit(perPage)
            .ToListAsync(ct);

        return (items, totalCount);
    }

    public async Task<PotentialBuyStats> GetPotentialBuyStatsAsync(CancellationToken ct = default)
    {
        var total = await _potentialBuysCollection.CountDocumentsAsync(_ => true, cancellationToken: ct);
        var deals = await _potentialBuysCollection.CountDocumentsAsync(
            x => x.IsDeal && !x.Dismissed && !x.Purchased, cancellationToken: ct);
        var lastChecked = await _potentialBuysCollection
            .Find(_ => true)
            .SortByDescending(x => x.LastCheckedAt)
            .Limit(1)
            .FirstOrDefaultAsync(ct);

        return new PotentialBuyStats
        {
            Total = (int)total,
            Deals = (int)deals,
            LastRunAt = lastChecked?.LastCheckedAt
        };
    }

    public async Task<bool> UpdatePotentialBuyDismissedAsync(string id, bool dismissed, CancellationToken ct = default)
    {
        var update = Builders<PotentialBuy>.Update.Set(x => x.Dismissed, dismissed);
        var result = await _potentialBuysCollection.UpdateOneAsync(
            x => x.Id == id, update, cancellationToken: ct);
        return result.ModifiedCount > 0;
    }

    public async Task<bool> UpdatePotentialBuyPurchasedAsync(string id, bool purchased, CancellationToken ct = default)
    {
        var update = Builders<PotentialBuy>.Update.Set(x => x.Purchased, purchased);
        var result = await _potentialBuysCollection.UpdateOneAsync(
            x => x.Id == id, update, cancellationToken: ct);
        return result.ModifiedCount > 0;
    }

    public async Task<bool> DeletePotentialBuyAsync(string id, CancellationToken ct = default)
    {
        var result = await _potentialBuysCollection.DeleteOneAsync(x => x.Id == id, ct);
        return result.DeletedCount > 0;
    }

    /// <summary>
    /// Dismiss multiple potential buys by IDs.
    /// </summary>
    public async Task<long> DismissPotentialBuysByIdsAsync(List<string> ids, CancellationToken ct = default)
    {
        var filter = Builders<PotentialBuy>.Filter.In(x => x.Id, ids);
        var update = Builders<PotentialBuy>.Update.Set(x => x.Dismissed, true);
        var result = await _potentialBuysCollection.UpdateManyAsync(filter, update, cancellationToken: ct);
        return result.ModifiedCount;
    }

    /// <summary>
    /// Dismiss all active deals (not already dismissed/purchased).
    /// </summary>
    public async Task<long> DismissAllActiveDealsAsync(CancellationToken ct = default)
    {
        var filter = Builders<PotentialBuy>.Filter.And(
            Builders<PotentialBuy>.Filter.Eq(x => x.IsDeal, true),
            Builders<PotentialBuy>.Filter.Eq(x => x.Dismissed, false),
            Builders<PotentialBuy>.Filter.Eq(x => x.Purchased, false)
        );
        var update = Builders<PotentialBuy>.Update.Set(x => x.Dismissed, true);
        var result = await _potentialBuysCollection.UpdateManyAsync(filter, update, cancellationToken: ct);
        return result.ModifiedCount;
    }

    /// <summary>
    /// Delete old dismissed/purchased records to keep database size manageable.
    /// </summary>
    public async Task<long> DeleteOldResolvedPotentialBuysAsync(int olderThanDays, CancellationToken ct = default)
    {
        var cutoffDate = DateTime.UtcNow.AddDays(-olderThanDays);

        var filter = Builders<PotentialBuy>.Filter.And(
            Builders<PotentialBuy>.Filter.Lt(x => x.LastCheckedAt, cutoffDate),
            Builders<PotentialBuy>.Filter.Or(
                Builders<PotentialBuy>.Filter.Eq(x => x.Dismissed, true),
                Builders<PotentialBuy>.Filter.Eq(x => x.Purchased, true)
            )
        );

        var result = await _potentialBuysCollection.DeleteManyAsync(filter, ct);
        return result.DeletedCount;
    }

    /// <summary>
    /// Delete all dismissed records.
    /// </summary>
    public async Task<long> DeleteAllDismissedPotentialBuysAsync(CancellationToken ct = default)
    {
        var filter = Builders<PotentialBuy>.Filter.Eq(x => x.Dismissed, true);
        var result = await _potentialBuysCollection.DeleteManyAsync(filter, ct);
        return result.DeletedCount;
    }

    /// <summary>
    /// Delete all purchased records.
    /// </summary>
    public async Task<long> DeleteAllPurchasedPotentialBuysAsync(CancellationToken ct = default)
    {
        var filter = Builders<PotentialBuy>.Filter.Eq(x => x.Purchased, true);
        var result = await _potentialBuysCollection.DeleteManyAsync(filter, ct);
        return result.DeletedCount;
    }

    /// <summary>
    /// Delete all potential buys (full reset).
    /// </summary>
    public async Task<long> DeleteAllPotentialBuysAsync(CancellationToken ct = default)
    {
        var result = await _potentialBuysCollection.DeleteManyAsync(_ => true, ct);
        return result.DeletedCount;
    }

    /// <summary>
    /// Get potential buy by Reverb listing ID.
    /// </summary>
    public async Task<PotentialBuy?> GetPotentialBuyByReverbListingIdAsync(long reverbListingId, CancellationToken ct = default)
    {
        return await _potentialBuysCollection
            .Find(x => x.ReverbListingId == reverbListingId)
            .FirstOrDefaultAsync(ct);
    }

    /// <summary>
    /// Upsert a potential buy (insert or update based on Reverb listing ID).
    /// </summary>
    public async Task UpsertPotentialBuyAsync(PotentialBuy potentialBuy, CancellationToken ct = default)
    {
        var existing = await GetPotentialBuyByReverbListingIdAsync(potentialBuy.ReverbListingId, ct);

        if (existing != null)
        {
            potentialBuy.Id = existing.Id;
            potentialBuy.FirstSeenAt = existing.FirstSeenAt;
            potentialBuy.Dismissed = existing.Dismissed;
            potentialBuy.Purchased = existing.Purchased;
        }

        var filter = Builders<PotentialBuy>.Filter.Eq(x => x.ReverbListingId, potentialBuy.ReverbListingId);
        var options = new ReplaceOptions { IsUpsert = true };
        await _potentialBuysCollection.ReplaceOneAsync(filter, potentialBuy, options, ct);
    }

    /// <summary>
    /// Delete listings that weren't seen in the current scrape run (no longer on Reverb).
    /// </summary>
    public async Task<long> DeleteStalePotentialBuysAsync(DateTime scraperRunStartTime, CancellationToken ct = default)
    {
        var filter = Builders<PotentialBuy>.Filter.And(
            Builders<PotentialBuy>.Filter.Lt(x => x.LastCheckedAt, scraperRunStartTime),
            Builders<PotentialBuy>.Filter.Eq(x => x.Dismissed, false),
            Builders<PotentialBuy>.Filter.Eq(x => x.Purchased, false)
        );

        var result = await _potentialBuysCollection.DeleteManyAsync(filter, ct);
        return result.DeletedCount;
    }

    /// <summary>
    /// Get total count of potential buys.
    /// </summary>
    public async Task<long> GetPotentialBuysTotalCountAsync(CancellationToken ct = default)
    {
        return await _potentialBuysCollection.CountDocumentsAsync(_ => true, cancellationToken: ct);
    }
}
