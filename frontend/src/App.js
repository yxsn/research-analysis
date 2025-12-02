import React, { useState, useCallback } from "react";
import {
  BookOpen, // Explicator Icon
  Rocket, // Visionary Icon
  Terminal, // Practitioner Icon
  Loader,
  RefreshCcw,
  Link as LinkIcon,
  UploadCloud,
} from "lucide-react";

// --- EMBEDDED CSS STYLES ---
// Embedding styles directly to prevent file resolution errors
const styles = `
/* Global Reset */
* { box-sizing: border-box; }
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; background-color: #f8fafc; color: #1e293b; }
.app-container { min-height: 100vh; padding: 2rem; display: flex; flex-direction: column; align-items: center; }
.header { text-align: center; margin-bottom: 2.5rem; }
.header h1 { font-size: 2.5rem; font-weight: 800; margin: 0; color: #0f172a; }
.header p { font-size: 1.25rem; color: #3b82f6; margin-top: 0.5rem; }
.main-card { background-color: white; width: 100%; max-width: 900px; padding: 2.5rem; border-radius: 1rem; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); border: 1px solid #e2e8f0; }
.mode-tabs { display: flex; gap: 1rem; margin-bottom: 1.5rem; border-bottom: 2px solid #f1f5f9; }
.tab { background: none; border: none; padding: 0.75rem 1rem; font-size: 1rem; font-weight: 600; color: #64748b; cursor: pointer; display: flex; gap: 0.5rem; align-items: center; border-bottom: 2px solid transparent; margin-bottom: -2px; }
.tab:hover { color: #334155; }
.tab.active { color: #3b82f6; border-bottom-color: #3b82f6; }
.input-section { margin-bottom: 2rem; }
.input-section label { display: block; font-size: 1.125rem; font-weight: 600; margin-bottom: 0.5rem; color: #334155; }
.text-input { width: 100%; padding: 0.75rem; border: 2px solid #cbd5e1; border-radius: 0.5rem; font-size: 1rem; transition: border-color 0.2s; }
.text-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
.file-input-wrapper { border: 2px dashed #cbd5e1; padding: 2rem; text-align: center; border-radius: 0.5rem; cursor: pointer; background: #f8fafc; transition: all 0.2s; }
.file-input-wrapper:hover { border-color: #3b82f6; background: #eff6ff; }
.file-name { margin-top: 0.5rem; font-weight: 600; color: #334155; }
.run-button { margin-top: 1rem; width: 100%; padding: 0.75rem 1.5rem; border: none; border-radius: 0.5rem; background-color: #3b82f6; color: white; font-size: 1rem; font-weight: 600; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 0.5rem; transition: background-color 0.2s; }
.run-button:hover:not(:disabled) { background-color: #2563eb; }
.run-button:disabled { background-color: #94a3b8; cursor: not-allowed; }
.input-note { font-size: 0.8rem; color: #94a3b8; text-align: center; margin-top: 0.75rem; font-style: italic; }
.agent-card { background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
.agent-card h3 { display: flex; align-items: center; gap: 0.75rem; margin-top: 0; margin-bottom: 0.5rem; font-size: 1.25rem; font-weight: 700; }
.agent-desc { color: #64748b; font-size: 0.9rem; margin-bottom: 1rem; font-style: italic; }
.agent-card.explicator h3 { color: #d97706; }
.agent-card.visionary h3 { color: #7c3aed; }
.agent-card.practitioner h3 { color: #059669; }
.agent-content { font-size: 1rem; line-height: 1.7; color: #334155; white-space: pre-wrap; }
.agent-card.practitioner .agent-content { font-family: 'Menlo', 'Monaco', 'Courier New', monospace; background: #f1f5f9; padding: 1rem; border-radius: 0.5rem; font-size: 0.9rem; border: 1px solid #e2e8f0; }
.loading-placeholder { background-color: #f8fafc; height: 120px; border-radius: 0.5rem; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-style: italic; border: 1px dashed #cbd5e1; margin-bottom: 1.5rem; }
.footer { margin-top: 3rem; color: #94a3b8; font-size: 0.875rem; text-align: center; }
`;

// --- CONFIGURATION ---
// IMPORTANT: Point this to your local Python backend
const BACKEND_API_HOST = "http://127.0.0.1:8000";

