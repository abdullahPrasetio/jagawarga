import { db, sql } from './db/client';
import {
  announcements,
  campaigns,
  communities,
  houses,
  inviteCodes,
  invoices,
  memberships,
  users,
} from './db/schema';

const PASSWORD = 'Rahasia123!';

type SeedUser = {
  phone: string;
  name: string;
  role: 'admin' | 'pengurus' | 'bendahara' | 'satpam' | 'warga';
  house?: string;
  head?: boolean;
  platformAdmin?: boolean;
  interests?: string[];
};

const seedUsers: SeedUser[] = [
  { phone: '081100000001', name: 'Admin Jaga', role: 'admin', platformAdmin: true },
  { phone: '081100000002', name: 'Sari Wulandari', role: 'pengurus', house: 'A-01', head: true, interests: ['Berkebun', 'Musik'] },
  { phone: '081100000003', name: 'Dewi Lestari', role: 'bendahara', house: 'A-02', head: true, interests: ['Musik'] },
  { phone: '081100000004', name: 'Joko Prasetyo', role: 'satpam' },
  { phone: '081100000005', name: 'Budi Santoso', role: 'warga', house: 'A-03', head: true, interests: ['Futsal', 'Berkebun'] },
  { phone: '081100000006', name: 'Rina Santoso', role: 'warga', house: 'A-03', interests: ['Musik'] },
  { phone: '081100000007', name: 'Agus Setiawan', role: 'warga', house: 'A-04', head: true, interests: ['Futsal'] },
  { phone: '081100000008', name: 'Sri Wahyuni', role: 'warga', house: 'A-05', head: true, interests: ['Memasak'] },
];

const blocks = ['A', 'B'];

export async function seedDemo(): Promise<void> {
  const [{ count }] = await sql<{ count: number }[]>`
    select count(*)::int as count from communities
  `;

  if (count > 0) {
    console.log('seed skipped: communities already exist');
    return;
  }

  const [community] = await db
    .insert(communities)
    .values({ name: 'Kampung Jaga Demo', slug: 'demo', address: 'Jl. Melati Raya No. 1, Bandung' })
    .returning();

  if (!community) throw new Error('gagal membuat komunitas');

  const occupiedCodes = new Set(seedUsers.map((user) => user.house).filter(Boolean));

  const houseRows: Array<{ id: string; code: string }> = [];
  for (const block of blocks) {
    for (let number = 1; number <= 6; number += 1) {
      const code = `${block}-${String(number).padStart(2, '0')}`;
      const [house] = await db
        .insert(houses)
        .values({
          communityId: community.id,
          block,
          number: String(number).padStart(2, '0'),
          label: `Blok ${block} No. ${number}`,
          isOccupied: occupiedCodes.has(code),
        })
        .returning({ id: houses.id });
      if (house) houseRows.push({ id: house.id, code });
    }
  }

  const passwordHash = await Bun.password.hash(PASSWORD, 'argon2id');
  const userIds = new Map<string, string>();

  for (const seedUser of seedUsers) {
    const [user] = await db
      .insert(users)
      .values({
        phone: seedUser.phone,
        name: seedUser.name,
        passwordHash,
        interests: seedUser.interests ?? [],
        isPlatformAdmin: seedUser.platformAdmin ?? false,
      })
      .returning({ id: users.id });

    if (!user) throw new Error(`gagal membuat user ${seedUser.phone}`);
    userIds.set(seedUser.phone, user.id);

    const house = seedUser.house ? houseRows.find((row) => row.code === seedUser.house) : undefined;

    await db.insert(memberships).values({
      communityId: community.id,
      userId: user.id,
      houseId: house?.id ?? null,
      role: seedUser.role,
      isHouseholdHead: seedUser.head ?? false,
    });
  }

  const pengurusId = userIds.get('081100000002')!;

  for (let index = 1; index <= 3; index += 1) {
    await db.insert(inviteCodes).values({
      communityId: community.id,
      code: `DEMO-WARGA-${index}`,
      kind: 'staff',
      role: 'warga',
      createdBy: pengurusId,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
  }

  await db.insert(announcements).values({
    communityId: community.id,
    authorId: pengurusId,
    title: 'Kerja bakti Minggu pagi',
    body: 'Kerja bakti pukul 07.00 di lapangan blok A. Mohon membawa alat kebersihan. Konsumsi disediakan.',
    category: 'kegiatan',
    isPinned: true,
    publishedAt: new Date(),
  });

  await db.insert(campaigns).values({
    communityId: community.id,
    title: 'Perbaikan lampu jalan blok B',
    description: 'Penggalangan dana untuk 8 titik lampu jalan blok B yang mati. Target Rp 4.000.000.',
    targetAmount: 4_000_000,
    deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    createdBy: pengurusId,
  });

  const period = new Date().toISOString().slice(0, 7);
  const periodLabel = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(
    new Date(`${period}-01T00:00:00Z`),
  );
  const dueDate = `${period}-28`;

  const occupiedHouses = new Set(seedUsers.map((user) => user.house).filter(Boolean));

  for (const code of occupiedHouses) {
    const house = houseRows.find((row) => row.code === code);
    if (!house) continue;

    await db.insert(invoices).values({
      communityId: community.id,
      houseId: house.id,
      period,
      title: `Iuran ${periodLabel}`,
      amount: 150_000,
      dueDate,
    });
  }

  console.log(
    `seeded: community=${community.slug} houses=${houseRows.length} users=${seedUsers.length} invites=3`,
  );
  console.log(`akun demo (password ${PASSWORD}):`);
  for (const seedUser of seedUsers) {
    console.log(`  ${seedUser.phone}  ${seedUser.role.padEnd(9)} ${seedUser.name}`);
  }
}
