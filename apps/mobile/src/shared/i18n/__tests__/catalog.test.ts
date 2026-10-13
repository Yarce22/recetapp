import { catalogs } from '@/shared/i18n/catalog';

const en = catalogs.en as Record<string, string>;
const es = catalogs.es as Record<string, string>;

/** The `{name}` placeholders a message uses, sorted so order does not matter. */
function placeholders(message: string): string[] {
  return [...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

describe('message catalogs', () => {
  it('has every English key in Spanish', () => {
    const missing = Object.keys(en).filter((key) => !(key in es));

    expect(missing).toEqual([]);
  });

  it('has no Spanish key that English lacks', () => {
    const extra = Object.keys(es).filter((key) => !(key in en));

    expect(extra).toEqual([]);
  });

  it('has no blank messages', () => {
    for (const [language, catalog] of Object.entries({ en, es })) {
      const blank = Object.entries(catalog)
        .filter(([, message]) => message.trim() === '')
        .map(([key]) => key);

      expect({ language, blank }).toEqual({ language, blank: [] });
    }
  });

  it('uses the same placeholders in both languages for every key', () => {
    const mismatched = Object.keys(en)
      .filter((key) => key in es)
      .filter((key) => placeholders(en[key]).join() !== placeholders(es[key]).join());

    expect(mismatched).toEqual([]);
  });

  it('defines both plural forms wherever it defines one', () => {
    for (const catalog of [en, es]) {
      const keys = Object.keys(catalog);
      const bases = new Set(
        keys
          .filter((key) => /_(one|other)$/.test(key))
          .map((key) => key.replace(/_(one|other)$/, '')),
      );

      for (const base of bases) {
        expect(keys).toContain(`${base}_one`);
        expect(keys).toContain(`${base}_other`);
      }
    }
  });
});
