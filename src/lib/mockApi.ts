// Mock API Layer - Simulates network calls with setTimeout

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  verified: boolean;
  createdAt: string;
  plan: 'free' | 'starter' | 'professional' | 'enterprise';
  storageUsed: number; // in MB
  storageLimit: number; // in MB
  lastVerification?: string;
  nextVerification?: string;
  verificationSchedule: 'daily' | 'weekly' | 'monthly';
  pinSet: boolean;
  passkeyEnabled: boolean;
  notificationsEnabled: boolean;
  accountStatus: 'active' | 'suspended' | 'past_due';
}

export interface File {
  id: string;
  name: string;
  size: number; // in bytes
  type: string;
  uploadedAt: string;
  tags: string[];
  includeInEmergency: boolean;
  encrypted: boolean;
}

export interface EmergencyContact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  verified: boolean;
  addedAt: string;
  lastNotified?: string;
}

export interface VerificationHistory {
  id: string;
  timestamp: string;
  method: 'pin' | 'passkey';
  success: boolean;
}

export interface EmergencyTrigger {
  id: string;
  triggeredAt: string;
  reason: string;
  status: 'sent' | 'bounced' | 'pending';
  contactsNotified: number;
}

export interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
  description: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  ip?: string;
}

export interface AdminUser {
  id: string;
  email: string;
  verified: boolean;
  storageUsed: number;
  estimatedFees: number;
  lastVerification: string;
  plan: string;
  status: 'active' | 'suspended' | 'past_due';
  joinedAt: string;
}

// Mock Data
export const mockUser: User = {
  id: 'usr_001',
  email: 'john.doe@example.com',
  name: 'John Doe',
  verified: true,
  createdAt: '2024-01-15T10:30:00Z',
  plan: 'professional',
  storageUsed: 237,
  storageLimit: 5000,
  lastVerification: '2024-12-23T09:00:00Z',
  nextVerification: '2024-12-24T09:00:00Z',
  verificationSchedule: 'daily',
  pinSet: true,
  passkeyEnabled: true,
  notificationsEnabled: true,
  accountStatus: 'active',
};

export const mockFiles: File[] = [
  { id: 'file_001', name: 'family-photos-2024.zip', size: 52428800, type: 'application/zip', uploadedAt: '2024-12-20T14:30:00Z', tags: ['photos', 'family'], includeInEmergency: true, encrypted: true },
  { id: 'file_002', name: 'will-and-testament.pdf', size: 1048576, type: 'application/pdf', uploadedAt: '2024-12-18T10:15:00Z', tags: ['legal', 'important'], includeInEmergency: true, encrypted: true },
  { id: 'file_003', name: 'insurance-documents.pdf', size: 2097152, type: 'application/pdf', uploadedAt: '2024-12-15T16:45:00Z', tags: ['legal', 'insurance'], includeInEmergency: true, encrypted: true },
  { id: 'file_004', name: 'password-vault-backup.kdbx', size: 524288, type: 'application/octet-stream', uploadedAt: '2024-12-10T08:00:00Z', tags: ['passwords', 'security'], includeInEmergency: true, encrypted: true },
  { id: 'file_005', name: 'medical-records-2024.pdf', size: 3145728, type: 'application/pdf', uploadedAt: '2024-12-05T11:30:00Z', tags: ['medical', 'health'], includeInEmergency: false, encrypted: true },
  { id: 'file_006', name: 'property-deeds.pdf', size: 4194304, type: 'application/pdf', uploadedAt: '2024-11-28T09:00:00Z', tags: ['legal', 'property'], includeInEmergency: true, encrypted: true },
  { id: 'file_007', name: 'crypto-wallet-seeds.txt', size: 1024, type: 'text/plain', uploadedAt: '2024-11-20T15:00:00Z', tags: ['crypto', 'financial'], includeInEmergency: true, encrypted: true },
  { id: 'file_008', name: 'family-video-message.mp4', size: 104857600, type: 'video/mp4', uploadedAt: '2024-11-15T12:00:00Z', tags: ['video', 'family', 'personal'], includeInEmergency: true, encrypted: true },
];

export const mockEmergencyContacts: EmergencyContact[] = [
  { id: 'ec_001', name: 'Jane Doe', email: 'jane.doe@example.com', phone: '+1 555-123-4567', verified: true, addedAt: '2024-01-20T10:00:00Z' },
  { id: 'ec_002', name: 'Michael Smith', email: 'michael.smith@example.com', phone: '+1 555-987-6543', verified: true, addedAt: '2024-02-15T14:30:00Z' },
  { id: 'ec_003', name: 'Sarah Johnson', email: 'sarah.j@example.com', verified: false, addedAt: '2024-12-01T09:00:00Z' },
];

