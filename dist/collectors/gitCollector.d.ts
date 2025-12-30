/**
 * FuncLib v4 - Git History Collector
 * Commit history, hotspots, blame bilgisi toplar
 */
export interface Commit {
    hash: string;
    shortHash: string;
    author: string;
    email: string;
    date: Date;
    message: string;
    files: string[];
    insertions: number;
    deletions: number;
}
export interface FileHotspot {
    file: string;
    changeCount: number;
    authors: string[];
    lastModified: Date;
    bugFixCount: number;
    complexity: number;
}
export interface BlameLine {
    line: number;
    commit: string;
    author: string;
    date: Date;
    content: string;
}
export interface AuthorStats {
    author: string;
    email: string;
    commits: number;
    insertions: number;
    deletions: number;
    files: string[];
    lastCommit: Date;
}
export declare class GitCollector {
    private projectPath;
    private cache;
    constructor(projectPath: string);
    /**
     * Git available mı kontrol et
     */
    isAvailable(): boolean;
    /**
     * Son N günün commit'lerini getir
     */
    getCommitHistory(days?: number): Commit[];
    /**
     * En çok değişen dosyaları bul (hotspots)
     */
    getHotspots(limit?: number): FileHotspot[];
    /**
     * Dosya blame bilgisi
     */
    getBlame(file: string): BlameLine[];
    /**
     * Yazar istatistikleri
     */
    getAuthorStats(): AuthorStats[];
    /**
     * Bug fix commit'lerini bul
     */
    getBugFixes(): Commit[];
    /**
     * Tek commit detayı
     */
    getCommit(hash: string): Commit | null;
    /**
     * Son değişiklik tarihi
     */
    getLastModified(file: string): Date | null;
    /**
     * Dosya için author listesi
     */
    getFileAuthors(file: string): string[];
    private exec;
    private parseCommitLog;
    private parseBlame;
    private getFileInfo;
    private getFileBugFixCount;
    private isCodeFile;
}
export declare function getGitCollector(projectPath: string): GitCollector;
export default GitCollector;
