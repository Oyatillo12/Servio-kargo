import type { Transport } from '@kargotrack/db/schema';

/**
 * Message key per transport mode (SPEC §5.7), inside the `batches` namespace.
 *
 * The mode is a DB enum, so the label has to be looked up rather than stored —
 * this is the single mapping both the list and the detail screen use.
 */
export const TRANSPORT_KEY: Record<Transport, string> = {
  avia: 'transportAvia',
  avto: 'transportAvto',
  train: 'transportTrain',
};

/** Selectable transports in SPEC §5.7 order. */
export const TRANSPORTS: readonly Transport[] = ['avia', 'avto', 'train'];