export const mockVerificationHistory: VerificationHistory[] = [
  { id: 'vh_001', timestamp: '2024-12-23T09:00:00Z', method: 'passkey', success: true },
  { id: 'vh_002', timestamp: '2024-12-22T09:00:00Z', method: 'pin', success: true },
  { id: 'vh_003', timestamp: '2024-12-21T09:00:00Z', method: 'passkey', success: true },
  { id: 'vh_004', timestamp: '2024-12-20T09:00:00Z', method: 'pin', success: true },
  { id: 'vh_005', timestamp: '2024-12-19T09:00:00Z', method: 'passkey', success: false },
];

export const mockEmergencyTriggers: EmergencyTrigger[] = [
  { id: 'et_001', triggeredAt: '2024-06-15T10:00:00Z', reason: 'Verification window expired', status: 'sent', contactsNotified: 2 },
];

export const mockInvoices: Invoice[] = [
  { id: 'inv_001', date: '2024-12-01', amount: 9.99, status: 'paid', description: 'Professional Plan - December 2024' },
  { id: 'inv_002', date: '2024-11-01', amount: 9.99, status: 'paid', description: 'Professional Plan - November 2024' },
  { id: 'inv_003', date: '2024-10-01', amount: 9.99, status: 'paid', description: 'Professional Plan - October 2024' },
  { id: 'inv_004', date: '2024-09-01', amount: 4.99, status: 'paid', description: 'Starter Plan - September 2024' },
];

export const mockActivityLogs: ActivityLog[] = [
  { id: 'al_001', timestamp: '2024-12-23T14:30:00Z', action: 'File uploaded', details: 'family-photos-2024.zip (50 MB)', ip: '192.168.1.1' },
  { id: 'al_002', timestamp: '2024-12-23T09:00:00Z', action: 'Verification completed', details: 'Method: Passkey', ip: '192.168.1.1' },
  { id: 'al_003', timestamp: '2024-12-22T16:45:00Z', action: 'Emergency contact added', details: 'sarah.j@example.com', ip: '192.168.1.1' },
  { id: 'al_004', timestamp: '2024-12-22T09:00:00Z', action: 'Verification completed', details: 'Method: PIN', ip: '192.168.1.1' },
  { id: 'al_005', timestamp: '2024-12-21T11:30:00Z', action: 'Settings updated', details: 'Verification schedule changed to daily', ip: '192.168.1.1' },
  { id: 'al_006', timestamp: '2024-12-20T14:30:00Z', action: 'File downloaded', details: 'will-and-testament.pdf', ip: '192.168.1.1' },
];

export const mockAdminUsers: AdminUser[] = [
  { id: 'usr_001', email: 'john.doe@example.com', verified: true, storageUsed: 237, estimatedFees: 9.99, lastVerification: '2024-12-23T09:00:00Z', plan: 'professional', status: 'active', joinedAt: '2024-01-15' },
  { id: 'usr_002', email: 'alice.w@example.com', verified: true, storageUsed: 1024, estimatedFees: 14.99, lastVerification: '2024-12-22T08:00:00Z', plan: 'enterprise', status: 'active', joinedAt: '2023-11-20' },
  { id: 'usr_003', email: 'bob.m@example.com', verified: false, storageUsed: 50, estimatedFees: 4.99, lastVerification: '2024-12-10T10:00:00Z', plan: 'starter', status: 'past_due', joinedAt: '2024-06-01' },
  { id: 'usr_004', email: 'carol.t@example.com', verified: true, storageUsed: 500, estimatedFees: 9.99, lastVerification: '2024-12-20T15:00:00Z', plan: 'professional', status: 'suspended', joinedAt: '2024-03-10' },
  { id: 'usr_005', email: 'david.k@example.com', verified: true, storageUsed: 100, estimatedFees: 4.99, lastVerification: '2024-12-23T07:00:00Z', plan: 'starter', status: 'active', joinedAt: '2024-08-25' },
];

