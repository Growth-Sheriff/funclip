# FuncLib v2 - Copilot Instructions Template

Bu dosyayı projenizin `.github/copilot-instructions.md` dosyasına ekleyin.

---

## 📋 Kopyalanacak Prompt

```markdown
# FuncLib v2 - Kod Referans Takip Sistemi

## ⚠️ KRİTİK KURAL: REFERANS KONTROLÜ ZORUNLU

Bu projede **FuncLib v2** kod analiz aracı aktiftir. 

### 🔴 DEĞİŞİKLİK YAPMADAN ÖNCE MUTLAKA:

Bir fonksiyon, method, class, component veya composable'ı değiştirmeden **ÖNCE** şu adımları takip et:

1. **Referansları Bul**
   ```bash
   funclib refs <sembol_adı>
   ```
   veya REST API:
   ```bash
   curl "http://localhost:3456/refs/<sembol_adı>"
   ```

2. **Kaç Yerde Kullanıldığını Not Et**
   - Örnek: "5 dosyada 12 kullanım var"
   - TÜM kullanım yerlerini değişiklikten etkilenip etkilenmeyeceğini değerlendir

3. **Değişikliği Yap**
   - Sadece tanımı değil, TÜM kullanım yerlerini güncelle
   - Breaking change varsa tüm çağrı noktalarını düzelt

4. **Tekrar Kontrol Et**
   ```bash
   funclib refs <sembol_adı>
   ```
   Tüm referansların güncellendiğinden emin ol.

---

## 🛠️ FuncLib Komutları

### Sembol Arama
```bash
funclib search <query>              # Genel arama
funclib search <query> --kind hook  # Sadece composable'lar
funclib search <query> --kind component  # Sadece Vue component'ları
```

### Referans Bulma (EN ÖNEMLİ!)
```bash
funclib refs <sembol_adı>           # TÜM kullanım yerlerini göster
```

### Dosyadaki Sembolleri Listele
```bash
funclib symbols <dosya_yolu>
```

### İstatistikler
```bash
funclib stats
```

### Yeniden İndeksleme
```bash
funclib index              # Incremental (sadece değişenler)
funclib index --full       # Tam yeniden indeksleme
```

---

## 📊 Desteklenen Sembol Türleri

| Tür | Açıklama |
|-----|----------|
| `function` | Fonksiyon tanımları |
| `method` | Class method'ları |
| `class` | Class tanımları |
| `interface` | TypeScript interface'leri |
| `type` | Type alias'ları |
| `component` | Vue/React component'ları |
| `hook` | Composable'lar (useXxx pattern) |
| `event` | Vue emit tanımları |
| `property` | Props, property tanımları |

---

## 🔄 Örnek Workflow

### Senaryo: `handleSubmit` fonksiyonuna parametre ekleme

**YANLIŞ ❌**
```typescript
// Sadece tanımı değiştirdim
function handleSubmit(data: FormData, validate: boolean) { ... }
// Diğer dosyalardaki çağrılar KIRILDI!
```

**DOĞRU ✅**
```bash
# 1. Önce referansları bul
funclib refs handleSubmit
# Sonuç: 3 definition, 8 references

# 2. Tüm 8 kullanım yerini not et
# - src/components/LoginForm.vue:45
# - src/components/RegisterForm.vue:78
# - src/pages/profile.vue:123
# - ...

# 3. Tanımı değiştir
function handleSubmit(data: FormData, validate = true) { ... }

# 4. TÜM 8 çağrı noktasını güncelle (veya default değer kullan)

# 5. Tekrar kontrol et
funclib refs handleSubmit
```

---

## 🎯 Vue SFC Desteği

FuncLib Vue Single File Component'ları tam destekler:

- ✅ `<script setup>` içindeki tüm fonksiyonlar
- ✅ `defineProps`, `defineEmits`, `defineExpose`
- ✅ Composable'lar (useXxx pattern → `hook` türü)
- ✅ Template'deki component kullanımları (`<MyComponent />`)
- ✅ Event handler referansları (`@click="handleClick"`)

---

## ⚡ Hızlı Kontrol Listesi

Değişiklik yapmadan önce:

- [ ] `funclib refs <sembol>` çalıştırdım mı?
- [ ] Kaç dosyada kullanıldığını biliyorum mu?
- [ ] Tüm çağrı noktalarını güncelledim mi?
- [ ] Breaking change varsa backwards compatibility düşündüm mü?
- [ ] Değişiklik sonrası tekrar `funclib refs` ile kontrol ettim mi?

---

## 🚫 YAPMA!

- ❌ Referans kontrolü yapmadan fonksiyon signature'ı değiştirme
- ❌ Sadece tanımı değiştirip çağrı noktalarını unutma
- ❌ "Muhtemelen başka yerde kullanılmıyor" varsayımı yapma
- ❌ Rename işlemini manuel yapma (tüm referansları kaçırabilirsin)

---

## 💡 Pro İpuçları

1. **Büyük refactor öncesi**: `funclib stats` ile projenin genel durumunu gör
2. **Kullanılmayan kod bul**: `funclib refs <sembol>` → 0 reference = dead code
3. **Component bağımlılıkları**: `funclib refs MyComponent` ile nerede kullanıldığını gör
4. **Composable etki alanı**: `funclib refs useMyComposable` ile hangi component'ların etkileneceğini bil
```

---

## 🔧 Kurulum

1. FuncLib'i global olarak kur:
```bash
npm install -g funclib
```

2. Projeyi indeksle:
```bash
cd /path/to/project
funclib index
```

3. REST API'yi başlat (opsiyonel):
```bash
funclib serve
```

---

## 📝 Notlar

- Index `.funclib/index.json` dosyasında saklanır
- `.gitignore`'a `.funclib/` ekleyebilirsiniz
- Incremental indexing sayesinde sadece değişen dosyalar yeniden indekslenir
