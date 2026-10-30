// 서울 지하철 노선 번호와 색은 한 몸이다. 번호를 고르면 색이 따라온다.
// 5호선(보라)과 8호선(분홍)은 상태색·금지 팔레트와 겹쳐 뺐다.
export const SEOUL_LINES: Record<number, { name: string; color: string }> = {
  1: { name: "1호선", color: "#0052A4" },
  2: { name: "2호선", color: "#00A84D" },
  3: { name: "3호선", color: "#EF7C1C" },
  4: { name: "4호선", color: "#00A5DE" },
  6: { name: "6호선", color: "#CD7C2F" },
  7: { name: "7호선", color: "#747F00" },
  9: { name: "9호선", color: "#BDB092" },
};

// 노선 표지 숫자색: 흰색과 잉크 중 대비가 큰 쪽(4호선 하늘, 9호선 금색은 잉크).
export function lineInk(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  const L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  return 1.05 / (L + 0.05) >= (L + 0.05) / (0.0094 + 0.05) ? "#ffffff" : "#15171a";
}
