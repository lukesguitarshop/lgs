using System.Net;
using System.Text.RegularExpressions;

namespace GuitarDb.API.Services;

/// <summary>
/// Finds headstock and neck repairs mentioned in a listing's title or description, so the
/// deal finders can flag them - a repaired headstock sells well under the sold median.
/// Mentions that are negated ("no headstock repairs", "never broken") don't count.
/// </summary>
public static class RepairDetector
{
    private const string Damage = @"(repair(s|ed)?|break(s)?|broke(n)?|crack(s|ed)?|re-?glued|glued|snapp?(ed)?)";
    private const string Part = @"(head\s?stock|neck|hs)";

    /// <summary>"headstock repair", "headstock was broken", "neck has been repaired", "HS break".</summary>
    private static readonly Regex PartThenDamage = new(
        $@"\b{Part}\b(\s+(\w+|-)){{0,3}}?\s+{Damage}\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    /// <summary>"repaired headstock", "broken neck", "cracked head stock".</summary>
    private static readonly Regex DamageThenPart = new(
        $@"\b{Damage}\s+(\w+\s+)?{Part}\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly Regex Negation = new(
        @"\b(no|never|not|without|zero|none|nor|free of|n't|isn't|wasn't|hasn't|hadn't|doesn't|didn't)\b|n't\b",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    /// <summary>A contrast word ends a negation: "no buzz, but the headstock was repaired".</summary>
    private static readonly Regex Contrast = new(@"\b(but|however|although|though|except)\b", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    /// <summary>
    /// Phrases that put the damage on something else - "neck pickup broken", "headstock tuner
    /// cracked" - or describe construction ("glued-in neck").
    /// </summary>
    private static readonly Regex NotDamage = new(
        @"\b(pickups?|humbucker|coil|position|tuners?|nut|switch|jack|knob|pot|volume|tone|bolt|glued[- ]in|neck[- ]through|set[- ]neck|decal|logo|finish)\b",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private const int NegationWindow = 50;

    /// <summary>
    /// The sentence that mentions a headstock or neck repair (trimmed for display), or null when
    /// there's none. Title first, then the description (HTML is fine).
    /// </summary>
    public static string? Find(string? title, string? description)
    {
        foreach (var text in new[] { title, HtmlToText(description) })
        {
            if (string.IsNullOrWhiteSpace(text)) continue;

            foreach (var sentence in Regex.Split(text, @"(?<=[.!?])\s+|\n+"))
            {
                if (MentionsRepair(sentence)) return Trim(sentence.Trim());
            }
        }

        return null;
    }

    private static bool MentionsRepair(string sentence)
    {
        foreach (var regex in new[] { PartThenDamage, DamageThenPart })
        {
            foreach (Match match in regex.Matches(sentence))
            {
                // "glued neck" describes construction, not damage ("re-glued neck" still counts)
                if (regex == DamageThenPart && Regex.IsMatch(match.Value, @"^glued\b", RegexOptions.IgnoreCase))
                    continue;
                if (NotDamage.IsMatch(match.Value)) continue;

                var before = sentence[..match.Index];
                var contrast = Contrast.Matches(before).LastOrDefault();
                if (contrast != null) before = before[(contrast.Index + contrast.Length)..];
                if (before.Length > NegationWindow) before = before[^NegationWindow..];

                // The match itself can hold the negation: "headstock has never been broken"
                if (!Negation.IsMatch(before) && !Negation.IsMatch(match.Value)) return true;
            }
        }

        return false;
    }

    private static string? HtmlToText(string? html)
    {
        if (string.IsNullOrWhiteSpace(html)) return null;
        var text = Regex.Replace(html, @"<\s*(br|/p|/li|/div|/h\d)\s*/?>", "\n", RegexOptions.IgnoreCase);
        text = Regex.Replace(text, "<[^>]+>", " ");
        return WebUtility.HtmlDecode(text);
    }

    private static string Trim(string sentence) =>
        sentence.Length <= 160 ? sentence : sentence[..157].TrimEnd() + "...";
}
