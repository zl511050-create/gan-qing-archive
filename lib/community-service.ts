import type { CommunityNote, CommunityReply, CommunityUser, LikeRecord, ModeKey } from "@/data/archive";
import { supabase } from "@/lib/supabase";

const KEYS = {
  session: "weiji-community-session",
  users: "weiji-community-users",
  notes: "weiji-community-notes",
  likes: "weiji-community-likes",
  likeCounts: "weiji-community-like-counts",
  replies: "weiji-community-replies",
} as const;

export interface CreateNoteInput {
  content: string;
  category: ModeKey;
  mood: string;
  nickname?: string;
  avatar?: string;
}

export interface CommunityDataService {
  getCurrentUser(): CommunityUser | null;
  register(username: string, avatarUrl?: string): Promise<CommunityUser>;
  updateAvatar(user: CommunityUser, avatarUrl: string): Promise<CommunityUser>;
  logout(): void;
  deactivate(user: CommunityUser): Promise<void>;
  listNotes(category: ModeKey): Promise<CommunityNote[]>;
  createNote(user: CommunityUser | null, input: CreateNoteInput): Promise<CommunityNote>;
  deleteNote(user: CommunityUser, noteId: string): Promise<void>;
  getLikeState(noteId: string, userId: string, initialCount: number): Promise<{ liked: boolean; count: number }>;
  toggleLike(noteId: string, userId: string, initialCount: number): Promise<{ liked: boolean; count: number }>;
  listReplies(noteId: string): Promise<CommunityReply[]>;
  addReply(user: CommunityUser, noteId: string, content: string): Promise<CommunityReply>;
}

function uuid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(value));
}

