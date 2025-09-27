# Mermaid Tests

> Paste this whole file into your editor. It contains multiple Mermaid code fences.  
> Try toggling light/dark theme and varying container widths to spot layout issues.

## 1) Flowchart — Basics
```mermaid
flowchart LR
  A[Start] --> B{Auth?}
  B -- Yes --> C[Dashboard]
  B -- No  --> D[Login Form]
  C --> E[🍪 Cookies OK?]
  E -- "Missing/Expired" --> F[[Re-issue Token]]
  E -- "Valid" --> G((Done))
  D --> H[/Reset Password/]
  H --> D
```

### 1.1) Flowchart — Subgraphs, Links, Styling, Wrap
```mermaid
flowchart TD
  %% Long labels + line breaks via <br/>
  subgraph CLUSTER_1["User-Facing <br/> Services"]
    direction LR
    UI["Web UI<br/><small>Next.js SSR</small>"]:::svc
    API["Public API<br/><small>REST & GraphQL</small>"]:::svc
    CDN[(CDN)]:::infra
    UI -->|fetch| API
    UI --> CDN
  end

  subgraph CLUSTER_2["Core Platform"]
    direction TB
    SVC_A["Auth Service"]:::svc --> DB[(Postgres)]:::db
    SVC_B["Billing"]:::svc --> QUEUE[(Event Bus)]:::infra
    API --> SVC_A
    API --> SVC_B
  end

  click UI "https://example.com" "Open UI site"
  classDef svc fill:#e0f2fe,stroke:#0284c7,color:#0c4a6e,rx:6,ry:6
  classDef db fill:#d1fae5,stroke:#10b981,color:#065f46,rx:5,ry:5
  classDef infra fill:#fef9c3,stroke:#eab308,color:#713f12,rx:4,ry:4

  %% Edges with labels
  CDN -. cache miss .-> UI
  QUEUE -- "pub/sub" --> SVC_B
```

---

## 2) Sequence Diagram — Interactions
```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant W as Web App
  participant A as Auth
  participant S as Storage

  U->>W: GET /dashboard
  activate W
  W->>A: Validate session
  activate A
  A-->>W: OK (JWT)
  deactivate A
  W->>S: Fetch widgets
  activate S
  Note right of S: May be slow on cold cache
  S-->>W: Result set
  deactivate S
  W-->>U: 200 OK + HTML
  deactivate W

  alt Token expired
    W->>A: Refresh token
    A-->>W: 401 Unauthorized
    W-->>U: 302 Redirect to /login
  else Token valid
    W-->>U: Continue session
  end

  loop Heartbeat every 30s
    U->>W: /keepalive
    W-->>U: 204 No Content
  end
```

---

## 3) Class Diagram — Domain Model
```mermaid
classDiagram
  class User {
    +Guid id
    +string email
    +string displayName
    +setRole(role: Role): void
  }

  class Role {
    +string name
    +string[] permissions
  }

  class Session {
    +string jwt
    +DateTime expiresAt
    +renew(): Session
  }

  class Repository~T~ {
    +getById(id: Guid): T
    +save(entity: T): void
    +delete(id: Guid): void
  }

  User "1" --> "many" Session : has
  User "many" -- "many" Role : assigned
  Repository~User~ ..> User
  Repository~Role~ ..> Role
```

---

## 4) State Diagram — App Lifecycle
```mermaid
stateDiagram-v2
  [*] --> Idle
  Idle --> Loading : route change
  Loading --> Ready : data resolved
  Ready --> Editing : user clicks "Edit"
  Editing --> Ready : save
  Ready --> Error : API 5xx
  Error --> Ready : retry

  state Ready {
    [*] --> Viewing
    Viewing --> Filtering : search
    Filtering --> Viewing : clear
    state Viewing {
      [*] --> List
      List --> Details : open item
      Details --> List : back
    }
  }
```

---

## 5) Entity-Relationship (ER) Diagram
```mermaid
erDiagram
  USER ||--o{ SESSION : "has"
  USER {
    GUID id PK
    VARCHAR email UK
    VARCHAR name
  }
  SESSION {
    GUID id PK
    GUID userId FK
    TIMESTAMP expiresAt
  }
  POST ||--o{ COMMENT : receives
  POST {
    GUID id PK
    TEXT title
    TEXT body
    TIMESTAMP publishedAt
  }
  COMMENT {
    GUID id PK
    GUID postId FK
    TEXT body
    VARCHAR author
  }
```

