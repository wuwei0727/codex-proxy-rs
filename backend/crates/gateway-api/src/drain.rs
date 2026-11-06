//! 节点排空接纳与数据面请求生命周期，不统计空闲 TCP 连接

use crate::ApiState;
use axum::{
    Json,
    body::Body,
    extract::{ConnectInfo, Request, State},
    http::{HeaderMap, Method, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use http_body::{Body as HttpBody, Frame, SizeHint};
use serde::Serialize;
use std::{
    net::SocketAddr,
    pin::Pin,
    sync::{Arc, Mutex},
    task::{Context, Poll},
};

#[derive(Clone, Default)]
pub(crate) struct RequestActivity(Arc<Mutex<ActivityState>>);

#[derive(Default, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
struct ActivityState {
    draining: bool,
    active_requests: usize,
}

impl RequestActivity {
    pub(crate) fn enter(&self) -> Option<RequestGuard> {
        let mut state = self
            .0
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        if state.draining {
            return None;
        }
        state.active_requests += 1;
        Some(RequestGuard(self.clone()))
    }
}

pub(crate) struct RequestGuard(RequestActivity);

impl Drop for RequestGuard {
    fn drop(&mut self) {
        self.0
            .0
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .active_requests -= 1;
    }
}

// 仅信任真实 socket 地址，容器外代理和缺失连接信息的内部 dispatcher 都不能控制排空
pub(crate) async fn control(
    State(state): State<ApiState>,
    peer: Option<axum::Extension<ConnectInfo<SocketAddr>>>,
    method: Method,
    headers: HeaderMap,
) -> Response {
    if !peer.is_some_and(|axum::Extension(ConnectInfo(address))| address.ip().is_loopback())
        || headers.contains_key("forwarded")
        || headers.contains_key("x-forwarded-for")
        || headers.contains_key("origin")
    {
        return StatusCode::FORBIDDEN.into_response();
    }
    let activity = state.openai().activity();
    let mut current = activity
        .0
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    if method == Method::POST {
        current.draining = true;
    }
    if method == Method::DELETE {
        current.draining = false;
    }
    Json(*current).into_response()
}

pub(crate) async fn track_http(
    State(state): State<ApiState>,
    request: Request,
    next: Next,
) -> Response {
    let Some(guard) = state.openai().activity().enter() else {
        return crate::openai::error::runtime_unavailable_response().into_response();
    };
    let response = next.run(request).await;
    // Responses 在每个 response.create 内计数；live adapter 自己持有会话 guard
    if response.status() == StatusCode::SWITCHING_PROTOCOLS {
        return response;
    }
    let (parts, body) = response.into_parts();
    Response::from_parts(
        parts,
        Body::new(TrackedBody {
            inner: body,
            guard: Some(guard),
        }),
    )
}

struct TrackedBody {
    inner: Body,
    guard: Option<RequestGuard>,
}

impl HttpBody for TrackedBody {
    type Data = bytes::Bytes;
    type Error = axum::Error;

    fn poll_frame(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
    ) -> Poll<Option<Result<Frame<Self::Data>, Self::Error>>> {
        let result = Pin::new(&mut self.inner).poll_frame(cx);
        if matches!(result, Poll::Ready(None | Some(Err(_)))) || self.inner.is_end_stream() {
            self.guard.take();
        }
        result
    }

    fn is_end_stream(&self) -> bool {
        self.inner.is_end_stream()
    }
    fn size_hint(&self) -> SizeHint {
        self.inner.size_hint()
    }
}