function toCommunityNote(row: Record<string, unknown>): CommunityNote {
  const likes = Number(row.likes ?? row.likes_count ?? 0) || 0;
  return {
    id: String(row.id ?? uuid()),
    user_id: String(row.user_id ?? row.id ?? uuid()),
    author_name: String(row.nickname ?? row.author_name ?? "匿名"),
    author_avatar: typeof row.avatar === "string" ? row.avatar : typeof row.author_avatar === "string" ? row.author_avatar : undefined,
    content: String(row.content ?? ""),
    category: (row.category as ModeKey) ?? "keep",
    mood: String(row.mood ?? "心事"),
    likes_count: likes,
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

class LocalCommunityService implements CommunityDataService {
  getCurrentUser() {
    return read<CommunityUser | null>(KEYS.session, null);
  }

  async register(username: string, avatarUrl?: string) {
    const users = read<CommunityUser[]>(KEYS.users, []);
    const cleanName = username.trim();
    const existing = users.find((item) => item.username.toLocaleLowerCase() === cleanName.toLocaleLowerCase());
    const user: CommunityUser = existing
      ? { ...existing, avatar_url: avatarUrl || existing.avatar_url }
      : { id: uuid(), username: cleanName, token: uuid(), avatar_url: avatarUrl, created_at: new Date().toISOString() };
    write(KEYS.users, existing ? users.map((item) => item.id === user.id ? user : item) : [...users, user]);
    write(KEYS.session, user);
    if (typeof document !== "undefined") document.cookie = `weiji_identity=${encodeURIComponent(user.token)}; path=/; max-age=31536000; SameSite=Lax`;
    return user;
  }

  async updateAvatar(user: CommunityUser, avatarUrl: string) {
    const updated = { ...user, avatar_url: avatarUrl };
    write(KEYS.users, read<CommunityUser[]>(KEYS.users, []).map((item) => item.id === user.id ? updated : item));
    write(KEYS.session, updated);
    write(KEYS.notes, read<CommunityNote[]>(KEYS.notes, []).map((note) => note.user_id === user.id ? { ...note, author_avatar: avatarUrl } : note));
    write(KEYS.replies, read<CommunityReply[]>(KEYS.replies, []).map((reply) => reply.user_id === user.id ? { ...reply, author_avatar: avatarUrl } : reply));
    return updated;
  }

  logout() {
    localStorage.removeItem(KEYS.session);
    if (typeof document !== "undefined") document.cookie = "weiji_identity=; path=/; max-age=0; SameSite=Lax";
  }

  async deactivate(user: CommunityUser) {
    write(KEYS.users, read<CommunityUser[]>(KEYS.users, []).filter((item) => item.id !== user.id));
    this.logout();
  }

  async listNotes(category: ModeKey) {
    return read<CommunityNote[]>(KEYS.notes, []).filter((note) => note.category === category);
  }

  async createNote(user: CommunityUser | null, input: CreateNoteInput) {
    const note: CommunityNote = {
      id: uuid(), user_id: user?.id ?? uuid(), author_name: input.nickname ?? user?.username ?? "匿名",
      author_avatar: input.avatar ?? user?.avatar_url, content: input.content.trim(),
      category: input.category, mood: input.mood, likes_count: 0, created_at: new Date().toISOString(),
    };
    write(KEYS.notes, [note, ...read<CommunityNote[]>(KEYS.notes, [])].slice(0, 300));
    return note;
  }

  async deleteNote(user: CommunityUser, noteId: string) {
    const notes = read<CommunityNote[]>(KEYS.notes, []);
    const note = notes.find((item) => item.id === noteId);
    if (!note || note.user_id !== user.id) throw new Error("你只能封存自己写下的心事");
    write(KEYS.notes, notes.filter((item) => item.id !== noteId));
    write(KEYS.likes, read<LikeRecord[]>(KEYS.likes, []).filter((item) => item.note_id !== noteId));
    write(KEYS.replies, read<CommunityReply[]>(KEYS.replies, []).filter((item) => item.note_id !== noteId));
  }

  async getLikeState(noteId: string, userId: string, initialCount: number) {
    const liked = read<LikeRecord[]>(KEYS.likes, []).some((item) => item.note_id === noteId && item.user_id === userId);
    const counts = read<Record<string, number>>(KEYS.likeCounts, {});
    return { liked, count: counts[noteId] ?? initialCount };
  }

  async toggleLike(noteId: string, userId: string, initialCount: number) {
    const likes = read<LikeRecord[]>(KEYS.likes, []);
    const index = likes.findIndex((item) => item.note_id === noteId && item.user_id === userId);
    const counts = read<Record<string, number>>(KEYS.likeCounts, {});
    let count = counts[noteId] ?? initialCount;
    let liked: boolean;
    if (index >= 0) {
      likes.splice(index, 1);
      count = Math.max(0, count - 1);
      liked = false;
    } else {
      likes.push({ note_id: noteId, user_id: userId });
      count += 1;
      liked = true;
    }
    counts[noteId] = count;
    write(KEYS.likes, likes);
    write(KEYS.likeCounts, counts);
    const notes = read<CommunityNote[]>(KEYS.notes, []);
    const noteIndex = notes.findIndex((note) => note.id === noteId);
    if (noteIndex >= 0) {
      notes[noteIndex] = { ...notes[noteIndex], likes_count: count };
      write(KEYS.notes, notes);
    }
    return { liked, count };
  }

  async listReplies(noteId: string) {
    return read<CommunityReply[]>(KEYS.replies, []).filter((reply) => reply.note_id === noteId);
  }

  async addReply(user: CommunityUser, noteId: string, content: string) {
    const reply: CommunityReply = {
      id: uuid(), note_id: noteId, user_id: user.id, author_name: user.username, author_avatar: user.avatar_url,
      content: content.trim(), created_at: new Date().toISOString(),
    };
    write(KEYS.replies, [...read<CommunityReply[]>(KEYS.replies, []), reply].slice(-600));
    return reply;
  }
}

class SupabaseCommunityService extends LocalCommunityService {
  override async listNotes(category: ModeKey) {
    try {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("category", category)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => toCommunityNote(row as Record<string, unknown>));
    } catch {
      return super.listNotes(category);
    }
  }

  override async createNote(user: CommunityUser | null, input: CreateNoteInput) {
    const note = {
      id: uuid(),
      nickname: input.nickname ?? user?.username ?? "匿名",
      avatar: input.avatar ?? user?.avatar_url ?? "",
      category: input.category,
      mood: input.mood,
      content: input.content.trim(),
      likes: 0,
      created_at: new Date().toISOString(),
    };
    try {
      const { data, error } = await supabase.from("posts").insert(note).select().single();
      if (error) throw error;
      return toCommunityNote((data ?? note) as Record<string, unknown>);
    } catch {
      return super.createNote(user, input);
    }
  }

  override async getLikeState(noteId: string, userId: string, initialCount: number) {
    if (noteId.startsWith("seed-")) return super.getLikeState(noteId, userId, initialCount);
    try {
      const { data, error } = await supabase.from("posts").select("likes").eq("id", noteId).single();
      if (error) throw error;
      const count = Number(data?.likes ?? initialCount ?? 0);
      return { liked: false, count };
    } catch {
      return super.getLikeState(noteId, userId, initialCount);
    }
  }

  override async toggleLike(noteId: string, userId: string, initialCount: number) {
    if (noteId.startsWith("seed-")) return super.toggleLike(noteId, userId, initialCount);
    try {
      const { data: currentData, error: currentError } = await supabase.from("posts").select("likes").eq("id", noteId).single();
      if (currentError) throw currentError;
      const count = Math.max(0, Number(currentData?.likes ?? initialCount ?? 0) + 1);
      const { data, error } = await supabase.from("posts").update({ likes: count }).eq("id", noteId).select().single();
      if (error) throw error;
      return { liked: true, count: Number(data?.likes ?? count) };
    } catch {
      return super.toggleLike(noteId, userId, initialCount);
    }
  }
}

export const communityService: CommunityDataService = supabase
  ? new SupabaseCommunityService()
  : new LocalCommunityService();
