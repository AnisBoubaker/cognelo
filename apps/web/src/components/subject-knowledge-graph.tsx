"use client";

import "@xyflow/react/dist/style.css";
import {
  addEdge,
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
  useEdgesState,
  useNodesState
} from "@xyflow/react";
import { useNotifications } from "@cognelo/activity-ui";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  api,
  type SubjectKnowledgeConcept,
  type SubjectKnowledgePrerequisite
} from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Props = {
  subjectId: string;
  initialConcepts: SubjectKnowledgeConcept[];
  initialPrerequisites: SubjectKnowledgePrerequisite[];
  readOnly?: boolean;
  aiGenerationEnabled?: boolean;
  subjectDescription?: string;
};

type ConceptNode = Node<{ label: string }>;

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

const toEdge = (prerequisite: SubjectKnowledgePrerequisite): Edge => ({
  id: prerequisite.id,
  source: prerequisite.sourceConceptId,
  target: prerequisite.requiredConceptId,
  markerEnd: { type: MarkerType.ArrowClosed },
  type: "smoothstep"
});

export function SubjectKnowledgeGraph({
  subjectId,
  initialConcepts,
  initialPrerequisites,
  readOnly = false,
  aiGenerationEnabled = false,
  subjectDescription = ""
}: Props) {
  const { locale, t } = useI18n();
  const { notify } = useNotifications();
  const [concepts, setConcepts] = useState(initialConcepts);
  const [nodes, setNodes, onNodesChange] = useNodesState<ConceptNode>(initialConcepts.map(toNode));
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialPrerequisites.map(toEdge));
  const [newTitle, setNewTitle] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [aiDirections, setAiDirections] = useState("");
  const [maxConcepts, setMaxConcepts] = useState(12);
  const [generating, setGenerating] = useState(false);
  const [showReplaceDialog, setShowReplaceDialog] = useState(false);

  useEffect(() => {
    setConcepts(initialConcepts);
    setNodes(initialConcepts.map(toNode));
    setEdges(initialPrerequisites.map(toEdge));
  }, [initialConcepts, initialPrerequisites, setEdges, setNodes]);

  const selectedConcept = concepts.find((concept) => concept.id === selectedId) ?? null;

  const selectConcept = useCallback((concept: SubjectKnowledgeConcept | null) => {
    setSelectedId(concept?.id ?? null);
    setEditTitle(concept?.title ?? "");
    setEditDescription(concept?.description ?? "");
  }, []);

  async function addConcept(event: FormEvent) {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title || saving) return;
    setSaving(true);
    try {
      const index = concepts.length;
      const result = await api.createSubjectKnowledgeConcept(subjectId, {
        title,
        description: "",
        positionX: 80 + (index % 4) * 220,
        positionY: 80 + Math.floor(index / 4) * 140
      });
      setConcepts((current) => [...current, result.concept]);
      setNodes((current) => [...current, toNode(result.concept)]);
      setNewTitle("");
      selectConcept(result.concept);
    } catch (error) {
      notify({ variant: "error", message: error instanceof Error ? error.message : t("knowledgeGraph.saveError") });
    } finally {
      setSaving(false);
    }
  }

  const connectConcepts = useCallback(async (connection: Connection) => {
    if (!connection.source || !connection.target) return;
    try {
      const result = await api.createSubjectKnowledgePrerequisite(subjectId, {
        sourceConceptId: connection.source,
        requiredConceptId: connection.target
      });
      setEdges((current) => addEdge(toEdge(result.prerequisite), current));
    } catch (error) {
      notify({ variant: "error", message: error instanceof Error ? error.message : t("knowledgeGraph.linkError") });
    }
  }, [notify, setEdges, subjectId, t]);

  async function saveConcept(event: FormEvent) {
    event.preventDefault();
    if (!selectedConcept || !editTitle.trim() || saving) return;
    setSaving(true);
    try {
      const result = await api.updateSubjectKnowledgeConcept(subjectId, selectedConcept.id, {
        title: editTitle.trim(), description: editDescription
      });
      setConcepts((current) => current.map((concept) => concept.id === result.concept.id ? result.concept : concept));
      setNodes((current) => current.map((node) => node.id === result.concept.id ? { ...node, data: { label: result.concept.title } } : node));
      notify({ variant: "success", message: t("knowledgeGraph.saved") });
    } catch (error) {
      notify({ variant: "error", message: error instanceof Error ? error.message : t("knowledgeGraph.saveError") });
    } finally {
      setSaving(false);
    }
  }

  async function deleteConcept() {
    if (!selectedConcept || saving) return;
    setSaving(true);
    try {
      await api.deleteSubjectKnowledgeConcept(subjectId, selectedConcept.id);
      setConcepts((current) => current.filter((concept) => concept.id !== selectedConcept.id));
      setNodes((current) => current.filter((node) => node.id !== selectedConcept.id));
      setEdges((current) => current.filter((edge) => edge.source !== selectedConcept.id && edge.target !== selectedConcept.id));
      selectConcept(null);
    } catch (error) {
      notify({ variant: "error", message: error instanceof Error ? error.message : t("knowledgeGraph.deleteError") });
    } finally {
      setSaving(false);
    }
  }

  async function deleteEdges(deleted: Edge[]) {
    const results = await Promise.allSettled(deleted.map((edge) => api.deleteSubjectKnowledgePrerequisite(subjectId, edge.id)));
    if (results.some((result) => result.status === "rejected")) {
      notify({ variant: "error", message: t("knowledgeGraph.deleteError") });
    }
  }

  function requestGeneration() {
    if (subjectDescription.trim().length < 10) {
      notify({ variant: "error", message: t("knowledgeGraph.aiDescriptionRequired") });
      return;
    }
    if (concepts.length) {
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
        locale
      });
      setConcepts(result.concepts);
      setNodes(result.concepts.map(toNode));
      setEdges(result.prerequisites.map(toEdge));
      selectConcept(null);
      notify({ variant: "success", message: t("knowledgeGraph.aiGenerated") });
    } catch (error) {
      notify({ variant: "error", message: error instanceof Error ? error.message : t("knowledgeGraph.aiGenerateError") });
    } finally {
      setGenerating(false);
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
          <button className="button" disabled={!newTitle.trim() || saving} type="submit">{t("knowledgeGraph.addConcept")}</button>
        </form> : null}
      </div>

      {!readOnly && aiGenerationEnabled ? (
        <details className="knowledge-graph-ai">
          <summary>{t("knowledgeGraph.aiSection")}</summary>
          <div className="stack knowledge-graph-ai-content">
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
                {generating ? t("knowledgeGraph.aiGenerating") : t("knowledgeGraph.aiGenerate")}
              </button>
            </div>
          </div>
        </details>
      ) : null}

      {readOnly && !nodes.length ? <p className="muted">{t("knowledgeGraph.empty")}</p> : (
      <div className="knowledge-graph-workspace">
        <div className="knowledge-graph-canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={readOnly ? undefined : connectConcepts}
            connectionMode={ConnectionMode.Loose}
            nodeTypes={conceptNodeTypes}
            onNodeClick={readOnly ? undefined : (_event, node) => selectConcept(concepts.find((concept) => concept.id === node.id) ?? null)}
            onNodeDragStop={readOnly ? undefined : (_event, node) => {
              void api.updateSubjectKnowledgeConcept(subjectId, node.id, { positionX: node.position.x, positionY: node.position.y })
                .catch(() => notify({ variant: "error", message: t("knowledgeGraph.positionError") }));
            }}
            onEdgesDelete={readOnly ? undefined : (deleted) => void deleteEdges(deleted)}
            nodesDraggable={!readOnly}
            nodesConnectable={!readOnly}
            elementsSelectable={!readOnly}
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
                <label htmlFor="concept-description">{t("knowledgeGraph.conceptDescription")}</label>
                <textarea id="concept-description" rows={5} value={editDescription} onChange={(event) => setEditDescription(event.target.value)} />
              </div>
              <button className="button" disabled={!editTitle.trim() || saving} type="submit">{t("common.save")}</button>
              <button className="button danger" disabled={saving} onClick={() => void deleteConcept()} type="button">{t("knowledgeGraph.deleteConcept")}</button>
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
