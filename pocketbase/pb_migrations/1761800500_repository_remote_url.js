/// <reference path="../pb_data/types.d.ts" />

// 저장소의 원격 URL. 서버가 이 URL을 REPOS_DIR 아래에 클론하고(local_path), 리뷰 전에 fetch한다.
// 비어 있으면 예전처럼 local_path의 저장소를 그대로 읽는다.
migrate((app) => {
  const repos = app.findCollectionByNameOrId("repositories");
  repos.fields.add(new TextField({ name: "remote_url", max: 500 }));
  app.save(repos);
}, (app) => {
  const repos = app.findCollectionByNameOrId("repositories");
  repos.fields.removeByName("remote_url");
  app.save(repos);
});
