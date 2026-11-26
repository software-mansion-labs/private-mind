# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Add any project specific keep options here:
-keep class com.webgpu.** { *; }

-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

-keep class com.eko.RNBGDTaskConfig { <fields>; }
-keep class com.eko.RNBGDUploadTaskConfig { <fields>; }
-keep class com.eko.utils.StorageManager$PausedDownloadInfoData { <fields>; }

-dontwarn com.google.mlkit.vision.**
-dontwarn com.tencent.mmkv.**

-keep class com.android.installreferrer.api.** { *; }

-keep class expo.modules.kotlin.exception.CodedException { <init>(...); }
-keep class expo.modules.kotlin.exception.JavaScriptEvaluateException { <init>(...); }
-keep class expo.modules.kotlin.exception.UnexpectedException { <init>(...); }
-keep class expo.modules.kotlin.exception.InvalidArgsNumberException { <init>(...); }
-keep class expo.modules.sqlite.SQLiteErrorException { <init>(...); }
-keep class expo.modules.sqlite.InvalidConvertibleException { <init>(...); }

-keepnames interface com.facebook.react.uimanager.StateWrapper
-keepnames interface com.facebook.react.interfaces.TaskInterface
