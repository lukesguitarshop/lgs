using System.Net;
using System.Text.RegularExpressions;

namespace GuitarDb.API.Services;

/// <summary>
/// The years a listing's guitar could have been made: one year when it's known, or a span
/// such as a decade ("2010s") when that's all the listing says. Converts from a plain year.
/// </summary>
public readonly record struct YearSpan(int From, int To)
{
    public bool IsExact => From == To;

    public static implicit operator YearSpan(int year) => new(year, year);

    /// <summary>"2015", "2010s" or "2019-2024".</summary>
    public override string ToString() =>
        IsExact ? From.ToString()
        : From % 10 == 0 && To == From + 9 ? $"{From}s"
        : $"{From}-{To}";
}

/// <summary>Where a listing's year came from, for display and trust.</summary>
public static class YearSources
{
    public const string Listing = "listing";
    public const string Title = "title";
    public const string Serial = "serial";
    public const string Description = "description";
}

/// <summary>
/// Pulls facts the seller didn't put in the structured fields out of the listing's text -
/// mainly the year, which decides between products split by year range
/// ("Les Paul Studio 1998 - 2011" vs "(2019 - 2024)").
/// </summary>
public static class ListingFacts
{
    private static int MaxYear => DateTime.UtcNow.Year + 1;
    private const int MinYear = 1950;

    private static readonly Regex FourDigitYear = new(@"(?<![\d'’])(19[5-9]\d|20[0-4]\d)(?![\d])", RegexOptions.Compiled);

