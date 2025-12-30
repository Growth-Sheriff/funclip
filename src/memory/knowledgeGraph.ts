/**
 * FuncLib v4 - Knowledge Graph
 * In-memory graf yapısı (Neo4j gerektirmez)
 */

import * as fs from 'fs';
import * as path from 'path';

export interface GraphNode {
  id: string;
  type: NodeType;
  name: string;
  file?: string;
  line?: number;
  properties: Record<string, any>;
}

export interface GraphEdge {
  id: string;
  type: EdgeType;
  source: string;
  target: string;
  properties: Record<string, any>;
}

export type NodeType = 
  | 'Function' | 'Class' | 'Module' | 'File' | 'Package'
  | 'Type' | 'Interface' | 'Enum' | 'Variable' | 'Constant'
  | 'Component' | 'Composable' | 'Store' | 'Route'
  | 'Test' | 'Commit' | 'Pattern';

export type EdgeType =
  | 'CALLS' | 'IMPORTS' | 'EXPORTS'
  | 'EXTENDS' | 'IMPLEMENTS'
  | 'USES' | 'DEFINES'
  | 'TESTS' | 'DEPENDS_ON'
  | 'CONTAINS' | 'SIMILAR_TO';

export interface PathResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  length: number;
}

export interface ImpactResult {
  directNodes: GraphNode[];
  transitiveNodes: GraphNode[];
  depth: number;
  totalAffected: number;
}

export class KnowledgeGraph {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge> = new Map();
  private outEdges: Map<string, Set<string>> = new Map(); // nodeId -> edgeIds
  private inEdges: Map<string, Set<string>> = new Map();  // nodeId -> edgeIds
  private persistPath: string | null = null;

  constructor(persistPath?: string) {
    this.persistPath = persistPath || null;
    if (this.persistPath) {
      this.load();
    }
  }

