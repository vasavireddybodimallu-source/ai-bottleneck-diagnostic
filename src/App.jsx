import { useState } from "react";
import Dashboard from "./components/Dashboard";

function analyzeLocally(code) {
  const bottlenecks = [];

  if (code.includes("num_workers=0") || code.includes("num_workers = 0")) {
    bottlenecks.push({
      type: "Data",
      severity: "Critical",
      title: "DataLoader num_workers=0",
      description: "Data is loaded on the main process only, causing the GPU to sit idle while waiting for data.",
      fix: "Set num_workers=4 or higher to load data in parallel: DataLoader(dataset, num_workers=4)"
    });
  }

  if (code.includes("batch_size=1") || code.includes("batch_size = 1")) {
    bottlenecks.push({
      type: "Compute",
      severity: "Critical",
      title: "Batch size too small",
      description: "Batch size of 1 severely underutilizes the GPU and slows training dramatically.",
      fix: "Increase batch size to 32, 64, or 128 depending on your GPU memory."
    });
  }

  if (code.includes("time.sleep")) {
    bottlenecks.push({
      type: "Data",
      severity: "Critical",
      title: "Sleep in data pipeline",
      description: "time.sleep() inside the dataset causes artificial delays on every single sample fetch.",
      fix: "Remove time.sleep() from __getitem__. Preprocessing should be fast or cached."
    });
  }

  if (!code.includes("zero_grad")) {
    bottlenecks.push({
      type: "Compute",
      severity: "Critical",
      title: "Missing optimizer.zero_grad()",
      description: "Gradients accumulate across batches causing incorrect updates and memory growth.",
      fix: "Add optimizer.zero_grad() at the start of each training loop iteration."
    });
  }

  if (code.includes("torch.save") && code.includes("for epoch")) {
    bottlenecks.push({
      type: "Pipeline",
      severity: "Warning",
      title: "Saving model every epoch",
      description: "Saving the full model on every epoch causes unnecessary disk I/O and slows training.",
      fix: "Save only when validation loss improves, or every N epochs."
    });
  }

  if (code.includes("shuffle=True") && code.includes("num_workers=0")) {
    bottlenecks.push({
      type: "Data",
      severity: "Warning",
      title: "Shuffle with no parallelism",
      description: "Shuffling without parallel workers makes data loading even slower.",
      fix: "Enable num_workers >= 2 when using shuffle=True."
    });
  }

  if (code.includes(".cpu()") || code.includes("to('cpu')")) {
    bottlenecks.push({
      type: "Compute",
      severity: "Warning",
      title: "Unnecessary CPU transfer",
      description: "Moving tensors to CPU mid-training breaks the GPU pipeline and causes slowdowns.",
      fix: "Keep tensors on GPU throughout training. Only move to CPU for final output/logging."
    });
  }

  if (code.includes("nn.Linear") && !code.includes("nn.BatchNorm")) {
    bottlenecks.push({
      type: "Compute",
      severity: "Warning",
      title: "No BatchNormalization",
      description: "Deep linear networks without BatchNorm can train slowly and unstably.",
      fix: "Add nn.BatchNorm1d() between linear layers to speed up convergence."
    });
  }

  if (bottlenecks.length === 0) {
    bottlenecks.push({
      type: "Pipeline",
      severity: "OK",
      title: "No major bottlenecks detected",
      description: "Your code looks reasonably optimized based on static analysis.",
      fix: "Consider profiling with torch.profiler for deeper runtime analysis."
    });
  }

  const criticalCount = bottlenecks.filter(b => b.severity === "Critical").length;
  const overallHealth = criticalCount >= 2 ? "Poor" : criticalCount === 1 ? "Moderate" : "Good";

  return {
    summary: `Found ${bottlenecks.length} issue(s) in your AI pipeline. ${criticalCount} critical bottleneck(s) detected.`,
    bottlenecks,
    overallHealth
  };
}

function App() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const analyzeCode = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setResult(null);
    await new Promise(r => setTimeout(r, 1500));
    const parsed = analyzeLocally(code);
    setResult(parsed);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-blue-400 mb-2">
            🔍 AI Bottleneck Diagnostic
          </h1>
          <p className="text-gray-400">
            Paste your AI code below and get an instant diagnostic report
          </p>
        </div>

        <div className="mb-4">
          <textarea
            className="w-full h-64 bg-gray-900 border border-gray-700 rounded-xl p-4 text-sm font-mono text-gray-200 focus:outline-none focus:border-blue-500"
            placeholder="Paste your AI/ML code here... (Python, PyTorch, TensorFlow, etc.)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>

        <div className="mb-4 flex gap-3">
          <button
            onClick={() => setCode(`import torch
from torch.utils.data import DataLoader

dataset = LargeDataset()
loader = DataLoader(dataset, batch_size=1, num_workers=0, shuffle=True)

model = HugeModel()
optimizer = torch.optim.SGD(model.parameters(), lr=0.1)
criterion = torch.nn.MSELoss()

for epoch in range(100):
    for batch in loader:
        import time
        time.sleep(0.001)
        output = model(batch)
        loss = criterion(output, batch)
        loss.backward()
        optimizer.step()
    torch.save(model.state_dict(), "model.pt")`)}
            className="text-sm bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-gray-300"
          >
            Load Sample Code
          </button>

          <button
            onClick={analyzeCode}
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 text-white font-bold py-2 px-6 rounded-xl transition"
          >
            {loading ? "Analyzing..." : "🔍 Analyze Bottlenecks"}
          </button>
        </div>

        {result && <Dashboard result={result} />}
      </div>
    </div>
  );
}

export default App;