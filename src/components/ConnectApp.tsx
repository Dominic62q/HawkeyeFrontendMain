import { useState } from "react";
import { guideFor, SDK_GUIDES } from "../lib/sdk";
import { useProjectKeys } from "../lib/queries";
import { CopyButton } from "./Copy";

function Snippet({ title, code }: { title: string; code: string }) {
  return (
    <div className="snip">
      <div className="snip-head">
        <span>{title}</span>
        <CopyButton text={code} />
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * Install-and-paste instructions for a project, with its real DSN filled in.
 * Hawkeye accepts the standard Sentry SDKs, so these point at those packages.
 */
export function ConnectApp({
  org,
  slug,
  platform,
  title = "Connect your app",
}: {
  org: string;
  slug: string;
  platform: string | null | undefined;
  title?: string;
}) {
  const keys = useProjectKeys(org, slug);
  const [picked, setPicked] = useState<string | null>(null);
  const guide = SDK_GUIDES.find((g) => g.id === picked) ?? guideFor(platform);
  const dsn = keys.data?.[0]?.dsn.public;

  return (
    <section className="connect" aria-label={title}>
      <h3 className="sec">{title}</h3>
      <p className="hint">
        Hawkeye works with the standard Sentry SDKs. Install one in your app, then paste in this project’s DSN.
      </p>
      <div className="seg wrapseg" role="tablist" aria-label="Language or framework">
        {SDK_GUIDES.map((g) => (
          <button
            key={g.id}
            role="tab"
            aria-selected={g.id === guide.id}
            className={g.id === guide.id ? "on" : ""}
            onClick={() => setPicked(g.id)}
          >
            {g.label}
          </button>
        ))}
      </div>
      {keys.isLoading ? (
        <div className="skel" style={{ height: 120, marginTop: 14 }} />
      ) : !dsn ? (
        <div className="card cpad soft" style={{ marginTop: 14 }}>
          This project has no key yet. Add one under Client keys above and the setup code will appear here.
        </div>
      ) : (
        <div className="snips">
          <Snippet title="1. Install" code={guide.install} />
          <Snippet title="2. Add to your app" code={guide.setup.replace("__DSN__", dsn)} />
          <Snippet title="3. Send a test error" code={guide.test} />
        </div>
      )}
    </section>
  );
}
