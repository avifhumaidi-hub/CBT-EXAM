import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  app.use(express.json({ limit: '2mb' }));

  const resolvePublicFile = (filename: string): string | null => {
    const candidates = [
      path.resolve(__dirname, 'public', filename),
      path.resolve(__dirname, 'dist', filename),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return null;
  };

  const extractFbPublicLoadDataServer = (html: string): any[] | null => {
    if (!html) return null;
    const markerMatch = html.match(/(?:var\s+)?FB_PUBLIC_LOAD_DATA_\s*=\s*/);
    if (!markerMatch || markerMatch.index === undefined) return null;
    const startSearch = markerMatch.index + markerMatch[0].length;
    const bracketStart = html.indexOf('[', startSearch);
    if (bracketStart === -1) return null;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = bracketStart; i < html.length; i++) {
      const ch = html[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === '[') depth++;
      else if (ch === ']') {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(html.slice(bracketStart, i + 1));
          } catch {
            return null;
          }
        }
      }
    }
    return null;
  };

  const setGFormCors = (res: Response) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  };

  app.options('/api/parse-gform', (_req: Request, res: Response) => {
    setGFormCors(res);
    res.status(204).end();
  });

  app.options('/api/submit-gform', (_req: Request, res: Response) => {
    setGFormCors(res);
    res.status(204).end();
  });

  app.post('/api/parse-gform', async (req: Request, res: Response) => {
    setGFormCors(res);
    try {
      const cleanInput = String(req.body?.urlOrId || '').trim();
      if (!cleanInput) {
        res.status(400).json({ success: false, message: 'URL atau ID Google Form wajib diisi.' });
        return;
      }
      const pubMatch = cleanInput.match(/\/forms\/(?:u\/\d+\/)?d\/e\/([a-zA-Z0-9_-]{15,})/i);
      const editMatch = cleanInput.match(/\/forms\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]{15,})/i);
      const idParamMatch = cleanInput.match(/[?&]id=([a-zA-Z0-9_-]{15,})/i);
      const isPublishedId = Boolean(pubMatch) || /^1FAIpQL[a-zA-Z0-9_-]+$/.test(cleanInput);
      const formId = pubMatch?.[1] || editMatch?.[1] || idParamMatch?.[1] || cleanInput;

      const candidateUrls: string[] = [];
      if (!/^https?:\/\//i.test(cleanInput)) {
        if (isPublishedId) candidateUrls.push(`https://docs.google.com/forms/d/e/${formId}/viewform`);
        else {
          candidateUrls.push(`https://docs.google.com/forms/d/${formId}/viewform`);
          candidateUrls.push(`https://docs.google.com/forms/d/e/${formId}/viewform`);
        }
      } else if (/\/edit/i.test(cleanInput)) {
        candidateUrls.push(cleanInput.replace(/\/edit.*$/i, '/viewform'));
      } else if (/\/formResponse/i.test(cleanInput)) {
        candidateUrls.push(cleanInput.replace(/\/formResponse.*$/i, '/viewform'));
      } else {
        candidateUrls.push(cleanInput);
      }

      let viewUrl = candidateUrls[0];
      let fbData: any[] | null = null;
      let html = '';

      for (const testUrl of candidateUrls) {
        try {
          const resp = await fetch(testUrl, {
            redirect: 'follow',
            headers: {
              'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8',
              'User-Agent': 'Mozilla/5.0 (compatible; CBTBot/1.0)',
            },
          });
          html = await resp.text();
          fbData = extractFbPublicLoadDataServer(html);
          if (fbData) {
            viewUrl = resp.url || testUrl;
            break;
          }
        } catch {
          // continue trying candidates
        }
      }

      if (!fbData) {
        const isLocked = /accounts\.google\.com|ServiceLogin|You need permission|Memerlukan izin/i.test(html);
        res.json({
          success: false,
          message: isLocked
            ? 'Google Form terkunci akses login organisasi. Buka akses "Siapa saja yang memiliki link" atau nonaktifkan pembatasan responden di Setelan Google Form.'
            : 'Gagal membaca Google Form. Pastikan link form aktif dan dapat diakses publik.',
        });
        return;
      }

      const formMetaBlock = fbData[1] || [];
      const formTitle = String(formMetaBlock[8] || fbData[3] || 'Ujian Google Form');
      const formDescription = String(formMetaBlock[0] || '');
      const rawItems = Array.isArray(formMetaBlock[1]) ? formMetaBlock[1] : [];
      const actionMatch = html.match(/action="(https:\/\/docs\.google\.com\/forms\/[^"]*?\/formResponse)"/i);
      const fbzxMatch = html.match(/name="fbzx"\s+value="([^"]+)"/i);
      const fbzx = fbzxMatch ? fbzxMatch[1] : '';
      const responseUrl = actionMatch
        ? actionMatch[1]
        : viewUrl.split('?')[0].replace(/\/(?:viewform|edit)?(?:\/)?$/i, '/formResponse');
      const stripNum = (str: string) => {
        if (str === undefined || str === null) return '';
        let s = String(str).replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\u00A0/g, ' ').trim();
        let prev = '';
        while (s !== prev) {
          prev = s;
          s = s
            .replace(/^\s*(?:(?:No\.?|Nomor|Nomer|Soal|Pertanyaan)\s*(?:No\.?|Nomor|#)?\s*\d{1,3}\s*[.:)\-–—]?\s+)/i, '')
            .replace(/^\s*[\(\[]\s*\d{1,3}\s*[\)\]]\s*[.:)\-–—]?\s*/, '')
            .replace(/^\s*\d{1,3}(?:\.\d{1,2})?\s*[.):\-–—]\s+(?=\S)/, '')
            .replace(/^\s*\d{1,3}[.)](?=[^\d\s.,])/, '')
            .replace(/^\s*\d{1,3}\s+(?=(?:Nama|Kelas|NIS|NISN|No\.?|Nomor|Nomer|Absen|Ruang|Sesi|Token|Mapel|Mata\s+Pelajaran|Tanggal|Hari|Sekolah|Asal|Identitas|Biodata|Pilih|Isilah|Bacalah|Perhatikan|Tentukan|Berapakah|Mengapa|Apa|Siapa|Dimana|Kapan|Bagaimana|Jelaskan)\b)/i, '')
            .trim();
        }
        return s || String(str).trim();
      };

      const formattedItems: any[] = [];
      const sections: any[] = [{ index: 0, title: formTitle, description: formDescription, ...(fbzx ? { fbzx } : {}) }];
      let currentSectionIdx = 0;

      for (const it of rawItems) {
        if (!Array.isArray(it)) continue;
        const itemId = String(it[0] || '');
        const rawTitle = String(it[1] || '').trim();
        const title = stripNum(rawTitle) || rawTitle;
        const helpText = String(it[2] || '').trim();
        const typeCode = it[3];
        const subData = it[4] || [];

        if (typeCode === 8) {
          currentSectionIdx++;
          sections.push({
            index: currentSectionIdx,
            title: title || `Bagian ${currentSectionIdx + 1}`,
            description: helpText,
          });
          continue;
        }
        if (typeCode === 6) {
          formattedItems.push({
            id: formattedItems.length,
            itemId,
            no: '',
            text: title,
            helpText,
            tipe: 'SECTION_HEADER',
            sectionIndex: currentSectionIdx,
            opsi: [],
          });
          continue;
        }
        if (typeCode === 11 || typeCode === 12) {
          formattedItems.push({
            id: formattedItems.length,
            itemId,
            no: '',
            text: title,
            helpText,
            tipe: typeCode === 11 ? 'IMAGE' : 'VIDEO',
            sectionIndex: currentSectionIdx,
            opsi: [],
          });
          continue;
        }
        if (typeCode === 7 && Array.isArray(subData) && subData.length > 0) {
          const isCheckboxGrid = subData[0][11] && subData[0][11][0] === 1;
          const rows: string[] = [];
          const rowEntryIds: string[] = [];
          let cols: string[] = [];
          subData.forEach((rowDef: any, rIdx: number) => {
            rowEntryIds.push(String(rowDef[0] || ''));
            rows.push(rowDef[3]?.[0] ? String(rowDef[3][0]) : `Baris ${rIdx + 1}`);
            if (rIdx === 0 && Array.isArray(rowDef[1])) {
              cols = rowDef[1].map((c: any) => (c[0] !== undefined && c[0] !== null ? String(c[0]) : ''));
            }
          });
          const isBS =
            !isCheckboxGrid &&
            cols.length === 2 &&
            cols.some((c) => /benar|true/i.test(c)) &&
            cols.some((c) => /salah|false/i.test(c));
          formattedItems.push({
            id: formattedItems.length,
            itemId,
            entryIds: rowEntryIds,
            no: '',
            text: title,
            helpText,
            opsi: rows,
            gridRows: rows,
            gridCols: cols,
            kunci: '',
            tipe: isCheckboxGrid ? 'CHECKBOX_GRID' : isBS ? 'BENAR_SALAH' : 'GRID',
            isRequired: Boolean(subData[0][2]),
            sectionIndex: currentSectionIdx,
            kesulitan: 'SEDANG',
          });
          continue;
        }

        const mainEntry = Array.isArray(subData[0]) ? subData[0] : [];
        const entryId = mainEntry[0] ? String(mainEntry[0]) : '';
        const rawChoices = Array.isArray(mainEntry[1]) ? mainEntry[1] : [];
        const opsi = rawChoices
          .map((c: any) => (c[0] !== undefined && c[0] !== null ? String(c[0]) : ''))
          .filter((s: string) => s !== '');
        const isReq = Boolean(mainEntry[2]);

        let tipe = 'ISIAN';
        if (typeCode === 0) tipe = 'ISIAN';
        else if (typeCode === 1) tipe = 'ESAI';
        else if (typeCode === 2) tipe = 'PG';
        else if (typeCode === 3) tipe = 'DROPDOWN';
        else if (typeCode === 4) tipe = 'PG_KOMPLEKS';
        else if (typeCode === 5 || typeCode === 18) tipe = 'SCALE';
        else if (typeCode === 9) tipe = 'DATE';
        else if (typeCode === 10) tipe = 'TIME';

        const itemObj: any = {
          id: formattedItems.length,
          itemId,
          entryId,
          no: '',
          text: title,
          helpText,
          opsi,
          kunci: '',
          tipe,
          isRequired: isReq,
          sectionIndex: currentSectionIdx,
          kesulitan: 'SEDANG',
        };
        if (typeCode === 5 || typeCode === 18) {
          const parsedMin = opsi.length > 0 ? parseInt(opsi[0], 10) : NaN;
          const parsedMax = opsi.length > 0 ? parseInt(opsi[opsi.length - 1], 10) : NaN;
          itemObj.scaleMin = !isNaN(parsedMin) ? parsedMin : 1;
          itemObj.scaleMax = !isNaN(parsedMax) ? parsedMax : (opsi.length || 5);
          itemObj.scaleLeftLabel = mainEntry[3]?.[0] ? String(mainEntry[3][0]) : '';
          itemObj.scaleRightLabel = mainEntry[3]?.[1] ? String(mainEntry[3][1]) : '';
        }
        formattedItems.push(itemObj);
      }

      const itemCount = formattedItems.filter(
        (it) => !['SECTION_HEADER', 'IMAGE', 'VIDEO'].includes(it.tipe)
      ).length;

      res.json({
        success: true,
        source: 'GOOGLE_FORM',
        submitMode: 'HTTP_POST',
        formId,
        formUrl: viewUrl,
        formResponseUrl: responseUrl,
        fbzx,
        formTitle,
        formDescription,
        itemCount,
        sections,
        items: formattedItems,
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        message: 'Gagal mem-parsing Google Form: ' + (err instanceof Error ? err.message : String(err)),
      });
    }
  });

  app.post('/api/submit-gform', async (req: Request, res: Response) => {
    setGFormCors(res);
    try {
      const formResponseUrl = String(req.body?.formResponseUrl || '').trim();
      if (!/^https:\/\/docs\.google\.com\/forms\/(?:u\/\d+\/)?d\/(?:e\/)?[a-zA-Z0-9_-]{15,}\/formResponse$/i.test(formResponseUrl)) {
        res.status(400).json({ success: false, message: 'URL formResponse Google Form tidak valid.' });
        return;
      }
      const httpEntries = req.body?.httpEntries || {};
      const sectionCount = parseInt(req.body?.sectionCount || 1, 10) || 1;
      const fbzx = String(req.body?.fbzx || '').trim();

      const params = new URLSearchParams();
      Object.entries(httpEntries).forEach(([k, v]) => {
        if (!/^entry\.\d+/.test(k)) return;
        if (Array.isArray(v)) {
          v.forEach((sub) => {
            if (sub !== undefined && sub !== null && String(sub) !== '') params.append(k, String(sub));
          });
        } else if (v !== undefined && v !== null && String(v) !== '') {
          params.append(k, String(v));
        }
      });

      if (sectionCount > 1) {
        const pages = Array.from({ length: sectionCount }, (_, idx) => idx).join(',');
        params.append('fvv', '1');
        params.append('pageHistory', pages);
      } else {
        params.append('fvv', '1');
      }
      if (fbzx) params.append('fbzx', fbzx);

      const postResp = await fetch(formResponseUrl, {
        method: 'POST',
        redirect: 'follow',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8',
          'User-Agent': 'Mozilla/5.0 (compatible; CBTBot/1.0)',
        },
        body: params.toString(),
      });

      const respText = await postResp.text();
      const loginRequired = /accounts\.google\.com|ServiceLogin/i.test(postResp.url || '');
      const ok = postResp.ok && !loginRequired;

      res.json({
        success: ok,
        gformSubmitted: ok,
        statusCode: postResp.status,
        note: loginRequired
          ? 'Google Form membatasi 1 tanggapan / wajib login Google'
          : ok
          ? 'Terkirim ke Google Form'
          : `HTTP ${postResp.status} (${respText.slice(0, 80)})`,
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        gformSubmitted: false,
        message: 'Gagal mengirim ke Google Form: ' + (err instanceof Error ? err.message : String(err)),
      });
    }
  });

  const sendApkAttachment = (_req: Request, res: Response) => {
    const apkPath = resolvePublicFile('CBT-Exambro-Lockdown.apk');
    if (!apkPath) {
      res.status(404).json({ error: 'File APK tidak ditemukan.' });
      return;
    }

    const stat = fs.statSync(apkPath);
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', 'attachment; filename="CBT-Exambro-Lockdown.apk"');
    res.setHeader('Content-Length', String(stat.size));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    fs.createReadStream(apkPath).pipe(res);
  };

  const sendGasZipAttachment = async (_req: Request, res: Response) => {
    try {
      const filesToBundle = [
        'Code.gs',
        'Index.html',
        'Admin.html',
        'Proktor.html',
        'appsscript.json',
      ];
      const zip = new JSZip();
      for (const filename of filesToBundle) {
        const filePath = resolvePublicFile(filename);
        if (!filePath) {
          res.status(404).json({ error: `File ${filename} tidak ditemukan.` });
          return;
        }
        zip.file(filename, fs.readFileSync(filePath));
      }
      const zipBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 },
      });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="CBT-Apps-Script-GitHub.zip"');
      res.setHeader('Content-Length', String(zipBuffer.length));
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'no-store');
      res.send(zipBuffer);
    } catch (err) {
      console.error('Gagal membuat ZIP Apps Script:', err);
      res.status(500).json({ error: 'Gagal membuat file ZIP.' });
    }
  };

  const sendFirebaseGithubZipAttachment = async (_req: Request, res: Response) => {
    try {
      const filesToBundle = [
        'index.html',
        'Admin.html',
        'Proktor.html',
        'firebase-cbt-bridge.js',
        'firebase-applet-config.json',
        'firestore.rules',
        'firebase-blueprint.json',
        'README.md',
      ];
      const zip = new JSZip();
      for (const filename of filesToBundle) {
        const filePath = resolvePublicFile(path.join('firebase-github', filename));
        if (!filePath) {
          res.status(404).json({ error: `File firebase-github/${filename} tidak ditemukan.` });
          return;
        }
        zip.file(filename, fs.readFileSync(filePath));
      }
      const zipBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 },
      });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="CBT-Firebase-GitHub.zip"');
      res.setHeader('Content-Length', String(zipBuffer.length));
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'no-store');
      res.send(zipBuffer);
    } catch (err) {
      console.error('Gagal membuat ZIP Firebase GitHub:', err);
      res.status(500).json({ error: 'Gagal membuat file ZIP Firebase GitHub.' });
    }
  };

  const sendQrPngAttachment = async (req: Request, res: Response) => {
    try {
      const defaultUrl = 'https://script.google.com/macros/s/AKfycbzAQ1YpzQ-QkbPM2DS7tX_ik2mlM9IPt3qTPg6MorKSXnSESslldX0k8ECjdqwD_p0PMw/exec';
      const rawUrl = typeof req.query.url === 'string' && req.query.url.trim() ? req.query.url.trim() : '';
      let pngBuffer: Buffer;
      if (rawUrl) {
        const QRCode = (await import('qrcode')).default;
        pngBuffer = await QRCode.toBuffer(rawUrl, {
          width: 600,
          margin: 4,
          errorCorrectionLevel: 'M',
          color: { dark: '#0f172a', light: '#ffffff' },
        });
      } else {
        const qrPath = resolvePublicFile('QR-CBT-Apps-Script.png');
        if (qrPath) {
          pngBuffer = fs.readFileSync(qrPath);
        } else {
          const QRCode = (await import('qrcode')).default;
          pngBuffer = await QRCode.toBuffer(defaultUrl, {
            width: 600,
            margin: 4,
            errorCorrectionLevel: 'M',
            color: { dark: '#0f172a', light: '#ffffff' },
          });
        }
      }
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', 'attachment; filename="QR-CBT-Apps-Script.png"');
      res.setHeader('Content-Length', String(pngBuffer.length));
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'no-store');
      res.send(pngBuffer);
    } catch (err) {
      console.error('Gagal membuat QR Code PNG:', err);
      res.status(500).json({ error: 'Gagal membuat QR Code PNG.' });
    }
  };

  const sendGasRawFile = (filename: string, contentType: string) => (_req: Request, res: Response) => {
    const filePath = resolvePublicFile(filename);
    if (!filePath) {
      res.status(404).send(`File ${filename} tidak ditemukan.`);
      return;
    }
    res.setHeader('Content-Type', `${contentType}; charset=utf-8`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(filePath);
  };

  // Serve static Firebase GitHub bundle with no-store cache control
  const firebaseGithubDir = path.resolve(__dirname, 'public', 'firebase-github');
  app.use(
    '/firebase-github',
    express.static(firebaseGithubDir, {
      setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      },
    })
  );

  // Serve direct APK, Apps Script ZIP, Firebase GitHub ZIP, QR Code PNG, & fresh GAS files
  app.get('/Code.gs', sendGasRawFile('Code.gs', 'text/plain'));
  app.get('/Index.html', sendGasRawFile('Index.html', 'text/plain'));
  app.get('/Admin.html', sendGasRawFile('Admin.html', 'text/plain'));
  app.get('/Proktor.html', sendGasRawFile('Proktor.html', 'text/plain'));
  app.get('/appsscript.json', sendGasRawFile('appsscript.json', 'application/json'));
  app.get('/CBT-Exambro-Lockdown.apk', sendApkAttachment);
  app.get('/api/download-apk', sendApkAttachment);
  app.get('/CBT-Apps-Script-GitHub.zip', sendGasZipAttachment);
  app.get('/api/download-gas-zip', sendGasZipAttachment);
  app.get('/CBT-Firebase-GitHub.zip', sendFirebaseGithubZipAttachment);
  app.get('/api/download-firebase-github-zip', sendFirebaseGithubZipAttachment);
  app.get('/QR-CBT-Apps-Script.png', sendQrPngAttachment);
  app.get('/api/download-qr', sendQrPngAttachment);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
