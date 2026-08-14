namespace GuitarDb.Scraper.Models.Reverb;

// The /priceguide API this file originally modeled was retired by Reverb (403,
// "no longer publicly available") in July 2026. Price data now comes from the
// CSP API (see CspResponse.cs); this match-confidence enum is still shared.
public enum PriceGuideMatchType
{
    CspAndYear,    // Most reliable - CSP ID + year match
    Csp,           // Very reliable - exact CSP title match
    ModelAndYear,  // Reliable - model name + year match
    Model,         // Moderate - model name match only
    YearOnly,      // Low confidence - only year matched, model may be wrong
    Fallback       // Unreliable - first result, likely wrong
}
