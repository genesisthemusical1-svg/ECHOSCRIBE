# Add System.Windows.Forms and System.Drawing for the graphical user interface
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

[System.Windows.Forms.Application]::EnableVisualStyles()

# ------------------------------------------------------------------------
# THEMING & COLORS (Deep Slate / Red Alert Accent Theme)
# ------------------------------------------------------------------------
$COLOR_BG_DARK   = [System.Drawing.Color]::FromArgb(20, 20, 22)      # Deep anthracite
$COLOR_CARD_BG   = [System.Drawing.Color]::FromArgb(28, 28, 30)      # Zinc 900 carbon
$COLOR_TEXT_MAIN = [System.Drawing.Color]::FromArgb(244, 244, 245)    # Off white text
$COLOR_TEXT_MUTED= [System.Drawing.Color]::FromArgb(161, 161, 170)    # Zinc 400 info
$COLOR_ACCENT    = [System.Drawing.Color]::FromArgb(239, 68, 68)     # Soft coral red alert
$COLOR_BORDER    = [System.Drawing.Color]::FromArgb(39, 39, 42)      # Zinc 800 borders

# ------------------------------------------------------------------------
# CONSTANTS & METADATA
# ------------------------------------------------------------------------
$APP_NAME = "EchoScribe"
$APP_FULL_NAME = "EchoScribe Cognitive Voice Recorder"

# Program directory is where this installer is currently located
$INSTALL_PATH = $PSScriptRoot
if ([string]::IsNullOrEmpty($INSTALL_PATH)) {
    $INSTALL_PATH = Get-Location
}

# ------------------------------------------------------------------------
# GUI WINDOW SETUP
# ------------------------------------------------------------------------
$form = New-Object System.Windows.Forms.Form
$form.Text = "$APP_NAME Uninstallation Wizard"
$form.Size = New-Object System.Drawing.Size(600, 420)
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false
$form.BackColor = $COLOR_BG_DARK

# Standard Fonts
$fontDisplay = New-Object System.Drawing.Font("Segoe UI", 15, [System.Drawing.FontStyle]::Bold)
$fontSub     = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
$fontBody    = New-Object System.Drawing.Font("Segoe UI", 9.5)
$fontSmall   = New-Object System.Drawing.Font("Segoe UI", 8.5)

$currentStep = 0

# ------------------------------------------------------------------------
# STRUCTURAL LAYOUT
# ------------------------------------------------------------------------
# Content Area
$contentPanel = New-Object System.Windows.Forms.Panel
$contentPanel.Size = New-Object System.Drawing.Size(584, 310)
$contentPanel.Location = New-Object System.Drawing.Point(0, 0)
$contentPanel.BackColor = $COLOR_BG_DARK
$form.Controls.Add($contentPanel)

# Footer Controls Panel
$footerPanel = New-Object System.Windows.Forms.Panel
$footerPanel.Size = New-Object System.Drawing.Size(584, 75)
$footerPanel.Location = New-Object System.Drawing.Point(0, 310)
$footerPanel.BackColor = $COLOR_BG_DARK
$form.Controls.Add($footerPanel)

# Divider line
$borderLine = New-Object System.Windows.Forms.Label
$borderLine.Size = New-Object System.Drawing.Size(584, 1)
$borderLine.Location = New-Object System.Drawing.Point(0, 0)
$borderLine.BackColor = $COLOR_BORDER
$footerPanel.Controls.Add($borderLine)

# Navigation Buttons
$btnCancel = New-Object System.Windows.Forms.Button
$btnCancel.Text = "Cancel"
$btnCancel.Size = New-Object System.Drawing.Size(90, 30)
$btnCancel.Location = New-Object System.Drawing.Point(470, 20)
$btnCancel.FlatStyle = "Flat"
$btnCancel.FlatAppearance.BorderColor = $COLOR_BORDER
$btnCancel.FlatAppearance.MouseOverBackColor = $COLOR_CARD_BG
$btnCancel.ForeColor = $COLOR_TEXT_MAIN
$btnCancel.BackColor = $COLOR_CARD_BG
$btnCancel.Font = $fontBody
$btnCancel.Add_Click({ $form.Close() })
$footerPanel.Controls.Add($btnCancel)

