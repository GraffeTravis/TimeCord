export function Stat({
  label,
  value,
  detail,
  icon,
  progress,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  progress?: number;
}) {
  return (
    <section className="stat">
      <div className="stat-top">
        <span>{label}</span>
        {icon}
      </div>
      <strong>{value}</strong>
      <div className="stat-bottom">
        <span>{detail}</span>
        {progress !== undefined && <span>{Math.round(progress)} %</span>}
      </div>
      {progress !== undefined && (
        <div className="progress">
          <i style={{ width: `${progress}%` }} />
        </div>
      )}
    </section>
  );
}
export function Empty({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
