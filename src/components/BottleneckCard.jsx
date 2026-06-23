function BottleneckCard({ bottleneck }) {
  const severityStyles = {
    Critical: {
      border: "border-red-500",
      badge: "bg-red-500 text-white",
      icon: "🔴",
    },
    Warning: {
      border: "border-yellow-500",
      badge: "bg-yellow-500 text-black",
      icon: "🟡",
    },
    OK: {
      border: "border-green-500",
      badge: "bg-green-500 text-white",
      icon: "🟢",
    },
  };

  const typeIcons = {
    Data: "📦",
    Compute: "⚡",
    Memory: "🧠",
    Inference: "🤖",
    Pipeline: "🔗",
  };

  const style = severityStyles[bottleneck.severity];

  return (
    <div className={`bg-gray-900 border ${style.border} rounded-xl p-5`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{typeIcons[bottleneck.type] || "⚠️"}</span>
          <span className="font-bold text-white text-lg">{bottleneck.title}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">{bottleneck.type}</span>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${style.badge}`}>
            {style.icon} {bottleneck.severity}
          </span>
        </div>
      </div>

      <p className="text-gray-400 text-sm mb-3">{bottleneck.description}</p>

      <div className="bg-gray-800 rounded-lg p-3">
        <p className="text-xs text-blue-400 font-bold mb-1">💡 SUGGESTED FIX</p>
        <p className="text-gray-300 text-sm">{bottleneck.fix}</p>
      </div>
    </div>
  );
}

export default BottleneckCard;