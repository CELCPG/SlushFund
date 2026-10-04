import { redirect } from 'next/navigation';

// /crypto is now a tab inside the unified Influence hub.
export default function CryptoRedirect() {
  redirect('/influence?tab=crypto');
}
