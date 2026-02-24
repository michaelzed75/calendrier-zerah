// @ts-check
import React, { useState } from 'react';
import { X, AlertTriangle, Copy, Layers, HelpCircle, ChevronDown, ChevronUp, Activity, Download } from 'lucide-react';
import { exportDiagnosticExcel } from '../../utils/honoraires';

const fmt = (n) => (n ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Configuration des sections d'anomalies */
const SECTIONS = [
  {
    key: 'socialConflicts',
    label: 'Conflits social forfait / bulletin',
    icon: AlertTriangle,
    severityColor: 'red',
    emptyText: 'Aucun conflit détecté'
  },
  {
    key: 'duplicateUniqueAxes',
    label: 'Doublons d\'axes uniques',
    icon: Copy,
    severityColor: 'orange',
    emptyText: 'Aucun doublon d\'axe'
  },
  {
    key: 'duplicateLabels',
    label: 'Labels dupliqués dans un abonnement',
    icon: Copy,
    severityColor: 'orange',
    emptyText: 'Aucun label dupliqué'
  },
  {
    key: 'multipleSubscriptions',
    label: 'Abonnements multiples par client',
    icon: Layers,
    severityColor: 'yellow',
    emptyText: 'Aucun multi-abonnement'
  },
  {
    key: 'nonStandardLabels',
    label: 'Labels non standard (pense-bêtes ?)',
    icon: HelpCircle,
    severityColor: 'yellow',
    emptyText: 'Aucun label inhabituel'
  },
  {
    key: 'unclassifiedLines',
    label: 'Lignes non classifiées',
    icon: HelpCircle,
    severityColor: 'yellow',
    emptyText: 'Toutes les lignes sont classifiées'
  }
];

const SEVERITY_STYLES = {
  red: { badge: 'bg-red-500/20 text-red-400 border-red-500/30', dot: 'bg-red-500', border: 'border-red-500/20' },
  orange: { badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30', dot: 'bg-orange-500', border: 'border-orange-500/20' },
  yellow: { badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', dot: 'bg-yellow-500', border: 'border-yellow-500/20' }
};

const STATUS_BADGES = {
  in_progress: 'bg-green-500/20 text-green-400',
  not_started: 'bg-slate-500/20 text-white',
  stopped: 'bg-red-500/20 text-red-400',
  finished: 'bg-blue-500/20 text-blue-400'
};

/**
 * @param {Object} props
 * @param {Object} props.report - Rapport retourné par genererDiagnostic()
 * @param {function} props.onClose
 */
function DiagnosticModal({ report, onClose }) {
  const [expanded, setExpanded] = useState(() => {
    const initial = new Set();
    for (const section of SECTIONS) {
      if ((report.anomalies[section.key] || []).length > 0) {
        initial.add(section.key);
      }
    }
    return initial;
  });

  const toggleSection = (key) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const { summary } = report;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-slate-900 border border-slate-700 rounded-xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Activity size={20} className="text-purple-400" />
            <h2 className="text-lg font-semibold text-white">Diagnostic des abonnements</h2>
          </div>
          <div className="flex items-center gap-3">
            {/* Summary badges */}
            {summary.bySeverity.error > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                {summary.bySeverity.error} erreur{summary.bySeverity.error > 1 ? 's' : ''}
              </span>
            )}
            {summary.bySeverity.warning > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30">
                {summary.bySeverity.warning} alerte{summary.bySeverity.warning > 1 ? 's' : ''}
              </span>
            )}
            {summary.bySeverity.info > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                {summary.bySeverity.info} info{summary.bySeverity.info > 1 ? 's' : ''}
              </span>
            )}
            {summary.totalAnomalies === 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                Aucune anomalie
              </span>
            )}
            <button onClick={onClose} className="p-1 text-white hover:text-white rounded">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-6 px-6 py-2 bg-slate-800/50 border-b border-slate-700/50 text-xs text-white">
          <span>{report.totalClients} clients</span>
          <span>{report.totalAbonnements} abonnements</span>
          <span>{report.totalLignes} lignes</span>
          <span className="ml-auto">{summary.totalAnomalies} anomalie{summary.totalAnomalies > 1 ? 's' : ''} détectée{summary.totalAnomalies > 1 ? 's' : ''}</span>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">
          {SECTIONS.map(section => {
            const items = report.anomalies[section.key] || [];
            const isExpanded = expanded.has(section.key);
            const styles = SEVERITY_STYLES[section.severityColor];
            const Icon = section.icon;

            return (
              <div key={section.key} className={`border rounded-lg ${items.length > 0 ? styles.border : 'border-slate-700/50'}`}>
                {/* Section header */}
                <button
                  onClick={() => toggleSection(section.key)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/50 rounded-lg transition-colors"
                >
                  <Icon size={16} className={items.length > 0 ? `text-${section.severityColor}-400` : 'text-white'} />
                  <span className={`text-sm font-medium ${items.length > 0 ? 'text-white' : 'text-white'}`}>
                    {section.label}
                  </span>
                  {items.length > 0 ? (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles.badge}`}>
                      {items.length}
                    </span>
                  ) : (
                    <span className="text-xs text-white">{section.emptyText}</span>
                  )}
                  <span className="ml-auto text-white">
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </span>
                </button>

                {/* Section body */}
                {isExpanded && items.length > 0 && (
                  <div className="px-4 pb-3 space-y-2">
                    {items.map((anomaly, i) => (
                      <AnomalyCard key={i} anomaly={anomaly} sectionKey={section.key} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-700 bg-slate-800/30">
          <p className="text-xs text-white">
            Corrigez les anomalies dans Pennylane puis resynchronisez les données.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportDiagnosticExcel(report)}
              disabled={summary.totalAnomalies === 0}
              className="px-4 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Download size={14} />
              Exporter Excel
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-700 text-white text-sm rounded-lg hover:bg-slate-600"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Carte d'anomalie individuelle */
function AnomalyCard({ anomaly, sectionKey }) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3">
      {/* Header : client + description */}
      <div className="flex items-start gap-2">
        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
          anomaly.severity === 'error' ? 'bg-red-500' :
          anomaly.severity === 'warning' ? 'bg-orange-500' : 'bg-yellow-500'
        }`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium text-white">{anomaly.clientNom}</span>
            <span className="text-xs text-white">{anomaly.clientCabinet}</span>
          </div>
          <p className="text-xs text-white">{anomaly.description}</p>
        </div>
        {anomaly.details?.length > 0 && (
          <button
            onClick={() => setDetailsOpen(!detailsOpen)}
            className="text-xs text-white hover:text-slate-200 flex-shrink-0"
          >
            {detailsOpen ? 'Masquer' : `Détails (${anomaly.details.length})`}
          </button>
        )}
      </div>

      {/* Détails expandables */}
      {detailsOpen && anomaly.details && (
        <div className="mt-2 ml-4">
          {sectionKey === 'multipleSubscriptions' ? (
            <SubscriptionDetails details={anomaly.details} />
          ) : (
            <LineDetails details={anomaly.details} />
          )}
        </div>
      )}
    </div>
  );
}

/** Tableau de détail des lignes */
function LineDetails({ details }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-white border-b border-slate-700/50">
          <th className="text-left py-1 pr-2">Label</th>
          <th className="text-left py-1 pr-2">Famille</th>
          <th className="text-left py-1 pr-2">Axe</th>
          <th className="text-right py-1 pr-2">Qté</th>
          <th className="text-right py-1 pr-2">Mt HT</th>
          <th className="text-left py-1 pr-2">Abonnement</th>
          <th className="text-left py-1">Statut</th>
        </tr>
      </thead>
      <tbody>
        {details.map((d, i) => {
          const isAnomaly = d._isAnomaly ?? true;
          return (
            <tr key={i} className={isAnomaly
              ? 'bg-red-900/40 border-b border-red-500/30'
              : 'border-b border-slate-700/30'}>
              <td className={`py-1.5 pr-2 max-w-[200px] truncate ${isAnomaly ? 'text-red-400 font-semibold' : 'text-white'}`} title={d.label}>
                {d.label}
                {d.classification && (
                  <span className={`ml-1 text-[10px] ${isAnomaly ? 'text-red-400/70' : 'text-white'}`}>({d.classification})</span>
                )}
              </td>
              <td className={`py-1.5 pr-2 ${isAnomaly ? 'text-red-400/60' : 'text-white'}`}>{d.famille || '-'}</td>
              <td className={`py-1.5 pr-2 ${isAnomaly ? 'text-red-400/60' : 'text-white'}`}>{d.axe || '-'}</td>
              <td className={`py-1.5 pr-2 text-right ${isAnomaly ? 'text-red-400/60' : 'text-white'}`}>{d.quantite}</td>
              <td className={`py-1.5 pr-2 text-right ${isAnomaly ? 'text-red-400 font-semibold' : 'text-white'}`}>{fmt(d.montant_ht)} €</td>
              <td className={`py-1.5 pr-2 truncate max-w-[120px] ${isAnomaly ? 'text-red-400/60' : 'text-white'}`} title={d.abo_label}>
                {d.abo_label || `#${d.abonnement_id}`}
              </td>
              <td className="py-1.5">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_BADGES[d.abo_status] || 'bg-slate-600 text-white'}`}>
                  {d.abo_status}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Tableau de détail des abonnements (pattern 4) */
function SubscriptionDetails({ details }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-white border-b border-slate-700/50">
          <th className="text-left py-1 pr-2">Abonnement</th>
          <th className="text-left py-1 pr-2">PL ID</th>
          <th className="text-left py-1 pr-2">Statut</th>
          <th className="text-right py-1 pr-2">Total HT</th>
          <th className="text-right py-1">Nb lignes</th>
        </tr>
      </thead>
      <tbody>
        {details.map((d, i) => (
          <tr key={i} className="border-b border-slate-700/30">
            <td className="py-1 pr-2 text-white">{d.label || `#${d.abonnement_id}`}</td>
            <td className="py-1 pr-2 text-white">{d.pennylane_id}</td>
            <td className="py-1 pr-2">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_BADGES[d.status] || 'bg-slate-600 text-white'}`}>
                {d.status}
              </span>
            </td>
            <td className="py-1 pr-2 text-right text-white">{fmt(d.total_ht)} €</td>
            <td className="py-1 text-right text-white">{d.nb_lignes}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default DiagnosticModal;
