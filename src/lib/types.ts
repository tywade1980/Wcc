export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  projectType: string;
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  dateReceived: string;
  notes: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  notes: string;
  createdAt: string;
  totalProjects: number;
  totalRevenue: number;
}

export interface EstimateLineItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface Estimate {
  id: string;
  estimateNumber: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  projectType: string;
  projectAddress: string;
  status: 'draft' | 'sent' | 'approved' | 'rejected' | 'expired';
  lineItems: EstimateLineItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes: string;
  validUntil: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  clientName: string;
  clientId: string;
  projectType: string;
  address: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  startDate: string;
  endDate: string;
  estimatedValue: number;
  actualCost: number;
  progress: number;
  notes: string;
  estimateId: string;
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  type: 'consultation' | 'site_visit' | 'work' | 'follow_up' | 'other';
  clientName: string;
  projectId: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  status: 'scheduled' | 'completed' | 'cancelled';
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  domain?: string;
}
