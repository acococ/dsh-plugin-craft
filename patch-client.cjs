// Stub. The postbuild patches this plugin used to run are no longer needed
// after the src/client.ts rewrite: the new client is self-contained CJS that
// does not require a manual React binding injection. The build pipeline
// emits a clean lib/client.js directly.
//
// This file is kept as an empty placeholder so downstream tooling that
// might reference the path does not break. It is a no-op.