"use client";

import { CSSProperties, FormEvent, useRef, useState } from "react";

type ToastFn = (message: string) => void;

export interface ThemePublishPayload {
  content: string;
  mood: string;
  isAnonymous: boolean;
}

interface PublishExperienceProps {
  showToast: ToastFn;
  onPublish: (payload: ThemePublishPayload) => Promise<void>;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "暂时没有发送成功，请稍后再试。";
}

export function KeepExperience({ showToast, onPublish }: PublishExperienceProps) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<string[]>(["有一句话，在这里停了很久。"]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || publishing) {
      inputRef.current?.focus();
      return;
    }
    setPublishing(true);
    try {
      await onPublish({ content: text, mood: "挽留 · 未寄", isAnonymous });
      setMessages((current) => [...current.slice(-2), text]);
      setDraft("");
    } catch (error) {
      showToast(errorMessage(error));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <section className="experience-card atmosphere-experience keep-experience">
      <div className="experience-label"><span>写给此刻的消息</span><small>POST TO THE SEA</small></div>
      <div className="phone-shell">
        <div className="phone-screen">
          <div className="phone-bar"><span className="contact"><i className="contact-avatar">TA</i> 和 TA 的对话</span><span>发送到人海</span></div>
          <div className="unsent-stack">
            {messages.map((message, index) => (
              <p className="unsent-message" key={`${message}-${index}`}>
                {message}<small>{index === 0 && messages.length === 1 ? "未发送 · 草稿" : "已发送 · 人海"}</small>
              </p>
            ))}
          </div>
          <form className="phone-compose" onSubmit={submit}>
            <input
              ref={inputRef}
              maxLength={120}
              aria-label="写下想对TA说的话"
              placeholder="输入那句还没有勇气发出的话…"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="submit" disabled={publishing}>{publishing ? "发送中…" : "发送"}</button>
          </form>
        </div>
      </div>
      <label className="experience-anonymous"><input type="checkbox" checked={isAnonymous} onChange={(event) => setIsAnonymous(event.target.checked)} /><span aria-hidden="true" /><b>匿名发送</b><small>不显示昵称与头像</small></label>
    </section>
  );
}

interface ParticleStyle extends CSSProperties {
  "--tx": string;
  "--ty": string;
}

export function ReleaseExperience({ showToast, onPublish }: PublishExperienceProps) {
  const [text, setText] = useState("");
  const [shredding, setShredding] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [particles, setParticles] = useState<ParticleStyle[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const shred = async () => {
    const content = text.trim();
    if (!content || publishing) {
      inputRef.current?.focus();
      return;
    }
    setPublishing(true);
    try {
      await onPublish({ content, mood: "放下 · 归还", isAnonymous });
      setParticles(Array.from({ length: 22 }, () => ({
        left: `${18 + Math.random() * 64}%`, top: `${35 + Math.random() * 35}%`,
        "--tx": `${(Math.random() - 0.5) * 210}px`, "--ty": `${-35 - Math.random() * 110}px`,
      })));
      setShredding(true);
      window.setTimeout(() => { setText(""); setShredding(false); setParticles([]); }, 900);
    } catch (error) {
      showToast(errorMessage(error));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <section className="experience-card atmosphere-experience release-experience">
      <div className="experience-label"><span>今天决定不再提起</span><small>RETURN TO TIME</small></div>
      <div className="release-box">
        <div className={`release-note${shredding ? " shredding" : ""}`}>
          <textarea
            ref={inputRef}
            maxLength={300}
            aria-label="写下准备放下的事"
            placeholder="比如：不再反复查看那张合照，不再猜测你有没有想我……"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <div className="release-actions"><p>发布以后，让这段话留在今天。</p><button className="shred-button" type="button" disabled={publishing} onClick={shred}>{publishing ? "正在封存…" : "发布并封存"}</button></div>
        </div>
        {particles.map((style, index) => <i className="light-particle" style={style} key={index} />)}
      </div>
      <label className="experience-anonymous"><input type="checkbox" checked={isAnonymous} onChange={(event) => setIsAnonymous(event.target.checked)} /><span aria-hidden="true" /><b>匿名发送</b><small>不显示昵称与头像</small></label>
    </section>
  );
}

export function WaitExperience({ showToast, onPublish }: PublishExperienceProps) {
  const moods = ["期待", "不甘", "克制", "想念", "有点累了"];
  const [text, setText] = useState("");
  const [mood, setMood] = useState("期待");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || publishing) {
      inputRef.current?.focus();
      return;
    }
    setPublishing(true);
    try {
      await onPublish({ content: value, mood: `等待 · ${mood}`, isAnonymous });
      setText("");
    } catch (error) {
      showToast(errorMessage(error));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <form className="experience-card atmosphere-experience wait-form" onSubmit={submit}>
      <label className="field-label" htmlFor="entryText">今日记录</label>
      <textarea
        id="entryText"
        ref={inputRef}
        maxLength={500}
        placeholder="比如：我没有发那句晚安。不是在赌气，只是我也想被坚定地选择一次。"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <div className="text-meta"><span>等待可以有期限，你也永远拥有离开的权利。</span><span><b>{text.length}</b>/500</span></div>
      <fieldset className="mood-field">
        <legend>此刻更接近哪一种感受？</legend>
        <div className="mood-list">
          {moods.map((item) => <button type="button" className={`mood${mood === item ? " active" : ""}`} aria-pressed={mood === item} onClick={() => setMood(item)} key={item}>{item}</button>)}
        </div>
      </fieldset>
      <div className="publish-row">
        <label className="switch-label">
          <input type="checkbox" checked={isAnonymous} onChange={(event) => setIsAnonymous(event.target.checked)} />
          <span className="switch" aria-hidden="true" />
          <span><strong>匿名发送</strong><small>不显示昵称与头像</small></span>
        </label>
        <button className="primary-button" type="submit" disabled={publishing}>{publishing ? "正在收录…" : "发布到人海"} <span>↗</span></button>
      </div>
    </form>
  );
}
