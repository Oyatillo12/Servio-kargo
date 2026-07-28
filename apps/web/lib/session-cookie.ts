/**
 * The session cookie's name, alone in its own module.
 *
 * `middleware.ts` runs on the edge runtime and needs this constant, but
 * `lib/session.ts` imports `node:crypto` at module scope — pulling it into the
 * middleware bundle fails the build. So the name lives here; `lib/session.ts`
 * re-exports it, which keeps every existing `from './session'` import working.
 */

export const COOKIE_NAME = 'kt_session';
