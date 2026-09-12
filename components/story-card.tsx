"use client";

import { FormEvent, useEffect, useState } from "react";
import type { CommunityReply, CommunityUser, Story } from "@/data/archive";
import { communityService } from "@/lib/community-service";

interface StoryCardProps {
  story: Story;
  currentUser: CommunityUser | null;
  justPosted?: boolean;
  onRequireIdentity: () => void;
  onDeleted: (id: string) => void;
  onLikeChanged: (id: string, count: number) => void;
}

export function StoryCard({ story, currentUser, justPosted = false, onRequireIdentity, onDeleted, onLikeChanged }: StoryCardProps) {
  const noteId = story.id ?? "unknown-note";
  const [empathyActive, setEmpathyActive] = useState(false);
  const [likeActive, setLikeActive] = useState(false);
  const [likeCount, setLikeCount] = useState(story.likes);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [savedReplies, setSavedReplies] = useState<CommunityReply[]>([]);
  const [replyText, setReplyText] = useState("");
  const [bubbleKey, setBubbleKey] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const storageKey = "weiji-liked-posts-v1";
    try {
      const likedMap = JSON.parse(localStorage.getItem(storageKey) || "{}") as Record<string, number>;
      if (likedMap[noteId]) {
        setLikeActive(true);
        setLikeCount((count) => count || story.likes);
      }
    } catch {
      // Ignore corrupted local storage state.
    }

    communityService.listReplies(noteId).then((items) => { if (active) setSavedReplies(items); });
    if (currentUser) {
      communityService.getLikeState(noteId, currentUser.id, story.likes).then((state) => {
        if (!active) return;
        setLikeActive(state.liked || likeActive);
        setLikeCount(state.count);
      });
    }
    return () => { active = false; };
  }, [currentUser, noteId, story.likes]);

  const releaseBubble = () => setBubbleKey((value) => value + 1);

  const submitReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = replyText.trim();
    if (!currentUser) return onRequireIdentity();
    if (!text || busy) return;
    setBusy(true);
    try {
      const reply = await communityService.addReply(currentUser, noteId, text);
      setSavedReplies((current) => [...current, reply]);
      setReplyText("");
      releaseBubble();
    } finally {
      setBusy(false);
    }
  };

  const toggleLike = async () => {
    if (busy) return;
    const storageKey = "weiji-liked-posts-v1";
    try {
      const likedMap = JSON.parse(localStorage.getItem(storageKey) || "{}") as Record<string, number>;
      if (likedMap[noteId]) {
        setLikeActive(true);
        setLikeAnimating(false);
        return;
      }
      const nextCount = likeCount + 1;
      likedMap[noteId] = Date.now();
      localStorage.setItem(storageKey, JSON.stringify(likedMap));
      setLikeActive(true);
      setLikeCount(nextCount);
      setLikeAnimating(true);
      window.setTimeout(() => setLikeAnimating(false), 420);
      releaseBubble();
      onLikeChanged(noteId, nextCount);
      try {
        await communityService.toggleLike(noteId, currentUser?.id ?? "guest-device", story.likes);
      } catch {
        // Local guard ensures repeated taps are blocked even if cloud write is transiently unavailable.
      }
    } catch {
      const nextCount = likeCount + 1;
      setLikeActive(true);
      setLikeCount(nextCount);
      setLikeAnimating(true);
      window.setTimeout(() => setLikeAnimating(false), 420);
      releaseBubble();
      onLikeChanged(noteId, nextCount);
    }
  };

  const remove = async () => {
    if (!currentUser || story.userId !== currentUser.id) return;
    if (!window.confirm("确定要彻底封存这条心事吗？删除后无法恢复。")) return;
    await communityService.deleteNote(currentUser, noteId);
    onDeleted(noteId);
  };

  const replies = [
    ...story.replies.map((content, index) => ({ id: `seed-${index}`, author_name: "匿名", author_avatar: undefined as string | undefined, content })),
    ...savedReplies,
  ];

  return (
    <article className={`story-card${story.featured ? " featured-story" : ""}${justPosted ? " just-posted" : ""}`}>
      <span className="card-bubble" aria-hidden="true">🫧</span>
      {Boolean(story.userId && currentUser && story.userId === currentUser.id) && <button className="delete-note" type="button" onClick={remove} title="删除 / 封存这条心事" aria-label="删除或封存这条心事">⌁</button>}
      {bubbleKey > 0 && <span className="bubble-pop" key={bubbleKey} aria-hidden="true">🫧</span>}
      <div className="story-meta">
        <span className="story-author"><i className={story.authorAvatar ? "has-avatar" : ""} style={story.authorAvatar ? { backgroundImage: `url(${story.authorAvatar})` } : undefined}>{story.authorAvatar ? "" : (story.authorName ?? story.source ?? "匿").slice(0, 1)}</i>{story.authorName ?? story.source ?? "匿名"} · {story.mood}</span>
        <span>{story.time}</span>
      </div>
      <p>{story.text}</p>
      <div className="story-actions">
        <button type="button" className={`empathy-button${empathyActive ? " active" : ""}`} aria-pressed={empathyActive} onClick={() => {
          setEmpathyActive((active) => !active);
          if (!empathyActive) releaseBubble();
        }}><span>🫧</span> 我也经历过 <b>{story.empathy + (empathyActive ? 1 : 0)}</b></button>
        <span className="action-pair">
          <button type="button" className={`like-button${likeActive ? " active" : ""}${likeAnimating ? " heart-beat" : ""}`} aria-label={likeActive ? "取消点赞" : "点赞"} aria-pressed={likeActive} onClick={toggleLike}>
            {likeActive ? "♥" : "♡"} <b>{likeCount}</b>
          </button>
          <button type="button" className="comment-button" aria-expanded={drawerOpen} onClick={() => setDrawerOpen((open) => !open)}>回应 {replies.length}</button>
        </span>
      </div>
      <div className="comment-drawer" hidden={!drawerOpen}>
        {replies.map((reply) => <p className="reply-bubble" key={reply.id}>{reply.author_avatar ? <i className="reply-avatar" style={{ backgroundImage: `url(${reply.author_avatar})` }} /> : <span aria-hidden="true">🫧</span>}<b>{reply.author_name}：</b>{reply.content}</p>)}
        <div className="quick-replies" aria-label="快捷回应">
          {story.quick.map((text) => <button type="button" key={text} onClick={() => setReplyText(text)}>{text}</button>)}
        </div>
        <form className="comment-form" onSubmit={submitReply}>
          <input aria-label="写下回应" maxLength={80} placeholder={currentUser ? "留一句温柔的回应…" : "登录后留下温柔回应…"} value={replyText} onChange={(event) => setReplyText(event.target.value)} />
          <button type="submit" disabled={busy}>发送</button>
        </form>
      </div>
    </article>
  );
}