    /// <summary>A year that names a model, not when it was made: "1959 Reissue", "'63 style", "1963 Telecaster VOS".</summary>
    private static readonly Regex ModelYearAfter = new(@"^\s*(-?\s*(re-?issue|ri|vos|style|spec|historic|tribute|anniversary|reproduction|replica)\b|s\b|'s\b)", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex ModelYearBefore = new(@"\b(vintage(\s+ii)?|avri|avii|custom\s+shop|historic|time\s+machine|limited)\s*$", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex ReissueTitle = new(@"\b(re-?issue|historic|vos|r[4-9]|ri)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex Decade = new(@"(?<![\d])(?:(19|20)(\d)0|'?(\d)0)\s?'?s\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex YearRangeText = new(@"\b((?:19|20)\d{2})\s*[-–]\s*((?:19|20)\d{2}|present)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex Serial = new(
        @"\b(?:serial|s/n|sn|ser\.?)\s*(?:number|no\.?|num|#)?\s*(?:is\s*)?[:#\-]?\s*(?<s>[A-Z]{0,3}\s?\d{5,10})\b",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    /// <summary>Description phrases that state when the guitar was made.</summary>
    private static readonly Regex[] DescriptionYearPhrases =
    {
        new(@"\b(?:made|built|manufactured|produced|crafted|assembled|dated?|dates\s+(?:back\s+)?to|from|circa|ca\.|c\.)\s+(?:in\s+)?(?:the\s+)?(?:year\s+)?(?<y>(?:19|20)\d{2})\b", RegexOptions.IgnoreCase | RegexOptions.Compiled),
        new(@"\b(?:model\s+)?year\s*[:\-]\s*(?<y>(?:19|20)\d{2})\b", RegexOptions.IgnoreCase | RegexOptions.Compiled),
        new(@"\b(?:bought|purchased)\s+(?:it\s+)?(?:brand\s+)?new\s+(?:in\s+)?(?<y>(?:19|20)\d{2})\b", RegexOptions.IgnoreCase | RegexOptions.Compiled),
        new(@"\b(?<y>(?:19|20)\d{2})\s+(?:model|build|production)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled),
    };

    /// <summary>
    /// The guitar's year (or span) and where it came from. Exact years win over spans; within
    /// each, the most reliable source wins: the listing's own year, the title, a decoded serial
    /// number, then a phrase in the description.
    /// </summary>
    public static (YearSpan? Years, string? Source) FindYears(
        string? make,
        string? model,
        string? yearField,
        string? title,
        string? description,
        int? madeYear = null,
        string? madeDecade = null)
    {
        var text = HtmlToText(description);
        var field = ParseYearField(yearField);

        if (madeYear is { } my && Valid(my)) return (my, YearSources.Listing);
        if (field is { IsExact: true }) return (field, YearSources.Listing);
        if (YearFromTitle(title, model) is { } titleYear) return (titleYear, YearSources.Title);
        if ((YearFromSerial(make, title) ?? YearFromSerial(make, text)) is { } serialYear) return (serialYear, YearSources.Serial);
        if (YearFromDescription(text, make, model) is { } descYear) return (descYear, YearSources.Description);

        if (field != null) return (field, YearSources.Listing);
        if (ParseYearField(madeDecade) is { } decade) return (decade, YearSources.Listing);
        if (DecadeFromTitle(title, model) is { } titleDecade) return (titleDecade, YearSources.Title);

        return (null, null);
    }

    /// <summary>Reverb's year field: "2015", "2010s", "Late 70's", "1993 - 1994", "2019 - Present".</summary>
    public static YearSpan? ParseYearField(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var text = value.Trim();

        var range = YearRangeText.Match(text);
        if (range.Success)
        {
            var from = int.Parse(range.Groups[1].Value);
            var to = range.Groups[2].Value.Equals("present", StringComparison.OrdinalIgnoreCase) ? DateTime.UtcNow.Year : int.Parse(range.Groups[2].Value);
            // A wide range is the catalog product's span, not this guitar's year
            return Valid(from) && to >= from && to - from <= 12 ? (from == to ? from : new YearSpan(from, to)) : null;
        }

        var year = FourDigitYear.Match(text);
        if (year.Success && !Decade.IsMatch(text)) return Valid(int.Parse(year.Value)) ? int.Parse(year.Value) : null;

        return ParseDecade(text);
    }

    private static YearSpan? ParseDecade(string text)
    {
        var m = Decade.Match(text);
        if (!m.Success) return null;

        int start;
        if (m.Groups[1].Success) start = int.Parse(m.Groups[1].Value + m.Groups[2].Value + "0");
        else
        {
            var d = int.Parse(m.Groups[3].Value);
            start = d >= 5 ? 1900 + d * 10 : 2000 + d * 10; // '70s -> 1970s, '10s -> 2010s
        }

        return Valid(start) ? new YearSpan(start, start + 9) : null;
    }

    /// <summary>A four-digit year in the title that isn't part of the model name.</summary>
    private static int? YearFromTitle(string? title, string? model)
    {
        if (string.IsNullOrWhiteSpace(title)) return null;
        // Reissue and historic titles are full of model years ("1959 Les Paul Reissue")
        if (ReissueTitle.IsMatch(title)) return null;

        foreach (Match m in FourDigitYear.Matches(title))
        {
            var year = int.Parse(m.Value);
            if (!Valid(year)) continue;
            // "American Vintage II 1963 Telecaster", "Custom Shop 1956 Stratocaster" name a model
            if (ModelYearBefore.IsMatch(title[..m.Index])) continue;
            if (ModelYearAfter.IsMatch(title[(m.Index + m.Length)..])) continue;
            // "2019 - Present" in a Reverb title is the catalog range, not the year
            if (Regex.IsMatch(title[(m.Index + m.Length)..], @"^\s*[-–]\s*((19|20)\d{2}|present)\b", RegexOptions.IgnoreCase)) continue;
            if (m.Index > 0 && Regex.IsMatch(title[..m.Index], @"[-–]\s*$")) continue;
            return year;
        }

        return null;
    }

    private static YearSpan? DecadeFromTitle(string? title, string? model)
    {
        if (string.IsNullOrWhiteSpace(title)) return null;
        var m = Decade.Match(title);
        // "'60s Stratocaster" in the model names a style, not when it was made
        if (!m.Success || (!string.IsNullOrEmpty(model) && model.Contains(m.Value.Trim(), StringComparison.OrdinalIgnoreCase))) return null;
        return ParseDecade(m.Value);
    }

    private static int? YearFromDescription(string? text, string? make, string? model)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;

        var phrases = DescriptionYearPhrases.ToList();
        if (!string.IsNullOrWhiteSpace(make))
        {
            // "this 2015 Gibson", "a beautiful 2019 Fender", "2008 Gibson Les Paul" opening a sentence
            phrases.Add(new Regex($@"\b(?:this|a|an|my|our|the)\s+(?:\w+\s+){{0,2}}?(?<y>(?:19|20)\d{{2}})\s+{Regex.Escape(make)}\b", RegexOptions.IgnoreCase));
            phrases.Add(new Regex($@"(?:^|[.!?\n])\s*(?<y>(?:19|20)\d{{2}})\s+{Regex.Escape(make)}\b", RegexOptions.IgnoreCase));
        }

        foreach (var phrase in phrases)
        {
            foreach (Match m in phrase.Matches(text))
            {
                var y = m.Groups["y"];
                var year = int.Parse(y.Value);
                if (!Valid(year)) continue;
                if (!string.IsNullOrEmpty(model) && model.Contains(y.Value)) continue;
                if (ModelYearAfter.IsMatch(text[(y.Index + y.Length)..])) continue;
                return year;
            }
        }

        return null;
    }

    /// <summary>The year encoded in a Gibson or Fender serial number mentioned in the text.</summary>
    public static int? YearFromSerial(string? make, string? text)
    {
        if (string.IsNullOrWhiteSpace(text) || string.IsNullOrWhiteSpace(make)) return null;

        foreach (Match m in Serial.Matches(text))
        {
            var serial = m.Groups["s"].Value.Replace(" ", "").ToUpperInvariant();
            var year = make.Equals("Gibson", StringComparison.OrdinalIgnoreCase) ? DecodeGibson(serial)
                : make.Equals("Fender", StringComparison.OrdinalIgnoreCase) ? DecodeFender(serial)
                : null;
            if (year is { } y && Valid(y)) return y;
        }

        return null;
    }

    /// <summary>
    /// Gibson USA: 8 or 9 digits YDDDYRRR(R) since 1977 - the year is digits 1 and 5. From 2014
    /// some serials start with the two-digit year instead, which YDDD can't produce (a day never
    /// starts with 4 or more).
    /// </summary>
    public static int? DecodeGibson(string serial)
    {
        if (!Regex.IsMatch(serial, @"^\d{8,10}$")) return null;

        if (serial[1] >= '4')
        {
            var yy = int.Parse(serial[..2]);
            return yy >= 14 && 2000 + yy <= MaxYear ? 2000 + yy : null;
        }

        if (serial.Length > 9) return null;
        var day = int.Parse(serial.Substring(1, 3));
        if (day is < 1 or > 366) return null;
        var twoDigit = int.Parse($"{serial[0]}{serial[4]}");
        return twoDigit >= 77 ? 1900 + twoDigit : 2000 + twoDigit;
    }

    /// <summary>Fender: the year is in the prefix - US19..., MX15..., Z5..., N4..., MZ7..., IC12...</summary>
    public static int? DecodeFender(string serial)
    {
        var rules = new (string Pattern, Func<Match, int> Year)[]
        {
            (@"^US(\d{2})\d{4,}$", m => 2000 + int.Parse(m.Groups[1].Value)),
            (@"^MX(\d{2})\d{4,}$", m => 2000 + int.Parse(m.Groups[1].Value)),
            (@"^ICS?(\d{2})\d{4,}$", m => 2000 + int.Parse(m.Groups[1].Value)),
            (@"^JD(\d{2})\d{4,}$", m => 2000 + int.Parse(m.Groups[1].Value)),
            (@"^(?:MZ|DZ|CZ|Z)(\d)\d{4,}$", m => 2000 + int.Parse(m.Groups[1].Value)),
            (@"^(?:MN|N)(\d)\d{4,}$", m => 1990 + int.Parse(m.Groups[1].Value)),
            (@"^E(\d)\d{4,}$", m => 1980 + int.Parse(m.Groups[1].Value)),
        };

        foreach (var (pattern, year) in rules)
        {
            var m = Regex.Match(serial, pattern);
            if (m.Success) return year(m);
        }

        return null;
    }

    private static bool Valid(int year) => year >= MinYear && year <= MaxYear;

    private static string? HtmlToText(string? html)
    {
        if (string.IsNullOrWhiteSpace(html)) return null;
        var text = Regex.Replace(html, @"<\s*(br|/p|/li|/div|/h\d)\s*/?>", "\n", RegexOptions.IgnoreCase);
        text = Regex.Replace(text, "<[^>]+>", " ");
        return WebUtility.HtmlDecode(text);
    }
}
