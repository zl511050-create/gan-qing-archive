"use client";

import Image from "next/image";
import { avatarPresets } from "@/lib/avatar";

interface AvatarChoiceModalProps {
  open: boolean;
  busy: boolean;
  error: string;
  onSelect: (avatarUrl: string) => void;
  onSkip: () => void;
  onCancel: () => void;
}

export function AvatarChoiceModal({ open, busy, error, onSelect, onSkip, onCancel }: AvatarChoiceModalProps) {
  if (!open) return null;

  return (
    <div className="identity-backdrop avatar-choice-backdrop" role="presentation">
      <section className="identity-dialog avatar-choice-dialog" role="dialog" aria-modal="true" aria-labelledby="avatar-choice-title">
        <button className="modal-close" type="button" aria-label="取消发送" disabled={busy} onClick={onCancel}>×</button>
        <p className="dialog-eyebrow">CHOOSE YOUR FACE</p>
        <h2 id="avatar-choice-title">先选一张，<br />让人海认出你</h2>
        <p>头像会保存到你的档案中。之后发帖会直接使用，不再打扰你。</p>
        <div className="avatar-choice-grid" role="list" aria-label="精选卡通头像">
          {avatarPresets.map((avatarUrl, index) => (
            <button
              type="button"
              role="listitem"
              disabled={busy}
              aria-label={`选择第 ${index + 1} 个头像`}
              onClick={() => onSelect(avatarUrl)}
              key={avatarUrl}
            >
              <Image src={avatarUrl} alt="" width={160} height={160} sizes="(max-width: 540px) 22vw, 104px" />
            </button>
          ))}
        </div>
        {error && <p className="avatar-choice-error" role="alert">{error}</p>}
        <button className="avatar-choice-skip" type="button" disabled={busy} onClick={onSkip}>
          {busy ? "正在保存并发布…" : "暂不选择 · 使用匿名头像继续"}<span>↗</span>
        </button>
      </section>
    </div>
  );
}
