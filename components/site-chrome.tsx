import Image from "next/image";
import Link from "next/link";
import { CuteAudioPlayer } from "@/components/cute-audio-player";
import type { CommunityUser } from "@/data/archive";

interface SiteHeaderProps {
  recordCount: number;
  user: CommunityUser | null;
  onLogin: () => void;
  onLogout: () => void;
  onDeactivate: () => void;
  onAvatarChange: (file: File) => Promise<void>;
}

export function SiteHeader({ recordCount, user, onLogin, onLogout, onDeactivate, onAvatarChange }: SiteHeaderProps) {
  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label="未寄首页">
        <span className="brand-mark">未</span>
        <span>未寄</span>
      </a>
      <div className="header-middle">
        <p className="date-line">今天，也允许想起。</p>
        <Link className="game-entry" href="/game" aria-label="进入深海垂钓小游戏">
          <span aria-hidden="true">🐟</span><b>深海垂钓</b>
        </Link>
      </div>
      {user ? (
        <div className="identity-actions">
          <details className="identity-menu">
            <summary aria-label={`账户菜单：${user.username}`}>
              <i className={`header-avatar${user.avatar_url ? " has-avatar" : ""}`} style={user.avatar_url ? { backgroundImage: `url(${user.avatar_url})` } : undefined}>{user.avatar_url ? "" : user.username.slice(0, 1)}</i>
              <b>未寄 · {user.username}</b><span className="record-count">{String(recordCount).padStart(2, "0")}</span>
            </summary>
            <div>
              <label className="avatar-menu-action">更换头像<input type="file" accept="image/png,image/jpeg,image/webp" onChange={async (event) => {
                const file = event.target.files?.[0];
                if (file) await onAvatarChange(file);
                event.target.value = "";
              }} /></label>
              <button type="button" onClick={() => document.querySelector("#community")?.scrollIntoView({ behavior: "smooth" })}>我的记录</button>
              <button className="danger-action" type="button" onClick={onDeactivate}>注销档案</button>
            </div>
          </details>
          <button className="header-logout-button" type="button" onClick={onLogout} aria-label="退出登录">
            <span className="logout-long">退出登录</span><span className="logout-short">退出</span>
          </button>
        </div>
      ) : <button className="quiet-button" type="button" onClick={onLogin}>留下称呼 <span>＋</span></button>}
    </header>
  );
}

export function CinemaIntro() {
  return (
    <section className="intro" aria-labelledby="main-title">
      <p className="eyebrow"><span>LOST LOVE ARCHIVE</span><span>失恋情绪档案</span></p>
      <div className="title-row">
        <div className="intro-primary">
          <figure className="intro-cinema" aria-label="城市阶梯上的夏日相遇画面">
            <Image src="/assets/intro-your-name-scene.png" alt="蓝天下，两位少年在绿意环绕的城市阶梯上相遇" fill sizes="(max-width: 860px) 100vw, 58vw" priority />
          </figure>
          <h1 id="main-title">他，<br />你遗憾吗？</h1>
          <CuteAudioPlayer />
        </div>
        <div className="intro-side">
          <p className="intro-note">有些话不必寄到谁的手里。<br />写下来，就算是给今天一个交代。</p>
          <figure className="hero-art">
            <Image src="/assets/glass-letter-3d.jpg" alt="漂浮在深色空间中的透明玻璃信封与珍珠气泡" fill sizes="(max-width: 860px) 100vw, 38vw" />
            <figcaption><span>FLOATING THOUGHTS</span><span>让心事轻一点</span></figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer>
      <p>愿每一封没有寄出的信，最后都能抵达自己。</p>
      <span>未寄 · 情绪档案 2026</span>
    </footer>
  );
}
