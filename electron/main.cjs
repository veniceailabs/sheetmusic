const { app, BrowserWindow } = require("electron");
const path = require("node:path");

const REMOTE_URL = process.env.SHEET_MUSIC_WEB_URL || "https://sheet-music.vercel.app";

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 760,
    backgroundColor: "#f4efe6",
    title: "Sheet Music"
  });

  if (app.isPackaged) {
    window.loadURL(REMOTE_URL);
    return;
  }

  window.loadURL("http://localhost:3000");
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
