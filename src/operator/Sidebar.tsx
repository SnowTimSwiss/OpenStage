import { useStore } from "../store/useStore";
import type { TabId } from "../types";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "slides",    label: "Folien",    icon: "🖼️" },
  { id: "songs",     label: "Lieder",    icon: "🎵" },
  { id: "countdown", label: "Countdown", icon: "⏱️" },
  { id: "video",     label: "Video",     icon: "🎬" },
  { id: "music",     label: "Musik",     icon: "🎧" },
  { id: "display",   label: "Display",   icon: "🖥️" },
];

export default function Sidebar() {
  const activeTab = useStore((s) => s.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);

  return (
    <nav
      className="flex flex-col gap-1 py-3 px-2 w-[72px] shrink-0 border-r"
      style={{ borderColor: "#252525", background: "#0d0d0d" }}
    >
      {TABS.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex flex-col items-center justify-center gap-1 py-3 rounded-lg transition-all text-[10px] font-medium"
            style={{
              background: active ? "#f9731620" : "transparent",
              color: active ? "#f97316" : "#555",
              border: active ? "1px solid #f9731640" : "1px solid transparent",
            }}
            title={tab.label}
          >
            <span className="text-xl leading-none">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
