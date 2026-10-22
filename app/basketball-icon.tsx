/** 篮球图标（圆 + 缝线），颜色跟随 currentColor，深浅主题通用。 */
export function BasketballIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path d="M2.3 12h19.4M12 2.3c-4.5 3.4-4.5 16 0 19.4M12 2.3c4.5 3.4 4.5 16 0 19.4" stroke="rgba(0,0,0,.38)" strokeWidth="1.2" fill="none" />
      <path d="M4.6 6.3c4.8 1.9 8.8 3 10.3 6.1M4.6 17.7c4.8-1.9 8.8-3 10.3-6.1" stroke="rgba(0,0,0,.3)" strokeWidth="1" fill="none" />
    </svg>
  );
}
