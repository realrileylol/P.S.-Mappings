import { useState } from 'react';
import { Building2, Calendar, Truck, ArrowRight, Info } from 'lucide-react';
import type { PromptNeeds, UserPrompts } from '../types';
import { NewFileButton } from './NewFileButton';

interface Props {
  needs: PromptNeeds;
  onComplete: (prompts: UserPrompts) => void;
  onNewFile: () => void;
}

export function PromptDialog({ needs, onComplete, onNewFile }: Props) {
  const [facilityId, setFacilityId] = useState('');
  const [facilityName, setFacilityName] = useState('');
  const [date, setDate] = useState('');
  const [supplierName, setSupplierName] = useState('');

  const anyRequired =
    needs.needsFacilityId ||
    needs.needsFacilityName ||
    needs.needsDate ||
    needs.needsSupplierName;

  if (!anyRequired) {
    // Nothing to prompt — proceed immediately
    onComplete({});
    return null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onComplete({
      facilityId: facilityId.trim() || undefined,
      facilityName: facilityName.trim() || undefined,
      date: date.trim() || undefined,
      supplierName: supplierName.trim() || undefined,
    });
  }

  const dateHint = 'e.g. 01-31-2026';

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-xl">
        <div className="flex justify-end mb-4">
          <NewFileButton onNewFile={onNewFile} />
        </div>
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold text-white mb-2">A few things missing</h2>
          <p className="text-slate-400 text-sm">
            Some required fields weren't found in the client file.<br/>
            Enter them below to hardcode them into the mapping.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {needs.needsFacilityName && (
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-blue-400" />
                <label className="text-sm font-medium text-slate-300">Facility Name</label>
                <span className="text-xs text-red-400 ml-auto">Required</span>
              </div>
              <input
                type="text"
                value={facilityName}
                onChange={e => setFacilityName(e.target.value)}
                placeholder="e.g. Henderson Health"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                required
              />
              <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Used for both FacilityID and FacilityName if ID is also missing.
              </p>
            </div>
          )}

          {needs.needsFacilityId && !needs.needsFacilityName && (
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-blue-400" />
                <label className="text-sm font-medium text-slate-300">Facility ID</label>
                <span className="text-xs text-slate-500 ml-auto">Optional</span>
              </div>
              <input
                type="text"
                value={facilityId}
                onChange={e => setFacilityId(e.target.value)}
                placeholder="e.g. FAC001"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          )}

          {needs.needsDate && (
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-blue-400" />
                <label className="text-sm font-medium text-slate-300">Reference Date</label>
                <span className="text-xs text-red-400 ml-auto">Required</span>
              </div>
              <input
                type="text"
                value={date}
                onChange={e => setDate(e.target.value)}
                placeholder={dateHint}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                required
              />
              <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Applied to InvoiceDate, PODate, and PostingDate.
              </p>
            </div>
          )}

          {needs.needsSupplierName && (
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Truck className="w-4 h-4 text-blue-400" />
                <label className="text-sm font-medium text-slate-300">Supplier / Distributor Name</label>
                <span className="text-xs text-slate-500 ml-auto">Optional</span>
              </div>
              <input
                type="text"
                value={supplierName}
                onChange={e => setSupplierName(e.target.value)}
                placeholder="e.g. Fisher Scientific"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
              <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Leave blank to set SupplierName as null.
              </p>
            </div>
          )}

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 px-6 rounded-xl transition-colors duration-200 mt-2"
          >
            Continue to Mapping
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
