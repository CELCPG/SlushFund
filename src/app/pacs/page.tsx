import { redirect } from 'next/navigation';

// /pacs is now a tab inside the unified Influence hub.
export default function PacsRedirect() {
  redirect('/influence?tab=pacs');
}
