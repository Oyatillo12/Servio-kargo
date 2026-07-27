/**
 * Validation for the public demo-request form on the landing page.
 *
 * Deliberately permissive on phone format: a lead typing `90 123-45-67`
 * without a country code is still a lead — the owner dials it by hand, so we
 * validate digit count and store the input as typed (trimmed). This is NOT the
 * customer-matching normalization from `@kargotrack/shared` (SPEC §7.12),
 * which reduces numbers to a bare matching key.
 *
 * Kept free of server-only imports so it unit-tests without a server shim.
 */

import { z } from 'zod';

/** Minimum ms between render and submit — humans read before they send. */
export const MIN_FILL_TIME_MS = 3_000;

const digitCount = (value: string) => value.replace(/\D/g, '').length;

export const leadSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z
    .string()
    .trim()
    .max(32)
    .refine((v) => {
      const n = digitCount(v);
      return n >= 7 && n <= 15;
    }),
  company: z
    .string()
    .trim()
    .max(120)
    .transform((v) => (v === '' ? null : v)),
  locale: z.enum(['uz', 'ru']).catch('uz'),
  /**
   * Honeypot: a visually hidden field named like a real one. Humans leave it
   * empty; bulk bots fill everything.
   */
  website: z.literal(''),
  /** Epoch ms stamped into the form markup when the page was built/served. */
  startedAt: z.coerce.number().int().positive(),
});

export type LeadInput = z.infer<typeof leadSchema>;
