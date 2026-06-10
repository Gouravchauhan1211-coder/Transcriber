import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import './QRModal.css';

interface Props {
  url: string;
  onClose: () => void;
}

export default function QRModal({ url, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, {
        width: 220,
        margin: 2,
        color: { dark: '#f0f2f8', light: '#161b28' },
      });
    }
  }, [url]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose} id="qr-modal-overlay">
      <div className="modal-card" onClick={(e) => e.stopPropagation()} id="qr-modal-card">
        <button className="modal-close" id="qr-close-btn" onClick={onClose}>✕</button>
        <h3 className="modal-title">Viewer QR Code</h3>
        <p className="modal-subtitle">Scan to join as a viewer</p>
        <div className="qr-canvas-wrap">
          <canvas ref={canvasRef} />
        </div>
        <p className="modal-url">{url}</p>
      </div>
    </div>
  );
}
