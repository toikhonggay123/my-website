package vn.afyllx.mealcheck;

import android.Manifest;
import android.app.*;
import android.os.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.print.PrintManager;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import java.io.OutputStream;
import java.util.Arrays;

public final class MainActivity extends Activity {
 private static final String ORIGIN=BuildConfig.ORIGIN;
 private static final String START=ORIGIN+"/quan-tri";
 private WebView web;
 private ProgressBar progress;
 private LinearLayout cover;
 private ValueCallback<Uri[]> fileCallback;
 private PermissionRequest cameraRequest;
 private byte[] pendingPng;
 private boolean mainError=false;
 private boolean trusted(Uri uri){return uri!=null&&"https".equals(uri.getScheme())&&Uri.parse(ORIGIN).getHost().equals(uri.getHost())&&(uri.getPort()==-1||uri.getPort()==443);}
 private int dp(int n){return Math.round(n*getResources().getDisplayMetrics().density);}
 @Override public void onCreate(Bundle saved){
  super.onCreate(saved);
  FrameLayout root=new FrameLayout(this);root.setBackgroundColor(Color.rgb(246,248,252));
  root.setOnApplyWindowInsetsListener((view,insets)->{view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});
  web=new WebView(this);web.setBackgroundColor(Color.rgb(246,248,252));
  WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(true);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setMediaPlaybackRequiresUserGesture(false);settings.setUseWideViewPort(true);settings.setLoadWithOverviewMode(true);settings.setSafeBrowsingEnabled(true);settings.setUserAgentString(settings.getUserAgentString()+" AFYLLXMealCheck/1.0");
  CookieManager.getInstance().setAcceptCookie(true);CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
  root.addView(web,new FrameLayout.LayoutParams(-1,-1));
  progress=new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);progress.setMax(100);root.addView(progress,new FrameLayout.LayoutParams(-1,dp(3),Gravity.TOP));
  cover=new LinearLayout(this);cover.setOrientation(LinearLayout.VERTICAL);cover.setGravity(Gravity.CENTER);cover.setPadding(dp(30),dp(30),dp(30),dp(30));cover.setBackgroundColor(Color.rgb(246,248,252));root.addView(cover,new FrameLayout.LayoutParams(-1,-1));
  showCover("AFYLLX Edu MealCheck","Đang mở hệ thống điểm danh…",false);
  web.addJavascriptInterface(new PrintBridge(),"MealCheckAndroid");
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){Uri u=r.getUrl();if(trusted(u))return false;if(r.isForMainFrame()&&"https".equals(u.getScheme()))try{startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(Exception ignored){}return true;}
   @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest r){if(r.isForMainFrame()&&!trusted(r.getUrl()))return new WebResourceResponse("text/plain","UTF-8",403,"Blocked",null,new java.io.ByteArrayInputStream(new byte[0]));return null;}
   @Override public void onPageStarted(WebView v,String url,android.graphics.Bitmap icon){mainError=false;progress.setVisibility(View.VISIBLE);}
   @Override public void onPageFinished(WebView v,String url){progress.setVisibility(View.GONE);CookieManager.getInstance().flush();if(!mainError)cover.setVisibility(View.GONE);if(trusted(Uri.parse(url)))v.evaluateJavascript("window.print=function(){window.MealCheckAndroid.printCards()};",null);}
   @Override public void onReceivedError(WebView v,WebResourceRequest r,WebResourceError e){if(r.isForMainFrame()){mainError=true;showCover("Chưa kết nối được","Kiểm tra Wi-Fi hoặc dữ liệu di động rồi thử lại.",true);}}
   @Override public void onReceivedHttpError(WebView v,WebResourceRequest r,WebResourceResponse response){if(r.isForMainFrame()&&response.getStatusCode()>=400){mainError=true;showCover("Hệ thống chưa sẵn sàng","Vui lòng thử tải lại sau ít phút.",true);}}
  });
  web.setWebChromeClient(new WebChromeClient(){
   @Override public void onProgressChanged(WebView v,int n){progress.setProgress(n);}
   @Override public void onPermissionRequest(PermissionRequest request){runOnUiThread(()->{if(!trusted(request.getOrigin())||!trusted(Uri.parse(web.getUrl()==null?START:web.getUrl()))||!Arrays.asList(request.getResources()).contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)){request.deny();return;}if(checkSelfPermission(Manifest.permission.CAMERA)==PackageManager.PERMISSION_GRANTED)request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});else{if(cameraRequest!=null)cameraRequest.deny();cameraRequest=request;requestPermissions(new String[]{Manifest.permission.CAMERA},101);}});}
   @Override public void onPermissionRequestCanceled(PermissionRequest request){if(cameraRequest==request)cameraRequest=null;}
   @Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> callback,FileChooserParams params){if(fileCallback!=null)fileCallback.onReceiveValue(null);fileCallback=callback;Intent pick=new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE);String type="image/*";for(String accepted:params.getAcceptTypes())if(accepted.contains("csv")||accepted.contains("xlsx"))type="*/*";pick.setType(type);try{startActivityForResult(Intent.createChooser(pick,"Chọn tệp"),102);}catch(Exception e){fileCallback.onReceiveValue(null);fileCallback=null;}return true;}
  });
  web.setDownloadListener((url,agent,disposition,mime,length)->{
   if(!trusted(Uri.parse(web.getUrl()==null?START:web.getUrl())))return;
   if(url.startsWith("data:image/png;base64,")){try{if(url.length()>8_000_000)throw new IllegalArgumentException();pendingPng=android.util.Base64.decode(url.substring(url.indexOf(',')+1),android.util.Base64.DEFAULT);startActivityForResult(new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("image/png").putExtra(Intent.EXTRA_TITLE,"AFYLLX-QR-"+System.currentTimeMillis()+".png"),103);}catch(Exception e){Toast.makeText(this,"Không lưu được ảnh QR",Toast.LENGTH_LONG).show();}}
   else if(trusted(Uri.parse(url))){try{DownloadManager.Request r=new DownloadManager.Request(Uri.parse(url));r.addRequestHeader("Cookie",CookieManager.getInstance().getCookie(url));r.addRequestHeader("User-Agent",agent);r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS,URLUtil.guessFileName(url,disposition,mime));((DownloadManager)getSystemService(DOWNLOAD_SERVICE)).enqueue(r);}catch(Exception e){Toast.makeText(this,"Không tải được tệp",Toast.LENGTH_LONG).show();}}
  });
  setContentView(root);if(saved==null||web.restoreState(saved)==null)web.loadUrl(START);
 }
 private void showCover(String title,String message,boolean retry){cover.removeAllViews();TextView logo=new TextView(this);logo.setText("▦");logo.setTextSize(64);logo.setTextColor(Color.rgb(50,100,230));logo.setGravity(Gravity.CENTER);cover.addView(logo);TextView heading=new TextView(this);heading.setText(title);heading.setTextSize(24);heading.setTextColor(Color.rgb(30,58,95));heading.setGravity(Gravity.CENTER);cover.addView(heading);TextView text=new TextView(this);text.setText(message);text.setTextSize(15);text.setTextColor(Color.rgb(118,139,167));text.setGravity(Gravity.CENTER);text.setPadding(0,dp(18),0,dp(24));cover.addView(text);if(retry){Button button=new Button(this);button.setText("Thử lại");button.setOnClickListener(v->{cover.setVisibility(View.GONE);web.loadUrl(START);});cover.addView(button);}cover.setVisibility(View.VISIBLE);}
 private final class PrintBridge {@JavascriptInterface public void printCards(){runOnUiThread(()->{if(trusted(Uri.parse(web.getUrl()==null?"":web.getUrl())))((PrintManager)getSystemService(PRINT_SERVICE)).print("AFYLLX - Thẻ QR",web.createPrintDocumentAdapter("AFYLLX-QR"),null);});}}
 @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results){super.onRequestPermissionsResult(request,permissions,results);if(request==101&&cameraRequest!=null){if(results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED&&trusted(cameraRequest.getOrigin()))cameraRequest.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});else cameraRequest.deny();cameraRequest=null;}}
 @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==102&&fileCallback!=null){fileCallback.onReceiveValue(result==RESULT_OK&&data!=null?new Uri[]{data.getData()}:null);fileCallback=null;}if(request==103&&pendingPng!=null){byte[] bytes=pendingPng;pendingPng=null;if(result==RESULT_OK&&data!=null){Uri uri=data.getData();new Thread(()->{try(OutputStream out=getContentResolver().openOutputStream(uri)){out.write(bytes);}catch(Exception e){runOnUiThread(()->Toast.makeText(this,"Không lưu được tệp",Toast.LENGTH_LONG).show());}}).start();}}}
 @Override protected void onSaveInstanceState(Bundle state){web.saveState(state);super.onSaveInstanceState(state);}
 @Override public void onBackPressed(){if(web.canGoBack())web.goBack();else super.onBackPressed();}
 @Override protected void onPause(){web.onPause();web.evaluateJavascript("window.dispatchEvent(new Event('mealcheck-camera-pause'));document.querySelectorAll('video').forEach(v=>{if(v.srcObject)v.srcObject.getTracks().forEach(t=>t.stop())});",null);super.onPause();}
 @Override protected void onResume(){super.onResume();if(web!=null)web.onResume();}
 @Override protected void onDestroy(){if(cameraRequest!=null)cameraRequest.deny();if(fileCallback!=null)fileCallback.onReceiveValue(null);web.removeJavascriptInterface("MealCheckAndroid");web.destroy();super.onDestroy();}
}
