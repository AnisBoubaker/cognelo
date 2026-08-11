"use client";

import "@xyflow/react/dist/style.css";
import ELK from "elkjs/lib/elk.bundled.js";
import {
  Background,
  ConnectionMode,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
  type ReactFlowInstance,
  useEdgesState,
  useNodesState
} from "@xyflow/react";
import { useNotifications } from "@cognelo/activity-ui";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import {
  api,
  type SubjectKnowledgeConcept,
  type SubjectKnowledgeGraphDraft,
  type SubjectKnowledgePrerequisite
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Props = {
  subjectId: string;
  initialConcepts: SubjectKnowledgeConcept[];
  initialPrerequisites: SubjectKnowledgePrerequisite[];
  savedConcepts?: SubjectKnowledgeConcept[];
  savedPrerequisites?: SubjectKnowledgePrerequisite[];
  readOnly?: boolean;
  aiGenerationEnabled?: boolean;
  subjectDescription?: string;
  teachingLanguage?: "en" | "fr" | "zh" | "ar";
  isVisible?: boolean;
  onChange?: (graph: SubjectKnowledgeGraphDraft) => void;
};

type ConceptNode = Node<{ label: string }>;
type LayoutPreset = "hierarchical" | "forest" | "radial" | "force" | "compact";
type GenerationMode = "new" | "iterate";

const elk = new ELK();

function ConceptGraphNode({ data }: NodeProps<ConceptNode>) {
  return (
    <div className="knowledge-concept-node">
      <Handle id="top" position={Position.Top} type="source" />
      <Handle id="right" position={Position.Right} type="source" />
      <Handle id="bottom" position={Position.Bottom} type="source" />
      <Handle id="left" position={Position.Left} type="source" />
      <span>{data.label}</span>
    </div>
  );
}

const conceptNodeTypes: NodeTypes = { concept: ConceptGraphNode };

const toNode = (concept: SubjectKnowledgeConcept): ConceptNode => ({
  id: concept.id,
  type: "concept",
  position: { x: concept.positionX, y: concept.positionY },
  data: { label: concept.title }
});

function highlightConceptNodes(
  nodes: ConceptNode[],
  prerequisites: SubjectKnowledgePrerequisite[],
  selectedId: string | null
): ConceptNode[] {
  if (!selectedId || !nodes.some((node) => node.id === selectedId)) {
    return nodes.map((node) => ({ ...node, className: undefined }));
  }

  const directOutgoing = new Set<string>();
  const directIncoming = new Set<string>();
  const outgoingPrerequisites = new Map<string, Set<string>>();
  for (const prerequisite of prerequisites) {
    if (prerequisite.sourceConceptId === selectedId) directOutgoing.add(prerequisite.requiredConceptId);
    if (prerequisite.requiredConceptId === selectedId) directIncoming.add(prerequisite.sourceConceptId);
    if (!outgoingPrerequisites.has(prerequisite.sourceConceptId)) {
      outgoingPrerequisites.set(prerequisite.sourceConceptId, new Set());
    }
    outgoingPrerequisites.get(prerequisite.sourceConceptId)!.add(prerequisite.requiredConceptId);
  }

  const transitivePrerequisites = new Set([selectedId]);
  const pending = [selectedId];
  while (pending.length) {
    const current = pending.pop()!;
    for (const prerequisiteId of outgoingPrerequisites.get(current) ?? []) {
      if (transitivePrerequisites.has(prerequisiteId)) continue;
      transitivePrerequisites.add(prerequisiteId);
      pending.push(prerequisiteId);
    }
  }

  return nodes.map((node) => {
    const classes = [];
    if (node.id === selectedId) classes.push("knowledge-node-selected");
    if (directOutgoing.has(node.id)) classes.push("knowledge-node-direct-outgoing");
    if (directIncoming.has(node.id)) classes.push("knowledge-node-direct-incoming");
    if (!transitivePrerequisites.has(node.id) && !directIncoming.has(node.id)) {
      classes.push("knowledge-node-not-prerequisite");
    }
    return { ...node, className: classes.join(" ") || undefined };
  });
}

const sourceHandles = ["top", "right", "bottom", "left"];
const targetHandles = ["bottom", "left", "top", "right"];

function toEdges(prerequisites: SubjectKnowledgePrerequisite[]): Edge[] {
  const outgoing = new Map<string, SubjectKnowledgePrerequisite[]>();
  const incoming = new Map<string, SubjectKnowledgePrerequisite[]>();
  for (const prerequisite of prerequisites) {
    outgoing.set(prerequisite.sourceConceptId, [...(outgoing.get(prerequisite.sourceConceptId) ?? []), prerequisite]);
    incoming.set(prerequisite.requiredConceptId, [...(incoming.get(prerequisite.requiredConceptId) ?? []), prerequisite]);
  }
  const sourceHandleByEdge = new Map<string, string>();
  const targetHandleByEdge = new Map<string, string>();
  for (const group of outgoing.values()) {
    group.sort((left, right) => left.id.localeCompare(right.id));
    group.forEach((edge, index) => sourceHandleByEdge.set(edge.id, sourceHandles[index % sourceHandles.length]));
  }
  for (const group of incoming.values()) {
    group.sort((left, right) => left.id.localeCompare(right.id));
    group.forEach((edge, index) => targetHandleByEdge.set(edge.id, targetHandles[index % targetHandles.length]));
  }
  return prerequisites.map((prerequisite) => ({
    id: prerequisite.id,
    source: prerequisite.sourceConceptId,
    target: prerequisite.requiredConceptId,
    sourceHandle: prerequisite.sourceHandle ?? sourceHandleByEdge.get(prerequisite.id),
    targetHandle: prerequisite.targetHandle ?? targetHandleByEdge.get(prerequisite.id),
    markerEnd: { type: MarkerType.ArrowClosed },
    type: "smoothstep"
  }));
}

function highlightEdges(edges: Edge[], conceptId: string | null): Edge[] {
  return edges.map((edge) => {
    const direction = conceptId && edge.source === conceptId
      ? "outgoing"
      : conceptId && edge.target === conceptId
        ? "incoming"
        : conceptId
          ? "unconnected"
          : null;
    const color = direction === "outgoing" ? "#008f8b" : direction === "incoming" ? "#6d28d9" : undefined;
    return {
      ...edge,
      className: direction ? `knowledge-edge-${direction}` : undefined,
      markerEnd: { type: MarkerType.ArrowClosed, color },
      selected: false,
      zIndex: direction === "outgoing" || direction === "incoming" ? 500 : 0
    };
  });
}

export function SubjectKnowledgeGraph({
  subjectId,
  initialConcepts,
  initialPrerequisites,
  savedConcepts = initialConcepts,
  savedPrerequisites = initialPrerequisites,
  readOnly = false,
  aiGenerationEnabled = false,
  subjectDescription = "",
  teachingLanguage = "en",
  isVisible = true,
  onChange
}: Props) {
  const { t } = useI18n();
  const { notify } = useNotifications();
  const [concepts, setConcepts] = useState(initialConcepts);
  const [prerequisites, setPrerequisites] = useState(initialPrerequisites);
  const [nodes, setNodes, onNodesChange] = useNodesState<ConceptNode>(initialConcepts.map(toNode));
  const [edges, setEdges, onEdgesChange] = useEdgesState(toEdges(initialPrerequisites));
  const [newTitle, setNewTitle] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSkills, setEditSkills] = useState("");
  const [aiDirections, setAiDirections] = useState("");
  const [maxConcepts, setMaxConcepts] = useState(12);
  const [generating, setGenerating] = useState(false);
  const [showReplaceDialog, setShowReplaceDialog] = useState(false);
  const [generationMode, setGenerationMode] = useState<GenerationMode>(initialConcepts.length ? "iterate" : "new");
  const [layoutPreset, setLayoutPreset] = useState<LayoutPreset>("hierarchical");
  const [arranging, setArranging] = useState(false);
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance<ConceptNode, Edge> | null>(null);
  const [inspectorWidth, setInspectorWidth] = useState(360);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const hasFittedMeasuredLayoutRef = useRef(false);

  const inspectorWidthLimits = useCallback(() => {
    const workspaceWidth = workspaceRef.current?.getBoundingClientRect().width ?? 960;
    return { min: 280, max: Math.max(280, workspaceWidth - 360) };
  }, []);

  const resizeInspectorFromPointer = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const { min, max } = inspectorWidthLimits();
    const nextWidth = workspace.getBoundingClientRect().right - event.clientX;
    setInspectorWidth(Math.min(max, Math.max(min, nextWidth)));
  }, [inspectorWidthLimits]);

  useEffect(() => {
    setConcepts(initialConcepts);
    setPrerequisites(initialPrerequisites);
    setNodes(initialConcepts.map(toNode));
    setEdges(toEdges(initialPrerequisites));
  }, [initialConcepts, initialPrerequisites, setEdges, setNodes]);

  useEffect(() => {
    if (!isVisible || !flowInstance || !nodes.length || hasFittedMeasuredLayoutRef.current) return;
    hasFittedMeasuredLayoutRef.current = true;
    let secondFrame = 0;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        void flowInstance.fitView({ padding: readOnly ? 0.3 : 0.1 });
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame) window.cancelAnimationFrame(secondFrame);
    };
  }, [flowInstance, isVisible, nodes.length, readOnly]);

  const selectedConcept = concepts.find((concept) => concept.id === selectedId) ?? null;

  useEffect(() => {
    setGenerationMode(concepts.length ? "iterate" : "new");
  }, [concepts.length === 0]);

  const selectConcept = useCallback((concept: SubjectKnowledgeConcept | null) => {
    const nextSelectedId = concept?.id ?? null;
    setSelectedId(nextSelectedId);
    setEditTitle(concept?.title ?? "");
    setEditSkills(concept?.skills ?? "");
    setNodes((current) => highlightConceptNodes(current, prerequisites, nextSelectedId));
    setEdges((current) => highlightEdges(current, nextSelectedId));
  }, [prerequisites, setEdges, setNodes]);

  const applyGraph = useCallback((nextConcepts: SubjectKnowledgeConcept[], nextPrerequisites: SubjectKnowledgePrerequisite[]) => {
    setConcepts(nextConcepts);
    setPrerequisites(nextPrerequisites);
    setNodes(highlightConceptNodes(nextConcepts.map(toNode), nextPrerequisites, selectedId));
    setEdges(highlightEdges(toEdges(nextPrerequisites), selectedId));
    onChange?.({
      concepts: nextConcepts.map(({ id, title, skills, positionX, positionY }) => ({ id, title, skills, positionX, positionY })),
      prerequisites: nextPrerequisites.map(({ id, sourceConceptId, requiredConceptId, sourceHandle, targetHandle }) => ({
        id, sourceConceptId, requiredConceptId, sourceHandle, targetHandle
      }))
    });
  }, [onChange, selectedId, setEdges, setNodes]);

  function addConcept(event: FormEvent) {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    const index = concepts.length;
    const concept: SubjectKnowledgeConcept = {
      id: crypto.randomUUID(),
      subjectId,
      title,
      skills: "",
      positionX: 80 + (index % 4) * 220,
      positionY: 80 + Math.floor(index / 4) * 140
    };
    applyGraph([...concepts, concept], prerequisites);
    setNewTitle("");
    selectConcept(concept);
  }

  const connectConcepts = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    if (connection.source === connection.target || prerequisites.some((edge) =>
      edge.sourceConceptId === connection.source && edge.requiredConceptId === connection.target
    )) {
      notify({ variant: "error", message: t("knowledgeGraph.linkError") });
      return;
    }
    const outgoing = new Map<string, string[]>();
    for (const edge of prerequisites) outgoing.set(edge.sourceConceptId, [...(outgoing.get(edge.sourceConceptId) ?? []), edge.requiredConceptId]);
    const pending = [connection.target];
    const visited = new Set<string>();
    while (pending.length) {
      const conceptId = pending.pop()!;
      if (conceptId === connection.source) {
        notify({ variant: "error", message: t("knowledgeGraph.linkError") });
        return;
      }
      if (visited.has(conceptId)) continue;
      visited.add(conceptId);
      pending.push(...(outgoing.get(conceptId) ?? []));
    }
    applyGraph(concepts, [...prerequisites, {
      id: crypto.randomUUID(),
      subjectId,
      sourceConceptId: connection.source,
      requiredConceptId: connection.target,
      sourceHandle: connection.sourceHandle as SubjectKnowledgePrerequisite["sourceHandle"],
      targetHandle: connection.targetHandle as SubjectKnowledgePrerequisite["targetHandle"]
    }]);
  }, [applyGraph, concepts, notify, prerequisites, subjectId, t]);

  const reconnectPrerequisite = useCallback((oldEdge: Edge, connection: Connection) => {
    if (!connection.source || !connection.target) return;
    const otherEdges = prerequisites.filter((edge) => edge.id !== oldEdge.id);
    if (connection.source === connection.target || otherEdges.some((edge) =>
      edge.sourceConceptId === connection.source && edge.requiredConceptId === connection.target
    )) {
      notify({ variant: "error", message: t("knowledgeGraph.linkError") });
      return;
    }
    const outgoing = new Map<string, string[]>();
    for (const edge of otherEdges) outgoing.set(edge.sourceConceptId, [...(outgoing.get(edge.sourceConceptId) ?? []), edge.requiredConceptId]);
    outgoing.set(connection.source, [...(outgoing.get(connection.source) ?? []), connection.target]);
    const pending = [...(outgoing.get(connection.target) ?? [])];
    const visited = new Set<string>();
    while (pending.length) {
      const conceptId = pending.pop()!;
      if (conceptId === connection.source) {
        notify({ variant: "error", message: t("knowledgeGraph.linkError") });
        return;
      }
      if (visited.has(conceptId)) continue;
      visited.add(conceptId);
      pending.push(...(outgoing.get(conceptId) ?? []));
    }
    applyGraph(concepts, prerequisites.map((edge) => edge.id === oldEdge.id ? {
      ...edge,
      sourceConceptId: connection.source!,
      requiredConceptId: connection.target!,
      sourceHandle: connection.sourceHandle as SubjectKnowledgePrerequisite["sourceHandle"],
      targetHandle: connection.targetHandle as SubjectKnowledgePrerequisite["targetHandle"]
    } : edge));
  }, [applyGraph, concepts, notify, prerequisites, t]);

  function saveConcept(event: FormEvent) {
    event.preventDefault();
    if (!selectedConcept || !editTitle.trim()) return;
    const normalizedSkills = editSkills.split(/\r?\n/).map((skill) => skill.trim()).filter(Boolean).join("\n");
    const next = concepts.map((concept) => concept.id === selectedConcept.id
      ? { ...concept, title: editTitle.trim(), skills: normalizedSkills }
      : concept);
    applyGraph(next, prerequisites);
    selectConcept(next.find((concept) => concept.id === selectedConcept.id) ?? null);
  }

  function deleteConcept() {
    if (!selectedConcept) return;
    applyGraph(
      concepts.filter((concept) => concept.id !== selectedConcept.id),
      prerequisites.filter((edge) => edge.sourceConceptId !== selectedConcept.id && edge.requiredConceptId !== selectedConcept.id)
    );
    selectConcept(null);
  }

  function deleteEdges(deleted: Edge[]) {
    const deletedIds = new Set(deleted.map((edge) => edge.id));
    applyGraph(concepts, prerequisites.filter((edge) => !deletedIds.has(edge.id)));
  }

  function requestGeneration() {
    if (subjectDescription.trim().length < 10) {
      notify({ variant: "error", message: t("knowledgeGraph.aiDescriptionRequired") });
      return;
    }
    if (generationMode === "new" && concepts.length) {
      setShowReplaceDialog(true);
      return;
    }
    void generateGraph();
  }

  async function generateGraph() {
    setGenerating(true);
    setShowReplaceDialog(false);
    try {
      const result = await api.generateSubjectKnowledgeGraph(subjectId, {
        description: subjectDescription,
        directions: aiDirections,
        maxConcepts,
        teachingLanguage,
        mode: generationMode,
        existingGraph: generationMode === "iterate" ? {
          concepts: concepts.map(({ id, title, skills, positionX, positionY }) => ({ id, title, skills, positionX, positionY })),
          prerequisites: prerequisites.map(({ id, sourceConceptId, requiredConceptId, sourceHandle, targetHandle }) => ({
            id, sourceConceptId, requiredConceptId, sourceHandle, targetHandle
          }))
        } : undefined
      });
      applyGraph(result.concepts, result.prerequisites);
      selectConcept(null);
      notify({ variant: "success", message: t("knowledgeGraph.aiGenerated") });
    } catch (error) {
      notify({ variant: "error", message: error instanceof Error ? error.message : t("knowledgeGraph.aiGenerateError") });
    } finally {
      setGenerating(false);
    }
  }

  function revertGraph() {
    applyGraph(savedConcepts, savedPrerequisites);
    selectConcept(null);
    notify({ variant: "info", message: t("knowledgeGraph.reverted") });
  }

  async function arrangeGraph() {
    if (!concepts.length || arranging) return;
    setArranging(true);
    try {
      const presetOptions: Record<LayoutPreset, Record<string, string>> = {
        hierarchical: {
          "elk.algorithm": "org.eclipse.elk.layered",
          "elk.direction": "DOWN",
          "elk.edgeRouting": "ORTHOGONAL",
          "elk.layered.spacing.nodeNodeBetweenLayers": "90",
          "elk.spacing.nodeNode": "70"
        },
        forest: {
          "elk.algorithm": "org.eclipse.elk.mrtree",
          "elk.direction": "DOWN",
          "elk.spacing.nodeNode": "80",
          "elk.spacing.componentComponent": "130"
        },
        radial: {
          "elk.algorithm": "org.eclipse.elk.radial",
          "elk.spacing.nodeNode": "90",
          "elk.spacing.componentComponent": "150"
        },
        force: {
          "elk.algorithm": "org.eclipse.elk.force",
          "elk.force.model": "FR",
          "elk.spacing.nodeNode": "80",
          "elk.spacing.componentComponent": "140"
        },
        compact: {
          "elk.algorithm": "org.eclipse.elk.layered",
          "elk.direction": "DOWN",
          "elk.edgeRouting": "ORTHOGONAL",
          "elk.layered.spacing.nodeNodeBetweenLayers": "50",
          "elk.spacing.nodeNode": "30",
          "elk.spacing.componentComponent": "60",
          "elk.aspectRatio": "1.8"
        }
      };
      const result = await elk.layout({
        id: "subject-knowledge-graph",
        layoutOptions: {
          "elk.separateConnectedComponents": "true",
          ...presetOptions[layoutPreset]
        },
        children: concepts.map((concept) => ({ id: concept.id, width: 180, height: 58 })),
        // Layout uses prerequisite -> dependent so foundations appear first; displayed arrows retain the authored direction.
        edges: prerequisites.map((edge) => ({
          id: edge.id,
          sources: [edge.requiredConceptId],
          targets: [edge.sourceConceptId]
        }))
      });
      const positions = new Map((result.children ?? []).map((node) => [node.id, { x: node.x ?? 0, y: node.y ?? 0 }]));
      applyGraph(concepts.map((concept) => {
        const position = positions.get(concept.id);
        return position ? { ...concept, positionX: position.x, positionY: position.y } : concept;
      }), prerequisites);
      setTimeout(() => void flowInstance?.fitView({ padding: 0.15, duration: 300 }), 0);
    } catch (error) {
      notify({ variant: "error", message: error instanceof Error ? error.message : t("knowledgeGraph.layoutError") });
    } finally {
      setArranging(false);
    }
  }

  return (
    <section className={`section stack knowledge-graph-section${readOnly ? " knowledge-graph-preview" : ""}`}>
      <div className="section-heading knowledge-graph-heading">
        <div>
          <p className="eyebrow">{t("knowledgeGraph.eyebrow")}</p>
          <h2>{t("knowledgeGraph.title")}</h2>
          {!readOnly ? <p className="muted">{t("knowledgeGraph.help")}</p> : null}
        </div>
        {!readOnly ? <form className="knowledge-graph-add" onSubmit={addConcept}>
          <label className="sr-only" htmlFor="new-concept-title">{t("knowledgeGraph.conceptTitle")}</label>
          <input id="new-concept-title" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder={t("knowledgeGraph.addPlaceholder")} />
          <button className="button" disabled={!newTitle.trim()} type="submit">{t("knowledgeGraph.addConcept")}</button>
        </form> : null}
      </div>

      {!readOnly && aiGenerationEnabled ? (
        <details className="knowledge-graph-ai">
          <summary>{t("knowledgeGraph.aiSection")}</summary>
          <div className="stack knowledge-graph-ai-content">
            <div className="field knowledge-graph-ai-mode">
              <label htmlFor="knowledge-graph-ai-mode">{t("knowledgeGraph.aiMode")}</label>
              <select id="knowledge-graph-ai-mode" value={generationMode} onChange={(event) => setGenerationMode(event.target.value as GenerationMode)}>
                <option value="new">{t("knowledgeGraph.aiModeNew")}</option>
                <option value="iterate" disabled={!concepts.length}>{t("knowledgeGraph.aiModeIterate")}</option>
              </select>
              <p className="muted">{t(generationMode === "iterate" ? "knowledgeGraph.aiModeIterateHelp" : "knowledgeGraph.aiModeNewHelp")}</p>
            </div>
            <div className="field">
              <label htmlFor="knowledge-graph-ai-directions">{t("knowledgeGraph.aiDirections")}</label>
              <textarea
                id="knowledge-graph-ai-directions"
                maxLength={4000}
                rows={4}
                value={aiDirections}
                onChange={(event) => setAiDirections(event.target.value)}
              />
            </div>
            <div className="field knowledge-graph-ai-limit">
              <label htmlFor="knowledge-graph-ai-max-concepts">{t("knowledgeGraph.aiMaxConcepts")}</label>
              <input
                id="knowledge-graph-ai-max-concepts"
                max={50}
                min={1}
                type="number"
                value={maxConcepts}
                onChange={(event) => setMaxConcepts(Math.max(1, Math.min(50, Number(event.target.value) || 1)))}
              />
            </div>
            <p className="muted">{t("knowledgeGraph.aiHelp")}</p>
            <div className="row">
              <button type="button" disabled={generating || subjectDescription.trim().length < 10} onClick={requestGeneration}>
                {generating
                  ? t("knowledgeGraph.aiGenerating")
                  : t(generationMode === "iterate" ? "knowledgeGraph.aiIterate" : "knowledgeGraph.aiGenerate")}
              </button>
              <button className="secondary" type="button" disabled={generating} onClick={revertGraph}>
                {t("knowledgeGraph.revert")}
              </button>
            </div>
          </div>
        </details>
      ) : null}

      {!readOnly ? (
        <div className="knowledge-graph-layout-controls">
          <div className="field">
            <label htmlFor="knowledge-graph-layout">{t("knowledgeGraph.layoutLabel")}</label>
            <select
              id="knowledge-graph-layout"
              value={layoutPreset}
              onChange={(event) => setLayoutPreset(event.target.value as LayoutPreset)}
            >
              <option value="hierarchical">{t("knowledgeGraph.layoutHierarchical")}</option>
              <option value="forest">{t("knowledgeGraph.layoutForest")}</option>
              <option value="radial">{t("knowledgeGraph.layoutRadial")}</option>
              <option value="force">{t("knowledgeGraph.layoutForce")}</option>
              <option value="compact">{t("knowledgeGraph.layoutCompact")}</option>
            </select>
          </div>
          <button className="secondary" type="button" disabled={!concepts.length || arranging} onClick={() => void arrangeGraph()}>
            {arranging ? t("knowledgeGraph.arranging") : t("knowledgeGraph.arrange")}
          </button>
        </div>
      ) : null}

      {selectedConcept ? <div className="knowledge-graph-edge-legend" aria-label={t("knowledgeGraph.edgeLegend")}>
        <span><i className="knowledge-edge-swatch knowledge-edge-swatch-outgoing" />{t("knowledgeGraph.outgoingEdges")}</span>
        <span><i className="knowledge-edge-swatch knowledge-edge-swatch-incoming" />{t("knowledgeGraph.incomingEdges")}</span>
      </div> : null}

      {readOnly && !nodes.length ? <p className="muted">{t("knowledgeGraph.empty")}</p> : (
      <div
        className="knowledge-graph-workspace"
        ref={workspaceRef}
        style={{ "--knowledge-inspector-width": `${inspectorWidth}px` } as CSSProperties}
      >
        <div className="knowledge-graph-canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={readOnly ? undefined : connectConcepts}
            onReconnect={readOnly ? undefined : reconnectPrerequisite}
            connectionMode={ConnectionMode.Loose}
            elevateEdgesOnSelect
            nodeTypes={conceptNodeTypes}
            onInit={setFlowInstance}
            onPaneClick={() => selectConcept(null)}
            onNodeClick={(_event, node) => selectConcept(concepts.find((concept) => concept.id === node.id) ?? null)}
            onNodeDragStop={readOnly ? undefined : (_event, node) => {
              applyGraph(
                concepts.map((concept) => concept.id === node.id
                  ? { ...concept, positionX: node.position.x, positionY: node.position.y }
                  : concept),
                prerequisites
              );
            }}
            onEdgesDelete={readOnly ? undefined : deleteEdges}
            onEdgeClick={(_event, selectedEdge) => {
              selectConcept(null);
              setEdges((current) => [
                ...current
                  .filter((edge) => edge.id !== selectedEdge.id)
                  .map((edge) => ({ ...edge, selected: false, zIndex: 0 })),
                { ...selectedEdge, selected: true, zIndex: 1000 }
              ]);
            }}
            nodesDraggable={!readOnly}
            nodesConnectable={!readOnly}
            edgesReconnectable={!readOnly}
            elementsSelectable
            deleteKeyCode={readOnly ? null : ["Backspace", "Delete"]}
            panOnDrag
            zoomOnScroll
            zoomOnPinch
            zoomOnDoubleClick={!readOnly}
            fitView
            fitViewOptions={{ padding: readOnly ? 0.3 : 0.1 }}
            minZoom={0.15}
            maxZoom={2.5}
          >
            <Background gap={20} size={1} />
            {!readOnly ? <MiniMap pannable zoomable /> : null}
            <Controls showInteractive={!readOnly} />
          </ReactFlow>
        </div>

        {!readOnly ? (
          <div
            className="knowledge-graph-splitter"
            role="separator"
            aria-label={t("knowledgeGraph.resizeInspector")}
            aria-orientation="vertical"
            aria-valuemin={inspectorWidthLimits().min}
            aria-valuemax={inspectorWidthLimits().max}
            aria-valuenow={Math.round(inspectorWidth)}
            tabIndex={0}
            onDoubleClick={() => setInspectorWidth(360)}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              resizeInspectorFromPointer(event);
            }}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) resizeInspectorFromPointer(event);
            }}
            onKeyDown={(event) => {
              const { min, max } = inspectorWidthLimits();
              if (event.key === "ArrowLeft") setInspectorWidth((width) => Math.min(max, width + 24));
              else if (event.key === "ArrowRight") setInspectorWidth((width) => Math.max(min, width - 24));
              else if (event.key === "Home") setInspectorWidth(min);
              else if (event.key === "End") setInspectorWidth(max);
              else return;
              event.preventDefault();
            }}
          />
        ) : null}

        {!readOnly ? <aside className="knowledge-graph-inspector">
          {selectedConcept ? (
            <form className="stack" onSubmit={saveConcept}>
              <div>
                <p className="eyebrow">{t("knowledgeGraph.selectedEyebrow")}</p>
                <h3>{t("knowledgeGraph.editConcept")}</h3>
              </div>
              <div className="field">
                <label htmlFor="concept-title">{t("knowledgeGraph.conceptTitle")}</label>
                <input id="concept-title" value={editTitle} onChange={(event) => setEditTitle(event.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="concept-skills">{t("knowledgeGraph.conceptSkills")}</label>
                <textarea id="concept-skills" rows={7} value={editSkills} onChange={(event) => setEditSkills(event.target.value)} />
                <span className="muted">{t("knowledgeGraph.conceptSkillsHelp")}</span>
              </div>
              <button className="button" disabled={!editTitle.trim()} type="submit">{t("knowledgeGraph.applyConcept")}</button>
              <button className="button danger" onClick={deleteConcept} type="button">{t("knowledgeGraph.deleteConcept")}</button>
            </form>
          ) : (
            <div className="knowledge-graph-empty stack">
              <strong>{t("knowledgeGraph.noSelectionTitle")}</strong>
              <p className="muted">{t("knowledgeGraph.noSelectionHelp")}</p>
            </div>
          )}
        </aside> : null}
      </div>
      )}

      {showReplaceDialog ? (
        <div className="dialog-backdrop" role="presentation">
          <div aria-modal="true" className="dialog-panel" role="dialog" aria-labelledby="knowledge-graph-ai-replace-title">
            <div className="stack" style={{ gap: 8 }}>
              <p className="eyebrow">{t("knowledgeGraph.aiGenerate")}</p>
              <h2 id="knowledge-graph-ai-replace-title">{t("knowledgeGraph.aiReplaceTitle")}</h2>
              <p className="muted">{t("knowledgeGraph.aiReplaceMessage")}</p>
            </div>
            <div className="dialog-actions">
              <button className="secondary" type="button" onClick={() => setShowReplaceDialog(false)}>
                {t("knowledgeGraph.aiKeepCurrent")}
              </button>
              <button type="button" onClick={() => void generateGraph()}>
                {t("knowledgeGraph.aiReplace")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
