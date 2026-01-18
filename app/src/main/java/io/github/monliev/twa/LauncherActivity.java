/*
 * Copyright 2020 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package io.github.monliev.twa;

import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.core.content.FileProvider;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.interstitial.InterstitialAd;
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

public class LauncherActivity extends android.app.Activity {

    private WebView webView;
    private InterstitialAd mInterstitialAd;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 1. Layout Container
        android.widget.LinearLayout mainLayout = new android.widget.LinearLayout(this);
        mainLayout.setOrientation(android.widget.LinearLayout.VERTICAL);
        mainLayout.setFitsSystemWindows(true); 
        // Set Background biar menyatu dengan App (Deep Blue)
        mainLayout.setBackgroundColor(0xFF1E1B4B); 
        mainLayout.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        // 2. Setup WebView
        webView = new WebView(this);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        
        // Custom WebViewClient untuk menghandle Link & Error
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url.startsWith("mailto:")) {
                    // Buka Email App
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    return true;
                }
                if (url.startsWith("http") || url.startsWith("https")) {
                    // Buka Browser Eksternal (Chrome/System) untuk link keluar
                    // Ini solusi agar tidak error NET::ERR dan lebih aman user
                    view.getContext().startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    return true;
                }
                return false; // Link internal (file://) diload di WebView
            }
        });

        // Enable Alerts (PENTING!)
        webView.setWebChromeClient(new android.webkit.WebChromeClient());
        // Tambahkan Interface untuk komunikasi JS -> Java
        webView.addJavascriptInterface(new WebAppInterface(this), "Android");

        // IZIN AKSES FILE LOCAL (Solusi Script Error)
        webView.getSettings().setAllowFileAccess(true);
        webView.getSettings().setAllowContentAccess(true);
        webView.getSettings().setAllowFileAccessFromFileURLs(true);
        webView.getSettings().setAllowUniversalAccessFromFileURLs(true);
        
        // Background WebView disamakan dengan Tema (Deep Blue)
        // Ini mencegah "Flash Putih" atau bidang putih saat scroll
        webView.setBackgroundColor(0xFF1E1B4B);
        
        webView.loadUrl("file:///android_asset/index.html");

        android.widget.LinearLayout.LayoutParams webParams = new android.widget.LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1.0f);
        mainLayout.addView(webView, webParams);

        // 3. Setup AdMob Banner
        MobileAds.initialize(this, initializationStatus -> {});

        AdView adView = new AdView(this);
        adView.setAdSize(AdSize.BANNER);
        // BANNER ID (Test) - Ganti dengan ID Asli saat rilis
        adView.setAdUnitId("ca-app-pub-3940256099942544/6300978111"); 

        android.widget.LinearLayout.LayoutParams adParams = new android.widget.LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        adParams.gravity = Gravity.CENTER_HORIZONTAL;
        
        mainLayout.addView(adView, adParams);
        adView.loadAd(new AdRequest.Builder().build());

        // 4. Load Interstitial Ad Pertama Kali
        loadInterstitialAd();

        setContentView(mainLayout);
    }

    // --- INTERSTITIAL AD LOGIC ---
    private void loadInterstitialAd() {
        AdRequest adRequest = new AdRequest.Builder().build();
        // INTERSTITIAL ID (Test) - Ganti dengan ID Asli saat rilis
        InterstitialAd.load(this,"ca-app-pub-3940256099942544/1033173712", adRequest,
            new InterstitialAdLoadCallback() {
                @Override
                public void onAdLoaded(@NonNull InterstitialAd interstitialAd) {
                    mInterstitialAd = interstitialAd;
                    
                    // Setup Callback saat iklan ditutup
                    mInterstitialAd.setFullScreenContentCallback(new FullScreenContentCallback(){
                        @Override
                        public void onAdDismissedFullScreenContent() {
                            // Load iklan baru setelah ditutup agar siap untuk next time
                            mInterstitialAd = null;
                            loadInterstitialAd();
                        }
                        @Override
                        public void onAdFailedToShowFullScreenContent(AdError adError) {
                            mInterstitialAd = null;
                        }
                    });
                }

                @Override
                public void onAdFailedToLoad(@NonNull LoadAdError loadAdError) {
                    mInterstitialAd = null;
                }
            });
    }

    private void showInterstitial() {
        runOnUiThread(() -> {
            if (mInterstitialAd != null) {
                mInterstitialAd.show(LauncherActivity.this);
            } else {
                // Jika belum siap, load lagi untuk kesempatan berikutnya
                loadInterstitialAd();
            }
        });
    }



    // --- SCREENSHOT LOGIC (LONG SCREENSHOT v4: JS-DRIVEN HEIGHT) ---
    private void takeScreenshotAndShare(int jsContentHeight) {
        runOnUiThread(() -> {
            Bitmap bitmap = null;
            int originalHeight = webView.getHeight();
            int originalWidth = webView.getWidth();
            
            try {
                // Konversi tinggi JS (CSS px) ke Android System Pixels
                // Rumus: cssPx * density
                float density = getResources().getDisplayMetrics().density;
                int finalHeight = (int) (jsContentHeight * density);

                // LOGGING (Monitor via Logcat)
                android.util.Log.d("Screenshot", "--------------------------------------");
                android.util.Log.d("Screenshot", "JS Content Height : " + jsContentHeight);
                android.util.Log.d("Screenshot", "Device Density    : " + density);
                android.util.Log.d("Screenshot", "Calculated Height : " + finalHeight);
                android.util.Log.d("Screenshot", "Original Height   : " + originalHeight);

                // Validasi: Jangan sampai 0 atau kependekan
                if (finalHeight < originalHeight) finalHeight = originalHeight;

                int originalLayerType = webView.getLayerType();
                webView.setLayerType(android.view.View.LAYER_TYPE_SOFTWARE, null);

                // RESIZE HACK: Gunakan EXACTLY sesuai permintaan JS (Compact Height)
                // Karena JS sudah 'shrink', kita harus paksa WebView ikut ukuran itu.
                webView.measure(
                    android.view.View.MeasureSpec.makeMeasureSpec(originalWidth, android.view.View.MeasureSpec.EXACTLY),
                    android.view.View.MeasureSpec.makeMeasureSpec(finalHeight, android.view.View.MeasureSpec.EXACTLY)
                );
                webView.layout(0, 0, originalWidth, finalHeight);
                
                android.util.Log.d("Screenshot", "Forced Height: " + finalHeight);
                
                android.util.Log.d("Screenshot", "WebView Measured  : " + webView.getMeasuredHeight());

                try {
                    bitmap = Bitmap.createBitmap(originalWidth, finalHeight, Bitmap.Config.ARGB_8888);
                    Canvas canvas = new Canvas(bitmap);
                    canvas.drawColor(0xFF1E1B4B); 
                    webView.draw(canvas);
                } catch (OutOfMemoryError oom) {
                    if (bitmap != null) bitmap.recycle();
                    Toast.makeText(getApplicationContext(), "OOM: Screenshot layar saja", Toast.LENGTH_SHORT).show();
                     
                    // Fallback Routine
                     webView.measure(
                        android.view.View.MeasureSpec.makeMeasureSpec(originalWidth, android.view.View.MeasureSpec.EXACTLY),
                        android.view.View.MeasureSpec.makeMeasureSpec(originalHeight, android.view.View.MeasureSpec.EXACTLY)
                    );
                    webView.layout(0, 0, originalWidth, originalHeight);
                    
                    bitmap = Bitmap.createBitmap(originalWidth, originalHeight, Bitmap.Config.ARGB_8888);
                    Canvas canvas = new Canvas(bitmap);
                    canvas.drawColor(0xFF1E1B4B);
                    webView.draw(canvas);
                }

                // RESTORE & RE-LAYOUT
                webView.measure(
                    android.view.View.MeasureSpec.makeMeasureSpec(originalWidth, android.view.View.MeasureSpec.EXACTLY),
                    android.view.View.MeasureSpec.makeMeasureSpec(originalHeight, android.view.View.MeasureSpec.EXACTLY)
                );
                webView.layout(0, 0, originalWidth, originalHeight);
                webView.setLayerType(originalLayerType, null);
                webView.requestLayout(); 

                // SAVE & SHARE
                if (bitmap != null) {
                    File cachePath = new File(getCacheDir(), "images");
                    cachePath.mkdirs();
                    File newFile = new File(cachePath, "tarif_tol_screenshot.png");
                    FileOutputStream stream = new FileOutputStream(newFile);
                    bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream);
                    stream.close();

                    Uri contentUri = FileProvider.getUriForFile(LauncherActivity.this, 
                            getApplicationContext().getPackageName() + ".fileprovider", newFile);

                    if (contentUri != null) {
                        Intent shareIntent = new Intent();
                        shareIntent.setAction(Intent.ACTION_SEND);
                        shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        shareIntent.setDataAndType(contentUri, getContentResolver().getType(contentUri));
                        shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
                        shareIntent.putExtra(Intent.EXTRA_TEXT, "Cek tarif tol lengkap di aplikasi TarifTol.id!");
                        
                        // Debug Feedback
                        Toast.makeText(getApplicationContext(), "Membuka Menu Share...", Toast.LENGTH_SHORT).show();
                        
                        startActivity(Intent.createChooser(shareIntent, "Bagikan Tarif Via"));
                    }
                }

            } catch (Exception e) {
                e.printStackTrace();
                webView.layout(0, 0, originalWidth, originalHeight);
                webView.requestLayout();
                Toast.makeText(getApplicationContext(), "Error: " + e.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }

    // --- NAVIGATION CONTROL (BACK BUTTON) ---
    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    // --- JAVASCRIPT INTERFACE ---
    public class WebAppInterface {
        Context mContext;

        WebAppInterface(Context c) {
            mContext = c;
        }

        @JavascriptInterface
        public void showInterstitial() {
            LauncherActivity.this.showInterstitial();
        }

        @JavascriptInterface
        public void shareScreenshot(int jsHeight) {
            // Bridge Active. Proceed directly to Screenshot.
            LauncherActivity.this.takeScreenshotAndShare(jsHeight);
        }
    }
}