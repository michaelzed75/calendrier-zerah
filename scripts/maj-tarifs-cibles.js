// @ts-check
/**
 * MAJ ciblée tarifs_reference : aligner les écarts arrondi + clients spécifiques sur PL
 *
 * Correctif : "Mission du social" est un forfait FIXE, pas variable.
 * Le script précédent (maj-tarifs-reference.js) le classait en variable → skippé.
 *
 * Usage : node scripts/maj-tarifs-cibles.js
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const API_BASE = 'https://app.pennylane.com/api/external/v2';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// ─── PL API helpers ──────────────────────────────────────────
async function plFetch(apiKey, endpoint, params = {}) {
  const url = new URL(`${API_BASE}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => { if (v != null) url.searchParams.append(k, String(v)); });
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(url.toString(), { headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' } });
    if (res.status === 429) { await new Promise(r => setTimeout(r, attempt * 3000)); continue; }
    if (!res.ok) throw new Error(`PL ${res.status}: ${await res.text()}`);
    return res.json();
  }
  throw new Error('Rate limit PL dépassé');
}
async function plGetAll(apiKey, endpoint) {
  let all = [], cursor = null;
  while (true) {
    const params = { per_page: 100 };
    if (cursor) params.cursor = cursor;
    const res = await plFetch(apiKey, endpoint, params);
    all = all.concat(res.items || []);
    if (res.has_more === false || !res.next_cursor) break;
    cursor = res.next_cursor;
  }
  return all;
}
async function plGetLines(apiKey, subId) {
  const res = await plFetch(apiKey, `/billing_subscriptions/${subId}/invoice_lines`);
  return res.items || [];
}

function normalizeLabel(label) {
  if (!label) return '';
  return label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').trim();
}
function round2(n) { return Math.round(n * 100) / 100; }

// ─── CORRIGÉ : Classification axe depuis label ──────────────
// "Mission du social" = forfait fixe mensuel (PAS variable)
// Seuls les bulletins et accessoires purs sont variables
function detectAxeFixed(label) {
  if (!label) return { axe: 'support', isVariable: false };
  const l = label.toLowerCase();
  // Variable : uniquement bulletins
  if (l.includes('bulletin')) return { axe: 'social_bulletin', isVariable: true };
  // Accessoires social variables (coffre, publi, entrée, sortie) mais PAS "mission du social"
  if ((l.includes('coffre') || l.includes('publi') || l.includes('entree') || l.includes('sortie')) && !l.includes('mission')) {
    return { axe: 'accessoires_social', isVariable: true };
  }
  // Forfait social FIXE
  if (l.includes('social') || l.includes('mission du social')) return { axe: 'social_forfait', isVariable: false };
  if (l.includes('bilan')) return { axe: 'bilan', isVariable: false };
  if (l.includes('p&l') || l.includes('p & l')) return { axe: 'pl', isVariable: false };
  if (l.includes('comptab') || l.includes('mission comptable') || l.includes('surveillance')) return { axe: 'compta_mensuelle', isVariable: false };
  if (l.includes('juridique') || l.includes('secretariat')) return { axe: 'juridique', isVariable: false };
  if (l.includes('logiciel') || l.includes('licence') || l.includes('mise a disposition') || l.includes('mise à disposition')) return { axe: 'support', isVariable: false };
  return { axe: 'support', isVariable: false };
}

// ─── Clients à mettre à jour ────────────────────────────────
// 21 écarts arrondi + 7 clients spécifiques (lignes manquantes PL juste)
const CLIENTS_A_ALIGNER = [
  // Écarts arrondi (commentés "PL est juste")
  'RC ARTOIS', 'PIT ARCUEIL INVEST', 'GD ET FILS', 'LYO CAFE', 'BBH',
  'FERIA MARAIS', 'ELLIPSE', 'SOCIETE HOTELIERE RICHEPANSE', 'A.H. CONSULTANT',
  'ERVA', 'ACF CONSEILS', 'PHM CONSULTING', 'ROUCHERAYE RESTAURATION',
  'SAS RESTAURANT LES PRINCES', 'RAUMAINE', 'BG CONSEILS', 'ROUCHERAYE BRASSERIE',
  'MAGP AUTEUIL', 'MAGD SEBASTOPOL', 'BRASSERIE BOHEME', 'BADA3',
  // Clients avec lignes manquantes (PL est juste)
  'LDM RESTAURATION', 'NTXM RESTAURATION', 'IB PARIS',
  'Y.L HOLDING', 'VA-PARIS', 'DELMAS INVESTISSEMENTS',
  // Écarts restants mineurs commentés OK
  'SCI 79 BELLES FEUILLES', 'CHATEAU DU BOIS', 'IMMOBILIA',
  'LE CONSULAT', 'RESIDENCE CLUB THIERS', 'LA TERRASSE MIRABEAU',
  'QO GESTION SAS', 'AMITIES VINS', 'SUNSEPT', 'DW BONNEUIL', 'DW PARAY',
  'DW CRETEIL', 'SEVENFOR2', 'KING7', 'SEVENTEASE', 'JETSEPT',
  'BK INVEST VITRY', 'MAGP AUTEUIL', 'MAGD SEBASTOPOL',
];

// ─── Main ────────────────────────────────────────────────────
async function main() {
  // 1. Charger clés API
  const { data: apiKeys } = await supabase.from('pennylane_api_keys').select('cabinet, api_key');
  const cabinets = [
    { name: 'Audit Up', apiKey: apiKeys?.find(k => k.cabinet === 'Audit Up')?.api_key },
    { name: 'Zerah Fiduciaire', apiKey: apiKeys?.find(k => k.cabinet === 'Zerah Fiduciaire')?.api_key }
  ];

  // 2. Charger clients et tarifs existants
  const { data: clients } = await supabase.from('clients').select('id, nom, siren, cabinet, actif, pennylane_customer_id').eq('actif', true);
  const { data: tarifsRef } = await supabase.from('tarifs_reference').select('*').eq('date_effet', '2026-01-01');

  // Index clients
  const clientsByExactSiren = new Map();
  const clientsBySiren9 = new Map();
  for (const c of clients) {
    if (!c.siren) continue;
    const s = c.siren.replace(/\s/g, '');
    if (!clientsByExactSiren.has(s)) clientsByExactSiren.set(s, []);
    clientsByExactSiren.get(s).push(c);
    const s9 = s.slice(0, 9);
    if (!clientsBySiren9.has(s9)) clientsBySiren9.set(s9, []);
    clientsBySiren9.get(s9).push(c);
  }

  function matchClient(customer, cabName) {
    const regNo = (customer.reg_no || '').replace(/\s/g, '').trim();
    if (!regNo || !/^\d{9}(\d{5})?$/.test(regNo)) {
      if (customer.external_reference) return clients.find(c => c.pennylane_customer_id === customer.external_reference) || null;
      return null;
    }
    // SIRET exact (14 digits)
    if (regNo.length === 14) {
      const exact = clientsByExactSiren.get(regNo) || [];
      if (exact.length === 1) return exact[0];
      if (exact.length > 1) {
        const m = exact.find(c => c.cabinet === cabName);
        if (m) return m;
      }
    }
    // SIREN (9 digits)
    const s9 = regNo.slice(0, 9);
    const candidates = clientsBySiren9.get(s9) || [];
    if (candidates.length === 1) return candidates[0];
    if (candidates.length > 1) {
      const m = candidates.find(c => c.cabinet === cabName);
      if (m) return m;
      if (customer.external_reference) {
        const m2 = candidates.find(c => c.pennylane_customer_id === customer.external_reference);
        if (m2) return m2;
      }
    }
    if (customer.external_reference) return clients.find(c => c.pennylane_customer_id === customer.external_reference) || null;
    return null;
  }

  // Unique set of client names to process
  const clientSet = new Set(CLIENTS_A_ALIGNER);

  // Index tarifs par client_id + normalized label
  const tarifIndex = new Map();
  for (const t of tarifsRef) {
    if (t.type_recurrence === 'variable') continue; // Skip variables
    const key = `${t.client_id}::${normalizeLabel(t.label)}`;
    tarifIndex.set(key, t);
  }

  let updated = 0, inserted = 0, unchanged = 0, errors = 0;
  const details = [];

  // 3. Pour chaque cabinet, récupérer PL et traiter
  for (const cab of cabinets) {
    console.log(`\nRécupération Pennylane — ${cab.name}...`);
    const customers = await plGetAll(cab.apiKey, '/customers');
    const subscriptions = await plGetAll(cab.apiKey, '/billing_subscriptions');
    const activeSubs = subscriptions.filter(s => s.status === 'in_progress' || s.status === 'not_started');

    const subsByCust = new Map();
    for (const sub of activeSubs) {
      const custId = sub.customer?.id;
      if (!custId) continue;
      if (!subsByCust.has(custId)) subsByCust.set(custId, []);
      subsByCust.get(custId).push(sub);
    }

    for (const customer of customers) {
      const subs = subsByCust.get(customer.id);
      if (!subs?.length) continue;

      const client = matchClient(customer, cab.name);
      if (!client) continue;
      if (!clientSet.has(client.nom)) continue;

      console.log(`\n  >>> ${client.nom} (${cab.name})`);

      // Récupérer toutes les lignes PL
      const plLines = [];
      for (const sub of subs) {
        await new Promise(r => setTimeout(r, 200));
        const lines = await plGetLines(cab.apiKey, sub.id);
        for (const line of lines) {
          const { axe, isVariable } = detectAxeFixed(line.label);
          plLines.push({
            label: line.label,
            quantite: parseFloat(line.quantity) || 1,
            montant_ht: parseFloat(line.currency_amount_before_tax) || 0,
            pu_ht: (parseFloat(line.currency_amount_before_tax) || 0) / (parseFloat(line.quantity) || 1),
            subLabel: sub.label,
            frequence: sub.recurring_rule?.rule_type || 'monthly',
            intervalle: sub.recurring_rule?.interval || 1,
            axe,
            isVariable
          });
        }
      }

      // Pour chaque ligne PL fixe
      for (const pl of plLines) {
        if (pl.isVariable) {
          console.log(`    [SKIP variable] ${pl.label}: ${pl.montant_ht.toFixed(2)} €`);
          continue;
        }

        const key = `${client.id}::${normalizeLabel(pl.label)}`;
        const existing = tarifIndex.get(key);

        if (existing) {
          // Comparer et update si différent
          const existingHT = round2(existing.pu_ht * existing.quantite);
          const plHT = round2(pl.montant_ht);
          if (Math.abs(existingHT - plHT) >= 0.01 || existing.quantite !== pl.quantite) {
            const { error } = await supabase.from('tarifs_reference').update({
              pu_ht: round2(pl.pu_ht),
              quantite: pl.quantite,
              frequence: pl.frequence,
              intervalle: pl.intervalle,
              axe: pl.axe,
              source: 'alignement_pl_2026_v2',
              updated_at: new Date().toISOString()
            }).eq('id', existing.id);
            if (error) { console.log(`    ❌ UPDATE ${pl.label}: ${error.message}`); errors++; }
            else {
              console.log(`    ✏️  ${pl.label}: ${existingHT} → ${plHT} € (Δ ${(plHT - existingHT).toFixed(2)})`);
              details.push({ client: client.nom, action: 'UPDATE', label: pl.label, avant: existingHT, apres: plHT });
              updated++;
            }
          } else {
            unchanged++;
          }
        } else {
          // Ligne PL absente en BDD → insert
          const { error } = await supabase.from('tarifs_reference').upsert({
            client_id: client.id,
            label: pl.label,
            axe: pl.axe,
            type_recurrence: 'fixe',
            pu_ht: round2(pl.pu_ht),
            quantite: pl.quantite,
            frequence: pl.frequence,
            intervalle: pl.intervalle,
            tva_rate: 0.20,
            cabinet: client.cabinet,
            date_effet: '2026-01-01',
            source: 'alignement_pl_2026_v2',
            updated_at: new Date().toISOString()
          }, { onConflict: 'client_id,label,date_effet' });
          if (error) { console.log(`    ❌ INSERT ${pl.label}: ${error.message}`); errors++; }
          else {
            console.log(`    ➕ ${pl.label}: ${pl.montant_ht.toFixed(2)} € (${pl.frequence})`);
            details.push({ client: client.nom, action: 'INSERT', label: pl.label, avant: 0, apres: pl.montant_ht });
            inserted++;
          }
        }
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  MAJ ciblée tarifs_reference terminée`);
  console.log(`  Updated: ${updated} | Inserted: ${inserted} | Unchanged: ${unchanged}`);
  console.log(`  Errors: ${errors}`);
  console.log(`${'='.repeat(60)}`);

  if (details.length > 0) {
    console.log('\nDétail des modifications :');
    for (const d of details) {
      console.log(`  ${d.action.padEnd(6)} | ${d.client.padEnd(30)} | ${d.label.padEnd(40)} | ${d.avant} → ${d.apres}`);
    }
  }
}

main().catch(err => { console.error('ERREUR:', err.message); process.exit(1); });
