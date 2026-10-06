# Browser contract provenance

`manifest.json` records the exact released `@authara/browser` package and the
immutable Authara Core OpenAPI contract from which that package was generated.

The React components do not contain Authara route strings. They consume the
generated browser client's operation methods. The compatibility check proves
that the installed browser client implements the contract slice required by
the components.

The manifest starts as `unreleased` while the package is bootstrapped. The
release workflow refuses to publish until `.github/workflows/sync-browser.yaml`
has recorded a released browser SDK and its Core provenance.
