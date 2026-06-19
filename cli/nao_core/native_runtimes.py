"""On-demand installation of heavy native runtimes for the chat server.

The standalone server ships with two NAPI-RS native addons that are large and
optional:

- ``@boxlite-ai/boxlite`` (~70MB) powers the ``execute_sandboxed_code`` tool.
- ``@pydantic/monty`` (~12MB) powers the ``execute_python`` tool.

Bundling their platform binaries in every wheel would add ~80MB per platform.
Instead, only the tiny JS wrappers are bundled; the platform-specific binaries
are fetched from the npm registry on first use and cached under
``~/.nao/runtimes``. The server binary then resolves them through ``NODE_PATH``.

This module is never used by the Docker image, which installs the runtimes via
``bun install`` at build time.
"""

from __future__ import annotations

import json
import os
import platform
import shutil
import sys
import tarfile
import tempfile
from dataclasses import dataclass
from pathlib import Path

from nao_core.ui import UI

NPM_REGISTRY = "https://registry.npmjs.org"
RUNTIMES_DIR = Path.home() / ".nao" / "runtimes"
SKIP_DOWNLOAD_ENV = "NAO_SKIP_RUNTIME_DOWNLOAD"


@dataclass(frozen=True)
class NativeRuntime:
    """A heavy native addon fetched on demand.

    Attributes:
        key: Short identifier used in CLI output.
        label: Human-readable description of the feature it enables.
        wrapper_package: The bundled JS wrapper package (e.g. ``@pydantic/monty``).
        platform_base: The platform-package prefix; the resolved package is
            ``{platform_base}-{suffix}`` (e.g. ``@pydantic/monty-darwin-arm64``).
    """

    key: str
    label: str
    wrapper_package: str
    platform_base: str


RUNTIMES: list[NativeRuntime] = [
    NativeRuntime(
        key="sandbox",
        label="code sandbox (execute_sandboxed_code)",
        wrapper_package="@boxlite-ai/boxlite",
        platform_base="@boxlite-ai/boxlite",
    ),
    NativeRuntime(
        key="python",
        label="python interpreter (execute_python)",
        wrapper_package="@pydantic/monty",
        platform_base="@pydantic/monty",
    ),
]


def get_native_platform_suffix() -> str | None:
    """Return the NAPI-RS platform suffix for the current OS/arch, or None."""
    arch = platform.machine()
    if sys.platform == "darwin":
        if arch == "arm64":
            return "darwin-arm64"
        if arch == "x86_64":
            return "darwin-x64"
    elif sys.platform == "linux":
        if arch == "x86_64":
            return "linux-x64-gnu"
        if arch in ("aarch64", "arm64"):
            return "linux-arm64-gnu"
    elif sys.platform == "win32":
        if arch in ("AMD64", "x86_64"):
            return "win32-x64-msvc"
    return None


def node_modules_dir() -> Path:
    """Directory used as a NODE_PATH root for resolving downloaded runtimes."""
    return RUNTIMES_DIR / "node_modules"


def build_node_path(existing: str | None = None) -> str | None:
    """Prepend the runtimes directory to an existing NODE_PATH value."""
    nm = node_modules_dir()
    if not nm.exists():
        return existing
    entry = str(nm)
    if not existing:
        return entry
    parts = existing.split(os.pathsep)
    if entry in parts:
        return existing
    return os.pathsep.join([entry, existing])


def is_download_skipped() -> bool:
    """Whether the user opted out of automatic runtime downloads."""
    return os.environ.get(SKIP_DOWNLOAD_ENV, "").lower() in ("1", "true", "yes")


def ensure_runtimes(*, force: bool = False, quiet: bool = False) -> None:
    """Download any missing native runtimes for the current platform.

    Failures are non-fatal: the corresponding tool simply stays disabled.
    """
    suffix = get_native_platform_suffix()
    if suffix is None:
        if not quiet:
            UI.warn(f"Unsupported platform {sys.platform}/{platform.machine()} — code execution tools disabled.")
        return

    pending = [r for r in RUNTIMES if force or not _is_installed(r, suffix)]
    if not pending:
        return

    for runtime in pending:
        try:
            _install_runtime(runtime, suffix)
        except RuntimeUnavailableError:
            if not quiet:
                UI.warn(f"{runtime.label} is not available for this platform — skipping.")
        except Exception as e:  # noqa: BLE001 — downloads must never break the CLI
            if not quiet:
                UI.warn(f"Could not download {runtime.label}: {e}")
                UI.print("  The feature stays disabled. Retry later with: nao install-runtimes")


