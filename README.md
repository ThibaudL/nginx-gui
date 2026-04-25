![version](https://img.shields.io/npm/v/nginx-gui.svg)

## Requirements

- Node 14+ (runtime)
- Windows only

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
