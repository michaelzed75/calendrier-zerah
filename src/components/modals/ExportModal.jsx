// @ts-check
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { formatDateToYMD } from '../../utils/dateUtils';

/**
 * @typedef {Object} ExportModalProps
 * @property {'month'|'week'|'day'} viewMode - Mode de vue actuel
 * @property {Date} currentDate - Date courante du calendrier
 * @property {Date[]} [weekDays] - Jours de la semaine (pour mode semaine)
 * @property {function(string, string): void} onExport - Callback d'export (dateDebut, dateFin)
 * @property {function(): void} onClose - Callback de fermeture
 */

/**
 * Modal d'export Excel avec sélection de période
 * @param {ExportModalProps} props
 * @returns {JSX.Element}
 */
function ExportModal({ viewMode, currentDate, weekDays, onExport, onClose }) {
  const getWeekDaysForExport = () => {
    if (weekDays && weekDays.length > 0) return weekDays;
    const today = new Date(currentDate);
    const first = today.getDate() - today.getDay() + 1;
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(new Date(today.getFullYear(), today.getMonth(), first + i));
    }
    return days;
  };

  const exportWeekDays = getWeekDaysForExport();

  const [startDate, setStartDate] = useState(() => {
    if (viewMode === 'month' || viewMode === 'day') {
      const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      return formatDateToYMD(firstDay);
    } else if (exportWeekDays.length > 0) {
      return formatDateToYMD(exportWeekDays[0]);
    }
    return '';
  });

  const [endDate, setEndDate] = useState(() => {
    if (viewMode === 'month' || viewMode === 'day') {
      const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      return formatDateToYMD(lastDay);
    } else if (exportWeekDays.length > 0) {
      return formatDateToYMD(exportWeekDays[6]);
    }
    return '';
  });

  const handleExport = () => {
    onExport(startDate, endDate);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">Export Excel</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Date de début</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Date de fin</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600" />
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded transition">
              Annuler
            </button>
            <button onClick={handleExport} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 rounded transition">
              Exporter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExportModal;
