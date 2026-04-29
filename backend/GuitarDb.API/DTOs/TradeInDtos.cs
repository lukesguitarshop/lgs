using Microsoft.AspNetCore.Http;

namespace GuitarDb.API.DTOs;

// User-facing
public class SubmitTradeInRequest
{
    public string Brand { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string Condition { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
    public List<IFormFile>? Photos { get; set; }
}

public class AcceptTradeInOfferRequest
{
    public string Type { get; set; } = string.Empty; // "cash" or "credit"
    public string? PaypalEmail { get; set; } // required when type == "cash"
}

public class TradeInRequestDto
{
    public string Id { get; set; } = string.Empty;
    public string Brand { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string Condition { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public List<TradeInPhotoDto> Photos { get; set; } = new();
    public TradeInOfferDto? ActiveOffer { get; set; }
    public TradeInShippingDto? Shipping { get; set; }
    public TradeInPayoutDto? Payout { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class TradeInPhotoDto
{
    public string Url { get; set; } = string.Empty;
}

public class TradeInOfferDto
{
    public decimal CashOffer { get; set; }
    public decimal StoreCreditOffer { get; set; }
    public DateTime ExpiresAt { get; set; }
    public string? AcceptedType { get; set; }
    public DateTime? AcceptedAt { get; set; }
    public DateTime? DeclinedAt { get; set; }
    public bool IsExpired { get; set; }
}

public class TradeInShippingDto
{
    public string? LabelUrl { get; set; }
    public DateTime? ReceivedAt { get; set; }
    public DateTime? InspectedAt { get; set; }
}

public class TradeInPayoutDto
{
    public DateTime? CompletedAt { get; set; }
    public DateTime? PaidAt { get; set; }
}

// Admin
public class AdminTradeInListItemDto
{
    public string Id { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Brand { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string Condition { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class AdminTradeInDetailDto : TradeInRequestDto
{
    public string Email { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public List<TradeInOfferDto> AllOffers { get; set; } = new();
    public string? PaypalEmail { get; set; }
    public string? PaypalTransactionId { get; set; }
    public string? InspectionNotes { get; set; }
}

public class CreateTradeInOfferRequest
{
    public decimal CashOffer { get; set; }
    public decimal StoreCreditOffer { get; set; }
    public int ExpirationDays { get; set; } = 7;
}

public class MarkInspectedRequest
{
    public string? Notes { get; set; }
}

public class MarkPaidRequest
{
    public string? PaypalTransactionId { get; set; }
}

public class AdminEditTradeInRequest
{
    public string? Brand { get; set; }
    public string? Model { get; set; }
    public string? Condition { get; set; }
    public string? Notes { get; set; }
}

public class RejectTradeInRequest
{
    public string? Reason { get; set; }
}

// Store credit
public class StoreCreditDto
{
    public decimal Balance { get; set; }
    public List<StoreCreditEntryDto> History { get; set; } = new();
}

public class StoreCreditEntryDto
{
    public string Type { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Reason { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
