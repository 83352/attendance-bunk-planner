import { redirect } from 'next/navigation';

// This branch only has one real page right now — the portal-sync feature.
export default function Home() {
  redirect('/portal-sync');
}
