# core

The shared core of Groundwork. **Not built yet**: this is roadmap step 1.

It will hold what every module uses:

- **One local server.** It serves every module under its own `/api/<module>/` path. It listens on `127.0.0.1` only and refuses requests with a foreign `Host` header. Each module may write only into the folders it declares.
- **The shell.** It provides the header, the navigation between modules, and the theme, which follows the operating system's light or dark setting.
- **Module loading.** It reads each module's descriptor (id, name, version) and mounts the module's endpoints and view.

Until then each module in [`../modules/`](../modules/) runs its own small server. The decisions behind the core are in [`docs/product/core/TECH.md`](../docs/product/core/TECH.md) (in Hungarian).
