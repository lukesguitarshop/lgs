using GuitarDb.API.Models;
using GuitarDb.API.Services;

namespace GuitarDb.API.Tests;

public class DiscountRulesTests
{
    private static readonly DateTime Now = new(2026, 11, 26, 15, 0, 0, DateTimeKind.Utc);
    private const string UserId = "64b000000000000000000001";

    private static DiscountCode Code(Action<DiscountCode>? tweak = null)
    {
        var code = new DiscountCode
        {
            Code = "STRUM-1126",
            PercentOff = 5m,
            StartsAt = Now.AddDays(-1),
            ExpiresAt = Now.AddDays(13),
            Active = true,
            MaxUsesPerUser = 1
        };
        tweak?.Invoke(code);
        return code;
    }

    // ---- Normalize ----

    [Theory]
    [InlineData("  strum-1126 ", "STRUM-1126")]
    [InlineData("Strum-1126", "STRUM-1126")]
    [InlineData(null, "")]
    [InlineData("   ", "")]
    public void Normalize_trims_and_uppercases(string? typed, string expected)
    {
        Assert.Equal(expected, DiscountRules.Normalize(typed));
    }

    // ---- Evaluate ----

    [Fact]
    public void A_live_code_is_valid_for_a_signed_in_buyer()
    {
        var check = DiscountRules.Evaluate(Code(), Now, UserId, usesByUser: 0);

        Assert.True(check.Valid);
        Assert.Null(check.Error);
    }

    [Fact]
    public void An_unknown_code_is_rejected()
    {
        var check = DiscountRules.Evaluate(null, Now, UserId, usesByUser: 0);

        Assert.False(check.Valid);
        Assert.Equal("That code isn't valid.", check.Error);
    }

    [Fact]
    public void A_deactivated_code_is_rejected_like_an_unknown_one()
    {
        var check = DiscountRules.Evaluate(Code(c => c.Active = false), Now, UserId, usesByUser: 0);

        Assert.False(check.Valid);
        Assert.Equal("That code isn't valid.", check.Error);
    }

    [Fact]
    public void A_code_is_rejected_before_its_start_date()
    {
        var check = DiscountRules.Evaluate(Code(c => c.StartsAt = Now.AddMinutes(1)), Now, UserId, usesByUser: 0);

        Assert.False(check.Valid);
        Assert.Equal("That code isn't active yet.", check.Error);
    }

    [Fact]
    public void A_code_is_rejected_once_it_has_expired()
    {
        var check = DiscountRules.Evaluate(Code(c => c.ExpiresAt = Now), Now, UserId, usesByUser: 0);

        Assert.False(check.Valid);
        Assert.Equal("That code has expired.", check.Error);
    }

    [Fact]
    public void A_code_needs_an_account()
    {
        var check = DiscountRules.Evaluate(Code(), Now, userId: null, usesByUser: 0);

        Assert.False(check.Valid);
        Assert.Equal("Sign in to use a discount code.", check.Error);
    }

    [Fact]
    public void A_buyer_cannot_use_a_one_per_account_code_twice()
    {
        var check = DiscountRules.Evaluate(Code(), Now, UserId, usesByUser: 1);

        Assert.False(check.Valid);
        Assert.Equal("You've already used that code.", check.Error);
    }

    [Fact]
    public void A_code_without_a_per_account_limit_can_be_reused()
    {
        var check = DiscountRules.Evaluate(Code(c => c.MaxUsesPerUser = null), Now, UserId, usesByUser: 3);

        Assert.True(check.Valid);
    }

    [Fact]
    public void A_code_is_rejected_once_its_total_uses_run_out()
    {
        var check = DiscountRules.Evaluate(
            Code(c => { c.MaxUses = 10; c.UsedCount = 10; }), Now, UserId, usesByUser: 0);

        Assert.False(check.Valid);
        Assert.Equal("That code has reached its limit.", check.Error);
    }

    // ---- ComputeDiscount ----

    [Fact]
    public void Five_percent_of_a_single_guitar()
    {
        Assert.Equal(60m, DiscountRules.ComputeDiscount(new[] { 1200m }, 5m));
    }

    [Fact]
    public void The_discount_is_taken_on_the_combined_eligible_prices()
    {
        Assert.Equal(107.50m, DiscountRules.ComputeDiscount(new[] { 1200m, 950m }, 5m));
    }

    [Fact]
    public void The_discount_rounds_to_the_cent_half_up()
    {
        // 5% of 999.99 = 49.9995; 5% of 1234.50 = 61.725
        Assert.Equal(50.00m, DiscountRules.ComputeDiscount(new[] { 999.99m }, 5m));
        Assert.Equal(61.73m, DiscountRules.ComputeDiscount(new[] { 1234.50m }, 5m));
    }

    [Fact]
    public void Nothing_eligible_means_no_discount()
    {
        Assert.Equal(0m, DiscountRules.ComputeDiscount(Array.Empty<decimal>(), 5m));
    }

    [Fact]
    public void The_discount_never_exceeds_what_is_being_bought()
    {
        Assert.Equal(500m, DiscountRules.ComputeDiscount(new[] { 500m }, 150m));
    }
}

public class CheckoutTotalsTests
{
    [Fact]
    public void A_card_order_with_no_code_or_credit_charges_the_subtotal()
    {
        var totals = CheckoutTotals.Compute(subtotal: 1200m, discount: 0m, storeCreditBalance: 0m, payPal: false);

        Assert.Equal(1200m, totals.Subtotal);
        Assert.Equal(0m, totals.Discount);
        Assert.Equal(0m, totals.StoreCreditApplied);
        Assert.Equal(0m, totals.Fee);
        Assert.Equal(1200m, totals.AmountDue);
    }

    [Fact]
    public void The_discount_comes_off_a_card_order()
    {
        var totals = CheckoutTotals.Compute(1200m, 60m, 0m, payPal: false);

        Assert.Equal(1140m, totals.AmountDue);
    }

    [Fact]
    public void Store_credit_is_applied_after_the_discount()
    {
        var totals = CheckoutTotals.Compute(1200m, 60m, storeCreditBalance: 200m, payPal: false);

        Assert.Equal(200m, totals.StoreCreditApplied);
        Assert.Equal(940m, totals.AmountDue);
    }

    [Fact]
    public void Store_credit_only_covers_what_is_left_after_the_discount()
    {
        var totals = CheckoutTotals.Compute(1200m, 60m, storeCreditBalance: 5000m, payPal: false);

        Assert.Equal(1140m, totals.StoreCreditApplied);
        Assert.Equal(0m, totals.AmountDue);
    }

    [Fact]
    public void The_paypal_fee_is_charged_on_what_is_left_after_discount_and_credit()
    {
        var totals = CheckoutTotals.Compute(1200m, 60m, storeCreditBalance: 140m, payPal: true);

        // 1200 - 60 - 140 = 1000; 3.5% = 35
        Assert.Equal(35m, totals.Fee);
        Assert.Equal(1035m, totals.AmountDue);
    }

    [Fact]
    public void The_paypal_fee_rounds_to_the_cent()
    {
        var totals = CheckoutTotals.Compute(999.99m, 50m, 0m, payPal: true);

        // 949.99 * 0.035 = 33.24965
        Assert.Equal(33.25m, totals.Fee);
        Assert.Equal(983.24m, totals.AmountDue);
    }

    [Fact]
    public void A_discount_larger_than_the_subtotal_is_capped()
    {
        var totals = CheckoutTotals.Compute(100m, 250m, 0m, payPal: false);

        Assert.Equal(100m, totals.Discount);
        Assert.Equal(0m, totals.AmountDue);
    }
}
