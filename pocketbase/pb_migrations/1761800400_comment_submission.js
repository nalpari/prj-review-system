/// <reference path="../pb_data/types.d.ts" />

// - 댓글 submission_key: 같은 제출을 다시 보내도(응답 유실·일부 실패 뒤 재시도) 댓글은 하나만 생긴다.
// - batch API 활성화: 서버가 댓글과 이력을 한 트랜잭션으로 만든다(규칙은 요청마다 그대로 적용된다).
migrate((app) => {
  const comments = app.findCollectionByNameOrId("comments");
  comments.fields.add(new TextField({ name: "submission_key", max: 64 }));
  comments.addIndex("idx_comments_submission_key", true, "submission_key", "submission_key != ''");
  app.save(comments);

  const settings = app.settings();
  settings.batch.enabled = true;
  settings.batch.maxRequests = 50;
  settings.batch.timeout = 3;
  app.save(settings);
}, (app) => {
  const comments = app.findCollectionByNameOrId("comments");
  comments.removeIndex("idx_comments_submission_key");
  comments.fields.removeByName("submission_key");
  app.save(comments);
});
