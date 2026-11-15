// The app's main navigation: Story | Plan | Science.
// The tabs are plain links to #story, #plan and #science, so the keyboard, a direct
// link and the browser's back and forward buttons all work without extra code.
import type { ReactNode } from "react";
import { APP_TABS, hashOfTab, type AppTab } from "../lib/appTabs";
import "../styles/app-tabs.css";

export function AppTabs({ current, onSelect }: { current: AppTab; onSelect: (tab: AppTab) => void }) {
  return (
    <nav className="app-tabs" aria-label="Main">
      {APP_TABS.map((tab) => (
        <a
          key={tab.id}
          href={hashOfTab(tab.id)}
          className={tab.id === current ? "is-current" : undefined}
          aria-current={tab.id === current ? "page" : undefined}
          onClick={(event) => {
            // Let the browser handle "open in a new tab" clicks.
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
            event.preventDefault();
            onSelect(tab.id);
          }}
        >
          {tab.label}
        </a>
      ))}
    </nav>
  );
}

/** The ARES logo. It always leads back to the Story tab. */
export function AppLogo({ onSelect }: { onSelect: (tab: AppTab) => void }) {
  return (
    <a
      className="console-home app-logo"
      href={hashOfTab("story")}
      aria-label="ARES home: the Story page"
      onClick={(event) => {
        event.preventDefault();
        onSelect("story");
        window.scrollTo(0, 0);
      }}
    >
      {/* The mission patch is an AI-generated image, so it always carries this visible label (docs/ai-disclosure.md). */}
      <span className="patch-mark">
        <img className="console-patch" src={`${import.meta.env.BASE_URL}brand/ares-patch.png`} alt="" width="36" height="30" />
        <span className="patch-mark__label">AI-generated</span>
      </span>
      <b>ARES</b>
    </a>
  );
}

/** The top bar of the Story and Science pages: logo, the tabs, and room for one action on the right. */
export function AppBar({ current, onSelect, children }: { current: AppTab; onSelect: (tab: AppTab) => void; children?: ReactNode }) {
  return (
    <header className="app-bar">
      <AppLogo onSelect={onSelect} />
      <AppTabs current={current} onSelect={onSelect} />
      <div className="app-bar__actions">{children}</div>
    </header>
  );
}
