// Stub. The postbuild patches this plugin used to run are no longer needed
// after the src/client.ts rewrite: the new client registers sidebar.panellist
// + main directly through ctx.slots.inject() and no longer depends on a
// shell.overlay fallback. The build pipeline emits a clean lib/client.js.