class RuntimeUnavailableError(Exception):
    """Raised when a runtime has no binary published for the current platform."""


def _is_installed(runtime: NativeRuntime, suffix: str) -> bool:
    desired = _desired_version(runtime, suffix)
    if desired is None:
        return True  # nothing to install on this platform
    return _installed_version(runtime, suffix) == desired


def _install_runtime(runtime: NativeRuntime, suffix: str) -> None:
    desired = _desired_version(runtime, suffix)
    if desired is None:
        raise RuntimeUnavailableError(runtime.platform_base)

    platform_package = f"{runtime.platform_base}-{suffix}"
    dest = node_modules_dir() / platform_package

    UI.info(f"⬇️  Downloading {runtime.label} — {platform_package}@{desired} (one-time)...")

    tarball_url = _tarball_url(platform_package, desired)
    with tempfile.TemporaryDirectory() as tmp:
        tgz = Path(tmp) / "package.tgz"
        _download(tarball_url, tgz)
        staging = Path(tmp) / "extracted"
        _extract_npm_tarball(tgz, staging)
        _replace_dir(staging, dest)

    UI.success(f"Installed {runtime.label}.")


def _desired_version(runtime: NativeRuntime, suffix: str) -> str | None:
    """Resolve the platform-package version pinned by the bundled wrapper."""
    platform_package = f"{runtime.platform_base}-{suffix}"
    meta = _wrapper_metadata(runtime)
    if meta is not None:
        version = meta.get("optionalDependencies", {}).get(platform_package)
        if version:
            return version
        # Platform package absent from optionalDependencies → not published here.
        if "optionalDependencies" in meta:
            return None
        return meta.get("version")
    return None


def _wrapper_metadata(runtime: NativeRuntime) -> dict | None:
    pkg_json = _bin_dir() / "node_modules" / runtime.wrapper_package / "package.json"
    try:
        return json.loads(pkg_json.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def _installed_version(runtime: NativeRuntime, suffix: str) -> str | None:
    platform_package = f"{runtime.platform_base}-{suffix}"
    pkg_json = node_modules_dir() / platform_package / "package.json"
    try:
        return json.loads(pkg_json.read_text(encoding="utf-8")).get("version")
    except (OSError, json.JSONDecodeError):
        return None


def _bin_dir() -> Path:
    return Path(__file__).parent / "bin"


def _tarball_url(platform_package: str, version: str) -> str:
    scope, name = platform_package.split("/", 1)
    return f"{NPM_REGISTRY}/{scope}/{name}/-/{name}-{version}.tgz"


def _download(url: str, dest: Path) -> None:
    import httpx

    with httpx.stream("GET", url, follow_redirects=True, timeout=60) as response:
        response.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in response.iter_bytes(chunk_size=1024 * 256):
                f.write(chunk)


def _extract_npm_tarball(tgz: Path, dest: Path) -> None:
    """Extract an npm tarball, stripping its leading ``package/`` directory.

    Guards against path traversal and skips symlinks for safety.
    """
    dest.mkdir(parents=True, exist_ok=True)
    dest_root = dest.resolve()

    with tarfile.open(tgz, "r:gz") as tar:
        for member in tar.getmembers():
            relative = member.name
            if relative.startswith("package/"):
                relative = relative[len("package/") :]
            if not relative or member.issym() or member.islnk():
                continue

            target = (dest / relative).resolve()
            if target != dest_root and not str(target).startswith(str(dest_root) + os.sep):
                raise ValueError(f"Unsafe path in tarball: {member.name}")

            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
            elif member.isfile():
                target.parent.mkdir(parents=True, exist_ok=True)
                source = tar.extractfile(member)
                if source is None:
                    continue
                with source, open(target, "wb") as out:
                    shutil.copyfileobj(source, out)
                target.chmod((member.mode & 0o777) or 0o644)


def _replace_dir(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists():
        shutil.rmtree(dest)
    shutil.move(str(src), str(dest))
