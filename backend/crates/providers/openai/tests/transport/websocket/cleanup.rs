//! 验证上游停止读请求时，发送超时仍能返回并释放连接

use super::*;
use gateway_core::engine::response_control::{ResponseControl, ResponseControlUnavailable};
use std::assert_matches;

#[tokio::test]
async fn send_timeout_should_abort_stalled_pump_and_allow_next_request() {
    let socket = tokio::net::TcpSocket::new_v4().unwrap();
    socket.set_recv_buffer_size(8192).unwrap();
    socket.bind("127.0.0.1:0".parse().unwrap()).unwrap();
    let listener = socket.listen(2).unwrap();
    let addr = listener.local_addr().unwrap();
    let (started, started_rx) = tokio::sync::oneshot::channel();
    let (drain, drain_rx) = tokio::sync::oneshot::channel();
    let server = tokio::spawn(async move {
        let (stream, _) = listener.accept().await.unwrap();
        // 不协商压缩，保证大请求填满 TCP 发送缓冲，而不是压缩后一次写完
        let mut websocket = accept_codex_test_websocket_with(stream, |_, response| {
            response.headers_mut().remove("sec-websocket-extensions");
        })
        .await;
        assert_matches!(websocket.next().await.unwrap().unwrap(), Message::Text(_));
        // 先归还一条可复用连接，再用控制消息填满发送缓冲，避免假定单帧必然阻塞
        let terminal = br#"{"type":"response.completed","response":{"id":"resp_before_send_timeout","status":"completed","output":[]}}"#;
        assert!(terminal.len() < 126);
        websocket
            .get_mut()
            .write_all(&[0x81, u8::try_from(terminal.len()).unwrap()])
            .await
            .unwrap();
        websocket.get_mut().write_all(terminal).await.unwrap();
        websocket.get_mut().read_u8().await.unwrap();
        started.send(()).unwrap();
        drain_rx.await.unwrap();
        // 只排空已进入内核的字节；必须看到 EOF，证明客户端已释放物理 socket
        tokio::io::copy(websocket.get_mut(), &mut tokio::io::sink())
            .await
            .unwrap();

        let (stream, _) = listener.accept().await.unwrap();
        let mut websocket = accept_codex_test_websocket(stream).await;
        assert_matches!(websocket.next().await.unwrap().unwrap(), Message::Text(_));
        websocket
            .send(Message::Text(
                completed_websocket_response("resp_after_send_timeout", 2, 1).into(),
            ))
            .await
            .unwrap();
    });
    let pool = Arc::new(CodexWebSocketPool::with_config(CodexWebSocketPoolConfig {
        maintenance_interval: None,
        ..CodexWebSocketPoolConfig::default()
    }));
    let backend = CodexBackendClient::new(
        reqwest::Client::builder().no_proxy().build().unwrap(),
        format!("http://{addr}"),
        test_wire_profile(),
    )
    .with_websocket_pool(Arc::clone(&pool));
    let control = ResponseControl::default();
    let mut initial_context = request_context("before_stalled_send", Some("chatgpt-account"));
    initial_context.response_control = Some(&control);
    backend
        .create_response(&pooled_websocket_request("stalled-send"), initial_context)
        .await
        .unwrap();
    let payload = json!({"type":"future.control","data":"x".repeat(16 * 1024 * 1024)}).to_string();
    let pending_control = send_control_until_closed(&control, &payload);
    tokio::pin!(pending_control);
    tokio::select! {
        result = &mut pending_control => panic!("control write should stall: {result:?}"),
        ready = started_rx => ready.unwrap(),
        () = tokio::time::sleep(Duration::from_secs(5)) => panic!("control write should start"),
    }
    assert!(
        timeout(Duration::from_millis(50), &mut pending_control)
            .await
            .is_err(),
        "the unread connection must keep the control write blocked"
    );
    let request = pooled_websocket_request("stalled-send");
    let error = {
        let pending = backend.create_response_stream(
            &request,
            request_context("stalled_send", Some("chatgpt-account")),
        );
        tokio::pin!(pending);
        tokio::select! {
            result = &mut pending => panic!("send should stall: {}", result.is_ok()),
            () = tokio::time::sleep(Duration::from_millis(50)) => {},
        }
        // 握手和首次写入用真实时间，随后仅快进发送 deadline，避免等待五分钟
        tokio::time::pause();
        tokio::time::advance(Duration::from_secs(301)).await;
        let result = timeout(Duration::from_secs(1), &mut pending).await;
        tokio::time::resume();
        result
            .expect("send timeout must not wait for Close on the stalled pump")
            .err()
            .expect("stalled send should fail")
    };
    let CodexClientError::WebSocket(error) = error else {
        panic!("expected WebSocket send failure: {error:?}");
    };
    let CodexWebSocketExchangeError::ConnectionObserved { source, .. } = error else {
        panic!("send timeout must retain its connection observation: {error:?}");
    };
    let CodexWebSocketExchangeError::PostSendAmbiguous {
        source: Some(source),
        ..
    } = source.as_ref()
    else {
        panic!("send timeout must retain its post-send ambiguity: {source:?}");
    };
    assert_matches!(
        source.as_ref(),
        CodexWebSocketExchangeError::SendTimeout { .. }
    );
    assert_eq!(
        timeout(Duration::from_secs(1), &mut pending_control)
            .await
            .unwrap(),
        Err(ResponseControlUnavailable)
    );
    drain.send(()).unwrap();
    let response = timeout(
        Duration::from_secs(5),
        backend.create_response(
            &pooled_websocket_request("stalled-send"),
            request_context("after_stalled_send", Some("chatgpt-account")),
        ),
    )
    .await
    .expect("failed request must release the pool reservation and socket")
    .unwrap();
    assert!(response.body.contains("resp_after_send_timeout"));
    server.await.unwrap();
    pool.shutdown().await;
}
