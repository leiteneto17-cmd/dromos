/**
 * Config plugin local — declara o Instagram em <queries> no AndroidManifest.
 *
 * POR QUÊ: no Android 11+ (package visibility), sem declarar `com.instagram.android` em
 * <queries>, o app não ENXERGA o Instagram. Aí o react-native-share não consegue mandar o
 * card como STICKER (interactive_asset_uri) e cai no share sheet genérico → o modelo
 * "Transparente" perde a transparência (vira foto com fundo preto no Story).
 *
 * Como o `android/` é REGENERADO pelo `expo prebuild`, aplicamos via plugin (não editar à mão).
 * Mesmo padrão de plugins/withKotlinMetadataSkip.js.
 */
const { withAndroidManifest } = require('@expo/config-plugins');

const PKG = 'com.instagram.android';

module.exports = function withInstagramQuery(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.queries = manifest.queries || [{}];
    const q = manifest.queries[0];
    q.package = q.package || [];
    const already = q.package.some((p) => p?.$?.['android:name'] === PKG);
    if (!already) {
      q.package.push({ $: { 'android:name': PKG } });
    }
    return cfg;
  });
};
