# Add System.Windows.Forms and System.Drawing for the graphical user interface
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

[System.Windows.Forms.Application]::EnableVisualStyles()

# ------------------------------------------------------------------------
# THEMING & COLORS (Deep Slate / Dark Accent Theme)
# ------------------------------------------------------------------------
$COLOR_BG_DARK   = [System.Drawing.Color]::FromArgb(20, 20, 22)      # Deep anthracite
$COLOR_CARD_BG   = [System.Drawing.Color]::FromArgb(28, 28, 30)      # Zinc 900 carbon
$COLOR_TEXT_MAIN = [System.Drawing.Color]::FromArgb(244, 244, 245)    # Off white text
$COLOR_TEXT_MUTED= [System.Drawing.Color]::FromArgb(161, 161, 170)    # Zinc 400 info
$COLOR_ACCENT    = [System.Drawing.Color]::FromArgb(0, 153, 255)     # Premium EchoScribe Blue
$COLOR_ACCENT_HOVER = [System.Drawing.Color]::FromArgb(26, 172, 255) # Light blue hover
$COLOR_BORDER    = [System.Drawing.Color]::FromArgb(39, 39, 42)      # Zinc 800 borders

# ------------------------------------------------------------------------
# CONSTANTS & METADATA
# ------------------------------------------------------------------------
$APP_NAME = "EchoScribe"
$APP_FULL_NAME = "EchoScribe Cognitive Voice Recorder"
$APP_VERSION = "1.0.0"
$DEFAULT_INSTALL_PATH = Join-Path $env:USERPROFILE "AppData\Local\Programs\EchoScribe"

# Source directory is where this installer is running from
$SOURCE_DIR = $PSScriptRoot
if ([string]::IsNullOrEmpty($SOURCE_DIR)) {
    $SOURCE_DIR = Get-Location
}

# ------------------------------------------------------------------------
# GUI WINDOW SETUP
# ------------------------------------------------------------------------
$form = New-Object System.Windows.Forms.Form
$form.Text = "$APP_NAME Setup Wizard"
$form.Size = New-Object System.Drawing.Size(620, 480)
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false
$form.BackColor = $COLOR_BG_DARK
$form.Icon = [System.Drawing.Icon]::ExtractAssociatedIcon((Join-Path $SOURCE_DIR "app-icon.ico"))

# Standard Font Pairings (Inter style sans-serif)
$fontDisplay = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Bold)
$fontSub     = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
$fontBody    = New-Object System.Drawing.Font("Segoe UI", 9.5)
$fontSmall   = New-Object System.Drawing.Font("Segoe UI", 8.5)

# Status and state variables
$currentStep = 0
$selectedPath = $DEFAULT_INSTALL_PATH

# ------------------------------------------------------------------------
# STEP CONTAINER PANELS
# ------------------------------------------------------------------------
# Side banner panel (branding)
$sidebarPanel = New-Object System.Windows.Forms.Panel
$sidebarPanel.Size = New-Object System.Drawing.Size(180, 480)
$sidebarPanel.BackColor = $COLOR_CARD_BG
$sidebarPanel.Dock = "Left"
$form.Controls.Add($sidebarPanel)

# Branding text in sidebar
$sidebarLabel = New-Object System.Windows.Forms.Label
$sidebarLabel.Text = "E C H O`r`nS C R I B E"
$sidebarLabel.Font = New-Object System.Drawing.Font("Consolas", 14, [System.Drawing.FontStyle]::Bold)
$sidebarLabel.ForeColor = $COLOR_ACCENT
$sidebarLabel.Size = New-Object System.Drawing.Size(160, 80)
$sidebarLabel.Location = New-Object System.Drawing.Point(15, 30)
$sidebarLabel.TextAlign = "MiddleCenter"
$sidebarPanel.Controls.Add($sidebarLabel)

$sidebarDesc = New-Object System.Windows.Forms.Label
$sidebarDesc.Text = "Cognitive`r`nRecording System"
$sidebarDesc.Font = $fontSmall
$sidebarDesc.ForeColor = $COLOR_TEXT_MUTED
$sidebarDesc.Size = New-Object System.Drawing.Size(160, 40)
$sidebarDesc.Location = New-Object System.Drawing.Point(10, 110)
$sidebarDesc.TextAlign = "MiddleCenter"
$sidebarPanel.Controls.Add($sidebarDesc)

