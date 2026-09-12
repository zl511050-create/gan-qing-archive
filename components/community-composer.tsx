"use client";

import { FormEvent, useRef, useState } from "react";
import type { CommunityUser, ModeKey } from "@/data/archive";
import { avatarPresets } from "@/lib/avatar";

interface CommunityComposerProps {
  mode: ModeKey;
  user: CommunityUser | null;
  onRequireIdentity: () => void;
  onPublish: (payload: { nickname: string; mood: string; avatar: string; content: string }) => Promise<void>;
}

const modeNames: Record<ModeKey, string> = { keep: "挽留", release: "放下", wait: "等待" };
const moodOptions: Record<ModeKey, string[]> = {
  keep: ["小心翼翼", "想念", "不甘", "试探", "想留住你", "晚安以后"],
  release: ["归还", "平静", "清醒", "祝福", "释怀", "不再回避"],
  wait: ["克制", "期待", "自尊", "有期限", "未读", "双向"],
};

export function CommunityComposer({ mode, user, onRequireIdentity, onPublish }: CommunityComposerProps) {
  const [open, setOpen] = useState(false);
  const [nickname, setNickname] = useState(user?.username ?? "");
  const [mood, setMood] = useState(moodOptions[mode][0]);
  const [avatar, setAvatar] = useState(avatarPresets[0]);
  const [text, setText] = useState("");
  const [publishing, setPublishing] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const resetForm = () => {
    setNickname(user?.username ?? "");
    setMood(moodOptions[mode][0]);
    setAvatar(avatarPresets[0]);
    setText("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const content = text.trim();
    const safeNickname = nickname.trim();
    if (!safeNickname) return onRequireIdentity();
    if (!content || publishing) return inputRef.current?.focus();
    setPublishing(true);
    try {
      await onPublish({
        nickname: safeNickname,
        mood: `${modeNames[mode]} · ${mood}`,
        avatar,
        content,
      });
      setOpen(false);
      resetForm();
    } finally {
      setPublishing(false);
    }
  };

  return (
    <>
      <div className="community-composer">
        <div className="composer-heading">
          <div><span className="live-dot" /><b>写进「{modeNames[mode]}」的人海</b></div>
          <span>{user ? `以 ${user.username} 的名字` : "匿名 / 直接发帖"}</span>
        </div>
        <textarea
          ref={inputRef}
          maxLength={500}
          aria-label="写下想分享的心事"
          placeholder="输入那句还没有勇气发出的话..."
          value={text}
          onClick={() => setOpen(true)}
          readOnly={!open}
          onChange={(event) => setText(event.target.value)}
        />
        <div className="composer-foot">
          <span>{text.length}/500 · 双击发帖窗可选头像和心情</span>
          <button type="button" onClick={() => setOpen(true)}>{publishing ? "正在发送" : "发帖"}<i>↗</i></button>
        </div>
      </div>

      {open && (
        <div className="identity-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}>
          <section className="identity-dialog" role="dialog" aria-modal="true" aria-labelledby="composer-title">
            <button className="modal-close" type="button" aria-label="关闭发帖窗" onClick={() => setOpen(false)}>×</button>
            <p className="dialog-eyebrow">LEAVE A NOTE</p>
            <h2 id="composer-title">把这份心事，<br />放进「{modeNames[mode]}」的海里</h2>
            <form onSubmit={submit} className="composer-form">
              <div className="avatar-mood-row">
                <div className="avatar-picker-group">
                  <label className="field-label">头像</label>
                  <div className="avatar-grid">
                    {avatarPresets.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className={`preset-avatar${avatar === preset ? " selected" : ""}`}
                        aria-label="选择头像"
                        onClick={() => setAvatar(preset)}
                      >
                        <img src={preset} alt="治愈系头像" />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mood-select-wrap">
                  <label htmlFor="composer-mood" className="field-label">心情标签</label>
                  <select id="composer-mood" value={mood} onChange={(event) => setMood(event.target.value)}>
                    {moodOptions[mode].map((value) => <option key={value} value={value}>{value}</option>)}
                  </select>
                </div>
              </div>

              <label htmlFor="composer-nickname" className="field-label">昵称</label>
              <input id="composer-nickname" maxLength={24} value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="比如：晚风、阿遥、正在找答案的人" />

              <label htmlFor="composer-text" className="field-label">心事正文</label>
              <textarea
                id="composer-text"
                ref={inputRef}
                maxLength={500}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="写下这句话，哪怕不完整，至少会有人看见。"
              />

              <div className="composer-foot composer-submit-row">
                <span>{text.length}/500</span>
                <button type="submit" disabled={publishing || !nickname.trim() || !text.trim()}>{publishing ? "正在发布" : "发布到海里"}<i>↗</i></button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
