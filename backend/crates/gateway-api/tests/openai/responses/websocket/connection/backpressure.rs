//! 为真实 TCP 连接注入确定性的输出背压，避免依赖平台发送缓冲大小

use std::{
    io,
    net::SocketAddr,
    pin::Pin,
    task::{Context, Poll},
};
use tokio::{
    io::{AsyncRead, AsyncWrite, ReadBuf},
    net::{TcpListener, TcpStream},
};

pub(super) struct TestListener {
    listener: TcpListener,
    stall_output: bool,
}

impl TestListener {
    pub(super) fn new(listener: TcpListener, stall_output: bool) -> Self {
        Self {
            listener,
            stall_output,
        }
    }
}

impl axum::serve::Listener for TestListener {
    type Io = TestIo;
    type Addr = SocketAddr;

    async fn accept(&mut self) -> (Self::Io, Self::Addr) {
        let (stream, address) = self
            .listener
            .accept()
            .await
            .expect("accept test connection");
        (
            TestIo {
                stream,
                remaining: self.stall_output.then_some(64 * 1024),
            },
            address,
        )
    }

    fn local_addr(&self) -> io::Result<SocketAddr> {
        self.listener.local_addr()
    }
}

pub(super) struct TestIo {
    stream: TcpStream,
    remaining: Option<usize>,
}

impl AsyncRead for TestIo {
    fn poll_read(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut ReadBuf<'_>,
    ) -> Poll<io::Result<()>> {
        Pin::new(&mut self.stream).poll_read(cx, buf)
    }
}

impl AsyncWrite for TestIo {
    fn poll_write(
        mut self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &[u8],
    ) -> Poll<io::Result<usize>> {
        let allowed = self.remaining.unwrap_or(buf.len()).min(buf.len());
        if allowed == 0 && !buf.is_empty() {
            // 该连接刻意保持不可写，读取控制帧或断开仍可推进并取消在途写入
            return Poll::Pending;
        }
        let result = Pin::new(&mut self.stream).poll_write(cx, &buf[..allowed]);
        if let Poll::Ready(Ok(written)) = result
            && let Some(remaining) = &mut self.remaining
        {
            *remaining -= written;
        }
        result
    }

    fn poll_flush(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        Pin::new(&mut self.stream).poll_flush(cx)
    }

    fn poll_shutdown(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        Pin::new(&mut self.stream).poll_shutdown(cx)
    }
}
