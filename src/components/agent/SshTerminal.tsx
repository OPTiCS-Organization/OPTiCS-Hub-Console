import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';

type SshTerminalProps = {
  socket: Socket;
  token: string;
  onClose: () => void;
};

type OpenResponse = {
  ok: boolean;
  sessionId?: string;
  error?: string;
};

export default function SshTerminal({ socket, token, onClose }: SshTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState('SSH 서버에 연결하는 중...');

  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: 13,
      theme: {
        background: '#151210',
        foreground: '#eae7e4',
        cursor: '#fd7a28',
        selectionBackground: '#4a443f',
      },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);
    fitAddon.fit();
    terminal.focus();

    const openTerminal = () => {
      socket.emit('terminal-open', {
        token,
        cols: terminal.cols,
        rows: terminal.rows,
      }, (response: OpenResponse) => {
        if (!response.ok || !response.sessionId) {
          setStatus(response.error ?? '터미널 세션을 열지 못했습니다.');
          terminal.writeln(`\r\n[OPTiCS] ${response.error ?? '터미널 세션을 열지 못했습니다.'}`);
          return;
        }
        sessionIdRef.current = response.sessionId;
      });
    };

    const handleReady = (payload: { sessionId: string }) => {
      if (payload.sessionId !== sessionIdRef.current) return;
      setStatus('연결됨');
      terminal.focus();
    };
    const handleOutput = (payload: { sessionId: string; data: string }) => {
      if (payload.sessionId === sessionIdRef.current) terminal.write(payload.data);
    };
    const handleClosed = (payload: { sessionId: string; reason?: string }) => {
      if (payload.sessionId !== sessionIdRef.current) return;
      sessionIdRef.current = null;
      const reason = payload.reason ?? '세션이 종료되었습니다.';
      setStatus(reason);
      terminal.writeln(`\r\n\r\n[OPTiCS] ${reason}`);
    };

    socket.on('terminal-ready', handleReady);
    socket.on('terminal-output', handleOutput);
    socket.on('terminal-closed', handleClosed);
    const input = terminal.onData(data => {
      const sessionId = sessionIdRef.current;
      if (sessionId) socket.emit('terminal-input', { sessionId, data });
    });
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      const sessionId = sessionIdRef.current;
      if (sessionId) {
        socket.emit('terminal-resize', { sessionId, cols: terminal.cols, rows: terminal.rows });
      }
    });
    resizeObserver.observe(containerRef.current);
    openTerminal();

    return () => {
      const sessionId = sessionIdRef.current;
      if (sessionId) socket.emit('terminal-close', { sessionId });
      socket.off('terminal-ready', handleReady);
      socket.off('terminal-output', handleOutput);
      socket.off('terminal-closed', handleClosed);
      resizeObserver.disconnect();
      input.dispose();
      terminal.dispose();
    };
  }, [socket, token]);

  return (
    <section className="overflow-hidden rounded-md border border-border-color bg-[#151210]">
      <div className="flex items-center justify-between border-b border-border-color bg-modal-box-color px-3 py-2">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${status === '연결됨' ? 'bg-success-color' : 'bg-warning-color'}`} />
          <span className="text-xs text-secondary-text-color">{status}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer rounded-sm p-1 text-secondary-text-color hover:bg-white/5 hover:text-primary-text-color"
          aria-label="터미널 닫기"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div ref={containerRef} className="h-[460px] w-full p-2" />
    </section>
  );
}
