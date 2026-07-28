Broker Development Kit (BDK) Architecture v1.0

Purpose

The Broker Development Kit (BDK) is a broker-independent data layer that provides normalized market data to trading applications.

Its primary responsibility is to connect to one or more brokerage APIs, retrieve market data, validate it, normalize it into a standard format, and expose that data through a consistent interface.

The BDK intentionally contains no trading logic.

It does not generate trade ideas, score opportunities, or execute strategies. Those responsibilities belong to applications such as 0DTE Sniper.

⸻

Design Goals

The BDK is designed around five core principles.

1. Broker Independence

Trading applications should never communicate directly with broker APIs.

Instead, every broker-specific implementation is isolated behind a common adapter interface.

Supported brokers may include:

* Charles Schwab
* Interactive Brokers
* Tradier
* Tastytrade
* Polygon
* Future providers

Adding support for a new broker should require implementing only a new adapter.

The rest of the system should remain unchanged.

⸻

2. One Normalized Data Model

Every adapter must produce the same normalized object:

MarketSnapshot

Regardless of how different brokers represent their data internally, every consumer receives identical structures.

Applications built on top of the BDK should never need to know which broker supplied the data.

⸻

3. Separation of Responsibilities

Each module has one clearly defined responsibility.

Authentication handles authorization.

Streaming handles live market updates.

Historical retrieves historical market data.

Adapters translate broker responses.

Validators verify correctness.

Capability scanners determine feature support.

No module should assume responsibilities outside its own purpose.

⸻

4. Provider-Agnostic Calculations

Whenever practical, indicators and derived values are calculated internally rather than relying on broker-specific implementations.

Examples include:

* VWAP
* Exponential Moving Averages
* ATR
* Relative Volume
* Opening Range
* Session Statistics

This guarantees consistent behavior across all supported brokers.

⸻

5. Testability

Every component should be independently testable.

Broker adapters should be validated without requiring trading logic.

Trading applications should be tested using mock MarketSnapshot objects.

This separation allows development and testing even when markets are closed.

⸻

High-Level Architecture

Broker API
        │
        ▼
Authentication
        │
        ▼
Broker Adapter
        │
        ▼
Normalization
        │
        ▼
MarketSnapshot
        │
        ▼
Validation
        │
        ▼
Trading Application

⸻

Project Structure

src/
adapters/
auth/
capability/
explorer/
historical/
models/
services/
streaming/
utils/
validator/

⸻

Module Responsibilities

adapters/

Implements broker-specific adapters.

Responsibilities:

* Connect to broker APIs
* Translate broker responses
* Produce MarketSnapshot objects

⸻

auth/

Handles authentication.

Responsibilities:

* OAuth
* Token storage
* Token refresh
* Connection state

⸻

capability/

Determines which features each broker supports.

Responsibilities:

* Native fields
* Calculated fields
* Derived fields
* Unsupported fields

Produces the Capability Report.

⸻

explorer/

Developer tools for inspecting broker APIs.

Responsibilities:

* Execute API requests
* Display raw JSON
* Display latency
* Inspect payloads

⸻

historical/

Retrieves historical market data.

Responsibilities:

* Price history
* Candle retrieval
* Historical option data (where available)

⸻

models/

Defines all shared interfaces and data structures.

Contains:

* MarketSnapshot
* Quote
* OptionContract
* SessionState
* CapabilityReport
* ValidationReport

⸻

services/

Reusable business services shared across multiple modules.

Examples:

* QuoteService
* OptionChainService
* MarketHoursService

⸻

streaming/

Manages live market subscriptions.

Responsibilities:

* Quote streaming
* Option streaming
* Heartbeat monitoring
* Reconnection

⸻

validator/

Validates normalized MarketSnapshot objects against the BDK Data Contract.

Produces validation reports highlighting missing or invalid fields.

⸻

utils/

Shared utility functions used throughout the project.

⸻

Design Principles

The BDK intentionally avoids:

* Trading strategies
* Signal generation
* Position management
* Risk management
* AI decision making

Its responsibility ends once accurate, validated, normalized market data has been produced.

⸻

Success Criteria

A successful Broker Development Kit should:

* Support multiple brokers without architectural changes.
* Produce identical MarketSnapshot objects regardless of broker.
* Validate data before exposing it.
* Be independently testable.
* Remain completely separate from trading logic.

The BDK is the foundation upon which trading applications are built. Its purpose is reliability, consistency, and portability.