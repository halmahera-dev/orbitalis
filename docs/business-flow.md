# Business Flow: Orbitalis

Status: Draft. Date: 15 November 2026. Scope: the product after the NASA Space Apps hackathon. Source documents: [PRD](prd-orbitalis.md) and [HLD](hld-orbitalis.md).

This document shows who does what, in what order, and what each step gives to the next. The HLD tells how the system is built. The PRD tells what each feature must do.

## 0. Flows in the app today

Each need has one path through the app. Sections 4 to 9 show the full target flows.

| Need | User | Path in the app | Ends with |
| --- | --- | --- | --- |
| N1 Illegal pump hints | Dinas SDA, Badan Geologi | Map, **Pump leads** layer, triage list (sort by signal, rate, people), bowl panel or bowl page | Schedule visit, then outcome: pump found, no pump, natural compaction |
| N2 Fast sinking, needs injection | KemenLH, Dinas SDA | Map, **Recharge** layer, ranked cells (sinking × people), cell panel | Recharge plan: proposed, surveyed, approved, built. CSV export |
| N3 Pipe extension with people count | PAM Jaya | Map, **Pipes** layer, ranked cells (people without pipes), cell panel | Pipe plan with the same steps. CSV export |
| N4 Water farming monitoring | KemenLH, DLH | Map, **Water farming** layer (58 public water bodies), red sites need a visit. Or Bowls desk, type "Water farming sites" | Schedule visit, then outcome: measures working, measures failing |
| N5 Developer planning | Developers | Map, any cell, **Site report** | Printable report: rate, depth by 2035 and 2050, people, nearest lead and water body, rules |
| N6 Buy or sell a house | Public | Landing, **Check an area** (`/check`, no sign-in), tap the map or use my location | Plain class (slow, medium, fast), cm per year, what it means and does not mean |

The **Start** page (`/start`, in the sidebar) shows these six needs as cards. A card opens the map on the right layer, or the area check. On the map, a click on a pump lead opens its 3D bowl page.

The Overview shows the open pump leads, the triage list, water farming site status, and the progress of both plans.

## 1. Actors

| Actor                 | Organization                              | Role in the flow                                                                                                                       |
| --------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Orbitalis operator    | Orbitalis team                            | Runs the processing jobs every NISAR pass. Publishes layers. Answers data questions.                                                   |
| Groundwater regulator | Pemprov DKI, Dinas Sumber Daya Air        | Acts on pumping leads. Enforces Pergub 93/2021 zones.                                                                                  |
| Permit authority      | Badan Geologi (ESDM)                      | Owns the groundwater permit registry (Kepmen ESDM 291.K/GL.01/MEM.G/2023: a permit above 100 m³ per month). Revokes or audits permits. |
| Inspector             | Dinas SDA or Badan Geologi                | Visits sites. Records what they found.                                                                                                 |
| Water utility planner | PAM Jaya                                  | Plans pipe extension to reach 100% coverage by 2029.                                                                                   |
| Environment officer   | KemenLH and regional DLH                  | Owns the water farming rule. Registers sites, checks compliance, gives sanctions. Plans recharge with Dinas SDA.                       |
| Groundwater user      | Households, offices, industry, businesses | Holds a permit. Does water farming measures. Declares them.                                                                            |
| Developer             | Real-estate company                       | Asks for a site report before land purchase or design.                                                                                 |
| Home buyer or seller  | The public                                | Checks an area before a deal.                                                                                                          |

## 2. Value exchange

```mermaid
flowchart LR
    OP[Orbitalis] -->|pumping leads, evidence| REG[Dinas SDA]
    OP -->|leads near permitted wells, over-use hints| BG[Badan Geologi]
    OP -->|pipe priority, people served, groundwater avoided| PAM[PAM Jaya]
    OP -->|recharge priority, site compliance status| KLH[KemenLH and DLH]
    OP -->|site report| DEV[Developer]
    OP -->|area check| PUB[Public]

    BG -->|permit registry| OP
    PAM -->|service area and network| OP
    KLH -->|water farming site registry| OP
    REG -->|inspection outcomes| OP
    NASA[NASA, ISRO, ASF, ESA] -->|free NISAR and Sentinel data| OP
```

