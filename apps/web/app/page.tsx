import { APP_NAME } from '@kargotrack/shared';

export default function HomePage() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>{APP_NAME}</h1>
      <p>Admin panel skeleton. Features come next.</p>
    </main>
  );
}