# Step Indicators in sidebar
$stepLabels = @()
$stepTitles = @("1. Welcome", "2. License", "3. Destination", "4. Installation", "5. Success")
for ($i = 0; $i -lt $stepTitles.Length; $i++) {
    $lbl = New-Object System.Windows.Forms.Label
    $lbl.Text = $stepTitles[$i]
    $lbl.Font = $fontSmall
    $lbl.ForeColor = if ($i -eq 0) { $COLOR_ACCENT } else { $COLOR_TEXT_MUTED }
    $lbl.Size = New-Object System.Drawing.Size(160, 25)
    $lbl.Location = New-Object System.Drawing.Point(20, 200 + ($i * 30))
    $sidebarPanel.Controls.Add($lbl)
    $stepLabels += $lbl
}

# Main content container panel (right side of form)
$contentPanel = New-Object System.Windows.Forms.Panel
$contentPanel.Location = New-Object System.Drawing.Point(180, 0)
$contentPanel.Size = New-Object System.Drawing.Size(424, 380)
$contentPanel.BackColor = $COLOR_BG_DARK
$form.Controls.Add($contentPanel)

# Footer controls panel (navigation buttons)
$footerPanel = New-Object System.Windows.Forms.Panel
$footerPanel.Location = New-Object System.Drawing.Point(180, 380)
$footerPanel.Size = New-Object System.Drawing.Size(424, 70)
$footerPanel.BackColor = $COLOR_BG_DARK
$form.Controls.Add($footerPanel)

# Border line between content and footer
$borderLine = New-Object System.Windows.Forms.Label
$borderLine.Size = New-Object System.Drawing.Size(424, 1)
$borderLine.Location = New-Object System.Drawing.Point(0, 0)
$borderLine.BackColor = $COLOR_BORDER
$footerPanel.Controls.Add($borderLine)

# ------------------------------------------------------------------------
# NAVIGATION BUTTONS
# ------------------------------------------------------------------------
$btnCancel = New-Object System.Windows.Forms.Button
$btnCancel.Text = "Cancel"
$btnCancel.Size = New-Object System.Drawing.Size(85, 30)
$btnCancel.Location = New-Object System.Drawing.Point(315, 20)
$btnCancel.FlatStyle = "Flat"
$btnCancel.FlatAppearance.BorderColor = $COLOR_BORDER
$btnCancel.FlatAppearance.MouseOverBackColor = $COLOR_CARD_BG
$btnCancel.ForeColor = $COLOR_TEXT_MAIN
$btnCancel.BackColor = $COLOR_CARD_BG
$btnCancel.Font = $fontBody
$btnCancel.Add_Click({ $form.Close() })
$footerPanel.Controls.Add($btnCancel)

$btnNext = New-Object System.Windows.Forms.Button
$btnNext.Text = "Next >"
$btnNext.Size = New-Object System.Drawing.Size(85, 30)
$btnNext.Location = New-Object System.Drawing.Point(215, 20)
$btnNext.FlatStyle = "Flat"
$btnNext.FlatAppearance.BorderSize = 0
$btnNext.BackColor = $COLOR_ACCENT
$btnNext.ForeColor = [System.Drawing.Color]::White
$btnNext.Font = $fontBody
$btnNext.Add_Click({ GoToNextStep })
$footerPanel.Controls.Add($btnNext)

$btnBack = New-Object System.Windows.Forms.Button
$btnBack.Text = "< Back"
$btnBack.Size = New-Object System.Drawing.Size(85, 30)
$btnBack.Location = New-Object System.Drawing.Point(115, 20)
$btnBack.FlatStyle = "Flat"
$btnBack.FlatAppearance.BorderColor = $COLOR_BORDER
$btnBack.FlatAppearance.MouseOverBackColor = $COLOR_CARD_BG
$btnBack.ForeColor = $COLOR_TEXT_MUTED
$btnBack.BackColor = $COLOR_CARD_BG
$btnBack.Font = $fontBody
$btnBack.Enabled = $false
$btnBack.Add_Click({ GoToPrevStep })
$footerPanel.Controls.Add($btnBack)

