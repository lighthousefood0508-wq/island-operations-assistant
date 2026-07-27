# Back Office UX Blueprint v1.0

**Architecture Owner:** Miles / 林子茂
**Status:** UX blueprint approved for design alignment. It is not an implementation approval.

## Authority and Boundary

This document is the single UX source for ROS Back Office page purpose, navigation, operator flow, and state-aware presentation.

It does not override, amend, or replace:

- `CONSTITUTION.md`;
- Accepted ADRs;
- an Architecture Owner Decision; or
- a separately approved API, schema, migration, or Business Rule specification.

When the Blueprint and a higher authority differ, the higher authority wins and this Blueprint must be updated before related implementation continues.

## 1. System Positioning

Back Office is the daily operating center for a one-person food truck. It is not a POS, ERP, or generic administration screen.

Its organizing principle is the **Current Event**. The operator first knows which Event is being managed, then performs the work appropriate to that Event.

```text
Choose Current Event
        ↓
Prepare Event products and quantities
        ↓
Open service
        ↓
Operate POS and Kitchen
        ↓
Pause only when an operational adjustment is needed
        ↓
Closeout, waste confirmation, and Event close
        ↓
Review statistics and past Event analysis
```

Catalog is deliberately a separate, low-frequency management concern. It is available from Back Office, but it is not the daily operating starting point.

## 2. Information Architecture

Back Office has exactly six primary pages. No additional primary page may be added without an Architecture Owner Decision.

1. **Event** - highest operational control and Current Event selection.
2. **Stock** - selected Event products and sellable quantities.
3. **Product Catalog** - global Catalog master data.
4. **Today Statistics** - selected Event operational and closeout read model.
5. **Event Analysis** - selected Event compared with prior Events; honest placeholder until enabled.
6. **System Status and Device Connection** - server, central data, sharing, and connected-device visibility.

The fixed Header and Current Event context appear on every Back Office page. The six-page navigation appears below that context.

## 3. Page Responsibilities

### 3.1 Event

**Purpose**

Select and control the Event that provides the current Back Office operating context.

**Responsibilities**

- Create an Event from operator-entered date, name, start time, and end time.
- Select an existing Event.
- Show Event name, operational status, date, and time.
- Present state-valid controls for start service, pause, resume, and begin closeout.
- Show a dense Event list containing name, status, date, and time.

**Out of Scope**

- Product master maintenance.
- Per-product quantity editing.
- POS ordering.
- Kitchen production actions.
- Financial reporting details.

### 3.2 Stock

**Purpose**

Manage the products offered and sellable quantities for the selected Event.

**Responsibilities**

- Show Event product snapshot information needed by the operator.
- Show and manage preparation quantity and safety buffer when the current Event state allows it.
- Show customer-available quantity, sold quantity, and remaining quantity as central read values.
- Add an already-published Catalog product to the selected Event when the current Event state allows it.
- Temporarily disable a product for the selected Event.
- Save the operator's quantity edits as one clearly-confirmed page action.

**Out of Scope**

- Product price, product description, product category, or publication management.
- Editing Catalog data from the Event screen.
- Independent browser-side inventory calculations.
- Cross-Event history and analysis.

### 3.3 Product Catalog

**Purpose**

Manage long-lived, whole-business Catalog master data.

**Responsibilities**

- Product category management.
- Full product name and POS short name.
- Sale price and customer-facing description.
- Channel settings.
- Draft, publication, version visibility, and deactivation.
- Delete a draft only when the applicable product-lifecycle rule allows deletion.
- Display a system-generated identifier as read-only system information.

**Out of Scope**

- Selected Event preparation quantity.
- Current Event remaining quantity, sales, reservation, or order counts.
- Daily closeout.
- Event-specific temporary product disablement.

The Header still shows the Current Event for operator orientation, but Catalog content does not change with Event state and must not display Event inventory.

### 3.4 Today Statistics

**Purpose**

Give the operator a clear read-only view of the selected Event's current operational result and closeout state.

**Responsibilities**

- Show central order count, ledger amount, unresolved count, cancelled count, no-show count, and actual-receipt difference when those values are available.
- Show selected Event product preparation, sold, waste, and retained/remaining presentation as approved.
- Show selected Event order content.
- Render no-data numeric values as `0` or `NT$0`, never `null`.

**Out of Scope**

