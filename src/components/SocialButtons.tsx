import { useState } from "react";
import { socialRedirect } from "../lib/auth";
import type { SocialApp } from "../lib/types";

/** One button per configured single sign-on provider. Renders nothing when there are none. */
export function SocialButtons({ apps, next }: { apps: SocialApp[]; next: string }) {
  const [busy, setBusy] = useState(false);
  if (apps.length === 0) return null;
  return (
    <div className="social">
      <span className="social-or">or</span>
      {apps.map((a) => (
        <button
          key={a.provider}
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void socialRedirect(a.provider, `${window.location.origin}${next}`);
          }}
        >
          Continue with {a.name}
        </button>
      ))}
    </div>
  );
}
