import BottleneckCard from "./BottleneckCard";

function Dashboard({ result }) {
  const healthColor = {
    Poor: "text-red-400",
    Moderate: "text-yellow-400",
    Good: "text-green-400",
  };

  return (
    <div className="mt-6">
      {/* Overall Health */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 mb-6">
        <h2 className="text-xl font-bold text-gray-300 mb-1">Overall Health</h2>
        <p className={`text-3xl font-bold ${healthColor[result.overallHealth]}`}>
          {result.overallHealth === "Poor" && "🔴"}
          {result.overallHealth === "Moderate" && "🟡"}
          {result.overallHealth === "Good" && "🟢"}
          {" "}{result.overallHealth}
        </p>
        <p className="text-gray-400 mt-2">{result.summary}</p>
      </div>

      {/* Bottleneck Cards */}
      <h2 className="text-xl font-bold text-gray-300 mb-4">
        Bottlenecks Found ({result.bottlenecks.length})
      </h2>
      <div className="grid grid-cols-1 gap-4">
        {result.bottlenecks.map((b, i) => (
          <BottleneckCard key={i} bottleneck={b} />
        ))}
      </div>
    </div>
  );
}

export default Dashboard;