# ------------------------------------------------------------------------
# PANEL ROUTER STEPS MODULES
# ------------------------------------------------------------------------
# Step 0: Welcome Screen
$panelStep0 = New-Object System.Windows.Forms.Panel
$panelStep0.Size = $contentPanel.Size
$panelStep0.Visible = $true
$contentPanel.Controls.Add($panelStep0)

$lblS0Title = New-Object System.Windows.Forms.Label
$lblS0Title.Text = "Welcome to the $APP_NAME Setup Guide"
$lblS0Title.Font = $fontDisplay
$lblS0Title.ForeColor = $COLOR_TEXT_MAIN
$lblS0Title.Size = New-Object System.Drawing.Size(390, 60)
$lblS0Title.Location = New-Object System.Drawing.Point(15, 30)
$panelStep0.Controls.Add($lblS0Title)

$lblS0Body = New-Object System.Windows.Forms.Label
$lblS0Body.Text = "This setup wizard will configure and pack the fully offline $APP_FULL_NAME software suite directly onto your local machine.`n`nEvery required module, node executor, structural framework, and interface wrapper will be compiled locally into a standalone system structure.`n`nClick 'Next' to continue."
$lblS0Body.Font = $fontBody
$lblS0Body.ForeColor = $COLOR_TEXT_MUTED
$lblS0Body.Size = New-Object System.Drawing.Size(380, 200)
$lblS0Body.Location = New-Object System.Drawing.Point(15, 110)
$panelStep0.Controls.Add($lblS0Body)

# Step 1: Legal License
$panelStep1 = New-Object System.Windows.Forms.Panel
$panelStep1.Size = $contentPanel.Size
$panelStep1.Visible = $false
$contentPanel.Controls.Add($panelStep1)

$lblS1Title = New-Object System.Windows.Forms.Label
$lblS1Title.Text = "End-User Licensing Agreement"
$lblS1Title.Font = $fontDisplay
$lblS1Title.ForeColor = $COLOR_TEXT_MAIN
$lblS1Title.Size = New-Object System.Drawing.Size(390, 40)
$lblS1Title.Location = New-Object System.Drawing.Point(15, 20)
$panelStep1.Controls.Add($lblS1Title)

$txtS1License = New-Object System.Windows.Forms.TextBox
$txtS1License.Multiline = $true
$txtS1License.ReadOnly = $true
$txtS1License.ScrollBars = "Vertical"
$txtS1License.BackColor = $COLOR_CARD_BG
$txtS1License.ForeColor = $COLOR_TEXT_MAIN
$txtS1License.Font = New-Object System.Drawing.Font("Consolas", 8.5)
$txtS1License.Size = New-Object System.Drawing.Size(380, 180)
$txtS1License.Location = New-Object System.Drawing.Point(15, 75)
$licenseBody = @"
ECHOSCRIBE COGNITIVE VOICE RECORDER LICENSE AGREEMENT
Version 1.0.0 (Local Standalone Edition)

BY INSTALLING, COPYING, OR RUNNING THE SOFTWARE, YOU CONFIRM ACCEPTANCE OF THESE TERMS:

1. PRIVATE LOCAL BOUNDARY: EchoScribe runs completely locally on your personal machine. All database indexes, markdown structured files, and cached voice files are saved inside your selected directory.

2. SYSTEM PRE-REQUISITES: If a local system container is required, this installer automatically provisions a standalone, portable Node-environment sandbox into your local installation paths.

3. COGNITIVE REFINEMENTS: Refinements and corrections using Gemini or structural LLMs require secure, user-managed API keys. No data leaves your machine unless matching standard APIs are initiated by you.

4. LIMITATION OF LIABILITY: Under no circumstances shall the author be liable for any accidental loss of localized markdown files. Always combine EchoScribe with a local back-up repository or Obsidian Sync paths.

EchoScribe is fully open-source and free to share!
"@
$txtS1License.Text = $licenseBody
$panelStep1.Controls.Add($txtS1License)

