# Security and Confidentiality

Report a security issue privately through GitHub Security Advisories for this
repository. Do not open a public issue containing credentials, private URLs,
model artifacts, user data, or patent material.

The public-boundary checker rejects common secret formats, private key blocks,
model payload extensions, private filing paths, and enabling claim-language
markers. It is a release gate, not a substitute for human review.

`https://leap2026.sbay.sa` is the canonical hardened deployment and applies
`docs/_headers`. GitHub Pages does not process `_headers`; its repository
mirror uses GitHub's platform defaults and must not be described as having the
same response-header policy.

The `Public disclosure boundary` workflow uploads dependency and boundary
reports as a GitHub Actions artifact named
`public-boundary-security-evidence-<commit>`. Generated reports are not
committed; see `security/reports/README.md`.
