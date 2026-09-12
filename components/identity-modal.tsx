"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { avatarPresets } from "@/lib/avatar";

export type IdentityAction = "login" | "register";

interface IdentityModalProps {
  open: boolean;
  required?: boolean;
  onClose: () => void;
  onSubmit: (action: IdentityAction, username: string, password: string, avatarUrl?: string) => Promise<void>;
}

export function IdentityModal({ open, required = false, onClose, onSubmit }: IdentityModalProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [action, setAction] = useState<IdentityAction>("login");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) window.setTimeout(() => inputRef.current?.focus(), 40);
  }, [open]);

  if (!open) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const value = username.trim();
    if (!value || password.length !== 4 || saving) return inputRef.current?.focus();
    setSaving(true);
    setError("");
    try {
      await onSubmit(action, value, password, action === "register" ? avatarUrl || undefined : undefined);
      setUsername("");
      setPassword("");
      setAvatarUrl("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "暂时无法登录，请稍后再试");
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
        <h2 id="identity-title">回到你的<br />情绪档案</h2>
        <p>一个昵称，一枚四位数字密码。登录会一直保留，直到你主动退出。</p>
        <div className="identity-action-tabs" role="tablist" aria-label="选择登录或注册">
          <button type="button" role="tab" aria-selected={action === "login"} onClick={() => { setAction("login"); setError(""); }}>登录</button>
          <button type="button" role="tab" aria-selected={action === "register"} onClick={() => { setAction("register"); setError(""); }}>注册</button>
        </div>
        <form onSubmit={submit}>
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
          <label htmlFor="identity-password">4 位数字密码</label>
          <input
            id="identity-password"
            type="password"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            autoComplete={action === "login" ? "current-password" : "new-password"}
            placeholder="请输入 4 位数字"
            value={password}
            onChange={(event) => setPassword(event.target.value.replace(/\D/g, "").slice(0, 4))}
          />
          {action === "register" && (
            <fieldset className="identity-avatar-fieldset">
              <legend>选择头像 <span>可稍后再选</span></legend>
              <div className="identity-avatar-grid" aria-label="注册头像">
                {avatarPresets.map((preset, index) => (
                  <button
                    type="button"
                    className={avatarUrl === preset ? "selected" : ""}
                    aria-label={`选择第 ${index + 1} 个头像`}
                    aria-pressed={avatarUrl === preset}
                    onClick={() => setAvatarUrl((current) => current === preset ? "" : preset)}
                    key={preset}
                  >
                    <Image src={preset} alt="" width={96} height={96} sizes="56px" />
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          {error && <p className="identity-error" role="alert">{error}</p>}
          <button type="submit" disabled={!username.trim() || password.length !== 4 || saving}>{saving ? "正在确认…" : action === "login" ? "登录情绪档案" : "注册并进入"}<span>↗</span></button>
        </form>
        <small>{action === "login" ? "刷新、关闭网页或断网都不会退出登录。" : "昵称注册后不可重复；密码仅保存为不可逆哈希。"}</small>
      </section>
    </div>
  );
}
