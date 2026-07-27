import { parse } from '@formatjs/icu-messageformat-parser';
import { describe, expect, it } from 'vitest';

import ru from './ru.json';
import uz from './uz.json';

/**
 * Guards the admin-panel catalogues (AUDIT.md T17, CLAUDE.md "Definition of
 * Done": every user-facing string exists in BOTH uz and ru).
 *
 * A missing key does not crash next-intl — `getMessageFallback` renders the key
 * path instead — so without this test a half-translated screen ships looking
 * like `settings.tariffDefaultLocked` and nobody notices until a customer does.
 */

type Tree = { [key: string]: string | Tree };

const LOCALES = { uz: uz as Tree, ru: ru as Tree };

/** Flatten to `namespace.key` → message. */
function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.set(path, value);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

/** Every `{name}` argument an ICU message expects, ignoring literal text. */
function argumentsOf(message: string): Set<string> {
  const found = new Set<string>();
  const walk = (nodes: ReturnType<typeof parse>) => {
    for (const node of nodes) {
      // 1 = argument, 6 = plural, 5 = select — all carry a `value` (the name).
      if ('value' in node && typeof node.value === 'string' && node.type !== 0) {
        found.add(node.value);
      }
      if ('options' in node && node.options) {
        for (const option of Object.values(node.options)) walk(option.value);
      }
    }
  };
  walk(parse(message));
  return found;
}

// Typed explicitly rather than via `Object.fromEntries`, which widens the key
// type to `string` and makes every lookup below possibly-undefined.
const flat: Record<'uz' | 'ru', Map<string, string>> = {
  uz: flatten(LOCALES.uz),
  ru: flatten(LOCALES.ru),
};

describe('message catalogues', () => {
  it('define the same keys in every locale', () => {
    const uzKeys = [...flat.uz.keys()].sort();
    const ruKeys = [...flat.ru.keys()].sort();

    expect(ruKeys.filter((k) => !flat.uz.has(k))).toEqual([]);
    expect(uzKeys.filter((k) => !flat.ru.has(k))).toEqual([]);
  });

  it.each(['uz', 'ru'] as const)('parses every %s message as ICU', (locale) => {
    const broken: string[] = [];
    for (const [key, message] of flat[locale]) {
      try {
        parse(message);
      } catch (err) {
        broken.push(`${key}: ${(err as Error).message}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it('uses the same placeholders in every locale', () => {
    // A translation that drops `{count}` silently renders a sentence with a
    // hole in it; one that invents `{total}` throws at render time instead.
    const mismatched: string[] = [];
    for (const [key, uzMessage] of flat.uz) {
      const ruMessage = flat.ru.get(key);
      if (ruMessage === undefined) continue;
      const a = [...argumentsOf(uzMessage)].sort();
      const b = [...argumentsOf(ruMessage)].sort();
      if (a.join(',') !== b.join(',')) {
        mismatched.push(`${key}: uz(${a}) vs ru(${b})`);
      }
    }
    expect(mismatched).toEqual([]);
  });

  it('has no blank messages', () => {
    for (const [locale, messages] of Object.entries(flat)) {
      const blank = [...messages].filter(([, v]) => v.trim() === '');
      expect(blank, `${locale} has blank messages`).toEqual([]);
    }
  });
});
