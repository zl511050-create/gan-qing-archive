const MAX_FILE_SIZE = 8 * 1024 * 1024;
const AVATAR_SIZE = 160;

function makeAvatarPreset(emoji: string, start: string, end: string, accent: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="${emoji}">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${start}" />
          <stop offset="100%" stop-color="${end}" />
        </linearGradient>
      </defs>
      <rect width="120" height="120" rx="60" fill="url(#bg)" />
      <circle cx="60" cy="52" r="24" fill="${accent}" fill-opacity="0.28" />
      <text x="60" y="76" text-anchor="middle" style="font-size:42px; font-family: 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif;">${emoji}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export const avatarPresets = [
  makeAvatarPreset("🫧", "#dff6ff", "#cce8ff", "#ffffff"),
  makeAvatarPreset("🌤️", "#ffe9cc", "#ffd5d8", "#fff8ef"),
  makeAvatarPreset("🌙", "#dfe7ff", "#cdd9ff", "#f3f6ff"),
  makeAvatarPreset("🌿", "#d9f7e8", "#c7f2d5", "#f7fffb"),
  makeAvatarPreset("☀️", "#ffe2ad", "#ffd6c7", "#fffef2"),
  makeAvatarPreset("💌", "#dfe8ff", "#dfe9ff", "#f5f7ff"),
  makeAvatarPreset("🍊", "#ffe0b8", "#ffddb1", "#fff7ef"),
  makeAvatarPreset("🌊", "#d8f2ff", "#cbe5ff", "#f3fbff"),
];

export async function prepareAvatar(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("请选择 JPG、PNG 或 WebP 图片");
  if (file.size > MAX_FILE_SIZE) throw new Error("头像图片不能超过 8MB");

  const source = await createImageBitmap(file);
  const side = Math.min(source.width, source.height);
  const sx = (source.width - side) / 2;
  const sy = (source.height - side) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前浏览器无法处理这张图片");
  context.drawImage(source, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  source.close();
  return canvas.toDataURL("image/webp", 0.78);
}
