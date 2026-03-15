import { useStore } from "../../store/useStore";
import { sendVideoControl } from "../../lib/events";

export default function VideoTab() {
  const videos = useStore((s) => s.videos);
  const activeVideoId = useStore((s) => s.activeVideoId);
  const loadVideos = useStore((s) => s.loadVideos);
  const goLiveVideo = useStore((s) => s.goLiveVideo);
  const removeVideo = useStore((s) => s.removeVideo);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "#252525" }}>
        <h2 className="text-sm font-semibold text-white">Videos</h2>
        <button
          onClick={loadVideos}
          className="text-xs px-3 py-1.5 rounded font-medium"
          style={{ background: "#f97316", color: "white" }}
        >
          + Hinzufügen
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <span className="text-5xl">🎬</span>
            <p className="text-white font-medium">Keine Videos</p>
            <p className="text-sm" style={{ color: "#555" }}>MP4, MOV, WebM und mehr</p>
            <button onClick={loadVideos} className="text-sm px-4 py-2 rounded" style={{ background: "#f97316", color: "white" }}>
              Videos laden
            </button>
          </div>
        ) : (
          videos.map((video) => {
            const isActive = video.id === activeVideoId;
            return (
              <div
                key={video.id}
                className="flex items-center gap-3 p-3 rounded-lg"
                style={{
                  background: isActive ? "#f9731610" : "#141414",
                  border: isActive ? "1px solid #f9731640" : "1px solid #1e1e1e",
                }}
              >
                <div
                  className="w-10 h-10 rounded flex items-center justify-center shrink-0"
                  style={{ background: "#1a1a1a" }}
                >
                  🎬
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{video.name}</div>
                  {isActive && (
                    <div className="text-xs live-dot" style={{ color: "#22c55e" }}>● Live</div>
                  )}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {isActive && (
                    <>
                      <button
                        onClick={() => sendVideoControl("play")}
                        className="text-xs px-2 py-1.5 rounded"
                        style={{ background: "#22c55e20", color: "#22c55e" }}
                        title="Play"
                      >
                        ▶
                      </button>
                      <button
                        onClick={() => sendVideoControl("pause")}
                        className="text-xs px-2 py-1.5 rounded"
                        style={{ background: "#1a1a1a", color: "#888" }}
                        title="Pause"
                      >
                        ⏸
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => goLiveVideo(video.id)}
                    className="text-xs px-3 py-1.5 rounded font-medium"
                    style={{ background: isActive ? "#f97316" : "#1f1f1f", color: isActive ? "white" : "#888" }}
                  >
                    {isActive ? "● Live" : "Abspielen"}
                  </button>
                  <button
                    onClick={() => removeVideo(video.id)}
                    className="text-xs px-2 py-1.5 rounded"
                    style={{ background: "#2a0a0a", color: "#ef4444" }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
