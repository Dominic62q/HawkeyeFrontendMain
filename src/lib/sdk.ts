/**
 * Setup snippets for the Sentry SDKs. Hawkeye speaks the Sentry protocol, so the
 * stock SDKs work unchanged: install one, then point it at the project's DSN.
 */
export interface SdkGuide {
  id: string;
  label: string;
  /** Platform ids (see PLATFORMS) that should open on this guide. */
  platforms: string[];
  install: string;
  /** Code to paste into the app. `__DSN__` is replaced with the project's DSN. */
  setup: string;
  /** A line that sends one test error, so people can see it arrive. */
  test: string;
  lang: string;
}

export const SDK_GUIDES: SdkGuide[] = [
  {
    id: "javascript",
    label: "JavaScript",
    platforms: ["javascript"],
    lang: "js",
    install: "npm install @sentry/browser",
    setup: `import * as Sentry from "@sentry/browser";

Sentry.init({ dsn: "__DSN__" });`,
    test: `Sentry.captureException(new Error("Hawkeye test error"));`,
  },
  {
    id: "react",
    label: "React",
    platforms: ["javascript-react"],
    lang: "js",
    install: "npm install @sentry/react",
    setup: `import * as Sentry from "@sentry/react";

Sentry.init({ dsn: "__DSN__" });`,
    test: `Sentry.captureException(new Error("Hawkeye test error"));`,
  },
  {
    id: "nextjs",
    label: "Next.js",
    platforms: ["javascript-nextjs"],
    lang: "js",
    install: "npm install @sentry/nextjs",
    setup: `// In your client and server Sentry init files
import * as Sentry from "@sentry/nextjs";

Sentry.init({ dsn: "__DSN__" });`,
    test: `Sentry.captureException(new Error("Hawkeye test error"));`,
  },
  {
    id: "node",
    label: "Node.js",
    platforms: ["node"],
    lang: "js",
    install: "npm install @sentry/node",
    setup: `// Run this before the rest of your app loads
import * as Sentry from "@sentry/node";

Sentry.init({ dsn: "__DSN__" });`,
    test: `Sentry.captureException(new Error("Hawkeye test error"));`,
  },
  {
    id: "python",
    label: "Python",
    platforms: ["python"],
    lang: "py",
    install: "pip install sentry-sdk",
    setup: `import sentry_sdk

sentry_sdk.init(dsn="__DSN__")`,
    test: `sentry_sdk.capture_exception(Exception("Hawkeye test error"))`,
  },
  {
    id: "django",
    label: "Django",
    platforms: ["python-django"],
    lang: "py",
    install: `pip install "sentry-sdk[django]"`,
    setup: `# settings.py
import sentry_sdk

sentry_sdk.init(dsn="__DSN__")`,
    test: `sentry_sdk.capture_exception(Exception("Hawkeye test error"))`,
  },
  {
    id: "flask",
    label: "Flask",
    platforms: ["python-flask"],
    lang: "py",
    install: `pip install "sentry-sdk[flask]"`,
    setup: `# Before you create the Flask app
import sentry_sdk

sentry_sdk.init(dsn="__DSN__")`,
    test: `sentry_sdk.capture_exception(Exception("Hawkeye test error"))`,
  },
  {
    id: "fastapi",
    label: "FastAPI",
    platforms: ["python-fastapi"],
    lang: "py",
    install: `pip install "sentry-sdk[fastapi]"`,
    setup: `# Before you create the FastAPI app
import sentry_sdk

sentry_sdk.init(dsn="__DSN__")`,
    test: `sentry_sdk.capture_exception(Exception("Hawkeye test error"))`,
  },
  {
    id: "php",
    label: "PHP",
    platforms: ["php"],
    lang: "php",
    install: "composer require sentry/sentry",
    setup: `\\Sentry\\init(['dsn' => '__DSN__']);`,
    test: `\\Sentry\\captureException(new \\Exception('Hawkeye test error'));`,
  },
  {
    id: "ruby",
    label: "Ruby",
    platforms: ["ruby"],
    lang: "rb",
    install: "bundle add sentry-ruby",
    setup: `Sentry.init do |config|
  config.dsn = "__DSN__"
end`,
    test: `Sentry.capture_exception(StandardError.new("Hawkeye test error"))`,
  },
  {
    id: "go",
    label: "Go",
    platforms: ["go"],
    lang: "go",
    install: "go get github.com/getsentry/sentry-go",
    setup: `err := sentry.Init(sentry.ClientOptions{Dsn: "__DSN__"})
if err != nil {
    log.Fatalf("sentry.Init: %s", err)
}
defer sentry.Flush(2 * time.Second)`,
    test: `sentry.CaptureException(errors.New("Hawkeye test error"))`,
  },
  {
    id: "dotnet",
    label: ".NET",
    platforms: ["dotnet"],
    lang: "cs",
    install: "dotnet add package Sentry",
    setup: `SentrySdk.Init(options =>
{
    options.Dsn = "__DSN__";
});`,
    test: `SentrySdk.CaptureException(new Exception("Hawkeye test error"));`,
  },
  {
    id: "rust",
    label: "Rust",
    platforms: ["rust"],
    lang: "rs",
    install: "cargo add sentry",
    setup: `// Keep the guard alive for as long as your app runs
let _guard = sentry::init("__DSN__");`,
    test: `sentry::capture_message("Hawkeye test error", sentry::Level::Error);`,
  },
  {
    id: "java",
    label: "Java",
    platforms: ["java"],
    lang: "java",
    install: "// Add io.sentry:sentry to your Gradle or Maven dependencies",
    setup: `Sentry.init(options -> options.setDsn("__DSN__"));`,
    test: `Sentry.captureException(new Exception("Hawkeye test error"));`,
  },
];

export function guideFor(platform: string | null | undefined): SdkGuide {
  return SDK_GUIDES.find((g) => platform && g.platforms.includes(platform)) ?? SDK_GUIDES[0];
}
