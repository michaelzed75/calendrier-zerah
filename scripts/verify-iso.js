import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const { data: apiKeys } = await supabase.from('pennylane_api_keys').select('cabinet, api_key');

function normalizeLabel(label) {
  if (!label) return '';
  return label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '').trim();
}
function round2(n) { return Math.round(n * 100) / 100; }

async function plFetch(apiKey, endpoint, params = {}) {
  const url = new URL(`https://app.pennylane.com/api/external/v2${endpoint}`);
  Object.entries(params).forEach(([k, v]) => { if (v != null) url.searchParams.append(k, String(v)); });
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(url.toString(), { headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' } });
    if (res.status === 429) { await new Promise(r => setTimeout(r, attempt * 3000)); continue; }
    if (!res.ok) throw new Error(`PL ${res.status}`);
    return res.json();
  }
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

// Charger tarifs_reference fixes
const { data: tarifsRef } = await supabase.from('tarifs_reference').select('*').eq('date_effet', '2026-01-01').eq('type_recurrence', 'fixe');
const { data: clients } = await supabase.from('clients').select('id, nom, siren, cabinet, actif, pennylane_customer_id').eq('actif', true);

// Index clients par SIREN
const clientsBySiren = new Map();
for (const c of clients) {
  if (!c.siren) continue;
  const s = c.siren.replace(/\s/g, '');
  const s9 = s.slice(0, 9);
  if (!clientsBySiren.has(s)) clientsBySiren.set(s, []);
  clientsBySiren.get(s).push(c);
  if (s.length === 14 && !clientsBySiren.has(s9)) clientsBySiren.set(s9, []);
  if (s.length === 14) clientsBySiren.get(s9).push(c);
}

function matchClient(customer, cabName) {
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

let totalClientsOK = 0, totalClientsEcart = 0, totalClientsAbsentPL = 0, totalClientsPLseul = 0;
let totalLignesComparees = 0, totalLignesOK = 0, totalLignesEcart = 0;
let ecartsCumul = 0;
const problems = [];

const tarifsByClient = new Map();
for (const t of tarifsRef) {
  if (!tarifsByClient.has(t.client_id)) tarifsByClient.set(t.client_id, []);
  tarifsByClient.get(t.client_id).push(t);
}

const matchedClientIds = new Set();

for (const cab of ['Audit Up', 'Zerah Fiduciaire']) {
  const apiKey = apiKeys.find(k => k.cabinet === cab).api_key;
  console.log(`\nVérification ${cab}...`);

  const customers = await plGetAll(apiKey, '/customers');
  const subscriptions = await plGetAll(apiKey, '/billing_subscriptions');
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

    // Récup lignes PL
    const plLines = [];
    for (const sub of subs) {
      await new Promise(r => setTimeout(r, 150));
      const res = await plFetch(apiKey, `/billing_subscriptions/${sub.id}/invoice_lines`);
      for (const line of (res.items || [])) {
        plLines.push({
          label: line.label,
          montant_ht: parseFloat(line.currency_amount_before_tax) || 0
        });
      }
    }

    const totalPL = round2(plLines.reduce((s, l) => s + l.montant_ht, 0));

    const client = matchClient(customer, cab);
    if (!client) {
      // Client PL sans correspondance BDD
      if (totalPL > 10) { // ignorer les placeholders
        totalClientsPLseul++;
        problems.push({ type: 'PL_SEUL', nom: customer.name, reg_no: customer.reg_no, totalPL, cab });
      }
      continue;
    }

    matchedClientIds.add(client.id);
    const tarifs = tarifsByClient.get(client.id) || [];
    if (!tarifs.length) {
      if (totalPL > 10) {
        totalClientsPLseul++;
        problems.push({ type: 'PL_SEUL_NO_TARIFS', nom: client.nom, totalPL, cab });
      }
      continue;
    }

    const totalBDD = round2(tarifs.reduce((s, t) => s + t.pu_ht * t.quantite, 0));
    const ecart = round2(totalPL - totalBDD);

    // Matching lignes
    const plCopy = [...plLines];
    let lignesOK = 0, lignesEcart = 0;
    for (const t of tarifs) {
      const normT = normalizeLabel(t.label);
      let idx = plCopy.findIndex(pl => normalizeLabel(pl.label) === normT);
      // Fallback par montant
      if (idx < 0) idx = plCopy.findIndex(pl => Math.abs(round2(pl.montant_ht) - round2(t.pu_ht * t.quantite)) < 0.01);
      if (idx >= 0) {
        const diff = Math.abs(round2(plCopy[idx].montant_ht) - round2(t.pu_ht * t.quantite));
        if (diff < 0.01) lignesOK++;
        else lignesEcart++;
        plCopy.splice(idx, 1);
      } else {
        lignesEcart++;
      }
    }

    totalLignesComparees += tarifs.length;
    totalLignesOK += lignesOK;
    totalLignesEcart += lignesEcart;

    if (Math.abs(ecart) < 0.01 && lignesEcart === 0 && plCopy.length === 0) {
      totalClientsOK++;
    } else {
      totalClientsEcart++;
      ecartsCumul += Math.abs(ecart);
      problems.push({ type: 'ECART', nom: client.nom, totalBDD, totalPL, ecart, lignesEcart, plExtras: plCopy.length, cab });
    }
  }
}

// Clients BDD sans match PL
for (const [clientId, tarifs] of tarifsByClient) {
  if (matchedClientIds.has(clientId)) continue;
  const cl = clients.find(c => c.id === clientId);
  if (!cl) continue;
  const total = round2(tarifs.reduce((s, t) => s + t.pu_ht * t.quantite, 0));
  totalClientsAbsentPL++;
  problems.push({ type: 'ABSENT_PL', nom: cl.nom, totalBDD: total });
}

console.log('\n' + '='.repeat(70));
console.log('  VERIFICATION ISO COMPLETE — tarifs_reference vs API Pennylane');
console.log('='.repeat(70));
console.log(`  Clients OK (ISO parfait)    : ${totalClientsOK}`);
console.log(`  Clients avec écarts         : ${totalClientsEcart}`);
console.log(`  Clients absents PL          : ${totalClientsAbsentPL}`);
console.log(`  Clients PL sans BDD         : ${totalClientsPLseul}`);
console.log(`  ---`);
console.log(`  Lignes comparées            : ${totalLignesComparees}`);
console.log(`  Lignes OK                   : ${totalLignesOK}`);
console.log(`  Lignes en écart             : ${totalLignesEcart}`);
console.log(`  Ecart cumulé                : ${ecartsCumul.toFixed(2)} €`);
console.log('='.repeat(70));

if (problems.length) {
  console.log('\nDétail des anomalies:');
  for (const p of problems) {
    if (p.type === 'ECART') console.log(`  ECART  | ${p.nom.padEnd(30)} | BDD: ${p.totalBDD} | PL: ${p.totalPL} | Δ ${p.ecart} | ${p.lignesEcart} lignes`);
    if (p.type === 'ABSENT_PL') console.log(`  ABSENT | ${p.nom.padEnd(30)} | BDD: ${p.totalBDD} (pas d'abo actif PL)`);
    if (p.type === 'PL_SEUL') console.log(`  PL SEUL| ${(p.nom || '').padEnd(30)} | PL: ${p.totalPL} | reg_no: ${p.reg_no}`);
    if (p.type === 'PL_SEUL_NO_TARIFS') console.log(`  PL SEUL| ${p.nom.padEnd(30)} | PL: ${p.totalPL} (client BDD mais 0 tarifs)`);
  }
}

if (totalClientsEcart === 0 && totalClientsPLseul === 0) {
  console.log('\n✅ CONFIRMATION : tarifs_reference BDD est ISO avec les abonnements actifs Pennylane.');
  console.log('   Les ' + totalClientsAbsentPL + ' clients "absents PL" ont des tarifs en BDD mais aucun abonnement actif sur PL.');
} else {
  console.log('\n⚠️  Des écarts subsistent — voir détail ci-dessus.');
}
