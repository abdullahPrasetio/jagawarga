/**
 * Tipe API berasal langsung dari kontrak server (`import type` saja, tanpa
 * kode runtime). Perubahan bentuk response di server akan memecah build web.
 */
import type {
  AlertDto,
  AlertEventDto,
  AnnouncementDto,
  CampaignDto,
  CommunityAdminDto,
  DonationDto,
  DirectoryEntryDto,
  HouseDto,
  InvoiceDto,
  LedgerEntryDto,
  MediaDto,
  MemberDto,
  MeResponse,
  MembershipDto,
  Paginated,
  PaymentDto,
  Problem,
  Role,
  StatsDto,
  SummaryDto,
} from '../../../server/src/contracts';

export type {
  AlertDto,
  AlertEventDto,
  AnnouncementDto,
  CampaignDto,
  CommunityAdminDto,
  DonationDto,
  DirectoryEntryDto,
  HouseDto,
  InvoiceDto,
  LedgerEntryDto,
  MediaDto,
  MemberDto,
  MeResponse,
  MembershipDto,
  Paginated,
  PaymentDto,
  Problem,
  Role,
  StatsDto,
  SummaryDto,
};

export type LoginResponse = MeResponse & {
  accessToken: string;
  expiresIn: number;
};

export type NotificationDto = {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

export type CampaignDetail = CampaignDto & {
  donations: Array<{ id: string; donorName: string; amount: number; createdAt: string }>;
};

export type CommunityInfo = {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  memberCount: number;
  houseCount: number;
};