- Editing products, prices, quantities, or Orders.
- Cross-Event comparison.
- Cost, margin, BOM, or Cost Domain calculation.
- Treating browser data as report truth.

### 3.5 Event Analysis

**Purpose**

Provide future comparison of the selected Event against prior Events without cluttering daily operations.

**Responsibilities**

- Identify the selected Event being analysed.
- Clearly state `Not enabled` until a separately approved analysis read model exists.
- Eventually compare approved historical measures only.

**Out of Scope**

- Pretending a report exists before it is implemented.
- Daily Event setup.
- Editing Event, Stock, Product, or Order data.
- Forecasting, AI, Cost, or financial inference.

### 3.6 System Status and Device Connection

**Purpose**

Let the owner verify that the central ROS service and connected devices are ready for multi-device operation.

**Responsibilities**

- Display ROS server, central SQLite, API, SSE, and external entry health as actually known.
- Display available share/open links and device connection information.
- Display a clear distinction between connected, reconnecting, offline, and unknown states.

**Out of Scope**

- Pretending the browser can prove a background tunnel process is alive.
- Device authorization, account management, or a new authentication domain.
- Order, inventory, Catalog, or Event mutation.

## 4. Fixed Header

The Back Office Header is always present and always answers: **what Event am I operating now?**

It contains:

- Current Event name;
- current operational status: Draft, Open, Paused, or Closed;
- Event date;
- Event start and end time; and
- a compact system entry point.

It does not contain cashier revenue, cost, gross margin, or product-management forms.

When no Event is selected, it explicitly says that no Current Event is selected and directs the operator to the Event page. It must not silently reuse an old browser selection.

## 5. Navigation and Context

### Navigation model

```text
Back Office
  ├─ Event
  ├─ Stock
  ├─ Product Catalog
  ├─ Today Statistics
  ├─ Event Analysis
  └─ System Status and Device Connection
```

- The active page is visually distinct.
- Breadcrumb format is `Back Office / <current page>`.
- Current Event context is displayed before page navigation, not hidden inside one tab.
- Page changes do not change the Current Event by themselves.
- Selecting another Event refreshes every Event-dependent page from central data.
- Product Catalog remains global: it is navigable while any Event is selected, but its data is not filtered or mutated by that Event.
- System Status and Device Connection remains system-wide: it keeps the Header context for orientation but does not present Event data as a device-health source.

## 6. Back Office Workflow

### Daily operating loop

```text
Create or select Event
        ↓
Configure Event Stock
        ↓
Start service
        ↓
POS creates central Orders
        ↓
Kitchen advances production
        ↓
Read Today Statistics as needed
        ↓
Pause service only when adjustment is required
        ↓
Adjust Stock and confirm page save
        ↓
Resume service
        ↓
Begin closeout
        ↓
Confirm per-product waste and retained quantity
        ↓
Formally close Event
        ↓
Review Today Statistics and Event Analysis
```

### Catalog workflow

```text
Product Catalog
        ↓
Create or edit Draft
        ↓
Publish a formal version
        ↓
Event Stock
        ↓
Choose an already-published product for the selected Event
```

Catalog publication never silently changes an already-selected Event product snapshot.

## 7. Operational State Presentation

The Blueprint uses four daily operating states. The exact persistence and lifecycle enforcement remain subject to approved architecture and implementation scope.

| State | Operator can do | Operator cannot do |
| --- | --- | --- |
| **Draft** | Edit Event details, configure Stock, add published products, change preparation and safety buffer, start service. | Create POS Orders, accept new Kitchen work, present the Event as operating. |
| **Open** | Run POS and Kitchen, inspect Stock and Statistics, request a pause, begin closeout through the formal flow. | Directly edit preparation/safety values or change Event product set. |
| **Paused** | Inspect existing Orders, adjust Stock, change safety buffer, add published products, disable an Event product, resume service, begin formal closeout. | Create new POS Orders, accept new work as a new Kitchen Order, silently alter Order snapshots. |
| **Closed** | Read Statistics and historical information. | Create new Orders, modify Stock, modify active selling data, resume service. |

`Archived` is an existing management state, not a substitute for `Closed` in daily UX. It is intentionally outside the four-state daily operating presentation.

## 8. Button Responsibility

Buttons express a single operator intention. The UI must call one formal central action and refresh from central truth after success or failure.

