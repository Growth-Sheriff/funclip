/**
 * FuncLib v4 - Git History Collector
 * Commit history, hotspots, blame bilgisi toplar
 */

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

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

export class GitCollector {
  private projectPath: string;
  private cache: Map<string, any> = new Map();

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  /**
   * Git available mı kontrol et
   */
  isAvailable(): boolean {
    try {
      this.exec('git --version');
      this.exec('git rev-parse --git-dir');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Son N günün commit'lerini getir
   */
  getCommitHistory(days: number = 30): Commit[] {
    const cacheKey = `commits_${days}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const since = `--since="${days} days ago"`;
      const format = '--format={"hash":"%H","shortHash":"%h","author":"%an","email":"%ae","date":"%aI","message":"%s"},';
      
      const output = this.exec(`git log ${since} ${format} --numstat`);
      const commits = this.parseCommitLog(output);
      
      this.cache.set(cacheKey, commits);
      return commits;
    } catch (e) {
      return [];
    }
  }

  /**
   * En çok değişen dosyaları bul (hotspots)
   * Windows uyumlu - pipe komutları kullanmaz
   */
  getHotspots(limit: number = 20): FileHotspot[] {
    const cacheKey = `hotspots_${limit}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // Son 90 günde değişen tüm dosyaları al (Windows uyumlu)
      const output = this.exec(
        'git log --since="90 days ago" --name-only --format=""'
      );

      // Dosya sayılarını JavaScript'te hesapla
      const fileCount: Map<string, number> = new Map();
      const lines = output.trim().split('\n').filter(Boolean);

      for (const line of lines) {
        const file = line.trim();
        if (!file || !this.isCodeFile(file)) continue;
        fileCount.set(file, (fileCount.get(file) || 0) + 1);
      }

      // En çok değişenler sırala
      const sorted = [...fileCount.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

      const hotspots: FileHotspot[] = [];

      for (const [file, count] of sorted) {
        const fileInfo = this.getFileInfo(file);
        
        hotspots.push({
          file,
          changeCount: count,
          authors: fileInfo.authors,
          lastModified: fileInfo.lastModified,
          bugFixCount: fileInfo.bugFixCount,
          complexity: fileInfo.complexity,
        });
      }

      this.cache.set(cacheKey, hotspots);
      return hotspots;
    } catch (e) {
      return [];
    }
  }

  /**
   * Dosya blame bilgisi
   */
  getBlame(file: string): BlameLine[] {
    try {
      const output = this.exec(`git blame --line-porcelain "${file}"`);
      return this.parseBlame(output, file);
    } catch (e) {
      return [];
    }
  }

  /**
   * Yazar istatistikleri
   */
  getAuthorStats(): AuthorStats[] {
    try {
      const output = this.exec('git shortlog -sne --all');
      const stats: Map<string, AuthorStats> = new Map();

      const lines = output.trim().split('\n');
      for (const line of lines) {
        const match = line.trim().match(/^\s*(\d+)\s+(.+)\s+<(.+)>$/);
        if (!match) continue;

        const [, commits, author, email] = match;
        
        stats.set(email, {
          author,
          email,
          commits: parseInt(commits),
          insertions: 0,
          deletions: 0,
          files: [],
          lastCommit: new Date(),
        });
      }

      return Array.from(stats.values());
    } catch (e) {
      return [];
    }
  }

  /**
   * Bug fix commit'lerini bul
   */
  getBugFixes(): Commit[] {
    try {
      const output = this.exec(
        'git log --all --oneline --grep="fix" --grep="bug" --grep="hata" -i --format="%H"'
      );
      
      const hashes = output.trim().split('\n').filter(Boolean);
      return hashes.slice(0, 50).map(hash => this.getCommit(hash)).filter(Boolean) as Commit[];
    } catch (e) {
      return [];
    }
  }

  /**
   * Tek commit detayı
   */
  getCommit(hash: string): Commit | null {
    try {
      const format = '--format={"hash":"%H","shortHash":"%h","author":"%an","email":"%ae","date":"%aI","message":"%s"}';
      const output = this.exec(`git show ${hash} ${format} --numstat`);
      const commits = this.parseCommitLog(output);
      return commits[0] || null;
    } catch {
      return null;
    }
  }

  /**
   * Son değişiklik tarihi
   */
  getLastModified(file: string): Date | null {
    try {
      const output = this.exec(`git log -1 --format="%aI" -- "${file}"`);
      return new Date(output.trim());
    } catch {
      return null;
    }
  }

  /**
   * Dosya için author listesi (Windows uyumlu)
   */
  getFileAuthors(file: string): string[] {
    try {
      const output = this.exec(`git log --format="%an" -- "${file}"`);
      const authors = output.trim().split('\n').filter(Boolean);
      // JavaScript ile unique yap
      return [...new Set(authors)];
    } catch {
      return [];
    }
  }

  // ========================
  // Private helpers
  // ========================

  private exec(command: string): string {
    return execSync(command, {
      cwd: this.projectPath,
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024, // 50MB
      timeout: 30000,
    });
  }

  private parseCommitLog(output: string): Commit[] {
    const commits: Commit[] = [];
    const lines = output.split('\n');
    
    let currentCommit: Partial<Commit> | null = null;
    
    for (const line of lines) {
      if (line.startsWith('{')) {
        try {
          // JSON line
          const json = JSON.parse(line.replace(/,$/, ''));
          currentCommit = {
            hash: json.hash,
            shortHash: json.shortHash,
            author: json.author,
            email: json.email,
            date: new Date(json.date),
            message: json.message,
            files: [],
            insertions: 0,
            deletions: 0,
          };
        } catch {
          continue;
        }
      } else if (currentCommit && line.match(/^\d+\t\d+\t/)) {
        // Numstat line: insertions\tdeletions\tfilename
        const [insertions, deletions, file] = line.split('\t');
        currentCommit.files!.push(file);
        currentCommit.insertions! += parseInt(insertions) || 0;
        currentCommit.deletions! += parseInt(deletions) || 0;
      } else if (currentCommit && line === '') {
        // Empty line = commit end
        if (currentCommit.hash) {
          commits.push(currentCommit as Commit);
        }
        currentCommit = null;
      }
    }

    // Son commit
    if (currentCommit?.hash) {
      commits.push(currentCommit as Commit);
    }

    return commits;
  }

  private parseBlame(output: string, file: string): BlameLine[] {
    const lines: BlameLine[] = [];
    const chunks = output.split(/^([a-f0-9]{40})/m).filter(Boolean);
    
    let lineNum = 0;
    for (let i = 0; i < chunks.length; i += 2) {
      const hash = chunks[i];
      const info = chunks[i + 1] || '';
      
      const authorMatch = info.match(/^author (.+)$/m);
      const dateMatch = info.match(/^author-time (\d+)$/m);
      const contentMatch = info.match(/^\t(.*)$/m);
      
      if (authorMatch) {
        lineNum++;
        lines.push({
          line: lineNum,
          commit: hash.substring(0, 7),
          author: authorMatch[1],
          date: dateMatch ? new Date(parseInt(dateMatch[1]) * 1000) : new Date(),
          content: contentMatch ? contentMatch[1] : '',
        });
      }
    }

    return lines;
  }

  private getFileInfo(file: string): {
    authors: string[];
    lastModified: Date;
    bugFixCount: number;
    complexity: number;
  } {
    return {
      authors: this.getFileAuthors(file),
      lastModified: this.getLastModified(file) || new Date(),
      bugFixCount: this.getFileBugFixCount(file),
      complexity: 0, // Başka yerden hesaplanacak
    };
  }

  private getFileBugFixCount(file: string): number {
    try {
      // Windows uyumlu - wc -l yerine JavaScript sayımı
      const output = this.exec(
        `git log --oneline --grep="fix" --grep="bug" -i -- "${file}"`
      );
      const lines = output.trim().split('\n').filter(Boolean);
      return lines.length;
    } catch {
      return 0;
    }
  }

  private isCodeFile(file: string): boolean {
    const ext = path.extname(file).toLowerCase();
    const codeExtensions = [
      '.ts', '.tsx', '.js', '.jsx', '.vue',
      '.py', '.go', '.rs', '.java', '.kt',
      '.cs', '.cpp', '.c', '.h', '.php',
      '.rb', '.swift', '.dart',
    ];
    return codeExtensions.includes(ext);
  }
}

// Singleton
let gitCollector: GitCollector | null = null;

export function getGitCollector(projectPath: string): GitCollector {
  if (!gitCollector || gitCollector['projectPath'] !== projectPath) {
    gitCollector = new GitCollector(projectPath);
  }
  return gitCollector;
}

export default GitCollector;
