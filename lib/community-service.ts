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
  isAnonymous?: boolean;
}

export interface CommunityDataService {
  getCurrentUser(): CommunityUser | null;
  restoreSession(): Promise<CommunityUser | null>;
  register(username: string, password: string, avatarUrl?: string): Promise<CommunityUser>;
  login(username: string, password: string): Promise<CommunityUser>;
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

type StoredCommunityUser = CommunityUser & { password_hash: string };

async function hashPassword(username: string, password: string) {
  const bytes = new TextEncoder().encode(`weiji:${username.trim().toLocaleLowerCase()}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function validateCredentials(username: string, password: string) {
  const cleanName = username.trim();
  if (!cleanName || cleanName.length > 24) throw new Error("昵称需为 1—24 个字符");
  if (!/^\d{4}$/.test(password)) throw new Error("密码必须是 4 位数字");
  return cleanName;
}

function createSession(user: Omit<CommunityUser, "token"> & Partial<Pick<CommunityUser, "token">>): CommunityUser {
  const session = { ...user, token: user.token || uuid() } as CommunityUser;
  write(KEYS.session, session);
  if (typeof document !== "undefined") document.cookie = `weiji_identity=${encodeURIComponent(session.token)}; path=/; max-age=315360000; SameSite=Lax`;
  return session;
}

function toCommunityNote(row: Record<string, unknown>): CommunityNote {
  const likes = Number(row.likes ?? row.likes_count ?? 0) || 0;
  return {
    id: String(row.id ?? uuid()),
    user_id: String(row.user_id ?? row.id ?? uuid()),
    author_name: String(row.nickname ?? row.author_name ?? "匿名"),
    author_avatar: typeof row.avatar === "string" ? row.avatar : typeof row.author_avatar === "string" ? row.author_avatar : undefined,
    is_anonymous: Boolean(row.is_anonymous),
    content: String(row.content ?? ""),
    category: (row.category as ModeKey) ?? "keep",
    mood: String(row.mood ?? "心事"),
    likes_count: likes,
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

class LocalCommunityService implements CommunityDataService {
  getCurrentUser() {
    const session = read<CommunityUser | null>(KEYS.session, null);
    if (!session || !session.id || !session.username || !session.token) return null;
    return session;
  }

  async restoreSession() {
    return this.getCurrentUser();
  }

  async register(username: string, password: string, avatarUrl?: string) {
    const users = read<StoredCommunityUser[]>(KEYS.users, []);
    const cleanName = validateCredentials(username, password);
    const existing = users.find((item) => item.username.toLocaleLowerCase() === cleanName.toLocaleLowerCase());
    if (existing) throw new Error("这个昵称已经被注册，请直接登录或换一个昵称");
    const stored: StoredCommunityUser = {
      id: uuid(), username: cleanName, token: "", created_at: new Date().toISOString(),
      password_hash: await hashPassword(cleanName, password),
      avatar_url: avatarUrl,
    };
    write(KEYS.users, [...users, stored]);
    const { password_hash: _passwordHash, token: _token, ...user } = stored;
    void _passwordHash; void _token;
    return createSession(user);
  }

  async login(username: string, password: string) {
    const cleanName = validateCredentials(username, password);
    const users = read<StoredCommunityUser[]>(KEYS.users, []);
    const existing = users.find((item) => item.username.toLocaleLowerCase() === cleanName.toLocaleLowerCase());
    if (!existing || !existing.password_hash || existing.password_hash !== await hashPassword(cleanName, password)) {
      throw new Error("昵称或密码不正确");
    }
    const { password_hash: _passwordHash, token: _token, ...user } = existing;
    void _passwordHash; void _token;
    return createSession(user);
  }

  async updateAvatar(user: CommunityUser, avatarUrl: string) {
    const updated = { ...user, avatar_url: avatarUrl };
    write(KEYS.users, read<StoredCommunityUser[]>(KEYS.users, []).map((item) => item.id === user.id ? { ...item, avatar_url: avatarUrl } : item));
    write(KEYS.session, updated);
    return updated;
  }

  logout() {
    localStorage.removeItem(KEYS.session);
    localStorage.removeItem("weiji-identity-invited");
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
      is_anonymous: Boolean(input.isAnonymous), category: input.category, mood: input.mood, likes_count: 0, created_at: new Date().toISOString(),
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
  constructor(private readonly client: NonNullable<typeof supabase>) {
    super();
  }

  override async restoreSession() {
    const session = await super.restoreSession();
    if (!session) return null;
    try {
      const { data, error } = await this.client.rpc("restore_community_session", {
        p_user_id: session.id,
        p_session_token: session.token,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        this.logout();
        return null;
      }
      const restored: CommunityUser = {
        id: String(row.id),
        username: String(row.username),
        token: session.token,
        avatar_url: row.avatar_url || undefined,
        created_at: String(row.created_at),
      };
      write(KEYS.session, restored);
      return restored;
    } catch {
      // Keep the last valid local session while offline; it will be checked again
      // the next time the page is opened with a working connection.
      return session;
    }
  }

  override async register(username: string, password: string, avatarUrl?: string) {
    const cleanName = validateCredentials(username, password);
    const { data, error } = await this.client.rpc("register_community_user", {
      p_username: cleanName,
      p_password: password,
      p_avatar_url: avatarUrl ?? null,
    });
    if (error) {
      if (error.message.includes("nickname_taken")) throw new Error("这个昵称已经被注册，请直接登录或换一个昵称");
      if (error.message.includes("invalid_password")) throw new Error("密码必须是 4 位数字");
      throw new Error("注册服务暂不可用，请确认已执行最新的 Supabase 数据库脚本");
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("注册失败，请稍后再试");
    return createSession({ id: String(row.id), username: String(row.username), token: String(row.session_token || ""), avatar_url: row.avatar_url || undefined, created_at: String(row.created_at) });
  }

  override async login(username: string, password: string) {
    const cleanName = validateCredentials(username, password);
    const { data, error } = await this.client.rpc("login_community_user", {
      p_username: cleanName,
      p_password: password,
    });
    if (error) throw new Error("登录服务暂不可用，请确认已执行最新的 Supabase 数据库脚本");
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("昵称或密码不正确");
    return createSession({ id: String(row.id), username: String(row.username), token: String(row.session_token || ""), avatar_url: row.avatar_url || undefined, created_at: String(row.created_at) });
  }

  override async updateAvatar(user: CommunityUser, avatarUrl: string) {
    const { data, error } = await this.client.rpc("update_community_user_avatar", {
      p_user_id: user.id,
      p_session_token: user.token,
      p_avatar_url: avatarUrl,
    });
    if (error) {
      if (error.message.includes("invalid_session")) throw new Error("登录凭据已更新，请退出后重新登录再设置头像");
      throw new Error("头像暂时无法保存到云端，请稍后再试");
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error("头像保存失败，请稍后再试");
    const updated = { ...user, username: String(row.username), avatar_url: String(row.avatar_url) };
    write(KEYS.session, updated);
    return updated;
  }

  override async listNotes(category: ModeKey) {
    try {
      const { data, error } = await this.client
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
      user_id: user?.id ?? null,
      is_anonymous: Boolean(input.isAnonymous),
      category: input.category,
      mood: input.mood,
      content: input.content.trim(),
      likes: 0,
      created_at: new Date().toISOString(),
    };
    const { data, error } = await this.client.from("posts").insert(note).select().single();
    if (error) throw new Error(`帖子未能写入云端：${error.message}`);
    return toCommunityNote((data ?? note) as Record<string, unknown>);
  }

  override async getLikeState(noteId: string, userId: string, initialCount: number) {
    if (noteId.startsWith("seed-")) return super.getLikeState(noteId, userId, initialCount);
    try {
      const { data, error } = await this.client.from("posts").select("likes").eq("id", noteId).single();
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
      const { data: currentData, error: currentError } = await this.client.from("posts").select("likes").eq("id", noteId).single();
      if (currentError) throw currentError;
      const count = Math.max(0, Number(currentData?.likes ?? initialCount ?? 0) + 1);
      const { data, error } = await this.client.from("posts").update({ likes: count }).eq("id", noteId).select().single();
      if (error) throw error;
      return { liked: true, count: Number(data?.likes ?? count) };
    } catch {
      return super.toggleLike(noteId, userId, initialCount);
    }
  }
}

export const communityService: CommunityDataService = supabase
  ? new SupabaseCommunityService(supabase)
  : new LocalCommunityService();
