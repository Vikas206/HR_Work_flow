import { useState, useRef, useCallback, useEffect } from "react";

// ─── Mock API Layer ──────────────────────────────────────────────────────────
const MOCK_AUTOMATIONS = [
  { id: "send_email", label: "Send Email", params: ["to", "subject", "body"] },
  { id: "generate_doc", label: "Generate Document", params: ["template", "recipient", "format"] },
  { id: "notify_slack", label: "Notify Slack", params: ["channel", "message"] },
  { id: "update_hris", label: "Update HRIS Record", params: ["employee_id", "field", "value"] },
  { id: "schedule_meeting", label: "Schedule Meeting", params: ["attendees", "date", "topic"] },
];

async function getAutomations() {
  await new Promise((r) => setTimeout(r, 120));
  return MOCK_AUTOMATIONS;
}

async function postSimulate(workflow) {
  await new Promise((r) => setTimeout(r, 200));
  const sorted = topoSort(workflow.nodes, workflow.edges);
  return sorted.map((node) => ({
    nodeId: node.id,
    nodeType: node.type,
    title: node.data.title || node.type,
    status: "success",
    message: getSimMessage(node),
    durationMs: Math.floor(300 + Math.random() * 600),
  }));
}

function getSimMessage(node) {
  if (node.type === "start") return `Workflow triggered with ${Object.keys(node.data.metadata || {}).length} metadata fields`;
  if (node.type === "task") return `Task assigned to "${node.data.assignee || "unassigned"}" · Due: ${node.data.dueDate || "not set"}`;
  if (node.type === "approval") return `Awaiting approval from ${node.data.approverRole} · Threshold: ${node.data.threshold}d`;
  if (node.type === "auto") {
    const a = MOCK_AUTOMATIONS.find((x) => x.id === node.data.actionId);
    return a ? `Executed: ${a.label}` : "No action configured";
  }
  if (node.type === "end") return node.data.endMessage || "Workflow complete";
  return "Processed";
}

function topoSort(nodes, edges) {
  const visited = new Set();
  const order = [];
  const adj = {};
  nodes.forEach((n) => (adj[n.id] = []));
  edges.forEach((e) => { if (adj[e.from]) adj[e.from].push(e.to); });
  function dfs(id) {
    if (visited.has(id)) return;
    visited.add(id);
    (adj[id] || []).forEach(dfs);
    const node = nodes.find((n) => n.id === id);
    if (node) order.unshift(node);
  }
  const start = nodes.find((n) => n.type === "start");
  if (start) dfs(start.id);
  nodes.forEach((n) => { if (!visited.has(n.id)) dfs(n.id); });
  return order;
}

// ─── Node Config ────────────────────────────────────────────────────────────
const NODE_TYPES = {
  start:    { label: "Start",     icon: "▶", color: "#0F6E56", bg: "#E1F5EE", badge: "Entry Point" },
  task:     { label: "Task",      icon: "✓", color: "#185FA5", bg: "#E6F1FB", badge: "Human Task" },
  approval: { label: "Approval",  icon: "◈", color: "#854F0B", bg: "#FAEEDA", badge: "Approval" },
  auto:     { label: "Automated", icon: "⚡", color: "#533AB7", bg: "#EEEDFE", badge: "Automated" },
  end:      { label: "End",       icon: "■", color: "#993556", bg: "#FBEAF0", badge: "End" },
};

function makeId() { return Math.random().toString(36).slice(2, 8); }

function defaultData(type) {
  const m = {
    start:    { title: "Workflow Start", metadata: [{ k: "trigger", v: "manual" }] },
    task:     { title: "New Task", description: "", assignee: "", dueDate: "", customFields: [] },
    approval: { title: "Approval Step", approverRole: "Manager", threshold: 3 },
    auto:     { title: "Automated Step", actionId: "", params: {} },
    end:      { title: "End", endMessage: "Workflow complete", showSummary: true },
  };
  return m[type] || {};
}

