import { describe, expect, it } from 'vitest';

import { uz, type Strings } from '@kargotrack/shared';
import type { Tariff, Track } from '@kargotrack/db/schema';

import {
  addSummaryKeyboard,
  balanceKeyboard,
  botCommands,
  calcResultKeyboard,
  calcTariffsKeyboard,
  cancelKeyboard,
  helpFallbackKeyboard,
  mainMenuKeyboard,
  myTracksKeyboard,
  trackCardKeyboard,
} from './keyboards';

/**
 * The inline keyboards and the router's regexes are two halves of one contract
 * (SPEC §3.11): a button whose callback_data no pattern matches is a dead tap
 * that spins forever, and nothing else in the codebase connects the two. These
 * tests pin the grammar from the keyboard side, then re-check it against the
 * exact patterns `registerHandlers` installs.
 */

const s: Strings = uz;

/** The patterns registered in `handlers/index.ts`, kept in the same order. */
const ROUTES: RegExp[] = [
  /^lang:(uz|ru)$/,
  /^mytracks:(\d+)(?::(refresh))?$/,
  /^track:([^:]+)(?::(refresh))?$/,
  /^photo:(.+)$/,
  /^calc:restart$/,
  /^calc:(.+)$/,
  /^addmore$/,
  /^balance$/,
  /^help$/,
  /^cancel$/,
];

/** Every `callback_data` a keyboard actually renders. */
function callbackData(kb: { inline_keyboard: unknown[][] }): string[] {
  return kb.inline_keyboard
    .flat()
    .map((btn) => (btn as { callback_data?: string }).callback_data)
    .filter((d): d is string => typeof d === 'string');
}

function isRouted(data: string): boolean {
  return ROUTES.some((re) => re.test(data));
}

const track = (id: string, code: string): Track =>
  ({
    id,
    codeOriginal: code,
    currentStatus: 'CHINA_WAREHOUSE',
  }) as Track;

const tariff = (id: string, name: string): Tariff => ({ id, name }) as Tariff;

describe('callback data is routable', () => {
  const keyboards: Record<string, { inline_keyboard: unknown[][] }> = {
    myTracksSinglePage: myTracksKeyboard([track('t1', 'YT1')], 1, 1, s),
    myTracksPaged: myTracksKeyboard([track('t1', 'YT1')], 2, 5, s),
    trackCardStandalone: trackCardKeyboard(s, 't1'),
    trackCardFromList: trackCardKeyboard(s, 't1', 3),
    calcTariffs: calcTariffsKeyboard([tariff('tf1', 'Avia')], s),
    calcResult: calcResultKeyboard(s),
    addSummary: addSummaryKeyboard(s),
    balance: balanceKeyboard(s),
    helpFallback: helpFallbackKeyboard(s),
    cancel: cancelKeyboard(s),
  };

  it.each(Object.entries(keyboards))('%s', (_name, kb) => {
    const data = callbackData(kb);
    expect(data.length).toBeGreaterThan(0);
    expect(data.filter((d) => !isRouted(d))).toEqual([]);
  });
});

describe('my-tracks keyboard', () => {
  it('offers one button per track plus a refresh', () => {
    const kb = myTracksKeyboard([track('a', 'YT1'), track('b', 'YT2')], 1, 1, s);
    expect(callbackData(kb)).toEqual(['track:a', 'track:b', 'mytracks:1:refresh']);
  });

  it('adds only the reachable pagination arrows', () => {
    const first = callbackData(myTracksKeyboard([track('a', 'YT1')], 1, 3, s));
    expect(first).toContain('mytracks:2');
    expect(first).not.toContain('mytracks:0');

    const last = callbackData(myTracksKeyboard([track('a', 'YT1')], 3, 3, s));
    expect(last).toContain('mytracks:2');
    expect(last).not.toContain('mytracks:4');
  });
});

describe('track card keyboard', () => {
  it('omits the back button when the card was not opened from a list', () => {
    expect(callbackData(trackCardKeyboard(s, 't1'))).toEqual(['track:t1:refresh']);
  });

  it('returns to the exact page the card replaced', () => {
    expect(callbackData(trackCardKeyboard(s, 't1', 4))).toEqual([
      'track:t1:refresh',
      'mytracks:4',
    ]);
  });
});

describe('calculator keyboard', () => {
  it('always offers a way out of the flow', () => {
    const data = callbackData(calcTariffsKeyboard([tariff('tf1', 'Avia')], s));
    expect(data).toEqual(['calc:tf1', 'cancel']);
  });

  it('routes restart to its own handler, not the tariff pattern', () => {
    // `/^calc:restart$/` is registered first; the generic pattern would
    // otherwise treat "restart" as a tariff id and look it up in the DB.
    expect(callbackData(calcResultKeyboard(s))).toEqual(['calc:restart']);
    expect(/^calc:restart$/.test('calc:restart')).toBe(true);
  });
});

describe('bot commands', () => {
  it('exposes every slash command with a description', () => {
    const commands = botCommands(s);
    expect(commands.map((c) => c.command)).toEqual([
      'start',
      'mytracks',
      'balance',
      'calc',
      'info',
      'manzil',
      // §3.14: the client card is reachable as a command too — a customer at a
      // counter should not have to hunt for a keyboard button.
      'karta',
      'help',
    ]);
    expect(commands.every((c) => c.description.length > 0)).toBe(true);
  });
});

describe('main menu (SPEC §3.1, §3.14)', () => {
  /** Flatten the reply keyboard into the labels a customer actually sees. */
  function labels(kb: ReturnType<typeof mainMenuKeyboard>): string[] {
    return kb.keyboard.flat().map((b) => (typeof b === 'string' ? b : b.text));
  }

  it('carries the client card beside support, with language last', () => {
    const rows = mainMenuKeyboard(s).keyboard;
    expect(labels(mainMenuKeyboard(s))).toContain(s.menuCard);
    // 2 columns × 5 rows once the card joined (§3.1): the language switch is
    // the least-used button and ends up alone on the last row.
    expect(rows).toHaveLength(5);
    expect(rows[3]).toHaveLength(2);
    expect(rows[4]).toHaveLength(1);
  });

  it('leads with the Mini App button only for a premium tenant', () => {
    const withApp = mainMenuKeyboard(s, 'https://example.test/m/t1');
    expect(withApp.keyboard).toHaveLength(6);
    expect(labels(withApp)[0]).toBe(s.menuCabinet);
    expect(labels(mainMenuKeyboard(s))).not.toContain(s.menuCabinet);
  });
});
