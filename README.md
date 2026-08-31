# منصة تموين — LEAP + DeepFest 2026

Independent, bilingual enterprise platform brief presenting **منصة تموين /
SBAY** during LEAP and DeepFest 2026 in Riyadh,
31 August–3 September 2026.

Live targets:

- Primary hardened domain: `https://leap2026.sbay.sa`
- Repository mirror: `https://sbay-dev.github.io/leap2026-pressroom/`

The custom domain is served through Cloudflare and applies the checked-in
security headers. Its `no-transform` cache directive prevents edge analytics
injection, while the CSP grants only the narrow WebAssembly compilation
capability required by the small public evidence module. That module exposes
integer equality, bit extraction, population count and an empty `trace_void`;
it does not contain the private Arabic analyser. GitHub Pages does not support
repository-defined response headers, so the mirror uses GitHub's default
headers and is not the canonical security boundary.

The narrative follows:

`Problem → Platform → Intelligence → Outcomes → Vision`

The primary positioning is SBAY as an enterprise AI procurement and supply
platform.
NewsBoy, CP, Sarmad, CNS and QdrantServer appear as bounded operating or
technical evidence. KSAR now has a dedicated live-commerce stage linked to its
verified `2.1.0-leap2026` production release.

The hero replays the WebAssembly-derived public flag pattern through WebGPU
when available and Canvas2D otherwise: octet read, bit decode, bloom, quiet,
then a live `trace_void` call. The processor-stage labels are explanatory, not
a recording of physical CPU cycles. Release checks prove that this specific
void function returns no value and leaves WebAssembly linear memory unchanged.

The KSAR stage presents one bounded proposition: watch the product, negotiate
with the direct seller, and move toward an agreement in one live session. It
links to the storefront, live market and public documentation, and publishes
the release identities without claiming Saudi physical hosting, universal
cross-device acceptance, sales or audience performance, raw IR broadcasting,
or correction of the reported CPOLY freeze.

NewsBoy is represented by its supplied classic editorial and modern culture
edition captures. Its proof card links directly to the public citations and
sources section and the public site archive.

The pressroom also includes the public **ADG Arabic Adjudication Platform** as
a separate institutional research announcement. Its two-sample public pilot
uses blind independent annotation, a third adjudicator for disagreements and
an explicit identity/evidence separation boundary. It is not presented as a
final Arabic correction service or final parser-readiness judgment.

A bilingual media brief is prepared in `PNU-MEDIA-CENTER-BRIEF.md` for
submission to Princess Nourah bint Abdulrahman University’s media center. The
brief expressly denies university issuance, approval, sponsorship,
endorsement or partnership unless the center publishes an official
announcement.

No customer counts, uptime percentages or market-share claims are published.
Earlier `sbay.sa` figures describe independent freelance activity evidenced
only by scattered invoices and transfers, so they are excluded from every
investor-facing surface. Procurement modules are presented as enterprise platform
scope, and detailed availability is confirmed through the live demo and
contract. AI capabilities are framed as decision support rather than
guaranteed automation.

This repository does not contain model weights, training data, tokenizers,
expert maps, routing thresholds, private topology, credentials, private patent
claims, or proprietary source code. Run the disclosure gate before publishing:

```powershell
npm ci
npm run check
```

The `Public disclosure boundary` workflow also runs `npm audit`, rebuilds the
deterministic release manifest and uploads a retained
`public-boundary-security-evidence-<commit>` artifact. Report conventions are
documented in `security/reports/README.md`.

Media capture uses a fresh headless Edge context and public, unauthenticated
pages only:

```powershell
npm run capture
npm run capture:adjudication
npm run manifest
```

SBAY is an independent participant. This repository is not an official LEAP,
DeepFest, Tahaluf, SDAIA, or MCIT website and does not imply sponsorship,
endorsement, or partnership.
