import { defineManifest } from "@crxjs/vite-plugin";
const manifest = {
    manifest_version: 3,
    name: "SmartSession",
    description: "Project and session-centered tab manager with notes and checkpoints.",
    version: "1.0",
    icons: {
        16: "icons/smartsession-icon-16.png",
        32: "icons/smartsession-icon-32.png",
        48: "icons/smartsession-icon-48.png",
        128: "icons/smartsession-icon-128.png",
    },
    action: {
        default_title: "SmartSession",
        default_popup: "src/popup/index.html",
        default_icon: {
            16: "icons/smartsession-icon-16.png",
            32: "icons/smartsession-icon-32.png",
            48: "icons/smartsession-icon-48.png",
            128: "icons/smartsession-icon-128.png",
        },
    },
    background: {
        service_worker: "src/background/service-worker.ts",
        type: "module",
    },
    options_page: "src/options/index.html",
    side_panel: {
        default_path: "src/sidepanel/index.html",
    },
    permissions: ["storage", "tabs", "sidePanel"],
    host_permissions: ["<all_urls>"],
};
export default defineManifest(manifest);
