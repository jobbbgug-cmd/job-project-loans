'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

export default function AuditPage() {
  const { theme } = useTheme();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Send theme to iframe whenever it changes
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const sendTheme = () => {
      iframe.contentWindow?.postMessage({ type: 'SET_THEME', theme }, '*');
    };

    // Send on load
    iframe.addEventListener('load', sendTheme);
    // Also send immediately if already loaded
    sendTheme();

    return () => iframe.removeEventListener('load', sendTheme);
  }, [theme]);

  return (
    <div className="-m-4 lg:-m-6" style={{ height: 'calc(100vh - 57px)' }}>
      <iframe
        ref={iframeRef}
        src={`/audit-dashboard.html?theme=${theme}`}
        className="w-full h-full border-0"
        title="Medical Audit Dashboard"
      />
    </div>
  );
}
