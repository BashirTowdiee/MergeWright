# Architecture Overview

Shepherds-Staff is a CLI orchestration engine that coordinates phase/stage execution and writes auditable artefacts.

Core flow:

`CLI -> config/safety validation -> prompt rendering -> phase/stage execution -> artefact writing -> metadata updates`.