// Simulated API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// API Functions
export const api = {
  // Auth
  async login(email: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> {
    await delay(800);
    if (email === 'demo@example.com' && password === 'password') {
      return { success: true, user: mockUser };
    }
    return { success: false, error: 'Invalid email or password' };
  },

  async signup(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    await delay(1000);
    return { success: true };
  },

  async verifyEmail(code: string): Promise<{ success: boolean; error?: string }> {
    await delay(600);
    if (code === '123456') {
      return { success: true };
    }
    return { success: false, error: 'Invalid verification code' };
  },

  async resetPassword(email: string): Promise<{ success: boolean }> {
    await delay(800);
    return { success: true };
  },

  async setPin(pin: string): Promise<{ success: boolean }> {
    await delay(500);
    return { success: true };
  },

  async enablePasskey(): Promise<{ success: boolean }> {
    await delay(1000);
    return { success: true };
  },

  // User
  async getUser(): Promise<User> {
    await delay(300);
    return mockUser;
  },

  async updateProfile(data: Partial<User>): Promise<{ success: boolean }> {
    await delay(500);
    return { success: true };
  },

  // Files
  async getFiles(): Promise<File[]> {
    await delay(400);
    return mockFiles;
  },

  async uploadFile(file: globalThis.File): Promise<{ success: boolean; file?: File }> {
    await delay(2000);
    const newFile: File = {
      id: `file_${Date.now()}`,
      name: file.name,
      size: file.size,
      type: file.type,
      uploadedAt: new Date().toISOString(),
      tags: [],
      includeInEmergency: true,
      encrypted: true,
    };
    return { success: true, file: newFile };
  },

  async deleteFile(id: string): Promise<{ success: boolean }> {
    await delay(500);
    return { success: true };
  },

  async updateFile(id: string, data: Partial<File>): Promise<{ success: boolean }> {
    await delay(400);
    return { success: true };
  },

  // Emergency Contacts
  async getEmergencyContacts(): Promise<EmergencyContact[]> {
    await delay(300);
    return mockEmergencyContacts;
  },

  async addEmergencyContact(contact: Omit<EmergencyContact, 'id' | 'verified' | 'addedAt'>): Promise<{ success: boolean; contact?: EmergencyContact }> {
    await delay(600);
    const newContact: EmergencyContact = {
      id: `ec_${Date.now()}`,
      ...contact,
      verified: false,
      addedAt: new Date().toISOString(),
    };
    return { success: true, contact: newContact };
  },

  async resendVerification(contactId: string): Promise<{ success: boolean }> {
    await delay(500);
    return { success: true };
  },

  async removeEmergencyContact(id: string): Promise<{ success: boolean }> {
    await delay(400);
    return { success: true };
  },

  // Verification
  async getVerificationHistory(): Promise<VerificationHistory[]> {
    await delay(300);
    return mockVerificationHistory;
  },

  async verifyWithPin(pin: string): Promise<{ success: boolean; error?: string }> {
    await delay(800);
    if (pin === '1234') {
      return { success: true };
    }
    return { success: false, error: 'Invalid PIN' };
  },

  async verifyWithPasskey(): Promise<{ success: boolean }> {
    await delay(1200);
    return { success: true };
  },

  // Emergency
  async getEmergencyTriggers(): Promise<EmergencyTrigger[]> {
    await delay(300);
    return mockEmergencyTriggers;
  },

  async sendTestEmergency(): Promise<{ success: boolean }> {
    await delay(1500);
    return { success: true };
  },

  // Billing
  async getInvoices(): Promise<Invoice[]> {
    await delay(300);
    return mockInvoices;
  },

  async updatePaymentMethod(): Promise<{ success: boolean }> {
    await delay(800);
    return { success: true };
  },

  // Activity
  async getActivityLogs(): Promise<ActivityLog[]> {
    await delay(400);
    return mockActivityLogs;
  },

  async exportActivityLogs(): Promise<string> {
    await delay(600);
    const csv = mockActivityLogs.map(log => 
      `${log.timestamp},${log.action},"${log.details}",${log.ip || ''}`
    ).join('\n');
    return `Timestamp,Action,Details,IP\n${csv}`;
  },

  // Admin
  async getAdminUsers(): Promise<AdminUser[]> {
    await delay(500);
    return mockAdminUsers;
  },

  async getAdminStats(): Promise<{
    totalUsers: number;
    verifiedUsers: number;
    totalStorage: number;
    revenue: number;
    overdueVerifications: number;
    emergencyTriggers: number;
  }> {
    await delay(400);
    return {
      totalUsers: 1247,
      verifiedUsers: 1089,
      totalStorage: 45678,
      revenue: 12450.50,
      overdueVerifications: 23,
      emergencyTriggers: 5,
    };
  },

  async suspendUser(userId: string): Promise<{ success: boolean }> {
    await delay(500);
    return { success: true };
  },

  async restoreUser(userId: string): Promise<{ success: boolean }> {
    await delay(500);
    return { success: true };
  },
};

// Helper functions
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getTimeUntil(dateString: string): string {
  const now = new Date();
  const target = new Date(dateString);
  const diff = target.getTime() - now.getTime();
  
  if (diff < 0) return 'Overdue';
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''}`;
  }
  
  return `${hours}h ${minutes}m`;
}
