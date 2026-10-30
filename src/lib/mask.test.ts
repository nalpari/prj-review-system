// 실행: node --test src/lib/mask.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { maskSecrets } from "./mask.ts";

test("비밀정보를 가리고 일반 코드는 그대로 둔다", () => {
  const src = [
    'const password = "hunter2hunter2";',
    "AWS_KEY=AKIAABCDEFGHIJKLMNOP",
    "token: ghp_abcdefghijklmnopqrstuvwxyz0123456789",
    "const retries = 3;",
  ].join("\n");
  const out = maskSecrets(src);
  assert.ok(!out.includes("hunter2hunter2"));
  assert.ok(!out.includes("AKIAABCDEFGHIJKLMNOP"));
  assert.ok(!out.includes("ghp_abcdefghijklmnopqrstuvwxyz0123456789"));
  assert.ok(out.includes("const retries = 3;"));
});

test("따옴표로 감싼 JSON 키의 자격 증명도 가린다(diff 줄 포함)", () => {
  const json = '{"password":"hunter2hunter2","api_key":"prodcredential12345","db_password": "s3cr3t-db", "name":"payments"}';
  const out = maskSecrets(json);
  for (const leak of ["hunter2hunter2", "prodcredential12345", "s3cr3t-db"]) assert.ok(!out.includes(leak), leak);
  assert.ok(out.includes('"name":"payments"'));
  assert.ok(out.includes('"password":"********"'));

  const diff = ['+  "clientSecret": "abcdEFGH1234",', "+  'accessKey': 'zzzz9999yyyy'", '+  "timeout": 3000,'].join("\n");
  const d = maskSecrets(diff);
  assert.ok(!d.includes("abcdEFGH1234") && !d.includes("zzzz9999yyyy"));
  assert.ok(d.includes('"timeout": 3000'));
});

test("공백·문장부호·이스케이프가 든 따옴표 값도 통째로 가린다", () => {
  const cases = [
    'password = "correct horse battery staple"',
    '{"password":"a b c d"}',
    "db_password: 'p@ss, w;ord}!'",
    '"apiKey": "with \\"escaped\\" quote and spaces"',
  ];
  for (const c of cases) {
    const out = maskSecrets(c);
    for (const leak of ["correct horse", "a b c d", "p@ss", "escaped"]) assert.ok(!out.includes(leak), `${c} → ${out}`);
  }
  assert.equal(maskSecrets('{"password":"a b c d","user":"kim"}'), '{"password":"********","user":"kim"}');
});

test("접속 URL의 비밀번호와 다음 줄로 넘어간 diff 할당 값도 가린다", () => {
  const url = maskSecrets("DATABASE_URL=postgres://app:demo-password@db.internal/app");
  assert.ok(!url.includes("demo-password"), url);
  assert.ok(url.includes("postgres://app:********@db.internal/app"), url);
  assert.ok(maskSecrets("see https://example.com/a:b@c").includes("https://example.com/a:b@c")); // 경로의 :·@는 그대로

  const diff = maskSecrets('+const password =\n+  "demo-password";\n+const retries = 3;');
  assert.ok(!diff.includes("demo-password"), diff);
  assert.ok(diff.includes("+const retries = 3;"));
});

test("Authorization 헤더 값을 가린다", () => {
  const cases = [
    "+Authorization: Bearer opaque-production-credential-123456",
    '{"Authorization": "Basic dXNlcjpwYXNzd29yZDEyMw=="}',
    "curl -H 'authorization: Token opaque-production-credential-123456'",
  ];
  for (const c of cases) {
    const out = maskSecrets(c);
    for (const leak of ["opaque-production", "dXNlcjpw"]) assert.ok(!out.includes(leak), `${c} → ${out}`);
  }
  assert.equal(maskSecrets("+Authorization: Bearer opaque-production-credential-123456"), "+Authorization: Bearer ********");
  assert.ok(maskSecrets("basic understanding of bearer bonds").includes("basic understanding of bearer bonds"));
});

test("긴 비매칭 입력에서도 처리 시간이 길이에 선형이다(이벤트 루프 차단 방지)", () => {
  const n = 400_000;
  const inputs = {
    identifier: "+" + "a".repeat(n),
    keyword: "password".repeat(n / 8),
    assignment: "password=".repeat(n / 9),
    unclosedQuote: 'password="' + "a".repeat(n),
    urlScheme: "a.".repeat(n / 2),
    urlUser: "x://" + "a:".repeat(n / 2),
    jwt: "eyJ-".repeat(n / 4),
    privateKey: "-----BEGIN PRIVATE KEY-----".repeat(n / 27),
    authorization: "authorization:".repeat(n / 14),
  };
  for (const [name, text] of Object.entries(inputs)) {
    const t = performance.now();
    maskSecrets(text);
    const ms = performance.now() - t;
    assert.ok(ms < 500, `${name}: ${Math.round(ms)}ms`); // 선형이면 수십 ms, 제곱이면 수십 초
  }
  assert.ok(maskSecrets('x = "token=abcd1234"').includes("token=********")); // 문자열 안의 할당도 계속 잡는다
});

test("diff의 추가·삭제·문맥 PEM 개인 키 블록을 줄 구조는 남기고 가린다", () => {
  const body = ["MIIEvQIBADANBgkqhkiG9w0BAQEFAASC", "c2VjcmV0LWtleS1tYXRlcmlhbC0xMjM0"];
  const block = (p: string) => [`${p}-----BEGIN RSA PRIVATE KEY-----`, ...body.map((b) => p + b), `${p}-----END RSA PRIVATE KEY-----`];
  const mixed = ["-----BEGIN PRIVATE KEY-----", `-${body[0]}`, `+${body[1]}`, ` ${body[0]}`, "------END PRIVATE KEY-----"].map((l, i) => (i === 0 ? ` ${l}` : l));
  for (const lines of [block("+"), block("-"), block(" "), block(""), mixed]) {
    const diff = ["@@ -1,4 +1,4 @@", ...lines, " const retries = 3;"].join("\n");
    const out = maskSecrets(diff);
    for (const b of body) assert.ok(!out.includes(b), out);
    assert.equal(out.split("\n").length, diff.split("\n").length, out); // 줄 수 유지
    assert.ok(out.endsWith("\n const retries = 3;"));
  }
  assert.equal(maskSecrets(block("-").join("\n")), "-[비밀 키 마스킹됨]\n-\n-\n-");
});