// ─── Validation ──────────────────────────────────────────────────────────────
function validateWorkflow(nodes, edges) {
  const issues = [];
  const starts = nodes.filter((n) => n.type === "start");
  const ends = nodes.filter((n) => n.type === "end");
  if (starts.length === 0) issues.push("Missing a Start node");
  if (starts.length > 1) issues.push("Only one Start node allowed");
  if (ends.length === 0) issues.push("Missing an End node");
  if (nodes.length < 2) issues.push("Add at least 2 nodes");
  const connected = new Set();
  edges.forEach((e) => { connected.add(e.from); connected.add(e.to); });
  nodes.forEach((n) => {
    if (!connected.has(n.id) && nodes.length > 1)
      issues.push(`"${n.data?.title || n.type}" node is disconnected`);
  });
  return issues;
}

// ─── Bezier Curve Helper ─────────────────────────────────────────────────────
function makeCurve(x1, y1, x2, y2) {
  const dx = Math.abs(x2 - x1) * 0.55;
  return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
}

// ─── Node Form Components ────────────────────────────────────────────────────
const inputStyle = {
  width: "100%", padding: "6px 9px", border: "0.5px solid #aaa",
  borderRadius: 7, fontSize: 12, background: "transparent",
  color: "inherit", outline: "none", marginTop: 3,
};
const labelStyle = { fontSize: 11, fontWeight: 500, color: "#888", display: "block", marginTop: 10 };
const kvRowStyle = { display: "flex", gap: 4, marginBottom: 4 };

