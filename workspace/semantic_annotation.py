from collections import defaultdict
import re

# Simple Indonesian lexicons for linguistic indicators
LEXICON = {
    'aktor': ['saya','kami','dia','mereka','siswa','guru','peserta'],
    'tindakan': ['mengembangkan','meningkatkan','belajar','mempromosikan','membuat','melakukan','memperbaiki'],
    'evaluasi': ['efektif','buruk','baik','bagus','jelek','cukup','luar biasa','menarik'],
    'modalitas': ['harus','mungkin','perlu','bisa','seharusnya','wajib'],
    'kausalitas': ['karena','sebab','oleh karena itu','akibatnya','sehingga']
}

# Suggestion mappings (explainable, research-oriented)
# Pemetaan saran coding (explainable & research-oriented)
SUGGESTIONS = {
    'aktor': [
        'identitas partisipan',
        'referensi diri',
        'posisi pembicara',
        'aktor sosial',
        'peran individu',
        'identitas kelompok'
    ],

    'identitas': [
        'identitas personal',
        'peran sosial',
        'identitas akademik',
        'konstruksi diri',
        'representasi diri'
    ],

    'relasi_sosial': [
        'hubungan interpersonal',
        'interaksi sosial',
        'kolaborasi partisipan',
        'dukungan sosial',
        'dinamika kelompok'
    ],

    'tindakan': [
        'aktivitas pembelajaran',
        'proses perilaku',
        'strategi adaptasi',
        'tindakan instruksional',
        'praktik komunikasi',
        'respons tindakan'
    ],

    'strategi': [
        'strategi coping',
        'strategi pembelajaran',
        'strategi komunikasi',
        'mekanisme adaptasi',
        'pendekatan penyelesaian masalah'
    ],

    'tujuan': [
        'orientasi tujuan',
        'target pencapaian',
        'motivasi tindakan',
        'arah tindakan',
        'niat partisipan'
    ],

    'evaluasi': [
        'evaluasi positif',
        'evaluasi negatif',
        'penilaian partisipan',
        'efektivitas yang dirasakan',
        'kritik pengalaman',
        'apresiasi'
    ],

    'penilaian': [
        'judgment personal',
        'evaluasi performa',
        'penilaian kualitas',
        'persepsi keberhasilan',
        'standar evaluatif'
    ],

    'emosi': [
        'respons emosional',
        'ekspresi perasaan',
        'kecemasan',
        'antusiasme',
        'frustrasi',
        'kepuasan emosional'
    ],

    'modalitas': [
        'kewajiban',
        'harapan',
        'rekomendasi',
        'kemungkinan',
        'kepastian',
        'keharusan'
    ],

    'kepastian': [
        'tingkat keyakinan',
        'ketidakpastian',
        'keraguan',
        'konfirmasi',
        'asumsi'
    ],

    'kausalitas': [
        'penalaran kausal',
        'pernyataan eksplanatif',
        'justifikasi',
        'hubungan konsekuensi',
        'hubungan sebab-akibat'
    ],

    'alasan': [
        'rasionalisasi',
        'argumentasi alasan',
        'motivasi penyebab',
        'penjelasan tindakan',
        'faktor penyebab'
    ],

    'kontras': [
        'perbandingan pengalaman',
        'perbedaan perspektif',
        'kontradiksi',
        'oposisi makna',
        'perbandingan kondisi'
    ],

    'perubahan': [
        'transformasi pengalaman',
        'perkembangan individu',
        'perubahan perilaku',
        'adaptasi situasional',
        'proses transisi'
    ],

    'waktu': [
        'urutan temporal',
        'pengalaman masa lalu',
        'orientasi masa depan',
        'durasi pengalaman',
        'perkembangan waktu'
    ],

    'lokasi': [
        'konteks tempat',
        'lingkungan sosial',
        'ruang pembelajaran',
        'situasi fisik',
        'konteks institusional'
    ],

    'hambatan': [
        'kesulitan partisipan',
        'kendala pembelajaran',
        'tantangan komunikasi',
        'hambatan teknis',
        'masalah adaptasi'
    ],

    'solusi': [
        'strategi penyelesaian',
        'pemecahan masalah',
        'solusi praktis',
        'mekanisme dukungan',
        'pendekatan alternatif'
    ],

    'dukungan': [
        'dukungan sosial',
        'dukungan akademik',
        'fasilitasi pembelajaran',
        'bantuan emosional',
        'kolaborasi pendukung'
    ],

    'penolakan': [
        'resistensi',
        'ketidaksetujuan',
        'oposisi pandangan',
        'penolakan ide',
        'kritik kebijakan'
    ],

    'harapan': [
        'ekspektasi masa depan',
        'aspirasi partisipan',
        'keinginan perubahan',
        'target perkembangan',
        'optimisme'
    ],

    'pengalaman': [
        'narasi pengalaman',
        'refleksi individu',
        'pengalaman personal',
        'pengalaman kolektif',
        'pengalaman akademik'
    ],

    'argumentasi': [
        'dukungan argumen',
        'klaim pendapat',
        'logika penjelasan',
        'pembelaan posisi',
        'konstruksi argumen'
    ],

    'legitimasi': [
        'pembenaran tindakan',
        'otorisasi sosial',
        'validasi keputusan',
        'dukungan normatif',
        'referensi otoritas'
    ],

    'otoritas': [
        'pengaruh kekuasaan',
        'otoritas institusi',
        'kepemimpinan',
        'kontrol sosial',
        'hierarki'
    ],

    'norma': [
        'aturan sosial',
        'nilai budaya',
        'standar perilaku',
        'ekspektasi sosial',
        'kepatuhan norma'
    ],

    'perspektif': [
        'sudut pandang individu',
        'pandangan sosial',
        'interpretasi pengalaman',
        'cara memahami fenomena',
        'orientasi pemikiran'
    ],

    'persepsi': [
        'persepsi subjektif',
        'pemaknaan pengalaman',
        'interpretasi situasi',
        'kesadaran individu',
        'pandangan personal'
    ],

    'representasi': [
        'deskripsi fenomena',
        'konstruksi makna',
        'representasi sosial',
        'simbolisasi pengalaman',
        'narasi identitas'
    ],

    'intensitas': [
        'penekanan emosi',
        'tingkat keterlibatan',
        'kekuatan respons',
        'eskalasi pengalaman',
        'intensitas tindakan'
    ],

    'prioritas': [
        'fokus utama',
        'kepentingan dominan',
        'urutan kebutuhan',
        'orientasi prioritas',
        'penekanan tujuan'
    ],

    'konsistensi': [
        'keselarasan tindakan',
        'konsistensi sikap',
        'stabilitas perilaku',
        'koherensi pendapat',
        'kesinambungan pengalaman'
    ],

    'ketidakpastian': [
        'ambiguitas',
        'keraguan keputusan',
        'ketidakjelasan situasi',
        'risiko persepsi',
        'ketidakstabilan makna'
    ],

    'adaptasi': [
        'penyesuaian diri',
        'mekanisme coping',
        'adaptasi lingkungan',
        'respons perubahan',
        'fleksibilitas perilaku'
    ],

    'partisipasi': [
        'keterlibatan aktif',
        'kontribusi kelompok',
        'partisipasi sosial',
        'engagement pembelajaran',
        'keikutsertaan'
    ],

    'kolaborasi': [
        'kerja sama tim',
        'interaksi kolaboratif',
        'dukungan kolektif',
        'koordinasi kelompok',
        'partisipasi bersama'
    ],

    'konflik': [
        'ketegangan sosial',
        'perbedaan kepentingan',
        'konflik interpersonal',
        'pertentangan pendapat',
        'disagreement'
    ],

    'pengaruh': [
        'pengaruh sosial',
        'persuasi',
        'dampak tindakan',
        'pengaruh institusional',
        'efek lingkungan'
    ],

    'motivasi': [
        'dorongan internal',
        'motivasi belajar',
        'motivasi eksternal',
        'semangat partisipasi',
        'alasan keterlibatan'
    ],

    'refleksi': [
        'refleksi pengalaman',
        'evaluasi diri',
        'kesadaran kritis',
        'pemikiran retrospektif',
        'interpretasi personal'
    ],

    'transformasi': [
        'perubahan identitas',
        'perkembangan diri',
        'transformasi sosial',
        'pergeseran perspektif',
        'evolusi pengalaman'
    ],

    'preferensi': [
        'pilihan individu',
        'kecenderungan perilaku',
        'prioritas personal',
        'kesukaan partisipan',
        'orientasi pilihan'
    ],

    'komitmen': [
        'dedikasi partisipan',
        'konsistensi keterlibatan',
        'tanggung jawab',
        'keseriusan tindakan',
        'loyalitas tujuan'
    ],

    'tantangan': [
        'kesulitan proses',
        'hambatan situasional',
        'tantangan akademik',
        'tekanan sosial',
        'kompleksitas pengalaman'
    ]
}

