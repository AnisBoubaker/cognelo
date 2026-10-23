import type { ActivityMessageDeletion, ActivityMessageDeletionMarker } from "./api";

export function mergeChatMessages<T extends { id: string; createdAt: string; deletedAt?: string | null }>(old: T[], incoming: T[], deletions: ActivityMessageDeletionMarker[] = []) {
  const deletedById = new Map(deletions.map((deletion) => [deletion.id, deletion.deletedAt]));
  const byId = new Map(old.map((message) => [message.id, message]));
  for (const message of incoming) {
    const previous = byId.get(message.id);
    // A response already in flight when deletion succeeds cannot restore the text.
    byId.set(message.id, previous?.deletedAt && !message.deletedAt
      ? { ...message, deletedAt: previous.deletedAt, canDelete: false } : message);
  }
  return [...byId.values()]
    .map((message) => deletedById.has(message.id) ? { ...message, deletedAt: deletedById.get(message.id)!, canDelete: false } : message)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export function applyChatDeletion<T extends { id: string; broadcastId?: string | null }>(messages: T[], deletion: ActivityMessageDeletion) {
  return messages.map((message) => (deletion.broadcastId
    ? message.broadcastId === deletion.broadcastId || message.id === deletion.broadcastId
    : message.id === deletion.messageId) ? { ...message, deletedAt: deletion.deletedAt, canDelete: false } : message);
}
