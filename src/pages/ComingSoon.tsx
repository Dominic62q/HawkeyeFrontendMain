import { useParams } from "react-router-dom";

const LABELS: Record<string, string> = {
  uptime: "Uptime",
  performance: "Performance",
  logs: "Logs",
  releases: "Releases",
  settings: "Settings",
};

export function ComingSoon() {
  const { section = "" } = useParams();
  const name = LABELS[section] ?? "This page";
  return (
    <div className="wrap">
      <div className="empty">
        <h2>{name} is on its way</h2>
        <p>This part of Hawkeye hasn't been redesigned yet. Issues is ready to use.</p>
      </div>
    </div>
  );
}
