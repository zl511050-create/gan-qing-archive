"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { prepareAvatar } from "@/lib/avatar";

interface IdentityModalProps {
  open: boolean;
  required?: boolean;
  onClose: () => void;
  onSubmit: (username: string, avatarUrl?: string) => Promise<void>;
}

export function IdentityModal({ open, required = false, onClose, onSubmit }: IdentityModalProps) {
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarError, setAvatarError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 40);
  }, [open]);

  if (!open) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = username.trim();
    if (!value || saving) return inputRef.current?.focus();
    setSaving(true);
    try {
      await onSubmit(value, avatarUrl || undefined);
      setUsername("");
      setAvatarUrl("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="identity-backdrop" role="presentation" onMouseDown={(event) => {
      if (!required && event.target === event.currentTarget) onClose();
    }}>
      <section className="identity-dialog" role="dialog" aria-modal="true" aria-labelledby="identity-title">
        {!required && <button className="modal-close" type="button" aria-label="关闭" onClick={onClose}>×</button>}
        <p className="dialog-eyebrow">A NAME FOR THIS MOMENT</p>
        <span className="dialog-bubbles" aria-hidden="true">🫧</span>
        <h2 id="identity-title">在情绪档案中<br />留下你的称呼</h2>
        <p>不需要手机号或密码。这个名字只用来认出你写下的心事。</p>
        <form onSubmit={submit}>
          <div className="avatar-register-row">
            <label className={`avatar-picker${avatarUrl ? " has-avatar" : ""}`} style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined}>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setAvatarError("");
                try { setAvatarUrl(await prepareAvatar(file)); }
                catch (error) { setAvatarError(error instanceof Error ? error.message : "头像处理失败"); }
                event.target.value = "";
              }} />
              <span>{avatarUrl ? "更换" : "＋"}</span>
            </label>
            <div><b>添加头像</b><small>可选 · 自动裁剪并压缩保存</small></div>
          </div>
          {avatarError && <p className="avatar-error" role="alert">{avatarError}</p>}
          <label htmlFor="identity-name">昵称 / 名称</label>
          <input
            id="identity-name"
            ref={inputRef}
            maxLength={24}
            autoComplete="nickname"
            placeholder="比如：晚风、阿遥、一个正在告别的人"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <button type="submit" disabled={!username.trim() || saving}>{saving ? "正在收录…" : "进入情绪档案"}<span>↗</span></button>
        </form>
        <small>身份凭据会保存在当前浏览器中，下次回来仍能认出你。</small>
      </section>
    </div>
  );
}
