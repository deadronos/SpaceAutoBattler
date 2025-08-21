---
applyTo: '**/*.ps1,**/*.psm1'
description: 'PowerShell cmdlet and scripting best practices based on Microsoft guidelines'
---  

# PowerShell Cmdlet Development Guidelines

This guide provides PowerShell-specific instructions to help GitHub Copilot generate idiomatic, safe, and maintainable scripts. It aligns with Microsoft’s PowerShell cmdlet development guidelines.

---
applyTo: '**/*.ps1,**/*.psm1'
description: 'PowerShell cookbook: one-line receipt, short plan, plus quick examples for cmdlets, params, pipeline, and error handling.'
---

# PowerShell — Quick Guide

Receipt: "Create an idiomatic PowerShell cmdlet/script — plan: signature, validation, pipeline support, and error safety."

Plan (4 steps):
1) Define function name in Verb-Noun (Get-Verb).  
2) Declare parameters with types, Validate* attributes, and ValueFromPipeline where appropriate.  
3) Implement Begin/Process/End for streaming and return PSCustomObject (not Write-Host).  
4) Add ShouldProcess + try/catch and comment-based help.

Quick rules (cheat-sheet):
- Use PascalCase for functions/params, camelCase for private vars.  
- Prefer explicit parameter names; avoid aliases in scripts.  
- Return structured objects (PSCustomObject).  
- Use [CmdletBinding(SupportsShouldProcess=$true)] for mutating actions.  
- Avoid Read-Host in non-interactive scripts; support automation.

Tiny template:
function New-Thing {
  [CmdletBinding(SupportsShouldProcess=$true)]
  param(
    [Parameter(Mandatory, ValueFromPipelineByPropertyName)]
    [ValidateNotNullOrEmpty()]
    [string]$Name,
    [switch]$PassThru
  )
  begin { $ts = Get-Date }
  process {
    if ($PSCmdlet.ShouldProcess($Name, 'Create')) {
      $obj = [PSCustomObject]@{ Name = $Name; Created = $ts }
      if ($PassThru) { Write-Output $obj }
    }
  }
  end { }
}

Error handling (short): use try/catch, set $ErrorActionPreference in begin if needed, emit Write-Error/Throw for terminating failures, and Write-Verbose for operational messages.

Docs & style: include comment-based help (<# .SYNOPSIS .PARAMETER .EXAMPLE #>), 4-space indent, and prefer explicit pipeline support.

End.
## Parameter Design
