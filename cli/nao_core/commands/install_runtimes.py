from typing import Annotated

from cyclopts import Parameter

from nao_core.native_runtimes import ensure_runtimes
from nao_core.tracking import track_command
from nao_core.ui import UI


@track_command("install-runtimes")
def install_runtimes(
    *,
    force: Annotated[bool, Parameter(name=["--force", "-f"], help="Re-download even if already installed")] = False,
) -> None:
    """Download the native runtimes for code execution tools.

    Fetches the platform binaries for the code sandbox (execute_sandboxed_code)
    and the python interpreter (execute_python) from the npm registry and caches
    them under ~/.nao/runtimes. These are not bundled in the wheel to keep its
    size small, and are otherwise downloaded automatically the first time you run
    `nao chat`.
    """
    UI.title("📦 Installing code execution runtimes")
    ensure_runtimes(force=force)
    UI.success("Done. Run 'nao chat' to use the code execution tools.")