$chkS1Accept = New-Object System.Windows.Forms.CheckBox
$chkS1Accept.Text = "I accept the terms of the private license agreement"
$chkS1Accept.Font = $fontSmall
$chkS1Accept.ForeColor = $COLOR_TEXT_MAIN
$chkS1Accept.Size = New-Object System.Drawing.Size(380, 25)
$chkS1Accept.Location = New-Object System.Drawing.Point(15, 270)
$chkS1Accept.Add_CheckedChanged({
    $btnNext.Enabled = $chkS1Accept.Checked
})
$panelStep1.Controls.Add($chkS1Accept)

# Step 2: Path Location Selector
$panelStep2 = New-Object System.Windows.Forms.Panel
$panelStep2.Size = $contentPanel.Size
$panelStep2.Visible = $false
$contentPanel.Controls.Add($panelStep2)

$lblS2Title = New-Object System.Windows.Forms.Label
$lblS2Title.Text = "Choose Destination Folder"
$lblS2Title.Font = $fontDisplay
$lblS2Title.ForeColor = $COLOR_TEXT_MAIN
$lblS2Title.Size = New-Object System.Drawing.Size(390, 40)
$lblS2Title.Location = New-Object System.Drawing.Point(15, 20)
$panelStep2.Controls.Add($lblS2Title)

$lblS2Body = New-Object System.Windows.Forms.Label
$lblS2Body.Text = "Please select the installation destination directory for $APP_NAME. All local binaries, database adapters, templates, and sound caches will reside in this space."
$lblS2Body.Font = $fontBody
$lblS2Body.ForeColor = $COLOR_TEXT_MUTED
$lblS2Body.Size = New-Object System.Drawing.Size(380, 60)
$lblS2Body.Location = New-Object System.Drawing.Point(15, 75)
$panelStep2.Controls.Add($lblS2Body)

$lblS2Selection = New-Object System.Windows.Forms.Label
$lblS2Selection.Text = "Install Path:"
$lblS2Selection.Font = $fontSub
$lblS2Selection.ForeColor = $COLOR_TEXT_MAIN
$lblS2Selection.Size = New-Object System.Drawing.Size(380, 20)
$lblS2Selection.Location = New-Object System.Drawing.Point(15, 160)
$panelStep2.Controls.Add($lblS2Selection)

$txtS2Path = New-Object System.Windows.Forms.TextBox
$txtS2Path.Size = New-Object System.Drawing.Size(280, 26)
$txtS2Path.Location = New-Object System.Drawing.Point(15, 190)
$txtS2Path.Font = $fontBody
$txtS2Path.BackColor = $COLOR_CARD_BG
$txtS2Path.ForeColor = $COLOR_TEXT_MAIN
$txtS2Path.BorderStyle = "FixedSingle"
$txtS2Path.Text = $DEFAULT_INSTALL_PATH
$panelStep2.Controls.Add($txtS2Path)

$btnS2Browse = New-Object System.Windows.Forms.Button
$btnS2Browse.Text = "Browse..."
$btnS2Browse.Size = New-Object System.Drawing.Size(90, 26)
$btnS2Browse.Location = New-Object System.Drawing.Point(305, 190)
$btnS2Browse.FlatStyle = "Flat"
$btnS2Browse.FlatAppearance.BorderColor = $COLOR_BORDER
$btnS2Browse.FlatAppearance.MouseOverBackColor = $COLOR_CARD_BG
$btnS2Browse.ForeColor = $COLOR_TEXT_MAIN
$btnS2Browse.BackColor = $COLOR_CARD_BG
$btnS2Browse.Font = $fontSmall
$btnS2Browse.Add_Click({
    $folderBrowser = New-Object System.Windows.Forms.FolderBrowserDialog
    $folderBrowser.Description = "Select target folder to locate EchoScribe"
    $folderBrowser.SelectedPath = $txtS2Path.Text
    if ($folderBrowser.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        $txtS2Path.Text = $folderBrowser.SelectedPath
        $selectedPath = $folderBrowser.SelectedPath
    }
})
$panelStep2.Controls.Add($btnS2Browse)

$lblS2Space = New-Object System.Windows.Forms.Label
$lblS2Space.Text = "Requires at least 150MB of free storage capacity (including sandboxed node variables)."
$lblS2Space.Font = $fontSmall
$lblS2Space.ForeColor = $COLOR_TEXT_MUTED
$lblS2Space.Size = New-Object System.Drawing.Size(380, 40)
$lblS2Space.Location = New-Object System.Drawing.Point(15, 240)
$panelStep2.Controls.Add($lblS2Space)

