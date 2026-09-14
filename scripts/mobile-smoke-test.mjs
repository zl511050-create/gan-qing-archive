const endpoint = process.env.CDP_ENDPOINT || "http://127.0.0.1:9223";
const pages = await fetch(`${endpoint}/json`).then((response) => response.json());
const page = pages.find((item) => item.type === "page");
if (!page) throw new Error("No Chrome page target found");

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let id = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});

function send(method, params = {}) {
  const requestId = ++id;
  socket.send(JSON.stringify({ id: requestId, method, params }));
  return new Promise((resolve, reject) => pending.set(requestId, { resolve, reject }));
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
};

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 390, height: 844, deviceScaleFactor: 3, mobile: true, screenWidth: 390, screenHeight: 844,
});
await send("Network.setUserAgentOverride", {
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
});
await send("Page.navigate", { url: "http://localhost:4173/#community" });
await wait(1500);

await evaluate(`localStorage.clear(); location.reload()`);
await wait(1200);

const result = await evaluate(`(async () => {
  const setReactValue = (element, value) => {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value").set.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const identity = document.querySelector("#identity-name");
  if (!identity) throw new Error("Identity dialog did not open on first visit");
  document.querySelector('.identity-action-tabs button:nth-child(2)').click();
  await pause(50);
  const password = document.querySelector("#identity-password");
  setReactValue(identity, "手机流程测试-" + Date.now());
  setReactValue(password, "2468");
  document.querySelector(".identity-avatar-grid button")?.click();
  const avatarSelected = Boolean(document.querySelector(".identity-avatar-grid button.selected"));
  identity.closest("form").querySelector("button[type=submit]").click();
  await pause(500);
  document.querySelector("#community").scrollIntoView();
  const commentButton = document.querySelector(".story-card .comment-button");
  commentButton.click();
  await pause(120);
  const replyInput = document.querySelector(".story-card .comment-form input");
  const fontSize = parseFloat(getComputedStyle(replyInput).fontSize);
  const beforeScale = visualViewport?.scale || 1;
  replyInput.focus();
  setReactValue(replyInput, "愿你今晚先照顾好自己。");
  replyInput.closest("form").querySelector("button[type=submit]").click();
  await pause(350);
  const afterScale = visualViewport?.scale || 1;
  const replySaved = [...document.querySelectorAll(".reply-bubble")].some((node) => node.textContent.includes("愿你今晚先照顾好自己"));
  const persisted = (localStorage.getItem("weiji-community-replies") || "").includes("愿你今晚先照顾好自己");
  const sessionHasAvatar = (JSON.parse(localStorage.getItem("weiji-community-session") || "null")?.avatar_url || "").startsWith("/assets/avatars/");
  const headerHasAvatar = document.querySelector(".header-avatar")?.classList.contains("has-avatar") || false;
  return { width: innerWidth, fontSize, beforeScale, afterScale, replySaved, persisted, avatarSelected, sessionHasAvatar, headerHasAvatar };
})()`);

if (result.width !== 390) throw new Error(`Unexpected viewport width: ${result.width}`);
if (result.fontSize < 16) throw new Error(`Reply input is still ${result.fontSize}px`);
if (!result.replySaved || !result.persisted) throw new Error("Reply flow did not finish or persist");
if (!result.avatarSelected || !result.sessionHasAvatar || !result.headerHasAvatar) throw new Error("Avatar was not selected or persisted");
await send("Page.reload", { ignoreCache: true });
await wait(900);
const restoredAfterReload = await evaluate(`({
  avatar: document.querySelector(".header-avatar")?.classList.contains("has-avatar") || false,
  loggedIn: Boolean(document.querySelector(".identity-menu")),
  loginDialogClosed: !document.querySelector("#identity-name"),
})`);
if (!restoredAfterReload.avatar || !restoredAfterReload.loggedIn || !restoredAfterReload.loginDialogClosed) {
  throw new Error("Login session or avatar disappeared after reload");
}
result.restoredAfterReload = restoredAfterReload;
console.log(JSON.stringify(result, null, 2));
socket.close();
