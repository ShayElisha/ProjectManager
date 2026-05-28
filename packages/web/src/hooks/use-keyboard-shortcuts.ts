import { useEffect } from "react";
import { useAppStore } from "@/store/app-store";

type SeqHandler = () => void;

let pendingG = false;

export function useKeyboardShortcuts(onShowHelp?: () => void) {
  const setCommandOpen = useAppStore((s) => s.setCommandOpen);
  const setSection = useAppStore((s) => s.setSection);
  const setView = useAppStore((s) => s.setView);
  const setCreateTaskDialogOpen = useAppStore((s) => s.setCreateTaskDialogOpen);
  const section = useAppStore((s) => s.section);
  const activeProjectId = useAppStore((s) => s.activeProjectId);

  useEffect(() => {
    const handlers: Record<string, SeqHandler> = {
      d: () => setSection("dashboard"),
      p: () => activeProjectId && setSection("project"),
      r: () => setSection("reports"),
      b: () => setSection("budget"),
      t: () => setSection("team"),
    };

    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onShowHelp?.();
        return;
      }

      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setCommandOpen(true);
        return;
      }

      if (e.key === "n" && section === "project" && activeProjectId) {
        e.preventDefault();
        setCreateTaskDialogOpen(true);
        return;
      }

      if (e.key === "g") {
        pendingG = true;
        setTimeout(() => {
          pendingG = false;
        }, 800);
        return;
      }

      if (pendingG && handlers[e.key]) {
        e.preventDefault();
        pendingG = false;
        handlers[e.key]!();
        if (e.key === "p" && activeProjectId) setView("gantt");
      }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [
    section,
    activeProjectId,
    setCommandOpen,
    setSection,
    setView,
    setCreateTaskDialogOpen,
    onShowHelp,
  ]);
}
