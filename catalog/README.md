# Model catalog

Two manifests, published by hand to the `gh-pages` branch:

| File                    | Read by          | Schema |
| ----------------------- | ---------------- | ------ |
| `model-catalog.json`    | apps up to 1.3.4 | 1      |
| `model-catalog-v2.json` | apps from 1.3.5  | 2      |

Publishing a manifest rolls its models out to every installed version that
reads it. Apps up to 1.3.4 cannot be told to skip an entry, so
`model-catalog.json` is frozen: add nothing there that those builds cannot
run.

Schema 2 adds an optional `minAppVersion` per entry. An app drops every entry
whose `minAppVersion` is above its own version, so a model that needs a newer
runtime can be listed as soon as the release that carries it is cut, and
older apps never see it. The tests in `__tests__/modelCatalogFile.test.ts`
require every v2-only entry to carry `minAppVersion`.

Test builds read another manifest through `EXPO_PUBLIC_MODEL_CATALOG_URL`,
for example a raw GitHub URL of a branch's `catalog/model-catalog-v2.json`.