$btnNext = New-Object System.Windows.Forms.Button
$btnNext.Text = "Uninstall"
$btnNext.Size = New-Object System.Drawing.Size(100, 30)
$btnNext.Location = New-Object System.Drawing.Point(360, 20)
$btnNext.FlatStyle = "Flat"
$btnNext.FlatAppearance.BorderSize = 0
$btnNext.BackColor = $COLOR_ACCENT
$btnNext.ForeColor = [System.Drawing.Color]::White
$btnNext.Font = $fontBody
$btnNext.Add_Click({ RunUninstallAction })
$footerPanel.Controls.Add($btnNext)

# ------------------------------------------------------------------------
# PANEL STEPS OR STAGES
# ------------------------------------------------------------------------
# Panel 0: Confirmation Screen
$panelStep0 = New-Object System.Windows.Forms.Panel
$panelStep0.Size = $contentPanel.Size
$panelStep0.Visible = $true
$contentPanel.Controls.Add($panelStep0)

$lblS0Title = New-Object System.Windows.Forms.Label
$lblS0Title.Text = "Remove EchoScribe Local System"
$lblS0Title.Font = $fontDisplay
$lblS0Title.ForeColor = $COLOR_TEXT_MAIN
$lblS0Title.Size = New-Object System.Drawing.Size(550, 40)
$lblS0Title.Location = New-Object System.Drawing.Point(20, 20)
$panelStep0.Controls.Add($lblS0Title)

$lblS0Body = New-Object System.Windows.Forms.Label
$lblS0Body.Text = "This action will clean and safely decouple $APP_FULL_NAME from your local registry, start menus, and desktop environment pathing.`n`nYou can choose whether to keep your local Markdown Notes folder intact so you never lose your historic audio summaries and journal transcripts."
$lblS0Body.Font = $fontBody
$lblS0Body.ForeColor = $COLOR_TEXT_MUTED
$lblS0Body.Size = New-Object System.Drawing.Size(540, 90)
$lblS0Body.Location = New-Object System.Drawing.Point(20, 75)
$panelStep0.Controls.Add($lblS0Body)

$chkS0KeepNotes = New-Object System.Windows.Forms.CheckBox
$chkS0KeepNotes.Text = "Keep my custom Notes folder intact (recommended to preserve your data)"
$chkS0KeepNotes.Font = $fontSub
$chkS0KeepNotes.ForeColor = [System.Drawing.Color]::FromArgb(134, 239, 172) # Soft green font
$chkS0KeepNotes.Size = New-Object System.Drawing.Size(540, 30)
$chkS0KeepNotes.Location = New-Object System.Drawing.Point(20, 185)
$chkS0KeepNotes.Checked = $true
$panelStep0.Controls.Add($chkS0KeepNotes)

$lblS0Warning = New-Object System.Windows.Forms.Label
$lblS0Warning.Text = "Target directory to purge: $INSTALL_PATH"
$lblS0Warning.Font = $fontSmall
$lblS0Warning.ForeColor = $COLOR_TEXT_MUTED
$lblS0Warning.Size = New-Object System.Drawing.Size(540, 25)
$lblS0Warning.Location = New-Object System.Drawing.Point(20, 235)
$panelStep0.Controls.Add($lblS0Warning)

# Panel 1: Progress Screen
$panelStep1 = New-Object System.Windows.Forms.Panel
$panelStep1.Size = $contentPanel.Size
$panelStep1.Visible = $false
$contentPanel.Controls.Add($panelStep1)

