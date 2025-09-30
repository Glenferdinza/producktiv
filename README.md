# Productiv - Task Manager Pro

Aplikasi manajemen tugas yang modern dan responsif dengan Firebase sebagai database backend.

## Fitur

- Tambah, edit, dan hapus tugas
- Sistem prioritas (Tinggi, Sedang, Rendah)
- Dashboard statistik real-time
- Mode gelap/terang
- Desain responsif
- Sinkronisasi real-time dengan Firebase

## Struktur File

```
productiv/
├── index.html              # File HTML utama
├── package.json            # Konfigurasi proyek dan dependencies
├── src/                    # Source code
│   ├── css/
│   │   └── styles.css      # Semua styling CSS
│   └── js/
│       ├── app.js          # Logika aplikasi JavaScript
│       └── config.js       # Konfigurasi Firebase
├── docs/                   # Dokumentasi
│   └── FIREBASE_SETUP.md   # Panduan setup Firebase
├── .gitignore              # Git ignore file
└── README.md              # Dokumentasi ini
```

## Setup dan Instalasi

### 1. Clone Repository
```bash
git clone https://github.com/Glenferdinza/productiv.git
cd productiv
```

### 2. Konfigurasi Firebase
Ikuti panduan lengkap di [`docs/FIREBASE_SETUP.md`](docs/FIREBASE_SETUP.md)

### 3. Menjalankan Aplikasi Local
Karena menggunakan ES6 modules, aplikasi harus dijalankan melalui web server:

#### Menggunakan NPM (Recommended)
```bash
npm install
npm run dev
```

#### Menggunakan Live Server (VS Code)
1. Install extension "Live Server" di VS Code
2. Klik kanan pada `index.html`
3. Pilih "Open with Live Server"

#### Menggunakan Python
```bash
# Python 3
python -m http.server 8000

# Python 2  
python -m SimpleHTTPServer 8000
```

#### Menggunakan Node.js
```bash
npx http-server . -p 8000
```

## Deployment

### GitHub Pages
1. Fork repository ini
2. Enable GitHub Pages di Settings > Pages
3. Pilih source: GitHub Actions
4. Push ke branch `main` akan otomatis deploy

### Vercel
1. Connect repository ke Vercel
2. Deployment otomatis dari branch `main`
3. Custom domain bisa diatur di dashboard Vercel

### Netlify
1. Connect repository ke Netlify
2. Build settings sudah dikonfigurasi di `netlify.toml`
3. Deploy otomatis dari branch `main`

### Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

## Teknologi yang Digunakan

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Styling**: Tailwind CSS
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth (Anonymous)
- **Icons**: Heroicons (SVG)

## Browser Support

- Chrome 63+
- Firefox 60+
- Safari 11+
- Edge 79+

## Kontribusi

1. Fork repository ini
2. Buat feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push ke branch (`git push origin feature/AmazingFeature`)
5. Buat Pull Request

## Lisensi

Distributed under the MIT License.