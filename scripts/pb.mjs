// PocketBase 실행. 실행: pnpm pb:serve | pnpm pb:superuser
// macOS/Linux는 pocketbase/pocketbase, Windows는 pocketbase/pocketbase.exe 를 쓴다(README의 OS별 다운로드).
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const commands = {
  serve: ["serve", "--http=127.0.0.1:8090"],
  superuser: [
    "superuser",
    "upsert",
    process.env.PB_SUPERUSER_EMAIL || "superuser@redline.local",
    process.env.PB_SUPERUSER_PASSWORD || "redline-superuser-1",
  ],
};

const args = commands[process.argv[2]];
if (!args) {
  console.error(`사용법: node scripts/pb.mjs <${Object.keys(commands).join("|")}>`);
  process.exit(2);
}

const cwd = fileURLToPath(new URL("../pocketbase/", import.meta.url));
const bin = process.platform === "win32" ? "pocketbase.exe" : "pocketbase";
const result = spawnSync(join(cwd, bin), args, { cwd, stdio: "inherit" });

if (result.error) {
  console.error(`PocketBase 실행 실패 (pocketbase/${bin}): ${result.error.message}`);
  console.error("README의 'PocketBase 바이너리'에서 이 OS용 파일을 받았는지 확인한다.");
  process.exit(1);
}
process.exit(result.status ?? 1);
