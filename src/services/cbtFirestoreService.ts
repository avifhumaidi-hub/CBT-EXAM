import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  sanitizeDocId,
  sha256Hex,
} from '../firebase';

export interface FirestoreStatsSummary {
  studentsCount: number;
  questionsCount: number;
  schedulesCount: number;
  proctorsCount: number;
  gformLinksCount: number;
  examSessionsCount: number;
  schoolName: string;
  examTitle: string;
  examStatus: string;
}

export const BOOTSTRAPPED_ADMIN_EMAIL = 'kipaskoplak@gmail.com';

export function subscribePublicAppConfig(
  onData: (data: Record<string, any> | null) => void
): Unsubscribe {
  const path = 'app_config/public';
  return onSnapshot(
    doc(db, 'app_config', 'public'),
    (snap) => {
      onData(snap.exists() ? (snap.data() as Record<string, any>) : null);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function fetchPublicSummaryStats(): Promise<Partial<FirestoreStatsSummary>> {
  const path = 'app_config/public';
  try {
    const snap = await getDoc(doc(db, 'app_config', 'public'));
    if (!snap.exists()) {
      return {
        schoolName: 'Belum Dikonfigurasi',
        examTitle: 'CBT Enterprise',
        examStatus: 'Aktif',
      };
    }
    const d = snap.data();
    return {
      schoolName: String(d.nama_sekolah || 'Sekolah CBT'),
      examTitle: String(d.nama_ujian || 'Ujian Berbasis Komputer'),
      examStatus: String(d.status_ujian || 'Aktif'),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function fetchAdminCollectionCounts(): Promise<FirestoreStatsSummary> {
  const summary: FirestoreStatsSummary = {
    studentsCount: 0,
    questionsCount: 0,
    schedulesCount: 0,
    proctorsCount: 0,
    gformLinksCount: 0,
    examSessionsCount: 0,
    schoolName: 'Satuan Pendidikan CBT',
    examTitle: 'CBT Enterprise',
    examStatus: 'Aktif',
  };

  try {
    const [cfgSnap, studentsSnap, questionsSnap, schedulesSnap, proctorsSnap, gformSnap, sessionsSnap] =
      await Promise.all([
        getDoc(doc(db, 'app_config', 'public')),
        getDocs(collection(db, 'students')),
        getDocs(collection(db, 'questions')),
        getDocs(collection(db, 'schedules')),
        getDocs(collection(db, 'proctors')),
        getDocs(collection(db, 'gform_links')),
        getDocs(collection(db, 'exam_sessions')),
      ]);

    if (cfgSnap.exists()) {
      const cfg = cfgSnap.data();
      summary.schoolName = String(cfg.nama_sekolah || summary.schoolName);
      summary.examTitle = String(cfg.nama_ujian || summary.examTitle);
      summary.examStatus = String(cfg.status_ujian || summary.examStatus);
    }
    summary.studentsCount = studentsSnap.size;
    summary.questionsCount = questionsSnap.size;
    summary.schedulesCount = schedulesSnap.size;
    summary.proctorsCount = proctorsSnap.size;
    summary.gformLinksCount = gformSnap.size;
    summary.examSessionsCount = sessionsSnap.size;
    return summary;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'admin_dashboard_counts');
  }
}

export async function ensureDefaultFirestoreSetup(): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;

  const isBootstrapAdmin = user.email === BOOTSTRAPPED_ADMIN_EMAIL;
  if (!isBootstrapAdmin) {
    try {
      const adminSnap = await getDoc(doc(db, 'admins', user.uid));
      if (!adminSnap.exists()) return;
    } catch {
      return;
    }
  } else {
    // Ensure admin UID doc exists cleanly
    const adminPath = `admins/${user.uid}`;
    try {
      const adminRef = doc(db, 'admins', user.uid);
      const snap = await getDoc(adminRef);
      if (!snap.exists()) {
        await setDoc(adminRef, {
          uid: user.uid,
          email: user.email || BOOTSTRAPPED_ADMIN_EMAIL,
          name: user.displayName || 'Admin Utama CBT',
          createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, adminPath);
    }
  }

  // Initialize app_config/public & app_secrets/private if absent
  try {
    const publicRef = doc(db, 'app_config', 'public');
    const pubSnap = await getDoc(publicRef);
    const defaultToken = 'ABC12';
    const tokenHash = await sha256Hex('token:' + defaultToken);

    if (!pubSnap.exists()) {
      await setDoc(publicRef, {
        nama_instansi: 'KEMENTERIAN PENDIDIKAN',
        kementerian_header: 'KEMENTERIAN PENDIDIKAN, KEBUDAYAAN, RISET, DAN TEKNOLOGI',
        nama_sekolah: 'SATUAN PENDIDIKAN CBT',
        logo_sekolah: '',
        logo_kementerian: '',
        nama_ujian: 'ASESMEN SUMATIF CBT',
        durasi: '60',
        status_ujian: 'Aktif',
        acak_soal: 'Tidak',
        ujian_ketat: 'Ya',
        kiosk_mode: 'Tidak',
        exambro_only: 'Tidak',
        device_lock: 'Tidak',
        kalkulator: 'Ya',
        coretan: 'Ya',
        adaptif_cat: 'Tidak',
        ai_face_liveness: 'Ya',
        ai_gaze: 'Ya',
        audio_monitoring: 'Tidak',
        audio_limit: '2',
        tokenHash,
        tokenRequired: false,
        updatedAt: serverTimestamp(),
      });
    }

    const secretRef = doc(db, 'app_secrets', 'private');
    const secSnap = await getDoc(secretRef);
    if (!secSnap.exists()) {
      await setDoc(secretRef, {
        token: defaultToken,
        notif_email: 'Tidak',
        email_wali: '',
        kepsek_nama: '',
        kepsek_nip: '',
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'app_config/public');
  }
}

export async function seedSampleCbtMasterData(): Promise<{
  studentsAdded: number;
  proctorsAdded: number;
  questionsAdded: number;
}> {
  await ensureDefaultFirestoreSetup();
  const sampleStudents = [
    { nis: '20261001', nama: 'Ahmad Fauzan', kelas: 'XII-MIPA-1', sesi: '1', password: '123456' },
    { nis: '20261002', nama: 'Budi Santoso', kelas: 'XII-MIPA-1', sesi: '1', password: '123456' },
    { nis: '20261003', nama: 'Citra Lestari', kelas: 'XII-IPS-1', sesi: '2', password: '123456' },
  ];
  const sampleProctors = [
    { username: 'proktor1', nama: 'Pengawas Ruang 1', password: '123456' },
  ];
  const sampleQuestions = [
    {
      no: '1',
      mapel: 'ASESMEN SUMATIF CBT',
      kelas: 'Semua',
      soal: 'Sebuah sekolah menyelenggarakan ujian berbasis komputer dengan penyimpanan cloud real-time. Manakah keuntungan utama penyimpanan data jawaban peserta di database cloud Firestore?',
      a: 'Jawaban hilang saat halaman di-refresh',
      b: 'Jawaban tersimpan otomatis dan tetap aman walau ganti perangkat',
      c: 'Hanya bisa diakses dari satu browser yang sama',
      d: 'Memerlukan kabel LAN khusus antar siswa',
      e: 'Semua data dihapus setiap 5 menit',
      kunci: 'B',
      tipe_soal: 'PG',
    },
    {
      no: '2',
      mapel: 'ASESMEN SUMATIF CBT',
      kelas: 'Semua',
      soal: 'Jika siswa mengalami kendala baterai habis dan berpindah ke perangkat cadangan dengan akun yang sama, apa yang terjadi pada jawaban sebelumnya?',
      a: 'Harus mengulang dari nomor 1',
      b: 'Sisa waktu reset ke awal tanpa jawaban',
      c: 'Jawaban dan sisa waktu otomatis dipulihkan dari Firestore',
      d: 'Soal menjadi terkunci permanen oleh browser',
      e: 'Nilai langsung dianggap nol',
      kunci: 'C',
      tipe_soal: 'PG',
    },
  ];

  const batch = writeBatch(db);

  for (const s of sampleStudents) {
    const id = sanitizeDocId(s.nis);
    const passHash = await sha256Hex('cbt:' + s.password);
    batch.set(doc(db, 'students', id), {
      nis: id,
      nama: s.nama,
      kelas: s.kelas,
      sesi: s.sesi,
      ruang: '',
      passHash,
      status: 'Offline',
      activeDeviceId: '',
      boundOwnerUid: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'student_credentials', id), {
      nis: id,
      password: s.password,
      updatedAt: serverTimestamp(),
    });
  }

  for (const p of sampleProctors) {
    const id = sanitizeDocId(p.username.toLowerCase());
    const passHash = await sha256Hex('cbt:' + p.password);
    batch.set(doc(db, 'proctors', id), {
      username: id,
      nama: p.nama,
      passHash,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'proctor_credentials', id), {
      username: id,
      password: p.password,
      updatedAt: serverTimestamp(),
    });
  }

  for (let i = 0; i < sampleQuestions.length; i++) {
    const q = sampleQuestions[i];
    const id = sanitizeDocId(`q_${q.mapel}_${q.no}`);
    batch.set(doc(db, 'questions', id), {
      id,
      mapel: q.mapel,
      kelas: q.kelas,
      no: q.no,
      soal: q.soal,
      a: q.a,
      b: q.b,
      c: q.c,
      d: q.d,
      e: q.e,
      kunci: q.kunci,
      tipe_soal: q.tipe_soal,
      kesulitan: 'SEDANG',
      data_akm: '',
      sortOrder: i + 1,
      isPublished: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  const schedId = sanitizeDocId('sched_1');
  batch.set(doc(db, 'schedules', schedId), {
    id: schedId,
    tanggal: new Date().toISOString().slice(0, 10),
    mapel: 'ASESMEN SUMATIF CBT',
    kelas: 'Semua',
    ruang: 'Ruang 1',
    sesi: 'Semua',
    jam_mulai: '07:30',
    jam_selesai: '09:30',
    token: 'ABC12',
    status: 'Aktif',
    proktor: 'Pengawas Ruang 1',
    pengawas: 'Pengawas Ruang 1',
    banyak_soal: '2',
    jenis_ujian: 'CBT',
    isPublished: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return {
      studentsAdded: sampleStudents.length,
      proctorsAdded: sampleProctors.length,
      questionsAdded: sampleQuestions.length,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'seedSampleCbtMasterData');
  }
}
