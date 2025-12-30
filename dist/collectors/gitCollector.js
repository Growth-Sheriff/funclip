"use strict";
/**
 * FuncLib v4 - Git History Collector
 * Commit history, hotspots, blame bilgisi toplar
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitCollector = void 0;
exports.getGitCollector = getGitCollector;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
class GitCollector {
    projectPath;
    cache = new Map();
    constructor(projectPath) {
        this.projectPath = projectPath;
    }
    /**
     * Git available mı kontrol et
     */
    isAvailable() {
        try {
            this.exec('git --version');
            this.exec('git rev-parse --git-dir');
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Son N günün commit'lerini getir
     */
    getCommitHistory(days = 30) {
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
        }
        catch (e) {
            return [];
        }
    }
    /**
     * En çok değişen dosyaları bul (hotspots)
     * Windows uyumlu - pipe komutları kullanmaz
     */
    getHotspots(limit = 20) {
        const cacheKey = `hotspots_${limit}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        try {
            // Son 90 günde değişen tüm dosyaları al (Windows uyumlu)
            const output = this.exec('git log --since="90 days ago" --name-only --format=""');
            // Dosya sayılarını JavaScript'te hesapla
            const fileCount = new Map();
            const lines = output.trim().split('\n').filter(Boolean);
            for (const line of lines) {
                const file = line.trim();
                if (!file || !this.isCodeFile(file))
                    continue;
                fileCount.set(file, (fileCount.get(file) || 0) + 1);
            }
            // En çok değişenler sırala
            const sorted = [...fileCount.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, limit);
            const hotspots = [];
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
        }
        catch (e) {
            return [];
        }
    }
    /**
     * Dosya blame bilgisi
     */
    getBlame(file) {
        try {
            const output = this.exec(`git blame --line-porcelain "${file}"`);
            return this.parseBlame(output, file);
        }
        catch (e) {
            return [];
        }
    }
    /**
     * Yazar istatistikleri
     */
    getAuthorStats() {
        try {
            const output = this.exec('git shortlog -sne --all');
            const stats = new Map();
            const lines = output.trim().split('\n');
            for (const line of lines) {
                const match = line.trim().match(/^\s*(\d+)\s+(.+)\s+<(.+)>$/);
                if (!match)
                    continue;
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
        }
        catch (e) {
            return [];
        }
    }
    /**
     * Bug fix commit'lerini bul
     */
    getBugFixes() {
        try {
            const output = this.exec('git log --all --oneline --grep="fix" --grep="bug" --grep="hata" -i --format="%H"');
            const hashes = output.trim().split('\n').filter(Boolean);
            return hashes.slice(0, 50).map(hash => this.getCommit(hash)).filter(Boolean);
        }
        catch (e) {
            return [];
        }
    }
    /**
     * Tek commit detayı
     */
    getCommit(hash) {
        try {
            const format = '--format={"hash":"%H","shortHash":"%h","author":"%an","email":"%ae","date":"%aI","message":"%s"}';
            const output = this.exec(`git show ${hash} ${format} --numstat`);
            const commits = this.parseCommitLog(output);
            return commits[0] || null;
        }
        catch {
            return null;
        }
    }
    /**
     * Son değişiklik tarihi
     */
    getLastModified(file) {
        try {
            const output = this.exec(`git log -1 --format="%aI" -- "${file}"`);
            return new Date(output.trim());
        }
        catch {
            return null;
        }
    }
    /**
     * Dosya için author listesi (Windows uyumlu)
     */
    getFileAuthors(file) {
        try {
            const output = this.exec(`git log --format="%an" -- "${file}"`);
            const authors = output.trim().split('\n').filter(Boolean);
            // JavaScript ile unique yap
            return [...new Set(authors)];
        }
        catch {
            return [];
        }
    }
    // ========================
    // Private helpers
    // ========================
    exec(command) {
        return (0, child_process_1.execSync)(command, {
            cwd: this.projectPath,
            encoding: 'utf-8',
            maxBuffer: 50 * 1024 * 1024, // 50MB
            timeout: 30000,
        });
    }
    parseCommitLog(output) {
        const commits = [];
        const lines = output.split('\n');
        let currentCommit = null;
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
                }
                catch {
                    continue;
                }
            }
            else if (currentCommit && line.match(/^\d+\t\d+\t/)) {
                // Numstat line: insertions\tdeletions\tfilename
                const [insertions, deletions, file] = line.split('\t');
                currentCommit.files.push(file);
                currentCommit.insertions += parseInt(insertions) || 0;
                currentCommit.deletions += parseInt(deletions) || 0;
            }
            else if (currentCommit && line === '') {
                // Empty line = commit end
                if (currentCommit.hash) {
                    commits.push(currentCommit);
                }
                currentCommit = null;
            }
        }
        // Son commit
        if (currentCommit?.hash) {
            commits.push(currentCommit);
        }
        return commits;
    }
    parseBlame(output, file) {
        const lines = [];
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
    getFileInfo(file) {
        return {
            authors: this.getFileAuthors(file),
            lastModified: this.getLastModified(file) || new Date(),
            bugFixCount: this.getFileBugFixCount(file),
            complexity: 0, // Başka yerden hesaplanacak
        };
    }
    getFileBugFixCount(file) {
        try {
            // Windows uyumlu - wc -l yerine JavaScript sayımı
            const output = this.exec(`git log --oneline --grep="fix" --grep="bug" -i -- "${file}"`);
            const lines = output.trim().split('\n').filter(Boolean);
            return lines.length;
        }
        catch {
            return 0;
        }
    }
    isCodeFile(file) {
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
exports.GitCollector = GitCollector;
// Singleton
let gitCollector = null;
function getGitCollector(projectPath) {
    if (!gitCollector || gitCollector['projectPath'] !== projectPath) {
        gitCollector = new GitCollector(projectPath);
    }
    return gitCollector;
}
exports.default = GitCollector;
//# sourceMappingURL=gitCollector.js.map