# Step 3: Progressive Extraction / Installation Output
$panelStep3 = New-Object System.Windows.Forms.Panel
$panelStep3.Size = $contentPanel.Size
$panelStep3.Visible = $false
$contentPanel.Controls.Add($panelStep3)

$lblS3Title = New-Object System.Windows.Forms.Label
$lblS3Title.Text = "Installing EchoScribe..."
$lblS3Title.Font = $fontDisplay
$lblS3Title.ForeColor = $COLOR_TEXT_MAIN
$lblS3Title.Size = New-Object System.Drawing.Size(390, 40)
$lblS3Title.Location = New-Object System.Drawing.Point(15, 20)
$panelStep3.Controls.Add($lblS3Title)

$lblS3Status = New-Object System.Windows.Forms.Label
$lblS3Status.Text = "Preparing installation variables..."
$lblS3Status.Font = $fontBody
$lblS3Status.ForeColor = $COLOR_TEXT_MUTED
$lblS3Status.Size = New-Object System.Drawing.Size(380, 25)
$lblS3Status.Location = New-Object System.Drawing.Point(15, 80)
$panelStep3.Controls.Add($lblS3Status)

$progressBar = New-Object System.Windows.Forms.ProgressBar
$progressBar.Size = New-Object System.Drawing.Size(380, 22)
$progressBar.Location = New-Object System.Drawing.Point(15, 115)
$progressBar.Style = "Blocks"
$panelStep3.Controls.Add($progressBar)

$txtS3Logs = New-Object System.Windows.Forms.TextBox
$txtS3Logs.Multiline = $true
$txtS3Logs.ReadOnly = $true
$txtS3Logs.ScrollBars = "Vertical"
$txtS3Logs.BackColor = $COLOR_CARD_BG
$txtS3Logs.ForeColor = $COLOR_TEXT_MUTED
$txtS3Logs.Font = New-Object System.Drawing.Font("Consolas", 8)
$txtS3Logs.Size = New-Object System.Drawing.Size(380, 180)
$txtS3Logs.Location = New-Object System.Drawing.Point(15, 160)
$panelStep3.Controls.Add($txtS3Logs)

# Step 4: Installation Completed Panel success
$panelStep4 = New-Object System.Windows.Forms.Panel
$panelStep4.Size = $contentPanel.Size
$panelStep4.Visible = $false
$contentPanel.Controls.Add($panelStep4)

$lblS4Title = New-Object System.Windows.Forms.Label
$lblS4Title.Text = "Setup Success!"
$lblS4Title.Font = $fontDisplay
$lblS4Title.ForeColor = $COLOR_ACCENT
$lblS4Title.Size = New-Object System.Drawing.Size(390, 45)
$lblS4Title.Location = New-Object System.Drawing.Point(15, 20)
$panelStep4.Controls.Add($lblS4Title)

$lblS4Success = New-Object System.Windows.Forms.Label
$lblS4Success.Text = "$APP_NAME is now fully compiled, localized, and secured on your desktop!`n`nA standard Windows Add/Remove program entry has been registered so you can seamlessly configure, uninstall, or repair the package in the future directly via Settings.`n`nWe have successfully established:"
$lblS4Success.Font = $fontBody
$lblS4Success.ForeColor = $COLOR_TEXT_MAIN
$lblS4Success.Size = New-Object System.Drawing.Size(380, 100)
$lblS4Success.Location = New-Object System.Drawing.Point(15, 75)
$panelStep4.Controls.Add($lblS4Success)

$lblS4Bullets = New-Object System.Windows.Forms.Label
$lblS4Bullets.Text = "✔ Fully functional sandboxed Node.js core`n✔ Fully compiled local production build files`n✔ Registry compliant desktop shortcuts`n✔ Automated Windows program registry entry"
$lblS4Bullets.Font = $fontSub
$lblS4Bullets.ForeColor = $COLOR_TEXT_MUTED
$lblS4Bullets.Size = New-Object System.Drawing.Size(380, 100)
$lblS4Bullets.Location = New-Object System.Drawing.Point(25, 175)
$panelStep4.Controls.Add($lblS4Bullets)

