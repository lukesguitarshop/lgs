import { redirect } from 'next/navigation';

/** The params the inventory understands; anything else in an old link is dropped. */
const CARRIED_PARAMS = ['q', 'conditions', 'minPrice', 'maxPrice', 'sort', 'page'] as const;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

/**
 * Filtering now happens in a bottom sheet over the inventory (handoff `1g`), so this
 * route only forwards. It stays a valid route because older links and indexed URLs
 * still point here: the same filter params ride along, and the hash lands the visitor
 * on the grid they were filtering.
 */
export default async function FilterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = new URLSearchParams();
  for (const key of CARRIED_PARAMS) {
    const value = first(params[key]);
    if (value) next.set(key, value);
  }
  const query = next.toString();
  redirect(`/${query ? `?${query}` : ''}#inventory`);
}
