"use client";

import React, { useState } from 'react';
import { Project } from '@/lib/types';

const STATUS_META: Record<string, { label: string; color: string }> = {
  planning:  { label: 'Planning',   color: 'bg-yellow-100 text-yellow-800' },
  active:    { label: 'Active',     color: 'bg-green-100 text-green-800' },
  on_hold:   { label: 'On Hold',    color: 'bg-orange-100 text-orange-800' },
  completed: { label: 'Completed',  color: 'bg-blue-100 text-blue-800' },
  cancelled: { label: 'Cancelled',  color: 'bg-red-100 text-red-800' },
};

const SAMPLE: Project[] = [
  { id: 'p1', name: 'Master Bedroom Built-ins', clientName: 'Emily Davis', clientId: 'c1', projectType: 'Built-ins', address: '123 Maple St, Dublin OH', status: 'active', startDate: '2025-06-05', endDate: '2025-06-20', estimatedValue: 4923.50, actualCost: 3100, progress: 65, notes: 'Cabinets framed, painting next.', estimateId: 'est-001', createdAt: '2025-06-01T10:00:00' },
  { id: 'p2', name: 'Kitchen Cabinet Refresh', clientName: 'Sarah Johnson', clientId: 'c2', projectType: 'Kitchen Remodeling', address: '456 Oak Ave, Columbus OH', status: 'planning', startDate: '2025-07-01', endDate: '2025-07-15', estimatedValue: 15200, actualCost: 0, progress: 0, notes: 'Waiting on cabinet delivery.', estimateId: '', createdAt: '2025-05-28T09:00:00' },
];

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>(SAMPLE);
  const [selected, setSelected] = useState<Project | null>(null);
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<Project>>({});

  const filtered = filter === 'all' ? projects : projects.filter(p => p.status === filter);
  const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const handleSave = () => {
    if (!form.name) return;
    if (form.id && projects.find(p => p.id === form.id)) {
      setProjects(projects.map(p => p.id === form.id ? { ...p, ...form } as Project : p));
    } else {
      setProjects([{ id: `p${Date.now()}`, clientId: '', estimateId: '', createdAt: new Date().toISOString(), progress: 0, actualCost: 0, ...form } as Project, ...projects]);
    }
    setShowForm(false); setForm({});
  };

  const openEdit = (p: Project) => { setForm(p); setSelected(p); setShowForm(true); };
  const openNew = () => { setForm({ status: 'planning', progress: 0, actualCost: 0 }); setSelected(null); setShowForm(true); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Projects</h2>
          <p className="text-sm text-gray-500">{projects.length} total project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={filter} onChange={e => setFilter(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_META).map(([v,{label}]) => <option key={v} value={v}>{label}</option>)}
          </select>
          <button onClick={openNew} className="bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium px-4 py-2 rounded-md">+ New Project</button>
        </div>
      </div>

      <div className="space-y-4">
        {filtered.map(p => (
          <div key={p.id} className="bg-white rounded-lg shadow p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{p.name}</h3>
                <p className="text-sm text-gray-500">{p.clientName} · {p.address}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_META[p.status].color}`}>{STATUS_META[p.status].label}</span>
                <button onClick={() => openEdit(p)} className="text-sm text-orange-600 hover:underline">Edit</button>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Progress</span>
                <span>{p.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-orange-500 h-2 rounded-full transition-all" style={{ width: `${p.progress}%` }} />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
              <div><span className="text-gray-400">Value</span><p className="font-medium">{fmt(p.estimatedValue)}</p></div>
              <div><span className="text-gray-400">Start</span><p className="font-medium">{p.startDate}</p></div>
              <div><span className="text-gray-400">End</span><p className="font-medium">{p.endDate}</p></div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="bg-white rounded-lg shadow p-10 text-center text-gray-400">No projects found.</div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4">
            <h3 className="text-lg font-semibold">{form.id ? 'Edit' : 'New'} Project</h3>
            <div className="grid grid-cols-2 gap-4">
              {[['name','Project Name *'],['clientName','Client Name'],['projectType','Project Type'],['address','Address']].map(([f,l]) => (
                <div key={f} className={f==='address'||f==='name' ? 'col-span-2' : ''}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{l}</label>
                  <input type="text" value={(form as Record<string,string>)[f] || ''} onChange={e => setForm({...form,[f]:e.target.value})}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                <input type="date" value={form.startDate||''} onChange={e=>setForm({...form,startDate:e.target.value})}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                <input type="date" value={form.endDate||''} onChange={e=>setForm({...form,endDate:e.target.value})}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                <select value={form.status||'planning'} onChange={e=>setForm({...form,status:e.target.value as Project['status']})}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                  {Object.entries(STATUS_META).map(([v,{label}])=><option key={v} value={v}>{label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Progress (%)</label>
                <input type="number" min="0" max="100" value={form.progress||0} onChange={e=>setForm({...form,progress:+e.target.value})}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Est. Value ($)</label>
                <input type="number" min="0" value={form.estimatedValue||0} onChange={e=>setForm({...form,estimatedValue:+e.target.value})}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <textarea rows={3} value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={()=>{setShowForm(false);setForm({});}} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} className="px-4 py-2 text-sm text-white bg-orange-600 rounded hover:bg-orange-700">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