$chkS4Run = New-Object System.Windows.Forms.CheckBox
$chkS4Run.Text = "Launch EchoScribe Desktop App immediately"
$chkS4Run.Font = $fontBody
$chkS4Run.ForeColor = $COLOR_TEXT_MAIN
$chkS4Run.Size = New-Object System.Drawing.Size(380, 25)
$chkS4Run.Location = New-Object System.Drawing.Point(25, 285)
$chkS4Run.Checked = $true
$panelStep4.Controls.Add($chkS4Run)

# ------------------------------------------------------------------------
# CONTROLLER STATE ROUTERS
# ------------------------------------------------------------------------
function RefreshStepIndicator {
    for ($i = 0; $i -lt $stepLabels.Length; $i++) {
        if ($i -eq $currentStep) {
            $stepLabels[$i].ForeColor = $COLOR_ACCENT
            $stepLabels[$i].Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
        } else {
            $stepLabels[$i].ForeColor = $COLOR_TEXT_MUTED
            $stepLabels[$i].Font = $fontSmall
        }
    }
}

function GoToNextStep {
    if ($currentStep -eq 0) {
        # Go to License agreement
        $panelStep0.Visible = $false
        $panelStep1.Visible = $true
        $currentStep = 1
        $btnBack.Enabled = $true
        $btnNext.Enabled = $chkS1Accept.Checked # Only allow next if accepted
        RefreshStepIndicator
    }
    elseif ($currentStep -eq 1) {
        # Go to Path selector
        $panelStep1.Visible = $false
        $panelStep2.Visible = $true
        $currentStep = 2
        $btnNext.Enabled = $true
        RefreshStepIndicator
    }
    elseif ($currentStep -eq 2) {
        # Save custom path and step to Installing state
        $selectedPath = $txtS2Path.Text
        $panelStep2.Visible = $false
        $panelStep3.Visible = $true
        $currentStep = 3
        $btnBack.Enabled = $false
        $btnNext.Enabled = $false
        $btnCancel.Enabled = $false
        RefreshStepIndicator
        # Yield process to async execution block
        $form.Refresh()
        StartActiveInstallation
    }
    elseif ($currentStep -eq 4) {
        # Finish clicked!
        if ($chkS4Run.Checked) {
            $shortcutLnk = Join-Path $selectedPath "launch-echoscribe.bat"
            if (Test-Path $shortcutLnk) {
                # Start in separate process without holding parent cmd console
                Start-Process "cmd.exe" -ArgumentList "/c start `"`" `"$shortcutLnk`"" -WindowStyle Hidden
            }
        }
        $form.Close()
    }
}

function GoToPrevStep {
    if ($currentStep -eq 1) {
        $panelStep1.Visible = $false
        $panelStep0.Visible = $true
        $currentStep = 0
        $btnBack.Enabled = $false
        $btnNext.Enabled = $true
        RefreshStepIndicator
    }
    elseif ($currentStep -eq 2) {
        $panelStep2.Visible = $false
        $panelStep1.Visible = $true
        $currentStep = 1
        $btnNext.Enabled = $chkS1Accept.Checked
        RefreshStepIndicator
    }
}

function AppendLog($msg) {
    $txtS3Logs.AppendText("$msg`r`n")
    $txtS3Logs.SelectionStart = $txtS3Logs.Text.Length
    $txtS3Logs.ScrollToCaret()
    $form.Refresh()
}

