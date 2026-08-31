# منصة تموين sbay — LEAP + DeepFest 2026

Independent, bilingual enterprise platform brief presenting **منصة تموين
sbay / SBAY Tamween** during LEAP and DeepFest 2026 in Riyadh,
31 August–3 September 2026.

Live targets:

- Primary hardened domain: `https://leap2026.sbay.sa`
- Repository mirror: `https://sbay-dev.github.io/leap2026-pressroom/`

The custom domain is served through Cloudflare and applies the checked-in
security headers. Its `no-transform` cache directive prevents edge analytics
injection, while the CSP grants only the narrow WebAssembly compilation
capability required by the public equality proof. GitHub Pages does not support
repository-defined response headers, so the mirror uses GitHub's default
headers and is not the canonical security boundary.

The narrative follows:

`Problem → Platform → Intelligence → Outcomes → Vision`

The primary positioning is an enterprise AI procurement and supply platform.
Ksar, NewsBoy, CP, Sarmad, CNS and QdrantServer appear only as bounded operating
or technical evidence.

Public figures (`25+`, `500+`, `99.9%`, `24/7`) are tied to a captured
`sbay.sa` source. Procurement modules are presented as enterprise platform
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

Media capture uses a fresh headless Edge context and public, unauthenticated
pages only:

```powershell
npm run capture
npm run manifest
```

SBAY is an independent participant. This repository is not an official LEAP,
DeepFest, Tahaluf, SDAIA, or MCIT website and does not imply sponsorship,
endorsement, or partnership.
