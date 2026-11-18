/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import JSZip from 'jszip';
import QRCode from 'qrcode';
import { 
  FileCode2, 
  CheckCircle2, 
  Copy, 
  Download, 
  AlertTriangle, 
  Check, 
  Layers, 
  HelpCircle, 
  ArrowRight, 
  Search, 
  FileSpreadsheet,
  FileText,
  Play,
  Monitor,
  Users,
  ShieldAlert,
  Sparkles,
  Smartphone,
  Lock,
  Volume2,
  QrCode,
  FolderArchive,
  Database,
  Cloud,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, googleProvider, testConnection, firebaseConfig } from './firebase';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  ensureDefaultFirestoreSetup,
  fetchAdminCollectionCounts,
  fetchPublicSummaryStats,
  seedSampleCbtMasterData,
  subscribePublicAppConfig,
  type FirestoreStatsSummary,
} from './services/cbtFirestoreService';
import { buildAndroidExambroFiles, sanitizePackageName } from './utils/androidExambroTemplate';
import { APK_BASE64, APK_BYTE_SIZE, APK_FILENAME, getVerifiedApkBlob } from './utils/apkBinary';

export default function App() {
  const [activeTab, setActiveTab] = useState<'firebase_github' | 'firebase_live' | 'penjelasan' | 'code_gs' | 'admin_html' | 'index_html' | 'proktor_html' | 'appsscript_json' | 'android_apk' | 'tester' | 'preview'>('firebase_github');
  const [fbUser, setFbUser] = useState<User | null>(null);
  const [fbAuthBusy, setFbAuthBusy] = useState<boolean>(false);
  const [fbStats, setFbStats] = useState<Partial<FirestoreStatsSummary>>({
    schoolName: 'Satuan Pendidikan CBT',
    examTitle: 'ASESMEN SUMATIF CBT',
    examStatus: 'Aktif',
  });
  const [isAdminUser, setIsAdminUser] = useState<boolean>(false);
  const [isSeeding, setIsSeeding] = useState<boolean>(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);
  const [isFbZipDownloading, setIsFbZipDownloading] = useState<boolean>(false);
  const [fbZipStatus, setFbZipStatus] = useState<string | null>(null);
  const [fbLiveRole, setFbLiveRole] = useState<'siswa' | 'proktor' | 'admin'>('siswa');
  const [codeGs, setCodeGs] = useState<string>('');
  const [adminHtml, setAdminHtml] = useState<string>('');
  const [indexHtml, setIndexHtml] = useState<string>('');
  const [proktorHtml, setProktorHtml] = useState<string>('');
  const [appsScriptJson, setAppsScriptJson] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [previewMenu, setPreviewMenu] = useState<'admin' | 'proktor' | 'siswa'>('admin');

  const DEFAULT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzAQ1YpzQ-QkbPM2DS7tX_ik2mlM9IPt3qTPg6MorKSXnSESslldX0k8ECjdqwD_p0PMw/exec';

  // Android Exambro APK Generator Config State
  const [apkAppName, setApkAppName] = useState<string>('CBT Exambro Lockdown');
  const [apkPackageName, setApkPackageName] = useState<string>('id.sch.cbt.exambro');
  const [apkWebAppUrl, setApkWebAppUrl] = useState<string>(DEFAULT_WEB_APP_URL);
  const [apkProctorPin, setApkProctorPin] = useState<string>('202600');
  const [apkPreviewFile, setApkPreviewFile] = useState<'main_kt' | 'manifest' | 'gradle' | 'workflow'>('main_kt');
  const [isZipGenerating, setIsZipGenerating] = useState<boolean>(false);
  const [isGasZipDownloading, setIsGasZipDownloading] = useState<boolean>(false);
  const [gasZipStatus, setGasZipStatus] = useState<string | null>(null);
  const [isApkDownloading, setIsApkDownloading] = useState<boolean>(false);
  const [apkDownloadStatus, setApkDownloadStatus] = useState<string | null>(null);
  const [qrInputUrl, setQrInputUrl] = useState<string>(DEFAULT_WEB_APP_URL);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrError, setQrError] = useState<string | null>(null);

  useEffect(() => {
    const target = (qrInputUrl || apkWebAppUrl).trim();
    if (!target) {
      setQrDataUrl('');
      setQrError(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(target, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    })
      .then((url) => {
        if (!cancelled) {
          setQrDataUrl(url);
          setQrError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setQrDataUrl('');
          setQrError(err instanceof Error ? err.message : 'Gagal membuat QR Code');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [qrInputUrl, apkWebAppUrl]);

  const handleDownloadQrPng = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = 'QR-Link-CBT-Apps-Script.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadReadyApk = async () => {
    setIsApkDownloading(true);
    setApkDownloadStatus(null);
    try {
      const { blob, byteSize } = await getVerifiedApkBlob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = APK_FILENAME;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 8000);
      setApkDownloadStatus(`File ${APK_FILENAME} (${(byteSize / 1024).toFixed(1)} KB) berhasil disiapkan & diunduh!`);
    } catch (err) {
      console.error('Gagal mengunduh APK:', err);
      setApkDownloadStatus('Gunakan tombol Alternatif Simpan Langsung (.apk) di bawah.');
    } finally {
      setIsApkDownloading(false);
    }
  };

  const androidProjectFiles = useMemo(() => buildAndroidExambroFiles({
    appName: apkAppName,
    packageName: apkPackageName,
    webAppUrl: apkWebAppUrl,
    proctorPin: apkProctorPin
  }), [apkAppName, apkPackageName, apkWebAppUrl, apkProctorPin]);

  const sanitizedPkg = sanitizePackageName(apkPackageName);
  const mainActivityKey = `app/src/main/java/${sanitizedPkg.replace(/\./g, '/')}/MainActivity.kt`;

  const handleDownloadAndroidZip = async () => {
    setIsZipGenerating(true);
    try {
      const zip = new JSZip();
      Object.entries(androidProjectFiles).forEach(([filePath, content]) => {
        zip.file(filePath, content);
      });
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CBT-Exambro-Android-Lockdown-${sanitizedPkg}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsZipGenerating(false);
    }
  };

  const handleDownloadGasZip = async () => {
    setIsGasZipDownloading(true);
    setGasZipStatus(null);
    try {
      const bust = `?t=${Date.now()}`;
      const [gsText, indexText, adminText, proktorText, manifestText] = await Promise.all([
        fetch(`/Code.gs${bust}`, { cache: 'no-store' }).then((r) => r.text()),
        fetch(`/Index.html${bust}`, { cache: 'no-store' }).then((r) => r.text()),
        fetch(`/Admin.html${bust}`, { cache: 'no-store' }).then((r) => r.text()),
        fetch(`/Proktor.html${bust}`, { cache: 'no-store' }).then((r) => r.text()),
        fetch(`/appsscript.json${bust}`, { cache: 'no-store' }).then((r) => r.text()),
      ]);

      const zip = new JSZip();
      zip.file('Code.gs', gsText);
      zip.file('Index.html', indexText);
      zip.file('Admin.html', adminText);
      zip.file('Proktor.html', proktorText);
      zip.file('appsscript.json', manifestText);

      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 },
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'CBT-Apps-Script-GitHub.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 8000);
      setGasZipStatus(`Paket CBT-Apps-Script-GitHub.zip (${(blob.size / 1024).toFixed(1)} KB, berisi 5 file lengkap) berhasil diunduh!`);
    } catch (err) {
      console.error('Gagal membuat ZIP Apps Script:', err);
      window.location.href = '/api/download-gas-zip';
    } finally {
      setIsGasZipDownloading(false);
    }
  };

  const handleDownloadFirebaseGithubZip = async () => {
    setIsFbZipDownloading(true);
    setFbZipStatus(null);
    try {
      const bust = `?t=${Date.now()}`;
      const files = [
        'index.html',
        'Admin.html',
        'Proktor.html',
        'firebase-cbt-bridge.js',
        'firebase-applet-config.json',
        'firestore.rules',
        'firebase-blueprint.json',
        'README.md',
      ];
      const contents = await Promise.all(
        files.map((name) =>
          fetch(`/firebase-github/${name}${bust}`, { cache: 'no-store' }).then((r) => {
            if (!r.ok) throw new Error(`Gagal memuat ${name}`);
            return r.text();
          })
        )
      );
      const zip = new JSZip();
      files.forEach((name, idx) => zip.file(name, contents[idx]));
      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 },
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'CBT-Firebase-GitHub.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 8000);
      setFbZipStatus(`Paket CBT-Firebase-GitHub.zip (${(blob.size / 1024).toFixed(1)} KB, berisi 8 file siap GitHub Pages) berhasil diunduh!`);
    } catch (err) {
      console.error('Gagal membuat ZIP Firebase GitHub:', err);
      window.location.href = '/api/download-firebase-github-zip';
    } finally {
      setIsFbZipDownloading(false);
    }
  };

  const refreshFirestoreStats = async (userObj: User | null) => {
    if (userObj && userObj.emailVerified && userObj.email === BOOTSTRAPPED_ADMIN_EMAIL) {
      setIsAdminUser(true);
      await ensureDefaultFirestoreSetup();
      const summary = await fetchAdminCollectionCounts();
      setFbStats(summary);
    } else {
      setIsAdminUser(false);
      const pubSummary = await fetchPublicSummaryStats();
      setFbStats((prev) => ({ ...prev, ...pubSummary }));
    }
  };

  const handleGoogleSignIn = async () => {
    setFbAuthBusy(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (cred.user) {
        await refreshFirestoreStats(cred.user);
      }
    } catch (err) {
      console.error('Login Google gagal:', err);
      setSeedMessage('Login Google dibatalkan atau pop-up diblokir.');
    } finally {
      setFbAuthBusy(false);
    }
  };

  const handleGoogleSignOut = async () => {
    setFbAuthBusy(true);
    try {
      await signOut(auth);
      setIsAdminUser(false);
    } finally {
      setFbAuthBusy(false);
    }
  };

  const handleSeedSampleData = async () => {
    setIsSeeding(true);
    setSeedMessage(null);
    try {
      const res = await seedSampleCbtMasterData();
      const summary = await fetchAdminCollectionCounts();
      setFbStats(summary);
      setSeedMessage(
        `Berhasil mengisi Firestore: ${res.studentsAdded} siswa contoh (NIS 20261001, pass 123456), ${res.proctorsAdded} proktor (proktor1, pass 123456), & ${res.questionsAdded} soal.`
      );
    } catch (err) {
      setSeedMessage('Gagal mengisi data contoh: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsSeeding(false);
    }
  };

  // Interactive Test State
  const [testInput, setTestInput] = useState<string>(generateSample40Questions());
  const [parsedResults, setParsedResults] = useState<any[]>([]);

  useEffect(() => {
    testConnection();

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setFbUser(u);
      refreshFirestoreStats(u).catch(() => {});
    });

    const unsubCfg = subscribePublicAppConfig((cfg) => {
      if (cfg) {
        setFbStats((prev) => ({
          ...prev,
          schoolName: String(cfg.nama_sekolah || prev.schoolName || 'Satuan Pendidikan CBT'),
          examTitle: String(cfg.nama_ujian || prev.examTitle || 'ASESMEN SUMATIF CBT'),
          examStatus: String(cfg.status_ujian || prev.examStatus || 'Aktif'),
        }));
      }
    });

    // Load all files from public root without stale browser cache
    const bust = `?t=${Date.now()}`;
    Promise.all([
      fetch(`/Code.gs${bust}`, { cache: 'no-store' }).then(r => r.text()),
      fetch(`/Admin.html${bust}`, { cache: 'no-store' }).then(r => r.text()),
      fetch(`/Index.html${bust}`, { cache: 'no-store' }).then(r => r.text()),
      fetch(`/Proktor.html${bust}`, { cache: 'no-store' }).then(r => r.text()),
      fetch(`/appsscript.json${bust}`, { cache: 'no-store' }).then(r => r.text())
    ]).then(([gs, admin, index, proktor, manifest]) => {
      setCodeGs(gs);
      setAdminHtml(admin);
      setIndexHtml(index);
      setProktorHtml(proktor);
      setAppsScriptJson(manifest);
      setLoading(false);
    }).catch(err => {
      console.error('Gagal memuat file:', err);
      setLoading(false);
    });

    // Run initial test
    runParserTest(testInput);

    // Auto trigger download if ?download=apk is present
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('download') === 'apk') {
      handleDownloadReadyApk();
    }

    return () => {
      unsubAuth();
      unsubCfg();
    };
  }, []);

  const copyToClipboard = async (text: string, type: string) => {
    if (!text) return;
    let ok = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-9999px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 3000);
    }
  };

  const downloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // The client-side replica of the enhanced parser in Admin.html
  function runParserTest(rawText: string) {
    const soalList: any[] = [];
    const lines = rawText.split('\n');
    let curNo = '';
    let curSoal = '';
    let curA = '', curB = '', curC = '', curD = '', curE = '', curKunci = '';
    let target = 'soal';

    const finalize = () => {
      if (curNo && (curSoal.trim() || curA.trim())) {
        soalList.push({
          mapel: 'Matematika',
          kelas: 'Semua',
          no: curNo,
          soal: curSoal.trim(),
          a: curA.trim(),
          b: curB.trim(),
          c: curC.trim(),
          d: curD.trim(),
          e: curE.trim(),
          kunci: curKunci || 'A'
        });
      }
      curNo = ''; curSoal = ''; curA = ''; curB = ''; curC = ''; curD = ''; curE = ''; curKunci = '';
      target = 'soal';
    };

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const noMatch = trimmed.match(/^(\d+)[\.\)]\s*(.*)$/);
      if (noMatch) {
        finalize();
        curNo = noMatch[1];
        curSoal = noMatch[2];
        target = 'soal';
        return;
      }

      const optMatch = trimmed.match(/^([A-Ea-e])[\.\)]\s*(.*)$/);
      if (optMatch && curNo) {
        const char = optMatch[1].toUpperCase();
        if (char === 'A') { curA = optMatch[2]; target = 'A'; }
        else if (char === 'B') { curB = optMatch[2]; target = 'B'; }
        else if (char === 'C') { curC = optMatch[2]; target = 'C'; }
        else if (char === 'D') { curD = optMatch[2]; target = 'D'; }
        else if (char === 'E') { curE = optMatch[2]; target = 'E'; }
        return;
      }

      const keyMatch = trimmed.match(/^(?:KUNCI|Kunci|Ans|Answer|Jawaban)\s*[:=]\s*([A-Ea-e])/i);
      if (keyMatch && curNo) {
        curKunci = keyMatch[1].toUpperCase();
        return;
      }

      if (target === 'soal') curSoal += ' ' + trimmed;
      else if (target === 'A') curA += ' ' + trimmed;
      else if (target === 'B') curB += ' ' + trimmed;
      else if (target === 'C') curC += ' ' + trimmed;
      else if (target === 'D') curD += ' ' + trimmed;
      else if (target === 'E') curE += ' ' + trimmed;
    });

    finalize();
    setParsedResults(soalList);
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              CBT Enterprise &bull; Mode Google Form + Anti-Curang
              <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-medium">
                Siap Copy ke Apps Script
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Tampilan CBT Siswa bergaya Google Form + Anti-Curang Aktif &bull; Hasil Ujian Masuk Otomatis ke Google Form &amp; Spreadsheet
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/60 p-1.5 rounded-xl border border-slate-700/60 text-xs font-medium">
          <button
            onClick={() => setActiveTab('firebase_github')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'firebase_github'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Database className="w-4 h-4" />
            Firebase GitHub (ZIP)
          </button>

          <button
            onClick={() => setActiveTab('firebase_live')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'firebase_live'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-indigo-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Cloud className="w-4 h-4" />
            Buka CBT Firestore
          </button>

          <button
            onClick={() => setActiveTab('penjelasan')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'penjelasan'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            Panduan &amp; Fitur
          </button>

          <button
            onClick={() => setActiveTab('code_gs')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'code_gs'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5" />
            Code.gs
          </button>

          <button
            onClick={() => setActiveTab('index_html')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'index_html'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Index.html
          </button>

          <button
            onClick={() => setActiveTab('admin_html')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'admin_html'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Admin.html
          </button>

          <button
            onClick={() => setActiveTab('proktor_html')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'proktor_html'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Proktor.html
          </button>

          <button
            onClick={() => setActiveTab('appsscript_json')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'appsscript_json'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-amber-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            appsscript.json
          </button>

          <button
            onClick={() => setActiveTab('android_apk')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'android_apk'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-rose-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            APK Android (Lockdown)
          </button>

          <button
            onClick={() => setActiveTab('tester')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'tester'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Play className="w-4 h-4" />
            Uji Coba 40 Soal
          </button>

          <button
            onClick={() => setActiveTab('preview')}
            className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'preview'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Monitor className="w-4 h-4" />
            Pratinjau GAS
          </button>
        </div>
      </header>

      {/* Prominent Quick Action Bar */}
      <div className="bg-gradient-to-r from-emerald-800 via-indigo-800 to-purple-800 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-4 shadow-xl border-b border-emerald-500/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
            <Database className="w-6 h-6 text-emerald-300" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-white">
              Versi GitHub Pages + Firebase Firestore Aktif ({firebaseConfig.projectId})
            </h2>
            <p className="text-xs text-emerald-100">
              Master Data &amp; Progres Ujian tersimpan di Firestore, aman dengan <strong className="text-amber-300">firestore.rules</strong>, tahan reload &amp; ganti perangkat!
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadFirebaseGithubZip}
            disabled={isFbZipDownloading}
            className="bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-extrabold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg transition-all cursor-pointer disabled:opacity-60"
          >
            <FolderArchive className="w-4 h-4" />
            {isFbZipDownloading ? 'Membuat ZIP...' : 'Unduh ZIP Firebase GitHub'}
          </button>

          <button
            type="button"
            onClick={() => { setFbLiveRole('admin'); setActiveTab('firebase_live'); }}
            className="bg-white hover:bg-indigo-50 text-indigo-900 font-extrabold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg transition-all cursor-pointer"
          >
            <Layers className="w-4 h-4 text-indigo-700" />
            Admin Firestore
          </button>

          <button
            type="button"
            onClick={() => { setFbLiveRole('proktor'); setActiveTab('firebase_live'); }}
            className="bg-white hover:bg-sky-50 text-sky-900 font-extrabold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg transition-all cursor-pointer"
          >
            <Users className="w-4 h-4 text-sky-700" />
            Proktor Firestore
          </button>

          <button
            type="button"
            onClick={() => { setFbLiveRole('siswa'); setActiveTab('firebase_live'); }}
            className="bg-white hover:bg-emerald-50 text-emerald-900 font-extrabold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg transition-all cursor-pointer"
          >
            <Play className="w-4 h-4 text-emerald-700" />
            CBT Siswa Firestore
          </button>

          <button
            type="button"
            onClick={handleDownloadGasZip}
            disabled={isGasZipDownloading}
            className="bg-sky-400 hover:bg-sky-300 text-slate-950 font-extrabold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg transition-all cursor-pointer disabled:opacity-60"
          >
            <FolderArchive className="w-4 h-4" />
            {isGasZipDownloading ? 'ZIP GAS...' : 'ZIP Apps Script'}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* TAB UTAMA: FIREBASE GITHUB ZIP & MASTER DATA CLOUD */}
        {activeTab === 'firebase_github' && (
          <div className="space-y-6">
            {/* Kartu Download ZIP GitHub Firebase */}
            <section className="bg-gradient-to-br from-slate-800 via-emerald-950/50 to-indigo-950/70 border-2 border-emerald-500/50 rounded-2xl p-6 shadow-2xl">
              <div className="flex flex-wrap items-center justify-between gap-5">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center shrink-0">
                    <Database className="w-7 h-7" />
                  </div>
                  <div>
                    <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-[11px] font-extrabold px-3 py-0.5 rounded-full mb-1.5">
                      VERSI GITHUB PAGES + FIREBASE FIRESTORE &bull; SIAP EKSTRAK &amp; UPLOAD GITHUB
                    </div>
                    <h2 className="text-lg font-extrabold text-white">
                      Unduh Paket Lengkap (<code className="text-emerald-300">CBT-Firebase-GitHub.zip</code>)
                    </h2>
                    <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                      Tampilan <strong className="text-white">CBT Siswa</strong>, <strong className="text-white">Proktor</strong>, dan <strong className="text-white">Admin</strong> dibuat sama persis dengan versi Apps Script Spreadsheet, tetapi seluruh master data (Siswa, Bank Soal, Jadwal, Proktor, Konfigurasi, Link Google Form, Progres Jawaban &amp; Nilai) kini tersimpan aman di <strong className="text-emerald-300">Firebase Firestore</strong>. Jawaban &amp; sisa waktu tidak hilang saat reload atau saat siswa berpindah perangkat.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadFirebaseGithubZip}
                      disabled={isFbZipDownloading}
                      className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-5 py-3 rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer disabled:opacity-60"
                    >
                      <Download className="w-4 h-4" />
                      {isFbZipDownloading ? 'Menyiapkan ZIP...' : 'Unduh ZIP Firebase GitHub (8 File)'}
                    </button>
                    <a
                      href="/api/download-firebase-github-zip"
                      download="CBT-Firebase-GitHub.zip"
                      className="bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-emerald-500/40 px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                    >
                      <FolderArchive className="w-4 h-4" />
                      Link Langsung (.zip)
                    </a>
                  </div>
                  {fbZipStatus && (
                    <div className="bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 px-3 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      {fbZipStatus}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-700/70 grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                {[
                  { name: 'index.html', desc: 'Halaman CBT Siswa (Firebase)', href: '/firebase-github/index.html' },
                  { name: 'Proktor.html', desc: 'Panel Proktor / Pengawas', href: '/firebase-github/Proktor.html' },
                  { name: 'Admin.html', desc: 'Panel Admin Master Data', href: '/firebase-github/Admin.html' },
                  { name: 'firebase-cbt-bridge.js', desc: 'Koneksi Auth & Firestore', href: '/firebase-github/firebase-cbt-bridge.js' },
                  { name: 'firebase-applet-config.json', desc: 'Konfigurasi Proyek Firebase', href: '/firebase-github/firebase-applet-config.json' },
                  { name: 'firestore.rules', desc: 'Aturan Keamanan Firestore', href: '/firebase-github/firestore.rules' },
                  { name: 'firebase-blueprint.json', desc: 'Skema 16 Koleksi Firestore', href: '/firebase-github/firebase-blueprint.json' },
                  { name: 'README.md', desc: 'Panduan Upload & GitHub Pages', href: '/firebase-github/README.md' },
                ].map((f) => (
                  <a
                    key={f.name}
                    href={f.href}
                    download={f.name}
                    className="bg-slate-900/90 hover:bg-slate-800 border border-slate-700 hover:border-emerald-400/60 p-3 rounded-xl flex items-start gap-2.5 transition-all"
                  >
                    <Download className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-white truncate">{f.name}</div>
                      <div className="text-[11px] text-slate-400 truncate">{f.desc}</div>
                    </div>
                  </a>
                ))}
              </div>
            </section>

            {/* Panel Status Firebase Auth + Data Firestore + Seed Awal */}
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    Akun Google &amp; Hak Akses
                  </h3>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                    Rules Aktif
                  </span>
                </div>

                {fbUser ? (
                  <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-3.5 space-y-2">
                    <div className="text-xs text-slate-400">Masuk sebagai:</div>
                    <div className="text-sm font-bold text-white truncate">{fbUser.email}</div>
                    <div className="text-[11px] text-emerald-400 font-semibold">
                      {isAdminUser
                        ? 'Peran: Admin Utama CBT (Akses Penuh Read/Write)'
                        : 'Peran: Pengguna Terverifikasi (Siswa / Proktor via Sesi)'}
                    </div>
                    <div className="pt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => refreshFirestoreStats(fbUser)}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Refresh
                      </button>
                      <button
                        type="button"
                        onClick={handleGoogleSignOut}
                        disabled={fbAuthBusy}
                        className="bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Keluar Google
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-4 space-y-3">
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Masuk dengan akun Google Admin (<code className="text-amber-300">{BOOTSTRAPPED_ADMIN_EMAIL}</code>) untuk melihat statistik koleksi Firestore atau mengisi data contoh awal.
                    </p>
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={fbAuthBusy}
                      className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
                    >
                      <LogIn className="w-4 h-4" />
                      {fbAuthBusy ? 'Menghubungkan...' : 'Masuk dengan Google (Admin)'}
                    </button>
                  </div>
                )}

                {isAdminUser && (
                  <div className="pt-2 border-t border-slate-700 space-y-2">
                    <button
                      type="button"
                      onClick={handleSeedSampleData}
                      disabled={isSeeding}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
                    >
                      <Sparkles className="w-4 h-4" />
                      {isSeeding ? 'Menyimpan ke Firestore...' : 'Isi Data Contoh Awal (Siswa, Proktor, Soal)'}
                    </button>
                    {seedMessage && (
                      <div className="text-[11px] bg-slate-950 border border-emerald-500/30 text-emerald-300 p-2.5 rounded-lg leading-relaxed">
                        {seedMessage}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-sky-400" />
                  Ringkasan Database Firestore
                </h3>
                <div className="bg-slate-900/70 border border-slate-700/70 rounded-xl p-3.5 text-xs space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Sekolah:</span>
                    <span className="font-bold text-white">{fbStats.schoolName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Nama Ujian:</span>
                    <span className="font-bold text-indigo-300">{fbStats.examTitle}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Status Ujian:</span>
                    <span className="font-bold text-emerald-400">{fbStats.examStatus}</span>
                  </div>
                </div>

                {isAdminUser ? (
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-700">
                      <div className="text-lg font-extrabold text-white">{fbStats.studentsCount ?? 0}</div>
                      <div className="text-[11px] text-slate-400">Siswa</div>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-700">
                      <div className="text-lg font-extrabold text-emerald-400">{fbStats.questionsCount ?? 0}</div>
                      <div className="text-[11px] text-slate-400">Bank Soal</div>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-700">
                      <div className="text-lg font-extrabold text-amber-400">{fbStats.gformLinksCount ?? 0}</div>
                      <div className="text-[11px] text-slate-400">Link GForm</div>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-700">
                      <div className="text-lg font-extrabold text-sky-400">{fbStats.schedulesCount ?? 0}</div>
                      <div className="text-[11px] text-slate-400">Jadwal</div>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-700">
                      <div className="text-lg font-extrabold text-purple-400">{fbStats.proctorsCount ?? 0}</div>
                      <div className="text-[11px] text-slate-400">Proktor</div>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-700">
                      <div className="text-lg font-extrabold text-rose-400">{fbStats.examSessionsCount ?? 0}</div>
                      <div className="text-[11px] text-slate-400">Sesi Ujian</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 bg-slate-900/60 border border-slate-700/60 rounded-xl p-3 leading-relaxed">
                    Masuk sebagai Admin untuk melihat jumlah data di seluruh koleksi Firestore dan mengelola data lewat Panel Admin.
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => { setFbLiveRole('siswa'); setActiveTab('firebase_live'); }}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-3 rounded-xl text-xs cursor-pointer"
                  >
                    Buka CBT Siswa
                  </button>
                  <button
                    type="button"
                    onClick={() => { setFbLiveRole('proktor'); setActiveTab('firebase_live'); }}
                    className="flex-1 bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 px-3 rounded-xl text-xs cursor-pointer"
                  >
                    Panel Proktor
                  </button>
                  <button
                    type="button"
                    onClick={() => { setFbLiveRole('admin'); setActiveTab('firebase_live'); }}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-3 rounded-xl text-xs cursor-pointer"
                  >
                    Panel Admin
                  </button>
                </div>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Cloud className="w-5 h-5 text-amber-400" />
                  Langkah Pasang di GitHub Pages
                </h3>
                <ol className="list-decimal pl-4 space-y-2 text-xs text-slate-300 leading-relaxed">
                  <li>Klik tombol <strong className="text-emerald-300">Unduh ZIP Firebase GitHub (8 File)</strong> di atas lalu ekstrak ke folder baru.</li>
                  <li>Buka repository GitHub Anda (<code className="text-amber-300">main</code>) &rarr; <strong>Add file &gt; Upload files</strong> &rarr; unggah ke-8 file hasil ekstrak.</li>
                  <li>Buka <strong>Settings &gt; Pages</strong> &rarr; Source: <strong>Deploy from a branch</strong> (<code className="text-white">main / root</code>) &rarr; klik <strong>Save</strong>.</li>
                  <li>
                    <strong className="text-amber-300">Penting:</strong> Buka{' '}
                    <strong className="text-white">Firebase Console &gt; Authentication &gt; Settings &gt; Authorized domains</strong>, lalu tambahkan domain{' '}
                    <code className="text-emerald-300">&lt;username&gt;.github.io</code> agar Login Google berjalan di GitHub Pages!
                  </li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* TAB: JALANKAN LANGSUNG CBT FIREBASE (SISWA / PROKTOR / ADMIN) */}
        {activeTab === 'firebase_live' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-800 p-4 rounded-xl border border-slate-700">
              <div>
                <h3 className="font-bold text-white flex items-center gap-2">
                  <Cloud className="w-5 h-5 text-emerald-400" />
                  Aplikasi CBT Versi Firebase Firestore (Tampilan Otentik Apps Script)
                </h3>
                <p className="text-xs text-slate-400">
                  Semua perubahan master data &amp; jawaban siswa langsung tersimpan ke Firebase Firestore ({firebaseConfig.projectId}).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-700 text-xs">
                  <button
                    type="button"
                    onClick={() => setFbLiveRole('siswa')}
                    className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                      fbLiveRole === 'siswa' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    CBT Siswa (index.html)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFbLiveRole('proktor')}
                    className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                      fbLiveRole === 'proktor' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Proktor (Proktor.html)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFbLiveRole('admin')}
                    className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                      fbLiveRole === 'admin' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Admin (Admin.html)
                  </button>
                </div>

                <a
                  href={
                    fbLiveRole === 'admin'
                      ? '/firebase-github/Admin.html'
                      : fbLiveRole === 'proktor'
                      ? '/firebase-github/Proktor.html'
                      : '/firebase-github/index.html'
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  Buka Tab Penuh
                </a>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl h-[760px] flex flex-col">
              <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
                  <span className="ml-2 font-mono text-[11px] text-emerald-300">
                    {fbLiveRole === 'admin'
                      ? '/firebase-github/Admin.html'
                      : fbLiveRole === 'proktor'
                      ? '/firebase-github/Proktor.html'
                      : '/firebase-github/index.html'}
                  </span>
                </div>
                <span className="text-[11px] text-emerald-400 font-semibold">Terhubung ke Firestore Live</span>
              </div>
              <iframe
                key={fbLiveRole}
                src={
                  fbLiveRole === 'admin'
                    ? '/firebase-github/Admin.html'
                    : fbLiveRole === 'proktor'
                    ? '/firebase-github/Proktor.html'
                    : '/firebase-github/index.html'
                }
                title={`CBT Firebase ${fbLiveRole}`}
                allow="camera; microphone; fullscreen; autoplay"
                className="w-full flex-1 border-0 bg-white"
              />
            </div>
          </div>
        )}

        {/* TAB 1: PENJELASAN & SOLUSI */}
        {activeTab === 'penjelasan' && (
          <div className="space-y-6">
            {/* Quick Status Banner */}
            <div className="bg-gradient-to-r from-emerald-950/60 via-slate-800 to-slate-800 border border-emerald-500/30 rounded-2xl p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-emerald-400 mb-1">
                    Penyebab Utama Mengapa Hanya 1 Soal yang Tersimpan (dan Telah Berhasil Diperbaiki)
                  </h2>
                  <p className="text-slate-300 text-sm leading-relaxed">
                    Setelah meneliti kode backend (<code className="text-amber-300 font-mono">Code.gs</code>) dan frontend admin (<code className="text-amber-300 font-mono">Admin.html</code>), ditemukan <strong>3 faktor kritis</strong> yang membuat soal nomor 2 sampai 40 terabaikan saat diunggah:
                  </p>
                </div>
              </div>

              {/* 3 Root Causes Cards */}
              <div className="grid md:grid-cols-3 gap-4 mt-6">
                <div className="bg-slate-900/80 border border-slate-700/80 p-4 rounded-xl">
                  <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm mb-2">
                    <AlertTriangle className="w-4 h-4" />
                    1. Parser Word Hanya Baca 1 Tabel
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Di <code className="text-amber-300">Admin.html</code> lama, regex hanya mengambil tabel pertama:
                    <br /><code className="text-rose-300 font-mono text-[11px]">htmlOrText.match(/&lt;table...&gt;/i)</code> dan langsung <code className="text-rose-300 font-mono text-[11px]">return soalList;</code> jika ditemukan 1 soal.
                    Jika file Word memakai 1 tabel per soal (40 tabel) atau ada tabel kop di atas, soal nomor 2-40 langsung dibuang!
                  </p>
                  <div className="mt-3 text-[11px] text-emerald-400 font-medium">
                    &bull; Solusi: Dilakukan iterasi ke SELURUH tabel dokumen tanpa henti.
                  </div>
                </div>

                <div className="bg-slate-900/80 border border-slate-700/80 p-4 rounded-xl">
                  <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm mb-2">
                    <AlertTriangle className="w-4 h-4" />
                    2. Nomor Otomatis Word Hilang
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Saat file Word diubah oleh Mammoth, daftar nomor otomatis (<code className="text-slate-400">&lt;ol&gt;&lt;li&gt;</code>) tidak memiliki angka literal "2.", "3.".
                    Akibatnya, parser menganggap seluruh soal 2-40 sebagai teks sambungan dari Soal 1, sehingga 40 soal menumpuk jadi 1 soal raksasa.
                  </p>
                  <div className="mt-3 text-[11px] text-emerald-400 font-medium">
                    &bull; Solusi: State-machine mengenali transisi soal baru secara cerdas setelah opsi A-E terisi.
                  </div>
                </div>

                <div className="bg-slate-900/80 border border-slate-700/80 p-4 rounded-xl">
                  <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm mb-2">
                    <AlertTriangle className="w-4 h-4" />
                    3. Filter Mapel di Backend Code.gs
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Di baris 111 <code className="text-amber-300">Code.gs</code> lama, ada filter:
                    <br /><code className="text-rose-300 font-mono text-[11px]">rawSoal.filter(r =&gt; r[0] &amp;&amp; r[0].trim() !== '')</code>.
                    Banyak guru yang hanya mengetik Mapel di baris pertama saja, sehingga baris 2-40 (yang kolom mapelnya kosong) otomatis dihapus oleh server saat sinkronisasi!
                  </p>
                  <div className="mt-3 text-[11px] text-emerald-400 font-medium">
                    &bull; Solusi: Server otomatis meneruskan (carry forward) Mapel &amp; Kelas ke seluruh 40 baris.
                  </div>
                </div>
              </div>
            </div>

            {/* Cara Pasang Langkah demi Langkah */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
              <h3 className="text-base font-bold text-white flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                Langkah Cepat Memperbarui Proyek Google Apps Script Anda
              </h3>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/50">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600/30 text-indigo-400 font-bold flex items-center justify-center text-sm mb-3">
                    1
                  </div>
                  <h4 className="font-semibold text-white text-sm mb-1">Buka Google Apps Script</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Buka Spreadsheet ujian Anda, klik menu <strong>Ekstensi &gt; Apps Script</strong>.
                  </p>
                </div>

                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/50">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600/30 text-indigo-400 font-bold flex items-center justify-center text-sm mb-3">
                    2
                  </div>
                  <h4 className="font-semibold text-white text-sm mb-1">Salin File Code.gs &amp; Admin.html</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Buka tab <strong>Kode Code.gs</strong> di atas lalu klik tombol <em>"Salin Semua Kode"</em>, tempelkan ke file <code className="text-amber-300">Code.gs</code> di Apps Script. Lakukan hal yang sama untuk <code className="text-amber-300">Admin.html</code>.
                  </p>
                </div>

                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/50">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600/30 text-indigo-400 font-bold flex items-center justify-center text-sm mb-3">
                    3
                  </div>
                  <h4 className="font-semibold text-white text-sm mb-1">Terapkan / Deploy Ulang</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Klik tombol <strong>Deploy &gt; Kelola Deployment</strong> &gt; edit versi ke <strong>"Versi Baru"</strong> lalu klik <strong>Terapkan</strong>. Buka menu Admin dan coba upload 40 soal kembali!
                  </p>
                </div>
              </div>
            </div>

            {/* Guarantees */}
            <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-2xl p-6">
              <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-wider mb-3">
                Jaminan Kepatuhan Permintaan
              </h3>
              <div className="grid sm:grid-cols-2 gap-4 text-xs text-slate-300">
                <div className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Tampilan UI Tidak Berubah:</strong> Seluruh elemen antarmuka CBT Siswa, Proktor, maupun Admin tetap 100% sama dengan tata letak, warna, dan fitur aslinya.
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Penyimpanan Lengkap:</strong> Semua 40 soal (kolom Mapel, Kelas, No, Soal, Pilihan A s/d E, Kunci Jawaban, Tipe Soal) tersimpan rapi baris per baris di sheet <code className="text-amber-300">Bank_Soal</code>.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: KODE Code.gs */}
        {activeTab === 'code_gs' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-800 p-4 rounded-xl border border-slate-700">
              <div>
                <h3 className="font-bold text-white flex items-center gap-2">
                  <FileCode2 className="w-5 h-5 text-indigo-400" />
                  File: Code.gs (Backend Google Apps Script)
                </h3>
                <p className="text-xs text-slate-400">
                  Total {codeGs.split('\n').length} baris kode &bull; Menangani fungsi <code className="text-emerald-400">saveSoalMasal</code>, <code className="text-emerald-400">getAdminDashboardData</code>, dan autofill Mapel
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyToClipboard(codeGs, 'code_gs')}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
                >
                  {copiedType === 'code_gs' ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  {copiedType === 'code_gs' ? 'Tersalin ke Clipboard!' : 'Salin Semua Kode Code.gs'}
                </button>
                <button
                  onClick={() => downloadFile('Code.gs', codeGs)}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                  title="Unduh file Code.gs"
                >
                  <Download className="w-4 h-4" />
                  Unduh
                </button>
              </div>
            </div>

            {/* Code Box */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden font-mono text-xs">
              <div className="bg-slate-900/80 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-slate-400 text-[11px]">
                <span>Google Apps Script (.gs)</span>
                <span>UTF-8 &bull; Ready for copy-paste</span>
              </div>
              <pre className="p-4 overflow-x-auto max-h-[600px] overflow-y-auto text-slate-300 leading-relaxed custom-scrollbar selection:bg-indigo-800">
                {codeGs || 'Memuat kode Code.gs...'}
              </pre>
            </div>
          </div>
        )}

        {/* TAB 3: KODE Admin.html */}
        {activeTab === 'admin_html' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-800 p-4 rounded-xl border border-slate-700">
              <div>
                <h3 className="font-bold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-indigo-400" />
                  File: Admin.html (Frontend Admin Panel CBT)
                </h3>
                <p className="text-xs text-slate-400">
                  Total {adminHtml.split('\n').length} baris kode &bull; Termasuk multi-table Word parser &amp; Excel column dynamic mapper
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyToClipboard(adminHtml, 'admin_html')}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
                >
                  {copiedType === 'admin_html' ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  {copiedType === 'admin_html' ? 'Tersalin ke Clipboard!' : 'Salin Semua Kode Admin.html'}
                </button>
                <button
                  onClick={() => downloadFile('Admin.html', adminHtml)}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                  title="Unduh file Admin.html"
                >
                  <Download className="w-4 h-4" />
                  Unduh
                </button>
                <a
                  href="/Admin.html"
                  target="_blank"
                  rel="noreferrer"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                  title="Buka file mentah di tab baru untuk Ctrl+A & Ctrl+C"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  Buka Tab Baru
                </a>
              </div>
            </div>

            {/* Code Box */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden font-mono text-xs">
              <div className="bg-slate-900/80 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-slate-400 text-[11px]">
                <span>HTML / React / Google Apps Script Template (.html)</span>
                <span>UTF-8 &bull; Ready for copy-paste</span>
              </div>
              <pre className="p-4 overflow-x-auto max-h-[600px] overflow-y-auto text-slate-300 leading-relaxed custom-scrollbar selection:bg-indigo-800">
                {adminHtml || 'Memuat kode Admin.html...'}
              </pre>
            </div>
          </div>
        )}

        {/* TAB: KODE Index.html */}
        {activeTab === 'index_html' && (
          <div className="space-y-4">
            <div className="bg-emerald-950/50 border border-emerald-500/40 rounded-xl p-4 text-xs text-emerald-100 leading-relaxed space-y-1.5">
              <strong className="text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Update Terbaru: Google Form 100% Tanpa Nomor Soal (Nama Siswa, Kelas, Ruang &amp; Semua Soal)
              </strong>
              <p>
                Penomoran otomatis dari <code className="text-amber-300 font-mono">Code.gs</code> dan awalan angka manual (<code className="text-amber-300 font-mono">1. Nama Siswa</code>, <code className="text-amber-300 font-mono">2. Kelas</code>, dst.) telah dihapus penuh agar tampilan identik dengan Google Form asli.
              </p>
              <p className="text-amber-200 font-medium">
                Penting saat memasang di Apps Script: tempelkan kode terbaru untuk <strong>Index.html</strong> DAN <strong>Code.gs</strong>, simpan, lalu wajib klik <strong>Deploy &gt; Kelola Deployment &gt; Edit &gt; Versi Baru &gt; Terapkan</strong> agar link <code className="font-mono">/exec</code> langsung berubah!
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-800 p-4 rounded-xl border border-slate-700">
              <div>
                <h3 className="font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-400" />
                  File: Index.html (Siap Copy ke Google Apps Script)
                </h3>
                <p className="text-xs text-slate-400">
                  Total {indexHtml ? indexHtml.split('\n').length : 0} baris kode &bull; Antarmuka ujian siswa gaya Google Form asli tanpa nomor soal
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => copyToClipboard(indexHtml, 'index_html')}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  {copiedType === 'index_html' ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  {copiedType === 'index_html' ? 'Tersalin ke Clipboard!' : 'Salin Semua Kode Index.html'}
                </button>
                <button
                  onClick={() => copyToClipboard(codeGs, 'code_gs')}
                  className="bg-purple-600 hover:bg-purple-500 text-white px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  {copiedType === 'code_gs' ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  {copiedType === 'code_gs' ? 'Code.gs Disalin!' : 'Salin Code.gs Juga'}
                </button>
                <button
                  onClick={() => downloadFile('Index.html', indexHtml)}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Unduh file Index.html"
                >
                  <Download className="w-4 h-4" />
                  Unduh
                </button>
                <a
                  href="/Index.html"
                  target="_blank"
                  rel="noreferrer"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                  title="Buka file mentah Index.html di tab baru untuk Ctrl+A & Ctrl+C"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  Buka Tab Baru
                </a>
              </div>
            </div>

            {/* Code Box */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden font-mono text-xs">
              <div className="bg-slate-900/80 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-slate-400 text-[11px]">
                <span>HTML / React / Google Apps Script Template (Index.html)</span>
                <span>UTF-8 &bull; Klik textarea lalu Ctrl+A &rarr; Ctrl+C atau pakai tombol Salin</span>
              </div>
              <textarea
                readOnly
                value={indexHtml || 'Memuat kode Index.html...'}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full h-[600px] p-4 bg-slate-950 text-slate-300 font-mono text-xs leading-relaxed outline-none resize-y selection:bg-indigo-800"
                spellCheck={false}
              />
            </div>
          </div>
        )}

        {/* TAB: KODE Proktor.html */}
        {activeTab === 'proktor_html' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-800 p-4 rounded-xl border border-slate-700">
              <div>
                <h3 className="font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-400" />
                  File: Proktor.html (Panel Proktor CBT)
                </h3>
                <p className="text-xs text-slate-400">
                  Total {proktorHtml.split('\n').length} baris kode &bull; Panel pengawas / proktor ujian CBT
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyToClipboard(proktorHtml, 'proktor_html')}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
                >
                  {copiedType === 'proktor_html' ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  {copiedType === 'proktor_html' ? 'Tersalin ke Clipboard!' : 'Salin Semua Kode Proktor.html'}
                </button>
                <button
                  onClick={() => downloadFile('Proktor.html', proktorHtml)}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                  title="Unduh file Proktor.html"
                >
                  <Download className="w-4 h-4" />
                  Unduh
                </button>
              </div>
            </div>

            {/* Code Box */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden font-mono text-xs">
              <div className="bg-slate-900/80 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-slate-400 text-[11px]">
                <span>HTML / React / Google Apps Script Template (.html)</span>
                <span>UTF-8 &bull; Ready for copy-paste</span>
              </div>
              <pre className="p-4 overflow-x-auto max-h-[600px] overflow-y-auto text-slate-300 leading-relaxed custom-scrollbar selection:bg-indigo-800">
                {proktorHtml || 'Memuat kode Proktor.html...'}
              </pre>
            </div>
          </div>
        )}
        {/* TAB: KODE appsscript.json */}
        {activeTab === 'appsscript_json' && (
          <div className="space-y-4">
            <div className="bg-amber-950/50 border border-amber-500/40 rounded-xl p-4 text-xs text-amber-100 leading-relaxed">
              <strong className="text-amber-300 flex items-center gap-1.5 mb-1">
                <ShieldAlert className="w-4 h-4" />
                Mengapa file appsscript.json ini PENTING agar Google Form bisa dibuka?
              </strong>
              Proyek Apps Script Anda sebelumnya membatasi <code className="text-amber-300 font-mono">oauthScopes</code> hanya untuk Spreadsheet, Mail, dan Drive (tanpa izin <code className="text-emerald-300 font-mono">forms</code> dan <code className="text-emerald-300 font-mono">script.external_request</code>).
              Di Apps Script, buka ikon <strong>Gerigi (Setelan Proyek) &gt; centang &quot;Tampilkan file manifes appsscript.json di editor&quot;</strong>, lalu ganti seluruh isinya dengan kode di bawah, simpan, dan lakukan <strong>Otorisasi ulang + Deploy Versi Baru</strong>.
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-800 p-4 rounded-xl border border-slate-700">
              <div>
                <h3 className="font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-amber-400" />
                  File: appsscript.json (Manifest &amp; Izin OAuth Google Forms/Drive)
                </h3>
                <p className="text-xs text-slate-400">
                  Mencakup izin lengkap: Forms, Drive, Docs, Spreadsheets, Mail, dan UrlFetchApp
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyToClipboard(appsScriptJson, 'appsscript_json')}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
                >
                  {copiedType === 'appsscript_json' ? <Check className="w-4 h-4 text-emerald-800" /> : <Copy className="w-4 h-4" />}
                  {copiedType === 'appsscript_json' ? 'Tersalin ke Clipboard!' : 'Salin appsscript.json'}
                </button>
                <button
                  onClick={() => downloadFile('appsscript.json', appsScriptJson)}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-200 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
                >
                  <Download className="w-4 h-4" />
                  Unduh
                </button>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden font-mono text-xs">
              <div className="bg-slate-900/80 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-slate-400 text-[11px]">
                <span>Google Apps Script Manifest (appsscript.json)</span>
                <span>UTF-8 &bull; Ready for copy-paste</span>
              </div>
              <pre className="p-4 overflow-x-auto max-h-[600px] overflow-y-auto text-amber-200 leading-relaxed custom-scrollbar selection:bg-amber-800">
                {appsScriptJson || 'Memuat appsscript.json...'}
              </pre>
            </div>
          </div>
        )}

        {/* TAB: APK ANDROID LOCKDOWN MODE */}
        {activeTab === 'android_apk' && (
          <div className="space-y-6">
            {/* KARTU UTAMA: FILE .APK LANGSUNG SIAP INSTALL */}
            <div className="bg-gradient-to-br from-emerald-950/80 via-slate-900 to-indigo-950/80 border-2 border-emerald-500/60 rounded-2xl p-6 space-y-5 shadow-2xl">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/30">
                    <Smartphone className="w-7 h-7" />
                  </div>
                  <div>
                    <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full mb-1.5">
                      FILE APK SIAP INSTALL v1.1 &bull; SCAN QR + ANTI FALSE-ALARM
                    </div>
                    <h2 className="text-xl font-extrabold text-white">
                      CBT-Exambro-Lockdown.apk (Khusus Android 7.0 &ndash; 15+)
                    </h2>
                    <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                      File aplikasi Android (<code className="text-emerald-300 font-bold">.apk</code>) v1.1 sudah diperbarui dengan menu <strong className="text-amber-300">Scan Barcode/QR Link Script</strong> saat awal dibuka, <strong className="text-emerald-300">bebas alarm palsu</strong> saat siswa membuka dropdown kelas / konfirmasi kirim jawaban, dan <strong className="text-emerald-300">sirine otomatis mati</strong> setelah ujian selesai dikirim.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadReadyApk}
                    disabled={isApkDownloading}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-6 py-3.5 rounded-xl text-sm font-extrabold flex items-center gap-2.5 shadow-xl shadow-emerald-500/30 transition-all cursor-pointer disabled:opacity-60"
                  >
                    <Download className="w-5 h-5" />
                    {isApkDownloading ? 'Menyiapkan File APK...' : `Unduh Langsung ${APK_FILENAME}`}
                  </button>

                  <div className="flex flex-wrap items-center gap-3 text-[11px]">
                    <a
                      href={`data:application/vnd.android.package-archive;base64,${APK_BASE64}`}
                      download={APK_FILENAME}
                      className="text-emerald-300 hover:text-emerald-200 underline font-semibold"
                    >
                      Link Alternatif Simpan Langsung ({(APK_BYTE_SIZE / 1024).toFixed(1)} KB .apk)
                    </a>
                    <span className="text-slate-600">&bull;</span>
                    <a
                      href="/api/download-apk"
                      download={APK_FILENAME}
                      className="text-indigo-300 hover:text-indigo-200 underline font-semibold"
                    >
                      Unduh via Server Attachment
                    </a>
                  </div>

                  {apkDownloadStatus && (
                    <div className="bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      {apkDownloadStatus}
                    </div>
                  )}
                </div>
              </div>

              {/* Info Detail APK & Panduan Install Cepat */}
              <div className="grid md:grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-950/70 border border-emerald-500/30 rounded-xl p-4 space-y-2">
                  <div className="font-bold text-emerald-300 uppercase tracking-wider text-[11px]">
                    Spesifikasi File APK v1.1
                  </div>
                  <div className="grid grid-cols-2 gap-y-1.5 text-slate-300">
                    <span className="text-slate-400">Nama File:</span>
                    <span className="font-mono font-bold text-white">CBT-Exambro-Lockdown.apk</span>
                    <span className="text-slate-400">Package ID:</span>
                    <span className="font-mono text-emerald-300">id.sch.cbt.exambro</span>
                    <span className="text-slate-400">Kompatibilitas:</span>
                    <span className="text-white font-semibold">Android 7.0+ (SDK 24&ndash;34)</span>
                    <span className="text-slate-400">PIN Proktor Default:</span>
                    <span className="font-mono font-extrabold text-amber-300">202600</span>
                  </div>
                </div>

                <div className="bg-slate-950/70 border border-indigo-500/30 rounded-xl p-4 space-y-1.5">
                  <div className="font-bold text-indigo-300 uppercase tracking-wider text-[11px]">
                    Cara Pasang &amp; Jalankan di HP Siswa
                  </div>
                  <ol className="list-decimal pl-4 space-y-1 text-slate-300 leading-relaxed">
                    <li>Klik tombol <b>Unduh Langsung APK (.apk)</b> di atas lalu install <code className="text-emerald-300">CBT-Exambro-Lockdown.apk</code> di HP Android siswa (izinkan kamera untuk scan QR).</li>
                    <li>Saat pertama dibuka, pilih <b>Scan Barcode / QR Link Script</b> (scan QR dari kartu di bawah) atau tempel URL Web App Apps Script secara manual.</li>
                    <li>Saat siswa mengerjakan ujian, pilih dropdown kelas dan kirim jawaban tidak memicu alarm. Alarm hanya berbunyi jika siswa <b>mencoba keluar aplikasi / split screen / floating app</b>.</li>
                  </ol>
                </div>
              </div>

              {/* KARTU GENERATOR QR CODE / BARCODE UNTUK SCAN DI APK */}
              <div className="bg-slate-950/85 border border-amber-500/40 rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0">
                      <QrCode className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-amber-300">
                        Generator Barcode / QR Code Link Google Apps Script (Untuk Di-scan Siswa)
                      </h3>
                      <p className="text-xs text-slate-300 mt-0.5 max-w-2xl leading-relaxed">
                        Tempel URL Web App Google Apps Script Anda (<code className="text-amber-200">https://script.google.com/macros/s/.../exec</code>), lalu cetak atau tampilkan QR Code ini di proyektor agar siswa tinggal melakukan <strong>Scan Barcode</strong> saat membuka APK.
                      </p>
                    </div>
                  </div>
                  {qrDataUrl && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleDownloadQrPng}
                        className="bg-amber-400 hover:bg-amber-300 text-slate-950 px-4 py-2 rounded-lg text-xs font-extrabold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        Unduh QR Code (.png)
                      </button>
                      <a
                        href={`/api/download-qr?url=${encodeURIComponent((qrInputUrl || apkWebAppUrl).trim())}`}
                        download="QR-CBT-Apps-Script.png"
                        className="bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-400/40 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all"
                      >
                        <QrCode className="w-4 h-4" />
                        Link PNG Langsung
                      </a>
                    </div>
                  )}
                </div>

                <div className="grid md:grid-cols-[1fr_auto] gap-4 items-center">
                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold text-slate-300 uppercase">
                      Link Web App Google Apps Script (/exec)
                    </label>
                    <input
                      type="url"
                      value={qrInputUrl}
                      onChange={(e) => {
                        setQrInputUrl(e.target.value);
                        setApkWebAppUrl(e.target.value);
                      }}
                      placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                      className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                    />
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Tip: QR Code dibaca secara offline langsung oleh kamera di dalam <code className="text-emerald-300">CBT-Exambro-Lockdown.apk</code> tanpa perlu aplikasi scanner tambahan.
                    </p>
                    {qrError && (
                      <p className="text-[11px] text-rose-400 font-semibold">{qrError}</p>
                    )}
                  </div>

                  <div className="flex flex-col items-center justify-center bg-white rounded-xl p-3 min-w-[176px] min-h-[176px] border-2 border-amber-400/50 shadow-lg">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="QR Code Link Google Apps Script CBT"
                        className="w-40 h-40 object-contain"
                      />
                    ) : (
                      <div className="text-center px-3 py-6 text-[11px] font-semibold text-slate-500 max-w-[150px]">
                        Tempel URL Web App Apps Script untuk memunculkan QR Code di sini
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-900/80 border border-rose-500/30 rounded-xl p-3.5">
                  <div className="font-bold text-rose-300 flex items-center gap-1.5 mb-1">
                    <Volume2 className="w-4 h-4" /> Anti Keluar &amp; Split-Screen
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    Alarm sirine (<code className="text-slate-300">STREAM_ALARM</code>) hanya berbunyi saat siswa mencoba keluar aplikasi, tekan Home/Recent, atau Split Screen &mdash; tidak lagi bunyi saat memilih dropdown kelas.
                  </p>
                </div>
                <div className="bg-slate-900/80 border border-rose-500/30 rounded-xl p-3.5">
                  <div className="font-bold text-amber-300 flex items-center gap-1.5 mb-1">
                    <Lock className="w-4 h-4" /> Blokir Floating &amp; Otomatis Selesai
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    <code className="text-slate-300">supportsPictureInPicture=false</code> + <code className="text-slate-300">HIDE_OVERLAY_WINDOWS</code> memblokir jendela mengambang, dan otomatis nonaktif setelah siswa kirim jawaban.
                  </p>
                </div>
                <div className="bg-slate-900/80 border border-rose-500/30 rounded-xl p-3.5">
                  <div className="font-bold text-indigo-300 flex items-center gap-1.5 mb-1">
                    <ShieldAlert className="w-4 h-4" /> Blokir Notifikasi &amp; Pinning
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    Layar dikunci dengan <em>Screen Pinning</em> (<code className="text-slate-300">startLockTask</code>), bilah status disembunyikan, dan mode DND meredam notifikasi.
                  </p>
                </div>
                <div className="bg-slate-900/80 border border-rose-500/30 rounded-xl p-3.5">
                  <div className="font-bold text-emerald-300 flex items-center gap-1.5 mb-1">
                    <Monitor className="w-4 h-4" /> Anti Screenshot (FLAG_SECURE)
                  </div>
                  <p className="text-slate-400 leading-relaxed">
                    Layar dilindungi <code className="text-slate-300">FLAG_SECURE</code> di level sistem Android sehingga screenshot, rekam layar, dan pratinjau recent apps diblokir total.
                  </p>
                </div>
              </div>
            </div>

            {/* OPSI KUSTOMISASI LANJUTAN: SOURCE CODE PROJECT (.ZIP) */}
            <div className="bg-slate-900/90 border border-rose-500/30 rounded-2xl p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-rose-600/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0">
                    <FileCode2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                      Opsi Lanjutan: Project Source Code Android (.zip) &bull; Kustom Nama / URL Permanen
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5 max-w-2xl leading-relaxed">
                      Jika sekolah ingin mengubah Nama Aplikasi, Package ID, PIN Proktor, atau menanam URL Web App secara permanen di dalam APK (<code className="text-amber-300">MainActivity.kt</code> + Gradle + GitHub Actions).
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleDownloadAndroidZip}
                  disabled={isZipGenerating}
                  className="bg-rose-600 hover:bg-rose-500 text-white px-5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-rose-500/20 transition-all disabled:opacity-60 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  {isZipGenerating ? 'Menyiapkan ZIP...' : 'Unduh Source Project (.zip)'}
                </button>
              </div>

              {/* Konfigurasi Sebelum Download ZIP */}
              <div className="bg-slate-950/70 border border-slate-700/80 rounded-xl p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    URL Web App Google Apps Script (Opsional / Bisa Diisi di HP)
                  </label>
                  <input
                    type="text"
                    value={apkWebAppUrl}
                    onChange={(e) => setApkWebAppUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Nama Aplikasi Android
                  </label>
                  <input
                    type="text"
                    value={apkAppName}
                    onChange={(e) => setApkAppName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-bold focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                      Package ID
                    </label>
                    <input
                      type="text"
                      value={apkPackageName}
                      onChange={(e) => setApkPackageName(e.target.value)}
                      className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                      PIN Proktor
                    </label>
                    <input
                      type="text"
                      value={apkProctorPin}
                      onChange={(e) => setApkProctorPin(e.target.value)}
                      className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-amber-300 font-mono font-bold focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>
              </div>

              {/* Cara Kompilasi Jadi File .APK */}
              <div className="grid md:grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-900/80 border border-emerald-500/30 rounded-xl p-4 space-y-1.5">
                  <h4 className="font-bold text-emerald-400">Cara 1 (Tanpa Android Studio): Auto-Build .APK via GitHub Actions</h4>
                  <ol className="list-decimal pl-4 space-y-1 text-slate-300 leading-relaxed">
                    <li>Klik <b>Unduh Project APK Android (.zip)</b> lalu ekstrak foldernya.</li>
                    <li>Buat repository baru di <b>GitHub</b> dan unggah seluruh isi folder tersebut (termasuk folder <code className="text-amber-300">.github</code>).</li>
                    <li>Buka tab <b>Actions</b> di GitHub &gt; workflow <i>Build CBT Exambro Android APK</i> otomatis berjalan &plusmn;2 menit.</li>
                    <li>Unduh artifact <b>CBT-Exambro-Lockdown-APK</b> berisi file <code className="text-emerald-300">app-debug.apk</code> siap install ke HP siswa!</li>
                  </ol>
                </div>
                <div className="bg-slate-900/80 border border-indigo-500/30 rounded-xl p-4 space-y-1.5">
                  <h4 className="font-bold text-indigo-300">Cara 2: Build Lokal via Android Studio / Gradle</h4>
                  <ol className="list-decimal pl-4 space-y-1 text-slate-300 leading-relaxed">
                    <li>Ekstrak file ZIP lalu buka foldernya di <b>Android Studio</b>.</li>
                    <li>Tunggu sinkronisasi Gradle selesai (SDK 34 / JDK 17).</li>
                    <li>Klik menu <b>Build &gt; Build Bundle(s) / APK(s) &gt; Build APK(s)</b>.</li>
                    <li>Install file APK ke HP Android siswa &amp; aktifkan juga pembaruan <code className="text-amber-300">Index.html</code> dan <code className="text-amber-300">Code.gs</code> di Apps Script.</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Viewer Kode Source APK */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5 text-xs font-bold">
                  {[
                    { id: 'main_kt', label: 'MainActivity.kt' },
                    { id: 'manifest', label: 'AndroidManifest.xml' },
                    { id: 'gradle', label: 'app/build.gradle.kts' },
                    { id: 'workflow', label: 'build-apk.yml (GitHub Actions)' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setApkPreviewFile(tab.id as any)}
                      className={`px-3 py-1.5 rounded-lg transition-all ${
                        apkPreviewFile === tab.id ? 'bg-rose-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => {
                    const content =
                      apkPreviewFile === 'main_kt'
                        ? androidProjectFiles[mainActivityKey]
                        : apkPreviewFile === 'manifest'
                        ? androidProjectFiles['app/src/main/AndroidManifest.xml']
                        : apkPreviewFile === 'gradle'
                        ? androidProjectFiles['app/build.gradle.kts']
                        : androidProjectFiles['.github/workflows/build-apk.yml'];
                    copyToClipboard(content || '', 'apk_' + apkPreviewFile);
                  }}
                  className="bg-slate-700 hover:bg-slate-600 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5"
                >
                  {copiedType === 'apk_' + apkPreviewFile ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedType === 'apk_' + apkPreviewFile ? 'Disalin!' : 'Salin File Ini'}
                </button>
              </div>
              <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-x-auto max-h-[480px] overflow-y-auto text-xs text-slate-200 font-mono leading-relaxed custom-scrollbar">
                {apkPreviewFile === 'main_kt'
                  ? androidProjectFiles[mainActivityKey]
                  : apkPreviewFile === 'manifest'
                  ? androidProjectFiles['app/src/main/AndroidManifest.xml']
                  : apkPreviewFile === 'gradle'
                  ? androidProjectFiles['app/build.gradle.kts']
                  : androidProjectFiles['.github/workflows/build-apk.yml']}
              </pre>
            </div>
          </div>
        )}

        {activeTab === 'tester' && (
          <div className="space-y-6">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Play className="w-5 h-5 text-emerald-400" />
                    Simulasi &amp; Uji Coba Parser 40 Soal (Live Test)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Ketik atau tempel teks soal di bawah untuk menguji apakah algoritma baru membaca seluruh 40 soal secara tuntas!
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    Hasil Terbaca: {parsedResults.length} / 40 Soal
                  </div>
                  <button
                    onClick={() => {
                      setTestInput(generateSample40Questions());
                      runParserTest(generateSample40Questions());
                    }}
                    className="bg-slate-700 hover:bg-slate-600 text-xs px-3 py-1.5 rounded-lg text-slate-200 transition-all"
                  >
                    Muat Contoh 40 Soal Lengkap
                  </button>
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-6">
                {/* Input Textarea */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-2">
                    Format Input Teks / Word (Contoh Soal 1 s/d 40):
                  </label>
                  <textarea
                    value={testInput}
                    onChange={(e) => {
                      setTestInput(e.target.value);
                      runParserTest(e.target.value);
                    }}
                    rows={16}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 custom-scrollbar leading-relaxed"
                    placeholder="Tempel 40 soal di sini..."
                  />
                  <div className="mt-2 text-[11px] text-slate-400">
                    &bull; Parser mendukung penomoran angka ("1.", "2."), pilihan A-E, dan penanda kunci jawaban.
                  </div>
                </div>

                {/* Output Preview */}
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-slate-300">
                      Tabel Hasil Ekstraksi yang Siap Disimpan ke Spreadsheet:
                    </label>
                    <span className="text-xs text-emerald-400 font-semibold">
                      Status: {parsedResults.length === 40 ? 'Sempurna (40/40)' : `${parsedResults.length} soal terdeteksi`}
                    </span>
                  </div>

                  <div className="flex-1 bg-slate-950 border border-slate-700 rounded-xl overflow-hidden flex flex-col max-h-[380px]">
                    <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar">
                      <table className="w-full text-left text-xs text-slate-300 border-collapse">
                        <thead className="bg-slate-900 sticky top-0 text-[11px] text-slate-400 font-semibold border-b border-slate-800">
                          <tr>
                            <th className="p-2.5 w-12 text-center">No</th>
                            <th className="p-2.5">Isi Pertanyaan Soal</th>
                            <th className="p-2.5 w-24">Pilihan A - E</th>
                            <th className="p-2.5 w-16 text-center">Kunci</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/80">
                          {parsedResults.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-900/50 transition-colors">
                              <td className="p-2.5 text-center font-bold text-amber-400">
                                {item.no}
                              </td>
                              <td className="p-2.5 max-w-xs truncate text-slate-200" title={item.soal}>
                                {item.soal}
                              </td>
                              <td className="p-2.5 text-[11px] text-slate-400">
                                A: {item.a || '-'} | B: {item.b || '-'}
                              </td>
                              <td className="p-2.5 text-center font-bold text-emerald-400">
                                {item.kunci}
                              </td>
                            </tr>
                          ))}
                          {parsedResults.length === 0 && (
                            <tr>
                              <td colSpan={4} className="p-8 text-center text-slate-500">
                                Tidak ada soal yang terdeteksi dari input teks.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: PRATINJAU HALAMAN CBT */}
        {activeTab === 'preview' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-800 p-4 rounded-xl border border-slate-700">
              <div>
                <h3 className="font-bold text-white flex items-center gap-2">
                  <Monitor className="w-5 h-5 text-indigo-400" />
                  Pratinjau Antarmuka Aplikasi CBT (Tanpa Mengubah Tampilan Apapun)
                </h3>
                <p className="text-xs text-slate-400">
                  Memastikan antarmuka Siswa, Proktor, dan Admin tetap 100% otentik dan persis seperti semula.
                </p>
              </div>

              <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-lg border border-slate-700 text-xs">
                <button
                  onClick={() => setPreviewMenu('admin')}
                  className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                    previewMenu === 'admin' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Admin Panel
                </button>
                <button
                  onClick={() => setPreviewMenu('proktor')}
                  className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                    previewMenu === 'proktor' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Proktor Panel
                </button>
                <button
                  onClick={() => setPreviewMenu('siswa')}
                  className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                    previewMenu === 'siswa' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Siswa (Index)
                </button>
              </div>
            </div>

            {/* Iframe Frame */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl h-[700px] flex flex-col">
              <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
                  <span className="ml-2 font-mono text-[11px] text-slate-300">
                    {previewMenu === 'admin'
                      ? 'https://script.google.com/macros/s/.../exec?p=admin'
                      : previewMenu === 'proktor'
                      ? 'https://script.google.com/macros/s/.../exec?p=proktor'
                      : 'https://script.google.com/macros/s/.../exec'}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500">Live Preview Container</span>
              </div>
              <iframe
                src={
                  previewMenu === 'admin'
                    ? '/Admin.html'
                    : previewMenu === 'proktor'
                    ? '/Proktor.html'
                    : '/Index.html'
                }
                title="CBT Preview"
                className="w-full flex-1 border-0 bg-white"
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Helper to generate 40 mock questions to verify parsing
function generateSample40Questions(): string {
  let text = '';
  for (let i = 1; i <= 40; i++) {
    text += `${i}. Ini adalah soal latihan ujian nomor ${i}. Berapakah hasil dari ${i} + ${i * 2}?\n`;
    text += `A. ${i * 3}\n`;
    text += `B. ${i * 3 + 1}\n`;
    text += `C. ${i * 3 + 2}\n`;
    text += `D. ${i * 3 + 3}\n`;
    text += `E. ${i * 3 + 4}\n`;
    text += `Kunci: A\n\n`;
  }
  return text.trim();
}
