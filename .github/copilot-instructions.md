# Copilot Instructions - FuncLib v2 Universal Index

Bu projede **FuncLib v2** kullanılmaktadır - Tree-sitter tabanlı, tüm dilleri destekleyen evrensel kod analiz aracı.

## ⚠️ KRİTİK KURAL

**Bir fonksiyonu/method'u değiştirmeden ÖNCE mutlaka `find_references` kullan!**

Bu kural tüm diller için geçerlidir:
- JavaScript/TypeScript
- Python
- Go, Rust
- Java, Kotlin, C#
- PHP, Ruby
- Swift, Dart
- Ve daha fazlası...

## MCP Tool Kullanımı (Önerilen)

FuncLib bir MCP server olarak çalışır. Şu tool'ları kullanabilirsiniz:

### 1. search_symbols
Sembolleri ara (fonksiyon, class, method, vb.)
```json
{"name": "search_symbols", "arguments": {"query": "handleSubmit", "kind": "function"}}
```

### 2. find_references ⚠️ EN ÖNEMLİ
Bir sembolün TÜM kullanım yerlerini bul
```json
{"name": "find_references", "arguments": {"name": "fetchData"}}
```

### 3. get_symbol
Sembol detaylarını getir
```json
{"name": "get_symbol", "arguments": {"name": "UserService"}}
```

### 4. list_symbols_in_file
Dosyadaki tüm sembolleri listele
```json
{"name": "list_symbols_in_file", "arguments": {"file": "src/utils.ts"}}
```

### 5. index_project
Projeyi yeniden indeksle
```json
{"name": "index_project", "arguments": {"incremental": true}}
```

## REST API Kullanımı

MCP yoksa REST API kullanılabilir (`http://localhost:3456`):

```bash
# Arama
curl "http://localhost:3456/search?q=handleSubmit"

# Referanslar (KRİTİK!)
curl "http://localhost:3456/refs/handleSubmit"

# Sembol detayı
curl "http://localhost:3456/symbol/UserService"

# Copilot endpoint
curl -X POST http://localhost:3456/copilot \
  -H "Content-Type: application/json" \
  -d '{"action":"refs","name":"handleSubmit"}'
```

## CLI Kullanımı

```bash
funclib index          # Projeyi indeksle
funclib search fetch   # Ara
funclib refs getData   # Referansları bul
funclib symbol User    # Detay
```

## Düzeltme Workflow'u

### DOĞRU ✅
1. `find_references` ile tüm kullanımları bul
2. Kaç yerde kullanıldığını not et (örn: 5 dosyada 12 kullanım)
3. Fonksiyon tanımını değiştir
4. TÜM 12 kullanım yerini güncelle
5. Tekrar `find_references` ile kontrol et

### YANLIŞ ❌
1. Sadece fonksiyon tanımını değiştir
2. Çağrı yerlerini unutmak
3. ❌ Build hatası!

## Örnek Senaryo

**Kullanıcı:** "validateForm fonksiyonuna `strict` parametresi ekle"

**Copilot yapması gereken:**

1. Önce referansları bul:
```json
{"name": "find_references", "arguments": {"name": "validateForm"}}
```

2. Sonuç:
```
Definitions: 1
References: 8 (src/auth.ts:45, src/profile.ts:23, ...)
```

3. Fonksiyon tanımını güncelle:
```typescript
// Önceki: function validateForm(data) { ... }
// Yeni:   function validateForm(data, strict = false) { ... }
```

4. 8 referansın HEPSİNİ güncelle (gerekiyorsa)

5. Tekrar kontrol et

## Desteklenen Diller

| Dil | Uzantılar |
|-----|-----------|
| JavaScript | .js, .mjs, .cjs |
| TypeScript | .ts, .tsx |
| Python | .py |
| Go | .go |
| Rust | .rs |
| Java | .java |
| Kotlin | .kt |
| C# | .cs |
| C/C++ | .c, .cpp, .h |
| PHP | .php |
| Ruby | .rb |
| Swift | .swift |
| Dart | .dart |
| Vue | .vue |

## Sunucuları Başlatma

```bash
# REST API
funclib serve
# veya
FUNCLIB_PROJECT=/path/to/project node dist/server.js

# MCP Server
funclib mcp
# veya
MCP_PORT=3457 node dist/mcp.js
```

## MCP Konfigürasyonu

Claude Desktop veya VS Code için:
```json
{
  "mcpServers": {
    "funclib": {
      "url": "http://localhost:3457"
    }
  }
}
```

## Önemli Notlar

- Tree-sitter gerçek AST parse yapar, regex değil
- %99+ doğruluk oranı
- Incremental indexing (sadece değişen dosyalar)
- Index `.funclib/index.json` dosyasında saklanır
