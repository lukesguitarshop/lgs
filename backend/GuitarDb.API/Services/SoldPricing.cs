using System.Text.RegularExpressions;
using GuitarDb.API.Models;

namespace GuitarDb.API.Services;

/// <summary>Median sold price for a product, from the narrowest window with enough sales.</summary>
public record SoldStats(decimal? Median, int WindowMonths, int SaleCount, decimal? Low, decimal? High);

/// <summary>Pure sold-price rules: the median window, broad products, override keys and product links.</summary>
public static class SoldPriceMath
{
    public const int MinSales = 5;
    public static readonly int[] WindowsMonths = { 6, 12, 24 };

    /// <summary>
    /// Median of sales in the last 6 months; with fewer than <see cref="MinSales"/> sales it widens
    /// to 12, then 24 months. When even 24 months is short, returns what 24 months has
    /// (SaleCount below MinSales tells the caller it isn't enough).
    /// </summary>
    public static SoldStats Compute(IEnumerable<ProductSale> sales, DateTime nowUtc)
    {
        var all = sales.ToList();
        List<decimal> inWindow = new();
        var window = WindowsMonths[^1];

        foreach (var months in WindowsMonths)
        {
            var cutoff = nowUtc.AddMonths(-months);
            inWindow = all.Where(s => s.SoldAt >= cutoff && s.Amount > 0).Select(s => s.Amount).ToList();
            window = months;
            if (inWindow.Count >= MinSales) break;
        }

        if (inWindow.Count == 0)
            return new SoldStats(null, window, 0, null, null);

        return new SoldStats(Median(inWindow), window, inWindow.Count, inWindow.Min(), inWindow.Max());
    }

    public static decimal Median(IReadOnlyCollection<decimal> values)
    {
        var sorted = values.OrderBy(v => v).ToList();
        var mid = sorted.Count / 2;
        var median = sorted.Count % 2 == 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2m;
        return Math.Round(median, 2);
    }

    /// <summary>
    /// A product named by a single word after the brand ("Fender Stratocaster", "Gibson SG")
    /// lumps too many guitars together to price from.
    /// </summary>
    public static bool IsBroad(string title, string? brand)
    {
        var core = ProductMatcher.StripBrand(title, brand);
        core = ProductMatcher.YearRange.Replace(core, " ");
        core = Regex.Replace(core, @"\([^)]*\)", " ");
        var tokens = ProductMatcher.Tokens(core);
        return tokens.Count <= 1 || BroadFamilies.Contains(string.Join(' ', tokens));
    }

    /// <summary>Two-word model families that are as broad as a single word.</summary>
    private static readonly HashSet<string> BroadFamilies = new(StringComparer.OrdinalIgnoreCase)
    {
        "les paul", "flying v", "es 335", "es 339", "precision bass", "jazz bass", "p bass", "j bass",
        "dreadnought", "acoustic guitar", "electric guitar",
    };

    /// <summary>Override key for seller-typed make + model: lowercase words only.</summary>
    public static string? OverrideKey(string? make, string? model)
    {
        var m = ProductMatcher.Normalize(make ?? "");
        var mo = ProductMatcher.Normalize(model ?? "");
        if (m.Length == 0 || mo.Length == 0) return null;
        return $"{m}|{mo}";
    }

    /// <summary>Product slug from a pasted reverb.com/p/... link (or a bare slug), or null.</summary>
    public static string? ParseProductSlug(string? input)
    {
        if (string.IsNullOrWhiteSpace(input)) return null;
        var text = input.Trim();

        var match = Regex.Match(text, @"reverb\.com/p/([a-z0-9][a-z0-9\-]*)", RegexOptions.IgnoreCase);
        if (match.Success) return match.Groups[1].Value.ToLowerInvariant();

        return Regex.IsMatch(text, @"^[a-z0-9][a-z0-9\-]*$", RegexOptions.IgnoreCase) && text.Contains('-')
            ? text.ToLowerInvariant()
            : null;
    }
}

/// <summary>A product candidate from Reverb's catalog search.</summary>
public record ProductCandidate(string Id, string Title, string? Brand);

/// <summary>
/// Text matching for listings without a product link: builds a cascade of cleaned-up
/// search queries and scores catalog results, refusing weak or ambiguous matches.
/// </summary>
public static class ProductMatcher
{
    public const double MinScore = 0.6;
    public const double TieMargin = 0.05;

