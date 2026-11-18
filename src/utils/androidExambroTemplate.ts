export interface AndroidApkConfig {
  appName: string;
  packageName: string;
  webAppUrl: string;
  proctorPin: string;
}

export function sanitizePackageName(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+|\.+$/g, '');
  if (!cleaned || !cleaned.includes('.')) return 'id.sch.cbt.exambro';
  return cleaned
    .split('.')
    .map(seg => (/^[a-z]/.test(seg) ? seg : 'app' + seg))
    .join('.');
}

export function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildAndroidExambroFiles(config: AndroidApkConfig): Record<string, string> {
  const pkg = sanitizePackageName(config.packageName);
  const pkgPath = pkg.replace(/\./g, '/');
  const appName = (config.appName || 'CBT Exambro Lockdown').trim();
  const webUrl = (config.webAppUrl || '').trim();
  const proctorPin = (config.proctorPin || '202600').replace(/[^0-9]/g, '') || '202600';

  const buildApkYml = `name: Build CBT Exambro Android APK

on:
  push:
    branches: [ main, master ]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Setup Android SDK
        uses: android-actions/setup-android@v3

      - name: Setup Gradle
        uses: gradle/actions/setup-gradle@v4
        with:
          gradle-version: '8.7'

      - name: Build Debug APK
        run: gradle assembleDebug --no-daemon

      - name: Upload CBT Exambro APK
        uses: actions/upload-artifact@v4
        with:
          name: CBT-Exambro-Lockdown-APK
          path: app/build/outputs/apk/debug/app-debug.apk
`;

  const settingsGradleKts = `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "CBTExambroLockdown"
include(":app")
`;

  const rootBuildGradleKts = `plugins {
    id("com.android.application") version "8.5.2" apply false
    id("org.jetbrains.kotlin.android") version "1.9.24" apply false
}
`;

  const gradleProperties = `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
kotlin.code.style=official
android.nonTransitiveRClass=true
`;

  const appBuildGradleKts = `plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "${pkg}"
    compileSdk = 34

    defaultConfig {
        applicationId = "${pkg}"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.webkit:webkit:1.11.0")
}
`;

  const proguardRules = `# Keep JavascriptInterface bridge methods
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
`;

  const manifestXml = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.ACCESS_NOTIFICATION_POLICY" />

    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.microphone" android:required="false" />

    <application
        android:allowBackup="false"
        android:icon="@mipmap/ic_launcher"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:label="@string/app_name"
        android:resizeableActivity="false"
        android:supportsRtl="true"
        android:theme="@style/Theme.CBTExambro"
        android:usesCleartextTraffic="false">

        <activity
            android:name=".MainActivity"
            android:configChanges="orientation|screenSize|screenLayout|smallestScreenSize|keyboardHidden|keyboard"
            android:excludeFromRecents="true"
            android:exported="true"
            android:lockTaskMode="if_whitelisted"
            android:resizeableActivity="false"
            android:screenOrientation="portrait"
            android:supportsPictureInPicture="false"
            android:launchMode="singleTask">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

    </application>
</manifest>
`;

  const stringsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">${escapeXml(appName)}</string>
</resources>
`;

  const themesXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.CBTExambro" parent="Theme.AppCompat.Light.NoActionBar">
        <item name="android:windowFullscreen">true</item>
        <item name="android:windowNoTitle">true</item>
        <item name="android:statusBarColor">#4F46E5</item>
        <item name="android:navigationBarColor">#1E1B4B</item>
    </style>
</resources>
`;

  const icLauncherBgXml = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <gradient
        android:angle="135"
        android:startColor="#4F46E5"
        android:endColor="#673AB7" />
</shape>
`;

  const icLauncherFgXml = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <group
        android:scaleX="0.55"
        android:scaleY="0.55"
        android:translateX="5.4"
        android:translateY="5.4">
        <path
            android:fillColor="#FFFFFF"
            android:pathData="M18,8h-1V6c0,-2.76 -2.24,-5 -5,-5S7,3.24 7,6v2H6c-1.1,0 -2,0.9 -2,2v10c0,1.1 0.9,2 2,2h12c1.1,0 2,-0.9 2,-2V10c0,-1.1 -0.9,-2 -2,-2zM12,17c-1.1,0 -2,-0.9 -2,-2s0.9,-2 2,-2 2,0.9 2,2 -0.9,2 -2,2zM15.1,8H8.9V6c0,-1.71 1.39,-3.1 3.1,-3.1 1.71,0 3.1,1.39 3.1,3.1v2z" />
    </group>
</vector>
`;

  const icLauncherAnyDpi = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_bg" />
    <foreground android:drawable="@drawable/ic_launcher_fg" />
</adaptive-icon>
`;

  const mainActivityKt = `package ${pkg}

import android.Manifest
import android.annotation.SuppressLint
import android.app.ActivityManager
import android.app.AlertDialog
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Typeface
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import kotlin.concurrent.thread
import kotlin.math.sin

class MainActivity : AppCompatActivity() {

    companion object {
        // Ganti URL default di bawah jika ingin mengubah Web App Google Apps Script (Index.html)
        const val DEFAULT_EXAM_URL = "${webUrl.replace(/"/g, '\\"')}"
        const val PROCTOR_EXIT_PIN = "${proctorPin}"
        const val PREFS_NAME = "cbt_exambro_prefs"
        const val KEY_EXAM_URL = "exam_url"
    }

    private lateinit var webView: WebView
    private lateinit var lockdownOverlay: LinearLayout
    private lateinit var violationReasonView: TextView
    private lateinit var statusBarStrip: LinearLayout
    private lateinit var statusStripLabel: TextView

    @Volatile
    private var isExamLockdownActive = false

    @Volatile
    private var isInternalDialogOpen = false

    @Volatile
    private var isSirenPlaying = false
    private var sirenThread: Thread? = null
    private var audioTrack: AudioTrack? = null
    private var previousDndFilter: Int? = null

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { _ -> }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // BLOKIR SCREENSHOT & REKAM LAYAR DI TINGKAT SISTEM ANDROID
        applyAntiScreenshotFlags()
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val rootLayout = FrameLayout(this)
        rootLayout.setBackgroundColor(Color.parseColor("#F0EBF8"))

        val contentCol = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }

        // Bilah Status Lockdown Mode tipis di atas
        statusBarStrip = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setBackgroundColor(Color.parseColor("#312E81"))
            setPadding(24, 14, 24, 14)
            gravity = Gravity.CENTER_VERTICAL
        }

        statusStripLabel = TextView(this).apply {
            text = "LOCKDOWN MODE ANDROID AKTIF • ANTI SPLIT-SCREEN"
            setTextColor(Color.WHITE)
            textSize = 11f
            setTypeface(null, Typeface.BOLD)
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }

        val btnProctorExit = TextView(this).apply {
            text = "PIN PROKTOR"
            setTextColor(Color.parseColor("#FDE68A"))
            textSize = 11f
            setTypeface(null, Typeface.BOLD)
            setPadding(16, 6, 16, 6)
            setBackgroundColor(Color.parseColor("#4338CA"))
            setOnClickListener { showProctorPinDialog() }
        }

        statusBarStrip.addView(statusStripLabel)
        statusBarStrip.addView(btnProctorExit)

        webView = WebView(this).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                0,
                1f
            )
        }

        contentCol.addView(statusBarStrip)
        contentCol.addView(webView)
        rootLayout.addView(contentCol)

        // OVERLAY PERINGATAN LOCKDOWN JIKA MENCOBA SPLIT SCREEN / FLOATING APP
        lockdownOverlay = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#E67F1D1D"))
            setPadding(48, 48, 48, 48)
            visibility = View.GONE
            isClickable = true
            isFocusable = true
        }

        val titleWarn = TextView(this).apply {
            text = "PERINGATAN LOCKDOWN MODE!"
            setTextColor(Color.WHITE)
            textSize = 22f
            setTypeface(null, Typeface.BOLD)
            gravity = Gravity.CENTER
        }

        violationReasonView = TextView(this).apply {
            text = "Sistem mendeteksi percobaan Split Screen / Floating Aplikasi / Membuka Notifikasi."
            setTextColor(Color.parseColor("#FDE68A"))
            textSize = 15f
            gravity = Gravity.CENTER
            setPadding(0, 24, 0, 36)
        }

        val btnResumeLockdown = Button(this).apply {
            text = "MATIKAN ALARM & KEMBALI KE LOCKDOWN"
            setBackgroundColor(Color.WHITE)
            setTextColor(Color.parseColor("#991B1B"))
            setTypeface(null, Typeface.BOLD)
            setPadding(36, 24, 36, 24)
            setOnClickListener {
                if (isDeviceInMultiWindow()) {
                    startSirenAlarm()
                    Toast.makeText(this@MainActivity, "Tutup Split Screen / Floating Window terlebih dahulu!", Toast.LENGTH_LONG).show()
                } else {
                    stopSirenAlarm()
                    lockdownOverlay.visibility = View.GONE
                    applyImmersiveLockdown()
                    tryStartScreenPinning()
                }
            }
        }

        lockdownOverlay.addView(titleWarn)
        lockdownOverlay.addView(violationReasonView)
        lockdownOverlay.addView(btnResumeLockdown)
        rootLayout.addView(lockdownOverlay)

        setContentView(rootLayout)

        setupWebView()
        applyImmersiveLockdown()
        requestRuntimePermissions()

        // Blokir tombol Back selama Lockdown Mode aktif
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (isExamLockdownActive) {
                    Toast.makeText(this@MainActivity, "Lockdown Mode Aktif: Tidak dapat keluar sebelum ujian selesai!", Toast.LENGTH_SHORT).show()
                } else if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    showProctorPinDialog()
                }
            }
        })

        val savedUrl = getSavedExamUrl()
        if (savedUrl.isNotBlank()) {
            webView.loadUrl(savedUrl)
        } else {
            loadBarcodeScannerSetupPage()
        }
    }

    private fun applyAntiScreenshotFlags() {
        window.setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        )
    }

    private fun applyImmersiveLockdown() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val controller = WindowInsetsControllerCompat(window, window.decorView)
        controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        controller.hide(WindowInsetsCompat.Type.statusBars() or WindowInsetsCompat.Type.navigationBars())
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val ws = webView.settings
        ws.javaScriptEnabled = true
        ws.domStorageEnabled = true
        ws.databaseEnabled = true
        ws.mediaPlaybackRequiresUserGesture = false
        ws.cacheMode = WebSettings.LOAD_DEFAULT
        ws.allowFileAccess = false
        ws.setSupportZoom(false)
        ws.builtInZoomControls = false
        ws.userAgentString = ws.userAgentString + " CBT-Exambro-Android/1.0 Exambro"

        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

        webView.isLongClickable = false
        webView.setOnLongClickListener { true }

        webView.addJavascriptInterface(ExambroJsBridge(), "AndroidExambro")

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                if (isDeviceInMultiWindow()) {
                    triggerSplitScreenViolation("Percobaan Split Screen / Multi-Window terdeteksi!")
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest?) {
                runOnUiThread {
                    request?.grant(request.resources)
                }
            }
        }
    }

    private fun requestRuntimePermissions() {
        val needed = mutableListOf<String>()
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.CAMERA)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.RECORD_AUDIO)
        }
        if (needed.isNotEmpty()) {
            permissionLauncher.launch(needed.toTypedArray())
        }
    }

    private fun isDeviceInMultiWindow(): Boolean {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && isInMultiWindowMode
    }

    override fun onMultiWindowModeChanged(isInMultiWindowMode: Boolean, newConfig: Configuration) {
        super.onMultiWindowModeChanged(isInMultiWindowMode, newConfig)
        if (isExamLockdownActive && isInMultiWindowMode) {
            triggerSplitScreenViolation("LOCKDOWN ANDROID: Dilarang keras mengaktifkan Split Screen!")
        }
    }

    override fun onPictureInPictureModeChanged(isInPictureInPictureMode: Boolean, newConfig: Configuration) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
        if (isExamLockdownActive && isInPictureInPictureMode) {
            triggerSplitScreenViolation("LOCKDOWN ANDROID: Mode Floating / Picture-in-Picture diblokir!")
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            applyImmersiveLockdown()
            applyAntiScreenshotFlags()
        }
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        if (isExamLockdownActive && !isInternalDialogOpen) {
            triggerSplitScreenViolation("LOCKDOWN ANDROID: Siswa mencoba keluar aplikasi / berpindah layar!")
        }
    }

    override fun onStop() {
        super.onStop()
        if (isExamLockdownActive && !isInternalDialogOpen && !isChangingConfigurations) {
            triggerSplitScreenViolation("LOCKDOWN ANDROID: Aplikasi ujian ditinggalkan saat ujian belum selesai!")
        }
    }

    override fun onResume() {
        super.onResume()
        applyAntiScreenshotFlags()
        applyImmersiveLockdown()
        if (isExamLockdownActive && isDeviceInMultiWindow()) {
            triggerSplitScreenViolation("LOCKDOWN ANDROID: Aplikasi dibuka dalam Split Screen!")
        }
    }

    private fun triggerSplitScreenViolation(reason: String) {
        if (!isExamLockdownActive) return
        runOnUiThread {
            if (!isExamLockdownActive) return@runOnUiThread
            startSirenAlarm()
            violationReasonView.text = reason
            lockdownOverlay.visibility = View.VISIBLE
            val safeReason = reason.replace("'", "\\'")
            webView.evaluateJavascript(
                "if(window.onAndroidLockdownViolation){window.onAndroidLockdownViolation('$safeReason');}",
                null
            )
        }
    }

    // SIRINE ALARM KERAS (STREAM_ALARM) SAAT SPLIT SCREEN / PELANGGARAN
    private fun startSirenAlarm() {
        if (isSirenPlaying) return
        isSirenPlaying = true
        sirenThread = thread(start = true) {
            try {
                val sampleRate = 22050
                val bufferSize = AudioTrack.getMinBufferSize(
                    sampleRate,
                    AudioFormat.CHANNEL_OUT_MONO,
                    AudioFormat.ENCODING_PCM_16BIT
                )
                val track = AudioTrack.Builder()
                    .setAudioAttributes(
                        AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build()
                    )
                    .setAudioFormat(
                        AudioFormat.Builder()
                            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                            .setSampleRate(sampleRate)
                            .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                            .build()
                    )
                    .setBufferSizeInBytes(bufferSize)
                    .setTransferMode(AudioTrack.MODE_STREAM)
                    .build()

                audioTrack = track
                track.play()

                val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
                val maxAlarmVol = am.getStreamMaxVolume(AudioManager.STREAM_ALARM)
                am.setStreamVolume(AudioManager.STREAM_ALARM, maxAlarmVol, 0)

                val chunk = ShortArray(2205) // 100ms chunks
                var phase = 0.0
                var tick = 0
                while (isSirenPlaying) {
                    val freq = if ((tick / 4) % 2 == 0) 980.0 else 1420.0
                    for (i in chunk.indices) {
                        phase += 2.0 * Math.PI * freq / sampleRate
                        chunk[i] = (sin(phase) * Short.MAX_VALUE * 0.92).toInt().toShort()
                    }
                    track.write(chunk, 0, chunk.size)
                    tick++
                }
                track.stop()
                track.release()
            } catch (_: Exception) {
            }
        }
    }

    private fun stopSirenAlarm() {
        isSirenPlaying = false
        try {
            sirenThread?.interrupt()
            sirenThread = null
        } catch (_: Exception) {}
    }

    private fun enableDoNotDisturbDuringExam() {
        try {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (nm.isNotificationPolicyAccessGranted) {
                previousDndFilter = nm.currentInterruptionFilter
                nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALARMS)
            }
        } catch (_: Exception) {}
    }

    private fun restoreDoNotDisturb() {
        try {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (nm.isNotificationPolicyAccessGranted && previousDndFilter != null) {
                nm.setInterruptionFilter(previousDndFilter!!)
                previousDndFilter = null
            }
        } catch (_: Exception) {}
    }

    private fun tryStartScreenPinning() {
        try {
            val am = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            if (am.lockTaskModeState == ActivityManager.LOCK_TASK_MODE_NONE) {
                startLockTask()
            }
        } catch (_: Exception) {}
    }

    private fun tryStopScreenPinning() {
        try {
            stopLockTask()
        } catch (_: Exception) {}
    }

    private fun getSavedExamUrl(): String {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString(KEY_EXAM_URL, DEFAULT_EXAM_URL) ?: DEFAULT_EXAM_URL
    }

    private fun loadBarcodeScannerSetupPage() {
        isExamLockdownActive = false
        stopSirenAlarm()
        lockdownOverlay.visibility = View.GONE
        statusBarStrip.setBackgroundColor(Color.parseColor("#312E81"))
        statusStripLabel.text = "AKTIVASI CBT • SCAN BARCODE / LINK SKRIP"
        val html = """
            <!DOCTYPE html>
            <html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
            <style>*{box-sizing:border-box;font-family:sans-serif}body{margin:0;background:#f0ebf8;padding:16px;display:flex;align-items:center;justify-content:center;min-height:100vh}.card{width:100%;max-width:440px;background:#fff;border-radius:16px;padding:20px;box-shadow:0 10px 25px rgba(0,0,0,.08)}.btn{width:100%;padding:14px;border:0;border-radius:10px;background:#4f46e5;color:#fff;font-weight:800;font-size:14px;cursor:pointer}input{width:100%;padding:12px;border:1.5px solid #cbd5e1;border-radius:10px;margin:10px 0}.save{width:100%;padding:12px;border:0;border-radius:10px;background:#059669;color:#fff;font-weight:800}</style></head>
            <body><div class="card">
            <h3>Hubungkan Link Skrip Google</h3>
            <p style="font-size:13px;color:#475569">Scan QR Code dari Proktor atau tempel link Web App Google Apps Script:</p>
            <button class="btn" onclick="startScan()">Scan Barcode / QR Link Script</button>
            <div id="cam" style="display:none;margin-top:10px"><video id="v" autoplay playsinline muted style="width:100%;border-radius:10px"></video></div>
            <input id="u" type="url" placeholder="https://script.google.com/macros/s/.../exec" value="${'$'}{getSavedExamUrl().replace("\"", "")}" />
            <button class="save" onclick="openU(document.getElementById('u').value)">Simpan &amp; Buka CBT</button>
            <script>
            function openU(val){var u=(val||'').trim();if(u.startsWith('http')){window.AndroidExambro.saveAndOpenExamUrl(u);}else{alert('URL harus diawali https://');}}
            function startScan(){if(!('BarcodeDetector'in window)){alert('Gunakan Chrome BarcodeDetector atau tempel link manual.');return;}navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}).then(function(s){document.getElementById('cam').style.display='block';var v=document.getElementById('v');v.srcObject=s;v.play();var bd=new BarcodeDetector({formats:['qr_code']});setInterval(function(){bd.detect(v).then(function(cs){if(cs.length&&cs[0].rawValue){s.getTracks().forEach(function(t){t.stop()});openU(cs[0].rawValue);}}).catch(function(){});},350);});}
            </script></div></body></html>
        """.trimIndent()
        webView.loadDataWithBaseURL("https://exambro.local/", html, "text/html", "UTF-8", null)
    }

    private fun showSetupUrlDialog() {
        isInternalDialogOpen = true
        val input = EditText(this).apply {
            hint = "https://script.google.com/macros/s/.../exec"
            setText(getSavedExamUrl())
            inputType = InputType.TYPE_TEXT_VARIATION_URI
        }
        AlertDialog.Builder(this)
            .setTitle("Pengaturan URL Web App CBT")
            .setMessage("Masukkan URL Web App Google Apps Script (halaman CBT Siswa / Index.html):")
            .setView(input)
            .setCancelable(false)
            .setPositiveButton("Simpan & Buka") { _, _ ->
                isInternalDialogOpen = false
                val url = input.text.toString().trim()
                if (url.startsWith("http")) {
                    getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                        .edit()
                        .putString(KEY_EXAM_URL, url)
                        .apply()
                    webView.loadUrl(url)
                } else {
                    Toast.makeText(this, "URL harus diawali https://", Toast.LENGTH_SHORT).show()
                    showSetupUrlDialog()
                }
            }
            .setNeutralButton("Scan Barcode") { _, _ ->
                isInternalDialogOpen = false
                loadBarcodeScannerSetupPage()
            }
            .show()
    }

    private fun showProctorPinDialog() {
        isInternalDialogOpen = true
        val input = EditText(this).apply {
            hint = "Masukkan PIN Proktor"
            inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_VARIATION_PASSWORD
        }
        AlertDialog.Builder(this)
            .setTitle("Akses Proktor Exambro")
            .setMessage("Masukkan PIN Proktor untuk Scan Barcode, ganti URL server, atau keluar aplikasi:")
            .setView(input)
            .setOnCancelListener { isInternalDialogOpen = false }
            .setPositiveButton("Verifikasi") { _, _ ->
                if (input.text.toString().trim() == PROCTOR_EXIT_PIN) {
                    stopSirenAlarm()
                    isExamLockdownActive = false
                    restoreDoNotDisturb()
                    tryStopScreenPinning()
                    lockdownOverlay.visibility = View.GONE
                    AlertDialog.Builder(this)
                        .setTitle("Menu Proktor")
                        .setOnCancelListener { isInternalDialogOpen = false }
                        .setItems(arrayOf("Scan Barcode / Ganti URL Server CBT", "Izinkan Blokir Notifikasi (DND)", "Keluar Aplikasi Exambro")) { _, which ->
                            isInternalDialogOpen = false
                            when (which) {
                                0 -> loadBarcodeScannerSetupPage()
                                1 -> {
                                    try {
                                        startActivity(Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS))
                                    } catch (_: Exception) {}
                                }
                                2 -> finishAndRemoveTask()
                            }
                        }
                        .show()
                } else {
                    isInternalDialogOpen = false
                    Toast.makeText(this, "PIN Proktor salah!", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("Batal") { _, _ -> isInternalDialogOpen = false }
            .show()
    }

    override fun onDestroy() {
        stopSirenAlarm()
        restoreDoNotDisturb()
        super.onDestroy()
    }

    inner class ExambroJsBridge {
        @JavascriptInterface
        fun getSavedExamUrl(): String {
            return this@MainActivity.getSavedExamUrl()
        }

        @JavascriptInterface
        fun saveAndOpenExamUrl(rawUrl: String?) {
            runOnUiThread {
                val url = rawUrl?.trim() ?: ""
                if (url.startsWith("http")) {
                    getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                        .edit()
                        .putString(KEY_EXAM_URL, url)
                        .apply()
                    statusBarStrip.setBackgroundColor(Color.parseColor("#312E81"))
                    statusStripLabel.text = "LOCKDOWN MODE ANDROID • ANTI SPLIT-SCREEN"
                    webView.loadUrl(url)
                }
            }
        }

        @JavascriptInterface
        fun openScannerSetup() {
            runOnUiThread { loadBarcodeScannerSetupPage() }
        }

        @JavascriptInterface
        fun startLockdown() {
            runOnUiThread {
                isExamLockdownActive = true
                statusBarStrip.setBackgroundColor(Color.parseColor("#991B1B"))
                statusStripLabel.text = "LOCKDOWN AKTIF • ALARM JIKA KELUAR / SPLIT SCREEN"
                applyAntiScreenshotFlags()
                applyImmersiveLockdown()
                enableDoNotDisturbDuringExam()
                tryStartScreenPinning()
                if (isDeviceInMultiWindow()) {
                    triggerSplitScreenViolation("LOCKDOWN ANDROID: Tutup Split Screen terlebih dahulu!")
                }
            }
        }

        @JavascriptInterface
        fun stopLockdown() {
            runOnUiThread {
                isExamLockdownActive = false
                stopSirenAlarm()
                restoreDoNotDisturb()
                tryStopScreenPinning()
                lockdownOverlay.visibility = View.GONE
                statusBarStrip.setBackgroundColor(Color.parseColor("#065F46"))
                statusStripLabel.text = "UJIAN SELESAI • LOCKDOWN NONAKTIF"
            }
        }

        @JavascriptInterface
        fun triggerSiren(reason: String?) {
            runOnUiThread {
                if (!isExamLockdownActive) return@runOnUiThread
                startSirenAlarm()
                if (!reason.isNullOrBlank()) {
                    violationReasonView.text = reason
                }
            }
        }

        @JavascriptInterface
        fun stopSiren() {
            runOnUiThread {
                stopSirenAlarm()
                lockdownOverlay.visibility = View.GONE
            }
        }

        @JavascriptInterface
        fun isInMultiWindow(): Boolean {
            return isDeviceInMultiWindow()
        }
    }
}
`;

  return {
    '.github/workflows/build-apk.yml': buildApkYml,
    'settings.gradle.kts': settingsGradleKts,
    'build.gradle.kts': rootBuildGradleKts,
    'gradle.properties': gradleProperties,
    'app/build.gradle.kts': appBuildGradleKts,
    'app/proguard-rules.pro': proguardRules,
    'app/src/main/AndroidManifest.xml': manifestXml,
    'app/src/main/res/values/strings.xml': stringsXml,
    'app/src/main/res/values/themes.xml': themesXml,
    'app/src/main/res/drawable/ic_launcher_bg.xml': icLauncherBgXml,
    'app/src/main/res/drawable/ic_launcher_fg.xml': icLauncherFgXml,
    'app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml': icLauncherAnyDpi,
    'app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml': icLauncherAnyDpi,
    [`app/src/main/java/${pkgPath}/MainActivity.kt`]: mainActivityKt
  };
}
