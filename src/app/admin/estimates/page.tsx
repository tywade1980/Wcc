"use client";

import React, { useState } from 'react';
import { Estimate, EstimateLineItem } from '@/lib/types';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-yellow-100 text-yellow-700',
};

const BLANK_LINE = (): EstimateLineItem => ({ id: `li${Date.now()}${Math.random()}`, description: '', quantity: 1, unit: 'each', unitPrice: 0, total: 0 });

const SAMPLE: Estimate[] = [
  {
    id: 'est-001', estimateNumber: 'EST-2025-001', clientName: 'Emily Davis', clientEmail: 'emily.davis@example.com',
    clientPhone: '614-555-3456', projectType: 'Built-in Bookshelves', projectAddress: '123 Maple St, Dublin OH 43016',
    status: 'approved', validUntil: '2025-07-01', createdAt: '2025-06-01T10:00:00', notes: 'Client approved via email.',
    taxRate: 7.5,
    lineItems: [
      { id: 'li1', description: 'Custom built-in bookshelf unit (8ft x 4ft)', quantity: 1, unit: 'unit', unitPrice: 3500, total: 3500 },
      { id: 'li2', description: 'Paint and finish', quantity: 1, unit: 'unit', unitPrice: 400, total: 400 },
      { id: 'li3', description: 'Installation labor', quantity: 8, unit: 'hours', unitPrice: 85, total: 680 },
    ],
    subtotal: 4580, taxAmount: 343.50, total: 4923.50,
  },
];

function recalc(items: EstimateLineItem[], taxRate: number) {
  const updated = items.map(i => ({ ...i, total: +(i.quantity * i.unitPrice).toFixed(2) }));
  const subtotal = +updated.reduce((s, i) => s + i.total, 0).toFixed(2);
  const taxAmount = +(subtotal * taxRate / 100).toFixed(2);
  return { lineItems: updated, subtotal, taxAmount, total: +(subtotal + taxAmount).toFixed(2) };
}

