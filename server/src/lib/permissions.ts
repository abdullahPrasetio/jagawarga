import type { Auth, Role } from './jwt';
import { ApiError } from './problem';

export type Capability =
  | 'community.read'
  | 'houses.read'
  | 'houses.import'
  | 'members.read'
  | 'members.manage'
  | 'household.read'
  | 'household.invite'
  | 'invites.staff'
  | 'invites.revoke'
  | 'directory.read'
  | 'profile.update'
  | 'alert.create'
  | 'alerts.read'
  | 'alert.acknowledge'
  | 'alert.resolve'
  | 'alert.cancel'
  | 'events.stream'
  | 'announcements.read'
  | 'announcements.write'
  | 'media.upload'
  | 'media.read'
  | 'invoices.read'
  | 'invoices.create'
  | 'payments.report'
  | 'payments.review'
  | 'ledger.read'
  | 'ledger.write'
  | 'campaigns.read'
  | 'campaigns.write'
  | 'donations.report'
  | 'donations.review';

const all: Role[] = ['admin', 'pengurus', 'bendahara', 'satpam', 'warga'];
const staff: Role[] = ['admin', 'pengurus'];
const finance: Role[] = ['admin', 'pengurus', 'bendahara'];
const ops: Role[] = ['admin', 'pengurus', 'satpam'];
const financeOrWarga: Role[] = ['admin', 'pengurus', 'bendahara', 'warga'];

/**
 * Sumber kebenaran izin (Matriks izin di plan). Bersyarat pemilik (`head`,
 * rumah sendiri, pemicu) sengaja TIDAK diwakili di sini: setiap handler wajib
 * memanggil `assertOwnHouse`/cek `isHouseholdHead`/cek `triggeredBy`, karena
 * syarat itu berlaku juga untuk `admin`.
 */
export const MATRIX: Record<Capability, Role[]> = {
  'community.read': all,
  'houses.read': staff,
  'houses.import': staff,
  'members.read': staff,
  'members.manage': staff,
  'household.read': all,
  'household.invite': all,
  'invites.staff': staff,
  'invites.revoke': all,
  'directory.read': all,
  'profile.update': all,
  'alert.create': all,
  'alerts.read': all,
  'alert.acknowledge': ops,
  'alert.resolve': ops,
  'alert.cancel': all,
  'events.stream': all,
  'announcements.read': all,
  'announcements.write': staff,
  'media.upload': all,
  'media.read': all,
  'invoices.read': financeOrWarga,
  'invoices.create': finance,
  'payments.report': financeOrWarga,
  'payments.review': finance,
  'ledger.read': financeOrWarga,
  'ledger.write': finance,
  'campaigns.read': all,
  'campaigns.write': finance,
  'donations.report': financeOrWarga,
  'donations.review': finance,
};

export function can(auth: Auth, capability: Capability): boolean {
  if (!auth.communityId || !auth.role) return false;
  if (auth.role === 'admin') return true;
  return MATRIX[capability].includes(auth.role);
}

export function ensure(auth: Auth, capability: Capability): void {
  if (!can(auth, capability)) {
    throw new ApiError(403, 'forbidden', `Akses ditolak: ${capability}`);
  }
}

export function assertOwnHouse(auth: Auth, houseId: string | null): void {
  if (!houseId || auth.houseId !== houseId) {
    throw new ApiError(403, 'forbidden', 'Hanya untuk rumah Anda sendiri');
  }
}