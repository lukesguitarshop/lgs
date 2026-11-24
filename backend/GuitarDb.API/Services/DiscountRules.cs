using GuitarDb.API.Models;

namespace GuitarDb.API.Services;

public record DiscountCheck(bool Valid, string? Error)
{
    public static readonly DiscountCheck Ok = new(true, null);
    public static DiscountCheck Fail(string error) => new(false, error);
}

/// <summary>
/// Pure rules for discount codes: whether one may be used, and what it takes off.
/// No I/O, so checkout and the tests share exactly the same answers.
/// </summary>
public static class DiscountRules
{
    public const string NotValid = "That code isn't valid.";
    public const string NoEligibleItems =
        "That code doesn't apply to a guitar with an agreed price or a deposit.";

    public static string Normalize(string? typed) => (typed ?? string.Empty).Trim().ToUpperInvariant();

    public static DiscountCheck Evaluate(DiscountCode? code, DateTime utcNow, string? userId, long usesByUser)
    {
        if (code == null || !code.Active) return DiscountCheck.Fail(NotValid);
        if (utcNow < code.StartsAt) return DiscountCheck.Fail("That code isn't active yet.");
        if (utcNow >= code.ExpiresAt) return DiscountCheck.Fail("That code has expired.");
        if (string.IsNullOrEmpty(userId)) return DiscountCheck.Fail("Sign in to use a discount code.");
        if (code.MaxUsesPerUser.HasValue && usesByUser >= code.MaxUsesPerUser.Value)
            return DiscountCheck.Fail("You've already used that code.");
        if (code.MaxUses.HasValue && code.UsedCount >= code.MaxUses.Value)
            return DiscountCheck.Fail("That code has reached its limit.");

        return DiscountCheck.Ok;
    }

    /// <summary>
    /// The amount a percent-off code removes from the eligible prices, rounded to the
    /// cent and never more than those prices add up to.
    /// </summary>
    public static decimal ComputeDiscount(IEnumerable<decimal> eligiblePrices, decimal percentOff)
    {
        var eligible = eligiblePrices.Sum();
        if (eligible <= 0m || percentOff <= 0m) return 0m;

        var discount = Math.Round(eligible * percentOff / 100m, 2, MidpointRounding.AwayFromZero);
        return Math.Min(discount, eligible);
    }
}

public record CheckoutTotalsResult(
    decimal Subtotal,
    decimal Discount,
    decimal StoreCreditApplied,
    decimal Fee,
    decimal AmountDue);

/// <summary>
/// The one place checkout money is added up. Order: item prices, then the discount
/// code, then store credit, then the PayPal fee on whatever is left to pay.
/// </summary>
public static class CheckoutTotals
{
    public const decimal PayPalFeeRate = 0.035m;

    public static CheckoutTotalsResult Compute(
        decimal subtotal, decimal discount, decimal storeCreditBalance, bool payPal)
    {
        discount = Math.Clamp(discount, 0m, subtotal);
        var afterDiscount = subtotal - discount;

        var credit = Math.Round(Math.Clamp(storeCreditBalance, 0m, afterDiscount), 2);
        var afterCredit = afterDiscount - credit;

        var fee = payPal
            ? Math.Round(afterCredit * PayPalFeeRate, 2, MidpointRounding.AwayFromZero)
            : 0m;

        return new CheckoutTotalsResult(subtotal, discount, credit, fee, afterCredit + fee);
    }
}
