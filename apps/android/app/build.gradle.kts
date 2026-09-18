plugins {
    id("com.android.application")
    kotlin("android")
}
android {
    namespace = "com.lechigo.recorder"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.lechigo.recorder"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}
dependencies {
    implementation(project(":recorder-core"))
    implementation("io.github.sceneview:arsceneview:2.3.0")
    implementation("androidx.activity:activity-ktx:1.10.1")
}
