# Engineering Case Studies

These case studies document production engineering work from two public projects:

- **KK Archive** — a production Next.js application for structured content browsing, search, authentication, file delivery, and administration.
- **ShalltyUtils Compatibility Fork** — maintenance work adapting an existing C# plugin to an upstream Timeline API breaking change.

The articles focus on concrete engineering decisions, implementation evidence, trade-offs, and limitations rather than tutorial-style summaries.

## Case Studies

1. [Reducing Database and Request Pressure in a Production Next.js Application](./production-performance.md)
   - Production performance investigation
   - Session/rendering separation
   - Public caching and tag-search caching
   - Database indexes, runtime region, and R2 caching
   - Observed page-load reduction from ~5s to ~1s and ~35% fewer Vercel Function Invocations during the optimization period

2. [Turning a Production Cost Incident into an Automated Guardrail](./image-cost-guardrail.md)
   - Vercel image-transformation cost risk
   - Narrow production hotfix
   - Explicit infrastructure trade-off
   - Automated source/configuration guardrail
   - Mandatory pre-push verification

3. [Reducing Anonymous Session Requests Without Weakening Authentication](./session-optimization.md)
   - Browser-side request reduction
   - Client-readable session-presence hint
   - Separation of UI cache, performance hints, and authentication authority
   - Server-side session and role enforcement preserved

4. [Maintaining a Compatibility Fork After an Upstream API Breaking Change](./upstream-api-compatibility.md)
   - Runtime API detection
   - Backward compatibility
   - Adaptation to changed return semantics
   - Narrow defensive recovery for a known resolver failure

## Projects

- [KK Archive repository](https://github.com/Mmc1xs/KK-Archive)
- [KK Archive production site](https://koikatsucards.com/)
- [ShalltyUtils compatibility fork](https://github.com/Mmc1xs/ShalltyUtils)

## Notes on Evidence

Implementation links point to public GitHub commits or commit-pinned source files where possible. Historical production measurements that can no longer be retrieved from provider dashboards are explicitly labeled as observed measurements rather than currently reproducible benchmarks.