$lblS1Title = New-Object System.Windows.Forms.Label
$lblS1Title.Text = "Uninstalling Progress..."
$lblS1Title.Font = $fontDisplay
$lblS1Title.ForeColor = $COLOR_TEXT_MAIN
$lblS1Title.Size = New-Object System.Drawing.Size(550, 40)
$lblS1Title.Location = New-Object System.Drawing.Point(20, 20)
$panelStep1.Controls.Add($lblS1Title)

$progressBar = New-Object System.Windows.Forms.ProgressBar
$progressBar.Size = New-Object System.Drawing.Size(540, 20)
$progressBar.Location = New-Object System.Drawing.Point(20, 80)
$progressBar.Style = "Blocks"
$panelStep1.Controls.Add($progressBar)

$txtLogs = New-Object System.Windows.Forms.TextBox
$txtLogs.Multiline = $true
$txtLogs.ReadOnly = $true
$txtLogs.ScrollBars = "Vertical"
$txtLogs.BackColor = $COLOR_CARD_BG
$txtLogs.ForeColor = $COLOR_TEXT_MUTED
$txtLogs.Font = New-Object System.Drawing.Font("Consolas", 8)
$txtLogs.Size = New-Object System.Drawing.Size(540, 160)
$txtLogs.Location = New-Object System.Drawing.Point(20, 120)
$panelStep1.Controls.Add($txtLogs)

# Panel 2: Success Screen
$panelStep2 = New-Object System.Windows.Forms.Panel
$panelStep2.Size = $contentPanel.Size
$panelStep2.Visible = $false
$contentPanel.Controls.Add($panelStep2)

$lblS2Title = New-Object System.Windows.Forms.Label
$lblS2Title.Text = "EchoScribe Successfully Removed"
$lblS2Title.Font = $fontDisplay
$lblS2Title.ForeColor = [System.Drawing.Color]::FromArgb(134, 239, 172)
$lblS2Title.Size = New-Object System.Drawing.Size(550, 45)
$lblS2Title.Location = New-Object System.Drawing.Point(20, 30)
$panelStep2.Controls.Add($lblS2Title)

$lblS2Body = New-Object System.Windows.Forms.Label
$lblS2Body.Text = "The localized binaries, environmental sandboxes, systems controllers, desktop icons, and start menus have been completely decoupled successfully.`n`nIf you selected to keep your Notes, they are still secure in your local notes directory.`n`nThank you for exploring EchoScribe. Click 'Close' to finish."
$lblS2Body.Font = $fontBody
$lblS2Body.ForeColor = $COLOR_TEXT_MAIN
$lblS2Body.Size = New-Object System.Drawing.Size(540, 140)
$lblS2Body.Location = New-Object System.Drawing.Point(20, 100)
$panelStep2.Controls.Add($lblS2Body)

# ------------------------------------------------------------------------
# ACTION LOGS AND THREAD CONTROL
# ------------------------------------------------------------------------
function AppendLog($msg) {
    $txtLogs.AppendText("$msg`r`n")
    $txtLogs.SelectionStart = $txtLogs.Text.Length
    $txtLogs.ScrollToCaret()
    $form.Refresh()
}

