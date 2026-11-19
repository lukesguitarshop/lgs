using GuitarDb.API.Models;
using MongoDB.Bson;

namespace GuitarDb.API.Tests;

/// <summary>
/// Offer system messages (expired, auto-declined) have no human sender. They still have
/// to be storable: Message.SenderId is an ObjectId column, so a sender that is not an
/// ObjectId cannot be written and the write throws.
/// </summary>
public class OfferMessageSerializationTests
{
    private static Message SystemMessage(string? senderId) => new()
    {
        ConversationId = ObjectId.GenerateNewId().ToString(),
        SenderId = senderId!,
        RecipientId = ObjectId.GenerateNewId().ToString(),
        MessageText = "Offer of $500 expired after 48 hours",
        Type = "expire",
        OfferAmount = 500m
    };

    [Fact]
    public void A_message_with_no_sender_can_be_stored()
    {
        var doc = SystemMessage(null).ToBsonDocument();
        Assert.True(doc["sender_id"].IsBsonNull);
    }

    [Fact]
    public void A_message_sent_by_the_word_system_cannot_be_stored()
    {
        Assert.ThrowsAny<Exception>(() => SystemMessage("system").ToBsonDocument());
    }
}