// API Call Helper
const callAnalysisAPI = async (input, mode) => {
  const endpoint = mode === "url" ? "/analyze_url" : "/analyze_file";
  const url = `${BACKEND_API_HOST}${endpoint}`;

  const formData = new FormData();
  if (mode === "url") {
    formData.append("url", input);
  } else {
    formData.append("file", input);
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let msg = errorText;
      try {
        const json = JSON.parse(errorText);
        msg = json.detail;
      } catch (e) {}
      throw new Error(msg || `Server Error: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    throw new Error(error.message);
  }
};

const agents = {
  explicator: {
    icon: BookOpen,
    title: "The Explicator",
    description: "Explains the core concepts and methodology.",
    stage: "explicator",
  },
  visionary: {
    icon: Rocket,
    title: "The Visionary",
    description: "Proposes future research and applications.",
    stage: "visionary",
  },
  practitioner: {
    icon: Terminal,
    title: "The Practitioner",
    description: "Provides implementation logic/code.",
    stage: "practitioner",
  },
};

const App = () => {
  const [mode, setMode] = useState("url"); // 'url' or 'upload'
  const [urlInput, setUrlInput] = useState("");
  const [fileInput, setFileInput] = useState(null);
  const [status, setStatus] = useState("ready");
  const [results, setResults] = useState({
    explicator: "",
    visionary: "",
    practitioner: "",
  });

  const isLoading = status === "running";

  const runAnalysisEngine = useCallback(async () => {
    if (mode === "url" && !urlInput.trim()) return;
    if (mode === "upload" && !fileInput) return;

    setResults({ explicator: "", visionary: "", practitioner: "" });
    setStatus("running");

    try {
      const input = mode === "url" ? urlInput : fileInput;
      const apiResults = await callAnalysisAPI(input, mode);

      setResults({
        explicator: apiResults.explicator,
        visionary: apiResults.visionary,
        practitioner: apiResults.practitioner,
      });
      setStatus("success");
    } catch (error) {
      setResults((prev) => ({
        ...prev,
        explicator: `Error: ${error.message}`,
      }));
      setStatus("error");
    }
  }, [mode, urlInput, fileInput]);

  const renderResultCard = (agentKey) => {
    const { icon: Icon, title, description } = agents[agentKey];
    const content = results[agentKey];

    if (content === "")
      return (
        <div className="loading-placeholder">
          <p>Waiting for {title}...</p>
        </div>
      );

    return (
      <div className={`agent-card ${agentKey}`}>
        <h3>
          <Icon size={24} /> {title}
        </h3>
        <p className="agent-desc">{description}</p>
        <div className="agent-content">{content}</div>
      </div>
    );
  };

  return (
    <div className="app-container">
      {/* Inject Styles */}
      <style>{styles}</style>

      <header className="header">
        <h1>Research Analysis Engine</h1>
        <p>Multi-Agent AI for Academic Paper Breakdown</p>
      </header>

      <main className="main-card">
        <div className="mode-tabs">
          <button
            className={`tab ${mode === "url" ? "active" : ""}`}
            onClick={() => setMode("url")}
          >
            <LinkIcon size={18} /> Analyze Link
          </button>
          <button
            className={`tab ${mode === "upload" ? "active" : ""}`}
            onClick={() => setMode("upload")}
          >
            <UploadCloud size={18} /> Upload PDF
          </button>
        </div>

        <div className="input-section">
          {mode === "url" ? (
            <input
              type="url"
              className="text-input"
              placeholder="Paste research paper URL (PDF or Webpage)..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              disabled={isLoading}
            />
          ) : (
            <div className="file-input-wrapper">
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setFileInput(e.target.files[0])}
                disabled={isLoading}
              />
              <p className="file-name">
                {fileInput ? fileInput.name : "Click to select a PDF file"}
              </p>
            </div>
          )}

          <button
            className="run-button"
            onClick={runAnalysisEngine}
            disabled={isLoading || (mode === "url" ? !urlInput : !fileInput)}
          >
            {isLoading ? (
              <>
                <Loader className="animate-spin" size={20} />
                Processing Paper...
              </>
            ) : (
              <>
                <RefreshCcw size={20} />
                Run Analysis
              </>
            )}
          </button>

          {/* DISCRETE NOTE ADDED HERE */}
          <p className="input-note">
            * Optimized for research papers up to approx. 50 pages.
          </p>
        </div>

        <div className="results-section">
          {renderResultCard("explicator")}
          {renderResultCard("visionary")}
          {renderResultCard("practitioner")}
        </div>
      </main>

      <footer className="footer">
        <p>Powered by Ollama (Llama 3 Local)</p>
      </footer>
    </div>
  );
};

export default App;
