// Buttondown newsletter integration.
// Isolated here so the email service provider can be swapped with a small change.
// No-ops gracefully when BUTTONDOWN_API_KEY is not configured.

const BUTTONDOWN_API = 'https://api.buttondown.com/v1/subscribers';

export interface ButtondownResult {
  ok: boolean;
  /** true when the email was already on the list — treated as success. */
  alreadySubscribed?: boolean;
  /** true when no API key is configured (integration skipped). */
  skipped?: boolean;
  error?: string;
}

/**
 * Add a subscriber to Buttondown. Buttondown handles the confirmation
 * (double opt-in) email, unsubscribe links, and the public archive.
 */
export async function subscribeToButtondown(
  email: string,
  opts: { source?: string; tags?: string[] } = {},
): Promise<ButtondownResult> {
  const apiKey = process.env.BUTTONDOWN_API_KEY;
  if (!apiKey) return { ok: true, skipped: true };

  try {
    const res = await fetch(BUTTONDOWN_API, {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email_address: email,
        tags: opts.tags,
        referrer_url: opts.source,
      }),
    });

    if (res.ok) return { ok: true };

    // Buttondown returns 400 with a "already subscribed" style detail when the
    // address exists — that's a success from the visitor's point of view.
    const detail = await res.text();
    if (res.status === 400 && /already|exists|subscribed/i.test(detail)) {
      return { ok: true, alreadySubscribed: true };
    }
    return { ok: false, error: `Buttondown ${res.status}: ${detail.slice(0, 200)}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Buttondown request failed' };
  }
}
