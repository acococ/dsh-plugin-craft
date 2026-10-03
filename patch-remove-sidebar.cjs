// Stub. The postbuild patches this plugin used to run are no longer needed
// after the src/client.ts rewrite: the new client registers sidebar.panellist
// alongside a keyed main entry under the same PANEL_ID, so selectPanel(id)
// resolves to a real occupant and never throws.