# FuncLib v2 - Universal Symbol Index

Tree-sitter tabanlı, **tüm programlama dillerini** destekleyen evrensel kod analiz ve sembol indeksleme aracı.

## 🚀 Özellikler

- ✅ **Gerçek AST Parse** - Tree-sitter ile %99+ doğruluk
- ✅ **30+ Dil Desteği** - JS, TS, Python, Go, Rust, Java, C#, PHP, Ruby...
- ✅ **Sembol İndeksleme** - Fonksiyon, class, method, interface, type, enum
- ✅ **Referans Bulma** - Tüm kullanım yerlerini tespit
- ✅ **Call Graph** - Fonksiyon çağrı grafı
- ✅ **REST API** - HTTP endpoint'ler
- ✅ **MCP Server** - Copilot/Claude entegrasyonu
- ✅ **CLI** - Terminal aracı
- ✅ **Incremental Index** - Sadece değişen dosyalar

## 📦 Kurulum

```bash
# Clone/copy
git clone <repo> funclib
cd funclib

# Install
npm install

# Build
npm run build

# Global CLI (opsiyonel)
npm link
```

## 🎯 Kullanım

### CLI

```bash
# Projeyi indeksle
funclib index

# Sembol ara
funclib search handleSubmit

# Tüm referansları bul (KRİTİK!)
funclib refs fetchData

# Sembol detayı
funclib symbol UserService

# Dosyadaki semboller
funclib file src/utils.ts

# İstatistikler
funclib stats

# Sunucuları başlat
funclib serve    # REST API (port 3456)
funclib mcp      # MCP Server (port 3457)
```

### REST API

```bash
# Ara
curl "http://localhost:3456/search?q=fetch"

# Referanslar
curl "http://localhost:3456/refs/handleSubmit"

# Detay
curl "http://localhost:3456/symbol/UserService"

# İndeksle
curl -X POST http://localhost:3456/index
```

### MCP Tools

```json
// search_symbols
{"name": "search_symbols", "arguments": {"query": "fetch", "kind": "function"}}

// find_references (EN ÖNEMLİ!)
{"name": "find_references", "arguments": {"name": "handleSubmit"}}

// get_symbol
{"name": "get_symbol", "arguments": {"name": "UserService"}}

// index_project
{"name": "index_project", "arguments": {"incremental": true}}
```

## 🌐 Desteklenen Diller

| Dil | Uzantılar | Semboller |
|-----|-----------|-----------|
| JavaScript | .js, .mjs, .cjs | function, class, method, arrow |
| TypeScript | .ts, .tsx | + interface, type, enum |
| Python | .py | function, class, method, decorator |
| Go | .go | function, method, struct, interface |
| Rust | .rs | fn, struct, enum, trait, impl |
| Java | .java | class, method, interface, enum |
| Kotlin | .kt | fun, class, object, interface |
| C# | .cs | class, method, interface, property |
| C/C++ | .c, .cpp, .h | function, class, struct |
| PHP | .php | function, class, method, trait |
| Ruby | .rb | def, class, module |
| Swift | .swift | func, class, struct, protocol |
| Dart | .dart | function, class, mixin |
| Vue | .vue | script içeriği |

## 🔧 Konfigürasyon

### Environment Variables

| Variable | Default | Açıklama |
|----------|---------|----------|
| `FUNCLIB_PROJECT` | `cwd` | Proje dizini |
| `PORT` | `3456` | REST API port |
| `MCP_PORT` | `3457` | MCP server port |

### MCP Konfigürasyonu

Claude Desktop (`~/.config/claude/mcp.json`):
```json
{
  "mcpServers": {
    "funclib": {
      "url": "http://localhost:3457"
    }
  }
}
```

VS Code (`.vscode/settings.json`):
```json
{
  "mcp.servers": {
    "funclib": {
      "url": "http://localhost:3457"
    }
  }
}
```

## 📁 Proje Yapısı

```
funclib/
├── src/
│   ├── types.ts          # Tip tanımları
│   ├── languages.ts      # Dil konfigürasyonları
│   ├── parser.ts         # Tree-sitter parser engine
│   ├── indexManager.ts   # İndeks yönetimi
│   ├── server.ts         # REST API
│   ├── mcp.ts            # MCP server
│   └── cli.ts            # CLI aracı
├── node_modules/
│   └── tree-sitter-wasms/  # Dil WASM'ları
├── .github/
│   └── copilot-instructions.md
├── .vscode/
│   └── tasks.json
├── package.json
├── tsconfig.json
└── README.md
```

## 🔄 Workflow

### Fonksiyon Değiştirme (DOĞRU ✅)

1. **Referansları bul:**
   ```bash
   funclib refs validateForm
   # Çıktı: 1 definition, 8 references
   ```

2. **Tüm kullanım yerlerini not et**

3. **Fonksiyonu değiştir**

4. **8 referansın HEPSİNİ güncelle**

5. **Kontrol et:**
   ```bash
   funclib refs validateForm
   ```

### Fonksiyon Değiştirme (YANLIŞ ❌)

1. Sadece tanımı değiştir
2. Referansları unutmak
3. ❌ Runtime/Build hataları!

## 🐛 Sorun Giderme

### "Symbol not found"
```bash
funclib index --full  # Tam yeniden indeksleme
```

### WASM yüklenemiyor
```bash
ls node_modules/tree-sitter-wasms/out/
# tree-sitter-javascript.wasm vb. olmalı
```

### Parser hatası
- Dosya encoding'i UTF-8 olmalı
- Syntax hatası varsa parse edilemez

## 📊 Performans

- **İndeksleme:** ~1000 dosya/saniye
- **Arama:** <10ms
- **Referans bulma:** <50ms
- **Incremental index:** Sadece değişen dosyalar

## 🤝 Katkıda Bulunma

1. Fork
2. Feature branch (`git checkout -b feature/amazing`)
3. Commit (`git commit -m 'Add amazing feature'`)
4. Push (`git push origin feature/amazing`)
5. Pull Request

## 📄 Lisans

MIT

---

**⚠️ Hatırlatma:** Bir fonksiyonu değiştirmeden önce MUTLAKA `funclib refs <name>` kullanın!
