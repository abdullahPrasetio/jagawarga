export type SseWriter = {
  writeSSE(message: { event?: string; data: string; id?: string }): Promise<void>;
};

type Entry = { id: string; event: string; data: string };

const rooms = new Map<string, Map<string, SseWriter>>();
const history = new Map<string, Entry[]>();
const HISTORY_LIMIT = 100;

let sequence = 0;

export function registerClient(communityId: string, clientId: string, writer: SseWriter): () => void {
  let room = rooms.get(communityId);
  if (!room) {
    room = new Map();
    rooms.set(communityId, room);
  }
  room.set(clientId, writer);

  return () => {
    room?.delete(clientId);
    if (room && room.size === 0) rooms.delete(communityId);
  };
}

export function publish(communityId: string, event: string, data: unknown): void {
  sequence += 1;
  const entry: Entry = { id: String(sequence), event, data: JSON.stringify(data) };

  const entries = history.get(communityId) ?? [];
  entries.push(entry);
  if (entries.length > HISTORY_LIMIT) entries.shift();
  history.set(communityId, entries);

  const room = rooms.get(communityId);
  if (!room) return;

  for (const [clientId, writer] of room) {
    writer.writeSSE({ event, data: entry.data, id: entry.id }).catch(() => {
      room.delete(clientId);
    });
  }
}

/** Event yang dikirim setelah `lastEventId` (untuk reconnect). */
export function replay(communityId: string, lastEventId: string | undefined): Entry[] {
  if (!lastEventId) return [];
  const entries = history.get(communityId) ?? [];
  const last = Number(lastEventId);
  if (!Number.isFinite(last)) return [];
  return entries.filter((entry) => Number(entry.id) > last);
}
