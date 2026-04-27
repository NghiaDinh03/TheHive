import { redirect } from 'next/navigation';

export default function Home() {
  // Phase 1: redirect root to login. Phase 2 will gate via session.
  redirect('/login');
}
