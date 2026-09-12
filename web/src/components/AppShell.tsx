"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { ChatPanel } from "./ChatPanel";
import { NewBotModal, NewGroupModal, SettingsModal } from "./Modals";
import { useAppStore } from "@/lib/store";

export function AppShell() {
  const hydrated = useAppStore((s) => s.hydrated);
  const setHydrated = useAppStore((s) => s.setHydrated);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newBotOpen, setNewBotOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    const unsub = useAppStore.persist.onFinishHydration(() => setHydrated(true));
    if (useAppStore.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, [setHydrated]);

  if (!hydrated) {
    return (
      <div className="flex h-dvh items-center justify-center bg-[var(--bg)] text-[var(--muted)]">
        <div className="animate-pulse font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
          Crew
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-dvh overflow-hidden bg-[var(--bg)] text-[var(--ink)]">
      <div className="pointer-events-none absolute inset-0 ambient" aria-hidden />

      <div className="relative z-[1] flex h-full">
        <div className="hidden h-full w-[320px] shrink-0 md:block">
          <Sidebar
            onOpenSettings={() => setSettingsOpen(true)}
            onNewBot={() => setNewBotOpen(true)}
            onNewGroup={() => setNewGroupOpen(true)}
          />
        </div>

        {mobileNav && (
          <div className="fixed inset-0 z-40 md:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/35"
              aria-label="Close menu"
              onClick={() => setMobileNav(false)}
            />
            <div className="absolute inset-y-0 left-0 w-[86%] max-w-[320px] bg-[var(--panel)] shadow-[var(--shadow-lg)]">
              <Sidebar
                onOpenSettings={() => {
                  setMobileNav(false);
                  setSettingsOpen(true);
                }}
                onNewBot={() => {
                  setMobileNav(false);
                  setNewBotOpen(true);
                }}
                onNewGroup={() => {
                  setMobileNav(false);
                  setNewGroupOpen(true);
                }}
              />
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-[var(--line)] px-3 py-2 md:hidden">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setMobileNav((v) => !v)}
              aria-label="Menu"
            >
              {mobileNav ? <X size={18} /> : <Menu size={18} />}
            </button>
            <span className="font-[family-name:var(--font-display)] text-lg">Crew</span>
          </div>
          <ChatPanel />
        </div>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <NewBotModal open={newBotOpen} onClose={() => setNewBotOpen(false)} />
      <NewGroupModal open={newGroupOpen} onClose={() => setNewGroupOpen(false)} />
    </div>
  );
}
