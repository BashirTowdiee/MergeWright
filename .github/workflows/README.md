# GitHub Actions workflows

This directory contains CI and repository automation workflows for MergeWright.

Workflow changes should be kept small and reviewed carefully because they affect merge confidence and repository safety.

## Expectations

Workflow updates should:

- keep build and test checks deterministic
- avoid unnecessary permissions
- avoid leaking secrets in logs
- document new required checks
- explain any changes to pull request gating

## Current baseline

The baseline CI should build the project and run the test suite for pull requests before merge.
