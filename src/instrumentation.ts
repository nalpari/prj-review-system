// 서버 인스턴스가 시작될 때 한 번 불린다. 오래 멈춘 리뷰 실행을 주기적으로 실패로 돌리는 정리 작업을 띄운다.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startStaleRunSweeper } = await import("./lib/stale-sweeper");
    startStaleRunSweeper();
  }
}
