# Local workflow storage

The Git/Vercel website project and the large local workflow data are intentionally separated:

- Website and Git root: `C:\Users\mlcmlc\Desktop\KK Diction Website`
- Local cut/up_mod workspace: `C:\Users\mlcmlc\Desktop\KK Diction`

Workflow scripts resolve data from `KK_WORKFLOW_ROOT`. When the variable is not set, they use the sibling `KK Diction` directory if it exists. Vercel does not need this variable because these scripts are local administrative operations, not runtime routes.

Run Git, build, commit, and push commands only from the website project. Run cut/up_mod operations through the launchers in the local workflow workspace.

The website repository ignores `db image/` and `db mods/` completely. Their removal from the website repository is a Git-only separation; it does not delete the copies in the local workflow workspace.

## Launchers

From `C:\Users\mlcmlc\Desktop\KK Diction`:

```powershell
.\cut.ps1 help
.\up_mod.ps1 help
```

Both launchers set `KK_WORKFLOW_ROOT` and execute the maintained scripts from the website project.
