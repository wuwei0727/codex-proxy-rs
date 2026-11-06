//! Docker 构建提交检查与独立的上游发行提示，不操作容器或安装文件

use std::time::Duration;

use gateway_admin::model::system::{
    DockerBuildStatus, DockerUpdateDetail, SystemUpdateChannel, SystemUpdateDetail,
};
use serde::Deserialize;

use super::release::{GitHubRelease, base_update_detail, fetch_release_json, validate_repository};
use super::{OperationError, SystemUpdateConfig, conflict};

#[derive(Deserialize)]
struct Runs {
    workflow_runs: Vec<Build>,
}

#[derive(Deserialize)]
struct Build {
    id: u64,
    head_sha: String,
    head_branch: String,
    conclusion: Option<String>,
}

#[derive(Deserialize)]
struct Comparison {
    status: String,
}

pub(super) async fn detail(
    config: &SystemUpdateConfig,
    channel: SystemUpdateChannel,
) -> Result<SystemUpdateDetail, OperationError> {
    let repository = config
        .update_repository
        .as_deref()
        .ok_or_else(|| conflict("未配置更新仓库 CPR_UPDATE_REPOSITORY"))?;
    validate_repository(repository)?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|error| super::error::http("无法初始化更新查询连接", error))?;
    let base = config.github_api_base.trim_end_matches('/');
    let mut result = base_update_detail(config, channel, config.update_support_error(), None);
    let mut docker = DockerUpdateDetail {
        repository: repository.to_owned(),
        current_sha: config.git_sha.clone(),
        latest_sha: None,
        build_url: None,
        status: DockerBuildStatus::Unknown,
        upstream_version: None,
        upstream_notes: None,
        upstream_warning: None,
    };
    // 两个来源独立失败，官方发布永远不成为自己的镜像候选
    let upstream_url = format!("{base}/zyycn/codex-proxy-rs/releases/latest");
    let (build, upstream) = tokio::join!(
        check_build(&client, base, repository, &config.git_sha),
        fetch_release_json::<GitHubRelease>(&client, &upstream_url),
    );
    match build {
        Ok((status, build)) => {
            docker.status = status;
            result.has_update = status == DockerBuildStatus::Available;
            if let Some(build) = build {
                docker.build_url = Some(format!(
                    "https://github.com/{repository}/actions/runs/{}",
                    build.id
                ));
                docker.latest_sha = Some(build.head_sha);
            }
        }
        Err(error) => result.warning = Some(error.message().to_owned()),
    }
    match upstream {
        Ok(release) => {
            docker.upstream_version = Some(release.tag_name);
            docker.upstream_notes = release.body;
        }
        Err(error) => docker.upstream_warning = Some(error.message().to_owned()),
    }
    result.docker = Some(docker);
    Ok(result)
}

async fn check_build(
    client: &reqwest::Client,
    base: &str,
    repository: &str,
    current: &str,
) -> Result<(DockerBuildStatus, Option<Build>), OperationError> {
    let runs: Runs = fetch_release_json(client, &format!(
        "{base}/{repository}/actions/workflows/docker.yml/runs?branch=main&status=success&per_page=1"
    )).await?;
    let Some(build) = runs.workflow_runs.into_iter().next() else {
        return Ok((DockerBuildStatus::NoBuild, None));
    };
    if build.head_branch != "main"
        || build.conclusion.as_deref() != Some("success")
        || !valid_sha(&build.head_sha)
    {
        return Err(conflict("镜像构建记录无效，无法确认更新"));
    }
    let status = if !valid_sha(current) {
        DockerBuildStatus::Unknown
    } else if current.eq_ignore_ascii_case(&build.head_sha) {
        DockerBuildStatus::Current
    } else {
        let comparison: Comparison = fetch_release_json(
            client,
            &format!("{base}/{repository}/compare/{current}...{}", build.head_sha),
        )
        .await?;
        match comparison.status.as_str() {
            "ahead" => DockerBuildStatus::Available,
            "behind" => DockerBuildStatus::Ahead,
            "identical" => DockerBuildStatus::Current,
            _ => DockerBuildStatus::Unknown,
        }
    };
    Ok((status, Some(build)))
}

fn valid_sha(value: &str) -> bool {
    value.len() == 40 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}
