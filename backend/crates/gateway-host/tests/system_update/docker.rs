//! Docker 更新候选、上游隔离与拒绝在线安装的行为测试

use super::*;
use gateway_admin::model::system::DockerBuildStatus;

const CURRENT: &str = "1111111111111111111111111111111111111111";
const LATEST: &str = "2222222222222222222222222222222222222222";

#[tokio::test]
async fn docker_missing_unknown_and_identical_builds_do_not_signal_updates() {
    for (sha, runs, expected) in [
        (CURRENT, serde_json::json!([]), DockerBuildStatus::NoBuild),
        (
            "unknown",
            serde_json::json!([{"id":1,"head_sha":LATEST,"head_branch":"main","conclusion":"success"}]),
            DockerBuildStatus::Unknown,
        ),
        (
            LATEST,
            serde_json::json!([{"id":1,"head_sha":LATEST,"head_branch":"main","conclusion":"success"}]),
            DockerBuildStatus::Current,
        ),
    ] {
        let server = MockServer::start().await;
        let fixture = Fixture::new();
        let mut config = fixture.config(&format!("{}/repos", server.uri()));
        config.deployment_mode = "docker".to_owned();
        config.git_sha = sha.to_owned();
        Mock::given(method("GET"))
            .and(path(
                "/repos/owner/repository/actions/workflows/docker.yml/runs",
            ))
            .respond_with(
                ResponseTemplate::new(200).set_body_json(serde_json::json!({"workflow_runs":runs})),
            )
            .mount(&server)
            .await;
        let service = ProcessSystemOperations::new(CancellationToken::new(), config);
        let detail = service.update_detail(true, None).await.unwrap();
        assert!(!detail.has_update);
        assert_eq!(detail.docker.unwrap().status, expected);
        assert!(
            server
                .received_requests()
                .await
                .unwrap()
                .iter()
                .all(|request| !request.url.path().contains("/compare/"))
        );
    }
}

#[tokio::test]
async fn docker_failed_refresh_clears_old_candidate_but_keeps_upstream_information() {
    let server = MockServer::start().await;
    let fixture = Fixture::new();
    let mut config = fixture.config(&format!("{}/repos", server.uri()));
    config.deployment_mode = "docker".to_owned();
    config.git_sha = CURRENT.to_owned();
    Mock::given(method("GET"))
        .and(path(
            "/repos/owner/repository/actions/workflows/docker.yml/runs",
        ))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "workflow_runs":[{"id":1,"head_sha":LATEST,"head_branch":"main","conclusion":"success"}]
        })))
        .mount(&server)
        .await;
    Mock::given(method("GET"))
        .and(path(format!(
            "/repos/owner/repository/compare/{CURRENT}...{LATEST}"
        )))
        .respond_with(
            ResponseTemplate::new(200).set_body_json(serde_json::json!({"status":"ahead"})),
        )
        .mount(&server)
        .await;
    let service = ProcessSystemOperations::new(CancellationToken::new(), config);
    assert!(service.update_detail(true, None).await.unwrap().has_update);
    server.reset().await;
    Mock::given(method("GET"))
        .and(path("/repos/zyycn/codex-proxy-rs/releases/latest"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "tag_name":"v3.41.2","prerelease":false,"body":"upstream notes"
        })))
        .mount(&server)
        .await;
    let detail = service.update_detail(true, None).await.unwrap();
    assert!(!detail.has_update);
    assert!(detail.warning.is_some());
    let docker = detail.docker.unwrap();
    assert!(docker.latest_sha.is_none());
    assert_eq!(docker.status, DockerBuildStatus::Unknown);
    assert_eq!(docker.upstream_version.as_deref(), Some("v3.41.2"));
    assert!(docker.upstream_warning.is_none());
    assert!(!service.update_detail(false, None).await.unwrap().has_update);
}

#[tokio::test]
async fn docker_build_comparison_does_not_offer_downgrades_or_diverged_commits() {
    for (relation, expected) in [
        ("ahead", DockerBuildStatus::Available),
        ("behind", DockerBuildStatus::Ahead),
        ("identical", DockerBuildStatus::Current),
        ("diverged", DockerBuildStatus::Unknown),
    ] {
        let server = MockServer::start().await;
        let fixture = Fixture::new();
        let mut config = fixture.config(&format!("{}/repos", server.uri()));
        config.deployment_mode = "docker".to_owned();
        config.git_sha = CURRENT.to_owned();
        Mock::given(method("GET"))
            .and(path("/repos/owner/repository/actions/workflows/docker.yml/runs"))
            .and(query_param("branch", "main"))
            .and(query_param("status", "success"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "workflow_runs": [{"id": 42, "head_sha": LATEST, "head_branch": "main", "conclusion": "success"}]
            }))).mount(&server).await;
        Mock::given(method("GET"))
            .and(path(format!(
                "/repos/owner/repository/compare/{CURRENT}...{LATEST}"
            )))
            .respond_with(
                ResponseTemplate::new(200).set_body_json(serde_json::json!({"status": relation})),
            )
            .mount(&server)
            .await;
        let service = ProcessSystemOperations::new(CancellationToken::new(), config);
        let detail = service.update_detail(true, None).await.unwrap();
        assert_eq!(detail.has_update, expected == DockerBuildStatus::Available);
        assert!(!detail.update_supported);
        let docker = detail.docker.unwrap();
        assert_eq!(docker.status, expected);
        assert_eq!(docker.latest_sha.as_deref(), Some(LATEST));
        assert!(docker.upstream_warning.is_some());
        assert!(detail.warning.is_none());
        assert_eq!(
            docker.build_url.as_deref(),
            Some("https://github.com/owner/repository/actions/runs/42")
        );
    }
}

#[tokio::test]
async fn docker_rejects_install_and_rollback_before_network_or_file_changes() {
    let server = MockServer::start().await;
    let fixture = Fixture::new();
    let mut config = fixture.config(&format!("{}/repos", server.uri()));
    config.deployment_mode = "docker".to_owned();
    let service = ProcessSystemOperations::new(CancellationToken::new(), config);
    let error = service
        .perform_test_update(Some(TARGET_VERSION.to_owned()))
        .await
        .unwrap_err();
    assert!(error.message().contains("cpr update"));
    let error = service
        .rollback(Arc::new(AllowingUpdatePreflight))
        .await
        .unwrap_err();
    assert!(error.message().contains("cpr update"));
    assert!(!fixture.state().exists());
    assert!(server.received_requests().await.unwrap().is_empty());
}