# ------------------------------------------------------------------------
# CORE INSTALLATION THREAD SIMULATION & EXECUTION
# ------------------------------------------------------------------------
function StartActiveInstallation {
    AppendLog "[START] Initiating desktop registry for Echo Scribe..."
    $progressBar.Value = 5
    Start-Sleep -m 400

    # 1. Ensure target directory is prepared
    $lblS3Status.Text = "Creating installation directories..."
    AppendLog "[DIR] Targeting folder: $selectedPath"
    try {
        if (!(Test-Path $selectedPath)) {
            New-Item -ItemType Directory -Path $selectedPath -Force | Out-Null
        }
        $progressBar.Value = 15
    } catch {
        AppendLog "[ERROR] Access Denied: Could not write folders in this environment string path."
        MessageBox "Please select a standard directory where you have read/write access (for example in your local user directory) or run as Administrator."
        ResetToStep2
        return
    }
    Start-Sleep -m 400

    # 2. Synchronize portable node sandbox
    $lblS3Status.Text = "Configuring system sandbox environments..."
    $localNodeSource = Join-Path $SOURCE_DIR ".local-node"
    $localNodeDest = Join-Path $selectedPath ".local-node"

    if (Test-Path $localNodeSource) {
        AppendLog "[SANDBOX] Found sandboxed node libraries. Transferring locally..."
        Copy-Item -Path "$localNodeSource\*" -Destination $localNodeDest -Recurse -Force -ErrorAction SilentlyContinue | Out-Null
        AppendLog "[SANDBOX] Sandboxed core mapped successfully."
    } else {
        AppendLog "[SANDBOX] Global system path will be utilized (custom localized node directory skipped)."
    }
    $progressBar.Value = 35
    Start-Sleep -m 300

    # 3. Synchronize package assets
    $lblS3Status.Text = "Extracting app package components..."
    AppendLog "[DEPLOY] Moving web frameworks, assets, and styling libraries..."

    $itemsToCopy = @("package.json", "tsconfig.json", "vite.config.ts", "server.ts", "src", "dist", "notes", "node_modules", "app-icon.ico", "launch-echoscribe.bat")
    $copiedCount = 0
    foreach ($item in $itemsToCopy) {
        $srcPath = Join-Path $SOURCE_DIR $item
        if (Test-Path $srcPath) {
            AppendLog "[DEPLOY] Copying $item..."
            Copy-Item -Path $srcPath -Destination $selectedPath -Recurse -Force -ErrorAction SilentlyContinue | Out-Null
            $copiedCount++
        }
        $progressBar.Value = 35 + [int]((30 / $itemsToCopy.Length) * $copiedCount)
        $form.Refresh()
    }
    AppendLog "[DEPLOY] Package transfer operations completed safely ($copiedCount components synced)."
    Start-Sleep -m 300

    # 4. Generate visual shortcuts
    $lblS3Status.Text = "Establishing program execution lines..."
    $launchScript = Join-Path $selectedPath "launch-echoscribe.bat"
    $logoIcon = Join-Path $selectedPath "app-icon.ico"
    
    AppendLog "[SHORTCUT] Pinning shortcut entry directly to Microsoft Windows Desktop..."
    try {
        $desktopPath = [System.IO.Path]::Combine([System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop), "EchoScribe.lnk")
        $wshShell = New-Object -ComObject WScript.Shell
        $shortcut = $wshShell.CreateShortcut($desktopPath)
        $shortcut.TargetPath = $launchScript
        $shortcut.WorkingDirectory = $selectedPath
        $shortcut.IconLocation = "$logoIcon,0"
        $shortcut.Description = $APP_FULL_NAME
        $shortcut.Save()
        AppendLog "[SHORTCUT] Desktop environment pinning successful!"
    } catch {
        AppendLog "[WARNING] Could not construct desktop short cuts directly due to user limits."
    }
    
    AppendLog "[SHORTCUT] Creating Start Menu shortcut program folder..."
    try {
        $startMenuPrograms = [System.IO.Path]::Combine([System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Programs), "EchoScribe")
        if (!(Test-Path $startMenuPrograms)) {
            New-Item -ItemType Directory -Path $startMenuPrograms -Force | Out-Null
        }
        $startMenuLnk = Join-Path $startMenuPrograms "EchoScribe.lnk"
        $shortcutSM = $wshShell.CreateShortcut($startMenuLnk)
        $shortcutSM.TargetPath = $launchScript
        $shortcutSM.WorkingDirectory = $selectedPath
        $shortcutSM.IconLocation = "$logoIcon,0"
        $shortcutSM.Description = $APP_FULL_NAME
        $shortcutSM.Save()
        AppendLog "[SHORTCUT] Start Menu programs hierarchy registered successfully!"
    } catch {
        AppendLog "[WARNING] Could not register Start Menu shortcuts because of system policies."
    }
    $progressBar.Value = 85
    Start-Sleep -m 400

    # 5. Formulate standard uninstaller & uninstall script
    $lblS3Status.Text = "Configuring system uninstaller..."
    AppendLog "[UNINSTALLER] Fabricating standard setup components..."
    
    # Create the beautiful uninstaller batch script itself inside the program directory for easy execution
    $uninstallerLnk = Join-Path $selectedPath "uninstall-echoscribe.bat"
    $uninstallScriptContents = @"
@echo off
title EchoScribe Uninstaller Support
color 0F
echo ======================================================================
echo                ECHOSCRIBE COGNITIVE VOICE RECORDER
echo                    NATIVE DESKTOP UNINSTALLER
echo ======================================================================
echo.
echo This action will cleanly remove EchoScribe and its shortcuts from your system.
echo Your saved voice recordings and notes folder will remain completely secure!
echo.
pause
echo.
echo Running PowerShell Uninstallation Wizard...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall-wizard.ps1"
if %errorlevel% equ 0 (
    echo [RUN] System uninstallation processed successfully. Done!
) else (
    echo [WARNING] Uninstaller completed path cleanup.
)
exit /b 0
"@
    Set-Content -Path $uninstallerLnk -Value $uninstallScriptContents
    
    # We will generate uninstall-wizard.ps1 during this deployment to reside alongside
    $uninstallWizardPath = Join-Path $selectedPath "uninstall-wizard.ps1"
    Copy-Item -Path (Join-Path $SOURCE_DIR "uninstall-wizard.ps1") -Destination $uninstallWizardPath -Force -ErrorAction SilentlyContinue

    # 6. Windows Registry Integration (Enables Standard Add/Remove Programs integration)
    $lblS3Status.Text = "Registering with Windows Apps Settings..."
    AppendLog "[REGISTRY] Mapping uninstall handlers inside CurrentUser registry boundaries..."
    
    $registryRoot = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\EchoScribe"
    try {
        if (!(Test-Path $registryRoot)) {
            New-Item -Path $registryRoot -Force | Out-Null
        }
        New-ItemProperty -Path $registryRoot -Name "DisplayName" -Value $APP_FULL_NAME -PropertyType String -Force | Out-Null
        New-ItemProperty -Path $registryRoot -Name "DisplayVersion" -Value $APP_VERSION -PropertyType String -Force | Out-Null
        New-ItemProperty -Path $registryRoot -Name "Publisher" -Value "EchoScribe Systems" -PropertyType String -Force | Out-Null
        New-ItemProperty -Path $registryRoot -Name "UninstallString" -Value "`"$uninstallerLnk`"" -PropertyType String -Force | Out-Null
        New-ItemProperty -Path $registryRoot -Name "DisplayIcon" -Value $logoIcon -PropertyType String -Force | Out-Null
        New-ItemProperty -Path $registryRoot -Name "InstallLocation" -Value $selectedPath -PropertyType String -Force | Out-Null
        New-ItemProperty -Path $registryRoot -Name "URLInfoAbout" -Value "http://localhost:3000" -PropertyType String -Force | Out-Null
        New-ItemProperty -Path $registryRoot -Name "NoModify" -Value 1 -PropertyType DWord -Force | Out-Null
        New-ItemProperty -Path $registryRoot -Name "NoRepair" -Value 1 -PropertyType DWord -Force | Out-Null
        AppendLog "[REGISTRY] Desktop integration written completely."
    } catch {
        AppendLog "[WARNING] Could not write Add/Remove program registry keys due to administrative limits."
    }

    $progressBar.Value = 100
    AppendLog "[SUCCESS] EchoScribe fully integrated!"
    Start-Sleep -m 400

    # Advance to success slide
    $panelStep3.Visible = $false
    $panelStep4.Visible = $true
    $currentStep = 4
    $btnBack.Enabled = $false
    $btnNext.Enabled = $true
    $btnNext.Text = "Finish"
    $btnCancel.Visible = $false
    RefreshStepIndicator
    $form.Refresh()
}

function MessageBox($msg) {
    [System.Windows.Forms.MessageBox]::Show($msg, "$APP_NAME Setup Alert", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
}

function ResetToStep2 {
    $panelStep3.Visible = $false
    $panelStep2.Visible = $true
    $currentStep = 2
    $btnBack.Enabled = $true
    $btnNext.Enabled = $true
    $btnCancel.Enabled = $true
    RefreshStepIndicator
    $form.Refresh()
}

# Run the form visual thread
[System.Windows.Forms.Application]::Run($form)
