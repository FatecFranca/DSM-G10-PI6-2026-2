allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
// Alinha o compileSdk de TODOS os modulos (app + plugins) com o do Flutter.
//
// Sem isto, cada plugin compila contra a plataforma Android que ele declara, e o
// build so passa se exatamente aquelas plataformas estiverem instaladas na
// maquina - o que faz o projeto quebrar em um computador e funcionar em outro,
// pelo mesmo commit. Fixando aqui, basta ter a plataforma do Flutter instalada.
//
// Precisa vir ANTES do evaluationDependsOn abaixo: aquele bloco ja avalia os
// subprojetos, e afterEvaluate em projeto avaliado e erro de configuracao.
subprojects {
    afterEvaluate {
        val androidExtension = project.extensions.findByName("android")
        if (androidExtension is com.android.build.gradle.BaseExtension) {
            androidExtension.compileSdkVersion(36)
        }
    }
}

subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
