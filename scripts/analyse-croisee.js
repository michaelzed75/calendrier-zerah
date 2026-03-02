// @ts-check
/**
 * Analyse croisée : tarifs_reference (BDD, prévus 2026) vs abonnements réels (API Pennylane)
 * Génère un fichier Excel avec les écarts.
 *
 * Usage : node scripts/analyse-croisee.js
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';

const API_BASE = 'https://app.pennylane.com/api/external/v2';

// ─── Pennylane API helpers ───────────────────────────────────

async function plFetch(apiKey, endpoint, params = {}) {
  const url = new URL(`${API_BASE}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v != null) url.searchParams.append(k, String(v));
  });
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' }
    });
    if (res.status === 429) { await new Promise(r => setTimeout(r, attempt * 2000)); continue; }
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
    if (!res.has_more || !res.next_cursor) break;
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

// ─── Main ────────────────────────────────────────────────────

async function main() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  // 1. Clés API
  const { data: apiKeys } = await supabase.from('pennylane_api_keys').select('cabinet, api_key, company_id');
  const cabinets = [
    { name: 'Audit Up', apiKey: apiKeys?.find(k => k.cabinet === 'Audit Up')?.api_key || process.env.PENNYLANE_AUDIT_UP_TOKEN },
    { name: 'Zerah Fiduciaire', apiKey: apiKeys?.find(k => k.cabinet === 'Zerah Fiduciaire')?.api_key || process.env.PENNYLANE_ZERAH_FIDUCIAIRE_TOKEN }
  ];

  // 2. Tarifs prévus 2026 fixes
  console.log('Chargement tarifs_reference 2026 (fixes)...');
  const { data: tarifsRef } = await supabase
    .from('tarifs_reference')
    .select('*, clients(id, nom, siren, cabinet, actif)')
    .eq('date_effet', '2026-01-01').eq('type_recurrence', 'fixe').order('client_id');
  console.log(`  ${tarifsRef.length} tarifs fixes 2026 en BDD`);

  const tarifsByClient = new Map();
  for (const t of tarifsRef) {
    if (!tarifsByClient.has(t.client_id)) tarifsByClient.set(t.client_id, { client: t.clients, tarifs: [] });
    tarifsByClient.get(t.client_id).tarifs.push(t);
  }

  // 3. Clients locaux
  const { data: clients } = await supabase.from('clients').select('id, nom, siren, cabinet, actif, pennylane_customer_id').eq('actif', true);
  // Index clients par valeur exacte du champ siren (SIREN 9 ou SIRET 14)
  // + index par SIREN 9 premiers chiffres pour fallback
  const clientsByExactSiren = new Map(); // valeur exacte → [clients]
  const clientsBySiren9 = new Map();     // siren 9 → [clients]
  for (const c of clients) {
    if (!c.siren) continue;
    const s = c.siren.replace(/\s/g, '');
    // Index exact
    if (!clientsByExactSiren.has(s)) clientsByExactSiren.set(s, []);
    clientsByExactSiren.get(s).push(c);
    // Index SIREN 9
    const s9 = s.slice(0, 9);
    if (!clientsBySiren9.has(s9)) clientsBySiren9.set(s9, []);
    clientsBySiren9.get(s9).push(c);
  }

  function matchClient(customer) {
    const regNo = (customer.reg_no || '').replace(/\s/g, '').trim();
    if (!regNo || !/^\d{9}(\d{5})?$/.test(regNo)) {
      // Pas de SIREN/SIRET valide → fallback UUID
      if (customer.external_reference) return clients.find(c => c.pennylane_customer_id === customer.external_reference) || null;
      return null;
    }
    // 1. Match exact (SIRET 14 ou SIREN 9 selon ce que PL fournit)
    const exact = clientsByExactSiren.get(regNo) || [];
    if (exact.length === 1) return exact[0];
    if (exact.length > 1 && customer.external_reference) {
      const m = exact.find(c => c.pennylane_customer_id === customer.external_reference);
      if (m) return m;
    }
    // 2. Fallback SIREN 9 premiers chiffres
    const s9 = regNo.slice(0, 9);
    const candidates = clientsBySiren9.get(s9) || [];
    if (candidates.length === 1) return candidates[0];
    if (candidates.length > 1 && customer.external_reference) {
      const m = candidates.find(c => c.pennylane_customer_id === customer.external_reference);
      if (m) return m;
    }
    // 3. Fallback UUID pur
    if (customer.external_reference) return clients.find(c => c.pennylane_customer_id === customer.external_reference) || null;
    return null;
  }

  // 4. Récup PL
  const plCustomersByClientId = new Map();

  for (const cab of cabinets) {
    console.log(`Récupération Pennylane — ${cab.name}...`);
    const customers = await plGetAll(cab.apiKey, '/customers');
    const subscriptions = await plGetAll(cab.apiKey, '/billing_subscriptions');
    const activeSubs = subscriptions.filter(s => s.status === 'in_progress' || s.status === 'not_started');
    console.log(`  ${customers.length} customers, ${activeSubs.length} abos actifs`);

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

      const client = matchClient(customer);
      if (!client) continue;

      const subsWithLines = [];
      for (const sub of subs) {
        await new Promise(r => setTimeout(r, 150));
        const lines = await plGetLines(cab.apiKey, sub.id);
        subsWithLines.push({ sub, lines });
      }

      if (plCustomersByClientId.has(client.id)) {
        plCustomersByClientId.get(client.id).subs.push(...subsWithLines);
      } else {
        plCustomersByClientId.set(client.id, { customer, cabinet: cab.name, subs: subsWithLines });
      }
    }
  }

  // 5. ANALYSE CROISÉE — construction des lignes Excel
  const rowsEcarts = [];    // Onglet 1 : détail ligne par ligne des écarts
  const rowsResume = [];    // Onglet 2 : résumé par client
  const rowsAbsents = [];   // Onglet 3 : clients absents PL / absents BDD

  for (const [clientId, { client, tarifs }] of tarifsByClient) {
    if (!client?.actif) continue;
    const plData = plCustomersByClientId.get(clientId);

    if (!plData) {
      const totalPrevu = round2(tarifs.reduce((s, t) => s + t.pu_ht * t.quantite, 0));
      rowsAbsents.push({
        'Cabinet': client.cabinet, 'Client': client.nom, 'SIREN': client.siren,
        'Situation': 'Prevu en BDD, absent de PL',
        'Nb lignes prevues': tarifs.length, 'Total prevu HT': totalPrevu,
        'Detail lignes': tarifs.map(t => `${t.label} (${round2(t.pu_ht * t.quantite)})`).join(' | ')
      });
      rowsResume.push({
        'Cabinet': client.cabinet, 'Client': client.nom, 'SIREN': client.siren,
        'Statut': 'ABSENT PL', 'Total prevu HT': totalPrevu,
        'Total reel HT': 0, 'Ecart HT': -totalPrevu,
        'Nb ecarts prix': 0, 'Nb lignes prevues absentes PL': tarifs.length, 'Nb lignes PL non prevues': 0
      });
      continue;
    }

    // Aplatir lignes PL
    const plLines = [];
    for (const { sub, lines } of plData.subs) {
      for (const line of lines) {
        plLines.push({
          subId: sub.id, subLabel: sub.label, label: line.label,
          quantite: parseFloat(line.quantity) || 0,
          montant_ht: parseFloat(line.currency_amount_before_tax) || 0
        });
      }
    }

    // Matching par label normalisé
    const plLinesCopy = [...plLines];
    const matchedPairs = [];
    const unmatchedTarifs = [];

    for (const tarif of tarifs) {
      const normT = normalizeLabel(tarif.label);
      const idx = plLinesCopy.findIndex(pl => normalizeLabel(pl.label) === normT);
      if (idx >= 0) {
        matchedPairs.push({ tarif, pl: plLinesCopy[idx] });
        plLinesCopy.splice(idx, 1);
      } else {
        unmatchedTarifs.push(tarif);
      }
    }
    // 2e passe : matcher les restants par montant (multi-établissements, labels différenciés)
    const finalUnmatchedTarifs = [];
    const unmatchedPLcopy = [...plLinesCopy];
    for (const tarif of unmatchedTarifs) {
      const prevuHT = round2(tarif.pu_ht * tarif.quantite);
      const idx = unmatchedPLcopy.findIndex(pl => Math.abs(round2(pl.montant_ht) - prevuHT) < 0.01);
      if (idx >= 0) {
        matchedPairs.push({ tarif, pl: unmatchedPLcopy[idx] });
        unmatchedPLcopy.splice(idx, 1);
      } else {
        finalUnmatchedTarifs.push(tarif);
      }
    }
    const unmatchedPL = unmatchedPLcopy;
    const unmatchedTarifsFinal = finalUnmatchedTarifs;

    const totalPrevu = round2(tarifs.reduce((s, t) => s + t.pu_ht * t.quantite, 0));
    const totalReel = round2(plLines.reduce((s, l) => s + l.montant_ht, 0));
    const ecartTotal = round2(totalReel - totalPrevu);
    const hasEcart = matchedPairs.some(({ tarif, pl }) => Math.abs(round2(tarif.pu_ht * tarif.quantite) - round2(pl.montant_ht)) >= 0.01)
      || unmatchedTarifsFinal.length > 0 || unmatchedPL.length > 0;

    // Lignes matchées
    for (const { tarif, pl } of matchedPairs) {
      const prevuHT = round2(tarif.pu_ht * tarif.quantite);
      const reelHT = round2(pl.montant_ht);
      const diff = round2(reelHT - prevuHT);
      if (Math.abs(diff) >= 0.01) {
        rowsEcarts.push({
          'Cabinet': client.cabinet, 'Client': client.nom, 'SIREN': client.siren,
          'Produit': tarif.label, 'Axe': tarif.axe,
          'Type ecart': 'Prix different',
          'Prevu HT': prevuHT, 'Reel HT': reelHT, 'Ecart HT': diff,
          'Abonnement PL': pl.subLabel || ''
        });
      }
    }
    // Lignes prévues absentes PL
    for (const t of unmatchedTarifsFinal) {
      rowsEcarts.push({
        'Cabinet': client.cabinet, 'Client': client.nom, 'SIREN': client.siren,
        'Produit': t.label, 'Axe': t.axe,
        'Type ecart': 'Prevu BDD, absent PL',
        'Prevu HT': round2(t.pu_ht * t.quantite), 'Reel HT': 0, 'Ecart HT': -round2(t.pu_ht * t.quantite),
        'Abonnement PL': ''
      });
    }
    // Lignes PL non prévues
    for (const pl of unmatchedPL) {
      rowsEcarts.push({
        'Cabinet': client.cabinet, 'Client': client.nom, 'SIREN': client.siren,
        'Produit': pl.label, 'Axe': '',
        'Type ecart': 'Dans PL, non prevu BDD',
        'Prevu HT': 0, 'Reel HT': round2(pl.montant_ht), 'Ecart HT': round2(pl.montant_ht),
        'Abonnement PL': pl.subLabel || ''
      });
    }

    // Résumé client
    const nbEcartsPrix = matchedPairs.filter(({ tarif, pl }) => Math.abs(round2(tarif.pu_ht * tarif.quantite) - round2(pl.montant_ht)) >= 0.01).length;
    rowsResume.push({
      'Cabinet': client.cabinet, 'Client': client.nom, 'SIREN': client.siren,
      'Statut': hasEcart ? 'ECART' : 'OK',
      'Total prevu HT': totalPrevu, 'Total reel HT': totalReel, 'Ecart HT': ecartTotal,
      'Nb ecarts prix': nbEcartsPrix,
      'Nb lignes prevues absentes PL': unmatchedTarifsFinal.length,
      'Nb lignes PL non prevues': unmatchedPL.length
    });

    plCustomersByClientId.delete(clientId);
  }

  // Clients PL sans tarifs prévus
  for (const [clientId, plData] of plCustomersByClientId) {
    const client = clients.find(c => c.id === clientId);
    const totalReel = round2(plData.subs.reduce((s, { lines }) =>
      s + lines.reduce((s2, l) => s2 + (parseFloat(l.currency_amount_before_tax) || 0), 0), 0));
    rowsAbsents.push({
      'Cabinet': plData.cabinet, 'Client': client?.nom || plData.customer.name,
      'SIREN': client?.siren || plData.customer.reg_no,
      'Situation': 'Dans PL, pas de tarifs prevus en BDD',
      'Nb lignes prevues': 0, 'Total prevu HT': 0,
      'Detail lignes': plData.subs.map(({ sub }) => sub.label).join(' | ')
    });
    rowsResume.push({
      'Cabinet': plData.cabinet, 'Client': client?.nom || plData.customer.name,
      'SIREN': client?.siren || plData.customer.reg_no,
      'Statut': 'PL SEUL', 'Total prevu HT': 0,
      'Total reel HT': totalReel, 'Ecart HT': totalReel,
      'Nb ecarts prix': 0, 'Nb lignes prevues absentes PL': 0, 'Nb lignes PL non prevues': 0
    });
  }

  // Tri
  rowsResume.sort((a, b) => Math.abs(b['Ecart HT']) - Math.abs(a['Ecart HT']));
  rowsEcarts.sort((a, b) => {
    const cmp = a['Client'].localeCompare(b['Client']);
    return cmp !== 0 ? cmp : Math.abs(b['Ecart HT']) - Math.abs(a['Ecart HT']);
  });

  // 6. EXPORT EXCEL
  const wb = XLSX.utils.book_new();

  // Onglet Résumé
  const wsResume = XLSX.utils.json_to_sheet(rowsResume);
  wsResume['!cols'] = [
    { wch: 18 }, { wch: 35 }, { wch: 12 }, { wch: 12 },
    { wch: 15 }, { wch: 15 }, { wch: 12 },
    { wch: 14 }, { wch: 24 }, { wch: 20 }
  ];
  XLSX.utils.book_append_sheet(wb, wsResume, 'Resume');

  // Onglet Ecarts détaillés
  const wsEcarts = XLSX.utils.json_to_sheet(rowsEcarts);
  wsEcarts['!cols'] = [
    { wch: 18 }, { wch: 35 }, { wch: 12 }, { wch: 45 }, { wch: 20 },
    { wch: 24 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 35 }
  ];
  XLSX.utils.book_append_sheet(wb, wsEcarts, 'Ecarts detail');

  // Onglet Absents
  const wsAbsents = XLSX.utils.json_to_sheet(rowsAbsents);
  wsAbsents['!cols'] = [
    { wch: 18 }, { wch: 35 }, { wch: 12 }, { wch: 32 },
    { wch: 16 }, { wch: 15 }, { wch: 60 }
  ];
  XLSX.utils.book_append_sheet(wb, wsAbsents, 'Absents');

  const filename = 'analyse-croisee-honoraires-2026-v4.xlsx';
  XLSX.writeFile(wb, filename);

  // Stats console
  const nbOK = rowsResume.filter(r => r['Statut'] === 'OK').length;
  const nbEcart = rowsResume.filter(r => r['Statut'] === 'ECART').length;
  const nbAbsentPL = rowsResume.filter(r => r['Statut'] === 'ABSENT PL').length;
  const nbPLSeul = rowsResume.filter(r => r['Statut'] === 'PL SEUL').length;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  OK: ${nbOK} | Ecarts: ${nbEcart} | Absents PL: ${nbAbsentPL} | PL seul: ${nbPLSeul}`);
  console.log(`  ${rowsEcarts.length} lignes d'ecart detaillees`);
  console.log(`  Fichier: ${filename}`);
  console.log(`${'='.repeat(60)}`);
}

main().catch(err => { console.error('ERREUR:', err.message); process.exit(1); });
