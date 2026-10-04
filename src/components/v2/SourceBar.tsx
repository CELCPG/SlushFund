import { getDatasetStatuses, type DatasetKey } from '@/lib/v2/datasets';
import { SourceBarView } from '@/components/v2/SourceBarView';

export { SourceBarView, worstState } from '@/components/v2/SourceBarView';

/**
 * Source bar: sits directly under every H1 (ia-audit §5.4).
 * "Source · Coverage · Updated · Methodology", read from the database.
 *
 * States: fresh (neutral) · stale (amber, "Not updated since …") ·
 * unavailable (red, no numbers) · not loaded (neutral, says so).
 */
export default async function SourceBar({
  datasets,
  methodologyHref,
  className,
}: {
  datasets: DatasetKey[];
  methodologyHref?: string;
  className?: string;
}) {
  const statuses = await getDatasetStatuses(datasets);
  return <SourceBarView statuses={statuses} methodologyHref={methodologyHref} className={className} />;
}
