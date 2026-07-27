/**
 * @kargotrack/shared — business logic, types, status enums, i18n strings.
 *
 * Pure, framework-free modules shared by the bot and web apps. Nothing here
 * imports `@kargotrack/db` (that package depends on this one); DB-touching code
 * lives in the apps and passes plain data into these functions.
 */

export const APP_NAME = 'SERVIO Kargo';

// Track-code normalization (SPEC §7.1)
export {
  normalizeCode,
  isValidTrackCode,
  TRACK_CODE_MIN_LENGTH,
  TRACK_CODE_MAX_LENGTH,
} from './normalize';

// Phone normalization for customer matching (SPEC §7.12)
export { normalizePhone, samePhone, PHONE_KEY_LENGTH } from './phone';

// Status pipeline + display metadata (SPEC §2)
export {
  TRACK_STATUSES,
  PIPELINE_ORDER,
  TERMINAL_STATUSES,
  isTerminalStatus,
  STATUS_META,
  statusSortIndex,
  type TrackStatus,
} from './status';

// Display formatters (SPEC §4 / §7.9)
export {
  formatSom,
  formatKg,
  formatUsd,
  formatDate,
  formatDateTime,
} from './format';

// Pure services
export {
  priceForGrams,
  computeTrackPrice,
  type Currency,
  type TrackPriceInput,
  type TrackPrice,
} from './services/price';
export {
  resolveDefaultId,
  planCreateTariff,
  planSetDefault,
  planSetActive,
  planDelete,
  type TariffRow,
  type CreatePlan,
  type SetDefaultPlan,
  type MutationResult,
} from './services/tariffs';
export {
  BATCH_STATUSES,
  isBatchStatus,
  planBatchPropagation,
  type BatchStatus,
  type BatchMemberTrack,
  type BatchPropagationItem,
  type BatchPropagationPlan,
} from './services/batches';
export { nextClientCode, CLIENT_CODE_SEQ_BASE } from './services/clientCode';
export {
  computeDebtTiyin,
  describeDebt,
  DEBT_OWED_STATUSES,
  type DebtTrack,
  type DebtPayment,
  type DebtKind,
  type DebtSummary,
} from './services/debt';
export { parseSomToTiyin, parseUsdToCents } from './services/payment';
export { parseKgToGrams } from './services/calc';
export {
  BROADCAST_QUEUE,
  BROADCAST_MAX_CHARS,
  type BroadcastJob,
} from './services/broadcast';
export {
  REMINDER_QUEUE,
  REMINDER_SWEEP_QUEUE,
  REMINDER_SWEEP_CRON,
  REMINDER_TZ,
  weeklyReminderDedupeKey,
  tashkentSchedule,
  type ReminderJob,
  type TashkentSchedule,
} from './services/reminder';
export {
  sortForDisplay,
  paginate,
  MY_TRACKS_PAGE_SIZE,
  type SortableTrack,
  type Page,
} from './services/myTracks';
export {
  DASHBOARD_TZ,
  DASHBOARD_PERIODS,
  TUSHUM_CHART_DAYS,
  tashkentDateKey,
  periodRange,
  lastNDays,
  bucketDailyTushum,
  type DashboardPeriod,
  type PeriodRange,
  type DayBucket,
  type TushumPoint,
} from './services/dashboard';
export {
  TRACK_WORKLISTS,
  WORKLIST_META,
  PICKUP_STALE_DAYS,
  isTrackWorklist,
  stalePickupCutoff,
  worklistLabel,
  type TrackWorklist,
  type WorklistLabel,
} from './services/worklist';
export {
  parseCodeCandidates,
  classifyCandidate,
  buildAddSummary,
  emptyAddGroups,
  type CandidateVerdict,
  type ExistingTrack,
  type AddGroups,
} from './services/addTrack';
export {
  parseImportText,
  classifyImportCandidates,
  splitAgainstExisting,
  extractTrackCodesFromChannel,
  type ImportCode,
  type ImportParseResult,
  type ImportSplit,
  type ChannelExtractResult,
} from './services/import';
export {
  NOTIFY_QUEUE,
  notifyDedupeKey,
  isNotifiableStatus,
  shouldEnqueueNotification,
  type NotifyJob,
  type StatusChangeInput,
} from './services/notify';
export {
  planStatusChange,
  type StatusTransitionInput,
  type StatusTransitionPlan,
} from './services/statusChange';
export {
  planAssignCustomer,
  isAssignEventMeta,
  ASSIGN_ACTIONS,
  type AssignAction,
  type AssignCustomerInput,
  type AssignCustomerPlan,
  type AssignEventMeta,
} from './services/assignCustomer';
export {
  parseStaffWeighing,
  planStaffWeighing,
  type StaffWeighing,
  type StaffWeighingPlan,
} from './services/staff';

// Roles + panel invitations (SPEC §1 / §5.12, AUDIT.md T8)
export {
  ADMIN_ROLES,
  CAPABILITIES,
  ROLE_CAPABILITIES,
  can,
  canAll,
  canSignIn,
  canUseStaffMode,
  toAdminRole,
  type AdminRole,
  type Capability,
} from './services/permissions';
export {
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  INVITE_TTL_MS,
  MIN_PASSWORD_LENGTH,
  checkInvite,
  formatInviteCode,
  generateInviteCode,
  inviteExpiry,
  isValidPassword,
  normalizeInviteCode,
  type InviteRejection,
  type InviteState,
} from './services/invite';

// Excel export sheet shaping (AUDIT.md T2)
export {
  buildTracksSheet,
  buildCustomersSheet,
  buildPaymentsSheet,
  exportFileName,
  EXPORT_FILE_BASE,
  truncationNotice,
  somFromTiyin,
  kgFromGrams,
  EXPORT_LABELS,
  EXPORT_MAX_ROWS,
  type ExportKind,
  type ExportCell,
  type ExportSheet,
  type TrackExportRow,
  type CustomerExportRow,
  type PaymentExportRow,
} from './services/export';

// Observability — PII scrubbing for outbound error reports (AUDIT.md T5)
export { scrubText, scrubValue, REDACTED } from './observability/scrub';

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
  type CalcResultVars,
  type LookupCardVars,
  type ReadyNotifVars,
} from './i18n';