Agency data comes back into Orbitalis and makes the next scores better. Inspection outcomes are the most important feedback: each "pump found" or "no pump" result tests the lead score.

## 3. Core cycle: one NISAR pass

NISAR passes over Jakarta every 12 days. Every product in Orbitalis refreshes on this cycle.

```mermaid
flowchart TB
    A[NISAR pass released on ASF] --> B[Operator runs jobs: ingest, time series, vertical motion]
    B --> C{Quality gate: coherence, reference point, noise floor}
    C -- fails --> D[Keep previous layers. Mark pass as low quality in the pass timeline]
    C -- passes --> E[Update bowls, groundwater balance, priority scores]
    E --> F[Publish layers with evidence records]
    F --> G[Overview shows what changed since the last pass]
    G --> H1[Regulator: new or rising leads]
    G --> H2[PAM Jaya: pipe priority changes]
    G --> H3[KemenLH: sites with a rate change]
    G --> M[Pass digest email per role, and area watch messages]
```

Exit of the cycle: the Overview lists rank up, rank down, new bowls, slowing bowls, and sites that changed. The same list goes out as one digest email per role (F20), so users do not need to open the app to know they must act. Each user starts their flow from there, on the map layer for their role.

## 4. Flow N1: from pumping hint to enforcement

```mermaid
sequenceDiagram
    actor R as Regulator (Dinas SDA)
    participant O as Orbitalis
    actor I as Inspector
    actor B as Badan Geologi

    O->>O: Score bowls: rate, depth, change after the ban, extraction ratio, permits nearby
    O->>R: Ranked leads, each "lead for inspection, not proof of a pump"
    R->>O: Open lead, read evidence and 3D twin
    alt Lead is weak
        R->>O: Dismiss with reason
    else Lead is strong
        R->>O: Schedule visit, assign inspector
        O->>I: Visit in the inspector's list
        I->>O: Record outcome: pump found, no pump, natural compaction
        alt Pump found, no permit
            O->>R: Case report with evidence
            R->>B: Send case report: unlicensed well
            B-->>R: Seal or permit process
        else Pump found, permit exists
            O->>R: Case report with evidence
            R->>B: Send case report: possible over-use
            B-->>R: Permit audit
        else No pump or natural compaction
            R->>O: Close case
        end
        O->>O: Outcome feeds the score check
    end
```

Rules:

- A lead never names a person or a company. The inspector finds the facts on site.
- A bowl with no inspection record is a lead.
- A closed case stays visible in the bowl history. If the bowl keeps sinking after a "no pump" result, it comes back as a lead at the next pass with a note.

## 5. Flow N2: recharge and injection planning

```mermaid
flowchart TB
    A[Recharge priority list: fast sinking, people exposed, year below high tide] --> B[Officer opens an area]
    B --> C[Read suitability: soil, water table, aquifer access, suggested method]
    C --> D{Suitable?}
    D -- no --> E[Mark as unsuitable. Suggest pipe extension or stricter enforcement instead]
    D -- yes --> F[Add to plan: recharge well, biopore field, or injection well]
    F --> G[Field survey]
    G --> H{Survey confirms?}
    H -- no --> E
    H -- yes --> I[Approved, then built. Status updated in the plan]
    I --> J[Monitor the local rate each NISAR pass]
    J --> K[Report: rate before and after the build]
```

Owners: KemenLH or DLH plan recharge, Dinas SDA builds public injection wells. The priority list is a screening tool. Only a field survey approves a site.

## 6. Flow N3: pipe extension planning

```mermaid
flowchart TB
    A[Pipe priority list per area] --> B[Planner sorts by people served or groundwater avoided]
    B --> C[Open area: unserved population, demand gap, sinking rate, distance to main]
    C --> D[Compare scenarios: pipes by 2029 vs current trend]
    D --> E[Add area to the pipe plan]
    E --> F[Planner exports the list for the PAM Jaya capital plan]
    F --> G[After build: coverage data updated]
    G --> H[Demand gap falls. Orbitalis checks that the local sinking slows]
    H --> I{Still sinking?}
    I -- yes --> J[Area returns to the pumping lead list for the regulator]
    I -- no --> K[Success shown on the Overview]
```

