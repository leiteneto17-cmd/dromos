/**
 * Config plugin local — destrava a checagem de versão de metadata do Kotlin no Gradle.
 *
 * POR QUÊ: o `react-native-google-mobile-ads@16` (necessário p/ o RN 0.85 do Expo SDK 56) traz a
 * SDK nativa `play-services-ads:25.4.0`, compilada com **Kotlin 2.3** (metadata 2.3.0). O projeto
 * usa **Kotlin 2.1.20**, e o compilador RECUSA ler metadata de Kotlin mais novo:
 *   "Module was compiled with an incompatible version of Kotlin ... expected version is 2.1.0".
 * A flag `-Xskip-metadata-version-check` manda o compilador ler assim mesmo (bypass padrão e seguro
 * p/ consumir AARs pré-compilados; o bytecode roda igual, só relaxa a checagem de versão).
 *
 * Como o `android/` é REGENERADO pelo `expo prebuild`, aplicamos via plugin (não editar à mão).
 * Remover quando o Expo bumpar o Kotlin do projeto p/ ≥ o da SDK de ads. Ver [[admob-anuncios]].
 */
const { withProjectBuildGradle } = require('@expo/config-plugins');

const MARKER = '-Xskip-metadata-version-check';

const SNIPPET = `

// [+leitura] AdMob: permite ler metadata de Kotlin mais nova (play-services-ads 25.x = Kotlin 2.3).
allprojects {
    tasks.withType(org.jetbrains.kotlin.gradle.tasks.KotlinCompile).configureEach {
        compilerOptions {
            freeCompilerArgs.add("${MARKER}")
        }
    }
}
`;

module.exports = function withKotlinMetadataSkip(config) {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('withKotlinMetadataSkip: build.gradle raiz não é Groovy — ajuste o plugin.');
    }
    if (!cfg.modResults.contents.includes(MARKER)) {
      cfg.modResults.contents += SNIPPET;
    }
    return cfg;
  });
};
