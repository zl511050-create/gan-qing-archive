"use client";

import { KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import NextImage from "next/image";
import { CinemaBackground } from "@/components/cinema-background";
import { CommunityComposer } from "@/components/community-composer";
import { IdentityModal } from "@/components/identity-modal";
import { CinemaIntro, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { StoryCard } from "@/components/story-card";
import { KeepExperience, ReleaseExperience, WaitExperience } from "@/components/theme-experiences";
import { modes, stories, type CommunityNote, type CommunityUser, type ModeKey, type SavedRecord, type Story } from "@/data/archive";
import { communityService } from "@/lib/community-service";
import { prepareAvatar } from "@/lib/avatar";

const tabDetails: Array<{ mode: ModeKey; name: string; copy: string }> = [
  { mode: "keep", name: "挽留", copy: "我还在试着靠近" },
  { mode: "release", name: "放下", copy: "我在练习告别" },
  { mode: "wait", name: "等待", copy: "这一次，等你走向我" },
];

type SortMode = "latest" | "hottest";

const moodNames: Record<ModeKey, string> = { keep: "挽留 · 此刻", release: "放下 · 此刻", wait: "等待 · 此刻" };

function relativeTime(date: string) {
  const elapsed = Math.max(0, Date.now() - new Date(date).getTime());
  if (elapsed < 60_000) return "刚刚";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} 分钟前`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)} 小时前`;
  return `${Math.floor(elapsed / 86_400_000)} 天前`;
}

function noteToStory(note: CommunityNote): Story {
  return {
    id: note.id, userId: note.user_id, authorName: note.author_name, authorAvatar: note.author_avatar, category: note.category,
    createdAt: note.created_at, mood: note.mood, time: relativeTime(note.created_at), empathy: 0,
    likes: note.likes_count, text: note.content, replies: [], quick: ["我听见了", "抱抱此刻的你"],
  };
}

export function ArchiveApp() {
  const [selectedMode, setSelectedMode] = useState<ModeKey>("keep");
  const [displayMode, setDisplayMode] = useState<ModeKey>("keep");
  const [switching, setSwitching] = useState(false);
  const [recordCount, setRecordCount] = useState(0);
  const [communityNotes, setCommunityNotes] = useState<Story[]>([]);
  const [currentUser, setCurrentUser] = useState<CommunityUser | null>(null);
  const [identityOpen, setIdentityOpen] = useState(false);
  const [identityRequired, setIdentityRequired] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("latest");
  const [likeOverrides, setLikeOverrides] = useState<Record<string, number>>({});
  const [listSwitching, setListSwitching] = useState(false);
  const [moreRead, setMoreRead] = useState(false);
  const [toast, setToast] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const switchTimer = useRef<number | null>(null);
  const toastTimer = useRef<number | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setToastVisible(true);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastVisible(false), 2400);
  }, []);

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      try {
        const records = JSON.parse(localStorage.getItem("weiji-records") || "[]");
        setRecordCount(Array.isArray(records) ? records.length : 0);
      } catch {
        setRecordCount(0);
      }
      const session = communityService.getCurrentUser();
      setCurrentUser(session);
      if (!session && localStorage.getItem("weiji-identity-invited") !== "yes") {
        setIdentityOpen(true);
        localStorage.setItem("weiji-identity-invited", "yes");
      }
    }, 0);
    Object.values(modes).forEach((mode) => {
      const image = new Image();
      image.src = mode.background;
    });
    return () => {
      if (switchTimer.current) window.clearTimeout(switchTimer.current);
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      window.clearTimeout(hydrationTimer);
    };
  }, []);

  useEffect(() => {
    document.body.dataset.themeMode = displayMode;
  }, [displayMode]);

  useEffect(() => {
    let active = true;
    communityService.listNotes(displayMode).then((notes) => {
      if (active) setCommunityNotes(notes.map(noteToStory));
    });
    return () => { active = false; };
  }, [displayMode]);

  const changeMode = (mode: ModeKey) => {
    if (mode === selectedMode) return;
    setSelectedMode(mode);
    setSwitching(true);
    if (switchTimer.current) window.clearTimeout(switchTimer.current);
    switchTimer.current = window.setTimeout(() => {
      setDisplayMode(mode);
      setMoreRead(false);
      window.requestAnimationFrame(() => setSwitching(false));
    }, 210);
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % tabDetails.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index - 1 + tabDetails.length) % tabDetails.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabDetails.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const next = tabDetails[nextIndex];
    tabRefs.current[nextIndex]?.focus();
    changeMode(next.mode);
  };

  const saveRecord = (record: SavedRecord, story?: Story) => {
    let records: SavedRecord[] = [];
    try {
      const saved = JSON.parse(localStorage.getItem("weiji-records") || "[]");
      if (Array.isArray(saved)) records = saved;
    } catch {
      records = [];
    }
    const next = [record, ...records].slice(0, 30);
    localStorage.setItem("weiji-records", JSON.stringify(next));
    setRecordCount(next.length);
    void story;
  };

  const requireIdentity = () => {
    setIdentityRequired(true);
    setIdentityOpen(true);
  };

  const register = async (username: string, avatarUrl?: string) => {
    const user = await communityService.register(username, avatarUrl);
    setCurrentUser(user);
    setIdentityOpen(false);
    setIdentityRequired(false);
    showToast(`欢迎回来，${user.username}。`);
  };

  const updateAvatar = async (file: File) => {
    if (!currentUser) return requireIdentity();
    try {
      const avatarUrl = await prepareAvatar(file);
      const user = await communityService.updateAvatar(currentUser, avatarUrl);
      setCurrentUser(user);
      setCommunityNotes((current) => current.map((story) => story.userId === user.id ? { ...story, authorAvatar: avatarUrl } : story));
      showToast("新头像已经替你保存好了。 ");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "头像保存失败，请换一张图片试试。 ");
    }
  };

  const publish = async (payload: { nickname: string; mood: string; avatar: string; content: string }) => {
    const note = await communityService.createNote(currentUser, {
      content: payload.content,
      category: displayMode,
      mood: payload.mood,
      nickname: payload.nickname,
      avatar: payload.avatar,
    });
    setCommunityNotes((current) => [noteToStory(note), ...current]);
    setRecordCount((count) => count + 1);
    setSortMode("latest");
    showToast("这句话已经被放进相似的人海。\u00a0🫧");
  };

  const changeSort = (next: SortMode) => {
    if (next === sortMode) return;
    setListSwitching(true);
    window.setTimeout(() => {
      setSortMode(next);
      window.requestAnimationFrame(() => setListSwitching(false));
    }, 170);
  };

  const logout = () => {
    communityService.logout();
    setCurrentUser(null);
    showToast("已经退出，写下的心事仍被妥善保存。 ");
  };

  const deactivate = async () => {
    if (!currentUser || !window.confirm("确定注销当前档案吗？已发布内容不会被自动删除。")) return;
    await communityService.deactivate(currentUser);
    setCurrentUser(null);
    setIdentityRequired(false);
    setIdentityOpen(true);
  };

  const mode = modes[displayMode];
  const seedStories = stories[displayMode].map((story, index) => ({
    ...story, id: `seed-${displayMode}-${index}`, category: displayMode,
    createdAt: `2026-01-${String(20 - index).padStart(2, "0")}T12:00:00.000Z`,
  }));
  const visibleStories = [...communityNotes, ...seedStories]
    .map((story) => story.id && likeOverrides[story.id] !== undefined ? { ...story, likes: likeOverrides[story.id] } : story)
    .sort((a, b) => sortMode === "hottest"
    ? b.likes - a.likes
    : new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());

  return (
    <div className="app-shell">
      <CinemaBackground src={mode.background} />
      <SiteHeader recordCount={recordCount} user={currentUser} onLogin={requireIdentity} onLogout={logout} onDeactivate={deactivate} onAvatarChange={updateAvatar} />
      <main id="top">
        <CinemaIntro />

        <nav className="state-switcher" role="tablist" aria-label="选择你此刻的状态">
          {tabDetails.map((tab, index) => {
            const selected = selectedMode === tab.mode;
            return (
              <button
                className={`state-tab${selected ? " active" : ""}`}
                role="tab"
                type="button"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                key={tab.mode}
                ref={(element) => { tabRefs.current[index] = element; }}
                onClick={() => changeMode(tab.mode)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
              >
                <span className="state-no">0{index + 1}</span>
                <span className="state-name">{tab.name}</span>
                <span className="state-copy">{tab.copy}</span>
              </button>
            );
          })}
        </nav>

        <section className={`workspace${switching ? " content-switching" : ""}`} id="archive">
          <article className="writing-panel">
            <div className="panel-topline"><span>{mode.label}</span><span>写给此刻</span></div>
            <div className="writing-heading">
              <div><p className="mode-kicker">{mode.kicker}</p><h2>{mode.title}</h2></div>
              <span className="large-number">{mode.number}</span>
            </div>
            <div className="mode-experience" aria-live="polite">
              {displayMode === "keep" && <KeepExperience showToast={showToast} />}
              {displayMode === "release" && <ReleaseExperience showToast={showToast} />}
              {displayMode === "wait" && <WaitExperience showToast={showToast} onSaved={saveRecord} />}
            </div>
          </article>

          <aside className="community-panel" aria-labelledby="communityTitle">
            <div className="community-head">
              <div><span className="live-dot" /><span>此刻有人也在写</span></div>
              <div className="community-title-row"><h2 id="communityTitle">陌生人的<br />未寄片段</h2><span className="bubble-cluster" aria-hidden="true">🫧</span></div>
              <p>{mode.community}</p>
              <figure className="community-art">
                <NextImage src="/assets/connected-bubbles-3d.jpg" alt="彼此连接的半透明珍珠气泡" fill sizes="(max-width: 860px) 100vw, 32vw" />
                <figcaption><span><b>128</b> 次共鸣</span><span><b>36</b> 个温柔回应</span><span className="now-writing"><i /> 7 人正在写</span></figcaption>
              </figure>
              <div className="wall-invitation"><span aria-hidden="true">↘</span><p>继续往下看。<br />每一句心事，都有属于自己的位置。</p></div>
            </div>
          </aside>
        </section>

        <section className={`story-wall${switching ? " content-switching" : ""}`} id="community" aria-labelledby="storyWallTitle">
          <header className="story-wall-head">
            <div><p>COMMUNITY ECHOES · 0{visibleStories.length}</p><h2 id="storyWallTitle">{mode.wallTitle.split("\n").map((line, index) => <span key={line}>{index > 0 && <br />}{line}</span>)}</h2></div>
            <p>左边、右边，都有人正在经历相似的时刻。<br />点开任意一格，留下一句温柔的回应。</p>
          </header>
          <CommunityComposer mode={displayMode} user={currentUser} onRequireIdentity={requireIdentity} onPublish={publish} />
          <div className="story-toolbar">
            <div role="tablist" aria-label="社区内容排序">
              <button role="tab" aria-selected={sortMode === "latest"} className={sortMode === "latest" ? "active" : ""} type="button" onClick={() => changeSort("latest")}><b>最新</b><span>LATEST</span></button>
              <button role="tab" aria-selected={sortMode === "hottest"} className={sortMode === "hottest" ? "active" : ""} type="button" onClick={() => changeSort("hottest")}><b>最热</b><span>HOTTEST</span></button>
            </div>
            <p>{visibleStories.length} 封未寄片段</p>
          </div>
          <div className={`story-list${listSwitching ? " list-switching" : ""}`} aria-live="polite">
            {visibleStories.map((story) => (
              <StoryCard
                story={story}
                currentUser={currentUser}
                justPosted={communityNotes[0]?.id === story.id}
                onRequireIdentity={requireIdentity}
                onDeleted={(id) => {
                  setCommunityNotes((current) => current.filter((item) => item.id !== id));
                  setRecordCount((count) => Math.max(0, count - 1));
                  showToast("这条心事已经封存。 ");
                }}
                onLikeChanged={(id, count) => {
                  setLikeOverrides((current) => ({ ...current, [id]: count }));
                  setCommunityNotes((current) => current.map((item) => item.id === id ? { ...item, likes: count } : item));
                }}
                key={`${story.id}-${currentUser?.id ?? "guest"}`}
              />
            ))}
          </div>
          <button className="more-button" type="button" disabled={moreRead} onClick={() => setMoreRead(true)}>
            {moreRead ? "这一刻，先读到这里" : <>再读一些 <span>↓</span></>}
          </button>
        </section>
        <SiteFooter />
      </main>
      <div className={`toast${toastVisible ? " show" : ""}`} role="status" aria-live="polite">{toast || "已经替你收好。"}</div>
      <IdentityModal open={identityOpen} required={identityRequired} onClose={() => { setIdentityOpen(false); setIdentityRequired(false); }} onSubmit={register} />
    </div>
  );
}