  /**
   * Node ekle
   */
  addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
    if (!this.outEdges.has(node.id)) {
      this.outEdges.set(node.id, new Set());
    }
    if (!this.inEdges.has(node.id)) {
      this.inEdges.set(node.id, new Set());
    }
  }

  /**
   * Edge ekle
   */
  addEdge(edge: GraphEdge): void {
    this.edges.set(edge.id, edge);
    
    // Index güncelle
    if (!this.outEdges.has(edge.source)) {
      this.outEdges.set(edge.source, new Set());
    }
    this.outEdges.get(edge.source)!.add(edge.id);

    if (!this.inEdges.has(edge.target)) {
      this.inEdges.set(edge.target, new Set());
    }
    this.inEdges.get(edge.target)!.add(edge.id);
  }

  /**
   * Node getir
   */
  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Node ara (name ile)
   */
  findNodes(query: {
    name?: string;
    type?: NodeType;
    file?: string;
  }): GraphNode[] {
    const results: GraphNode[] = [];
    
    // Normalize file path for cross-platform comparison
    const normalizeFilePath = (p?: string) => p?.replace(/\\/g, '/').toLowerCase();
    const queryFileNormalized = normalizeFilePath(query.file);
    
    for (const node of this.nodes.values()) {
      let match = true;
      
      if (query.name && !node.name.toLowerCase().includes(query.name.toLowerCase())) {
        match = false;
      }
      if (query.type && node.type !== query.type) {
        match = false;
      }
      if (queryFileNormalized && normalizeFilePath(node.file) !== queryFileNormalized) {
        match = false;
      }
      
      if (match) {
        results.push(node);
      }
    }
    
    return results;
  }

  /**
   * Bir node'un dışarı giden bağlantılarını getir
   */
  getOutgoing(nodeId: string, edgeType?: EdgeType): Array<{ edge: GraphEdge; target: GraphNode }> {
    const results: Array<{ edge: GraphEdge; target: GraphNode }> = [];
    const edgeIds = this.outEdges.get(nodeId);
    
    if (!edgeIds) return results;

    for (const edgeId of edgeIds) {
      const edge = this.edges.get(edgeId);
      if (!edge) continue;
      if (edgeType && edge.type !== edgeType) continue;
      
      const target = this.nodes.get(edge.target);
      if (target) {
        results.push({ edge, target });
      }
    }
    
    return results;
  }

  /**
   * Bir node'un içeri gelen bağlantılarını getir
   */
  getIncoming(nodeId: string, edgeType?: EdgeType): Array<{ edge: GraphEdge; source: GraphNode }> {
    const results: Array<{ edge: GraphEdge; source: GraphNode }> = [];
    const edgeIds = this.inEdges.get(nodeId);
    
    if (!edgeIds) return results;

    for (const edgeId of edgeIds) {
      const edge = this.edges.get(edgeId);
      if (!edge) continue;
      if (edgeType && edge.type !== edgeType) continue;
      
      const source = this.nodes.get(edge.source);
      if (source) {
        results.push({ edge, source });
      }
    }
    
    return results;
  }

  /**
   * İki node arasındaki yolu bul (BFS)
   */
  findPath(fromId: string, toId: string, maxDepth: number = 10): PathResult | null {
    if (fromId === toId) {
      const node = this.nodes.get(fromId);
      return node ? { nodes: [node], edges: [], length: 0 } : null;
    }

    const visited = new Set<string>();
    const queue: Array<{ nodeId: string; path: string[]; edges: string[] }> = [
      { nodeId: fromId, path: [fromId], edges: [] }
    ];

    while (queue.length > 0) {
      const { nodeId, path, edges } = queue.shift()!;
      
      if (path.length > maxDepth) continue;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      const outgoing = this.getOutgoing(nodeId);
      for (const { edge, target } of outgoing) {
        if (target.id === toId) {
          // Yol bulundu
          const resultPath = [...path, target.id];
          const resultEdges = [...edges, edge.id];
          return {
            nodes: resultPath.map(id => this.nodes.get(id)!),
            edges: resultEdges.map(id => this.edges.get(id)!),
            length: resultEdges.length,
          };
        }

        if (!visited.has(target.id)) {
          queue.push({
            nodeId: target.id,
            path: [...path, target.id],
            edges: [...edges, edge.id],
          });
        }
      }
    }

    return null;
  }

  /**
   * Etki analizi (impact analysis)
   */
  findImpact(nodeId: string, maxDepth: number = 5): ImpactResult {
    const directNodes: GraphNode[] = [];
    const transitiveNodes: GraphNode[] = [];
    const visited = new Set<string>();
    
    const traverse = (id: string, depth: number, isDirect: boolean) => {
      if (visited.has(id) || depth > maxDepth) return;
      visited.add(id);

      const node = this.nodes.get(id);
      if (!node) return;

      if (id !== nodeId) {
        if (isDirect) {
          directNodes.push(node);
        } else {
          transitiveNodes.push(node);
        }
      }

      // Bu node'u kullanan tüm node'ları bul
      const incoming = this.getIncoming(id);
      for (const { source } of incoming) {
        traverse(source.id, depth + 1, depth === 0);
      }
    };

    traverse(nodeId, 0, true);

    return {
      directNodes,
      transitiveNodes,
      depth: maxDepth,
      totalAffected: directNodes.length + transitiveNodes.length,
    };
  }

  /**
   * Döngüsel bağımlılıkları bul
   */
  findCycles(): Array<string[]> {
    const cycles: Array<string[]> = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (nodeId: string) => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const outgoing = this.getOutgoing(nodeId);
      for (const { target } of outgoing) {
        if (!visited.has(target.id)) {
          dfs(target.id);
        } else if (recursionStack.has(target.id)) {
          // Döngü bulundu
          const cycleStart = path.indexOf(target.id);
          cycles.push([...path.slice(cycleStart), target.id]);
        }
      }

      path.pop();
      recursionStack.delete(nodeId);
    };

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    }

    return cycles;
  }

  /**
   * Hotspot'ları bul (en çok bağlantısı olan node'lar)
   */
  findHotspots(limit: number = 10): Array<{ node: GraphNode; inCount: number; outCount: number; total: number }> {
    const stats: Array<{ node: GraphNode; inCount: number; outCount: number; total: number }> = [];

    for (const node of this.nodes.values()) {
      const inCount = this.inEdges.get(node.id)?.size || 0;
      const outCount = this.outEdges.get(node.id)?.size || 0;
      stats.push({
        node,
        inCount,
        outCount,
        total: inCount + outCount,
      });
    }

    return stats.sort((a, b) => b.total - a.total).slice(0, limit);
  }

  /**
   * Tümünü temizle
   */
  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.outEdges.clear();
    this.inEdges.clear();
  }

  /**
   * İstatistikler
   */
  getStats(): {
    nodeCount: number;
    edgeCount: number;
    nodeTypes: Record<string, number>;
    edgeTypes: Record<string, number>;
  } {
    const nodeTypes: Record<string, number> = {};
    const edgeTypes: Record<string, number> = {};

    for (const node of this.nodes.values()) {
      nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
    }

    for (const edge of this.edges.values()) {
      edgeTypes[edge.type] = (edgeTypes[edge.type] || 0) + 1;
    }

    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.size,
      nodeTypes,
      edgeTypes,
    };
  }

  /**
   * Disk'e kaydet
   */
  save(): void {
    if (!this.persistPath) return;

    const data = {
      nodes: Array.from(this.nodes.entries()),
      edges: Array.from(this.edges.entries()),
      version: '1.0',
      savedAt: new Date().toISOString(),
    };

    const dir = path.dirname(this.persistPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(this.persistPath, JSON.stringify(data));
    console.log(`💾 Knowledge graph kaydedildi: ${this.persistPath}`);
  }

  /**
   * Disk'ten yükle
   */
  load(): void {
    if (!this.persistPath) return;
    
    // Eğer dizin ise, dosya yolunu oluştur
    let filePath = this.persistPath;
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'knowledge-graph.json');
      this.persistPath = filePath;
    }
    
    if (!fs.existsSync(filePath)) return;

    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      
      this.nodes = new Map(data.nodes);
      this.edges = new Map(data.edges);
      
      // Index'leri yeniden oluştur
      this.outEdges.clear();
      this.inEdges.clear();
      
      for (const node of this.nodes.values()) {
        this.outEdges.set(node.id, new Set());
        this.inEdges.set(node.id, new Set());
      }
      
      for (const edge of this.edges.values()) {
        if (!this.outEdges.has(edge.source)) {
          this.outEdges.set(edge.source, new Set());
        }
        this.outEdges.get(edge.source)!.add(edge.id);

        if (!this.inEdges.has(edge.target)) {
          this.inEdges.set(edge.target, new Set());
        }
        this.inEdges.get(edge.target)!.add(edge.id);
      }

      console.log(`📂 Knowledge graph yüklendi: ${this.nodes.size} node, ${this.edges.size} edge`);
    } catch (error) {
      console.error('Knowledge graph yükleme hatası:', error);
    }
  }
}

// Singleton
let graphInstance: KnowledgeGraph | null = null;

export function getKnowledgeGraph(pathOrProjectPath?: string): KnowledgeGraph {
  if (!graphInstance) {
    let persistPath: string;
    
    if (pathOrProjectPath) {
      // Check if it's already a graph.json path
      if (pathOrProjectPath.endsWith('graph.json')) {
        persistPath = pathOrProjectPath;
      } else if (pathOrProjectPath.endsWith('.funclib')) {
        // It's the .funclib directory
        persistPath = path.join(pathOrProjectPath, 'graph.json');
      } else {
        // It's a project path
        persistPath = path.join(pathOrProjectPath, '.funclib', 'graph.json');
      }
    } else {
      // Default: use cwd
      persistPath = path.join(process.cwd(), '.funclib', 'graph.json');
    }
    
    graphInstance = new KnowledgeGraph(persistPath);
  }
  return graphInstance;
}

export default KnowledgeGraph;