function FieldInput({ label, value, onChange, type = "text" }) {
  return (
    <div>
      <span style={labelStyle}>{label}</span>
      <input style={inputStyle} type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function FieldTextarea({ label, value, onChange }) {
  return (
    <div>
      <span style={labelStyle}>{label}</span>
      <textarea style={{ ...inputStyle, resize: "vertical", height: 52, fontFamily: "inherit" }}
        value={value || ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function FieldSelect({ label, options, value, onChange }) {
  return (
    <div>
      <span style={labelStyle}>{label}</span>
      <select style={inputStyle} value={value || ""} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
      </select>
    </div>
  );
}
function Toggle({ value, onChange }) {
  return (
    <div onClick={() => onChange(!value)} style={{
      width: 34, height: 19, borderRadius: 10, cursor: "pointer", position: "relative",
      background: value ? "#185FA5" : "#ccc", transition: "background 0.2s", flexShrink: 0,
    }}>
      <div style={{
        position: "absolute", top: 2.5, left: value ? 16 : 2.5,
        width: 14, height: 14, borderRadius: "50%", background: "#fff",
        transition: "left 0.2s",
      }} />
    </div>
  );
}

function StartForm({ data, onChange }) {
  return (
    <div>
      <FieldInput label="Workflow Title" value={data.title} onChange={(v) => onChange({ ...data, title: v })} />
      <span style={labelStyle}>Metadata</span>
      {(data.metadata || []).map((kv, i) => (
        <div key={i} style={kvRowStyle}>
          <input style={{ ...inputStyle, flex: 1 }} placeholder="key" value={kv.k}
            onChange={(e) => { const m = [...data.metadata]; m[i] = { ...m[i], k: e.target.value }; onChange({ ...data, metadata: m }); }} />
          <input style={{ ...inputStyle, flex: 1 }} placeholder="value" value={kv.v}
            onChange={(e) => { const m = [...data.metadata]; m[i] = { ...m[i], v: e.target.value }; onChange({ ...data, metadata: m }); }} />
          <button onClick={() => { const m = data.metadata.filter((_, j) => j !== i); onChange({ ...data, metadata: m }); }}
            style={{ padding: "4px 7px", border: "0.5px solid #f99", borderRadius: 6, cursor: "pointer", fontSize: 10, color: "#c33", background: "transparent" }}>✕</button>
        </div>
      ))}
      <button onClick={() => onChange({ ...data, metadata: [...(data.metadata || []), { k: "", v: "" }] })}
        style={{ width: "100%", marginTop: 4, padding: "5px", border: "0.5px dashed #aaa", borderRadius: 7, fontSize: 11, cursor: "pointer", background: "transparent", color: "#888" }}>
        + Add metadata
      </button>
    </div>
  );
}

function TaskForm({ data, onChange }) {
  return (
    <div>
      <FieldInput label="Title *" value={data.title} onChange={(v) => onChange({ ...data, title: v })} />
      <FieldTextarea label="Description" value={data.description} onChange={(v) => onChange({ ...data, description: v })} />
      <FieldInput label="Assignee" value={data.assignee} onChange={(v) => onChange({ ...data, assignee: v })} />
      <FieldInput label="Due Date" value={data.dueDate} onChange={(v) => onChange({ ...data, dueDate: v })} type="date" />
      <span style={labelStyle}>Custom Fields</span>
      {(data.customFields || []).map((kv, i) => (
        <div key={i} style={kvRowStyle}>
          <input style={{ ...inputStyle, flex: 1 }} placeholder="field" value={kv.k}
            onChange={(e) => { const f = [...data.customFields]; f[i] = { ...f[i], k: e.target.value }; onChange({ ...data, customFields: f }); }} />
          <input style={{ ...inputStyle, flex: 1 }} placeholder="value" value={kv.v}
            onChange={(e) => { const f = [...data.customFields]; f[i] = { ...f[i], v: e.target.value }; onChange({ ...data, customFields: f }); }} />
          <button onClick={() => onChange({ ...data, customFields: data.customFields.filter((_, j) => j !== i) })}
            style={{ padding: "4px 7px", border: "0.5px solid #f99", borderRadius: 6, cursor: "pointer", fontSize: 10, color: "#c33", background: "transparent" }}>✕</button>
        </div>
      ))}
      <button onClick={() => onChange({ ...data, customFields: [...(data.customFields || []), { k: "", v: "" }] })}
        style={{ width: "100%", marginTop: 4, padding: "5px", border: "0.5px dashed #aaa", borderRadius: 7, fontSize: 11, cursor: "pointer", background: "transparent", color: "#888" }}>
        + Add field
      </button>
    </div>
  );
}

function ApprovalForm({ data, onChange }) {
  return (
    <div>
      <FieldInput label="Title" value={data.title} onChange={(v) => onChange({ ...data, title: v })} />
      <FieldSelect label="Approver Role" value={data.approverRole}
        options={["Manager", "HRBP", "Director", "VP", "Legal", "Finance"]}
        onChange={(v) => onChange({ ...data, approverRole: v })} />
      <span style={labelStyle}>Auto-approve threshold (days)</span>
      <input style={inputStyle} type="number" min={0} value={data.threshold || 0}
        onChange={(e) => onChange({ ...data, threshold: parseInt(e.target.value) || 0 })} />
    </div>
  );
}

function AutoForm({ data, onChange, automations }) {
  const action = automations.find((a) => a.id === data.actionId);
  return (
    <div>
      <FieldInput label="Title" value={data.title} onChange={(v) => onChange({ ...data, title: v })} />
      <FieldSelect label="Action" value={data.actionId}
        options={[{ value: "", label: "-- Select action --" }, ...automations.map((a) => ({ value: a.id, label: a.label }))]}
        onChange={(v) => onChange({ ...data, actionId: v, params: {} })} />
      {action && (
        <div>
          <span style={labelStyle}>Parameters</span>
          {action.params.map((p) => (
            <div key={p}>
              <span style={{ ...labelStyle, fontSize: 10 }}>{p}</span>
              <input style={inputStyle} placeholder={`{{${p}}}`} value={data.params?.[p] || ""}
                onChange={(e) => onChange({ ...data, params: { ...(data.params || {}), [p]: e.target.value } })} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EndForm({ data, onChange }) {
  return (
    <div>
      <FieldInput label="End Message" value={data.endMessage} onChange={(v) => onChange({ ...data, endMessage: v })} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
        <span style={{ fontSize: 12 }}>Show Summary Report</span>
        <Toggle value={!!data.showSummary} onChange={(v) => onChange({ ...data, showSummary: v })} />
      </div>
    </div>
  );
}

// ─── Flow Node Component ─────────────────────────────────────────────────────
function FlowNode({ node, selected, onSelect, onDragStart, onConnectStart, onDelete, panOffset }) {
  const nt = NODE_TYPES[node.type];
  const px = node.x + panOffset.x;
  const py = node.y + panOffset.y;
  return (
    <div
      onMouseDown={(e) => { e.stopPropagation(); onSelect(node.id); onDragStart(e, node.id); }}
      style={{
        position: "absolute", left: px, top: py, zIndex: selected ? 5 : 2,
        cursor: "default", userSelect: "none",
      }}
    >
      {selected && (
        <div onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
          style={{
            position: "absolute", top: -8, right: -8, width: 18, height: 18, borderRadius: "50%",
            background: "#fee", border: "0.5px solid #f99", color: "#c33",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, cursor: "pointer", zIndex: 20,
          }}>✕</div>
      )}
      <div style={{
        background: "#fff", border: `0.5px solid ${selected ? "#378ADD" : "#ddd"}`,
        borderRadius: 10, minWidth: 164, overflow: "hidden",
        boxShadow: selected ? "0 0 0 2px #378ADD44" : "0 1px 4px rgba(0,0,0,0.06)",
        transition: "box-shadow 0.12s",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 10px 5px" }}>
          <div style={{
            width: 24, height: 24, borderRadius: 6, background: nt.bg, color: nt.color,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0,
          }}>{nt.icon}</div>
          <span style={{ fontSize: 12, fontWeight: 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {node.data.title || nt.label}
          </span>
          <span style={{
            fontSize: 9, padding: "2px 5px", borderRadius: 10, fontWeight: 500,
            background: nt.bg, color: nt.color,
          }}>{nt.badge}</span>
        </div>
        {(node.data.description || node.data.endMessage || node.data.approverRole || node.data.assignee) && (
          <div style={{ padding: "0 10px 7px", fontSize: 10.5, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {node.data.description || node.data.endMessage || node.data.approverRole || (node.data.assignee ? `→ ${node.data.assignee}` : "")}
          </div>
        )}
      </div>
      {/* Input handle */}
      <div
        onMouseDown={(e) => { e.stopPropagation(); }}
        style={{
          position: "absolute", top: "50%", left: -6, transform: "translateY(-50%)",
          width: 12, height: 12, borderRadius: "50%", border: "2px solid #fff",
          background: "#378ADD", cursor: "crosshair", zIndex: 10,
        }}
      />
      {/* Output handle */}
      <div
        onMouseDown={(e) => { e.stopPropagation(); onConnectStart(e, node.id); }}
        style={{
          position: "absolute", top: "50%", right: -6, transform: "translateY(-50%)",
          width: 12, height: 12, borderRadius: "50%", border: "2px solid #fff",
          background: "#378ADD", cursor: "crosshair", zIndex: 10,
        }}
      />
    </div>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────
export default function HRWorkflowDesigner() {
  const [nodes, setNodes] = useState([
    { id: "n1", type: "start", x: 40, y: 160, data: { title: "Onboarding Start", metadata: [{ k: "trigger", v: "new_hire" }] } },
    { id: "n2", type: "task", x: 260, y: 80, data: { title: "Collect Documents", description: "ID, contract, tax forms", assignee: "HR Admin", dueDate: "2025-07-01", customFields: [] } },
    { id: "n3", type: "approval", x: 480, y: 160, data: { title: "Manager Approval", approverRole: "Manager", threshold: 3 } },
    { id: "n4", type: "auto", x: 700, y: 160, data: { title: "Send Welcome Email", actionId: "send_email", params: { to: "{{employee.email}}", subject: "Welcome aboard!" } } },
    { id: "n5", type: "end", x: 920, y: 160, data: { title: "End", endMessage: "Onboarding complete!", showSummary: true } },
  ]);
  const [edges, setEdges] = useState([
    { id: "e1", from: "n1", to: "n2" },
    { id: "e2", from: "n2", to: "n3" },
    { id: "e3", from: "n3", to: "n4" },
    { id: "e4", from: "n4", to: "n5" },
  ]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [activeTab, setActiveTab] = useState("configure");
  const [automations, setAutomations] = useState([]);
  const [simLog, setSimLog] = useState([]);
  const [simRunning, setSimRunning] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [connecting, setConnecting] = useState(null); // { fromId, x1, y1 }
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const canvasRef = useRef(null);
  const dragging = useRef(null); // { nodeId, offsetX, offsetY }
  const panning = useRef(null); // { startX, startY, startPanX, startPanY }
  const paletteType = useRef(null);

  useEffect(() => { getAutomations().then(setAutomations); }, []);

  const selNode = nodes.find((n) => n.id === selectedNode);

  // ── Node drag ──
  const handleNodeDragStart = useCallback((e, nodeId) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const node = nodes.find((n) => n.id === nodeId);
    dragging.current = {
      nodeId,
      offsetX: e.clientX - rect.left - node.x - panOffset.x,
      offsetY: e.clientY - rect.top - node.y - panOffset.y,
    };
  }, [nodes, panOffset]);

  // ── Connect start ──
  const handleConnectStart = useCallback((e, fromId) => {
    e.stopPropagation();
    const rect = canvasRef.current.getBoundingClientRect();
    const node = nodes.find((n) => n.id === fromId);
    setConnecting({ fromId, x1: node.x + 164 + panOffset.x, y1: node.y + 32 + panOffset.y });
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, [nodes, panOffset]);

  // ── Mouse move ──
  const handleCanvasMouseMove = useCallback((e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setMousePos({ x: mx, y: my });

    if (dragging.current) {
      const { nodeId, offsetX, offsetY } = dragging.current;
      setNodes((prev) => prev.map((n) =>
        n.id === nodeId ? { ...n, x: mx - offsetX - panOffset.x, y: my - offsetY - panOffset.y } : n
      ));
    } else if (panning.current) {
      const { startX, startY, startPanX, startPanY } = panning.current;
      setPanOffset({ x: startPanX + (e.clientX - startX), y: startPanY + (e.clientY - startY) });
    }
  }, [panOffset]);

  // ── Mouse up ──
  const handleCanvasMouseUp = useCallback((e) => {
    if (connecting) {
      const rect = canvasRef.current?.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const target = nodes.find((n) => {
        const px = n.x + panOffset.x;
        const py = n.y + panOffset.y;
        return mx >= px && mx <= px + 164 && my >= py && my <= py + 70;
      });
      if (target && target.id !== connecting.fromId) {
        const exists = edges.some((ed) => ed.from === connecting.fromId && ed.to === target.id);
        if (!exists) setEdges((prev) => [...prev, { id: "e" + makeId(), from: connecting.fromId, to: target.id }]);
      }
      setConnecting(null);
    }
    dragging.current = null;
    panning.current = null;
  }, [connecting, nodes, edges, panOffset]);

  // ── Canvas mouse down (pan) ──
  const handleCanvasMouseDown = useCallback((e) => {
    if (e.target === canvasRef.current || e.target.classList.contains("grid-bg")) {
      setSelectedNode(null);
      setSelectedEdge(null);
      panning.current = { startX: e.clientX, startY: e.clientY, startPanX: panOffset.x, startPanY: panOffset.y };
    }
  }, [panOffset]);

  // ── Drop from palette ──
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const type = paletteType.current || e.dataTransfer.getData("nodeType");
    if (!type) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - panOffset.x - 82;
    const y = e.clientY - rect.top - panOffset.y - 32;
    const node = { id: "n" + makeId(), type, x, y, data: defaultData(type) };
    setNodes((prev) => [...prev, node]);
    setSelectedNode(node.id);
    paletteType.current = null;
  }, [panOffset]);

  // ── Delete ──
  const handleDeleteNode = useCallback((id) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) => prev.filter((e) => e.from !== id && e.to !== id));
    if (selectedNode === id) setSelectedNode(null);
  }, [selectedNode]);

  const handleDeleteEdge = useCallback((id) => {
    setEdges((prev) => prev.filter((e) => e.id !== id));
    setSelectedEdge(null);
  }, []);

  // ── Update node data ──
  const updateNodeData = useCallback((data) => {
    setNodes((prev) => prev.map((n) => n.id === selectedNode ? { ...n, data } : n));
  }, [selectedNode]);

  // ── Simulate ──
  const runSimulation = async () => {
    const issues = validateWorkflow(nodes, edges);
    if (issues.length > 0) {
      setSimLog([{ type: "error", title: "Validation failed", msg: issues.join(" · ") }]);
      return;
    }
    setSimRunning(true);
    setSimLog([]);
    const steps = await postSimulate({ nodes, edges });
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      setSimLog((prev) => [...prev, { type: "running", title: `${NODE_TYPES[step.nodeType]?.icon} ${step.title}`, msg: "Executing..." }]);
      await new Promise((r) => setTimeout(r, step.durationMs));
      setSimLog((prev) => {
        const next = [...prev];
        next[next.length - 1] = { type: "done", title: `${NODE_TYPES[step.nodeType]?.icon} ${step.title}`, msg: step.message };
        return next;
      });
    }
    setSimRunning(false);
  };

  const issues = validateWorkflow(nodes, edges);
  const exportedJson = JSON.stringify({ nodes, edges }, null, 2);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "210px 1fr 310px", height: "600px", fontFamily: "system-ui, sans-serif", fontSize: 13, overflow: "hidden", border: "0.5px solid #e0e0e0", borderRadius: 12 }}>
      {/* ── Sidebar ── */}
      <div style={{ background: "#fafafa", borderRight: "0.5px solid #e8e8e8", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "13px 14px 10px", borderBottom: "0.5px solid #e8e8e8" }}>
          <div style={{ fontWeight: 600, fontSize: 12.5, letterSpacing: "0.01em" }}>HR Workflow Designer</div>
          <div style={{ fontSize: 10.5, color: "#999", marginTop: 2 }}>Drag nodes to canvas</div>
        </div>
        <div style={{ padding: "10px 10px 4px", fontSize: 9.5, fontWeight: 600, color: "#bbb", letterSpacing: "0.08em", textTransform: "uppercase" }}>Node Types</div>
        <div style={{ padding: "0 8px 8px", display: "flex", flexDirection: "column", gap: 4 }}>
          {Object.entries(NODE_TYPES).map(([type, cfg]) => (
            <div key={type}
              draggable
              onDragStart={(e) => { e.dataTransfer.setData("nodeType", type); paletteType.current = type; }}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "7px 9px",
                borderRadius: 8, border: "0.5px solid #e8e8e8", background: "#fff",
                cursor: "grab", fontSize: 12, fontWeight: 500,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#f3f3f3"}
              onMouseLeave={(e) => e.currentTarget.style.background = "#fff"}
            >
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
              {cfg.label}
            </div>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ padding: "10px 14px", borderTop: "0.5px solid #e8e8e8", fontSize: 10, color: "#bbb" }}>
          {nodes.length} nodes · {edges.length} edges
        </div>
      </div>

      {/* ── Canvas ── */}
      <div
        ref={canvasRef}
        style={{ position: "relative", overflow: "hidden", background: "#f7f7f8", cursor: connecting ? "crosshair" : "default" }}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        {/* Grid */}
        <div className="grid-bg" style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: "radial-gradient(circle, #d0d0d0 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }} />

        {/* Toolbar */}
        <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6, zIndex: 100 }}>
          {[
            { label: "Clear", action: () => { if (window.confirm("Clear canvas?")) { setNodes([]); setEdges([]); setSelectedNode(null); } } },
            { label: showJson ? "Hide JSON ▲" : "JSON ▼", action: () => setShowJson((v) => !v) },
          ].map((b) => (
            <button key={b.label} onClick={b.action} style={{
              padding: "5px 11px", background: "#fff", border: "0.5px solid #ddd",
              borderRadius: 8, fontSize: 11, fontWeight: 500, cursor: "pointer",
            }}>{b.label}</button>
          ))}
          <button onClick={() => { setActiveTab("simulate"); runSimulation(); }} style={{
            padding: "5px 13px", background: "#185FA5", color: "#fff", border: "none",
            borderRadius: 8, fontSize: 11, fontWeight: 500, cursor: "pointer",
          }}>▶ Run Simulation</button>
          {(selectedNode || selectedEdge) && (
            <button onClick={() => {
              if (selectedNode) handleDeleteNode(selectedNode);
              if (selectedEdge) handleDeleteEdge(selectedEdge);
            }} style={{
              padding: "5px 11px", background: "#fff", border: "0.5px solid #f99",
              borderRadius: 8, fontSize: 11, fontWeight: 500, cursor: "pointer", color: "#c33",
            }}>Delete</button>
          )}
        </div>

        {/* SVG edges */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}>
          <defs>
            <marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill={selectedEdge ? "#378ADD" : "#bbb"} />
            </marker>
            <marker id="arr-sel" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#378ADD" />
            </marker>
          </defs>
          {edges.map((edge) => {
            const fn = nodes.find((n) => n.id === edge.from);
            const tn = nodes.find((n) => n.id === edge.to);
            if (!fn || !tn) return null;
            const x1 = fn.x + 164 + panOffset.x;
            const y1 = fn.y + 32 + panOffset.y;
            const x2 = tn.x + panOffset.x;
            const y2 = tn.y + 32 + panOffset.y;
            const isSel = selectedEdge === edge.id;
            return (
              <path key={edge.id}
                d={makeCurve(x1, y1, x2, y2)}
                stroke={isSel ? "#378ADD" : "#bbb"} strokeWidth={isSel ? 2 : 1.5}
                fill="none" markerEnd={`url(#${isSel ? "arr-sel" : "arr"})`}
                style={{ pointerEvents: "stroke", cursor: "pointer" }}
                onClick={(e) => { e.stopPropagation(); setSelectedEdge(edge.id); setSelectedNode(null); }}
              />
            );
          })}
          {connecting && (
            <path d={makeCurve(connecting.x1, connecting.y1, mousePos.x, mousePos.y)}
              stroke="#378ADD" strokeWidth={1.5} fill="none" strokeDasharray="4,3"
              style={{ pointerEvents: "none" }} />
          )}
        </svg>

        {/* Nodes */}
        {nodes.map((node) => (
          <FlowNode key={node.id} node={node} selected={selectedNode === node.id}
            panOffset={panOffset}
            onSelect={(id) => { setSelectedNode(id); setSelectedEdge(null); }}
            onDragStart={handleNodeDragStart}
            onConnectStart={handleConnectStart}
            onDelete={handleDeleteNode}
          />
        ))}

        {/* JSON overlay */}
        {showJson && (
          <div style={{
            position: "absolute", bottom: 30, left: 10, right: 10, zIndex: 200,
            background: "rgba(248,248,248,0.97)", border: "0.5px solid #ddd",
            borderRadius: 8, padding: 10, maxHeight: 180, overflow: "auto",
          }}>
            <pre style={{ fontFamily: "monospace", fontSize: 10, color: "#555", margin: 0 }}>{exportedJson}</pre>
          </div>
        )}

        {/* Status bar */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, padding: "5px 14px",
          background: "rgba(250,250,250,0.9)", borderTop: "0.5px solid #e8e8e8",
          fontSize: 10, color: "#aaa", display: "flex", gap: 10,
        }}>
          <span>{selNode ? `Selected: ${selNode.data?.title || selNode.type}` : "Click node to select"}</span>
          <span>·</span><span>Drag handles to connect nodes</span>
          <span>·</span><span>Pan: click-drag background</span>
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div style={{ background: "#fff", borderLeft: "0.5px solid #e8e8e8", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", borderBottom: "0.5px solid #e8e8e8" }}>
          {["configure", "simulate"].map((tab) => (
            <div key={tab} onClick={() => setActiveTab(tab)} style={{
              flex: 1, padding: "10px", fontSize: 11.5, fontWeight: 500, textAlign: "center",
              cursor: "pointer", color: activeTab === tab ? "#185FA5" : "#aaa",
              borderBottom: activeTab === tab ? "2px solid #185FA5" : "2px solid transparent",
              textTransform: "capitalize",
            }}>{tab}</div>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
          {activeTab === "configure" ? (
            selNode ? (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 7,
                    background: NODE_TYPES[selNode.type].bg, color: NODE_TYPES[selNode.type].color,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                  }}>{NODE_TYPES[selNode.type].icon}</div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{NODE_TYPES[selNode.type].label} Node</div>
                    <div style={{ fontSize: 10, color: "#bbb" }}>id: {selNode.id}</div>
                  </div>
                </div>
                {selNode.type === "start" && <StartForm data={selNode.data} onChange={updateNodeData} />}
                {selNode.type === "task" && <TaskForm data={selNode.data} onChange={updateNodeData} />}
                {selNode.type === "approval" && <ApprovalForm data={selNode.data} onChange={updateNodeData} />}
                {selNode.type === "auto" && <AutoForm data={selNode.data} onChange={updateNodeData} automations={automations} />}
                {selNode.type === "end" && <EndForm data={selNode.data} onChange={updateNodeData} />}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "40px 16px", color: "#bbb" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>◈</div>
                <div style={{ fontSize: 12 }}>Select a node to configure it</div>
              </div>
            )
          ) : (
            <div>
              <button onClick={runSimulation} disabled={simRunning} style={{
                width: "100%", padding: "9px", background: simRunning ? "#ccc" : "#185FA5",
                color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 500,
                cursor: simRunning ? "not-allowed" : "pointer", marginBottom: 12,
              }}>{simRunning ? "Running..." : "▶ Run Workflow Simulation"}</button>

              {issues.length > 0
                ? issues.map((iss, i) => (
                  <div key={i} style={{
                    display: "flex", gap: 6, padding: "6px 8px", borderRadius: 7,
                    background: "#FAEEDA", border: "0.5px solid #F9C774",
                    fontSize: 11, color: "#854F0B", marginBottom: 6,
                  }}>⚠ {iss}</div>
                ))
                : <div style={{
                  padding: "6px 8px", borderRadius: 7, background: "#EAF3DE",
                  border: "0.5px solid #B5D4A0", fontSize: 11, color: "#3B6D11", marginBottom: 10,
                }}>✓ Workflow structure looks valid</div>
              }

              <div style={{ fontSize: 11, fontWeight: 500, color: "#bbb", margin: "12px 0 8px" }}>Execution Log</div>
              {simLog.length === 0
                ? <div style={{ textAlign: "center", padding: 24, color: "#bbb", fontSize: 11 }}>Run simulation to see execution log</div>
                : simLog.map((s, i) => (
                  <div key={i} style={{
                    borderRadius: 7, padding: "7px 9px", fontSize: 11, marginBottom: 5,
                    border: `0.5px solid ${s.type === "done" ? "#B5D4A0" : s.type === "error" ? "#f99" : "#B5D4F4"}`,
                    background: s.type === "done" ? "#EAF3DE" : s.type === "error" ? "#FCEBEB" : "#E6F1FB",
                  }}>
                    <div style={{ fontWeight: 500, marginBottom: 2, color: s.type === "done" ? "#3B6D11" : s.type === "error" ? "#A32D2D" : "#185FA5" }}>
                      {i + 1}. {s.title}
                    </div>
                    <div style={{ color: "#888" }}>{s.msg}</div>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
