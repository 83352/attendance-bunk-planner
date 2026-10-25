import { redirect } from 'next/navigation';

// The site has one real page: the portal-sync feature.
export default function Home() {
  redirect('/portal-sync');
}