export default function EstimatesPage() {
  const [estimates, setEstimates] = useState<Estimate[]>(SAMPLE);
  const [editing, setEditing] = useState<Estimate | null>(null);
  const [showForm, setShowForm] = useState(false);

  const openNew = () => {
    const now = new Date().toISOString();
    setEditing({
      id: `est-${Date.now()}`, estimateNumber: `EST-${new Date().getFullYear()}-${String(estimates.length + 1).padStart(3,'0')}`,
      clientName: '', clientEmail: '', clientPhone: '', projectType: '', projectAddress: '',
      status: 'draft', validUntil: '', createdAt: now, notes: '', taxRate: 7.5,
      lineItems: [BLANK_LINE()], subtotal: 0, taxAmount: 0, total: 0,
    });
    setShowForm(true);
  };

  const openEdit = (e: Estimate) => { setEditing({ ...e, lineItems: [...e.lineItems] }); setShowForm(true); };

  const updateLine = (idx: number, field: keyof EstimateLineItem, val: string | number) => {
    if (!editing) return;
    const items = editing.lineItems.map((li, i) => i === idx ? { ...li, [field]: val } : li);
    const calcs = recalc(items, editing.taxRate);
    setEditing({ ...editing, ...calcs });
  };

  const addLine = () => {
    if (!editing) return;
    setEditing({ ...editing, lineItems: [...editing.lineItems, BLANK_LINE()] });
  };

  const removeLine = (idx: number) => {
    if (!editing) return;
    const items = editing.lineItems.filter((_, i) => i !== idx);
    const calcs = recalc(items, editing.taxRate);
    setEditing({ ...editing, ...calcs });
  };

  const handleSave = () => {
    if (!editing) return;
    const calcs = recalc(editing.lineItems, editing.taxRate);
    const final = { ...editing, ...calcs };
    if (estimates.find(e => e.id === final.id)) {
      setEstimates(estimates.map(e => e.id === final.id ? final : e));
    } else {
      setEstimates([final, ...estimates]);
    }
    setShowForm(false);
  };

  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Estimates</h2>
          <p className="text-sm text-gray-500">{estimates.length} estimate{estimates.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openNew} className="bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium px-4 py-2 rounded-md">+ New Estimate</button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {['#', 'Client', 'Project', 'Total', 'Status', 'Date', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {estimates.map(e => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-mono text-gray-600">{e.estimateNumber}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{e.clientName}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{e.projectType}</td>
                <td className="px-4 py-3 text-sm font-semibold text-gray-900">{fmt(e.total)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[e.status]}`}>
                    {e.status.charAt(0).toUpperCase() + e.status.slice(1)}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">{new Date(e.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <button onClick={() => openEdit(e)} className="text-sm text-orange-600 hover:underline">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && editing && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-40 overflow-y-auto">
          <div className="min-h-screen flex items-start justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl my-8">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h3 className="text-lg font-semibold">{editing.id && estimates.find(e=>e.id===editing.id) ? 'Edit' : 'New'} Estimate — {editing.estimateNumber}</h3>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  {[['clientName','Client Name *'],['clientEmail','Email'],['clientPhone','Phone'],['projectType','Project Type'],['projectAddress','Project Address'],['validUntil','Valid Until']].map(([f,l]) => (
                    <div key={f} className={f === 'projectAddress' ? 'col-span-2' : ''}>
                      <label className="block text-xs font-medium text-gray-700 mb-1">{l}</label>
                      <input type={f === 'validUntil' ? 'date' : 'text'}
                        value={(editing as Record<string,string|number>)[f] as string || ''}
                        onChange={e => setEditing({ ...editing, [f]: e.target.value })}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                    <select value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value as Estimate['status'] })}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                      {['draft','sent','approved','rejected','expired'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Tax Rate (%)</label>
                    <input type="number" step="0.1" value={editing.taxRate}
                      onChange={e => { const calcs = recalc(editing.lineItems, +e.target.value); setEditing({...editing, taxRate: +e.target.value, ...calcs}); }}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-gray-700">Line Items</h4>
                    <button onClick={addLine} className="text-sm text-orange-600 hover:underline">+ Add Line</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="text-xs text-gray-500 border-b">
                          <th className="pb-2 text-left font-medium w-1/2">Description</th>
                          <th className="pb-2 text-right font-medium w-16">Qty</th>
                          <th className="pb-2 text-left font-medium w-20 pl-2">Unit</th>
                          <th className="pb-2 text-right font-medium w-24">Unit Price</th>
                          <th className="pb-2 text-right font-medium w-24">Total</th>
                          <th className="pb-2 w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {editing.lineItems.map((li, idx) => (
                          <tr key={li.id}>
                            <td className="py-2 pr-2">
                              <input type="text" value={li.description} onChange={e => updateLine(idx,'description',e.target.value)}
                                placeholder="Item description"
                                className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400" />
                            </td>
                            <td className="py-2 px-1">
                              <input type="number" min="0" step="0.5" value={li.quantity} onChange={e => updateLine(idx,'quantity',+e.target.value)}
                                className="w-16 border border-gray-200 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-orange-400" />
                            </td>
                            <td className="py-2 px-1">
                              <select value={li.unit} onChange={e => updateLine(idx,'unit',e.target.value)}
                                className="border border-gray-200 rounded px-1 py-1 text-sm focus:outline-none">
                                {['each','hours','sqft','lf','lot','unit'].map(u=><option key={u} value={u}>{u}</option>)}
                              </select>
                            </td>
                            <td className="py-2 px-1">
                              <input type="number" min="0" step="0.01" value={li.unitPrice} onChange={e => updateLine(idx,'unitPrice',+e.target.value)}
                                className="w-24 border border-gray-200 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-orange-400" />
                            </td>
                            <td className="py-2 px-1 text-sm text-right font-medium text-gray-700">{fmt(li.total)}</td>
                            <td className="py-2 pl-1">
                              <button onClick={() => removeLine(idx)} className="text-gray-300 hover:text-red-500">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <div className="text-sm space-y-1 text-right">
                      <div className="flex justify-between gap-12 text-gray-600"><span>Subtotal</span><span>{fmt(editing.subtotal)}</span></div>
                      <div className="flex justify-between gap-12 text-gray-600"><span>Tax ({editing.taxRate}%)</span><span>{fmt(editing.taxAmount)}</span></div>
                      <div className="flex justify-between gap-12 font-bold text-gray-900 text-base pt-1 border-t"><span>Total</span><span>{fmt(editing.total)}</span></div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                  <textarea rows={3} value={editing.notes} onChange={e => setEditing({...editing, notes: e.target.value})}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
              </div>
              <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-100">Cancel</button>
                <button onClick={handleSave} className="px-4 py-2 text-sm text-white bg-orange-600 rounded hover:bg-orange-700">Save Estimate</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
