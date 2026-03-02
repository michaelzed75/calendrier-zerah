// @ts-check
/**
 * Analyse croisée : Janvier 2026 vs Février 2026 vs tarifs_reference
 *
 * Février = référence réelle (nouveaux abos 2026, vérifié ISO)
 * tarifs_reference = référence BDD
 * Janvier = à corriger
 *
 * Social au réel mis de côté (comparé séparément sur les PU)
 *
 * Excel 4 onglets :
 *   1) Résumé par client — Jan vs Fév vs Tarifs, statut
 *   2) Corrections à faire sur Janvier (actionnable)
 *   3) Écarts social au réel (PU Jan vs PU Fév vs PU tarif)
 *   4) Clients à investiguer (absents d'un côté ou l'autre)
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const { data: apiKeys } = await supabase.from('pennylane_api_keys').select('cabinet, api_key');

function round2(n) { return Math.round(n * 100) / 100; }
function normalizeLabel(label) {
  if (!label) return '';
  return label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\{\{.*?\}\}/g, '')
    .replace(/(janvier|fevrier|février|mars|jan|fev|feb)\s*2?6?/gi, '')
    .replace(/\d{2}\/\d{2}\/\d{4}/g, '')
    .replace(/[^a-z0-9]/g, '').trim();
}

async function plFetch(apiKey, endpoint, params = {}) {
  const url = new URL(`https://app.pennylane.com/api/external/v2${endpoint}`);
  Object.entries(params).forEach(([k, v]) => { if (v != null) url.searchParams.append(k, String(v)); });
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(url.toString(), { headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' } });
    if (res.status === 429) { console.log('  Rate limit, retry', attempt); await new Promise(r => setTimeout(r, attempt * 3000)); continue; }
    if (!res.ok) throw new Error(`PL ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.json();
  }
  throw new Error('Rate limit exceeded');
}

async function plGetAll(apiKey, endpoint, filterParams = {}) {
  let all = [], cursor = null;
  while (true) {
    const params = { per_page: 100, ...filterParams };
    if (cursor) params.cursor = cursor;
    const res = await plFetch(apiKey, endpoint, params);
    all = all.concat(res.items || []);
    if (res.has_more === false || !res.next_cursor) break;
    cursor = res.next_cursor;
  }
  return all;
}

// ── BDD ──
const { data: tarifsRef } = await supabase.from('tarifs_reference').select('*').eq('date_effet', '2026-01-01');
const { data: allClients } = await supabase.from('clients').select('id, nom, siren, cabinet, actif, pennylane_customer_id');

const clientsReelIds = new Set(tarifsRef.filter(t => t.type_recurrence === 'variable').map(t => t.client_id));
const tarifsByClient = new Map();
for (const t of tarifsRef) {
  if (!tarifsByClient.has(t.client_id)) tarifsByClient.set(t.client_id, []);
  tarifsByClient.get(t.client_id).push(t);
}

// Index clients
const clientsBySiren = new Map();
for (const c of allClients) {
  if (c.siren) {
    const s = c.siren.replace(/\s/g, '');
    if (!clientsBySiren.has(s)) clientsBySiren.set(s, []);
    clientsBySiren.get(s).push(c);
    if (s.length === 14) {
      const s9 = s.slice(0, 9);
      if (!clientsBySiren.has(s9)) clientsBySiren.set(s9, []);
      clientsBySiren.get(s9).push(c);
    }
  }
}

function matchClient(customer, cabName) {
  for (const c of allClients) {
    if (c.pennylane_customer_id === customer.id) return c;
  }
  const regNo = (customer.reg_no || '').replace(/\s/g, '').trim();
  if (!regNo || !/^\d{9}(\d{5})?$/.test(regNo)) return null;
  if (regNo.length === 14) {
    const exact = clientsBySiren.get(regNo) || [];
    const m = exact.length === 1 ? exact[0] : exact.find(c => c.cabinet === cabName);
    if (m) return m;
  }
  const s9 = regNo.slice(0, 9);
  const candidates = clientsBySiren.get(s9) || [];
  if (candidates.length === 1) return candidates[0];
  return candidates.find(c => c.cabinet === cabName) || null;
}

function isFF(name) {
  if (!name) return false;
  const n = name.toUpperCase();
  return n.endsWith(' FF') || n.includes('FRANCE FORMAL') || n.includes('FORMALIT');
}

const socialKeywords = ['bulletin', 'coffre', 'publi', 'entree', 'entrée', 'sortie', 'modification'];
function isSocialReelLine(label, clientId) {
  if (!clientsReelIds.has(clientId)) return false;
  const l = (label || '').toLowerCase();
  return socialKeywords.some(s => l.includes(s));
}

async function getInvoicesForMonth(apiKey, month, { draftOnly = false } = {}) {
  const start = `2026-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(2026, month, 0).getDate();
  const end = `2026-${String(month).padStart(2, '0')}-${lastDay}`;
  const filters = [
    { field: 'date', operator: 'gteq', value: start },
    { field: 'date', operator: 'lteq', value: end }
  ];
  if (draftOnly) filters.push({ field: 'draft', operator: 'eq', value: 'true' });
  return plGetAll(apiKey, '/customer_invoices', { filter: JSON.stringify(filters) });
}

async function getInvoiceLines(apiKey, invoices) {
  const lines = [];
  for (const inv of invoices) {
    await new Promise(r => setTimeout(r, 150));
    try {
      const res = await plFetch(apiKey, `/customer_invoices/${inv.id}/invoice_lines`);
      for (const line of (res.items || [])) {
        const ht = parseFloat(line.currency_amount_before_tax) || 0;
        const label = line.label || '';
        const qty = parseFloat(line.quantity) || 1;
        lines.push({ label, ht, qty, pu: round2(ht / qty), invoiceId: inv.invoice_number || inv.id });
      }
    } catch (e) {
      console.log(`    Erreur facture ${inv.id}: ${e.message}`);
    }
  }
  return lines;
}

// ── Résultats ──
const rowsResume = [];
const rowsCorrections = [];
const rowsSocialReel = [];
const rowsInvestigate = [];

for (const cab of ['Audit Up', 'Zerah Fiduciaire']) {
  const apiKey = apiKeys.find(k => k.cabinet === cab).api_key;
  console.log(`\n${cab} — Récupération factures...`);

  const invoicesJan = await getInvoicesForMonth(apiKey, 1, { draftOnly: true });
  const invoicesFev = await getInvoicesForMonth(apiKey, 2);
  console.log(`  Jan (brouillons): ${invoicesJan.length} | Fév (toutes): ${invoicesFev.length}`);

  const customers = await plGetAll(apiKey, '/customers');
  const custById = new Map(customers.map(c => [c.id, c]));

  function groupByCustomer(invoices) {
    const map = new Map();
    for (const inv of invoices) {
      const custId = inv.customer?.id || inv.third_party?.id;
      if (!custId) continue;
      if (!map.has(custId)) map.set(custId, []);
      map.get(custId).push(inv);
    }
    return map;
  }

  const janByCust = groupByCustomer(invoicesJan);
  const fevByCust = groupByCustomer(invoicesFev);
  const allCustIds = new Set([...janByCust.keys(), ...fevByCust.keys()]);

  for (const custId of allCustIds) {
    const customer = custById.get(custId);
    if (!customer) continue;
    if (isFF(customer.name)) continue;

    const client = matchClient(customer, cab);
    const clientNom = client?.nom || customer.name;
    const clientId = client?.id;
    const actif = client?.actif;

    const janInvs = janByCust.get(custId) || [];
    const fevInvs = fevByCust.get(custId) || [];
    const janLines = await getInvoiceLines(apiKey, janInvs);
    const fevLines = await getInvoiceLines(apiKey, fevInvs);

    // Séparer social au réel
    const janFix = clientId ? janLines.filter(l => !isSocialReelLine(l.label, clientId)) : janLines;
    const janSoc = clientId ? janLines.filter(l => isSocialReelLine(l.label, clientId)) : [];
    const fevFix = clientId ? fevLines.filter(l => !isSocialReelLine(l.label, clientId)) : fevLines;
    const fevSoc = clientId ? fevLines.filter(l => isSocialReelLine(l.label, clientId)) : [];

    // Tarifs fixes (pour cross-check)
    const tarifs = clientId ? (tarifsByClient.get(clientId) || []) : [];
    const tarifsFixes = tarifs.filter(t => t.type_recurrence === 'fixe');
    const tarifsVar = tarifs.filter(t => t.type_recurrence === 'variable');

    // Totaux hors social réel
    const totalJan = round2(janFix.reduce((s, l) => s + l.ht, 0));
    const totalFev = round2(fevFix.reduce((s, l) => s + l.ht, 0));
    const totalTarifs = round2(tarifsFixes.reduce((s, t) => s + t.pu_ht * t.quantite, 0));
    const ecartJanFev = round2(totalFev - totalJan);

    if (totalJan === 0 && totalFev === 0) continue;

    // ── Statut ──
    let statut;
    if (actif === false) statut = 'INACTIF';
    else if (fevInvs.length === 0 && janInvs.length > 0) statut = 'ABSENT FEV';
    else if (janInvs.length === 0 && fevInvs.length > 0) statut = 'NOUVEAU FEV';
    else if (Math.abs(ecartJanFev) < 0.01) statut = 'OK';
    else statut = 'ECART';

    // ── Onglet 1 : Résumé ──
    rowsResume.push({
      Cabinet: cab, Client: clientNom,
      Actif: actif === true ? 'Oui' : (actif === false ? 'Non' : '?'),
      'Total Jan HT (hors social reel)': totalJan,
      'Total Fev HT (hors social reel)': totalFev,
      'Tarifs ref HT (fixes)': totalTarifs || '',
      'Ecart Jan→Fev': ecartJanFev,
      'Fev = Tarifs?': totalTarifs && Math.abs(totalFev - totalTarifs) < 0.01 ? 'OUI' : (totalTarifs ? 'NON' : ''),
      Statut: statut
    });

    // ── Onglet 4 : À investiguer ──
    if (statut === 'INACTIF') {
      rowsInvestigate.push({
        Cabinet: cab, Client: clientNom, Probleme: 'Client INACTIF facturé en Janvier',
        'Total Jan HT': totalJan, 'Total Fev HT': totalFev,
        Action: 'Supprimer factures Janvier',
        Detail: janLines.map(l => `${l.label}: ${l.ht}€`).join(' | ')
      });
      continue;
    }
    if (statut === 'ABSENT FEV') {
      rowsInvestigate.push({
        Cabinet: cab, Client: clientNom, Probleme: 'Facturé en Jan mais PAS en Fév',
        'Total Jan HT': totalJan, 'Total Fev HT': 0,
        Action: 'Vérifier si client doit être facturé',
        Detail: janFix.map(l => `${l.label}: ${l.ht}€`).join(' | ')
      });
      continue;
    }
    if (statut === 'NOUVEAU FEV') {
      rowsInvestigate.push({
        Cabinet: cab, Client: clientNom, Probleme: 'Facturé en Fév mais PAS en Jan',
        'Total Jan HT': 0, 'Total Fev HT': totalFev,
        Action: 'Créer facture Janvier manquante',
        Detail: fevFix.map(l => `${l.label}: ${l.ht}€`).join(' | ')
      });
      continue;
    }

    // ── Onglet 2 : Corrections (écarts Jan vs Fév, ligne à ligne) ──
    if (Math.abs(ecartJanFev) >= 0.01) {
      const janCopy = [...janFix];

      for (const fl of fevFix) {
        const normF = normalizeLabel(fl.label);
        let idx = janCopy.findIndex(jl => normalizeLabel(jl.label) === normF);
        if (idx < 0) idx = janCopy.findIndex(jl => normalizeLabel(jl.label).includes(normF) || normF.includes(normalizeLabel(jl.label)));
        if (idx < 0) idx = janCopy.findIndex(jl => Math.abs(jl.ht - fl.ht) < 0.01);

        if (idx >= 0) {
          const jl = janCopy[idx];
          const diff = round2(fl.ht - jl.ht);
          if (Math.abs(diff) >= 0.01) {
            // Chercher le tarif correspondant pour confirmer
            const normT = normalizeLabel(fl.label);
            const tarif = tarifsFixes.find(t => normalizeLabel(t.label) === normT);
            const tarifHT = tarif ? round2(tarif.pu_ht * tarif.quantite) : '';

            rowsCorrections.push({
              Cabinet: cab, Client: clientNom,
              Produit: fl.label,
              'Jan HT': jl.ht, 'Fev HT': fl.ht,
              'Tarif ref HT': tarifHT,
              'Ecart Jan→Fev': diff,
              Action: diff > 0 ? 'Augmenter prix Jan' : 'Diminuer prix Jan',
              'Fev=Tarif?': tarifHT !== '' && Math.abs(fl.ht - tarifHT) < 0.01 ? 'OUI' : '',
              'Facture Jan': jl.invoiceId
            });
          }
          janCopy.splice(idx, 1);
        } else {
          // Ligne en Fév mais absente en Jan
          const tarif = tarifsFixes.find(t => normalizeLabel(t.label) === normalizeLabel(fl.label));
          const tarifHT = tarif ? round2(tarif.pu_ht * tarif.quantite) : '';
          rowsCorrections.push({
            Cabinet: cab, Client: clientNom,
            Produit: fl.label,
            'Jan HT': 0, 'Fev HT': fl.ht,
            'Tarif ref HT': tarifHT,
            'Ecart Jan→Fev': fl.ht,
            Action: 'Ajouter ligne à facture Jan',
            'Fev=Tarif?': tarifHT !== '' && Math.abs(fl.ht - tarifHT) < 0.01 ? 'OUI' : '',
            'Facture Jan': ''
          });
        }
      }

      // Lignes en Jan mais pas en Fév
      for (const jl of janCopy) {
        if (jl.ht < 0.50) continue; // ignorer placeholders
        rowsCorrections.push({
          Cabinet: cab, Client: clientNom,
          Produit: jl.label,
          'Jan HT': jl.ht, 'Fev HT': 0,
          'Tarif ref HT': '',
          'Ecart Jan→Fev': -jl.ht,
          Action: 'Supprimer ligne de facture Jan',
          'Fev=Tarif?': '',
          'Facture Jan': jl.invoiceId
        });
      }
    }

    // ── Onglet 3 : Social au réel (comparer PU) ──
    if (janSoc.length || fevSoc.length) {
      // Matcher par label
      const janSocCopy = [...janSoc];
      for (const fl of fevSoc) {
        const normF = normalizeLabel(fl.label);
        const idx = janSocCopy.findIndex(jl => normalizeLabel(jl.label) === normF);
        const tarif = tarifsVar.find(t => normalizeLabel(t.label) === normF);

        if (idx >= 0) {
          const jl = janSocCopy[idx];
          const diffPU = round2(fl.pu - jl.pu);
          if (Math.abs(diffPU) >= 0.01 || jl.qty !== fl.qty) {
            rowsSocialReel.push({
              Cabinet: cab, Client: clientNom,
              Produit: fl.label,
              'Qty Jan': jl.qty, 'PU Jan': jl.pu, 'HT Jan': jl.ht,
              'Qty Fev': fl.qty, 'PU Fev': fl.pu, 'HT Fev': fl.ht,
              'PU Tarif': tarif?.pu_ht || '',
              'Ecart PU Jan→Fev': diffPU,
              'Fev=Tarif?': tarif && Math.abs(fl.pu - tarif.pu_ht) < 0.01 ? 'OUI' : '',
              'Facture Jan': jl.invoiceId
            });
          }
          janSocCopy.splice(idx, 1);
        } else {
          rowsSocialReel.push({
            Cabinet: cab, Client: clientNom,
            Produit: fl.label,
            'Qty Jan': 0, 'PU Jan': '', 'HT Jan': 0,
            'Qty Fev': fl.qty, 'PU Fev': fl.pu, 'HT Fev': fl.ht,
            'PU Tarif': tarif?.pu_ht || '',
            'Ecart PU Jan→Fev': '',
            'Fev=Tarif?': tarif && Math.abs(fl.pu - tarif.pu_ht) < 0.01 ? 'OUI' : '',
            'Facture Jan': ''
          });
        }
      }
      for (const jl of janSocCopy) {
        rowsSocialReel.push({
          Cabinet: cab, Client: clientNom,
          Produit: jl.label,
          'Qty Jan': jl.qty, 'PU Jan': jl.pu, 'HT Jan': jl.ht,
          'Qty Fev': 0, 'PU Fev': '', 'HT Fev': 0,
          'PU Tarif': '',
          'Ecart PU Jan→Fev': '',
          'Fev=Tarif?': '',
          'Facture Jan': jl.invoiceId
        });
      }
    }
  }
}

// ── Stats ──
const nbOK = rowsResume.filter(r => r.Statut === 'OK').length;
const nbEcart = rowsResume.filter(r => r.Statut === 'ECART').length;
const nbInactif = rowsResume.filter(r => r.Statut === 'INACTIF').length;
const nbAbsFev = rowsResume.filter(r => r.Statut === 'ABSENT FEV').length;
const nbNouv = rowsResume.filter(r => r.Statut === 'NOUVEAU FEV').length;
const fevConfirme = rowsResume.filter(r => r['Fev = Tarifs?'] === 'OUI').length;

console.log(`\n${'='.repeat(65)}`);
console.log(`  ANALYSE CROISÉE — Jan 2026 vs Fév 2026 vs tarifs_reference`);
console.log(`  (hors social au réel)`);
console.log(`${'─'.repeat(65)}`);
console.log(`  OK (Jan = Fév)          : ${nbOK}`);
console.log(`  Écarts à corriger       : ${nbEcart}`);
console.log(`  Inactifs (supprimer Jan): ${nbInactif}`);
console.log(`  Absents Fév             : ${nbAbsFev}`);
console.log(`  Nouveaux Fév            : ${nbNouv}`);
console.log(`  Total clients           : ${rowsResume.length}`);
console.log(`${'─'.repeat(65)}`);
console.log(`  Fév confirmé par tarifs : ${fevConfirme} clients`);
console.log(`  Corrections à faire     : ${rowsCorrections.length} lignes`);
console.log(`  Social au réel (écarts) : ${rowsSocialReel.length} lignes`);
console.log(`  À investiguer           : ${rowsInvestigate.length} lignes`);
console.log(`${'='.repeat(65)}`);

// ── Export Excel ──
const wb = XLSX.utils.book_new();

// Onglet 1 — Résumé
rowsResume.sort((a, b) => {
  const order = { 'INACTIF': 0, 'ABSENT FEV': 1, 'ECART': 2, 'NOUVEAU FEV': 3, 'OK': 4 };
  if (a.Statut !== b.Statut) return (order[a.Statut] ?? 9) - (order[b.Statut] ?? 9);
  return Math.abs(b['Ecart Jan→Fev']) - Math.abs(a['Ecart Jan→Fev']);
});
const ws1 = XLSX.utils.json_to_sheet(rowsResume);
ws1['!cols'] = [{ wch: 18 }, { wch: 30 }, { wch: 6 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
XLSX.utils.book_append_sheet(wb, ws1, 'Resume');

// Onglet 2 — Corrections
rowsCorrections.sort((a, b) => Math.abs(b['Ecart Jan→Fev']) - Math.abs(a['Ecart Jan→Fev']));
const ws2 = XLSX.utils.json_to_sheet(rowsCorrections);
ws2['!cols'] = [{ wch: 18 }, { wch: 30 }, { wch: 45 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 28 }, { wch: 10 }, { wch: 15 }];
XLSX.utils.book_append_sheet(wb, ws2, 'Corrections Jan');

// Onglet 3 — Social au réel
rowsSocialReel.sort((a, b) => a.Client.localeCompare(b.Client));
const ws3 = XLSX.utils.json_to_sheet(rowsSocialReel);
ws3['!cols'] = [{ wch: 18 }, { wch: 30 }, { wch: 45 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 15 }];
XLSX.utils.book_append_sheet(wb, ws3, 'Social au reel');

// Onglet 4 — À investiguer
const ws4 = XLSX.utils.json_to_sheet(rowsInvestigate);
ws4['!cols'] = [{ wch: 18 }, { wch: 30 }, { wch: 35 }, { wch: 12 }, { wch: 12 }, { wch: 30 }, { wch: 60 }];
XLSX.utils.book_append_sheet(wb, ws4, 'A investiguer');

XLSX.writeFile(wb, 'analyse-croisee-jan26-v2.xlsx');
console.log('  Fichier: analyse-croisee-jan26-v2.xlsx');
