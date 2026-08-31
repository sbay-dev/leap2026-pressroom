# Security reports

The `Public disclosure boundary` GitHub Actions workflow runs the locked
dependency audit, public-boundary gate, syntax checks, WebAssembly verification,
and deterministic release-manifest build.

Each run uploads `public-boundary-security-evidence-<commit>` as a retained
GitHub Actions artifact. Generated reports are not committed because they
contain run-specific timestamps and runner metadata.
