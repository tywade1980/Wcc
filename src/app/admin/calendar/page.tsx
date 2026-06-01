"use client";

import React, { useState } from 'react';
import { CalendarEvent } from '@/lib/types';

const TYPE_COLORS: Record<string, string> = {
  consultation: 'bg-blue-100 text-blue-700 border-blue-200',
  site_visit:   'bg-yellow-100 text-yellow-700 border-yellow-200',
  work:         'bg-green-100 text-green-700 border-green-200',
  follow_up:    'bg-purple-100 text-purple-700 border-purple-200',
  other:        'bg-gray-100 text-gray-700 border-gray-200',
};

const SAMPLE: CalendarEvent[] = [
  { id: 'ev1', title: 'Initial Consultation — Davis', description: 'Discuss built-in bookshelf project.', type: 'consultation', clientName: 'Emily Davis', projectId: 'p1', date: '2025-06-03', startTime: '10:00', endTime: '11:00', location: '123 Maple St, Dublin OH', status: 'completed' },
  { id: 'ev2', title: 'Site Visit — Johnson Kitchen', description: 'Measure and assess kitchen layout.', type: 'site_visit', clientName: 'Sarah Johnson', projectId: 'p2', date: '2025-06-10', startTime: '09:00', endTime: '10:30', location: '456 Oak Ave, Columbus OH', status: 'scheduled' },
  { id: 'ev3', title: 'Work Day — Davis Built-ins', description: 'Frame and install cabinet carcasses.', type: 'work', clientName: 'Emily Davis', projectId: 'p1', date: '2025-06-12', startTime: '08:00', endTime: '17:00', location: '123 Maple St, Dublin OH', status: 'scheduled' },
  { id: 'ev4', title: 'Follow-up Call — Brown', description: 'Share deck quote and answer questions.', type: 'follow_up', clientName: 'Michael Brown', projectId: '', date: '2025-06-15', startTime: '14:00', endTime: '14:30', location: 'Phone call', status: 'scheduled' },
];

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<CalendarEvent[]>(SAMPLE);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<CalendarEvent>>({});

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const cells: (number | null)[] = Array(firstDay).fill(null).concat(Array.from({length: daysInMonth}, (_,i) => i+1));
  while (cells.length % 7 !== 0) cells.push(null);

  const eventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return events.filter(e => e.date === dateStr);
  };

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y-1); } else setMonth(m => m-1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y+1); } else setMonth(m => m+1); };

  const handleSave = () => {
    if (!form.title || !form.date) return;
    if (form.id && events.find(e => e.id === form.id)) {
      setEvents(events.map(e => e.id === form.id ? {...e,...form} as CalendarEvent : e));
    } else {
      setEvents([{id:`ev${Date.now()}`,status:'scheduled',projectId:'',...form} as CalendarEvent, ...events]);
    }
    setShowForm(false); setForm({});
  };

  const openNew = (date?: string) => { setForm({ type:'consultation', date: date||'', status:'scheduled' }); setSelected(null); setShowForm(true); };
  const openEdit = (e: CalendarEvent) => { setForm(e); setSelected(e); setShowForm(true); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Calendar</h2>
        <button onClick={() => openNew()} className="bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium px-4 py-2 rounded-md">+ New Event</button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Month nav */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-100">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h3 className="text-lg font-semibold text-gray-900">{MONTHS[month]} {year}</h3>
          <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-100">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b">
          {DAYS.map(d => <div key={d} className="py-2 text-center text-xs font-medium text-gray-500 uppercase">{d}</div>)}
        </div>
        {/* Grid */}
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            const isToday = day !== null && day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
            const dayEvents = day !== null ? eventsForDay(day) : [];
            return (
              <div key={idx} className={`min-h-24 border-b border-r p-1 ${!day ? 'bg-gray-50' : 'hover:bg-orange-50 cursor-pointer'}`}
                onClick={() => day && openNew(`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`)}>
                {day && (
                  <>
                    <span className={`text-sm font-medium inline-flex items-center justify-center w-7 h-7 rounded-full ${
                      isToday ? 'bg-orange-500 text-white' : 'text-gray-700'
                    }`}>{day}</span>
                    <div className="mt-1 space-y-0.5">
                      {dayEvents.map(ev => (
                        <div key={ev.id} onClick={e => { e.stopPropagation(); openEdit(ev); }}
                          className={`text-xs px-1 py-0.5 rounded border truncate cursor-pointer ${TYPE_COLORS[ev.type]}`}>
                          {ev.startTime} {ev.title}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming list */}
      <div className="bg-white rounded-lg shadow p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Upcoming Events</h3>
        <ul className="space-y-3">
          {events.filter(e=>e.status==='scheduled').sort((a,b)=>a.date.localeCompare(b.date)).slice(0,5).map(e=>(
            <li key={e.id} className="flex items-start gap-3">
              <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${TYPE_COLORS[e.type].split(' ')[0].replace('bg-','bg-').replace('100','400')}`} style={{marginTop:'6px'}} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{e.title}</p>
                <p className="text-xs text-gray-500">{e.date} · {e.startTime}–{e.endTime} · {e.location}</p>
              </div>
              <button onClick={()=>openEdit(e)} className="text-xs text-orange-600 hover:underline flex-shrink-0">Edit</button>
            </li>
          ))}
        </ul>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-semibold">{form.id ? 'Edit' : 'New'} Event</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
                <input type="text" value={form.title||''} onChange={e=>setForm({...form,title:e.target.value})}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Date *</label>
                  <input type="date" value={form.date||''} onChange={e=>setForm({...form,date:e.target.value})}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                  <select value={form.type||'consultation'} onChange={e=>setForm({...form,type:e.target.value as CalendarEvent['type']})}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                    <option value="consultation">Consultation</option>
                    <option value="site_visit">Site Visit</option>
                    <option value="work">Work Day</option>
                    <option value="follow_up">Follow-up</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Start Time</label>
                  <input type="time" value={form.startTime||''} onChange={e=>setForm({...form,startTime:e.target.value})}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">End Time</label>
                  <input type="time" value={form.endTime||''} onChange={e=>setForm({...form,endTime:e.target.value})}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Client Name</label>
                <input type="text" value={form.clientName||''} onChange={e=>setForm({...form,clientName:e.target.value})}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Location</label>
                <input type="text" value={form.location||''} onChange={e=>setForm({...form,location:e.target.value})}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <textarea rows={2} value={form.description||''} onChange={e=>setForm({...form,description:e.target.value})}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                <select value={form.status||'scheduled'} onChange={e=>setForm({...form,status:e.target.value as CalendarEvent['status']})}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={()=>setShowForm(false)} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} className="px-4 py-2 text-sm text-white bg-orange-600 rounded hover:bg-orange-700">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