# Semantic templates
TEMPLATES = {
    'aktor': 'X memposisikan diri dalam konteks Y',
    'identitas': 'X menggambarkan identitas atau peran sebagai Y',
    'relasi_sosial': 'X membangun hubungan dengan Y melalui Z',
    'tindakan': 'X melakukan tindakan Y untuk mencapai Z',
    'strategi': 'X menggunakan strategi Y untuk menghadapi Z',
    'tujuan': 'X menunjukkan tujuan Y melalui tindakan Z',
    'evaluasi': 'X mengevaluasi Y secara positif/negatif karena Z',
    'penilaian': 'X memberikan penilaian terhadap Y berdasarkan Z',
    'emosi': 'X mengekspresikan emosi Y terhadap Z',
    'modalitas': 'X menyatakan kewajiban atau kemungkinan terhadap Y',
    'kepastian': 'X menunjukkan tingkat keyakinan terhadap Y',
    'kausalitas': 'X menjelaskan Y sebagai akibat dari Z',
    'alasan': 'X memberikan alasan Y untuk menjelaskan Z',
    'kontras': 'X membandingkan Y dengan Z untuk menunjukkan perbedaan',
    'perubahan': 'X menggambarkan perubahan dari Y menuju Z',
    'waktu': 'X menghubungkan peristiwa Y dengan waktu Z',
    'lokasi': 'X menempatkan peristiwa Y pada konteks lokasi Z',
    'hambatan': 'X menghadapi hambatan Y dalam mencapai Z',
    'solusi': 'X menawarkan solusi Y terhadap masalah Z',
    'dukungan': 'X memberikan dukungan terhadap Y melalui Z',
    'penolakan': 'X menolak atau menentang Y karena Z',
    'harapan': 'X menyampaikan harapan terhadap Y di masa depan',
    'pengalaman': 'X menceritakan pengalaman Y yang berkaitan dengan Z',
    'argumentasi': 'X membangun argumen Y untuk mendukung Z',
    'legitimasi': 'X melegitimasi Y dengan merujuk pada Z',
    'otoritas': 'X menggunakan otoritas Y untuk memengaruhi Z',
    'norma': 'X merujuk pada norma atau aturan Y dalam konteks Z',
    'perspektif': 'X melihat Y dari sudut pandang Z',
    'persepsi': 'X memersepsikan Y sebagai Z',
    'representasi': 'X merepresentasikan Y melalui deskripsi Z',
    'intensitas': 'X menekankan tingkat intensitas Y terhadap Z',
    'prioritas': 'X memprioritaskan Y dibandingkan Z',
    'konsistensi': 'X menunjukkan konsistensi antara Y dan Z',
    'ketidakpastian': 'X menunjukkan keraguan terhadap Y karena Z',
    'adaptasi': 'X menyesuaikan diri dengan Y akibat Z',
    'partisipasi': 'X berpartisipasi dalam Y untuk tujuan Z',
    'kolaborasi': 'X bekerja sama dengan Y dalam konteks Z',
    'konflik': 'X mengalami konflik dengan Y terkait Z',
    'pengaruh': 'X memengaruhi Y melalui tindakan Z',
    'motivasi': 'X termotivasi melakukan Y karena Z',
    'refleksi': 'X merefleksikan pengalaman Y untuk memahami Z',
    'transformasi': 'X mengalami transformasi dari Y menjadi Z',
    'preferensi': 'X menunjukkan preferensi terhadap Y dibandingkan Z',
    'komitmen': 'X menunjukkan komitmen terhadap Y melalui Z',
    'tantangan': 'X mengidentifikasi tantangan Y dalam situasi Z'
}

