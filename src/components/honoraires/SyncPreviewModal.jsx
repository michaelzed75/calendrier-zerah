// @ts-check
import React, { useState } from 'react';
import {
  X, CheckCircle, AlertCircle, AlertTriangle, Loader2,
  ChevronDown, ChevronUp, Users, FileText, TrendingUp,
  ShieldAlert, Link2, Plus, Minus, ArrowRightLeft
} from 'lucide-react';

const fmt = (n) => (n ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtInt = (n) => (n ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 });

const SEVERITY_STYLES = {
  error: { badge: 'bg-red-500/20 text-red-400 border border-red-500/30', icon: AlertCircle, color: 'text-red-400' },
  warning: { badge: 'bg-orange-500/20 text-orange-400 border border-orange-500/30', icon: AlertTriangle, color: 'text-orange-400' },
  info: { badge: 'bg-blue-500/20 text-blue-400 border border-blue-500/30', icon: AlertCircle, color: 'text-blue-400' }
};

const MATCH_LEVEL_STYLES = {
  uuid: 'bg-green-500/20 text-green-400',
  siren: 'bg-green-500/20 text-green-400',
  name_exact: 'bg-blue-500/20 text-blue-400',
  name_clean: 'bg-yellow-500/20 text-yellow-400',
  name_partial: 'bg-orange-500/20 text-orange-400',
  name_clean_partial: 'bg-red-500/20 text-red-400'
};

const STATUS_BADGES = {
  in_progress: 'bg-green-500/20 text-green-400',
  not_started: 'bg-slate-500/20 text-white',
  stopped: 'bg-red-500/20 text-red-400',
  finished: 'bg-blue-500/20 text-blue-400'
};

/**
 * Section dépliable
 */
