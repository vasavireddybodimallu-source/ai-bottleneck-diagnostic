import { useState } from "react";
import BottleneckCard from "./components/BottleneckCard";

function analyzeLocally(code) {
  const bottlenecks = [];

  if (code.includes("num_workers=0") || code.includes("num_workers = 0")) {
    bottlenecks.push({ type: "Data", severity: "Critical", title: "DataLoader num_workers=0", description: "Data is loaded on the main process only, causing the GPU to sit idle while waiting for data.", fix: "Set num_workers=4 or higher to load data in parallel: DataLoader(dataset, num_workers=4)" });
  }
  if (code.includes("batch_size=1") || code.includes("batch_size = 1")) {
    bottlenecks.push({ type: "Compute", severity: "Critical", title: "Batch size too small", description: "Batch size of 1 severely underutilizes the GPU and slows training dramatically.", fix: "Increase batch size to 32, 64, or 128 depending on your GPU memory." });
  }
  if (code.includes("time.sleep")) {
    bottlenecks.push({ type: "Data", severity: "Critical", title: "Sleep in data pipeline", description: "time.sleep() inside the dataset causes artificial delays on every single sample fetch.", fix: "Remove time.sleep() from __getitem__. Preprocessing should be fast or cached." });
  }
  if (!code.includes("zero_grad")) {
    bottlenecks.push({ type: "Compute", severity: "Critical", title: "Missing optimizer.zero_grad()", description: "Gradients accumulate across batches causing incorrect updates and memory growth.", fix: "Add optimizer.zero_grad() at the start of each training loop iteration." });
  }
  if (code.includes("torch.save") && code.includes("for epoch")) {
    bottlenecks.push({ type: "Pipeline", severity: "Warning", title: "Saving model every epoch", description: "Saving the full model on every epoch causes unnecessary disk I/O and slows training.", fix: "Save only when validation loss improves, or every N epochs." });
  }
  if (code.includes("shuffle=True") && code.includes("num_workers=0")) {
    bottlenecks.push({ type: "Data", severity: "Warning", title: "Shuffle with no parallelism", description: "Shuffling without parallel workers makes data loading even slower.", fix: "Enable num_workers >= 2 when using shuffle=True." });
  }
  if (code.includes(".cpu()") || code.includes("to('cpu')")) {
    bottlenecks.push({ type: "Compute", severity: "Warning", title: "Unnecessary CPU transfer", description: "Moving tensors to CPU mid-training breaks the GPU pipeline and causes slowdowns.", fix: "Keep tensors on GPU throughout training. Only move to CPU for final output/logging." });
  }
  if (code.includes("tf.saved_model.save") && code.includes("for")) {
    bottlenecks.push({ type: "Pipeline", severity: "Warning", title: "Frequent model saving in loop", description: "Saving TensorFlow model inside a training loop adds heavy I/O overhead.", fix: "Use ModelCheckpoint callback or save only after full training." });
  }
  if (bottlenecks.length === 0) {
    bottlenecks.push({ type: "Pipeline", severity: "OK", title: "No major bottlenecks detected", description: "Your code looks reasonably optimized based on static analysis.", fix: "Consider profiling with torch.profiler for deeper runtime analysis." });
  }

  const criticalCount = bottlenecks.filter(b => b.severity === "Critical").length;
  const overallHealth = criticalCount >= 2 ? "Poor" : criticalCount === 1 ? "Moderate" : "Good";
  return { summary: `Found ${bottlenecks.length} issue(s). ${criticalCount} critical bottleneck(s) detected.`, bottlenecks, overallHealth };
}

const samples = [
  `# Sample 1: DataLoader issues
import torch
from torch.utils.data import DataLoader

loader = DataLoader(dataset, batch_size=1, num_workers=0, shuffle=True)
model = HugeModel()
optimizer = torch.optim.SGD(model.parameters(), lr=0.1)

for epoch in range(100):
    for batch in loader:
        output = model(batch)
        loss = criterion(output, batch)
        loss.backward()
        optimizer.step()
    torch.save(model.state_dict(), "model.pt")`,

  `# Sample 2: CPU transfer bottleneck
import torch
import torch.nn as nn

model = nn.Sequential(
    nn.Linear(1024, 4096),
    nn.ReLU(),
    nn.Linear(4096, 10)
)

for epoch in range(50):
    for batch in dataloader:
        output = model(batch)
        output = output.cpu()
        loss = criterion(output, labels.cpu())
        loss.backward()
        optimizer.step()`,

  `# Sample 3: Slow preprocessing
import torch, time
from torch.utils.data import Dataset

class SlowDataset(Dataset):
    def __getitem__(self, idx):
        time.sleep(0.01)
        return load_image(idx)

loader = DataLoader(SlowDataset(), batch_size=32, num_workers=0)
for batch in loader:
    output = model(batch)
    loss = criterion(output, labels)
    loss.backward()
    optimizer.step()
    optimizer.zero_grad()`,

  `# Sample 4: TensorFlow bottlenecks
import tensorflow as tf

dataset = tf.data.Dataset.from_tensor_slices(data).batch(1)
model = tf.keras.Sequential([
    tf.keras.layers.Dense(4096, activation='relu'),
    tf.keras.layers.Dense(10)
])

for epoch in range(100):
    for batch in dataset:
        with tf.GradientTape() as tape:
            output = model(batch, training=True)
            loss = loss_fn(labels, output)
        grads = tape.gradient(loss, model.trainable_variables)
        optimizer.apply_gradients(zip(grads, model.trainable_variables))
        tf.saved_model.save(model, "saved_model")`
];

