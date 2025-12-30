/**
 * FuncLib v4 - Knowledge Graph
 * In-memory graf yapısı (Neo4j gerektirmez)
 */
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
export type NodeType = 'Function' | 'Class' | 'Module' | 'File' | 'Package' | 'Type' | 'Interface' | 'Enum' | 'Variable' | 'Constant' | 'Component' | 'Composable' | 'Store' | 'Route' | 'Test' | 'Commit' | 'Pattern';
export type EdgeType = 'CALLS' | 'IMPORTS' | 'EXPORTS' | 'EXTENDS' | 'IMPLEMENTS' | 'USES' | 'DEFINES' | 'TESTS' | 'DEPENDS_ON' | 'CONTAINS' | 'SIMILAR_TO';
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
export declare class KnowledgeGraph {
    private nodes;
    private edges;
    private outEdges;
    private inEdges;
    private persistPath;
    constructor(persistPath?: string);
    /**
     * Node ekle
     */
    addNode(node: GraphNode): void;
    /**
     * Edge ekle
     */
    addEdge(edge: GraphEdge): void;
    /**
     * Node getir
     */
    getNode(id: string): GraphNode | undefined;
    /**
     * Node ara (name ile)
     */
    findNodes(query: {
        name?: string;
        type?: NodeType;
        file?: string;
    }): GraphNode[];
    /**
     * Bir node'un dışarı giden bağlantılarını getir
     */
    getOutgoing(nodeId: string, edgeType?: EdgeType): Array<{
        edge: GraphEdge;
        target: GraphNode;
    }>;
    /**
     * Bir node'un içeri gelen bağlantılarını getir
     */
    getIncoming(nodeId: string, edgeType?: EdgeType): Array<{
        edge: GraphEdge;
        source: GraphNode;
    }>;
    /**
     * İki node arasındaki yolu bul (BFS)
     */
    findPath(fromId: string, toId: string, maxDepth?: number): PathResult | null;
    /**
     * Etki analizi (impact analysis)
     */
    findImpact(nodeId: string, maxDepth?: number): ImpactResult;
    /**
     * Döngüsel bağımlılıkları bul
     */
    findCycles(): Array<string[]>;
    /**
     * Hotspot'ları bul (en çok bağlantısı olan node'lar)
     */
    findHotspots(limit?: number): Array<{
        node: GraphNode;
        inCount: number;
        outCount: number;
        total: number;
    }>;
    /**
     * Tümünü temizle
     */
    clear(): void;
    /**
     * İstatistikler
     */
    getStats(): {
        nodeCount: number;
        edgeCount: number;
        nodeTypes: Record<string, number>;
        edgeTypes: Record<string, number>;
    };
    /**
     * Disk'e kaydet
     */
    save(): void;
    /**
     * Disk'ten yükle
     */
    load(): void;
}
export declare function getKnowledgeGraph(pathOrProjectPath?: string): KnowledgeGraph;
export default KnowledgeGraph;
