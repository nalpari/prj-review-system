import "server-only";
import PocketBase from "pocketbase";
import { PB_URL } from "./pb";

// 신뢰된 쓰기 전용 클라이언트(PocketBase 슈퍼유저). 사용자 토큰으로는 막아 둔 쓰기를 대신한다.
// 호출하는 쪽이 먼저 사용자 토큰으로 접근 권한을 확인하고, 자유 텍스트는 마스킹한 뒤 넘긴다.
let client: PocketBase | null = null;

export async function pbService(): Promise<PocketBase> {
  const email = process.env.PB_SUPERUSER_EMAIL;
  const password = process.env.PB_SUPERUSER_PASSWORD;
  if (!email || !password) throw new Error("서버 설정 오류: PB_SUPERUSER_EMAIL과 PB_SUPERUSER_PASSWORD 환경 변수가 필요합니다.");
  if (!client) {
    client = new PocketBase(PB_URL);
    client.autoCancellation(false);
  }
  if (!client.authStore.isValid) await client.collection("_superusers").authWithPassword(email, password);
  return client;
}