---

## 6) Gantt Chart — Release Plan
```mermaid
gantt
  title Q4 Release Plan
  dateFormat  YYYY-MM-DD
  excludes    weekends

  section Planning
  Spec & Scope       :a1, 2025-10-01, 5d
  Architecture Review:a2, after a1, 3d

  section Build
  Frontend           :b1, 2025-10-10, 10d
  API                :b2, 2025-10-12, 12d
  Integrations       :b3, after b2, 6d

  section QA
  Test Plan          :c1, 2025-10-20, 3d
  E2E + Perf         :c2, after b1, 7d

  section Launch
  Release Candidate  :d1, 2025-11-05, 2d
  GA                 :milestone, d2, 2025-11-10, 0d
```

---

## 7) Pie Chart — Traffic Mix
```mermaid
pie showData
  title Traffic by Source
  "Direct" : 37
  "Organic" : 42
  "Referral" : 12
  "Paid" : 9
```

---

## 8) Journey Diagram — UX Sentiment
```mermaid
journey
  title New User Onboarding
  section Landing
    See Pricing: 3: 🙂
    Read Docs: 4: 🙂
  section Signup
    Create Account: 2: 😐
    Email Verify: 1: 😖
  section First Run
    Import Data: 2: 😐
    See Value: 5: 🤩
```

---

## 9) Mindmap — Feature Ideas
```mermaid
mindmap
  root((Blog Platform))
    Editor
      Rich Text
      Code Blocks
        Syntax Highlight
        Copy Button
      Media
        Images
        Video
        Audio
    Import/Export
      WXR Import
      Markdown Export
    Perf
      Caching
      Lazy Load Images
    Admin
      Users
      Roles
      Audit Log
```

---

## 10) Timeline — Notable Events
```mermaid
timeline
  title Product Timeline
  2024 : MVP conceived : First prototype
  2025-02 : Private alpha
  2025-05 : Public beta
  2025-09 : v1.0 launch
```

---

## 11) Quadrant Chart — Strategy
```mermaid
quadrantChart
  title Investment Priorities
  x-axis Low Effort --> High Effort
  y-axis Low Impact --> High Impact
  quadrant-1 "Quick Wins"
  quadrant-2 "Big Bets"
  quadrant-3 "Defer"
  quadrant-4 "Revisit"

  A(Autosave)       : 0.2, 0.7
  B(Import Wizard)  : 0.6, 0.9
  C(Theme Builder)  : 0.8, 0.6
  D(Offline Mode)   : 0.9, 0.3
```

---

## 12) Requirement Diagram — Spec Traceability
```mermaid
requirementDiagram
  requirement R1 {
    id: R1
    text: "User shall be able to reset password via email link"
    risk: high
    verifymethod: test
  }
  requirement R2 {
    id: R2
    text: "System shall log authentication failures"
    risk: medium
    verifymethod: inspection
  }
  element LoginService {
    type: "Service"
  }
  element AuditSink {
    type: "Infra"
  }
  LoginService - satisfies -> R1
  AuditSink - verifies -> R2
```

---

## 13) Git Graph — Branching Model
```mermaid
gitGraph
  commit id: "init"
  branch feature/auth
  commit tag: "scaffold"
  checkout main
  commit
  checkout feature/auth
  commit
  checkout main
  merge feature/auth id: "merge-auth"
  branch hotfix/1.0.1
  commit
  checkout main
  merge hotfix/1.0.1
```

---

## 14) Flowchart — Stress Test (Wide, Nested, RTL)
```mermaid
flowchart RL
  subgraph Outer["🧪 Stress Container (RTL)"]
    direction RL
    subgraph InnerA["A"]
      A1["A1 very very long label that should wrap if htmlLabels are enabled"] --> A2["A2"]
    end
    subgraph InnerB["B"]
      B1["B1"] --- B2["B2"]:::hot
      B2 -->|edge with **markdown**| B3["B3"]
    end
    A2 == wrapped ==>> B1
  end

  classDef hot fill:#fee2e2,stroke:#ef4444,color:#7f1d1d,stroke-width:2px
```

---

## Notes & Tips
- If some diagrams fail to render, your Mermaid version may not support that diagram type.  
  Consider upgrading to **Mermaid v10+**.
- For security, some renderers disallow `click` callbacks or external links—use the static designs above if so.
- If your editor sanitizes HTML, `classDef`-based styling still works without raw HTML.

*End of test file.*
