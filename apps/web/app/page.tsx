import { redirect } from 'next/navigation';

export default function HomePage() {
  // The panel entry point; the /tracks layout guard bounces to /login if needed.
  redirect('/tracks');
}
