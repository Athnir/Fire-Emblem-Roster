// Electron main process. Kept as plain CommonJS (.cjs) since package.json has "type": "module" —
// Electron's main process loads fine as ESM too, but .cjs sidesteps having to convert require()
// calls (fs/path/electron) to import syntax for no real benefit here.
const { app, BrowserWindow, net, protocol } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

// Serves the built dist/ folder from its own address rather than loading index.html directly via
// file://. The app's own asset references (icons, portrait art, JS/CSS bundle) are root-relative
// paths (e.g. "/art/...") that only resolve against a real origin — file:// has no concept of
// "root", so those requests would 404. Serving it this way sidesteps needing to change the shared
// Vite `base` config (which the GitHub Pages / PWA deploy targets also use).
const DIST_DIR = path.join(__dirname, '..', 'dist')

// One fixed address, app://roster/, for the app's whole life. Chromium keeps each address's saved
// data (localStorage, IndexedDB) and caches apart, and this used to be a local HTTP server on a
// random port, a new address on every launch: each launch started with nothing saved and left the
// last one's copy of the app behind (34 launches had left 34 copies, 517 MB, in AppData). Never
// change the scheme or the host: what people have saved lives under them.
const SCHEME = 'app'
const HOST = 'roster'

// Standard and secure so the page gets the storage and APIs an https site gets. Service workers stay
// off: the desktop build has none (`vite build --mode electron`), as its files are on disk already.
protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

// Pinned rather than taken from package.json's name, so renaming the package (it was fates-app)
// can't move the saved data to a new folder and strand the old one.
app.setPath('userData', path.join(app.getPath('appData'), 'Fire Emblem Roster'))

function serve(request) {
  const file = path.join(DIST_DIR, decodeURIComponent(new URL(request.url).pathname))
  // SPA fallback: any path that doesn't map to a real file inside dist/ serves index.html instead
  // of a bare 404, matching Vite's own dev-server/preview behavior.
  const found = file.startsWith(DIST_DIR + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()
  return net.fetch(pathToFileURL(found ? file : path.join(DIST_DIR, 'index.html')).toString())
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    title: 'Fire Emblem Roster',
    icon: path.join(DIST_DIR, 'icons', 'icon-512-v2.png'),
    autoHideMenuBar: true,
  })
  // index.html's own <title> otherwise overwrites the BrowserWindow title above as soon as the
  // page loads (they're kept in sync content-wise, but the page's title updates asynchronously
  // after load and would win the race without this).
  win.on('page-title-updated', (event) => event.preventDefault())
  win.loadURL(`${SCHEME}://${HOST}/`)
}

// One copy of the app at a time: a second one would share the same saved data and could write over
// it, so opening the app again brings the open window forward instead.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.focus()
  })

  app.whenReady().then(() => {
    protocol.handle(SCHEME, serve)
    createWindow()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}
