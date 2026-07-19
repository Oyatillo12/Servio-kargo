/**
 * @kargotrack/shared — business logic, types, status enums, i18n strings.
 *
 * Skeleton only: exports a single constant to prove the workspace wiring.
 * Feature code (services, status pipeline, i18n) is added in later tasks.
 */

export const APP_NAME = 'KargoTrack';

export {
  normalizeCode,
  isValidTrackCode,
  TRACK_CODE_MIN_LENGTH,
  TRACK_CODE_MAX_LENGTH,
} from './normalize';
