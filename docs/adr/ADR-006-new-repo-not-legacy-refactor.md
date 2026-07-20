# ADR-006: Build ROS in a new repository

## Decision

ROS is developed at `desert-island-ros` with no modifications to the legacy project.

## Rationale

The legacy system continues to operate while ROS gains testable boundaries and a migration path.

## Consequence

Every future cutover is explicit, reversible, and measured against parallel operation.
