import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * Garantia de segurança do APK: chaves de API e tokens do login xAI ficam no
 * cofre seguro (`WSSecureStorageSharedPreferences`) e nunca entram em backup.
 *
 * O manifesto mantém `allowBackup="false"`; as regras existem como defesa em
 * profundidade para Android 11 (backup_rules) e 12+ (data_extraction_rules).
 */

const MANIFEST = "android/app/src/main/AndroidManifest.xml";
const BACKUP_RULES = "android/app/src/main/res/xml/backup_rules.xml";
const EXTRACTION_RULES = "android/app/src/main/res/xml/data_extraction_rules.xml";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("backup do Android", () => {
  it("mantém allowBackup desligado e aponta as duas regras", () => {
    const manifest = read(MANIFEST);
    assert.match(manifest, /android:allowBackup="false"/);
    assert.match(manifest, /android:fullBackupContent="@xml\/backup_rules"/);
    assert.match(manifest, /android:dataExtractionRules="@xml\/data_extraction_rules"/);
  });

  it("exclui o cofre seguro (chaves e tokens) do backup legado", () => {
    const rules = read(BACKUP_RULES);
    assert.match(rules, /<full-backup-content>/);
    assert.match(rules, /domain="sharedpref" path="WSSecureStorageSharedPreferences\.xml"/);
    assert.match(rules, /domain="file" path="\."/);
    assert.match(rules, /domain="database" path="\."/);
  });

  it("exclui o cofre seguro da nuvem e da transferência entre aparelhos", () => {
    const rules = read(EXTRACTION_RULES);
    assert.match(rules, /<data-extraction-rules>/);
    assert.match(rules, /<cloud-backup>[\s\S]*WSSecureStorageSharedPreferences\.xml[\s\S]*<\/cloud-backup>/);
    assert.match(
      rules,
      /<device-transfer>[\s\S]*WSSecureStorageSharedPreferences\.xml[\s\S]*<\/device-transfer>/,
    );
    assert.match(rules, /domain="root" path="app_webview\/"/);
  });
});
