"use client";

import React, { useState } from 'react';
import { Client } from '@/lib/types';

const SAMPLE_CLIENTS: Client[] = [
  { id: 'c1', name: 'Emily Davis', email: 'emily.davis@example.com', phone: '614-555-3456', address: '123 Maple St', city: 'Dublin', state: 'OH', zip: '43016', notes: 'Prefers morning calls.', createdAt: '2025-05-20T11:20:00', totalProjects: 2, totalRevenue: 8500 },
  { id: 'c2', name: 'Sarah Johnson', email: 'sarah.j@example.com', phone: '614-555-5678', address: '456 Oak Ave', city: 'Columbus', state: 'OH', zip: '43085', notes: '', createdAt: '2025-05-28T09:15:00', totalProjects: 1, totalRevenue: 15200 },
  { id: 'c3', name: 'Michael Brown', email: 'mbrown@example.com', phone: '614-555-9012', address: '789 Elm Dr', city: 'Westerville', state: 'OH', zip: '43081', notes: 'Has large backyard, referral potential.', createdAt: '2025-05-25T16:45:00', totalProjects: 1, totalRevenue: 6000 },
];

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>(SAMPLE_CLIENTS);
  const [selected, setSelected] = useState<Client | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<Partial<Client>>({});

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = () => {
    if (!form.name) return;
    if (form.id) {
      setClients(clients.map(c => c.id === form.id ? { ...c, ...form } as Client : c));
    } else {
      const newClient: Client = {
        id: `c${Date.now()}`, name: form.name || '', email: form.email || '',
        phone: form.phone || '', address: form.address || '', city: form.city || '',
        state: form.state || 'OH', zip: form.zip || '', notes: form.notes || '',
        createdAt: new Date().toISOString(), totalProjects: 0, totalRevenue: 0,
      };
      setClients([newClient, ...clients]);
    }
    setShowForm(false);
    setForm({});
  };

  const openNew = () => { setForm({}); setSelected(null); setShowForm(true); };
  const openEdit = (c: Client) => { setForm(c); setSelected(c); setShowForm(true); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Clients</h2>
          <p className="text-sm text-gray-500">{clients.length} total clients</p>
        </div>
        <button onClick={openNew} className="bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium px-4 py-2 rounded-md">+ New Client</button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <input
            type="text" placeholder="Search clients..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <ul className="divide-y divide-gray-200">
          {filtered.map(c => (
            <li key={c.id} className="flex items-center justify-between px-4 py-4 hover:bg-gray-50">
              <div>
                <p className="font-medium text-gray-900">{c.name}</p>
                <p className="text-sm text-gray-500">{c.email} · {c.phone}</p>
                <p className="text-sm text-gray-400">{c.city}, {c.state}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-700">${c.totalRevenue.toLocaleString()}</p>
                <p className="text-xs text-gray-400">{c.totalProjects} project{c.totalProjects !== 1 ? 's' : ''}</p>
                <button onClick={() => openEdit(c)} className="mt-1 text-xs text-orange-600 hover:underline">Edit</button>
              </div>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-4 py-8 text-center text-gray-400 text-sm">No clients found.</li>
          )}
        </ul>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4">
            <h3 className="text-lg font-semibold">{form.id ? 'Edit Client' : 'New Client'}</h3>
            <div className="grid grid-cols-2 gap-4">
              {[['name','Name *'],['email','Email'],['phone','Phone'],['address','Address'],['city','City'],['zip','ZIP']].map(([f,l]) => (
                <div key={f} className={f === 'address' ? 'col-span-2' : ''}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{l}</label>
                  <input type="text" value={(form as Record<string,string>)[f] || ''}
                    onChange={e => setForm({...form, [f]: e.target.value})}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
              ))}
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <textarea rows={3} value={form.notes || ''} onChange={e => setForm({...form, notes: e.target.value})}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} className="px-4 py-2 text-sm text-white bg-orange-600 rounded hover:bg-orange-700">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
