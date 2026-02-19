# Learning Reflection

## 1. Tantangan Terbesar dalam Pengembangan
Tantangan terbesar adalah menangani **Function Calling dengan konteks baris (Line Awareness)**. Memberikan AI pemahaman tentang posisi kursor dan nomor baris memerlukan prompt engineering yang sangat presisi. Kami harus memastikan AI tidak hanya mengembalikan teks, tetapi instruksi terstruktur (`insert_at_line`, `replace_text`) agar editor dapat memperbarui dokumen tanpa menimpa pekerjaan pengguna lain. Mengelola *retry logic* saat Gemini mengalami rate limit juga menjadi tantangan yang diselesaikan dengan *fallback strategy*.

## 2. Integrasi Real-time dengan Supabase
Mengimplementasikan kolaborasi *real-time* menggunakan Supabase Channels mengajarkan pentingnya **State Management** yang efisien. Kami menggunakan teknik *debounce* untuk penyimpanan database guna mengurangi beban server, sementara *WebSocket* digunakan untuk broadcast instan setiap pengetikan. Penanganan *race conditions* saat dua user mengetik bersamaan diminimalisir dengan *optimistic UI updates*.

## 3. Pemanfaatan Multimodal AI
Fitur analisis gambar membuktikan bahwa Gemini 2.5 sangat ampuh untuk **Optical Character Recognition (OCR)** dan pemahaman konteks visual. Kami belajar cara mengonversi file frontend menjadi base64 yang aman, mengirimkannya sebagai *inline data* ke API, dan memproses responsnya kembali ke editor markdown. Ini membuka potensi besar untuk mengubah sketsa UI atau *screenshot* kode langsung menjadi teks yang dapat diedit.

## 4. Keamanan dan Autentikasi (RLS)
Penerapan Row Level Security (RLS) di Supabase adalah aspek krusial untuk aplikasi produksi. Kami memastikan bahwa setiap baris kode yang berinteraksi dengan database divalidasi tidak hanya di frontend tetapi juga di level database. Pengalaman ini memperdalam pemahaman tentang model keamanan *Serverless* dan bagaimana melindungi data pengguna secara efektif tanpa backend tradisional yang berat.

## 5. Kesimpulan dan Pengembangan Selanjutnya
Proyek ini berhasil menggabungkan presisi *code logic* dengan fleksibilitas *AI generative*. Ke depannya, sistem Undo/Redo bisa ditingkatkan menggunakan pendekatan berbasis *Changeset (Operational Transformation)* daripada *snapshot* penuh untuk efisiensi memori yang lebih baik. Kami juga melihat potensi untuk menambahkan *semantic search* menggunakan Vector Embeddings agar AI bisa "mengingat" dokumen lama.