    internal static readonly Regex YearRange = new(@"\b(19|20)\d{2}\s*-\s*((19|20)\d{2}|present)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex Year = new(@"\b(19|20)\d{2}\b", RegexOptions.Compiled);
    private static readonly Regex TrailingYear = new(@"\b(19|20)\d{2}$", RegexOptions.Compiled);
    private static readonly Regex Weight = new(@"\b\d+(\.\d+)?\s?(kg|lbs?)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex Bracketed = new(@"\([^)]*\)|\[[^\]]*\]", RegexOptions.Compiled);

    private static readonly string[] NoisePhrases =
    {
        "pre-owned", "pre owned", "preowned", "limited edition", "artist series", "electric guitar",
        "acoustic guitar", "hard case", "hardshell case", "hard shell case", "gig bag", "with case",
        "w/ case", "original case", "free shipping", "made in", "olympic white", "candy apple red",
        "lake placid blue", "sea foam green", "seafoam green", "surf green", "shell pink", "fiesta red",
        "daphne blue", "sonic blue", "desert sand", "wine red", "heritage cherry", "cherry sunburst",
        "tobacco burst", "tobacco sunburst", "honey burst", "gold top", "3-tone sunburst", "2-tone sunburst",
        "three tone sunburst", "two tone sunburst", "antique natural", "vintage white", "arctic white",
        "semi-hollowbody", "semi-hollow", "semi hollow", "hollow body", "solid body", "acoustic-electric",
        "acoustic electric", "nylon-string", "steel-string", "grand auditorium", "sweetwater exclusive",
    };

    private static readonly HashSet<string> NoiseWords = new(StringComparer.OrdinalIgnoreCase)
    {
        "fsr", "used", "new", "mint", "excellent", "condition", "guitar", "electric", "w", "with", "and",
        "in", "the", "of", "a", "an", "case", "ohsc", "hsc", "bag", "original", "extras", "modded",
        "upgraded", "upgrades", "black", "white", "red", "blue", "green", "yellow", "orange", "pink",
        "purple", "silver", "sunburst", "burst", "natural", "cherry", "tobacco",
        "goldtop", "honeyburst", "metallic", "blonde", "butterscotch", "antique", "finish",
        "series", "solidbody", "hollowbody", "plek'd", "plekd", "figured",
    };

