export function AlertModal({ alert, onClose }: { alert: any; onClose: () => void }) {
  if (!alert) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Support Resources</h2>
        <p>We noticed possible distress signals. Consider these resources:</p>
        <ul>
          {(alert.resources || []).map((r: any, i: number) => (
            <li key={i}>
              {r.url ? <a href={r.url} target="_blank" rel="noreferrer">{r.label}</a> : r.label}
            </li>
          ))}
        </ul>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}