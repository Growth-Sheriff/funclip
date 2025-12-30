# FuncLib v2 - Kod Referans Takip Sistemi

## ⚠️ KRİTİK KURAL: REFERANS KONTROLÜ ZORUNLU

Bu projede **FuncLib v2** kod analiz aracı aktiftir. Tree-sitter tabanlı gerçek AST parse ile çalışır.

### 🔴 DEĞİŞİKLİK YAPMADAN ÖNCE MUTLAKA:

Bir **fonksiyon**, **method**, **class**, **component** veya **composable**'ı değiştirmeden **ÖNCE** şu komutu çalıştır:

```bash
funclib refs <sembol_adı>
```

**Örnek:**
```bash
funclib refs handleSubmit
# Sonuç: 1 definition, 8 references
# → 8 yerde kullanılıyor, HEPSİNİ kontrol et!
```

### ⚡ Hızlı Komutlar

| Komut | Açıklama |
|-------|----------|
| `funclib refs <sembol>` | **EN ÖNEMLİ!** Tüm kullanım yerlerini bul |
| `funclib search <query>` | Sembol ara |
| `funclib search <query> --kind function` | Sadece fonksiyonlar |
| `funclib search <query> --kind hook` | Sadece composable'lar (Vue/React) |
| `funclib search <query> --kind component` | Sadece component'lar |
| `funclib search <query> --kind class` | Sadece class'lar |
| `funclib search <query> --kind interface` | Sadece interface'ler |
| `funclib stats` | Proje istatistikleri |
| `funclib index` | Yeniden indeksle (incremental) |
| `funclib index --full` | Tam yeniden indeksle |

### 🎯 Desteklenen Sembol Türleri

| Tür | Açıklama | Pattern |
|-----|----------|---------|
| `function` | Fonksiyon tanımları | `function foo()`, `const foo = () =>` |
| `method` | Class method'ları | `class X { method() {} }` |
| `class` | Class tanımları | `class MyClass {}` |
| `interface` | TypeScript interface'leri | `interface IProps {}` |
| `type` | Type alias'ları | `type MyType = ...` |
| `enum` | Enum tanımları | `enum Status {}` |
| `component` | Vue/React component'ları | `.vue` dosyaları, JSX |
| `hook` | Composable/Hook'lar | `useXxx` pattern |
| `event` | Vue emit tanımları | `defineEmits<...>` |
| `property` | Props tanımları | `defineProps<...>` |

### 🌐 Desteklenen Diller

- TypeScript / JavaScript / TSX / JSX
- Vue SFC (Single File Components)
- Python
- Go
- Rust
- Java / Kotlin
- C# / C / C++
- PHP / Ruby
- Swift / Dart

### 🔄 Doğru Workflow

```
1. funclib refs <sembol>        → Kaç yerde kullanılıyor?
2. Tüm kullanım yerlerini not et
3. Değişikliği yap (tanım)
4. TÜM kullanım yerlerini güncelle
5. funclib refs <sembol>        → Kontrol et
```

### ❌ YAPMA!

- ❌ `funclib refs` çalıştırmadan fonksiyon signature'ı değiştirme
- ❌ Sadece tanımı değiştirip çağrı noktalarını unutma
- ❌ "Muhtemelen başka yerde kullanılmıyor" varsayımı yapma
- ❌ Rename işlemini manuel yapma (referansları kaçırabilirsin)
- ❌ Breaking change yaparken backwards compatibility düşünmeme

### 💡 Pro İpuçları

1. **Dead code bul**: `funclib refs <sembol>` → 0 reference = kullanılmayan kod, silinebilir
2. **Etki analizi**: Değişiklik öncesi `funclib refs` ile kaç dosyanın etkileneceğini bil
3. **Refactor güvenliği**: Tüm referansları güncelleyerek güvenli refactor yap
4. **Dependency graph**: Hangi modüller birbirine bağımlı, anla

### 🛠️ Kurulum (Yeni Proje İçin)

```bash
# 1. FuncLib'i global kur
npm install -g funclib

# 2. Projeyi indeksle
cd /path/to/project
funclib index

# 3. (Opsiyonel) REST API başlat
funclib serve  # http://localhost:3456

# 4. (Opsiyonel) MCP Server başlat
funclib mcp    # http://localhost:3457
```

### 📁 Dosyalar

- Index: `.funclib/index.json` (gitignore'a eklenebilir)
- Config: `.funclib/config.json` (opsiyonel)
