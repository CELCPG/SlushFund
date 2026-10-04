'use client';

import { useEffect } from 'react';
import { trackEvent } from '@/components/Plausible';

/**
 * Fire a Plausible event once on mount. Renders nothing.
 * Use for page-level events: 'entity_page_view', 'dashboard_filter', etc.
 */
export default function TrackPageView({
  event,
  data,
}: {
  event: string;
  data?: Record<string, string | number | boolean>;
}) {
  useEffect(() => {
    trackEvent(event, data);
  }, [event]); // data is intentionally not in deps — capture once
  return null;
}
