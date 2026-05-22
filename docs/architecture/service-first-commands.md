# Service-first Commands

Status: Active guidance

MergeWright UI surfaces express user intent as typed application commands. The command service is the shared boundary for CLI, TUI, MCP, automation, and future web UI actions.

## Rule

Write-capable behaviour flows through this path:

```text
surface -> typed command -> command service -> use case -> adapter
```

UI surfaces should route write behaviour through the command service.

## Command responsibilities

Typed commands describe product intent. They do not describe process implementation.

Useful command fields include command id, command type, source, actor, target run or stage id, requested options, and confirmation token when required.

Command shapes should avoid terminal invocations, raw argument arrays, output parsing instructions, direct overwrite paths, or provider process details.

## Command service responsibilities

The command service owns validation, command description, risk classification, confirmation requirements, write-safety checks, handler routing, typed command results, audit records, and progress events.

## Surface responsibilities

The TUI should render read models, collect command intent, ask the service to describe the command, render risk and preconditions, collect confirmation when required, submit the command, and render the typed result.

## Drift protection

Architecture tests should cover dependencies from `src/tui/**` so the service-first boundary remains stable while write capability is added incrementally.