function Section({ title, icon: Icon, count, severity, defaultOpen, children }) {
  const [open, setOpen] = useState(defaultOpen ?? (count > 0));

  return (
    <div className="border border-slate-700/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/50 transition-colors text-left"
      >
        <Icon size={16} className="text-white shrink-0" />
        <span className="text-sm font-medium text-white flex-1">{title}</span>
        {count > 0 && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            severity === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/30'
            : severity === 'warning' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
            : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
          }`}>
            {count}
          </span>
        )}
        {count === 0 && (
          <span className="text-xs text-white">Aucun</span>
        )}
        {open ? <ChevronUp size={14} className="text-white" /> : <ChevronDown size={14} className="text-white" />}
      </button>
      {open && count > 0 && (
        <div className="px-4 pb-4 border-t border-slate-700/30">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Modal de prévisualisation de la synchronisation Pennylane.
 * Affiche un rapport détaillé des changements détectés avant de valider.
 *
 * @param {Object} props
 * @param {Object} props.report - Rapport de previewSync()
 * @param {function} props.onAccept - Callback d'acceptation
 * @param {function} props.onCancel - Callback d'annulation
 * @param {boolean} props.accepting - En cours de commit
 */
function SyncPreviewModal({ report, onAccept, onCancel, accepting }) {
  const { summary, clientsMatches, clientsNew, clientsMissing, clientsNoSubscription,
    abonnementsNew, abonnementsUpdated, abonnementsDisappeared, abonnementsStatusChanged,
    lignesModified, lignesNew, lignesRemoved, anomalies } = report;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl max-w-6xl w-full max-h-[90vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* === Header === */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <FileText size={20} className="text-white" />
            <h2 className="text-lg font-semibold text-white">Rapport de synchronisation Pennylane</h2>
          </div>
          <button onClick={onCancel} className="text-white hover:text-white p-2 rounded-lg hover:bg-slate-700 transition">
            <X size={18} />
          </button>
        </div>

        {/* === Barre résumé === */}
        <div className="flex flex-wrap items-center gap-4 px-6 py-3 bg-slate-800/50 border-b border-slate-700/50 text-xs text-white">
          <span className="flex items-center gap-1">
            <Users size={12} />
            <strong>{summary.matched}</strong> clients matchés
          </span>
          {summary.unmatched > 0 && (
            <span className="text-orange-400">
              <strong>{summary.unmatched}</strong> non matchés
            </span>
          )}
          <span className="flex items-center gap-1">
            <Plus size={12} />
            <strong>{summary.newSubs}</strong> nouveaux abos
          </span>
          <span className="flex items-center gap-1">
            <ArrowRightLeft size={12} />
            <strong>{summary.updatedSubs}</strong> mis à jour
          </span>
          <span className="flex items-center gap-1">
            <TrendingUp size={12} />
            <strong>{summary.priceChanges}</strong> variations de prix
          </span>
          {anomalies.length > 0 && (
            <span className="text-orange-400 flex items-center gap-1">
              <AlertTriangle size={12} />
              <strong>{anomalies.length}</strong> anomalie{anomalies.length > 1 ? 's' : ''}
            </span>
          )}
          <span className="ml-auto font-medium text-sm">
            Delta total : <span className={summary.totalDeltaHT >= 0 ? 'text-green-400' : 'text-red-400'}>
              {summary.totalDeltaHT >= 0 ? '+' : ''}{fmt(summary.totalDeltaHT)} EUR HT
            </span>
          </span>
        </div>

        {/* === Body === */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">

          {/* --- Matching clients --- */}
          <Section title="Matching clients" icon={Users} count={clientsMatches.length} severity="info" defaultOpen={false}>
            <div className="mt-3 max-h-60 overflow-y-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left py-1.5 text-white font-medium">Customer Pennylane</th>
                    <th className="text-left py-1.5 text-white font-medium">Client local</th>
                    <th className="text-center py-1.5 text-white font-medium">Niveau</th>
                    <th className="text-center py-1.5 text-white font-medium">Cabinet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {clientsMatches.map((m, i) => (
                    <tr key={i} className={m.level === 'name_partial' || m.level === 'name_clean_partial' ? 'bg-orange-900/10' : ''}>
                      <td className="py-1.5 text-white">{m.customer.name}</td>
                      <td className="py-1.5 text-white">{m.client.nom}</td>
                      <td className="py-1.5 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-xs ${MATCH_LEVEL_STYLES[m.level] || 'bg-slate-700 text-white'}`}>
                          {m.levelLabel}
                        </span>
                      </td>
                      <td className="py-1.5 text-center">
                        {m.cabinetChange ? (
                          <span className="text-orange-400">{m.cabinetChange.ancien} → {m.cabinetChange.nouveau}</span>
                        ) : (
                          <span className="text-white">{m.client.cabinet || '-'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* --- Customers non matchés --- */}
          <Section title="Customers non matchés (avec abonnements)" icon={AlertTriangle} count={clientsNew.length} severity="warning">
            <div className="mt-3 max-h-40 overflow-y-auto">
              <ul className="space-y-1">
                {clientsNew.map((c, i) => (
                  <li key={i} className="text-sm text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                    <span className="font-medium">{c.customer.name}</span>
                    {c.customer.reg_no && <span className="text-xs text-white">SIREN : {c.customer.reg_no}</span>}
                    {c.customer.external_reference && <span className="text-xs text-white">Ref : {c.customer.external_reference}</span>}
                  </li>
                ))}
              </ul>
            </div>
          </Section>

          {/* --- Clients locaux absents de Pennylane --- */}
          <Section title="Clients locaux absents de Pennylane" icon={Minus} count={clientsMissing.length} severity="info">
            <div className="mt-3 max-h-40 overflow-y-auto">
              <ul className="space-y-1">
                {clientsMissing.map((c, i) => (
                  <li key={i} className="text-sm text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                    <span>{c.client.nom}</span>
                    {c.client.siren && <span className="text-xs text-white">SIREN : {c.client.siren}</span>}
                  </li>
                ))}
              </ul>
            </div>
          </Section>

          {/* --- Abonnements --- */}
          <Section
            title="Abonnements"
            icon={FileText}
            count={abonnementsNew.length + abonnementsUpdated.length + abonnementsDisappeared.length}
            severity={abonnementsDisappeared.length > 0 ? 'warning' : 'info'}
          >
            <div className="mt-3 space-y-4">
              {/* Nouveaux */}
              {abonnementsNew.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-green-400 mb-2 flex items-center gap-1">
                    <Plus size={12} /> {abonnementsNew.length} nouveau(x) abonnement(s)
                  </h4>
                  <div className="max-h-32 overflow-y-auto">
                    <ul className="space-y-1">
                      {abonnementsNew.map((a, i) => (
                        <li key={i} className="text-sm text-white">
                          <span className="font-medium">{a.clientMatch.client.nom}</span>
                          {' — '}{a.subscription.label}
                          <span className="text-xs text-white ml-2">({fmt(a.subscription.total_ht)} EUR HT)</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Mis à jour */}
              {abonnementsUpdated.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-blue-400 mb-2 flex items-center gap-1">
                    <ArrowRightLeft size={12} /> {abonnementsUpdated.length} abonnement(s) modifié(s)
                  </h4>
                  <div className="max-h-40 overflow-y-auto">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-700/50">
                          <th className="text-left py-1.5 text-white font-medium">Client</th>
                          <th className="text-left py-1.5 text-white font-medium">Abonnement</th>
                          <th className="text-left py-1.5 text-white font-medium">Changements</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/30">
                        {abonnementsUpdated.map((a, i) => (
                          <tr key={i}>
                            <td className="py-1.5 text-white">{a.clientMatch.client.nom}</td>
                            <td className="py-1.5 text-white">{a.subscription.label}</td>
                            <td className="py-1.5">
                              {Object.entries(a.changes).map(([field, val]) => (
                                <span key={field} className="inline-block mr-2 text-white">
                                  <span className="font-medium">{field}</span>:{' '}
                                  <span className="text-red-400">{typeof val.old === 'number' ? fmt(val.old) : String(val.old)}</span>
                                  {' → '}
                                  <span className="text-green-400">{typeof val.new === 'number' ? fmt(val.new) : String(val.new)}</span>
                                </span>
                              ))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Disparus */}
              {abonnementsDisappeared.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-orange-400 mb-2 flex items-center gap-1">
                    <Minus size={12} /> {abonnementsDisappeared.length} abonnement(s) disparu(s) de Pennylane
                  </h4>
                  <div className="max-h-32 overflow-y-auto">
                    <ul className="space-y-1">
                      {abonnementsDisappeared.map((a, i) => (
                        <li key={i} className="text-sm text-white">
                          <span className="font-medium">{a.clientName}</span>
                          {' — '}{a.existing.label}
                          <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${STATUS_BADGES[a.existing.status] || ''}`}>
                            {a.existing.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Changements de statut */}
              {abonnementsStatusChanged.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-white mb-2 flex items-center gap-1">
                    <ArrowRightLeft size={12} /> {abonnementsStatusChanged.length} changement(s) de statut
                  </h4>
                  <div className="max-h-32 overflow-y-auto">
                    <ul className="space-y-1">
                      {abonnementsStatusChanged.map((a, i) => (
                        <li key={i} className="text-sm text-white flex items-center gap-2">
                          <span className="font-medium">{a.clientMatch.client.nom}</span>
                          <span>{a.subscription.label}</span>
                          <span className={`px-1.5 py-0.5 rounded text-xs ${STATUS_BADGES[a.oldStatus] || ''}`}>{a.oldStatus}</span>
                          <span>→</span>
                          <span className={`px-1.5 py-0.5 rounded text-xs ${STATUS_BADGES[a.newStatus] || ''}`}>{a.newStatus}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* --- Variations de prix --- */}
          <Section title="Variations de prix" icon={TrendingUp} count={lignesModified.length} severity={lignesModified.some(l => Math.abs(l.deltaPct) > 20) ? 'warning' : 'info'}>
            <div className="mt-3 max-h-60 overflow-y-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left py-1.5 text-white font-medium">Client</th>
                    <th className="text-left py-1.5 text-white font-medium">Ligne</th>
                    <th className="text-right py-1.5 text-white font-medium">Ancien HT</th>
                    <th className="text-right py-1.5 text-white font-medium">Nouveau HT</th>
                    <th className="text-right py-1.5 text-white font-medium">Delta</th>
                    <th className="text-right py-1.5 text-white font-medium">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {lignesModified.map((l, i) => {
                    const isHigh = Math.abs(l.deltaPct) > 20;
                    return (
                      <tr key={i} className={isHigh ? 'bg-red-900/20' : ''}>
                        <td className="py-1.5 text-white">{l.clientName}</td>
                        <td className="py-1.5 text-white">{l.label}</td>
                        <td className="py-1.5 text-right text-white">{fmt(l.oldMontant)}</td>
                        <td className="py-1.5 text-right text-white">{fmt(l.newMontant)}</td>
                        <td className="py-1.5 text-right">
                          <span className={l.deltaHT >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {l.deltaHT >= 0 ? '+' : ''}{fmt(l.deltaHT)}
                          </span>
                        </td>
                        <td className="py-1.5 text-right">
                          <span className={`${isHigh ? 'font-bold' : ''} ${l.deltaPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {l.deltaPct >= 0 ? '+' : ''}{l.deltaPct.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {lignesModified.length > 0 && (
              <div className="mt-2 text-right text-xs text-white">
                Total delta : <span className={`font-semibold ${summary.totalDeltaHT >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {summary.totalDeltaHT >= 0 ? '+' : ''}{fmt(summary.totalDeltaHT)} EUR HT
                </span>
              </div>
            )}
          </Section>

          {/* --- Nouvelles lignes --- */}
          <Section title="Nouvelles lignes de facturation" icon={Plus} count={lignesNew.length} severity="info">
            <div className="mt-3 max-h-40 overflow-y-auto">
              <ul className="space-y-1">
                {lignesNew.map((l, i) => (
                  <li key={i} className="text-sm text-white">
                    <span className="font-medium">{l.clientName}</span>
                    {' — '}{l.label}
                    <span className="text-xs text-white ml-2">({fmt(l.montant_ht)} EUR HT, qté : {l.quantite})</span>
                  </li>
                ))}
              </ul>
            </div>
          </Section>

          {/* --- Lignes supprimées --- */}
          <Section title="Lignes supprimées" icon={Minus} count={lignesRemoved.length} severity={lignesRemoved.length > 0 ? 'warning' : 'info'}>
            <div className="mt-3 max-h-40 overflow-y-auto">
              <ul className="space-y-1">
                {lignesRemoved.map((l, i) => (
                  <li key={i} className="text-sm text-white">
                    <span className="font-medium">{l.clientName}</span>
                    {' — '}{l.label}
                    <span className="text-xs text-white ml-2">({fmt(l.montant_ht)} EUR HT)</span>
                  </li>
                ))}
              </ul>
            </div>
          </Section>

          {/* --- Anomalies --- */}
          <Section title="Anomalies" icon={ShieldAlert} count={anomalies.length} severity={anomalies.some(a => a.severity === 'error') ? 'error' : anomalies.length > 0 ? 'warning' : 'info'}>
            <div className="mt-3 space-y-2">
              {anomalies.map((a, i) => {
                const style = SEVERITY_STYLES[a.severity] || SEVERITY_STYLES.info;
                const AIcon = style.icon;
                return (
                  <div key={i} className={`px-3 py-2 rounded-lg ${style.badge}`}>
                    <div className="flex items-start gap-2">
                      <AIcon size={14} className={`${style.color} shrink-0 mt-0.5`} />
                      <span className="text-sm text-white">{a.message}</span>
                    </div>
                    {/* Détails des abonnements disparus */}
                    {a.type === 'subscriptions_disappeared' && a.details && a.details.length > 0 && (
                      <ul className="mt-2 ml-6 space-y-1">
                        {a.details.map((d, j) => (
                          <li key={j} className="text-xs text-white flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0" />
                            <span className="font-medium">{d.clientName}</span>
                            {' — '}{d.existing?.label || 'Sans label'}
                            <span className={`px-1.5 py-0.5 rounded text-xs ${STATUS_BADGES[d.existing?.status] || 'bg-slate-700 text-white'}`}>
                              {d.existing?.status || '?'}
                            </span>
                            {d.existing?.total_ht != null && (
                              <span className="text-white">({fmt(d.existing.total_ht)} EUR HT)</span>
                            )}
                            <span className="text-white">PL#{d.existing?.pennylane_subscription_id}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {/* Détails des weak matches */}
                    {a.type === 'weak_match' && a.customer && a.client && (
                      <div className="mt-1 ml-6 text-xs text-white">
                        Pennylane: <strong>{a.customer}</strong> → Local: <strong>{a.client}</strong> (niveau: {a.level})
                      </div>
                    )}
                    {/* Détails des variations de prix élevées */}
                    {a.type === 'price_variation_high' && (
                      <div className="mt-1 ml-6 text-xs text-white">
                        {a.client && <><strong>{a.client}</strong> — </>}
                        {a.label && <>{a.label} : </>}
                        {a.delta && <span className={a.delta >= 0 ? 'text-green-400' : 'text-red-400'}>{a.delta >= 0 ? '+' : ''}{fmt(a.delta)} EUR HT ({a.deltaPct}%)</span>}
                      </div>
                    )}
                    {/* Détails des clients inactifs avec abonnements */}
                    {a.type === 'inactive_with_subscriptions' && a.details && a.details.length > 0 && (
                      <ul className="mt-2 ml-6 space-y-2">
                        {a.details.map((d, j) => (
                          <li key={j} className="text-xs text-white bg-red-900/20 border border-red-800/40 rounded p-2">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                              <span className="font-medium">{d.client.nom}</span>
                              <span className="px-1.5 py-0.5 rounded text-xs bg-orange-900/50 text-white">inactif</span>
                              <span className="text-white">→ Pennylane : {d.customer.name}</span>
                            </div>
                            <div className="ml-4 text-white">
                              {d.subscriptionsCount} abo(s) actif(s) • {fmt(d.totalHT)} EUR HT
                            </div>
                            {d.subscriptions && d.subscriptions.map((s, k) => (
                              <div key={k} className="ml-4 text-white">
                                — {s.label} : {fmt(s.total_ht)} EUR HT
                              </div>
                            ))}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>
        </div>

        {/* === Footer === */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700 bg-slate-800/30">
          <p className="text-xs text-white">
            {anomalies.length > 0
              ? `${anomalies.length} anomalie(s) détectée(s). Vérifiez avant d'accepter.`
              : 'Aucune anomalie détectée.'}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onCancel}
              disabled={accepting}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={onAccept}
              disabled={accepting}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 transition disabled:opacity-50 flex items-center gap-2"
            >
              {accepting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CheckCircle size={16} />
              )}
              Accepter et synchroniser
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SyncPreviewModal;
