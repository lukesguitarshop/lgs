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
    private readonly IMongoCollection<Reservation> _reservationsCollection;
    private readonly IMongoCollection<PasswordResetToken> _passwordResetTokensCollection;
    private readonly IMongoCollection<EmailVerificationToken> _emailVerificationTokensCollection;
    private readonly IMongoCollection<PotentialBuy> _potentialBuysCollection;
    private readonly IMongoCollection<SweetwaterPotentialBuy> _sweetwaterPotentialBuysCollection;
    private readonly IMongoCollection<Transaction> _transactionsCollection;
    private readonly IMongoCollection<ExtraExpense> _extraExpensesCollection;
    private readonly IMongoCollection<MonthlySnapshot> _monthlySnapshotsCollection;
    private readonly IMongoCollection<TradeInRequest> _tradeInRequestsCollection;
    private readonly IMongoCollection<StoreCredit> _storeCreditsCollection;
    private readonly IMongoCollection<UserActivity> _userActivitiesCollection;
    private readonly IMongoCollection<ScheduledJobRun> _scheduledJobRunsCollection;
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
        _reservationsCollection = database.GetCollection<Reservation>("reservations");
        _passwordResetTokensCollection = database.GetCollection<PasswordResetToken>("password_reset_tokens");
        _emailVerificationTokensCollection = database.GetCollection<EmailVerificationToken>("email_verification_tokens");
        _potentialBuysCollection = database.GetCollection<PotentialBuy>("potential_buys");
        _sweetwaterPotentialBuysCollection = database.GetCollection<SweetwaterPotentialBuy>("sweetwater_potential_buys");
        _transactionsCollection = database.GetCollection<Transaction>("transactions");
        _extraExpensesCollection = database.GetCollection<ExtraExpense>("extra_expenses");
        _monthlySnapshotsCollection = database.GetCollection<MonthlySnapshot>("monthly_snapshots");
        _tradeInRequestsCollection = database.GetCollection<TradeInRequest>("trade_in_requests");
        _storeCreditsCollection = database.GetCollection<StoreCredit>("store_credits");
        _userActivitiesCollection = database.GetCollection<UserActivity>("user_activities");
        _scheduledJobRunsCollection = database.GetCollection<ScheduledJobRun>("scheduled_job_runs");

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

            var reviewOrderIdIndex = Builders<Review>.IndexKeys.Ascending(r => r.ReverbOrderId);
            await _reviewsCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<Review>(reviewOrderIdIndex, new CreateIndexOptions { Name = "reverb_order_id_idx", Sparse = true })
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

            // User activity indexes
            var activityUserCreatedIndex = Builders<UserActivity>.IndexKeys
                .Ascending(a => a.UserId)
                .Descending(a => a.CreatedAt);
            await _userActivitiesCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<UserActivity>(activityUserCreatedIndex, new CreateIndexOptions { Name = "user_created_idx" })
            );

            // Auto-expire activity records after 180 days to keep the collection small
            var activityTtlIndex = Builders<UserActivity>.IndexKeys.Ascending(a => a.CreatedAt);
            await _userActivitiesCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<UserActivity>(activityTtlIndex, new CreateIndexOptions { Name = "activity_ttl_idx", ExpireAfter = TimeSpan.FromDays(180) })
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

            // Reservation indexes.
            // NOTE: deliberately no TTL index here. Reservations can carry deposit
            // payments and must never be auto-deleted -- expiry is handled by
            // ReservationExpirationService, which changes status instead of deleting.
            var reservationListingIndex = Builders<Reservation>.IndexKeys.Ascending(r => r.ListingId);
            await _reservationsCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<Reservation>(reservationListingIndex, new CreateIndexOptions { Name = "listing_id_idx" })
            );

            var reservationUserIndex = Builders<Reservation>.IndexKeys.Ascending(r => r.UserId);
            await _reservationsCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<Reservation>(reservationUserIndex, new CreateIndexOptions { Name = "user_id_idx" })
            );

            var reservationStatusIndex = Builders<Reservation>.IndexKeys
                .Ascending(r => r.Status)
                .Ascending(r => r.ExpiresAt);
            await _reservationsCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<Reservation>(reservationStatusIndex, new CreateIndexOptions { Name = "status_expires_idx" })
            );

            // Guarantees "one active reservation per listing" at the database level, so two
            // admins racing to reserve the same guitar cannot both win.
            var reservationActiveUniqueIndex = Builders<Reservation>.IndexKeys
                .Ascending(r => r.ListingId)
                .Ascending(r => r.Status);
            await _reservationsCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<Reservation>(reservationActiveUniqueIndex, new CreateIndexOptions<Reservation>
                {
                    Name = "listing_active_unique_idx",
                    Unique = true,
                    PartialFilterExpression = Builders<Reservation>.Filter.In(
                        r => r.Status, ReservationStatus.Active)
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

            // Transaction indexes
            var transactionDateIndex = Builders<Transaction>.IndexKeys.Descending(t => t.Date);
            await _transactionsCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<Transaction>(transactionDateIndex, new CreateIndexOptions { Name = "date_desc" })
            );

            var transactionCreatedAtIndex = Builders<Transaction>.IndexKeys.Descending(t => t.CreatedAt);
            await _transactionsCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<Transaction>(transactionCreatedAtIndex, new CreateIndexOptions { Name = "created_at_desc" })
            );

            // ExtraExpense indexes
            var extraExpenseDateIndex = Builders<ExtraExpense>.IndexKeys.Descending(e => e.Date);
            await _extraExpensesCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<ExtraExpense>(extraExpenseDateIndex, new CreateIndexOptions { Name = "date_desc" })
            );

            _monthlySnapshotsCollection.Indexes.CreateMany(new[]
            {
                new CreateIndexModel<MonthlySnapshot>(
                    Builders<MonthlySnapshot>.IndexKeys.Ascending(s => s.Year).Ascending(s => s.Month),
                    new CreateIndexOptions { Name = "year_month_asc", Unique = true })
            });

            // Sweetwater potential buys indexes
            var swListingIdIndex = Builders<SweetwaterPotentialBuy>.IndexKeys.Ascending(x => x.SweetwaterListingId);
            await _sweetwaterPotentialBuysCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<SweetwaterPotentialBuy>(swListingIdIndex, new CreateIndexOptions { Name = "sweetwater_listing_id_idx", Unique = true })
            );

            // Trade-in indexes
            var tradeInUserIndex = Builders<TradeInRequest>.IndexKeys.Ascending(t => t.UserId);
            await _tradeInRequestsCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<TradeInRequest>(tradeInUserIndex, new CreateIndexOptions { Name = "user_id_idx" })
            );

            var tradeInStatusIndex = Builders<TradeInRequest>.IndexKeys.Ascending(t => t.Status);
            await _tradeInRequestsCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<TradeInRequest>(tradeInStatusIndex, new CreateIndexOptions { Name = "status_idx" })
            );

            var tradeInCreatedAtIndex = Builders<TradeInRequest>.IndexKeys.Descending(t => t.CreatedAt);
            await _tradeInRequestsCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<TradeInRequest>(tradeInCreatedAtIndex, new CreateIndexOptions { Name = "created_at_idx" })
            );

            // Store credit indexes
            var storeCreditUserIndex = Builders<StoreCredit>.IndexKeys.Ascending(s => s.UserId);
            await _storeCreditsCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<StoreCredit>(storeCreditUserIndex, new CreateIndexOptions { Name = "user_id_idx", Unique = true })
            );

            // Scheduled job run indexes
            // Migration: the first version of this index was unique on (job_name, run_date)
            // alone, which would block a second run later the same day. Drop it before
            // creating the slot-aware replacement. Guarded separately so the usual case -
            // no such index on a fresh database - doesn't abort the rest of this method.
            try
            {
                await _scheduledJobRunsCollection.Indexes.DropOneAsync("job_name_run_date_uniq");
                _logger.LogInformation("Dropped superseded index job_name_run_date_uniq");
            }
            catch (MongoCommandException)
            {
                // IndexNotFound - nothing to migrate.
            }

            // Unique on (job_name, run_date, slot) - this is what makes a scheduled job
            // idempotent. Two instances racing during a deploy both try to insert;
            // exactly one wins and the loser skips.
            var scheduledJobRunIndex = Builders<ScheduledJobRun>.IndexKeys
                .Ascending(r => r.JobName)
                .Ascending(r => r.RunDate)
                .Ascending(r => r.Slot);
            await _scheduledJobRunsCollection.Indexes.CreateOneAsync(
                new CreateIndexModel<ScheduledJobRun>(scheduledJobRunIndex,
                    new CreateIndexOptions { Name = "job_name_run_date_slot_uniq", Unique = true })
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

    /// <summary>
    /// The homepage hero shows one guitar, so featuring a listing clears the flag
    /// everywhere else first. Doing it in this order means a failure between the two
    /// writes leaves nothing featured rather than two competing for one slot.
    /// </summary>
    public async Task<bool> SetFeaturedListingAsync(string id)
    {
        await ClearFeaturedListingAsync();

        var filter = Builders<MyListing>.Filter.Eq(l => l.Id, id);
        var update = Builders<MyListing>.Update.Set(l => l.Featured, true);
        var result = await _myListingsCollection.UpdateOneAsync(filter, update);
        return result.MatchedCount > 0;
    }

    public async Task ClearFeaturedListingAsync()
    {
        var filter = Builders<MyListing>.Filter.Eq(l => l.Featured, true);
        var update = Builders<MyListing>.Update.Set(l => l.Featured, false);
        await _myListingsCollection.UpdateManyAsync(filter, update);
    }

    /// <summary>
    /// The featured guitar, or null when nothing is featured or the featured listing is
    /// no longer buyable. Disabled and pending listings are excluded here rather than
    /// cleared, so re-enabling a guitar restores it to the hero without re-picking it.
    /// </summary>
    public async Task<MyListing?> GetFeaturedListingAsync()
    {
        var filterBuilder = Builders<MyListing>.Filter;
        var filter = filterBuilder.And(
            filterBuilder.Eq(l => l.Featured, true),
            filterBuilder.Ne(l => l.Disabled, true),
            filterBuilder.Ne(l => l.Pending, true)
        );
        return await _myListingsCollection.Find(filter).FirstOrDefaultAsync();
    }

    public async Task<bool> SetListingPendingAsync(string id, bool pending)
    {
        var filter = Builders<MyListing>.Filter.Eq(l => l.Id, id);
        var update = Builders<MyListing>.Update.Set(l => l.Pending, pending);
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

    public async Task<List<MyListing>> GetAllSoldListingsAsync()
    {
        var filter = Builders<MyListing>.Filter.Eq(l => l.Disabled, true);
        return await _myListingsCollection.Find(filter)
            .SortByDescending(l => l.ScrapedAt)
            .ToListAsync();
    }

    public async Task<List<MyListing>> GetRecentSoldListingsAsync(int limit = 8)
    {
        var filter = Builders<MyListing>.Filter.Eq(l => l.Disabled, true);
        return await _myListingsCollection.Find(filter)
            .SortByDescending(l => l.ScrapedAt)
            .Limit(limit)
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

    public async Task<Order?> GetOrderByIdAsync(string orderId)
    {
        var filter = Builders<Order>.Filter.Eq(o => o.Id, orderId);
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

    public async Task<bool> UpdateOrderTrackingAsync(string orderId, string? carrier, string? trackingNumber)
    {
        var filter = Builders<Order>.Filter.Eq(o => o.Id, orderId);
        var updateBuilder = Builders<Order>.Update
            .Set(o => o.TrackingCarrier, carrier)
            .Set(o => o.TrackingNumber, trackingNumber);

        // If tracking is being added, update status to "shipped"
        if (!string.IsNullOrEmpty(carrier) && !string.IsNullOrEmpty(trackingNumber))
        {
            updateBuilder = updateBuilder.Set(o => o.Status, "shipped");
        }

        var result = await _ordersCollection.UpdateOneAsync(filter, updateBuilder);
        return result.ModifiedCount > 0;
    }

    public async Task<bool> UpdateOrderStatusAsync(string orderId, string status)
    {
        var filter = Builders<Order>.Filter.Eq(o => o.Id, orderId);
        var update = Builders<Order>.Update.Set(o => o.Status, status);
        var result = await _ordersCollection.UpdateOneAsync(filter, update);
        return result.ModifiedCount > 0;
    }

    public async Task<List<Order>> GetShippedOrdersAsync()
    {
        var filter = Builders<Order>.Filter.And(
            Builders<Order>.Filter.Eq(o => o.Status, "shipped"),
            Builders<Order>.Filter.Ne(o => o.TrackingNumber, null)
        );
        return await _ordersCollection.Find(filter).ToListAsync();
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

    public async Task<(long totalCount, long recentCount, double averageRating)> GetReviewStatsAsync(int recentDays = 30)
    {
        var totalCount = await _reviewsCollection.CountDocumentsAsync(_ => true);

        var recentDate = DateTime.UtcNow.AddDays(-recentDays);
        var recentFilter = Builders<Review>.Filter.Gte(r => r.ReviewDate, recentDate);
        var recentCount = await _reviewsCollection.CountDocumentsAsync(recentFilter);

        double averageRating = 0;
        if (totalCount > 0)
        {
            var avgResult = await _reviewsCollection.Aggregate()
                .Group(r => 1, g => new { Average = g.Average(r => r.Rating) })
                .FirstOrDefaultAsync();
            averageRating = avgResult?.Average ?? 0;
        }

        return (totalCount, recentCount, averageRating);
    }

    public async Task InsertReviewAsync(Review review)
    {
        review.Id = null;
        await _reviewsCollection.InsertOneAsync(review);
    }

    /// <summary>
    /// Every site review this customer has written, newest first. The review form uses it
    /// to show what they already said about whichever order they pick.
    /// </summary>
    public async Task<List<Review>> GetSiteReviewsByUserAsync(string userId)
    {
        var filterBuilder = Builders<Review>.Filter;
        var filter = filterBuilder.And(
            filterBuilder.Eq(r => r.UserId, userId),
            filterBuilder.Eq(r => r.Source, "site")
        );
        return await _reviewsCollection
            .Find(filter)
            .SortByDescending(r => r.ReviewDate)
            .ToListAsync();
    }

    /// <summary>
    /// Write a customer's review of one order. One review per order, matching how Reverb
    /// reviews work: submitting again for the same order edits it rather than stacking
    /// duplicates in the public list, while a different order gets its own review. The date
    /// moves to the edit so the review sorts by when it was actually written.
    /// </summary>
    public async Task<Review> UpsertSiteReviewAsync(
        string userId,
        string orderId,
        string guitarName,
        string reviewerName,
        int rating,
        string reviewText)
    {
        var filterBuilder = Builders<Review>.Filter;
        var existing = await _reviewsCollection.Find(filterBuilder.And(
            filterBuilder.Eq(r => r.UserId, userId),
            filterBuilder.Eq(r => r.OrderId, orderId),
            filterBuilder.Eq(r => r.Source, "site")
        )).FirstOrDefaultAsync();

        if (existing != null)
        {
            var update = Builders<Review>.Update
                .Set(r => r.Rating, rating)
                .Set(r => r.ReviewText, reviewText)
                .Set(r => r.ReviewerName, reviewerName)
                .Set(r => r.GuitarName, guitarName)
                .Set(r => r.ReviewDate, DateTime.UtcNow);

            await _reviewsCollection.UpdateOneAsync(r => r.Id == existing.Id, update);

            existing.Rating = rating;
            existing.ReviewText = reviewText;
            existing.ReviewerName = reviewerName;
            existing.GuitarName = guitarName;
            existing.ReviewDate = DateTime.UtcNow;
            return existing;
        }

        var review = new Review
        {
            UserId = userId,
            OrderId = orderId,
            Source = "site",
            GuitarName = guitarName,
            ReviewerName = reviewerName,
            Rating = rating,
            ReviewText = reviewText,
            ReviewDate = DateTime.UtcNow
        };
        await _reviewsCollection.InsertOneAsync(review);
        return review;
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

    /// <summary>
    /// Clear the scraped reviews ahead of a full rebuild from Reverb.
    ///
    /// Reviews written on the site are deliberately spared: Reverb is the source of truth
    /// for its own reviews, not for ours, and a rebuild that took them out would silently
    /// destroy customer-written content that exists nowhere else.
    /// </summary>
    public async Task<long> DeleteAllReviewsAsync()
    {
        var filter = Builders<Review>.Filter.Ne(r => r.Source, "site");
        var result = await _reviewsCollection.DeleteManyAsync(filter);
        return result.DeletedCount;
    }

    public async Task<long> DeleteManualReviewsAsync()
    {
        // Delete reviews that don't have a reverb_order_id (manually entered).
        // Customer reviews written on the site also lack one, but they are not stray data
        // to be tidied away — they are excluded explicitly.
        var filterBuilder = Builders<Review>.Filter;
        var filter = filterBuilder.And(
            filterBuilder.Or(
                filterBuilder.Eq(r => r.ReverbOrderId, null),
                filterBuilder.Eq(r => r.ReverbOrderId, "")
            ),
            filterBuilder.Ne(r => r.Source, "site")
        );
        var result = await _reviewsCollection.DeleteManyAsync(filter);
        return result.DeletedCount;
    }

    public async Task<long> InitializeOriginalPricesAsync()
    {
        // Set original_price = price for all listings where original_price is null
        var filter = Builders<MyListing>.Filter.Eq(l => l.OriginalPrice, null);
        var listings = await _myListingsCollection.Find(filter).ToListAsync();
        long updatedCount = 0;

        foreach (var listing in listings)
        {
            var updateDef = Builders<MyListing>.Update.Set(l => l.OriginalPrice, listing.Price);
            var result = await _myListingsCollection.UpdateOneAsync(
                Builders<MyListing>.Filter.Eq(l => l.Id, listing.Id),
                updateDef
            );
            if (result.ModifiedCount > 0) updatedCount++;
        }

        return updatedCount;
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

    // User activity operations
    public async Task LogActivityAsync(string userId, string type, string description, string? listingId = null)
    {
        if (string.IsNullOrEmpty(userId)) return;

        try
        {
            var activity = new UserActivity
            {
                UserId = userId,
                Type = type,
                Description = description,
                ListingId = listingId,
                CreatedAt = DateTime.UtcNow
            };
            await _userActivitiesCollection.InsertOneAsync(activity);
        }
        catch (Exception ex)
        {
            // Activity logging must never break the main request
            _logger.LogWarning(ex, "Failed to log activity '{Type}' for user {UserId}", type, userId);
        }
    }

    public async Task<List<UserActivity>> GetUserActivityAsync(string userId, int limit = 100)
    {
        var filter = Builders<UserActivity>.Filter.Eq(a => a.UserId, userId);
        return await _userActivitiesCollection.Find(filter)
            .SortByDescending(a => a.CreatedAt)
            .Limit(limit)
            .ToListAsync();
    }

    /// <summary>
    /// Global, paginated, filterable activity feed for the admin dashboard.
    /// </summary>
    public async Task<(List<UserActivity> Items, long Total)> GetActivityFeedAsync(
        string? type, string? userId, bool descending, int page, int perPage, bool includeAdmin = false)
    {
        var builder = Builders<UserActivity>.Filter;
        var filter = builder.Empty;
        if (!string.IsNullOrWhiteSpace(type))
            filter &= builder.Eq(a => a.Type, type);
        if (!string.IsNullOrWhiteSpace(userId))
            filter &= builder.Eq(a => a.UserId, userId);

        // By default, hide activity from admin accounts so the owner isn't
        // wading through their own logs.
        if (!includeAdmin)
        {
            var adminIds = await _usersCollection
                .Find(Builders<User>.Filter.Eq(u => u.IsAdmin, true))
                .Project(u => u.Id!)
                .ToListAsync();
            if (adminIds.Count > 0)
                filter &= builder.Nin(a => a.UserId, adminIds);
        }

        var total = await _userActivitiesCollection.CountDocumentsAsync(filter);

        var sort = descending
            ? Builders<UserActivity>.Sort.Descending(a => a.CreatedAt)
            : Builders<UserActivity>.Sort.Ascending(a => a.CreatedAt);

        if (page < 1) page = 1;
        if (perPage < 1) perPage = 50;

        var items = await _userActivitiesCollection.Find(filter)
            .Sort(sort)
            .Skip((page - 1) * perPage)
            .Limit(perPage)
            .ToListAsync();

        return (items, total);
    }

    public async Task<List<User>> GetUsersByIdsAsync(IEnumerable<string> ids)
    {
        var idList = ids.Distinct().ToList();
        if (idList.Count == 0) return new List<User>();
        var filter = Builders<User>.Filter.In(u => u.Id, idList);
        return await _usersCollection.Find(filter).ToListAsync();
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

    /// <summary>
    /// Reject all active offers on multiple listings when items are purchased via checkout
    /// </summary>
    public async Task<List<Offer>> RejectAllOffersOnListingsAsync(IEnumerable<string> listingIds)
    {
        var listingIdList = listingIds.ToList();
        _logger.LogInformation("RejectAllOffersOnListingsAsync called with listing IDs: {ListingIds}", string.Join(", ", listingIdList));

        if (listingIdList.Count == 0) return new List<Offer>();

        // Find all pending or countered offers on these listings
        var filter = Builders<Offer>.Filter.And(
            Builders<Offer>.Filter.In(o => o.ListingId, listingIdList),
            Builders<Offer>.Filter.In(o => o.Status, new[] { OfferStatus.Pending, OfferStatus.Countered })
        );

        var offersToReject = await _offersCollection.Find(filter).ToListAsync();
        _logger.LogInformation("Found {Count} offers to reject for listings: {ListingIds}", offersToReject.Count, string.Join(", ", listingIdList));

        foreach (var offer in offersToReject)
        {
            var updateFilter = Builders<Offer>.Filter.Eq(o => o.Id, offer.Id);
            var update = Builders<Offer>.Update
                .Set(o => o.Status, OfferStatus.Rejected)
                .Set(o => o.UpdatedAt, DateTime.UtcNow)
                .Push(o => o.Messages, new OfferMessage
                {
                    SenderId = null,
                    MessageText = "This offer was automatically declined because the item was purchased",
                    CreatedAt = DateTime.UtcNow,
                    IsSystemMessage = true
                });
            await _offersCollection.UpdateOneAsync(updateFilter, update);
            _logger.LogInformation("Auto-rejected offer {OfferId} on listing {ListingId} due to checkout purchase", offer.Id, offer.ListingId);
        }

        return offersToReject;
    }

    /// <summary>
    /// Reject all active conversation-based offers on multiple listings when items are purchased via checkout
    /// </summary>
    public async Task<List<Conversation>> RejectAllConversationOffersOnListingsAsync(IEnumerable<string> listingIds, string? excludeConversationId = null)
    {
        var listingIdList = listingIds.ToList();
        _logger.LogInformation("RejectAllConversationOffersOnListingsAsync called with listing IDs: {ListingIds}, excluding: {ExcludeId}", string.Join(", ", listingIdList), excludeConversationId ?? "none");

        if (listingIdList.Count == 0) return new List<Conversation>();

        // Find all conversations with active offers on these listings
        var filterBuilder = Builders<Conversation>.Filter;
        var filter = filterBuilder.And(
            filterBuilder.In(c => c.ListingId, listingIdList),
            filterBuilder.Eq(c => c.OfferStatus, "active")
        );

        // Exclude a specific conversation if provided (e.g., the one being accepted)
        if (!string.IsNullOrEmpty(excludeConversationId))
        {
            filter = filterBuilder.And(filter, filterBuilder.Ne(c => c.Id, excludeConversationId));
        }

        var conversationsToReject = await _conversationsCollection.Find(filter).ToListAsync();
        _logger.LogInformation("Found {Count} conversation offers to reject for listings: {ListingIds}", conversationsToReject.Count, string.Join(", ", listingIdList));

        foreach (var conversation in conversationsToReject)
        {
            var updateFilter = Builders<Conversation>.Filter.Eq(c => c.Id, conversation.Id);
            var update = Builders<Conversation>.Update
                .Set(c => c.OfferStatus, "declined")
                .Set(c => c.PendingActionBy, null)
                .Set(c => c.OfferExpiresAt, null);
            await _conversationsCollection.UpdateOneAsync(updateFilter, update);

            // Add a system message to the conversation
            var systemMessage = new Message
            {
                ConversationId = conversation.Id!,
                SenderId = null,
                RecipientId = conversation.ActiveOfferBy,
                ListingId = conversation.ListingId,
                MessageText = "This offer was automatically declined because the item was purchased.",
                Type = "decline",
                IsRead = false
            };
            await _messagesCollection.InsertOneAsync(systemMessage);

            _logger.LogInformation("Auto-rejected conversation offer {ConversationId} on listing {ListingId} due to checkout purchase", conversation.Id, conversation.ListingId);
        }

        return conversationsToReject;
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

    public async Task UpdateConversationOfferStateAsync(
        string conversationId,
        decimal? activeOfferAmount,
        string? activeOfferBy,
        string? pendingActionBy,
        DateTime? offerExpiresAt,
        string? offerStatus,
        decimal? acceptedAmount = null)
    {
        var update = Builders<Conversation>.Update
            .Set(c => c.ActiveOfferAmount, activeOfferAmount)
            .Set(c => c.ActiveOfferBy, activeOfferBy)
            .Set(c => c.PendingActionBy, pendingActionBy)
            .Set(c => c.OfferExpiresAt, offerExpiresAt)
            .Set(c => c.OfferStatus, offerStatus)
            .Set(c => c.AcceptedAmount, acceptedAmount);

        await _conversationsCollection.UpdateOneAsync(
            c => c.Id == conversationId,
            update);
    }

    public async Task<List<Conversation>> GetConversationsWithOffersAsync(string? status = null)
    {
        var filter = Builders<Conversation>.Filter.Ne(c => c.OfferStatus, null);
        if (status != null)
        {
            filter = Builders<Conversation>.Filter.Eq(c => c.OfferStatus, status);
        }
        return await _conversationsCollection
            .Find(filter)
            .SortByDescending(c => c.LastMessageAt)
            .ToListAsync();
    }

    public async Task<List<Conversation>> GetConversationsWithExpiredOffersAsync()
    {
        var filter = Builders<Conversation>.Filter.And(
            Builders<Conversation>.Filter.Eq(c => c.OfferStatus, "active"),
            Builders<Conversation>.Filter.Lt(c => c.OfferExpiresAt, DateTime.UtcNow)
        );
        return await _conversationsCollection.Find(filter).ToListAsync();
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

    // ---------------- Reservation operations ----------------

    /// <summary>
    /// Inserts a reservation. The unique partial index on (listing_id, status) makes this
    /// throw on a duplicate active reservation, which is how the two-admins-at-once race
    /// is resolved -- the loser gets a clean failure rather than a second active hold.
    /// </summary>
    public async Task<Reservation> CreateReservationAsync(Reservation reservation)
    {
        reservation.Id = null;
        reservation.CreatedAt = DateTime.UtcNow;
        reservation.UpdatedAt = DateTime.UtcNow;

        await _reservationsCollection.InsertOneAsync(reservation);
        _logger.LogInformation(
            "Created reservation {Id}: listing {ListingId}, user {UserId}, type {Type}, agreed {Price:C}",
            reservation.Id, reservation.ListingId, reservation.UserId ?? "(unassigned)",
            reservation.Type, reservation.AgreedPrice);
        return reservation;
    }

    public async Task<Reservation?> GetReservationByIdAsync(string id)
    {
        if (!IsValidObjectId(id)) return null;
        var filter = Builders<Reservation>.Filter.Eq(r => r.Id, id);
        return await _reservationsCollection.Find(filter).FirstOrDefaultAsync();
    }

    /// <summary>The one reservation currently holding this listing, if any.</summary>
    public async Task<Reservation?> GetActiveReservationByListingAsync(string listingId)
    {
        if (!IsValidObjectId(listingId)) return null;
        var filter = Builders<Reservation>.Filter.And(
            Builders<Reservation>.Filter.Eq(r => r.ListingId, listingId),
            Builders<Reservation>.Filter.In(r => r.Status, ReservationStatus.Active)
        );
        return await _reservationsCollection.Find(filter).FirstOrDefaultAsync();
    }

    /// <summary>Batch lookup of active reservations, keyed by listing id. Used on checkout paths.</summary>
    public async Task<Dictionary<string, Reservation>> GetActiveReservationsByListingIdsAsync(IEnumerable<string> listingIds)
    {
        var ids = listingIds.Where(IsValidObjectId).Distinct().ToList();
        if (ids.Count == 0) return new Dictionary<string, Reservation>();

        var filter = Builders<Reservation>.Filter.And(
            Builders<Reservation>.Filter.In(r => r.ListingId, ids),
            Builders<Reservation>.Filter.In(r => r.Status, ReservationStatus.Active)
        );
        var results = await _reservationsCollection.Find(filter).ToListAsync();
        return results
            .GroupBy(r => r.ListingId)
            .ToDictionary(g => g.Key, g => g.First());
    }

    public async Task<List<Reservation>> GetReservationsByUserAsync(string userId, bool activeOnly = true)
    {
        if (!IsValidObjectId(userId)) return new List<Reservation>();
        var builder = Builders<Reservation>.Filter;
        var filter = builder.Eq(r => r.UserId, userId);
        if (activeOnly)
        {
            filter = builder.And(filter, builder.In(r => r.Status, ReservationStatus.Active));
        }
        return await _reservationsCollection.Find(filter)
            .SortByDescending(r => r.CreatedAt)
            .ToListAsync();
    }

    /// <summary>
    /// Admin list. Sorted by expiration ascending so the ones about to lapse are on top;
    /// reservations with no expiry sort last.
    /// </summary>
    public async Task<List<Reservation>> GetReservationsForAdminAsync(
        string? status = null, string? type = null, bool activeOnly = true)
    {
        var builder = Builders<Reservation>.Filter;
        var filter = builder.Empty;

        if (!string.IsNullOrEmpty(status))
        {
            filter = builder.And(filter, builder.Eq(r => r.Status, status));
        }
        else if (activeOnly)
        {
            filter = builder.And(filter, builder.In(r => r.Status, ReservationStatus.Active));
        }

        if (!string.IsNullOrEmpty(type))
        {
            filter = builder.And(filter, builder.Eq(r => r.Type, type));
        }

        var results = await _reservationsCollection.Find(filter).ToListAsync();

        return results
            .OrderBy(r => r.ExpiresAt ?? DateTime.MaxValue)
            .ThenByDescending(r => r.CreatedAt)
            .ToList();
    }

    public async Task<bool> ReplaceReservationAsync(Reservation reservation)
    {
        if (string.IsNullOrEmpty(reservation.Id)) return false;
        reservation.UpdatedAt = DateTime.UtcNow;

        var filter = Builders<Reservation>.Filter.Eq(r => r.Id, reservation.Id);
        var result = await _reservationsCollection.ReplaceOneAsync(filter, reservation);
        return result.MatchedCount > 0;
    }

    /// <summary>
    /// Reservations that have run past their expiry and are still active. The expiration
    /// job treats Pending and DepositPaid very differently -- see ReservationExpirationService.
    /// </summary>
    public async Task<List<Reservation>> GetExpiredActiveReservationsAsync()
    {
        var now = DateTime.UtcNow;
        var filter = Builders<Reservation>.Filter.And(
            Builders<Reservation>.Filter.In(r => r.Status, ReservationStatus.Active),
            Builders<Reservation>.Filter.Ne(r => r.ExpiresAt, null),
            Builders<Reservation>.Filter.Lte(r => r.ExpiresAt, now)
        );
        return await _reservationsCollection.Find(filter).ToListAsync();
    }

    /// <summary>
    /// Active reservations expiring inside the given window that have not yet had a
    /// "expiring soon" warning sent. Used for both the customer warning and the admin digest.
    /// </summary>
    public async Task<List<Reservation>> GetReservationsExpiringWithinAsync(
        TimeSpan window, bool onlyUnnotified = true)
    {
        var now = DateTime.UtcNow;
        var cutoff = now.Add(window);

        var builder = Builders<Reservation>.Filter;
        var filter = builder.And(
            builder.In(r => r.Status, ReservationStatus.Active),
            builder.Ne(r => r.ExpiresAt, null),
            builder.Gt(r => r.ExpiresAt, now),
            builder.Lte(r => r.ExpiresAt, cutoff)
        );

        if (onlyUnnotified)
        {
            filter = builder.And(filter, builder.Eq(r => r.ExpiringSoonNotifiedAt, null));
        }

        return await _reservationsCollection.Find(filter)
            .SortBy(r => r.ExpiresAt)
            .ToListAsync();
    }

    /// <summary>Reservations flagged for admin attention (expired with a deposit, over-credited, orphaned user).</summary>
    public async Task<List<Reservation>> GetReservationsNeedingReviewAsync()
    {
        var filter = Builders<Reservation>.Filter.Eq(r => r.NeedsReview, true);
        return await _reservationsCollection.Find(filter)
            .SortByDescending(r => r.UpdatedAt)
            .ToListAsync();
    }

    public async Task<bool> FlagReservationForReviewAsync(string id, string reason)
    {
        var filter = Builders<Reservation>.Filter.Eq(r => r.Id, id);
        var update = Builders<Reservation>.Update
            .Set(r => r.NeedsReview, true)
            .Set(r => r.NeedsReviewReason, reason)
            .Set(r => r.UpdatedAt, DateTime.UtcNow);
        var result = await _reservationsCollection.UpdateOneAsync(filter, update);
        if (result.MatchedCount > 0)
        {
            _logger.LogWarning("Reservation {Id} flagged for review: {Reason}", id, reason);
        }
        return result.MatchedCount > 0;
    }

    public async Task<bool> MarkReservationExpiringSoonNotifiedAsync(string id)
    {
        var filter = Builders<Reservation>.Filter.Eq(r => r.Id, id);
        var update = Builders<Reservation>.Update
            .Set(r => r.ExpiringSoonNotifiedAt, DateTime.UtcNow)
            .Set(r => r.UpdatedAt, DateTime.UtcNow);
        var result = await _reservationsCollection.UpdateOneAsync(filter, update);
        return result.MatchedCount > 0;
    }

    public async Task<bool> SetReservationStatusAsync(string id, string status)
    {
        var filter = Builders<Reservation>.Filter.Eq(r => r.Id, id);
        var update = Builders<Reservation>.Update
            .Set(r => r.Status, status)
            .Set(r => r.UpdatedAt, DateTime.UtcNow);

        if (status == ReservationStatus.Completed)
        {
            update = update.Set(r => r.CompletedAt, DateTime.UtcNow);
        }

        var result = await _reservationsCollection.UpdateOneAsync(filter, update);
        if (result.MatchedCount > 0)
        {
            _logger.LogInformation("Reservation {Id} -> status {Status}", id, status);
        }
        return result.MatchedCount > 0;
    }

    /// <summary>
    /// Legacy listings flagged with the old MyListing.Pending boolean. Read only by the
    /// one-time migration that turns them into unassigned Trade-In reservations.
    /// </summary>
    public async Task<List<MyListing>> GetLegacyPendingListingsAsync()
    {
        var filter = Builders<MyListing>.Filter.Eq(l => l.Pending, true);
        return await _myListingsCollection.Find(filter).ToListAsync();
    }

    /// <summary>Clears the legacy pending flag once a listing has a real reservation.</summary>
    public async Task<bool> ClearLegacyPendingFlagAsync(string listingId)
    {
        var filter = Builders<MyListing>.Filter.Eq(l => l.Id, listingId);
        var update = Builders<MyListing>.Update.Set(l => l.Pending, false);
        var result = await _myListingsCollection.UpdateOneAsync(filter, update);
        return result.MatchedCount > 0;
    }

    /// <summary>Total money currently held as deposits across all active reservations.</summary>
    public async Task<decimal> GetTotalDepositsHeldAsync()
    {
        var filter = Builders<Reservation>.Filter.Eq(r => r.Status, ReservationStatus.DepositPaid);
        var held = await _reservationsCollection.Find(filter).ToListAsync();
        return held.Sum(r => r.DepositPaidAmount);
    }

    private static bool IsValidObjectId(string? id) =>
        !string.IsNullOrWhiteSpace(id) && MongoDB.Bson.ObjectId.TryParse(id, out _);

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
        string? search = null,
        decimal? minPrice = null,
        decimal? maxPrice = null,
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

        if (!string.IsNullOrWhiteSpace(search))
        {
            var regex = new MongoDB.Bson.BsonRegularExpression(
                System.Text.RegularExpressions.Regex.Escape(search.Trim()), "i");
            filter = Builders<PotentialBuy>.Filter.And(filter,
                Builders<PotentialBuy>.Filter.Regex(x => x.ListingTitle, regex));
        }

        if (minPrice.HasValue)
        {
            filter = Builders<PotentialBuy>.Filter.And(filter,
                Builders<PotentialBuy>.Filter.Gte(x => x.Price, minPrice.Value));
        }

        if (maxPrice.HasValue)
        {
            filter = Builders<PotentialBuy>.Filter.And(filter,
                Builders<PotentialBuy>.Filter.Lte(x => x.Price, maxPrice.Value));
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

    // Sweetwater Potential Buys operations

    public async Task<(List<SweetwaterPotentialBuy> Items, long TotalCount)> GetSweetwaterPotentialBuysAsync(
        string? status = null,
        string? sort = null,
        int page = 1,
        int perPage = 20,
        string? search = null,
        decimal? minPrice = null,
        decimal? maxPrice = null,
        CancellationToken ct = default)
    {
        var filter = Builders<SweetwaterPotentialBuy>.Filter.Empty;

        switch (status?.ToLower())
        {
            case "deals":
                filter = Builders<SweetwaterPotentialBuy>.Filter.And(
                    Builders<SweetwaterPotentialBuy>.Filter.Eq(x => x.IsDeal, true),
                    Builders<SweetwaterPotentialBuy>.Filter.Eq(x => x.Dismissed, false),
                    Builders<SweetwaterPotentialBuy>.Filter.Eq(x => x.Purchased, false));
                break;
            case "no-price-guide":
                filter = Builders<SweetwaterPotentialBuy>.Filter.Eq(x => x.HasPriceGuide, false);
                break;
            case "dismissed":
                filter = Builders<SweetwaterPotentialBuy>.Filter.Eq(x => x.Dismissed, true);
                break;
            case "purchased":
                filter = Builders<SweetwaterPotentialBuy>.Filter.Eq(x => x.Purchased, true);
                break;
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var regex = new MongoDB.Bson.BsonRegularExpression(
                System.Text.RegularExpressions.Regex.Escape(search.Trim()), "i");
            filter = Builders<SweetwaterPotentialBuy>.Filter.And(filter,
                Builders<SweetwaterPotentialBuy>.Filter.Regex(x => x.ListingTitle, regex));
        }

        if (minPrice.HasValue)
        {
            filter = Builders<SweetwaterPotentialBuy>.Filter.And(filter,
                Builders<SweetwaterPotentialBuy>.Filter.Gte(x => x.Price, minPrice.Value));
        }

        if (maxPrice.HasValue)
        {
            filter = Builders<SweetwaterPotentialBuy>.Filter.And(filter,
                Builders<SweetwaterPotentialBuy>.Filter.Lte(x => x.Price, maxPrice.Value));
        }

        var sortDef = sort?.ToLower() switch
        {
            "best-deal" => Builders<SweetwaterPotentialBuy>.Sort.Descending(x => x.DiscountPercent),
            "price-low" => Builders<SweetwaterPotentialBuy>.Sort.Ascending(x => x.Price),
            "price-high" => Builders<SweetwaterPotentialBuy>.Sort.Descending(x => x.Price),
            _ => Builders<SweetwaterPotentialBuy>.Sort.Descending(x => x.FirstSeenAt)
        };

        var totalCount = await _sweetwaterPotentialBuysCollection.CountDocumentsAsync(filter, cancellationToken: ct);

        var items = await _sweetwaterPotentialBuysCollection
            .Find(filter)
            .Sort(sortDef)
            .Skip((page - 1) * perPage)
            .Limit(perPage)
            .ToListAsync(ct);

        return (items, totalCount);
    }

    public async Task<SweetwaterPotentialBuyStats> GetSweetwaterPotentialBuyStatsAsync(CancellationToken ct = default)
    {
        var total = await _sweetwaterPotentialBuysCollection.CountDocumentsAsync(_ => true, cancellationToken: ct);
        var deals = await _sweetwaterPotentialBuysCollection.CountDocumentsAsync(
            x => x.IsDeal && !x.Dismissed && !x.Purchased, cancellationToken: ct);
        var lastChecked = await _sweetwaterPotentialBuysCollection
            .Find(_ => true)
            .SortByDescending(x => x.LastCheckedAt)
            .Limit(1)
            .FirstOrDefaultAsync(ct);

        return new SweetwaterPotentialBuyStats
        {
            Total = (int)total,
            Deals = (int)deals,
            LastRunAt = lastChecked?.LastCheckedAt
        };
    }

    public async Task<bool> UpdateSweetwaterPotentialBuyDismissedAsync(string id, bool dismissed, CancellationToken ct = default)
    {
        var update = Builders<SweetwaterPotentialBuy>.Update.Set(x => x.Dismissed, dismissed);
        var result = await _sweetwaterPotentialBuysCollection.UpdateOneAsync(
            x => x.Id == id, update, cancellationToken: ct);
        return result.ModifiedCount > 0;
    }

    public async Task<bool> UpdateSweetwaterPotentialBuyPurchasedAsync(string id, bool purchased, CancellationToken ct = default)
    {
        var update = Builders<SweetwaterPotentialBuy>.Update.Set(x => x.Purchased, purchased);
        var result = await _sweetwaterPotentialBuysCollection.UpdateOneAsync(
            x => x.Id == id, update, cancellationToken: ct);
        return result.ModifiedCount > 0;
    }

    public async Task<long> DismissSweetwaterPotentialBuysByIdsAsync(List<string> ids, CancellationToken ct = default)
    {
        var filter = Builders<SweetwaterPotentialBuy>.Filter.In(x => x.Id, ids);
        var update = Builders<SweetwaterPotentialBuy>.Update.Set(x => x.Dismissed, true);
        var result = await _sweetwaterPotentialBuysCollection.UpdateManyAsync(filter, update, cancellationToken: ct);
        return result.ModifiedCount;
    }

    public async Task<long> DismissAllActiveSweetwaterDealsAsync(CancellationToken ct = default)
    {
        var filter = Builders<SweetwaterPotentialBuy>.Filter.And(
            Builders<SweetwaterPotentialBuy>.Filter.Eq(x => x.IsDeal, true),
            Builders<SweetwaterPotentialBuy>.Filter.Eq(x => x.Dismissed, false),
            Builders<SweetwaterPotentialBuy>.Filter.Eq(x => x.Purchased, false)
        );
        var update = Builders<SweetwaterPotentialBuy>.Update.Set(x => x.Dismissed, true);
        var result = await _sweetwaterPotentialBuysCollection.UpdateManyAsync(filter, update, cancellationToken: ct);
        return result.ModifiedCount;
    }

    public async Task<long> DeleteAllSweetwaterPotentialBuysAsync(CancellationToken ct = default)
    {
        var result = await _sweetwaterPotentialBuysCollection.DeleteManyAsync(_ => true, ct);
        return result.DeletedCount;
    }

    public async Task UpsertSweetwaterPotentialBuyAsync(SweetwaterPotentialBuy potentialBuy, CancellationToken ct = default)
    {
        var existing = await _sweetwaterPotentialBuysCollection
            .Find(x => x.SweetwaterListingId == potentialBuy.SweetwaterListingId)
            .FirstOrDefaultAsync(ct);

        if (existing != null)
        {
            potentialBuy.Id = existing.Id;
            potentialBuy.FirstSeenAt = existing.FirstSeenAt;
            potentialBuy.Dismissed = existing.Dismissed;
            potentialBuy.Purchased = existing.Purchased;
        }

        var filter = Builders<SweetwaterPotentialBuy>.Filter.Eq(x => x.SweetwaterListingId, potentialBuy.SweetwaterListingId);
        var options = new ReplaceOptions { IsUpsert = true };
        await _sweetwaterPotentialBuysCollection.ReplaceOneAsync(filter, potentialBuy, options, ct);
    }

    public async Task<long> DeleteStaleSweetwaterPotentialBuysAsync(DateTime scraperRunStartTime, CancellationToken ct = default)
    {
        var filter = Builders<SweetwaterPotentialBuy>.Filter.And(
            Builders<SweetwaterPotentialBuy>.Filter.Lt(x => x.LastCheckedAt, scraperRunStartTime),
            Builders<SweetwaterPotentialBuy>.Filter.Eq(x => x.Dismissed, false),
            Builders<SweetwaterPotentialBuy>.Filter.Eq(x => x.Purchased, false)
        );

        var result = await _sweetwaterPotentialBuysCollection.DeleteManyAsync(filter, ct);
        return result.DeletedCount;
    }

    public async Task<long> DeleteOldResolvedSweetwaterPotentialBuysAsync(int olderThanDays, CancellationToken ct = default)
    {
        var cutoffDate = DateTime.UtcNow.AddDays(-olderThanDays);

        var filter = Builders<SweetwaterPotentialBuy>.Filter.And(
            Builders<SweetwaterPotentialBuy>.Filter.Lt(x => x.LastCheckedAt, cutoffDate),
            Builders<SweetwaterPotentialBuy>.Filter.Or(
                Builders<SweetwaterPotentialBuy>.Filter.Eq(x => x.Dismissed, true),
                Builders<SweetwaterPotentialBuy>.Filter.Eq(x => x.Purchased, true)
            )
        );

        var result = await _sweetwaterPotentialBuysCollection.DeleteManyAsync(filter, ct);
        return result.DeletedCount;
    }

    public async Task<long> GetSweetwaterPotentialBuysTotalCountAsync(CancellationToken ct = default)
    {
        return await _sweetwaterPotentialBuysCollection.CountDocumentsAsync(_ => true, cancellationToken: ct);
    }

    // Admin User Management operations

    /// <summary>
    /// Get paginated users with optional search and filters for admin management.
    /// </summary>
    public async Task<(List<User> Users, long TotalCount)> GetUsersAsync(
        string? search = null,
        bool? isAdmin = null,
        bool? isGuest = null,
        bool? emailVerified = null,
        int page = 1,
        int perPage = 20)
    {
        var filterBuilder = Builders<User>.Filter;
        var filters = new List<FilterDefinition<User>>();

        // Search by email or full name
        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchFilter = filterBuilder.Or(
                filterBuilder.Regex(u => u.Email, new MongoDB.Bson.BsonRegularExpression(search, "i")),
                filterBuilder.Regex(u => u.FullName, new MongoDB.Bson.BsonRegularExpression(search, "i"))
            );
            filters.Add(searchFilter);
        }

        // Filter by admin status
        if (isAdmin.HasValue)
        {
            filters.Add(filterBuilder.Eq(u => u.IsAdmin, isAdmin.Value));
        }

        // Filter by guest status
        if (isGuest.HasValue)
        {
            filters.Add(filterBuilder.Eq(u => u.IsGuest, isGuest.Value));
        }

        // Filter by email verified status
        if (emailVerified.HasValue)
        {
            filters.Add(filterBuilder.Eq(u => u.EmailVerified, emailVerified.Value));
        }

        var combinedFilter = filters.Count > 0
            ? filterBuilder.And(filters)
            : filterBuilder.Empty;

        var totalCount = await _usersCollection.CountDocumentsAsync(combinedFilter);

        var users = await _usersCollection.Find(combinedFilter)
            .SortByDescending(u => u.CreatedAt)
            .Skip((page - 1) * perPage)
            .Limit(perPage)
            .ToListAsync();

        return (users, totalCount);
    }

    /// <summary>
    /// Delete a user by ID.
    /// </summary>
    public async Task<bool> DeleteUserAsync(string id)
    {
        var filter = Builders<User>.Filter.Eq(u => u.Id, id);
        var result = await _usersCollection.DeleteOneAsync(filter);
        if (result.DeletedCount > 0)
        {
            _logger.LogInformation("Deleted user: {UserId}", id);
        }
        return result.DeletedCount > 0;
    }

    /// <summary>
    /// Delete all data associated with a user (favorites, offers, pending cart items, etc.).
    /// </summary>
    public async Task DeleteUserRelatedDataAsync(string userId)
    {
        // Delete user's favorites
        var favoritesFilter = Builders<Favorite>.Filter.Eq(f => f.UserId, userId);
        var favoritesResult = await _favoritesCollection.DeleteManyAsync(favoritesFilter);

        // Delete user's offers
        var offersFilter = Builders<Offer>.Filter.Eq(o => o.BuyerId, userId);
        var offersResult = await _offersCollection.DeleteManyAsync(offersFilter);

        // Delete user's pending cart items
        var pendingCartFilter = Builders<PendingCartItem>.Filter.Eq(p => p.UserId, userId);
        var pendingCartResult = await _pendingCartItemsCollection.DeleteManyAsync(pendingCartFilter);

        // Delete user's messages
        var messagesFilter = Builders<Message>.Filter.Or(
            Builders<Message>.Filter.Eq(m => m.SenderId, userId),
            Builders<Message>.Filter.Eq(m => m.RecipientId, userId)
        );
        var messagesResult = await _messagesCollection.DeleteManyAsync(messagesFilter);

        // Delete conversations where user is a participant
        var conversationsFilter = Builders<Conversation>.Filter.AnyEq(c => c.ParticipantIds, userId);
        var conversationsResult = await _conversationsCollection.DeleteManyAsync(conversationsFilter);

        _logger.LogInformation(
            "Deleted related data for user {UserId}: {Favorites} favorites, {Offers} offers, {PendingCart} pending cart items, {Messages} messages, {Conversations} conversations",
            userId, favoritesResult.DeletedCount, offersResult.DeletedCount, pendingCartResult.DeletedCount,
            messagesResult.DeletedCount, conversationsResult.DeletedCount);
    }

    // === Transactions ===

    public async Task<List<Transaction>> GetTransactionsAsync(int? year = null, int? month = null)
    {
        var filter = Builders<Transaction>.Filter.Empty;
        if (year.HasValue)
        {
            var start = new DateTime(year.Value, month ?? 1, 1, 0, 0, 0, DateTimeKind.Utc);
            var end = month.HasValue
                ? start.AddMonths(1)
                : start.AddYears(1);
            filter = Builders<Transaction>.Filter.And(
                Builders<Transaction>.Filter.Gte(t => t.Date, start),
                Builders<Transaction>.Filter.Lt(t => t.Date, end));
        }
        return await _transactionsCollection
            .Find(filter)
            .SortByDescending(t => t.Date)
            .ToListAsync();
    }

    public async Task<Transaction?> GetTransactionByIdAsync(string id) =>
        await _transactionsCollection.Find(t => t.Id == id).FirstOrDefaultAsync();

    /// <summary>
    /// Finds the transaction linked to a listing. Matches by listing_id first,
    /// then falls back to guitar_name == listing title for legacy rows that
    /// predate the listing_id link.
    /// </summary>
    public async Task<Transaction?> GetTransactionByListingIdAsync(string listingId, string? listingTitle = null)
    {
        var byId = await _transactionsCollection
            .Find(t => t.ListingId == listingId)
            .FirstOrDefaultAsync();
        if (byId != null) return byId;

        if (!string.IsNullOrWhiteSpace(listingTitle))
        {
            return await _transactionsCollection
                .Find(t => t.ListingId == null && t.GuitarName == listingTitle)
                .FirstOrDefaultAsync();
        }
        return null;
    }

    /// <summary>
    /// Syncs tracking (carrier + number) onto the transaction linked to a
    /// listing. Used when an admin adds/edits tracking on a website order so the
    /// finance transaction matches. No-op if no linked transaction is found.
    /// </summary>
    public async Task SetTransactionTrackingByListingAsync(string listingId, string? listingTitle, string? trackingCarrier, string? trackingNumber)
    {
        var txn = await GetTransactionByListingIdAsync(listingId, listingTitle);
        if (txn == null) return;

        var update = Builders<Transaction>.Update
            .Set(t => t.TrackingCarrier, trackingCarrier)
            .Set(t => t.TrackingNumber, trackingNumber)
            .Set(t => t.UpdatedAt, DateTime.UtcNow);
        await _transactionsCollection.UpdateOneAsync(t => t.Id == txn.Id, update);
    }

    /// <summary>
    /// Auto-updates the transaction for each sold listing after a website order:
    /// for_sale -> sold, sets the sale date and platform, and flags it for the
    /// admin to finish payout details. Creates a transaction if none is linked.
    /// </summary>
    public async Task MarkListingsSoldInTransactionsAsync(IEnumerable<string> listingIds, DateTime saleDate)
    {
        foreach (var listingId in listingIds)
        {
            var listing = await GetMyListingByIdAsync(listingId);
            var txn = await GetTransactionByListingIdAsync(listingId, listing?.ListingTitle);

            if (txn != null)
            {
                var update = Builders<Transaction>.Update
                    .Set(t => t.ListingId, listingId)
                    .Set(t => t.TransactionType, "sold")
                    .Set(t => t.Date, saleDate)
                    .Set(t => t.SoldVia, "lukesguitarshop.com")
                    .Set(t => t.NeedsReview, true)
                    .Set(t => t.UpdatedAt, DateTime.UtcNow);
                await _transactionsCollection.UpdateOneAsync(t => t.Id == txn.Id, update);
            }
            else
            {
                var created = new Transaction
                {
                    Date = saleDate,
                    GuitarName = listing?.ListingTitle ?? "Unknown listing",
                    ListingId = listingId,
                    PurchasePrice = listing?.Price,
                    TransactionType = "sold",
                    SoldVia = "lukesguitarshop.com",
                    NeedsReview = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };
                await _transactionsCollection.InsertOneAsync(created);
            }
        }
    }

    public async Task CreateTransactionAsync(Transaction transaction) =>
        await _transactionsCollection.InsertOneAsync(transaction);

    public async Task CreateTransactionsManyAsync(List<Transaction> transactions) =>
        await _transactionsCollection.InsertManyAsync(transactions);

    public async Task UpdateTransactionAsync(string id, Transaction transaction)
    {
        transaction.UpdatedAt = DateTime.UtcNow;
        await _transactionsCollection.ReplaceOneAsync(t => t.Id == id, transaction);
    }

    public async Task DeleteTransactionAsync(string id) =>
        await _transactionsCollection.DeleteOneAsync(t => t.Id == id);

    public async Task<(decimal totalRevenue, decimal totalExpenses, decimal totalProfit, List<PlatformStat> platformStats, List<ExtraExpense> expenses)> GetFinanceSummaryAsync()
    {
        var transactions = await _transactionsCollection.Find(_ => true).ToListAsync();
        var expenses = await _extraExpensesCollection.Find(_ => true).ToListAsync();

        var totalRevenue = transactions.Where(t => t.Revenue.HasValue).Sum(t => t.Revenue!.Value);
        var totalExpenses = expenses.Sum(e => e.Cost);
        var totalProfit = transactions.Where(t => t.Profit.HasValue).Sum(t => t.Profit!.Value);

        var platformStats = transactions
            .Where(t => t.TransactionType == "sold" && t.SoldVia != null)
            .GroupBy(t => t.SoldVia!)
            .Select(g => new PlatformStat
            {
                Platform = g.Key,
                Count = g.Count(),
                TotalProfit = g.Where(t => t.Profit.HasValue).Sum(t => t.Profit!.Value),
                TotalRevenue = g.Where(t => t.Revenue.HasValue).Sum(t => t.Revenue!.Value)
            })
            .OrderByDescending(p => p.TotalProfit)
            .ToList();

        return (totalRevenue, totalExpenses, totalProfit, platformStats, expenses);
    }

    // === Extra Expenses ===

    public async Task<List<ExtraExpense>> GetExtraExpensesAsync() =>
        await _extraExpensesCollection
            .Find(_ => true)
            .SortByDescending(e => e.Date)
            .ToListAsync();

    public async Task<ExtraExpense?> GetExtraExpenseByIdAsync(string id) =>
        await _extraExpensesCollection.Find(e => e.Id == id).FirstOrDefaultAsync();

    public async Task CreateExtraExpenseAsync(ExtraExpense expense) =>
        await _extraExpensesCollection.InsertOneAsync(expense);

    public async Task UpdateExtraExpenseAsync(string id, ExtraExpense expense) =>
        await _extraExpensesCollection.ReplaceOneAsync(e => e.Id == id, expense);

    public async Task DeleteExtraExpenseAsync(string id) =>
        await _extraExpensesCollection.DeleteOneAsync(e => e.Id == id);

    // === Monthly Snapshots ===

    public async Task<List<MonthlySnapshot>> GetMonthlySnapshotsAsync() =>
        await _monthlySnapshotsCollection
            .Find(_ => true)
            .SortBy(s => s.Year).ThenBy(s => s.Month)
            .ToListAsync();

    public async Task UpsertMonthlySnapshotAsync(MonthlySnapshot snapshot)
    {
        var filter = Builders<MonthlySnapshot>.Filter.And(
            Builders<MonthlySnapshot>.Filter.Eq(s => s.Year, snapshot.Year),
            Builders<MonthlySnapshot>.Filter.Eq(s => s.Month, snapshot.Month));
        var update = Builders<MonthlySnapshot>.Update
            .Set(s => s.Year, snapshot.Year)
            .Set(s => s.Month, snapshot.Month)
            .Set(s => s.CumulativeProfit, snapshot.CumulativeProfit)
            .Set(s => s.CreatedAt, snapshot.CreatedAt);
        var options = new UpdateOptions { IsUpsert = true };
        await _monthlySnapshotsCollection.UpdateOneAsync(filter, update, options);
    }

    public async Task ImportMonthlySnapshotsAsync(List<MonthlySnapshot> snapshots)
    {
        foreach (var snapshot in snapshots)
        {
            await UpsertMonthlySnapshotAsync(snapshot);
        }
    }

    // Trade-in helpers
    public async Task<TradeInRequest> CreateTradeInRequestAsync(TradeInRequest request)
    {
        request.CreatedAt = DateTime.UtcNow;
        request.UpdatedAt = DateTime.UtcNow;
        await _tradeInRequestsCollection.InsertOneAsync(request);
        return request;
    }

    public async Task<TradeInRequest?> GetTradeInRequestByIdAsync(string id)
    {
        return await _tradeInRequestsCollection.Find(t => t.Id == id).FirstOrDefaultAsync();
    }

    public async Task<List<TradeInRequest>> GetTradeInRequestsByUserAsync(string userId)
    {
        return await _tradeInRequestsCollection
            .Find(t => t.UserId == userId)
            .SortByDescending(t => t.CreatedAt)
            .ToListAsync();
    }

    public async Task<List<TradeInRequest>> GetAllTradeInRequestsAsync(string? statusFilter = null)
    {
        var filter = string.IsNullOrEmpty(statusFilter)
            ? Builders<TradeInRequest>.Filter.Empty
            : Builders<TradeInRequest>.Filter.Eq(t => t.Status, statusFilter);
        return await _tradeInRequestsCollection
            .Find(filter)
            .SortByDescending(t => t.CreatedAt)
            .ToListAsync();
    }

    public async Task<bool> UpdateTradeInRequestAsync(TradeInRequest request)
    {
        request.UpdatedAt = DateTime.UtcNow;
        var result = await _tradeInRequestsCollection.ReplaceOneAsync(
            t => t.Id == request.Id, request);
        return result.ModifiedCount > 0;
    }

    public async Task<bool> DeleteTradeInRequestAsync(string id)
    {
        var result = await _tradeInRequestsCollection.DeleteOneAsync(t => t.Id == id);
        return result.DeletedCount > 0;
    }

    // Store credit helpers
    public async Task<StoreCredit?> GetStoreCreditByUserAsync(string userId)
    {
        return await _storeCreditsCollection.Find(s => s.UserId == userId).FirstOrDefaultAsync();
    }

    public async Task<StoreCredit> CreateOrCreditUserAsync(string userId, decimal amount, string reason, string? refId = null)
    {
        var existing = await GetStoreCreditByUserAsync(userId);
        var entry = new StoreCreditEntry
        {
            Type = StoreCreditEntryType.Credit,
            Amount = amount,
            Reason = reason,
            RefId = refId
        };

        if (existing == null)
        {
            var sc = new StoreCredit
            {
                UserId = userId,
                Balance = amount,
                History = new List<StoreCreditEntry> { entry }
            };
            await _storeCreditsCollection.InsertOneAsync(sc);
            return sc;
        }

        var update = Builders<StoreCredit>.Update
            .Inc(s => s.Balance, amount)
            .Push(s => s.History, entry)
            .Set(s => s.UpdatedAt, DateTime.UtcNow);
        await _storeCreditsCollection.UpdateOneAsync(s => s.Id == existing.Id, update);
        existing.Balance += amount;
        existing.History.Add(entry);
        return existing;
    }

    public async Task<bool> DebitUserStoreCreditAsync(string userId, decimal amount, string reason, string? refId = null)
    {
        var existing = await GetStoreCreditByUserAsync(userId);
        if (existing == null || existing.Balance < amount) return false;

        var entry = new StoreCreditEntry
        {
            Type = StoreCreditEntryType.Debit,
            Amount = amount,
            Reason = reason,
            RefId = refId
        };
        var update = Builders<StoreCredit>.Update
            .Inc(s => s.Balance, -amount)
            .Push(s => s.History, entry)
            .Set(s => s.UpdatedAt, DateTime.UtcNow);
        var filter = Builders<StoreCredit>.Filter.And(
            Builders<StoreCredit>.Filter.Eq(s => s.UserId, userId),
            Builders<StoreCredit>.Filter.Gte(s => s.Balance, amount));
        var result = await _storeCreditsCollection.UpdateOneAsync(filter, update);
        return result.ModifiedCount > 0;
    }

    // ==================== SCHEDULED JOB RUNS ====================

    /// <summary>
    /// True if a run has already been recorded for this job, date, and slot, whether it
    /// succeeded, failed, or is still in flight.
    /// </summary>
    public async Task<bool> HasScheduledJobRunAsync(string jobName, string runDate, string slot, CancellationToken ct = default)
    {
        var filter = ScheduledJobRunFilter(jobName, runDate, slot);

        return await _scheduledJobRunsCollection.Find(filter).AnyAsync(ct);
    }

    /// <summary>
    /// Attempts to claim this job/date/slot triple. Returns false if another instance
    /// already claimed it, which the unique index enforces via a duplicate key error.
    /// </summary>
    public async Task<bool> TryClaimScheduledJobRunAsync(string jobName, string runDate, string slot, CancellationToken ct = default)
    {
        try
        {
            await _scheduledJobRunsCollection.InsertOneAsync(new ScheduledJobRun
            {
                JobName = jobName,
                RunDate = runDate,
                Slot = slot,
                StartedAt = DateTime.UtcNow,
                Outcome = "running"
            }, cancellationToken: ct);

            return true;
        }
        catch (MongoWriteException ex) when (ex.WriteError?.Category == ServerErrorCategory.DuplicateKey)
        {
            return false;
        }
    }

    public async Task CompleteScheduledJobRunAsync(
        string jobName,
        string runDate,
        string slot,
        string outcome,
        string? details,
        CancellationToken ct = default)
    {
        var filter = ScheduledJobRunFilter(jobName, runDate, slot);

        var update = Builders<ScheduledJobRun>.Update
            .Set(r => r.CompletedAt, DateTime.UtcNow)
            .Set(r => r.Outcome, outcome)
            .Set(r => r.Details, details);

        await _scheduledJobRunsCollection.UpdateOneAsync(filter, update, cancellationToken: ct);
    }

    private static FilterDefinition<ScheduledJobRun> ScheduledJobRunFilter(string jobName, string runDate, string slot) =>
        Builders<ScheduledJobRun>.Filter.And(
            Builders<ScheduledJobRun>.Filter.Eq(r => r.JobName, jobName),
            Builders<ScheduledJobRun>.Filter.Eq(r => r.RunDate, runDate),
            Builders<ScheduledJobRun>.Filter.Eq(r => r.Slot, slot));
}

public class PlatformStat
{
    public string Platform { get; set; } = string.Empty;
    public int Count { get; set; }
    public decimal TotalProfit { get; set; }
    public decimal TotalRevenue { get; set; }
}
