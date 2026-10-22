/** 从 B站链接或纯 BV 号中提取 BV 号；找不到时原样返回。 */
export function extractBvid(input: string): string {
  const s = (input || '').trim();
  const m = s.match(/BV[0-9A-Za-z]{8,}/);
  return m ? m[0] : s;
}

export function isBvid(s: string): boolean {
  return /^BV[0-9A-Za-z]{8,}$/.test((s || '').trim());
}

/** B站 iframe 播放器地址。 */
export function embedUrl(bvid: string): string {
  return `//player.bilibili.com/player.html?bvid=${encodeURIComponent(bvid)}&autoplay=0`;
}
