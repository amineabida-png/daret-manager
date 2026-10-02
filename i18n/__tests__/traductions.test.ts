import { afterEach, describe, expect, test } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { ar } from '../ar';
import { definirLangue, t, tn } from '../index';
import { formatDH, parseDH } from '../../utils/montant';
import { formatDateCourte, formatDateLongue, nomJourSemaine } from '../../utils/dates';
import { modeleWhatsAppDefaut } from '../../utils/partage';

const RACINE = path.resolve(__dirname, '../..');

/** Tous les textes passés littéralement à t() / tn() dans le code de l'application. */
function clesDuCode(): Set<string> {
  const fichiers: string[] = [];
  (function parcourir(d: string) {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, f.name);
      if (f.isDirectory()) {
        if (!['node_modules', 'android', '__tests__', '.expo', 'i18n', '.git'].includes(f.name)) parcourir(p);
      } else if (/\.tsx?$/.test(f.name)) fichiers.push(p);
    }
  })(RACINE);
  const lit = String.raw`'((?:[^'\\]|\\.)*)'`;
  const reT = new RegExp(String.raw`\bt\(\s*` + lit, 'g');
  const reTn = new RegExp(String.raw`\btn\([^,]+,\s*` + lit + String.raw`\s*,\s*` + lit, 'g');
  const dec = (s: string) => s.replace(/\\'/g, '\'').replace(/\\n/g, '\n');
  const cles = new Set<string>();
  for (const f of fichiers) {
    const s = fs.readFileSync(f, 'utf8');
    for (const m of s.matchAll(reT)) cles.add(dec(m[1]));
    for (const m of s.matchAll(reTn)) { cles.add(dec(m[1])); cles.add(dec(m[2])); }
  }
  return cles;
}

const variables = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();

afterEach(() => definirLangue('fr'));

describe('traduction darija', () => {
  test('chaque texte de l\'interface a sa traduction', () => {
    const cles = clesDuCode();
    expect(cles.size).toBeGreaterThan(250);
    const manquantes = [...cles].filter(c => !(c in ar));
    expect(manquantes).toEqual([]);
  });

  test('les traductions gardent les mêmes variables', () => {
    const differentes = Object.entries(ar).filter(([fr, a]) => JSON.stringify([...new Set(variables(fr))]) !== JSON.stringify([...new Set(variables(a))]));
    expect(differentes).toEqual([]);
  });

  test('t() traduit, remplace les variables et garde le français par défaut', () => {
    expect(t('Tour {n}', { n: 3 })).toBe('Tour 3');
    definirLangue('ar');
    expect(t('Tour {n}', { n: 3 })).toBe('النوبة 3');
    expect(tn(2, '{n} part', '{n} parts')).toBe('2 أسهم');
    expect(t('Texte sans traduction')).toBe('Texte sans traduction');
  });

  test('montants, dates et jours en darija', () => {
    definirLangue('ar');
    expect(formatDH(150050)).toBe('1 500,50 درهم');
    expect(parseDH('1500 درهم')).toBe(150000);
    expect(parseDH('١٥٠٠')).toBe(150000);
    expect(formatDateLongue('2026-08-05')).toBe('5 غشت 2026');
    expect(formatDateCourte('2026-10-02')).toBe('الجمعة 2 أكتوبر');
    expect(nomJourSemaine(7)).toBe('الحد');
    expect(modeleWhatsAppDefaut('ar')).toContain('{nom}');
  });
});
