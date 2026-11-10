# Security policy

## Reporting a vulnerability

Please report security problems privately, not in a public issue: use
GitHub's "Report a vulnerability" (Security tab → Advisories), or email the
maintainers at the address in the repository profile. Include what you found,
how to reproduce it, and the version or image digest affected.

We acknowledge reports within 3 working days, give a first assessment within
10, and tell you when a fix is released. We credit reporters who want it.

## Supported versions

Only the latest release receives security fixes. Every release image ships
with an SBOM and build provenance, and release tags are signed with cosign
(see `.github/workflows/ci.yml`), so you can check what an image contains and
where it came from:

```sh
cosign verify ghcr.io/<owner>/<repo>@<digest> \
  --certificate-identity-regexp 'https://github.com/<owner>/<repo>/' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
docker buildx imagetools inspect ghcr.io/<owner>/<repo>@<digest> --format '{{ json .SBOM }}'
```

## For products built on this starter

The EU Cyber Resilience Act's reporting obligations apply from 11 September
2026: actively exploited vulnerabilities and severe incidents must be reported
to ENISA through the single reporting platform. Keep this file's contact
current, and keep the SBOM of every image you deliver.
