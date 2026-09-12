"use client";

import { CSSProperties, FormEvent, useRef, useState } from "react";
import type { SavedRecord, Story } from "@/data/archive";

type ToastFn = (message: string) => void;

export function KeepExperience({ showToast }: { showToast: ToastFn }) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<string[]>(["有一句话，在这里停了很久。"]);
  const [heartKey, setHeartKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) {
      inputRef.current?.focus();
      return;
    }
    setMessages((current) => [...current, text]);
    setDraft("");
    setHeartKey((value) => value + 1);
    showToast("这句话没有发出，但已经被好好接住。");
  };

  return (
    <section className="experience-card keep-experience">
      <div className="experience-label"><span>未发送的消息</span><small>SIMULATED CHAT</small></div>
      <div className="phone-shell">
        <div className="phone-screen">
          <div className="phone-bar"><span className="contact"><i className="contact-avatar">TA</i> 和 TA 的对话</span><span>仅你可见</span></div>
          <div className="unsent-stack">
            {messages.map((message, index) => (
              <p className="unsent-message" key={`${message}-${index}`}>
                {message}<small>{index === 0 ? "未发送 · 草稿" : "未发送 · 已沉淀"}</small>
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
            <button type="submit">模拟发送</button>
          </form>
        </div>
        {heartKey > 0 && <span className="heart-break" key={heartKey} aria-hidden="true">💔</span>}
      </div>
    </section>
  );
}

interface ParticleStyle extends CSSProperties {
  "--tx": string;
  "--ty": string;
}

export function ReleaseExperience({ showToast }: { showToast: ToastFn }) {
  const [text, setText] = useState("");
  const [shredding, setShredding] = useState(false);
  const [particles, setParticles] = useState<ParticleStyle[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const shred = () => {
    if (!text.trim()) {
      inputRef.current?.focus();
      return;
    }
    setParticles(Array.from({ length: 22 }, () => ({
      left: `${18 + Math.random() * 64}%`,
      top: `${35 + Math.random() * 35}%`,
      "--tx": `${(Math.random() - 0.5) * 210}px`,
      "--ty": `${-35 - Math.random() * 110}px`,
    })));
    setShredding(true);
    window.setTimeout(() => {
      setText("");
      setShredding(false);
      setParticles([]);
      showToast("已将这份执念归还给时间");
    }, 900);
  };

  return (
    <section className="experience-card release-experience">
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
          <div className="release-actions"><p>写完以后，让这段话留在今天。</p><button className="shred-button" type="button" onClick={shred}>碎纸封存</button></div>
        </div>
        {particles.map((style, index) => <i className="light-particle" style={style} key={index} />)}
      </div>
    </section>
  );
}

interface WaitExperienceProps {
  showToast: ToastFn;
  onSaved: (record: SavedRecord, story?: Story) => void;
}

export function WaitExperience({ showToast, onSaved }: WaitExperienceProps) {
  const moods = ["期待", "不甘", "克制", "想念", "有点累了"];
  const [text, setText] = useState("");
  const [mood, setMood] = useState("期待");
  const [isPublic, setIsPublic] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = text.trim();
    if (!value) {
      inputRef.current?.focus();
      return;
    }
    const record: SavedRecord = { text: value, mode: "wait", mood, isPublic, createdAt: new Date().toISOString() };
    const story = isPublic ? {
      mood: `等待 · ${mood}`,
      time: "刚刚",
      empathy: 0,
      likes: 0,
      text: value,
      replies: [],
      quick: ["陪你等一会儿", "先照顾自己"],
    } satisfies Story : undefined;
    onSaved(record, story);
    setText("");
    showToast(isPublic ? "已经匿名放进等待的人海。" : "已经只替你收好。");
  };

  return (
    <form className="wait-form" onSubmit={submit}>
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
          <input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} />
          <span className="switch" aria-hidden="true" />
          <span><strong>匿名公开</strong><small>让相似的人看见这段心事</small></span>
        </label>
        <button className="primary-button" type="submit">收进今天 <span>↗</span></button>
      </div>
    </form>
  );
}
