# Write Safety

Before write-enabled execution:

1. set `writeSafety.enabled=true`
2. run `check-write-safety`
3. run write-enabled command with `--allow-writes`

Classic checks are blocked until required post-write review is completed.
