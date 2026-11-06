//! 请求排空的鉴权、接纳恢复与响应体生命周期验证
use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use tower::ServiceExt;

async fn drain_control(app: axum::Router, method: &str) -> serde_json::Value {
    let response = app
        .oneshot(
            Request::builder()
                .uri("/internal/drain")
                .method(method)
                .extension(axum::extract::ConnectInfo(
                    "127.0.0.1:1234".parse::<std::net::SocketAddr>().unwrap(),
                ))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    serde_json::from_slice(
        &axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap()
}

#[tokio::test]
async fn request_drain_tracks_body_lifetime_and_restores_admission() {
    let app =
        crate::openai::api_router_with_admin(crate::admin::AdminTestFixture::new().await.services);
    assert_eq!(drain_control(app.clone(), "GET").await["activeRequests"], 0);
    // 无认证响应也必须在 body 交付或取消后释放，不能只等 handler 返回
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/v1/models")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    assert_eq!(
        drain_control(app.clone(), "POST").await["activeRequests"],
        1
    );
    let blocked = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/v1/alpha/search")
                .method("POST")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(blocked.status(), StatusCode::SERVICE_UNAVAILABLE);
    drop(response);
    assert_eq!(drain_control(app.clone(), "GET").await["activeRequests"], 0);
    assert_eq!(
        drain_control(app.clone(), "DELETE").await["draining"],
        false
    );
    let resumed = app
        .oneshot(
            Request::builder()
                .uri("/v1/models")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(resumed.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn request_drain_rejects_external_and_forwarded_control() {
    let app =
        crate::openai::api_router_with_admin(crate::admin::AdminTestFixture::new().await.services);
    for (peer, forwarded) in [
        (None, false),
        (Some("192.0.2.10:1234"), false),
        (Some("127.0.0.1:1234"), true),
    ] {
        let mut request = Request::builder().uri("/internal/drain").method("POST");
        if let Some(peer) = peer {
            request = request.extension(axum::extract::ConnectInfo(
                peer.parse::<std::net::SocketAddr>().unwrap(),
            ));
        }
        if forwarded {
            request = request.header("x-forwarded-for", "127.0.0.1");
        }
        let response = app
            .clone()
            .oneshot(request.body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
    }
    assert_eq!(drain_control(app, "GET").await["draining"], false);
}