    /// <summary>Catalog products that aren't guitars (cases, parts, accessories) - never a match for a guitar listing.</summary>
    private static readonly Regex Accessory = new(
        @"\b(case|cases|gig ?bag|hardshell|pickguard|pickups?|strap|knobs?|tuners?|bridge|tailpiece|parts|loaded|cover|stand|decal|sticker|poster|amp|amplifier|pedal|strings|neck|body)\b",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static bool IsAccessory(string productTitle) => Accessory.IsMatch(productTitle);

    /// <summary>
    /// Flags that split otherwise-similar products; a mismatch on any is penalized. ProductOnly
    /// flags count only when the product has them - sellers call plenty of regular guitars
    /// "Limited Edition", but a limited-edition product never prices a regular one.
    /// </summary>
    private static readonly (string Name, string[] Patterns, bool ProductOnly)[] Flags =
    {
        ("left", new[] { "left handed", "lefty", "left hand", "lh" }, false),
        ("custom shop", new[] { "custom shop" }, false),
        ("relic", new[] { "relic", "relic'd" }, false),
        ("junior", new[] { "junior", "jr" }, false),
        ("special", new[] { "special" }, false),
        ("bass", new[] { "bass" }, false),
        ("12 string", new[] { "12 string" }, false),
        ("limited", new[] { "limited edition", "limited run", "ltd edition" }, true),
    };

    /// <summary>Lowercase, apostrophes dropped, every other non-alphanumeric run turned into one space.</summary>
    public static string Normalize(string text)
    {
        var lower = text.ToLowerInvariant().Replace("'", "").Replace("’", "").Replace("‘", "");
        return Regex.Replace(lower, @"[^a-z0-9]+", " ").Trim();
    }

    public static List<string> Tokens(string text) =>
        Normalize(text).Split(' ', StringSplitOptions.RemoveEmptyEntries).ToList();

    public static string StripBrand(string title, string? brand)
    {
        if (!string.IsNullOrEmpty(brand) && title.StartsWith(brand, StringComparison.OrdinalIgnoreCase))
            return title[brand.Length..].Trim();
        return title;
    }

    /// <summary>
    /// Seller text with the filler that defeats Reverb's search removed: the brand, years,
    /// bracketed asides, weights, colors, condition words, and serial or part-number tokens.
    /// Model-defining tokens like '50s, II, HSS and MIJ stay.
    /// </summary>
    public static string Clean(string text, string? make)
    {
        var s = " " + text + " ";
        s = Bracketed.Replace(s, " ");
        s = Weight.Replace(s, " ");
        s = YearRange.Replace(s, " ");
        s = Year.Replace(s, " ");
        s = s.Replace("™", " ").Replace("®", " ").Replace("–", " ").Replace("—", " ");

        foreach (var phrase in NoisePhrases)
            s = Regex.Replace(s, $@"(?<![a-z0-9]){Regex.Escape(phrase)}(?![a-z0-9])", " ", RegexOptions.IgnoreCase);

        var words = new List<string>();
        foreach (var raw in s.Split(new[] { ' ', ',', '/', '|', '*', '!', '"', '#', '+', '&' }, StringSplitOptions.RemoveEmptyEntries))
        {
            var word = raw.Trim('-', '.', ':', ';', '(', ')');
            if (word.Length == 0) continue;
            if (!string.IsNullOrEmpty(make) && word.Equals(make, StringComparison.OrdinalIgnoreCase)) continue;
            if (NoiseWords.Contains(word)) continue;
            if (LooksLikeSerial(word)) continue;
            words.Add(word);
        }

        return string.Join(' ', words);
    }

    /// <summary>
    /// Part numbers (0262311506), SKUs (LPSTAA01IUCH1) and serials (Q005966): five or more
    /// digits, or eleven or more characters. Model names like OMC-15E, RG7620 and RGIX27FESM stay.
    /// </summary>
    private static bool LooksLikeSerial(string word)
    {
        var digits = word.Count(char.IsDigit);
        // Length per hyphen part, so a model plus finish code (RGIX27FESM-FSL) isn't one long token
        var longestPart = word.Split('-').Max(part => part.Count(char.IsLetterOrDigit));
        return digits > 0 && (digits >= 5 || longestPart >= 11);
    }

    /// <summary>Search queries to try in order, most literal first, duplicates and empties removed.</summary>
    public static List<string> BuildQueries(string make, string model, string? title)
    {
        var queries = new List<string>();

        void Add(string body)
        {
            body = Regex.Replace(body, @"\s+", " ").Trim();
            if (body.Length == 0) return;
            var q = body.StartsWith(make, StringComparison.OrdinalIgnoreCase) ? body : $"{make} {body}";
            if (!queries.Contains(q, StringComparer.OrdinalIgnoreCase)) queries.Add(q);
        }

        var cleanModel = Clean(model, make);
        Add(model);
        Add(cleanModel);
        if (!string.IsNullOrWhiteSpace(title)) Add(Clean(title, make));

        // Reverb's search needs every word to match, so fall back to the model number alone
        // (114ce, D-18, EC-1000, PS-7) and then the first two words of the model
        var words = cleanModel.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var modelNumber = words.Where(w => w.Any(char.IsDigit)).OrderByDescending(w => w.Length).FirstOrDefault();
        if (modelNumber != null) Add(modelNumber);
        if (words.Length > 2) Add(string.Join(' ', words.Take(2)));

        return queries;
    }

    /// <summary>
    /// How well a catalog product fits the listing, roughly 0-1.15: mostly the share of the
    /// product's words found in the listing, some for the share of the listing's words in
    /// the product, a bonus or penalty for the listing year against the product's year
    /// range, and penalties for flag mismatches (left-handed, Custom Shop, Relic...).
    /// </summary>
    public static double Score(string listingText, int? listingYear, ProductCandidate candidate, string? make) =>
        Evaluate(listingText, listingYear, candidate, make).Score;

    /// <summary>
    /// A text match good enough to price deals from: every word of the product name is in the
    /// listing, at least two words are shared, at least 75% of the listing's words are in the
    /// product name, nothing conflicts (year outside the product's range, left-handed, Custom
    /// Shop...), and a product limited to a year range only counts when the listing has a year.
    /// </summary>
    public static bool IsStrongMatch(string listingText, int? listingYear, ProductCandidate candidate, string? make)
    {
        var e = Evaluate(listingText, listingYear, candidate, make);
        return e.ProductCoverage >= 1.0
            && e.Shared >= 2
            && e.ListingCoverage >= 0.75
            && !e.Conflict
            && !(e.HasYearRange && listingYear == null);
    }

    /// <summary>
    /// Whether the seller's own text names this product: at least 75% of the product's words
    /// appear in it, no flag or year conflicts, and a year-ranged product needs a listing year.
    /// Guards learned aliases - "Les Paul" alone must not become an alias for "Les Paul Junior".
    /// </summary>
    public static bool NamesProduct(string sellerText, int? listingYear, ProductCandidate candidate, string? make)
    {
        var e = Evaluate(sellerText, listingYear, candidate, make);
        // A product tied to years ("SG Standard 1991 - 2012") only names an undated listing's text loosely
        return e.ProductCoverage >= 0.75 && !e.Conflict && !(e.HasYearRange && listingYear == null);
    }

    private record Evaluation(double Score, double ProductCoverage, double ListingCoverage, bool Conflict, int Shared = 0, bool HasYearRange = false);

    private static Evaluation Evaluate(string listingText, int? listingYear, ProductCandidate candidate, string? make)
    {
        var core = StripBrand(candidate.Title, candidate.Brand ?? make);
        // A year range ("1986 - 2000") or a single model year ("Cabronita Telecaster 2019")
        Match rangeMatch = YearRange.Match(core);
        // Only a trailing year is a model year; "1959 Les Paul Reissue" names a model
        if (!rangeMatch.Success) rangeMatch = TrailingYear.Match(core.Trim());
        var productTokens = Tokens(Clean(core, make)).Distinct().ToHashSet();
        var listingTokens = Tokens(Clean(listingText, make)).Distinct().ToHashSet();
        if (productTokens.Count == 0 || listingTokens.Count == 0) return new Evaluation(0, 0, 0, true);

        var shared = productTokens.Count(listingTokens.Contains);
        var productCoverage = (double)shared / productTokens.Count;
        var listingCoverage = (double)shared / listingTokens.Count;
        var score = 0.7 * productCoverage + 0.3 * listingCoverage;
        var conflict = false;

        if (listingYear.HasValue && rangeMatch.Success)
        {
            var years = Regex.Matches(rangeMatch.Value, @"\d{4}");
            var from = int.Parse(years[0].Value);
            // "2019 - Present" runs to now; a single model year allows the next year too
            var to = years.Count > 1 ? int.Parse(years[1].Value)
                : rangeMatch.Value.Contains('-') ? DateTime.UtcNow.Year
                : from + 1;
            if (listingYear >= from && listingYear <= to)
            {
                score += 0.15;
            }
            else
            {
                score -= 0.3;
                conflict = true;
            }
        }

        var listingNorm = $" {Normalize(listingText)} ";
        var productNorm = $" {Normalize(candidate.Title)} ";
        foreach (var (_, patterns, productOnly) in Flags)
        {
            var inListing = patterns.Any(p => listingNorm.Contains($" {Normalize(p)} "));
            var inProduct = patterns.Any(p => productNorm.Contains($" {Normalize(p)} "));
            if (productOnly ? inProduct && !inListing : inListing != inProduct)
            {
                score -= 0.25;
                conflict = true;
            }
        }

        return new Evaluation(score, productCoverage, listingCoverage, conflict, shared, rangeMatch.Success);
    }

    /// <summary>
    /// The best-scoring candidate from the listing's brand, or null when the best is below
    /// <see cref="MinScore"/> or a different product scores within <see cref="TieMargin"/> of it.
    /// </summary>
    public static ProductCandidate? PickBest(string listingText, int? listingYear, string make, IEnumerable<ProductCandidate> candidates)
    {
        var scored = candidates
            .Where(c => string.IsNullOrEmpty(c.Brand) || c.Brand.Equals(make, StringComparison.OrdinalIgnoreCase))
            .Where(c => !IsAccessory(c.Title))
            .Select(c => (Candidate: c, Score: Score(listingText, listingYear, c, make)))
            .OrderByDescending(x => x.Score)
            .ToList();

        if (scored.Count == 0 || scored[0].Score < MinScore) return null;
        if (scored.Count > 1 && scored[0].Score - scored[1].Score < TieMargin && scored[1].Candidate.Id != scored[0].Candidate.Id)
            return null;

        return scored[0].Candidate;
    }
}
