'use client';

export default function AuditPage() {
  return (
    <div className="-m-4 lg:-m-6" style={{ height: 'calc(100vh - 57px)' }}>
      <iframe
        src="/audit-dashboard.html"
        className="w-full h-full border-0"
        title="Medical Audit Dashboard"
      />
    </div>
  );
}
