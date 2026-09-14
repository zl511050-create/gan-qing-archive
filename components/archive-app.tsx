"use client";

import { KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import NextImage from "next/image";
import { AvatarChoiceModal } from "@/components/avatar-choice-modal";
import { CinemaBackground } from "@/components/cinema-background";
import { IdentityModal, type IdentityAction } from "@/components/identity-modal";
import { PostFeed } from "@/components/post-feed";
import { CinemaIntro, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { KeepExperience, ReleaseExperience, WaitExperience, type ThemePublishPayload } from "@/components/theme-experiences";
import { modes, stories, type CommunityNote, type CommunityUser, type ModeKey, type Story } from "@/data/archive";
import { communityService } from "@/lib/community-service";
import { anonymousAvatar, prepareAvatar } from "@/lib/avatar";

const tabDetails: Array<{ mode: ModeKey; name: string; copy: string }> = [
  { mode: "keep", name: "挽留", copy: "我还在试着靠近" },
  { mode: "release", name: "放下", copy: "我在练习告别" },
  { mode: "wait", name: "等待", copy: "这一次，等你走向我" },
];

type SortMode = "latest" | "hottest";
type PendingPublish = ThemePublishPayload & { category: ModeKey };

function relativeTime(date: string) {
  const elapsed = Math.max(0, Date.now() - new Date(date).getTime());
  if (elapsed < 60_000) return "刚刚";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)} 分钟前`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)} 小时前`;
  return `${Math.floor(elapsed / 86_400_000)} 天前`;
}