| Button | Purpose | Intended state/result | Success feedback | Failure feedback |
| --- | --- | --- | --- | --- |
| **Save Event** | Create or update Event details while allowed. | Persists Draft Event details or selects the saved Event. | Selected Event Header refreshes. | Explain required field, duplicate, or invalid-state error. |
| **Start Service** | Begin sales for a prepared Event. | Draft to Open through the formal Event lifecycle. | Header becomes Open; Stock controls lock. | Show central preparation or lifecycle rejection. |
| **Pause Service** | Stop new selling before an operational adjustment. | Open to Paused through the formal lifecycle. | Header becomes Paused; allowed Stock controls unlock. | Show central lifecycle rejection; do not fake local pause. |
| **Resume Service** | Resume new selling after approved adjustments. | Paused to Open through the formal lifecycle. | Header becomes Open; Stock controls lock and clients refresh. | Show central lifecycle rejection. |
| **End Today's Sales** | Begin, not skip, the closeout process. | Opens Closeout/Waste Confirmation; does not immediately close the Event. | Shows unresolved-order result or per-product confirmation. | Explain why closeout cannot continue. |
| **Confirm Waste and Close Event** | Confirm per-product waste and retained quantity, then request formal Event close. | Writes only through the formal closeout/close flow. | Event becomes Closed and read views refresh. | Preserve entered review values and show central rejection. |
| **Add to This Event** | Add one already-published Catalog product to selected Event while allowed. | Adds an Operations-owned Event snapshot and initial Stock configuration. | New row appears after central refresh. | Explain publication, duplicate, quantity, or Event-state rejection. |
| **Disable for This Event** | Stop selling one product in the selected Event without changing Catalog. | Event-specific selling availability changes only. | Row clearly shows disabled state. | Explain state or order-related restriction. |
| **Save All** | Confirm all editable Stock values as one page action. | Central validation and commit are required before UI refresh. | Central rows reload with confirmed values. | Retain operator input and identify invalid rows; no partial success display. |
| **Save Draft** | Save Catalog work without publishing it. | Product remains Draft. | Draft status and editable form refresh. | Show field or Catalog validation error. |
| **Publish** | Publish the current Catalog product version. | Shows current published version. | Published badge/version refresh. | Explain publication rejection. |
| **Deactivate Product** | Stop future Catalog use without rewriting historical Event or Order data. | Product becomes inactive under the formal Catalog lifecycle. | Status badge refreshes. | Explain why deactivation is unavailable. |
| **Delete Draft** | Remove a draft that has no protected historical use. | Draft is removed only when formal deletion rule permits it. | Item disappears after central refresh. | Explain why a protected item cannot be deleted. |

## 9. Page Dependencies

| Page | Depends on Current Event data | Header shows Current Event | Notes |
| --- | --- | --- | --- |
| Event | Yes | Yes | Selects and changes the operating context. |
| Stock | Yes | Yes | All rows belong only to selected Event. |
| Product Catalog | No | Yes | Global Catalog data; no Event stock values. |
| Today Statistics | Yes | Yes | Reads only selected Event statistics and orders. |
| Event Analysis | Yes | Yes | Selected Event is the analysis anchor. |
| System Status and Device Connection | No | Yes | System-wide status; Header remains orientation only. |

## 10. Presentation Rules

- Numeric empty states display `0` or `NT$0`; never display `null`.
- State-sensitive actions are hidden or disabled with a brief reason, not silently accepted and later rejected.
- Destructive actions require a clear confirmation step.
- Current Event name, status, date, and time remain visible without forcing the operator to navigate back to Event.
- Product Catalog and Stock must never duplicate the same editable ownership.
- No UI may calculate and persist a second version of remaining quantity, order total, or Event status.

## 11. Future Enhancements

These are deliberately not current Business Rules or implementation authorization.

- Search published products when adding to an Event.
- Back Office dashboard summary.
- Keyboard shortcuts for frequent Back Office work.
- Drag-and-drop product display sorting.
- Event Analysis read model and prior-Event comparisons.
- Richer device diagnostics and historical connection visibility.

## 12. Reference Mockups

The following visual mockups are design aids only. They are not ROS source files and do not define API or database behaviour.

- Back Office Event and Stock layout.
- Product Catalog layout.
- Closeout and Waste Confirmation layout.
- Today Statistics layout.

Any future UI implementation must use this Blueprint as its UX source, then obtain the separately required Architecture Owner approval for affected rules, APIs, persistence, migrations, and tests.
