![version](https://img.shields.io/npm/v/nginx-gui.svg)

## Requirements

- Node 14+ (backend runtime)
- Windows or Linux
- nginx — downloaded automatically on Windows; install via package manager on Linux

## Usage

**Install globally via npm:**

```
npm i -g nginx-gui
```

Then run:

```
nginx-gui
```

Access the UI at http://localhost:9004

Or start nginx automatically on launch:

```
nginx-gui --start-nginx
```

### First run

On first launch, if no nginx binary is found the UI shows a setup panel:

- **Windows** — pick a version from the list (fetched live from nginx.org) and click **Download & Install**. The binary is extracted to `~/.nginx-gui/nginx/`.
- **Linux** — install nginx via your package manager, then restart nginx-gui:
  ```
  sudo apt install nginx   # Debian/Ubuntu
  sudo yum install nginx   # RHEL/CentOS
  ```

### Runtime files

All data lives under `~/.nginx-gui/` and is never written to the project directory:

```
~/.nginx-gui/
  data.json          # server configuration database
  nginx/             # downloaded nginx (Windows)
    nginx.exe
    conf/nginx.conf  # generated on each run
  nginx.conf         # generated on each run (Linux)
  logs/
    access.log       # nginx access log (JSON lines)
    nginx-error.log  # nginx error log
    access.YYYY-MM-DD.log  # rotated logs (7 days retained)
```

Access logs are rotated automatically — daily or when the file exceeds 10 MB.

## Development

**Install dependencies:**

```
npm install
cd app-vue && npm install
```

**Run backend + frontend dev servers separately:**

```
npm run server:dev        # Express API on :9004 (with --watch)
cd app-vue && npm run dev # Vite dev server on :8881
```

The Vite dev server proxies `/api/*` to `:9004`, so only one URL is needed during development: http://localhost:8881

**Build for production:**

```
npm run build   # outputs compiled frontend to /public, served by Express
```

## Example

![capture](https://raw.githubusercontent.com/ThibaudL/nginx-gui/master/demo/Capture.PNG)