const healthConfig = {
  Poor:     { color: "text-red-400",    bg: "bg-red-500/10 border-red-500/30",    icon: "🔴", bar: "bg-red-500",    width: "w-1/4" },
  Moderate: { color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30", icon: "🟡", bar: "bg-yellow-500", width: "w-2/4" },
  Good:     { color: "text-emerald-400",bg: "bg-emerald-500/10 border-emerald-500/30", icon: "🟢", bar: "bg-emerald-500", width: "w-full" },
};

export default function App() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sampleIndex, setSampleIndex] = useState(0);

  const analyzeCode = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setResult(null);
    await new Promise(r => setTimeout(r, 1200));
    setResult(analyzeLocally(code));
    setLoading(false);
  };

  const loadSample = () => {
    setCode(samples[sampleIndex]);
    setSampleIndex((sampleIndex + 1) % samples.length);
    setResult(null);
  };

  const clearAll = () => { setCode(""); setResult(null); };

  const h = result ? healthConfig[result.overallHealth] : null;

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white flex flex-col" style={{fontFamily: "'Inter', sans-serif"}}>

      {/* Top Nav */}
      <nav className="border-b border-white/10 px-8 py-4 flex items-center justify-between backdrop-blur-sm bg-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center text-sm">🔍</div>
          <span className="font-bold text-white tracking-tight">BottleneckAI</span>
          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30">Diagnostic Tool</span>
        </div>
        <div className="text-xs text-gray-500">AI Pipeline Analyzer</div>
      </nav>

      {/* Hero */}
      <div className="px-8 py-8 border-b border-white/5">
        <h1 className="text-3xl font-bold tracking-tight mb-1">
          Diagnose your <span className="text-blue-400">AI pipeline</span> instantly
        </h1>
        <p className="text-gray-400 text-sm">Paste your PyTorch or TensorFlow code — get a full bottleneck report in seconds.</p>
      </div>

      {/* Split Layout */}
      <div className="flex flex-1 overflow-hidden" style={{minHeight: "calc(100vh - 180px)"}}>

        {/* LEFT — Code Input */}
        <div className="w-1/2 border-r border-white/10 flex flex-col">
          <div className="px-6 py-3 border-b border-white/10 flex items-center justify-between bg-white/3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Code Input</span>
            <div className="flex gap-2">
              <button onClick={loadSample} className="text-xs bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-lg text-gray-300 transition">
                Sample {sampleIndex + 1}/{samples.length}
              </button>
              <button onClick={clearAll} className="text-xs bg-red-500/20 hover:bg-red-500/30 px-3 py-1.5 rounded-lg text-red-400 transition">
                Clear
              </button>
            </div>
          </div>

          <textarea
            className="flex-1 bg-transparent p-6 text-sm font-mono text-gray-300 resize-none focus:outline-none leading-relaxed"
            placeholder={`# Paste your AI/ML code here...\nimport torch\nfrom torch.utils.data import DataLoader\n\n# Example: training loop, dataset, model definition`}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{minHeight: "400px"}}
          />

          <div className="px-6 py-4 border-t border-white/10">
            <button
              onClick={analyzeCode}
              disabled={loading || !code.trim()}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Analyzing pipeline...
                </>
              ) : "🔍 Run Diagnostic"}
            </button>
          </div>
        </div>

        {/* RIGHT — Report */}
        <div className="w-1/2 flex flex-col overflow-y-auto">
          <div className="px-6 py-3 border-b border-white/10 bg-white/3">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Diagnostic Report</span>
          </div>

          {!result && !loading && (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8 py-16">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-3xl mb-4">📊</div>
              <p className="text-gray-500 text-sm">Your diagnostic report will appear here after analysis.</p>
              <p className="text-gray-600 text-xs mt-2">Paste code on the left and click Run Diagnostic.</p>
            </div>
          )}

          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <svg className="animate-spin w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              <p className="text-gray-400 text-sm">Scanning for bottlenecks...</p>
            </div>
          )}

          {result && h && (
            <div className="p-6 space-y-4">
              {/* Health Score */}
              <div className={`rounded-xl border p-5 ${h.bg}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Overall Health</p>
                    <p className={`text-2xl font-bold ${h.color}`}>{h.icon} {result.overallHealth}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">{result.bottlenecks.filter(b => b.severity === "Critical").length} Critical</p>
                    <p className="text-xs text-gray-400">{result.bottlenecks.filter(b => b.severity === "Warning").length} Warnings</p>
                  </div>
                </div>
                <div className="w-full bg-white/10 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full ${h.bar} ${h.width} transition-all`}/>
                </div>
                <p className="text-xs text-gray-400 mt-3">{result.summary}</p>
              </div>

              {/* Bottleneck Cards */}
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Issues Detected</p>
              {result.bottlenecks.map((b, i) => (
                <BottleneckCard key={i} bottleneck={b} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}