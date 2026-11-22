# Recolte-Motion

Récolte Coffee Roastery için kaydırmayla oynayan, sinematik bir ana sayfa.

Sayfanın tamamı tek bir sabit sahne. Bomonti'deki kafenin 25 saniyelik yürüyüş videosu WebGL'e çiziliyor ve kaydırdıkça ileri ya da geri akıyor. Bölümler sahnenin içinde beliriyor. Bölümler arası geçişler kameranın hareketi, arka plandaki derinlik bulanıklığı ve keten kâğıda halftone çözülmesiyle yapılıyor.

## Çalıştırma

Herhangi bir statik sunucu yeterli. Derleme adımı yok.

```bash
npx serve .
# ya da
python -m http.server 4500
```

Ardından `http://localhost:4500` adresini açın.

- `index.html`: Türkçe sayfa
- `en.html`: İngilizce sayfa

## Yapı

| Dosya | İçerik |
|---|---|
| `index.html`, `en.html` | İki dilde aynı yapı: tek sabit sahne içinde bölümler |
| `site.js` | WebGL video çizimi, kaydırma izi, bölüm pencereleri, kavurma eğrisi, demleme zamanlayıcısı, abonelik hesaplayıcısı, sepet önizlemesi, ortam sesi |
| `site.css` | Tasarım dili: renkler videodan ölçüldü (Zodiak, Switzer, Geist Mono) |
| `scrollcraft.css` | Temel tokenlar ve tarayıcı yüzeyleri |
| `public/video/` | Kaydırma için kodlanmış video. Masaüstü 1080p, 8 karede bir keyframe; mobil 3:4 kırpılmış, 4 karede bir keyframe |
| `public/img/` | Video yüklenene kadar ve WebGL olmadığında gösterilen sahne kareleri |
| `docs/` | Tasarım özeti (BRIEF) ve Pear analizinden çıkan design DNA |

## Notlar

- **Kafe saatleri yer tutucudur.** recoltecoffee.com'da yayınlanmıyor. Yayından önce `index.html` ve `en.html` içindeki ilgili satırı güncelleyin.
- **Hareketi azalt:** Film ve tam akış (kaydırma ataleti, metin geçişleri, imleç) varsayılan olarak herkes için açıktır; film yalnızca kaydırınca ilerler. Sistemde "hareketi azalt" açık olan ziyaretçiler header'daki "Hareketi azalt" düğmesiyle hareketi kapatabilir; seçim tarayıcıda hatırlanır.
- **Sepet ve abonelik:** Sepet yalnızca bir önizlemedir. Ödeme ve abonelik kaydı recoltecoffee.com'da yapılır.
- **Ürün bilgileri:** Ürünler, tadım notları ve fiyatlar recoltecoffee.com'dan alınmıştır (Kasım 2026).