The handover between N3 and N1 matters: if an area has pipes but still sinks, people still pump. That is a strong pumping hint.

## 7. Flow N4: water farming monitoring

```mermaid
sequenceDiagram
    actor U as Groundwater user
    actor K as KemenLH or DLH officer
    participant O as Orbitalis
    actor I as Inspector

    U->>O: Use the calculator: which measures does my site need?
    K->>O: Register site: polygon, scale (micro or macro)
    O->>O: Calculator gives required measures
    U->>K: Declare measures: tank volume, biopores, embung, vegetation area
    K->>O: Enter declared measures and start date
    O->>O: Compare declared with required. Expected recharge volume per year
    loop Every month
        O->>O: Optical check: open water in embung, vegetation cover
    end
    O->>K: Site status: verified, needs visit, or non-compliant
    loop Every NISAR pass
        O->>O: Area check: rate change in high-adoption areas vs control areas
    end
    O->>K: Impact per area: slowed by X mm/yr more than control areas
    alt Needs visit
        K->>O: Schedule visit
        I->>O: Record result
    end
    K->>U: Confirmation or sanction (outside Orbitalis)
```

Site status and impact are separate. Site status says whether one user does the measures. Impact says whether the policy slows the sinking, and only area groups can show it. Success means the sinking slows, not that the ground rises.

The rule is a draft in November 2026. The flow uses the press release terms. Update this flow when KemenLH publishes the final regulation.

## 8. Flow N5: developer site report

```mermaid
flowchart LR
    A[Developer signs in] --> B[Draw a parcel or pick an address]
    B --> C[Report: sinking rate, projected depth to 2050, year below high tide, local groundwater balance]
    C --> D[Rules that apply: groundwater permit above 100 m³ per month, water farming measures from the calculator]
    D --> E[Suggested measures: piped connection, recharge, foundation note]
    E --> F[Share or download the report]
```

The report is a screening document. It is not a geotechnical survey and not a legal opinion. Each report carries the data dates and the label "at current assumptions".

## 9. Flow N6: public area check

```mermaid
flowchart LR
    A[Visitor opens the area check] --> B[Type an address or tap the map]
    B --> C[Coarse cell: rate class, trend since 2023, projection to 2035]
    C --> D[Plain text: what it means, what it does not mean]
    D --> E[Links: how subsidence works, how to save groundwater, PAM Jaya connection]
```

The area check shows cells, not buildings. It never says "do not buy". It gives facts and limits.

## 10. Hand-offs between flows

| From              | To              | Trigger                                                            |
| ----------------- | --------------- | ------------------------------------------------------------------ |
| N3 pipe built     | N1 pumping lead | Area has pipes, but sinking does not slow                          |
| N1 "no pump"      | N2 recharge     | Natural compaction or old pumping. Recharge may help               |
| N4 non-compliant  | N1 pumping lead | Site extracts but does not recharge                                |
| N2 recharge built | N4 monitor      | A public recharge site uses the same monitoring checks             |
| Any desk          | Core cycle      | New agency data (permits, coverage, sites) enters at the next pass |

## 11. Business rules

1. A lead is a reason to inspect. It is never proof. All UI and exports say so.
2. Projections use stated assumptions and say "at current assumptions".
3. No personal names in leads, the public area check, or the repo.
4. Agency data stays inside the agency roles that own it.
5. Satellite checks support field checks. They never close a case alone.
6. Each number links to its source, dates, and method.

## 12. Open business decisions

1. Operating model: one agency hosts Orbitalis (for example KemenLH as the national owner), or each agency subscribes.
2. Price for developer reports: free during a pilot, then paid, or always free.
3. Data agreements with Badan Geologi (permits) and PAM Jaya (network). Who signs, and what each side gets.
4. Who receives non-compliance results from N4: KemenLH centrally, or each DLH.
5. Whether the public area check launches before the agency desks, or after a pilot.