function noteToStory(note: CommunityNote): Story {
  return {
    id: note.id, userId: note.user_id, authorName: note.author_name, authorAvatar: note.author_avatar, isAnonymous: note.is_anonymous, category: note.category,
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
  const [avatarChoiceOpen, setAvatarChoiceOpen] = useState(false);
  const [avatarChoiceBusy, setAvatarChoiceBusy] = useState(false);
  const [avatarChoiceError, setAvatarChoiceError] = useState("");
  const [pendingPublish, setPendingPublish] = useState<PendingPublish | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("latest");
  const [likeOverrides, setLikeOverrides] = useState<Record<string, number>>({});
  const [listSwitching, setListSwitching] = useState(false);
  const [moreRead, setMoreRead] = useState(false);
  const [toast, setToast] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const switchTimer = useRef<number | null>(null);
  const toastTimer = useRef<number | null>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const pendingPublishPromise = useRef<{ resolve: () => void; reject: (error: Error) => void } | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setToastVisible(true);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastVisible(false), 2400);
  }, []);

  useEffect(() => {
    let active = true;
    const hydrationTimer = window.setTimeout(async () => {
      try {
        const records = JSON.parse(localStorage.getItem("weiji-records") || "[]");
        if (active) setRecordCount(Array.isArray(records) ? records.length : 0);
      } catch {
        if (active) setRecordCount(0);
      }
      const cachedSession = communityService.getCurrentUser();
      setCurrentUser(cachedSession);
      if (!cachedSession && localStorage.getItem("weiji-identity-invited") !== "yes") {
        setIdentityOpen(true);
        localStorage.setItem("weiji-identity-invited", "yes");
      }
      if (cachedSession) {
        const restoredSession = await communityService.restoreSession();
        if (!active) return;
        setCurrentUser(restoredSession);
        if (!restoredSession) {
          setIdentityRequired(true);
          setIdentityOpen(true);
        }
      }
    }, 0);
    Object.values(modes).forEach((mode) => {
      const image = new Image();
      image.src = mode.background;
    });
    return () => {
      active = false;
      if (switchTimer.current) window.clearTimeout(switchTimer.current);
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      window.clearTimeout(hydrationTimer);
    };
  }, []);

  useEffect(() => {
    document.body.dataset.themeMode = displayMode;
    return () => { delete document.body.dataset.themeMode; };
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

  const requireIdentity = () => {
    setIdentityRequired(true);
    setIdentityOpen(true);
  };

  const authenticate = async (action: IdentityAction, username: string, password: string, avatarUrl?: string) => {
    const user = action === "register"
      ? await communityService.register(username, password, avatarUrl)
      : await communityService.login(username, password);
    setCurrentUser(user);
    setIdentityOpen(false);
    setIdentityRequired(false);
    showToast(`${action === "register" ? "欢迎来到这里" : "欢迎回来"}，${user.username}。`);
  };

  const updateAvatar = async (file: File) => {
    if (!currentUser) return requireIdentity();
    try {
      const avatarUrl = await prepareAvatar(file);
      const user = await communityService.updateAvatar(currentUser, avatarUrl);
      setCurrentUser(user);
      showToast("新头像已经替你保存好了。 ");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "头像保存失败，请换一张图片试试。 ");
    }
  };

  const performPublish = async (payload: PendingPublish, user: CommunityUser, avatarUrl?: string) => {
    const note = await communityService.createNote(user, {
      content: payload.content,
      category: payload.category,
      mood: payload.mood,
      nickname: payload.isAnonymous ? "匿名" : user.username,
      avatar: payload.isAnonymous ? "" : avatarUrl ?? user.avatar_url ?? anonymousAvatar,
      isAnonymous: payload.isAnonymous,
    });
    if (payload.category === displayMode) setCommunityNotes((current) => [noteToStory(note), ...current]);
    setRecordCount((count) => count + 1);
    setSortMode("latest");
    showToast("这句话已经被放进相似的人海。\u00a0🫧");
  };

  const requestPublish = (payload: ThemePublishPayload) => {
    if (!currentUser) {
      requireIdentity();
      return Promise.reject(new Error("请先登录，草稿已经替你保留。"));
    }
    const request = { ...payload, category: displayMode };
    if (payload.isAnonymous || currentUser.avatar_url) return performPublish(request, currentUser);

    setPendingPublish(request);
    setAvatarChoiceError("");
    setAvatarChoiceOpen(true);
    return new Promise<void>((resolve, reject) => {
      pendingPublishPromise.current = { resolve, reject };
    });
  };

  const finishPendingPublish = async (avatarUrl: string, saveToProfile: boolean) => {
    if (!pendingPublish || !currentUser || avatarChoiceBusy) return;
    setAvatarChoiceBusy(true);
    setAvatarChoiceError("");
    try {
      const user = saveToProfile ? await communityService.updateAvatar(currentUser, avatarUrl) : currentUser;
      if (saveToProfile) setCurrentUser(user);
      await performPublish(pendingPublish, user, avatarUrl);
      setAvatarChoiceOpen(false);
      setPendingPublish(null);
      pendingPublishPromise.current?.resolve();
      pendingPublishPromise.current = null;
    } catch (error) {
      setAvatarChoiceError(error instanceof Error ? error.message : "头像保存或发帖失败，请重试。");
    } finally {
      setAvatarChoiceBusy(false);
    }
  };

  const cancelPendingPublish = () => {
    if (avatarChoiceBusy) return;
    setAvatarChoiceOpen(false);
    setPendingPublish(null);
    pendingPublishPromise.current?.reject(new Error("已取消发送，草稿仍然保留。"));
    pendingPublishPromise.current = null;
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
    setIdentityRequired(true);
    setIdentityOpen(true);
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

        <figure className="interlude-cinema" aria-label="通往远方的城市阶梯氛围画面">
          <NextImage
            src="/stairs2.jpg"
            alt="阳光与绿意环绕的城市阶梯"
            fill
            sizes="(max-width: 860px) calc(100vw - 70px), 90vw"
          />
          <span className="interlude-vignette" aria-hidden="true" />
          <figcaption className="interlude-caption">
            <span>RECORD</span>
          </figcaption>
        </figure>

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
              {displayMode === "keep" && <KeepExperience showToast={showToast} onPublish={requestPublish} />}
              {displayMode === "release" && <ReleaseExperience showToast={showToast} onPublish={requestPublish} />}
              {displayMode === "wait" && <WaitExperience showToast={showToast} onPublish={requestPublish} />}
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
          <div className="story-toolbar">
            <div role="tablist" aria-label="社区内容排序">
              <button role="tab" aria-selected={sortMode === "latest"} className={sortMode === "latest" ? "active" : ""} type="button" onClick={() => changeSort("latest")}><b>最新</b><span>LATEST</span></button>
              <button role="tab" aria-selected={sortMode === "hottest"} className={sortMode === "hottest" ? "active" : ""} type="button" onClick={() => changeSort("hottest")}><b>最热</b><span>HOTTEST</span></button>
            </div>
            <p>{visibleStories.length} 封未寄片段</p>
          </div>
          <PostFeed
            stories={visibleStories}
            currentUser={currentUser}
            switching={listSwitching}
            justPostedId={communityNotes[0]?.id}
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
          />
          <button className="more-button" type="button" disabled={moreRead} onClick={() => setMoreRead(true)}>
            {moreRead ? "这一刻，先读到这里" : <>再读一些 <span>↓</span></>}
          </button>
        </section>
        <SiteFooter />
      </main>
      <div className={`toast${toastVisible ? " show" : ""}`} role="status" aria-live="polite">{toast || "已经替你收好。"}</div>
      <AvatarChoiceModal
        open={avatarChoiceOpen}
        busy={avatarChoiceBusy}
        error={avatarChoiceError}
        onSelect={(avatarUrl) => void finishPendingPublish(avatarUrl, true)}
        onSkip={() => void finishPendingPublish(anonymousAvatar, false)}
        onCancel={cancelPendingPublish}
      />
      <IdentityModal open={identityOpen} required={identityRequired} onClose={() => { setIdentityOpen(false); setIdentityRequired(false); }} onSubmit={authenticate} />
    </div>
  );
}
