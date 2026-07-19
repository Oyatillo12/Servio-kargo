/**
 * @kargotrack/shared — business logic, types, status enums, i18n strings.
 *
 * Pure, framework-free modules shared by the bot and web apps. Nothing here
 * imports `@kargotrack/db` (that package depends on this one); DB-touching code
 * lives in the apps and passes plain data into these functions.
 */

export const APP_NAME = 'KargoTrack';

// Track-code normalization (SPEC §7.1)
export {
  normalizeCode,
  isValidTrackCode,
  TRACK_CODE_MIN_LENGTH,
  TRACK_CODE_MAX_LENGTH,
} from './normalize';

// Status pipeline + display metadata (SPEC §2)
export {
  TRACK_STATUSES,
  PIPELINE_ORDER,
  STATUS_META,
  statusSortIndex,
  type TrackStatus,
} from './status';

// Display formatters (SPEC §4 / §7.9)
export { formatSom, formatKg, formatDate } from './format';

// Pure services
export { priceForGrams } from './services/price';
export { nextClientCode, CLIENT_CODE_SEQ_BASE } from './services/clientCode';
export {
  computeDebtTiyin,
  type DebtTrack,
  type DebtPayment,
} from './services/debt';
export {
  sortForDisplay,
  paginate,
  MY_TRACKS_PAGE_SIZE,
  type SortableTrack,
  type Page,
} from './services/myTracks';
export {
  parseCodeCandidates,
  classifyCandidate,
  buildAddSummary,
  emptyAddGroups,
  type CandidateVerdict,
  type ExistingTrack,
  type AddGroups,
} from './services/addTrack';

// i18n (SPEC §4)
export {
  t,
  uz,
  ru,
  statusNotification,
  LANG_BUTTON_UZ,
  LANG_BUTTON_RU,
  type Lang,
  type Strings,
  type ReadyDetail,
  type InfoCardVars,
  type LookupCardVars,
  type ReadyNotifVars,
} from './i18n';