def detect_indicators(text):
    low = text.lower()
    found = defaultdict(list)
    tokens = re.findall(r"\w+", low)
    for cat, words in LEXICON.items():
        for w in words:
            if w in low or w in tokens:
                found[cat].append(w)
    return {k: list(dict.fromkeys(v)) for k, v in found.items()}


def suggest_codes(indicators):
    # produce ranked suggestions based on which indicators present
    suggestions = []
    for cat, codes in SUGGESTIONS.items():
        if cat in indicators and indicators[cat]:
            # higher rank if indicator present
            for i, c in enumerate(codes):
                suggestions.append({'category': cat, 'code': c, 'score': 100 - i})
    # if no indicators found, return a small default set
    if not suggestions:
        for cat, codes in SUGGESTIONS.items():
            suggestions.append({'category': cat, 'code': codes[0], 'score': 10})
    # sort by score desc
    suggestions.sort(key=lambda x: -x['score'])
    return suggestions


def generate_semantic_relationship(indicators, text):
    """
    Generate semantic relationship explanation
    based on detected linguistic indicators.
    """

    # Prioritas kategori utama
    priority_order = [
        'modalitas',
        'evaluasi',
        'tindakan',
        'kausalitas',
        'aktor',
        'emosi',
        'motivasi',
        'hambatan',
        'solusi',
        'harapan',
        'konflik',
        'adaptasi',
        'refleksi',
        'transformasi'
    ]

    # Cari kategori paling dominan
    selected_category = None

    for cat in priority_order:
        if cat in indicators and indicators[cat]:
            selected_category = cat
            break

    # fallback
    if not selected_category:
        selected_category = 'aktor'

    # Template utama
    template = TEMPLATES.get(
        selected_category,
        'X menghubungkan Y dengan Z'
    )

    # Variable extraction
    X = (
        indicators.get('aktor', [None])[0]
        or indicators.get('identitas', [None])[0]
        or 'partisipan'
    )

    Y = (
        indicators.get('tindakan', [None])[0]
        or indicators.get('evaluasi', [None])[0]
        or indicators.get('emosi', [None])[0]
        or indicators.get('motivasi', [None])[0]
        or 'fenomena'
    )

    Z = (
        indicators.get('kausalitas', [None])[0]
        or indicators.get('hambatan', [None])[0]
        or indicators.get('solusi', [None])[0]
        or indicators.get('harapan', [None])[0]
        or indicators.get('konflik', [None])[0]
        or 'konteks tertentu'
    )

    # Isi template otomatis
    semantic_relation = (
        template
        .replace('X', str(X))
        .replace('Y', str(Y))
        .replace('Z', str(Z))
    )

    # Explanation bahasa Indonesia
    explanations = {
        'aktor':
            f"Teks merepresentasikan {X} sebagai aktor sosial dalam konteks tertentu.",

        'identitas':
            f"Teks menunjukkan bagaimana {X} membangun atau menggambarkan identitasnya.",

        'tindakan':
            f"Teks menunjukkan bahwa {X} melakukan tindakan terkait {Y}.",

        'evaluasi':
            f"Teks memperlihatkan evaluasi atau penilaian terhadap {Y}.",

        'modalitas':
            f"Teks menunjukkan kewajiban, kemungkinan, atau harapan terkait {Y}.",

        'kausalitas':
            f"Teks menjelaskan hubungan sebab-akibat antara {Y} dan {Z}.",

        'emosi':
            f"Teks memperlihatkan ekspresi emosional terkait {Y}.",

        'motivasi':
            f"Teks menunjukkan motivasi atau dorongan terhadap {Y}.",

        'hambatan':
            f"Teks mengindikasikan adanya hambatan atau kesulitan terkait {Y}.",

        'solusi':
            f"Teks menawarkan solusi atau strategi untuk menghadapi {Z}.",

        'harapan':
            f"Teks menunjukkan harapan atau aspirasi terkait {Y}.",

        'konflik':
            f"Teks menggambarkan konflik atau pertentangan terkait {Z}.",

        'adaptasi':
            f"Teks menunjukkan proses adaptasi terhadap {Z}.",

        'refleksi':
            f"Teks memperlihatkan refleksi atau pemaknaan pengalaman oleh {X}.",

        'transformasi':
            f"Teks menunjukkan perubahan atau transformasi dari {Y} menuju {Z}."
    }

    explanation = explanations.get(
        selected_category,
        f"Teks menunjukkan hubungan semantik antara {X}, {Y}, dan {Z}."
    )

    # Saran coding penelitian
    suggestions = SUGGESTIONS.get(selected_category, [])

    return {
        'category': selected_category,
        'template': template,
        'semantic_relation': semantic_relation,
        'X': X,
        'Y': Y,
        'Z': Z,
        'explanation': explanation,
        'suggestions': suggestions
    }
    # fallback
    return {'template': '', 'X': '', 'Y': '', 'Z': '', 'explanation': ''}
