# Modelo de datos

La fuente de la verdad es `prisma/schema.prisma`. Este diagrama la resume; si cambia el esquema, actualizarlo en el mismo pull request.

```mermaid
erDiagram
    ClientType ||--o{ Company : "clasifica"
    ClientType |o--o{ CatalogItem : "restringe"
    Service ||--o{ CatalogItem : "agrupa"
    Service |o--o{ Problem : "afecta"
    Company |o--o{ User : "emplea"
    Company ||--o{ Ticket : "reporta"
    CatalogItem ||--o{ Ticket : "clasifica"
    User ||--o{ Ticket : "solicita"
    User |o--o{ Ticket : "atiende"
    User |o--o{ Ticket : "aprueba"
    Problem |o--o{ Ticket : "agrupa"
    Ticket ||--o{ Comment : "tiene"
    User ||--o{ Comment : "escribe"
    Ticket ||--o{ TicketEvent : "registra"
    User |o--o{ TicketEvent : "provoca"
    User |o--o{ Problem : "investiga"

    ClientType {
        string code UK "VIP o NORMAL"
        Priority minPriority "piso de prioridad"
        boolean alwaysAttended
        int_array workingDays
        int dayStartMinute
        int dayEndMinute
        int responseCommitMinutes
        int responseAlertMinutes
        int escalationMinutes
    }
    Company {
        string name UK
        string clientTypeId FK
    }
    User {
        string email UK
        string passwordHash "scrypt"
        Role role "CLIENT AGENT SUPERVISOR ADMIN"
        int supportLevel "solo AGENT"
        string companyId FK "solo CLIENT"
        boolean active
    }
    Service {
        string code UK
        ServiceKind kind "CORE SUPPORT ATTENTION"
    }
    CatalogItem {
        string code UK "I-1 a I-18, S-1 a S-5"
        TicketType type
        string serviceId FK
        string clientTypeId FK "opcional"
        Impact defaultImpact
        Urgency defaultUrgency
        string approvalQuestion "opcional"
        boolean isOther "Otro de cada servicio"
    }
    Ticket {
        int number UK "número del ticket"
        string_array tags "máximo 5"
        TicketType type
        string catalogItemId FK
        Impact impact
        Urgency urgency
        Priority priority "calculada"
        TicketStatus status
        int level
        string requesterId FK
        string companyId FK
        string assigneeId FK
        boolean requiresApproval
        string approvedById FK
        string problemId FK
        datetime responseDueAt
        datetime resolutionDueAt
        datetime firstResponseAt
        datetime resolvedAt
        datetime closedAt
    }
    Comment {
        string ticketId FK
        string authorId FK
        boolean internal "solo personal"
        CommentKind kind "NOTE o nota de una acción"
    }
    TicketEvent {
        string ticketId FK
        string actorId FK
        TicketEventKind kind
        string fromValue
        string toValue
    }
    Problem {
        int number UK
        ProblemStatus status
        string rootCause
        string workaround
        string serviceId FK
        string ownerId FK
    }
    PriorityRule {
        Impact impact PK
        Urgency urgency PK
        Priority priority
    }
    PriorityLevel {
        Priority priority PK
        int responseMinutes
        int resolutionMinutes
        int updateEveryMinutes
    }
```

Todas las tablas usan un `id` de texto como llave primaria, salvo `PriorityRule` y `PriorityLevel`; el diagrama lo omite.

## Enumeraciones

| Nombre | Valores |
|---|---|
| `Role` | CLIENT, AGENT, SUPERVISOR, ADMIN |
| `TicketType` | INCIDENT, SERVICE_REQUEST |
| `TicketStatus` | OPEN, IN_PROGRESS, ESCALATED, RESOLVED, CLOSED |
| `Impact` y `Urgency` | HIGH, MEDIUM, LOW |
| `Priority` | P1 a P5 |
| `ServiceKind` | CORE, SUPPORT, ATTENTION |
| `CommentKind` | NOTE, RESOLUTION, REOPENING, CLOSURE, ESCALATION, APPROVAL_REQUEST |
| `TicketEventKind` | CREATED, STATUS_CHANGED, ASSIGNED, PRIORITY_CHANGED, LEVEL_CHANGED, APPROVED, PROBLEM_LINKED, CATEGORY_CHANGED, APPROVAL_REQUESTED |
| `ProblemStatus` | IDENTIFIED, DIAGNOSING, KNOWN_ERROR, SOLUTION_PROPOSED, CLOSED |

## Grupos de tablas

* **Reglas del servicio.** `ClientType`, `PriorityRule`, `PriorityLevel`, `Service` y `CatalogItem`. Las carga `prisma/seed.ts` y el código las lee; no se editan desde la aplicación.
* **Personas.** `Company` y `User`. El tipo de cliente pertenece a la empresa; un usuario cliente pertenece a una empresa, y el personal de soporte no.
* **Atención.** `Ticket`, `Comment`, `TicketEvent` y `Problem`.

## Decisiones del modelo

* **`PriorityRule` y `PriorityLevel` no tienen relación con `Ticket`.** La prioridad se calcula al crear el ticket y se guarda en él; las reglas solo se consultan.
* **El ticket guarda sus vencimientos.** Así el SLA queda como dato y no solo en lógica, que fue una debilidad del backend de TechSupport Pro señalada en la Fase 1.
* **`TicketEvent` es el historial.** Cada cambio de estado, asignación, prioridad, nivel, elemento del catálogo, aprobación o problema deja un registro, en la misma transacción que el cambio. De ahí sale, por ejemplo, la primera transición a IN_PROGRESS que mide el SLO 2.
* **`Comment.kind` distingue de dónde sale un comentario.** Un comentario escrito a mano es NOTE; las notas obligatorias de una acción llevan su tipo, para etiquetarlas en el hilo. Que sea pública o interna lo decide `internal`.
* **`CatalogItem.isOther` marca el "Otro" de cada servicio,** para reconocerlo en la pantalla y, más adelante, en las estadísticas.
* **`Ticket.tags` es una lista de texto,** ya normalizada al guardarse, que alimentará las estadísticas por etiqueta.
* **El número del ticket es global,** una sola secuencia para todo el sistema, y no se reutiliza si un ticket se borra.
* **Borrados.** Al borrar un ticket se borran sus comentarios y eventos. Al borrar un problema, sus tickets quedan sin problema y no se borran.
