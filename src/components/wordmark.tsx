export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2 text-[17px] font-extrabold tracking-[-0.02em]">
      <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
        <path d="M3 17 H8 C11 17 11 5 14 5 H19" fill="none" stroke="#15171a" strokeWidth="3" strokeLinecap="round" />
        <circle cx="8" cy="17" r="3" fill="#fff" stroke="#15171a" strokeWidth="2.5" />
        <circle cx="14" cy="5" r="3" fill="#c4242a" />
      </svg>
      Redline
    </span>
  );
}