function RunUninstallAction {
    $panelStep0.Visible = $false
    $panelStep1.Visible = $true
    $btnNext.Enabled = $false
    $btnCancel.Enabled = $false
    $form.Refresh()

    AppendLog "Starting local registry cleanup..."
    $progressBar.Value = 10
    Start-Sleep -m 400

    # 1. Unpin Windows Desktop Shortcut
    AppendLog "[SHORTCUTS] Clearing standard Desktop shortcuts..."
    $desktopPath = [System.IO.Path]::Combine([System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop), "EchoScribe.lnk")
    if (Test-Path $desktopPath) {
        Remove-Item $desktopPath -Force -ErrorAction SilentlyContinue | Out-Null
        AppendLog "[SHORTCUTS] Desktop link removed successfully."
    }
    $progressBar.Value = 25
    Start-Sleep -m 300

    # 2. Unpin Start Menu Program Shortcut Folder
    AppendLog "[SHORTCUTS] Terminating Start Menu index structures..."
    $startMenuPrograms = [System.IO.Path]::Combine([System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Programs), "EchoScribe")
    if (Test-Path $startMenuPrograms) {
        Remove-Item $startMenuPrograms -Recurse -Force -ErrorAction SilentlyContinue | Out-Null
        AppendLog "[SHORTCUTS] Start Menu program folder purged."
    }
    $progressBar.Value = 40
    Start-Sleep -m 300

    # 3. Purge Windows Add/Remove registry entries
    AppendLog "[REGISTRY] Deleting Windows Program configurations..."
    $registryRoot = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\EchoScribe"
    if (Test-Path $registryRoot) {
        Remove-Item -Path $registryRoot -Recurse -Force -ErrorAction SilentlyContinue | Out-Null
        AppendLog "[REGISTRY] Decoupled registry bindings complete."
    }
    $progressBar.Value = 60
    Start-Sleep -m 300

    # 4. Remove installation files (with custom optional boundary on notes/)
    AppendLog "[FILES] Vacuuming installation directory files..."
    AppendLog "[FILES] Location key: $INSTALL_PATH"

    # Identify existing directories to clear
    $subFilesAndDirs = Get-ChildItem -Path $INSTALL_PATH -ErrorAction SilentlyContinue
    $purgedItems = 0
    foreach ($item in $subFilesAndDirs) {
        if ($item.Name -eq "notes" -and $chkS0KeepNotes.Checked) {
            AppendLog "[PRESERVATION] Notes folder selected for preservation. Skipping deletion of Notes recordings."
            continue
        }
        
        # Don't delete the uninstaller scripts yet while we run from it! Let's schedule it or ignore it safely.
        if ($item.Name -eq "uninstall-wizard.ps1" -or $item.Name -eq "uninstall-echoscribe.bat") {
            continue
        }

        try {
            AppendLog "[FILES] Deleting component: $($item.Name)..."
            Remove-Item -Path $item.FullName -Recurse -Force -ErrorAction SilentlyContinue | Out-Null
            $purgedItems++
        } catch {
            AppendLog "[WARNING] Could not instantly delete: $($item.Name) (busy registry index)."
        }
        $form.Refresh()
    }
    $progressBar.Value = 90
    Start-Sleep -m 400

    # Try to schedule a background self-deletion helper command when this process closes
    try {
        AppendLog "[CLEANUP] Coordinating standalone shell cleanup..."
        $parentFolder = Split-Path $INSTALL_PATH -Parent
        # Minor delayed batch execution to wipe uninstall.bat and uninstall.ps1, then remove parent if empty
        $cleanupCommand = "timeout /t 2 /nobreak >nul & del /f /q `"$INSTALL_PATH\uninstall-wizard.ps1`" & del /f /q `"$INSTALL_PATH\uninstall-echoscribe.bat`" & rd `"$INSTALL_PATH`" 2>nul"
        Start-Process "cmd.exe" -ArgumentList "/c $cleanupCommand" -WindowStyle Hidden
    } catch {
        # Silent pass
    }

    $progressBar.Value = 100
    AppendLog "[SUCCESS] Decoupling completed cleanly!"
    Start-Sleep -m 300

    # Standard progression to Success screen
    $panelStep1.Visible = $false
    $panelStep2.Visible = $true
    $btnNext.Text = "Close"
    $btnNext.Enabled = $true
    $btnNext.BackColor = [System.Drawing.Color]::FromArgb(34, 197, 94) # Elegant green Success
    $btnCancel.Visible = $false
    $btnNext.Add_Click({ $form.Close() })
    $form.Refresh()
}

# Launch GUI uninstaller visual frame
[System.Windows.Forms.Application]::Run($form)
